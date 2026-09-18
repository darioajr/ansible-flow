import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
export function webviewHtml(webview: vscode.Webview, root: vscode.Uri): string {
  const nonce = randomBytes(24).toString("base64");
  const script = webview.asWebviewUri(
    vscode.Uri.joinPath(root, "assets", "webview.js"),
  );
  const css = webview.asWebviewUri(
    vscode.Uri.joinPath(root, "assets", "webview.css"),
  );
  const monaco = webview
    .asWebviewUri(vscode.Uri.joinPath(root, "monaco"))
    .toString();
  const escape = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} data:; img-src ${webview.cspSource} data:; connect-src ${webview.cspSource}; worker-src ${webview.cspSource} blob:;"><link href="${css}" rel="stylesheet"></head><body data-monaco="${escape(monaco)}"><div id="root"></div><script nonce="${nonce}" type="module" src="${script}"></script></body></html>`;
}
