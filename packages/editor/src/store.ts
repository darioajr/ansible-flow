import { createStore } from "zustand/vanilla";
import { parsePlaybook } from "@visual-ansible/parser";
import { assertProject, validatePlaybook } from "@visual-ansible/validator";
import {
  newPlaybook,
  walk,
  updateNode,
  removeNodes,
  duplicateNodes,
  connectSequential,
  type Project,
  type Play,
  type AutomationNode,
  type NodeType,
} from "@visual-ansible/air";
export interface State {
  project: Project;
  bookId: string;
  playId: string;
  scope: string;
  selection: string[];
  past: Project[];
  future: Project[];
  clipboard: AutomationNode[];
  change: number;
  edit: (fn: (p: Project) => void) => void;
  replace: (p: Project) => void;
  navigate: (book: string, play: string, scope?: string) => void;
  select: (ids: string[]) => void;
  patch: (id: string, patch: Partial<AutomationNode>) => void;
  add: (
    module: string,
    type?: NodeType,
    position?: { x: number; y: number },
  ) => void;
  remove: () => void;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  connect: (source: string, target: string) => void;
  undo: () => void;
  redo: () => void;
  addBook: (name: string) => void;
  applyYaml: (text: string) => void;
}
export const currentPlay = (s: Pick<State, "project" | "bookId" | "playId">) =>
  s.project.playbooks
    .find((b) => b.id === s.bookId)
    ?.plays.find((p) => p.id === s.playId);
export function nodesIn(
  play: Play | undefined,
  scope: string,
): AutomationNode[] {
  if (!play) return [];
  return scope === "tasks"
    ? play.tasks
    : scope === "handlers"
      ? play.handlers
      : (walk([...play.tasks, ...play.handlers]).find((n) => n.id === scope)
          ?.children ?? []);
}
function navigation(project: Project, s?: State) {
  const b =
    project.playbooks.find((b) => b.id === s?.bookId) ?? project.playbooks[0];
  const p = b.plays.find((p) => p.id === s?.playId) ?? b.plays[0];
  return {
    bookId: b.id,
    playId: p.id,
    scope:
      s &&
      (["tasks", "handlers"].includes(s.scope) ||
        walk([...p.tasks, ...p.handlers]).some((n) => n.id === s.scope))
        ? s.scope
        : "tasks",
  };
}
export function createEditorStore(project: Project) {
  return createStore<State>((set, get) => ({
    project,
    ...navigation(project),
    selection: [],
    past: [],
    future: [],
    clipboard: [],
    change: 0,
    applyYaml: (text) => {
      const s = get();
      const old = s.project.playbooks.find((b) => b.id === s.bookId)!;
      const result = parsePlaybook(text, old.name);
      const errors = [
        ...result.problems,
        ...validatePlaybook(result.playbook),
      ].filter((p) => p.severity === "error");
      if (!result.editable || errors.length)
        throw new Error(
          errors
            .map((p) => `${p.line ? `Line ${p.line}: ` : ""}${p.message}`)
            .join("\n") || "Unsupported YAML.",
        );
      const book = { ...result.playbook, id: old.id };
      const project = structuredClone(s.project);
      project.playbooks = project.playbooks.map((b) =>
        b.id === old.id ? book : b,
      );
      for (const play of old.plays)
        for (const node of walk([...play.tasks, ...play.handlers]))
          delete project.layout[node.id];
      assertProject(project);
      set({
        project,
        ...navigation(project, s),
        selection: [],
        past: [...s.past, s.project].slice(-100),
        future: [],
        change: s.change + 1,
      });
    },
    edit: (fn) => {
      const s = get();
      const p = structuredClone(s.project);
      fn(p);
      set({
        project: p,
        past: [...s.past, s.project].slice(-100),
        future: [],
        change: s.change + 1,
      });
    },
    replace: (project) =>
      set({
        ...navigation(project, get()),
        project,
        selection: [],
        past: [],
        future: [],
        change: 0,
      }),
    navigate: (bookId, playId, scope = "tasks") =>
      set({ bookId, playId, scope, selection: [] }),
    select: (selection) => set({ selection }),
    patch: (id, patch) =>
      get().edit((p) => {
        const play = currentPlay({ ...get(), project: p })!;
        play.tasks = updateNode(play.tasks, id, patch);
        play.handlers = updateNode(play.handlers, id, patch);
      }),
    add: (fqcn, type = "MODULE", position) => {
      const s = get();
      const id = crypto.randomUUID();
      s.edit((p) => {
        const play = currentPlay({ ...s, project: p })!;
        nodesIn(play, s.scope).push({
          id,
          type: s.scope === "handlers" ? "HANDLER" : type,
          name:
            type === "BLOCK"
              ? "New block"
              : `Configure ${fqcn.split(".").at(-1)}`,
          module: type === "BLOCK" ? undefined : { fqcn, args: {} },
          ...(type === "BLOCK" ? { children: [] } : {}),
          ...(type === "CONDITION"
            ? { when: 'ansible_facts.os_family == "RedHat"' }
            : {}),
          ...(type === "LOOP" ? { loop: ["one", "two"] } : {}),
        });
        if (position) p.layout[id] = position;
      });
      set({ selection: [id] });
    },
    remove: () => {
      const s = get();
      s.edit((p) => {
        const play = currentPlay({ ...s, project: p })!;
        play.tasks = removeNodes(play.tasks, s.selection);
        play.handlers = removeNodes(play.handlers, s.selection);
        s.selection.forEach((id) => delete p.layout[id]);
      });
      set({ selection: [] });
    },
    copy: () => {
      const s = get();
      set({
        clipboard: structuredClone(
          nodesIn(currentPlay(s), s.scope).filter((n) =>
            s.selection.includes(n.id),
          ),
        ),
      });
    },
    paste: () => {
      const s = get();
      if (!s.clipboard.length) return;
      const copies = duplicateNodes(s.clipboard);
      s.edit((p) =>
        nodesIn(currentPlay({ ...s, project: p }), s.scope).push(...copies),
      );
      set({ selection: copies.map((n) => n.id) });
    },
    duplicate: () => {
      get().copy();
      get().paste();
    },
    connect: (source, target) => {
      const s = get();
      s.edit((p) => {
        const play = currentPlay({ ...s, project: p })!;
        const ordered = connectSequential(
          nodesIn(play, s.scope),
          source,
          target,
        );
        if (s.scope === "tasks") play.tasks = ordered;
        else if (s.scope === "handlers") play.handlers = ordered;
        else {
          play.tasks = updateNode(play.tasks, s.scope, { children: ordered });
          play.handlers = updateNode(play.handlers, s.scope, {
            children: ordered,
          });
        }
      });
    },
    undo: () => {
      const s = get();
      const p = s.past.at(-1);
      if (p)
        set({
          ...navigation(p, s),
          project: { ...p, revision: s.project.revision },
          past: s.past.slice(0, -1),
          future: [s.project, ...s.future],
          selection: [],
          change: s.change + 1,
        });
    },
    redo: () => {
      const s = get();
      const p = s.future[0];
      if (p)
        set({
          ...navigation(p, s),
          project: { ...p, revision: s.project.revision },
          past: [...s.past, s.project],
          future: s.future.slice(1),
          selection: [],
          change: s.change + 1,
        });
    },
    addBook: (name) => {
      const b = newPlaybook(name);
      get().edit((p) => p.playbooks.push(b));
      get().navigate(b.id, b.plays[0].id);
    },
  }));
}
export type EditorStore = ReturnType<typeof createEditorStore>;
