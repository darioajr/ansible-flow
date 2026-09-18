import * as vscode from "vscode";
import path from "node:path";
import { newPlaybook, type Problem } from "@visual-ansible/air";
import { parsePlaybook } from "@visual-ansible/parser";
import { generateYaml } from "@visual-ansible/generator";
import {
  webviewMessageSchema,
  type HostMessage,
} from "@visual-ansible/schemas";
import { documentProblems } from "./document-service";
import { ExtensionHostRunner, type AnsibleCommandRunner } from "./runner";
import { webviewHtml } from "./webview";
import { applyVisualEdit } from "./workspace-document";
const VIEW = "visualAnsible.playbook";
class PlaybookTree implements vscode.TreeDataProvider<vscode.TreeItem> {
  private changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  refresh() {
    this.changed.fire();
  }
  dispose() {
    this.changed.dispose();
  }
  getTreeItem(item: vscode.TreeItem) {
    return item;
  }
  async getChildren() {
    const files = await vscode.workspace.findFiles(
      "**/*.{yml,yaml}",
      "**/{node_modules,.git,.venv}/**",
      200,
    );
    const items: vscode.TreeItem[] = [];
    for (const uri of files) {
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.size > 1_000_000) continue;
        const text = Buffer.from(
          await vscode.workspace.fs.readFile(uri),
        ).toString("utf8");
        if (!parsePlaybook(text).playbook.plays.length) continue;
        const item = new vscode.TreeItem(vscode.workspace.asRelativePath(uri));
        item.resourceUri = uri;
        item.iconPath = new vscode.ThemeIcon("symbol-event");
        item.command = {
          command: "visualAnsible.open",
          title: "Open visually",
          arguments: [uri],
        };
        items.push(item);
      } catch {
        /* Unreadable files do not prevent discovery. */
      }
    }
    return items;
  }
}
export function activate(context: vscode.ExtensionContext) {
  const diagnostics =
    vscode.languages.createDiagnosticCollection("visual-ansible");
  const runner: AnsibleCommandRunner = new ExtensionHostRunner();
  const tree = new PlaybookTree();
  let active: vscode.TextDocument | undefined;
  const publish = (doc: vscode.TextDocument, problems: Problem[]) => {
    diagnostics.set(
      doc.uri,
      problems.map((p) => {
        const line = Math.min(
          Math.max((p.line ?? 1) - 1, 0),
          doc.lineCount - 1,
        );
        const range = doc.lineAt(line).range;
        const diagnostic = new vscode.Diagnostic(
          range,
          p.message,
          p.severity === "error"
            ? vscode.DiagnosticSeverity.Error
            : vscode.DiagnosticSeverity.Warning,
        );
        diagnostic.source = "Visual Ansible";
        diagnostic.code = p.code;
        return diagnostic;
      }),
    );
  };
  async function validate(
    doc: vscode.TextDocument,
    external = false,
  ): Promise<Problem[]> {
    const problems = documentProblems(doc.getText());
    if (external) {
      const config = vscode.workspace.getConfiguration(
        "visualAnsible",
        doc.uri,
      );
      const tool = config.get<string>("validationTool", "core");
      if (tool !== "core") {
        if (!vscode.workspace.isTrusted)
          throw new Error("Trust this workspace before running Ansible tools.");
        if (doc.uri.scheme !== "file")
          throw new Error(
            "External tools need a filesystem-backed document in the Extension Host.",
          );
        if (doc.isDirty)
          throw new Error(
            "Save the playbook before running external validation.",
          );
        const executable =
          tool === "syntax-check"
            ? config.get<string>("ansiblePath", "ansible-playbook")
            : config.get<string>("lintPath", "ansible-lint");
        const args =
          tool === "syntax-check"
            ? ["--syntax-check", doc.uri.fsPath]
            : ["--format", "json", doc.uri.fsPath];
        const result = await runner.execute(
          executable,
          args,
          path.dirname(doc.uri.fsPath),
        );
        if (result.code !== 0) {
          if (tool === "ansible-lint") {
            try {
              const entries: unknown = JSON.parse(result.stdout);
              if (!Array.isArray(entries)) throw Error();
              for (const item of entries) {
                if (!item || typeof item !== "object") continue;
                const r = item as {
                  description?: string;
                  message?: string;
                  location?: { lines?: { begin?: number } };
                };
                problems.push({
                  severity: "error",
                  message: r.description ?? r.message ?? "Ansible lint failed.",
                  line: r.location?.lines?.begin ?? 1,
                });
              }
            } catch {
              problems.push({
                severity: "error",
                message:
                  "ansible-lint failed. Review the playbook with the CLI.",
                line: 1,
              });
            }
          } else
            problems.push({
              severity: "error",
              message:
                (result.stderr || result.stdout).slice(0, 4000) ||
                "Ansible syntax check failed.",
              line: Number(
                (result.stderr || result.stdout).match(/line (\d+)/i)?.[1] ?? 1,
              ),
            });
        }
      }
    }
    publish(doc, problems);
    return problems;
  }
  const provider: vscode.CustomTextEditorProvider = {
    async resolveCustomTextEditor(document, panel) {
      active = document;
      const root = vscode.Uri.joinPath(context.extensionUri, "media");
      panel.webview.options = {
        enableScripts: true,
        localResourceRoots: [root],
      };
      panel.webview.html = webviewHtml(panel.webview, root);
      let applying: string | undefined;
      let disposed = false;
      let work = Promise.resolve();
      const send = (message: HostMessage) => {
        if (!disposed) void panel.webview.postMessage(message);
      };
      const update = (requestId?: string) => {
        if (document.getText().length > 1_000_000) {
          send({
            type: "problems",
            problems: [
              { severity: "error", message: "Document exceeds 1 MB." },
            ],
          });
          return;
        }
        send({
          type: "document",
          text: document.getText(),
          version: document.version,
          name: path.basename(document.uri.path),
          dirty: document.isDirty,
          ...(requestId ? { requestId } : {}),
        });
        publish(document, documentProblems(document.getText()));
      };
      const change = vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === document.uri.toString())
          update(applying);
      });
      const saveEvent = vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.uri.toString() === document.uri.toString()) update(applying);
      });
      const state = panel.onDidChangeViewState(() => {
        if (panel.active) active = document;
      });
      const messages = panel.webview.onDidReceiveMessage((input: unknown) => {
        const parsed = webviewMessageSchema.safeParse(input);
        if (!parsed.success) return;
        const msg = parsed.data;
        work = work.then(async () => {
          if (disposed) return;
          try {
            if (msg.type === "ready") {
              update();
              return;
            }
            if (msg.type === "edit") {
              applying = msg.requestId;
              try {
                await applyVisualEdit(document, msg.version, msg.playbook);
                send({
                  type: "result",
                  requestId: msg.requestId,
                  ok: true,
                  version: document.version,
                });
              } finally {
                applying = undefined;
              }
              return;
            }
            if (msg.type === "save") {
              applying = msg.requestId;
              try {
                if (!(await document.save()))
                  throw new Error("VS Code could not save this document.");
                send({
                  type: "result",
                  requestId: msg.requestId,
                  ok: true,
                  version: document.version,
                });
              } finally {
                applying = undefined;
              }
              return;
            }
            if (msg.type === "validate") {
              const problems = await validate(document, msg.external);
              send({ type: "problems", problems });
              send({ type: "result", requestId: msg.requestId, ok: true });
              return;
            }
            if (msg.type === "undo" || msg.type === "redo") {
              await vscode.commands.executeCommand(msg.type);
            }
          } catch (e) {
            if ("requestId" in msg)
              send({
                type: "result",
                requestId: msg.requestId,
                ok: false,
                message: (e as Error).message,
              });
            update();
          }
        });
      });
      panel.onDidDispose(() => {
        disposed = true;
        change.dispose();
        saveEvent.dispose();
        state.dispose();
        messages.dispose();
        if (active === document) active = undefined;
      });
    },
  };
  async function open(uri?: vscode.Uri) {
    if (!uri) {
      uri = vscode.window.activeTextEditor?.document.uri;
      if (!uri) {
        const choice = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { YAML: ["yml", "yaml"] },
        });
        uri = choice?.[0];
      }
    }
    if (!uri) return;
    const doc = await vscode.workspace.openTextDocument(uri);
    const parsed = parsePlaybook(doc.getText(), path.basename(uri.path));
    if (!parsed.playbook.plays.length) {
      void vscode.window.showErrorMessage(
        "This file is not a supported Ansible playbook.",
      );
      return;
    }
    await vscode.commands.executeCommand("vscode.openWith", uri, VIEW);
  }
  const wrap =
    (fn: (uri?: vscode.Uri) => Promise<unknown>) =>
    async (uri?: vscode.Uri) => {
      try {
        return await fn(uri);
      } catch (e) {
        void vscode.window.showErrorMessage((e as Error).message);
      }
    };
  context.subscriptions.push(
    diagnostics,
    tree,
    vscode.window.registerTreeDataProvider("visualAnsible.playbooks", tree),
    vscode.window.registerCustomEditorProvider(VIEW, provider, {
      supportsMultipleEditorsPerDocument: true,
    }),
    vscode.commands.registerCommand("visualAnsible.open", wrap(open)),
    vscode.commands.registerCommand("visualAnsible.refresh", () =>
      tree.refresh(),
    ),
    vscode.commands.registerCommand(
      "visualAnsible.create",
      wrap(async () => {
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.workspace.workspaceFolders?.[0]
            ? vscode.Uri.joinPath(
                vscode.workspace.workspaceFolders[0].uri,
                "playbook.yml",
              )
            : undefined,
          filters: { YAML: ["yml", "yaml"] },
        });
        if (!uri) return;
        const edit = new vscode.WorkspaceEdit();
        edit.createFile(uri, { overwrite: false });
        edit.insert(
          uri,
          new vscode.Position(0, 0),
          generateYaml(newPlaybook(path.basename(uri.path))),
        );
        if (!(await vscode.workspace.applyEdit(edit)))
          throw new Error("Could not create playbook.");
        const doc = await vscode.workspace.openTextDocument(uri);
        await doc.save();
        tree.refresh();
        await open(uri);
      }),
    ),
    vscode.commands.registerCommand(
      "visualAnsible.validate",
      wrap(async (uri) => {
        const doc = uri
          ? await vscode.workspace.openTextDocument(uri)
          : (active ?? vscode.window.activeTextEditor?.document);
        if (!doc) throw new Error("Open a playbook first.");
        const problems = await validate(doc, true);
        void vscode.window.showInformationMessage(
          `Visual Ansible: ${problems.length} validation problem(s).`,
        );
      }),
    ),
    vscode.commands.registerCommand(
      "visualAnsible.showYaml",
      wrap(async () => {
        const doc = active ?? vscode.window.activeTextEditor?.document;
        if (!doc) throw new Error("Open a playbook first.");
        await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.Beside,
        });
      }),
    ),
    vscode.workspace.onDidSaveTextDocument(() => tree.refresh()),
  );
  // Read-only access useful for automated Extension Host verification.
  return { viewType: VIEW, diagnostics, open, validate };
}
