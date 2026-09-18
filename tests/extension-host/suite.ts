import * as vscode from "vscode";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parsePlaybook } from "@visual-ansible/parser";
import { applyVisualEdit } from "../../apps/vscode/extension/src/workspace-document";
export async function run() {
  const extension = vscode.extensions.getExtension(
    "darioajr.visual-ansible-extension",
  );
  assert.ok(extension, "Development extension is installed");
  const api = (await extension.activate()) as {
    open: (uri: vscode.Uri) => Promise<void>;
    validate: (doc: vscode.TextDocument) => Promise<unknown[]>;
    diagnostics: vscode.DiagnosticCollection;
  };
  const folder = vscode.workspace.workspaceFolders![0].uri;
  const uri = vscode.Uri.joinPath(folder, "site.yml");
  await vscode.workspace.fs.writeFile(
    uri,
    Buffer.from(
      "# Preserve me\n- hosts: all\n  tasks:\n    - name: Print\n      ansible.builtin.debug:\n        msg: before\n",
    ),
  );
  const document = await vscode.workspace.openTextDocument(uri);
  await api.open(uri);
  assert.ok(
    vscode.window.tabGroups.all
      .flatMap((g) => g.tabs)
      .some((t) => t.input instanceof vscode.TabInputCustom),
    "Visual custom editor tab opened",
  );
  const parsed = parsePlaybook(document.getText());
  assert.ok(parsed.editable);
  parsed.playbook.plays[0].tasks[0].module!.args.msg = "after";
  await applyVisualEdit(document, document.version, parsed.playbook);
  assert.equal(
    document.isDirty,
    true,
    "WorkspaceEdit marks the native document dirty",
  );
  assert.ok(document.getText().includes("msg: after"));
  assert.equal(await document.save(), true);
  assert.ok((await readFile(uri.fsPath, "utf8")).includes("msg: after"));
  assert.ok(document.getText().includes("# Preserve me"));
  await vscode.window.showTextDocument(document);
  await vscode.commands.executeCommand("undo");
  assert.ok(
    document.getText().includes("msg: before"),
    "Native VS Code undo restores the previous YAML",
  );
  await vscode.commands.executeCommand("redo");
  assert.ok(
    document.getText().includes("msg: after"),
    "Native redo restores the visual change",
  );
  const latest = parsePlaybook(document.getText());
  latest.playbook.plays[0].tasks[0].module = {
    fqcn: "ansible.builtin.dnf",
    args: {},
  };
  await applyVisualEdit(document, document.version, latest.playbook);
  const problems = await api.validate(document);
  assert.ok(problems.length);
  assert.ok(
    api.diagnostics.get(uri)?.some((d) => d.message.includes("required")),
    "VS Code Problems receives diagnostics",
  );
  await document.save();
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await api.open(uri);
  const reopened = await vscode.workspace.openTextDocument(uri);
  assert.equal(
    parsePlaybook(reopened.getText()).playbook.plays[0].tasks[0].module!.fqcn,
    "ansible.builtin.dnf",
  );
  const recoveryUri = vscode.Uri.joinPath(folder, "recovery.yml");
  await vscode.workspace.fs.writeFile(
    recoveryUri,
    Buffer.from(
      "- hosts: all\n  vars:\n    - flag: yes\n  roles: [demo]\n  tasks:\n    - name: Recoverable\n      block:\n        - debug: {msg: work}\n      rescue:\n        - debug: {msg: before}\n      always:\n        - debug: {msg: cleanup}\n",
    ),
  );
  const recovery = await vscode.workspace.openTextDocument(recoveryUri);
  await api.open(recoveryUri);
  const model = parsePlaybook(recovery.getText()).playbook;
  model.plays[0].roles![0].role!.name = "updated_role";
  model.plays[0].tasks[0].rescue![0].module!.args.msg = "recovered";
  await applyVisualEdit(recovery, recovery.version, model);
  await recovery.save();
  const reparsed = parsePlaybook(await readFile(recoveryUri.fsPath, "utf8"));
  assert.equal(reparsed.editable, true);
  assert.equal(reparsed.playbook.plays[0].roles![0].role!.name, "updated_role");
  assert.equal(
    reparsed.playbook.plays[0].tasks[0].rescue![0].module!.args.msg,
    "recovered",
  );
  assert.equal((await api.validate(recovery)).length, 0);
  assert.ok(
    (await vscode.commands.getCommands()).includes(
      "visualAnsible.discoverModules",
    ),
  );
  console.log(
    "Extension Host: open, WorkspaceEdit, native save/undo/redo, diagnostics and reopen passed.",
  );
}
