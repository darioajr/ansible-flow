import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import {
  newProject,
  newPlaybook,
  connectSequential,
  duplicateNodes,
  walk,
  type AutomationNode,
} from "@visual-ansible/air";
import { parsePlaybook } from "@visual-ansible/parser";
import { generateYaml } from "@visual-ansible/generator";
import { validatePlaybook, assertProject } from "@visual-ansible/validator";
import { modules, parseAnsibleDoc } from "@visual-ansible/module-metadata";
import { projectSchema, webviewMessageSchema } from "@visual-ansible/schemas";
import { createEditorStore, currentPlay } from "../packages/editor/src/store";
const fixture = readFileSync(
  new URL("./fixtures/nginx.yml", import.meta.url),
  "utf8",
);
it("applies YAML atomically, preserves other books and supports undo/redo", () => {
  const project = newProject("YAML edit");
  const other = newPlaybook("other.yml");
  project.playbooks.push(other);
  const store = createEditorStore(project);
  store.getState().applyYaml(fixture);
  const applied = store.getState().project;
  expect(applied.playbooks[0].id).toBe(project.playbooks[0].id);
  expect(applied.playbooks[1]).toEqual(other);
  expect(currentPlay(store.getState())!.tasks.length).toBeGreaterThan(0);
  expect(generateYaml(applied.playbooks[0])).toContain("nginx");
  store.getState().undo();
  expect(store.getState().project).toEqual(project);
  store.getState().redo();
  expect(store.getState().project).toEqual(applied);
});
it.each([
  "- hosts: [",
  "- hosts: all\n  import_playbook: other.yml\n",
  "- hosts: all\n  vars: {password: literal}\n  tasks: []\n",
  "- hosts: all\n  tasks:\n    - ansible.builtin.service: {name: nginx}\n",
])("rejects invalid YAML without changing diagram or history: %s", (text) => {
  const store = createEditorStore(newProject("YAML edit"));
  const before = store.getState();
  expect(() => store.getState().applyYaml(text)).toThrow();
  expect(store.getState()).toBe(before);
});
describe("shared Ansible engine", () => {
  it("imports and exports the nginx demo without losing semantics", () => {
    const result = parsePlaybook(fixture);
    expect(result.editable).toBe(true);
    expect(result.problems).toEqual([]);
    expect(validatePlaybook(result.playbook)).toEqual([]);
    expect(parse(generateYaml(result.playbook))).toEqual(parse(fixture));
  });
  it("preserves comments and quoted permissions when changing arguments", () => {
    const { playbook } = parsePlaybook(fixture);
    playbook.plays[0].tasks[0].module!.args.name = "httpd";
    const generated = generateYaml(playbook);
    expect(generated).toContain("# Portable nginx configuration");
    expect(generated).toContain("# Package installation");
    expect(parse(generated)[0].tasks[1]["ansible.builtin.template"].mode).toBe(
      "0644",
    );
    expect(parse(generated)[0].tasks[0]["ansible.builtin.dnf"].name).toBe(
      "httpd",
    );
    expect(generated).toBe(generateYaml(playbook));
  });
  it("moves a task with its own comments when reconnecting", () => {
    const { playbook } = parsePlaybook(fixture);
    const play = playbook.plays[0];
    play.tasks = connectSequential(
      play.tasks,
      play.tasks[2].id,
      play.tasks[0].id,
    );
    const output = generateYaml(playbook);
    expect(output.indexOf("# Package installation")).toBeGreaterThan(
      output.indexOf("Start nginx"),
    );
    expect(parse(output)[0].tasks[2].name).toBe("Install nginx");
  });
  it("imports short modules and free-form commands as portable FQCN", () => {
    const result = parsePlaybook(
      "- hosts: all\n  tasks:\n    - command: echo hello\n      args:\n        chdir: /tmp\n",
    );
    expect(result.editable).toBe(true);
    expect(
      parse(generateYaml(result.playbook))[0].tasks[0][
        "ansible.builtin.command"
      ],
    ).toEqual({ cmd: "echo hello", chdir: "/tmp" });
  });
  it("round trips nested blocks, conditions, loops and handler names", () => {
    const source =
      '- hosts: all\n  tasks:\n    - name: Outer\n      when: true\n      block:\n        - name: Print\n          debug:\n            msg: "{{ item }}"\n          loop: [a, b]\n          changed_when: false\n          tags: demo\n';
    const result = parsePlaybook(source);
    expect(result.editable).toBe(true);
    const again = parsePlaybook(generateYaml(result.playbook));
    expect(again.editable).toBe(true);
    expect(again.playbook.plays[0].tasks[0].children![0]).toMatchObject({
      loop: ["a", "b"],
      changed_when: false,
      tags: ["demo"],
    });
  });
  it.each([
    "- hosts: all\n  import_playbook: other.yml\n",
    "- hosts: all\n  tasks:\n    - debug: {}\n      rescue: []\n",
    "- hosts: all\n  tasks:\n    - debug: {msg: hi}\n      with_items: [one]\n",
    "- hosts: all\n  vars:\n    x: !vault encrypted\n",
  ])(
    "marks unsupported constructs read-only and preserves source",
    (source) => {
      const result = parsePlaybook(source);
      expect(result.editable).toBe(false);
      expect(result.playbook.source).toBe(source);
      expect(
        result.problems.some(
          (p) => p.code === "UNSUPPORTED_YAML" && p.line && p.column,
        ),
      ).toBe(true);
    },
  );
  it("rejects duplicate keys, aliases, non-playbooks and excessive nesting", () => {
    for (const text of [
      "- hosts: all\n  hosts: other\n",
      "- hosts: all\n  vars: {a: &a hello, b: *a}\n",
      "apiVersion: v1\nkind: Pod\n",
      "- hosts: all\n  vars: {__proto__: danger}\n",
      "- hosts: all\n  vars: " + "[".repeat(40) + "0" + "]".repeat(40),
    ])
      expect(parsePlaybook(text).editable).toBe(false);
  });
  it("validates required parameters, references, illegal block behavior and credentials", () => {
    const p = newProject("Invalid");
    p.playbooks[0].plays[0].tasks = [
      {
        id: crypto.randomUUID(),
        type: "MODULE",
        name: "Install",
        module: { fqcn: "ansible.builtin.dnf", args: {} },
        notify: ["Missing"],
        register: "bad-name",
      },
    ];
    expect(
      validatePlaybook(p.playbooks[0]).filter((p) => p.severity === "error"),
    ).toHaveLength(3);
    p.playbooks[0].plays[0].vars = { password: "literal" };
    expect(() => assertProject(p)).toThrow("credential");
    p.playbooks[0].plays[0].vars = { password: "{{ vault_password }}" };
    expect(() => assertProject(p)).not.toThrow();
  });
  it("provides builtin and community metadata-driven module forms and parses ansible-doc JSON", () => {
    expect(modules).toHaveLength(20);
    const parsed = parseAnsibleDoc({
      "example.tools.test": {
        doc: {
          short_description: "Test",
          options: {
            enabled: { type: "bool", required: true },
            ports: { type: "list" },
          },
        },
      },
    });
    expect(parsed[0].parameters.enabled).toMatchObject({
      type: "boolean",
      required: true,
    });
    expect(parsed[0].parameters.ports.type).toBe("json");
  });
  it("validates external AIR and rejects Webview paths and commands", () => {
    expect(projectSchema.safeParse(newProject("Valid")).success).toBe(true);
    expect(
      projectSchema.safeParse({ ...newProject("X"), id: "../escape" }).success,
    ).toBe(false);
    expect(
      webviewMessageSchema.safeParse({
        type: "save",
        requestId: crypto.randomUUID(),
        path: "/etc/passwd",
      }).success,
    ).toBe(false);
    expect(
      webviewMessageSchema.safeParse({ type: "execute", command: "sh" })
        .success,
    ).toBe(false);
  });
});
describe("platform-independent graph and history", () => {
  it("reorders without cycles and duplicates nested identities", () => {
    const a: AutomationNode = {
      id: crypto.randomUUID(),
      type: "BLOCK",
      name: "A",
      children: [{ id: crypto.randomUUID(), type: "MODULE", name: "B" }],
    };
    const b: AutomationNode = {
      id: crypto.randomUUID(),
      type: "TASK",
      name: "C",
    };
    expect(connectSequential([a, b], b.id, a.id).map((n) => n.name)).toEqual([
      "C",
      "A",
    ]);
    expect(() => connectSequential([a, b], a.id, a.id)).toThrow();
    const [clone] = duplicateNodes([a]);
    expect(
      walk([clone]).every((n) => !walk([a]).some((x) => x.id === n.id)),
    ).toBe(true);
  });
  it("keeps editor instances isolated and supports undo/redo/copy/paste", () => {
    const a = createEditorStore(newProject("A")),
      b = createEditorStore(newProject("B"));
    a.getState().add("ansible.builtin.debug");
    a.getState().duplicate();
    expect(currentPlay(a.getState())!.tasks).toHaveLength(2);
    expect(currentPlay(b.getState())!.tasks).toHaveLength(0);
    a.getState().undo();
    expect(currentPlay(a.getState())!.tasks).toHaveLength(1);
    a.getState().redo();
    expect(currentPlay(a.getState())!.tasks).toHaveLength(2);
  });
  it("restores navigation when undo removes the active playbook", () => {
    const s = createEditorStore(newProject("Test"));
    s.getState().addBook("second.yml");
    s.getState().undo();
    expect(currentPlay(s.getState())).toBeDefined();
    expect(s.getState().project.playbooks).toHaveLength(1);
  });
  it("generates stable empty playbooks", () => {
    const b = newPlaybook();
    expect(parse(generateYaml(b))[0]).toMatchObject({
      hosts: "all",
      tasks: [],
    });
  });
});
it("preserves package lists and rejects hidden overrides in extra fields", () => {
  const result = parsePlaybook(
    "- hosts: all\n  tasks:\n    - name: Packages\n      ansible.builtin.package:\n        name: [nginx, curl]\n        state: present\n",
  );
  expect(validatePlaybook(result.playbook)).toEqual([]);
  expect(
    parse(generateYaml(result.playbook))[0].tasks[0]["ansible.builtin.package"]
      .name,
  ).toEqual(["nginx", "curl"]);
  const project = newProject("Test");
  project.playbooks[0].plays[0].extra = { hosts: "hidden-target" };
  expect(projectSchema.safeParse(project).success).toBe(false);
});
