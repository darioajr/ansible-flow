import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Alert, Spinner } from "@patternfly/react-core";
import { newProject, type Project, type Problem } from "@visual-ansible/air";
import { parsePlaybook } from "@visual-ansible/parser";
import { VisualEditor, type EditorHost } from "@visual-ansible/editor";
import type { WebviewMessage } from "@visual-ansible/schemas";
import { DocumentBridge } from "./bridge";
import "@patternfly/react-core/dist/styles/base.css";
import "@xyflow/react/dist/style.css";
import "@visual-ansible/editor/style.css";
import "./style.css";
declare function acquireVsCodeApi(): {
  postMessage: (message: WebviewMessage) => void;
};
const vscode = acquireVsCodeApi();
function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [error, setError] = useState("");
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const bridge = useMemo(
    () =>
      new DocumentBridge(
        (message) => vscode.postMessage(message),
        (message) => {
          const parsed = parsePlaybook(message.text, message.name);
          setProblems(parsed.problems);
          if (!parsed.editable) {
            setUnsupported(message.text);
            return;
          }
          setUnsupported(null);
          const p = newProject(message.name);
          p.playbooks = [parsed.playbook];
          setProject(p);
        },
        (message) => {
          if (message.type === "problems") setProblems(message.problems);
        },
      ),
    [],
  );
  useEffect(() => {
    const listener = (e: MessageEvent) => bridge.receive(e.data);
    window.addEventListener("message", listener);
    bridge.ready();
    return () => {
      window.removeEventListener("message", listener);
      bridge.dispose();
    };
  }, [bridge]);
  const host = useMemo<EditorHost>(
    () => ({
      kind: "vscode",
      assetBase: document.body.dataset.monaco ?? "/monaco",
      autosave: false,
      changed: (p) => {
        void bridge.edit(p.playbooks[0]).catch((e) => setError(e.message));
      },
      save: async (p) => {
        await bridge.save(p.playbooks[0]);
        setError("");
      },
      undo: () => void bridge.history("undo").catch((e) => setError(e.message)),
      redo: () => void bridge.history("redo").catch((e) => setError(e.message)),
      validate: async () => {
        await bridge.validate();
        return [];
      },
    }),
    [bridge],
  );
  if (unsupported !== null)
    return (
      <div className="unsupported">
        <Alert
          isInline
          variant="warning"
          title="Unsupported YAML construct — original file preserved"
        >
          Use VS Code’s text editor to adjust the unsupported content. Visual
          writes are disabled.
        </Alert>
        {problems.map((p, i) => (
          <p key={i}>
            {p.line ? `Line ${p.line}: ` : ""}
            {p.message}
          </p>
        ))}
        <pre>{unsupported}</pre>
      </div>
    );
  if (!project)
    return (
      <div className="loading">
        <Spinner /> Opening playbook…
      </div>
    );
  return (
    <>
      {error && <Alert isInline variant="danger" title={error} />}
      <VisualEditor initial={project} host={host} externalProblems={problems} />
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
