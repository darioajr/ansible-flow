import * as vscode from "vscode";
import { editedDocument } from "./document-service";
export async function applyVisualEdit(
  document: vscode.TextDocument,
  version: number,
  input: unknown,
): Promise<void> {
  const text = editedDocument(
    document.getText(),
    document.version,
    version,
    input,
  );
  if (text === document.getText()) return;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length),
    ),
    text,
  );
  if (!(await vscode.workspace.applyEdit(edit)))
    throw new Error("VS Code could not apply the document edit.");
}
