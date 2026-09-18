import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { useStore } from "zustand";
import {
  Button,
  Label,
  Alert,
  Title,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalVariant,
  Form,
  FormGroup,
  TextInput,
  Spinner,
} from "@patternfly/react-core";
import {
  CheckCircleIcon,
  CodeIcon,
  DownloadIcon,
  SaveIcon,
  UndoIcon,
  RedoIcon,
  PlusIcon,
  TimesIcon,
} from "@patternfly/react-icons";
import {
  newPlay,
  walk,
  type Project,
  type Playbook,
  type Problem,
} from "@visual-ansible/air";
import { generateYaml } from "@visual-ansible/generator";
import { validatePlaybook } from "@visual-ansible/validator";
import { createEditorStore, currentPlay } from "./store";
import { EditorContext } from "./context";
import { Canvas } from "./canvas";
import { Catalog } from "./catalog";
import { Properties } from "./properties";
const Yaml = lazy(() => import("./yaml"));
export interface EditorHost {
  kind: "web" | "vscode";
  assetBase: string;
  autosave: boolean;
  save: (project: Project) => Promise<void>;
  changed?: (project: Project) => void;
  bindNavigation?: (
    save: () => Promise<void>,
    isDirty: () => boolean,
  ) => () => void;
  validate?: (book: Playbook) => Promise<Problem[]>;
  undo?: () => void;
  redo?: () => void;
  export?: (yaml: string, name: string) => Promise<void> | void;
}
export interface VisualEditorProps {
  initial: Project;
  host: EditorHost;
  externalProblems?: Problem[];
}
export function VisualEditor({
  initial,
  host,
  externalProblems = [],
}: VisualEditorProps) {
  const [store] = useState(() => createEditorStore(initial));
  const s = useStore(store);
  const [status, setStatus] = useState("Saved");
  const [error, setError] = useState("");
  const [yamlOpen, setYamlOpen] = useState(false);
  const [yamlDraft, setYamlDraft] = useState<string | null>(null);
  const [yamlError, setYamlError] = useState("");
  const yamlPending = useRef(false);
  const hasYamlDraft = yamlDraft !== null;
  const changeYaml = (text: string | null) => {
    yamlPending.current = text !== null;
    setYamlDraft(text);
    setYamlError("");
    if (text === null)
      setError((message) =>
        message.startsWith("Apply YAML to the diagram") ? "" : message,
      );
  };
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [runtimeProblems, setRuntimeProblems] = useState<Problem[]>([]);
  const [modal, setModal] = useState<"book" | "play" | null>(null);
  const [name, setName] = useState("");
  const saved = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const blocked = useRef(false);
  useEffect(() => {
    store.getState().replace(initial);
    saved.current = 0;
    blocked.current = false;
    setStatus("Saved");
  }, [initial, store]);
  const save = useCallback(() => {
    const action = async () => {
      if (yamlPending.current) {
        const message =
          "Apply YAML to the diagram or discard the draft before saving or leaving.";
        setError(message);
        throw new Error(message);
      }
      const current = store.getState();
      const revision = current.change;
      setStatus("Saving…");
      try {
        await host.save(current.project);
        saved.current = revision;
        blocked.current = false;
        setStatus(store.getState().change === revision ? "Saved" : "Modified");
        setError("");
      } catch (e) {
        blocked.current = true;
        setStatus("Save failed");
        setError((e as Error).message);
        throw e;
      }
    };
    const next = queue.current.catch(() => {}).then(action);
    queue.current = next;
    return next;
  }, [host, store]);
  useEffect(() => {
    if (!s.change) return;
    host.changed?.(s.project);
    setStatus("Modified");
    if (!host.autosave || blocked.current || hasYamlDraft) return;
    const timer = setTimeout(() => {
      void save().catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [s.change, s.project, host, save, hasYamlDraft]);
  useEffect(
    () =>
      host.bindNavigation?.(
        save,
        () => yamlPending.current || store.getState().change !== saved.current,
      ),
    [host, save, store],
  );
  const undo = useCallback(() => {
    if (!yamlPending.current)
      return host.undo ? host.undo() : store.getState().undo();
  }, [host, store]);
  const redo = useCallback(() => {
    if (!yamlPending.current)
      return host.redo ? host.redo() : store.getState().redo();
  }, [host, store]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "s") {
        e.preventDefault();
        void save().catch(() => {});
        return;
      }
      const target = e.target as HTMLElement;
      const input =
        target.matches?.("input,textarea,select") ||
        target.isContentEditable ||
        target.closest?.(".monaco-editor");
      if (input || yamlPending.current) return;
      const state = store.getState();
      if (mod) {
        if (["z", "c", "v", "d", "f"].includes(key)) e.preventDefault();
        if (key === "z") {
          if (e.shiftKey) redo();
          else undo();
        }
        if (key === "c") state.copy();
        if (key === "v") state.paste();
        if (key === "d") state.duplicate();
        if (key === "f") document.getElementById("module-search")?.focus();
      } else if (
        ["Delete", "Backspace"].includes(e.key) &&
        state.selection.length
      ) {
        e.preventDefault();
        state.remove();
      }
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (
        host.kind === "web" &&
        (yamlPending.current || store.getState().change !== saved.current)
      )
        e.preventDefault();
    };
    window.addEventListener("keydown", listener);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("keydown", listener);
      window.removeEventListener("beforeunload", unload);
    };
  }, [save, store, undo, redo, host.kind]);
  const book = s.project.playbooks.find((b) => b.id === s.bookId)!;
  const play = currentPlay(s)!;
  const problems = useMemo(
    () => [...validatePlaybook(book), ...externalProblems, ...runtimeProblems],
    [book, externalProblems, runtimeProblems],
  );
  const errors = problems.filter((p) => p.severity === "error");
  const yaml = useMemo(() => generateYaml(book), [book]);
  const block = walk([...play.tasks, ...play.handlers]).find(
    (n) => n.id === s.scope,
  );
  async function exporting() {
    setProblemsOpen(true);
    if (errors.length) {
      setError("Resolve validation errors before exporting.");
      return;
    }
    try {
      await save();
      await host.export?.(yaml, book.name);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function validate() {
    setProblemsOpen(true);
    if (host.validate)
      try {
        setRuntimeProblems(await host.validate(book));
      } catch (e) {
        setError((e as Error).message);
      }
  }
  function create() {
    if (!name.trim()) return;
    if (modal === "book") s.addBook(name.trim());
    else {
      const p = newPlay(name.trim());
      s.edit((project) =>
        project.playbooks.find((b) => b.id === s.bookId)!.plays.push(p),
      );
      s.navigate(s.bookId, p.id);
    }
    setModal(null);
    setName("");
  }
  return (
    <EditorContext.Provider value={store}>
      <div
        className={`visual-editor ${host.kind === "vscode" ? "vscode-editor" : ""}`}
      >
        <div className="editor-toolbar">
          <div>
            <div className="editor-eyebrow">
              {host.kind === "vscode"
                ? "WORKSPACE PLAYBOOK"
                : "AUTOMATION PROJECT"}
            </div>
            <Title headingLevel="h1" size="xl">
              {s.project.name}
            </Title>
          </div>
          <div className="toolbar-actions">
            <span className="save-status" aria-live="polite">
              {status === "Saved" && <CheckCircleIcon />} {status}
            </span>
            <Button
              variant="plain"
              aria-label="Undo"
              isDisabled={yamlDraft !== null || (!host.undo && !s.past.length)}
              onClick={undo}
            >
              <UndoIcon />
            </Button>
            <Button
              variant="plain"
              aria-label="Redo"
              isDisabled={
                yamlDraft !== null || (!host.redo && !s.future.length)
              }
              onClick={redo}
            >
              <RedoIcon />
            </Button>
            <Button
              variant="secondary"
              icon={<SaveIcon />}
              onClick={() => void save().catch(() => {})}
            >
              Save
            </Button>
            <Button
              variant="secondary"
              icon={<CheckCircleIcon />}
              isDisabled={yamlDraft !== null}
              onClick={() => void validate()}
            >
              Validate
            </Button>
            {host.export && (
              <Button icon={<DownloadIcon />} onClick={() => void exporting()}>
                Export YAML
              </Button>
            )}
          </div>
        </div>
        {error && (
          <Alert
            isInline
            variant="danger"
            title={error}
            actionClose={
              <Button
                aria-label="Dismiss error"
                variant="plain"
                onClick={() => setError("")}
              >
                <TimesIcon />
              </Button>
            }
          />
        )}
        <div className="editor-subbar">
          <div className="play-pickers">
            <FormSelect
              aria-label="Active playbook"
              isDisabled={yamlDraft !== null}
              value={book.id}
              onChange={(_, id) => {
                const b = s.project.playbooks.find((b) => b.id === id)!;
                s.navigate(id, b.plays[0].id);
              }}
            >
              {s.project.playbooks.map((b) => (
                <FormSelectOption key={b.id} value={b.id} label={b.name} />
              ))}
            </FormSelect>
            {host.kind === "web" && (
              <Button
                variant="plain"
                isDisabled={yamlDraft !== null}
                aria-label="New playbook"
                onClick={() => {
                  setName("");
                  setModal("book");
                }}
              >
                <PlusIcon />
              </Button>
            )}
            <FormSelect
              aria-label="Active play"
              value={play.id}
              onChange={(_, id) => s.navigate(book.id, id)}
            >
              {book.plays.map((p) => (
                <FormSelectOption key={p.id} value={p.id} label={p.name} />
              ))}
            </FormSelect>
            <Button
              variant="plain"
              isDisabled={yamlDraft !== null}
              aria-label="New play"
              onClick={() => {
                setName("");
                setModal("play");
              }}
            >
              <PlusIcon />
            </Button>
          </div>
          <Button
            variant={s.scope === "tasks" ? "secondary" : "plain"}
            onClick={() => s.navigate(book.id, play.id, "tasks")}
          >
            Tasks <Label isCompact>{play.tasks.length}</Label>
          </Button>
          <Button
            variant={s.scope === "handlers" ? "secondary" : "plain"}
            onClick={() => s.navigate(book.id, play.id, "handlers")}
          >
            Handlers <Label isCompact>{play.handlers.length}</Label>
          </Button>
          {block && <Label color="purple">{block.name}</Label>}
          <Button
            className="yaml-toggle"
            variant={yamlOpen ? "secondary" : "plain"}
            icon={<CodeIcon />}
            isDisabled={yamlDraft !== null}
            onClick={() => setYamlOpen((v) => !v)}
          >
            {host.kind === "web" ? "YAML editor" : "YAML preview"}
          </Button>
        </div>
        <div className="editor-panels">
          <div style={{ display: "contents" }} inert={yamlDraft !== null}>
            <Catalog />
          </div>
          <div className="canvas-column" inert={yamlDraft !== null}>
            <div className="canvas-topline">
              <span>
                <i className="status-dot" />{" "}
                {block?.name ??
                  (s.scope === "handlers" ? "Event handlers" : play.name)}
              </span>
              <Button variant="link" size="sm" onClick={() => s.select([])}>
                hosts: {play.hosts || "not set"}
              </Button>
            </div>
            <Canvas key={`${s.bookId}-${s.playId}-${s.scope}`} />
          </div>
          {yamlOpen ? (
            <aside className="yaml-panel">
              <div className="panel-title">
                {host.kind === "web" ? "Edit YAML" : "Generated YAML"}{" "}
                <Button
                  variant="plain"
                  isDisabled={yamlDraft !== null}
                  aria-label="Close YAML preview"
                  onClick={() => setYamlOpen(false)}
                >
                  <TimesIcon />
                </Button>
              </div>
              <div className="yaml-content">
                <Suspense fallback={<Spinner />}>
                  <Yaml
                    code={yamlDraft ?? yaml}
                    assetBase={host.assetBase}
                    onChange={
                      host.kind === "web"
                        ? (text) => changeYaml(text === yaml ? null : text)
                        : undefined
                    }
                  />
                </Suspense>
              </div>
              {host.kind === "web" && (
                <div className="yaml-actions">
                  <p>
                    {yamlDraft !== null
                      ? "Unapplied draft · diagram paused"
                      : "Edit YAML, then apply to update the diagram."}
                  </p>
                  {yamlError && (
                    <Alert
                      isInline
                      variant="danger"
                      title="YAML could not be applied"
                    >
                      <pre>{yamlError}</pre>
                    </Alert>
                  )}
                  <Button
                    size="sm"
                    isDisabled={yamlDraft === null}
                    onClick={() => {
                      try {
                        s.applyYaml(yamlDraft!);
                        changeYaml(null);
                        setError("");
                        setRuntimeProblems([]);
                      } catch (e) {
                        setYamlError((e as Error).message);
                      }
                    }}
                  >
                    Apply to diagram
                  </Button>{" "}
                  <Button
                    size="sm"
                    variant="link"
                    isDisabled={yamlDraft === null}
                    onClick={() => changeYaml(null)}
                  >
                    Discard draft
                  </Button>
                </div>
              )}
              <div className="yaml-footer">
                Standard Ansible ·{" "}
                {errors.length ? `${errors.length} errors` : "ready to export"}
              </div>
            </aside>
          ) : (
            <Properties
              key={`${s.playId}-${s.selection[0] ?? "play"}-${s.future.length}`}
            />
          )}
        </div>
        <div className="problems-panel">
          <div className="problems-toolbar">
            <Button variant="plain" onClick={() => setProblemsOpen((v) => !v)}>
              Problems{" "}
              <Label isCompact color={errors.length ? "red" : "green"}>
                {problems.length}
              </Label>{" "}
              {problemsOpen ? "⌄" : "⌃"}
            </Button>
            <span className="muted small">
              {host.kind === "web"
                ? "AIR checks · external Ansible checks unavailable"
                : "AIR checks · validate from command palette for CLI checks"}
            </span>
            <span className="shortcut-hint">Ctrl / ⌘ + S to save</span>
          </div>
          {problemsOpen && (
            <div className="problem-list">
              {!problems.length ? (
                <p className="validation-success">
                  <CheckCircleIcon /> No AIR validation problems.
                </p>
              ) : (
                problems.map((p, i) => (
                  <button
                    disabled={yamlDraft !== null}
                    className="problem-row"
                    key={i}
                    onClick={() => {
                      for (const candidate of book.plays) {
                        for (const scope of [
                          "tasks",
                          "handlers",
                          ...walk([...candidate.tasks, ...candidate.handlers])
                            .filter((n) => n.type === "BLOCK")
                            .map((n) => n.id),
                        ]) {
                          const nodes =
                            scope === "tasks"
                              ? candidate.tasks
                              : scope === "handlers"
                                ? candidate.handlers
                                : (walk([
                                    ...candidate.tasks,
                                    ...candidate.handlers,
                                  ]).find((n) => n.id === scope)?.children ??
                                  []);
                          const n = nodes.find(
                            (n) =>
                              n.id === p.nodeId ||
                              (p.line && n.location?.line === p.line),
                          );
                          if (n) {
                            s.navigate(book.id, candidate.id, scope);
                            s.select([n.id]);
                            setYamlOpen(false);
                            return;
                          }
                        }
                      }
                    }}
                  >
                    <Label
                      isCompact
                      color={p.severity === "error" ? "red" : "orange"}
                    >
                      {p.severity}
                    </Label>
                    <span>{p.message}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <Modal
          variant={ModalVariant.small}
          isOpen={!!modal}
          onClose={() => setModal(null)}
          aria-labelledby="new-title"
        >
          <ModalHeader
            title={modal === "book" ? "New playbook" : "New play"}
            labelId="new-title"
          />
          <ModalBody>
            <Form
              id="new-entry"
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
            >
              <FormGroup label="Name" isRequired>
                <TextInput
                  aria-label="Name"
                  value={name}
                  maxLength={200}
                  onChange={(_, v) => setName(v)}
                />
              </FormGroup>
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button type="submit" form="new-entry" isDisabled={!name.trim()}>
              Create
            </Button>
            <Button variant="link" onClick={() => setModal(null)}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </EditorContext.Provider>
  );
}
