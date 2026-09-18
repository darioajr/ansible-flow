import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { parsePlaybook } from "@visual-ansible/parser";
import { generateYaml } from "@visual-ansible/generator";
import { validatePlaybook } from "@visual-ansible/validator";
import {
  newProject,
  playNodes,
  walk,
  duplicateNodes,
  removeNodes,
  updateNode,
} from "@visual-ansible/air";
import { projectSchema, hostMessageSchema } from "@visual-ansible/schemas";
import { modules, parseAnsibleDoc } from "@visual-ansible/module-metadata";
import {
  createEditorStore,
  currentPlay,
  nodesIn,
  parentScope,
} from "../packages/editor/src/store";
import { editedDocument } from "../apps/vscode/extension/src/document-service";
import { cliProblems } from "../apps/vscode/extension/src/cli-diagnostics";
import {
  listModules,
  loadModules,
} from "../apps/vscode/extension/src/module-discovery";
const fixture = readFileSync(
  new URL("./fixtures/roles-blocks.yml", import.meta.url),
  "utf8",
);
it("finds the enclosing scope for blocks and recovery branches at any depth", () => {
  const play = parsePlaybook(fixture).playbook.plays[0];
  const outer = play.tasks[0];
  const nested = outer.rescue![0];
  for (const branch of ["", ":rescue", ":always"]) {
    expect(parentScope(play, `${outer.id}${branch}`)).toBe("tasks");
    expect(parentScope(play, `${nested.id}${branch}`)).toBe(
      `${outer.id}:rescue`,
    );
  }
  play.tasks = play.tasks.slice(1);
  play.pre_tasks = [outer];
  expect(parentScope(play, outer.id)).toBe("pre_tasks");
  play.pre_tasks = [];
  play.post_tasks = [outer];
  expect(parentScope(play, outer.id)).toBe("post_tasks");
  for (const scope of [
    "tasks",
    "pre_tasks",
    "post_tasks",
    "roles",
    "handlers",
    "missing",
  ])
    expect(parentScope(play, scope)).toBeUndefined();
});
it("round trips role order, variables, pre/post tasks and nested recovery in both clients", () => {
  const result = parsePlaybook(fixture);
  expect(result.problems).toEqual([]);
  expect(result.editable).toBe(true);
  expect(result.playbook.plays[0].vars.create_user_file).toBe(true);
  expect(result.playbook.plays[0].become).toBe(false);
  expect(validatePlaybook(result.playbook)).toEqual([]);
  const web = createEditorStore(newProject("Web"));
  web.getState().applyYaml(fixture);
  const generated = generateYaml(web.getState().project.playbooks[0]);
  const native = editedDocument(fixture, 1, 1, result.playbook);
  expect(parse(generated)).toEqual(parse(native));
  const play = parse(generated)[0];
  expect(play.roles[0].role).toBe("demo");
  expect(play.roles[1].vars.role_message).toBe("example");
  expect(play.tasks[0].rescue[0].always[0]["ansible.builtin.debug"].msg).toBe(
    "nested-cleanup",
  );
  expect(play.pre_tasks[0].name).toBe("Prepare");
  expect(play.post_tasks[0].name).toBe("Complete");
  expect(generated).toContain("# Recovery and roles");
  expect(parsePlaybook(generated).editable).toBe(true);
  expect(projectSchema.safeParse(web.getState().project).success).toBe(true);
});
it("edits, duplicates, deletes and reorders recovery branches without touching sibling scopes", () => {
  const store = createEditorStore(newProject("Branches"));
  store.getState().applyYaml(fixture);
  const play = currentPlay(store.getState())!;
  const block = play.tasks[0];
  store
    .getState()
    .navigate(store.getState().bookId, play.id, `${block.id}:always`);
  const cleanup = nodesIn(play, `${block.id}:always`)[0];
  store.getState().patch(cleanup.id, { name: "New cleanup" });
  expect(currentPlay(store.getState())!.tasks[0].always![0].name).toBe(
    "New cleanup",
  );
  store.getState().add("ansible.builtin.debug");
  const list = nodesIn(currentPlay(store.getState()), store.getState().scope);
  store.getState().connect(list[1].id, list[0].id);
  expect(
    nodesIn(currentPlay(store.getState()), store.getState().scope)[1].id,
  ).toBe(cleanup.id);
  store.getState().undo();
  expect(
    nodesIn(currentPlay(store.getState()), store.getState().scope)[0].id,
  ).toBe(cleanup.id);
  const copies = duplicateNodes([block]);
  const ids = walk([block]).map((n) => n.id);
  expect(walk(copies).every((n) => !ids.includes(n.id))).toBe(true);
  const nested = block.rescue![0].always![0];
  expect(
    walk(updateNode([block], nested.id, { name: "Updated" })).find(
      (n) => n.id === nested.id,
    )?.name,
  ).toBe("Updated");
  expect(
    walk(removeNodes([block], [nested.id])).some((n) => n.id === nested.id),
  ).toBe(false);
  expect(currentPlay(store.getState())!.roles).toEqual(play.roles);
});
it.each([
  "- hosts: all\n  vars:\n  page_title: Wrong indentation\n",
  "- hosts: all\n  tasks:\n    - file:\n      path: /tmp/demo\n      state: touch\n",
  "- hosts: all\n  vars:\n    create\\_file: true\n",
  "- hosts: all\n  tasks:\n    - debug: {}\n      rescue: []\n",
  "- hosts: all\n  vars:\n    - username: sammy\n    - not a mapping\n",
])(
  "reports exact location and preserves malformed/unsupported text",
  (text) => {
    const result = parsePlaybook(text);
    expect(result.editable).toBe(false);
    expect(result.playbook.source).toBe(text);
    expect(result.problems.every((p) => p.line! > 0 && p.column! > 0)).toBe(
      true,
    );
  },
);
it("imports the corrected user examples with apt, replace and ufw forms", () => {
  const result = parsePlaybook(`- hosts: all
  become: yes
  vars:
    - user: sammy
    - create_user_file: yes
  tasks:
    - apt: {name: nginx, state: latest}
    - file: {path: '/home/{{ user }}/myfile', state: touch}
      when: create_user_file
    - replace:
        path: /etc/nginx/sites-available/default
        regexp: 'root /var/www/html;'
        replace: 'root /var/www/mypage;'
    - ufw: {rule: allow, port: '80', proto: tcp}
`);
  expect(result.editable).toBe(true);
  expect(result.playbook.plays[0].tasks[3].module?.fqcn).toBe(
    "community.general.ufw",
  );
  expect(validatePlaybook(result.playbook)).toEqual([]);
  expect(
    modules.find((m) => m.label === "replace")?.parameters.regexp.required,
  ).toBe(true);
});
it("preserves quoted booleans while reading Ansible yes/no literals and merging vars lists", () => {
  const result = parsePlaybook(
    '- hosts: all\n  vars:\n    - flag: yes\n    - quoted: "yes"\n    - value: first\n    - value: last\n  tasks: []\n',
  );
  expect(result.playbook.plays[0].vars).toEqual({
    flag: true,
    quoted: "yes",
    value: "last",
  });
  expect(parse(generateYaml(result.playbook))[0].vars).toEqual(
    result.playbook.plays[0].vars,
  );
});
it("rejects structural fields that would otherwise disappear during generation", () => {
  const p = newProject("Validation");
  p.playbooks = [parsePlaybook(fixture).playbook];
  p.playbooks[0].plays[0].roles![0].when = "something";
  expect(projectSchema.safeParse(p).success).toBe(false);
});
const documentation = {
  "acme.demo.echo": {
    doc: {
      short_description: "Echo",
      options: {
        message: { type: "str", required: true, aliases: ["msg"] },
        data: { type: "dict" },
        enabled: { type: "bool" },
      },
    },
  },
};
it("discovers modules with argument arrays, validates metadata and supports aliases", async () => {
  const calls: string[][] = [];
  const runner = {
    execute: async (_exe: string, args: string[]) => {
      calls.push(args);
      return {
        code: 0,
        stderr: "",
        stdout: JSON.stringify(
          args.includes("--list")
            ? { "acme.demo.echo": "Echo" }
            : documentation,
        ),
      };
    },
  };
  expect(await listModules(runner, "ansible-doc", "/workspace")).toEqual([
    ["acme.demo.echo", "Echo"],
  ]);
  const discovered = await loadModules(runner, "ansible-doc", "/workspace", [
    "acme.demo.echo",
  ]);
  expect(calls[1]).toEqual(["--json", "--type", "module", "acme.demo.echo"]);
  expect(
    hostMessageSchema.safeParse({ type: "modules", modules: discovered })
      .success,
  ).toBe(true);
  expect(parseAnsibleDoc(documentation)).toEqual(discovered);
  const book = parsePlaybook(
    "- hosts: all\n  tasks:\n    - acme.demo.echo: {msg: hello}\n",
  ).playbook;
  expect(validatePlaybook(book, discovered)).toEqual([]);
  await expect(
    loadModules(runner, "ansible-doc", "/workspace", ["--malicious"]),
  ).rejects.toThrow();
  expect(calls).toHaveLength(2);
});
it("maps current and legacy syntax/lint diagnostics to nested nodes", () => {
  const book = parsePlaybook(fixture).playbook;
  const node = walk(playNodes(book.plays[0])).find(
    (n) => n.name === "Nested cleanup",
  )!;
  const line = node.location!.line;
  const current = cliProblems(
    "syntax-check",
    {
      code: 4,
      stdout: "",
      stderr: `Error\nOrigin: /workspace/site.yml:${line}:9`,
    },
    "/workspace/site.yml",
    fixture,
  );
  expect(current[0]).toMatchObject({ line, column: 9, code: "ANSIBLE_SYNTAX" });
  expect(current[0].nodeId).toBeDefined();
  const lint = cliProblems(
    "ansible-lint",
    {
      code: 2,
      stderr: "",
      stdout: JSON.stringify([
        {
          check_name: "name[missing]",
          severity: "minor",
          description: "Name required",
          location: {
            path: "site.yml",
            positions: { begin: { line, column: 4 } },
          },
        },
      ]),
    },
    "/workspace/site.yml",
    fixture,
  );
  expect(lint[0]).toMatchObject({
    line,
    column: 4,
    severity: "warning",
    code: "name[missing]",
  });
  const other = cliProblems(
    "syntax-check",
    {
      code: 4,
      stdout: "",
      stderr: "Origin: /workspace/roles/demo/tasks/main.yml:7:2",
    },
    "/workspace/site.yml",
    fixture,
  );
  expect(other[0].nodeId).toBeUndefined();
  expect(other[0].message).toContain("roles/demo/tasks/main.yml");
});
