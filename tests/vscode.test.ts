import { it, expect } from "vitest";
import { parse } from "yaml";
import { parsePlaybook } from "@visual-ansible/parser";
import {
  editedDocument,
  documentProblems,
} from "../apps/vscode/extension/src/document-service";
import { DocumentBridge } from "../apps/vscode/webview/src/bridge";
import type { WebviewMessage } from "@visual-ansible/schemas";
const text =
  "- hosts: all\n  tasks:\n    - name: Print\n      ansible.builtin.debug:\n        msg: before\n";
it("shares parser and generator between Webview and Extension Host", () => {
  const { playbook } = parsePlaybook(text);
  playbook.plays[0].tasks[0].module!.args.msg = "after";
  const result = editedDocument(text, 3, 3, playbook);
  expect(parse(result)[0].tasks[0]["ansible.builtin.debug"].msg).toBe("after");
  expect(parsePlaybook(result).editable).toBe(true);
  expect(documentProblems(result)).toEqual([]);
});
it("rejects stale updates and preserves unsupported original files", () => {
  const { playbook } = parsePlaybook(text);
  expect(() => editedDocument(text, 2, 1, playbook)).toThrow("changed");
  expect(() =>
    editedDocument("- hosts: all\n  roles: [web]\n", 1, 1, playbook),
  ).toThrow("Unsupported");
});
it("serializes bridge edits against actual document revisions", async () => {
  let current = text;
  let version = 1;
  const sent: WebviewMessage[] = [];
  const bridge = new DocumentBridge(
    (message) => {
      sent.push(message);
      if (message.type === "edit") {
        current = editedDocument(
          current,
          version,
          message.version,
          message.playbook,
        );
        version++;
        queueMicrotask(() =>
          bridge.receive({
            type: "result",
            requestId: message.requestId,
            ok: true,
            version,
          }),
        );
      } else if (message.type === "save")
        queueMicrotask(() =>
          bridge.receive({
            type: "result",
            requestId: message.requestId,
            ok: true,
            version,
          }),
        );
    },
    () => {},
    () => {},
  );
  const first = parsePlaybook(text).playbook;
  const second = structuredClone(first);
  first.plays[0].tasks[0].module!.args.msg = "one";
  second.plays[0].tasks[0].module!.args.msg = "two";
  await Promise.all([bridge.edit(first), bridge.save(second)]);
  expect(parse(current)[0].tasks[0]["ansible.builtin.debug"].msg).toBe("two");
  expect(sent.filter((m) => m.type === "edit").map((m) => m.version)).toEqual([
    1, 2,
  ]);
  bridge.dispose();
});
it("maps core problems to source locations", () => {
  const problems = documentProblems(
    "- hosts: all\n  tasks:\n    - name: Install\n      ansible.builtin.dnf: {}\n",
  );
  expect(problems[0]).toMatchObject({ severity: "error", line: 3 });
});
