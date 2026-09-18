import { taskExtraKeys, playExtraKeys } from "@visual-ansible/air";
import { parseDocument, LineCounter, visit, isAlias } from "yaml";
import {
  newPlaybook,
  type AutomationNode,
  type Json,
  type Playbook,
  type Problem,
  type SourceLocation,
} from "@visual-ansible/air";
import { normalizeModule, modules } from "@visual-ansible/module-metadata";
export interface ParseResult {
  playbook: Playbook;
  problems: Problem[];
  editable: boolean;
}
const taskKeys = new Set([
  "name",
  "when",
  "loop",
  "register",
  "tags",
  "become",
  "ignore_errors",
  "changed_when",
  "failed_when",
  "notify",
  "delegate_to",
  "run_once",
  "environment",
  "block",
  "args",
]);
const taskExtra = new Set<string>(taskExtraKeys);
const playExtra = new Set<string>(playExtraKeys);
function object(value: unknown): value is Record<string, Json> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function parsePlaybook(
  text: string,
  name = "playbook.yml",
): ParseResult {
  const book = newPlaybook(name);
  book.plays = [];
  book.source = text;
  const problems: Problem[] = [];
  const issue = (message: string, location?: SourceLocation) =>
    problems.push({
      severity: "error",
      code: "UNSUPPORTED_YAML",
      message,
      ...(location ? { line: location.line, column: location.column } : {}),
    });
  if (text.length > 1_000_000)
    return {
      playbook: book,
      editable: false,
      problems: [{ severity: "error", message: "Playbook exceeds 1 MB." }],
    };
  try {
    const lines = new LineCounter();
    const doc = parseDocument(text, {
      lineCounter: lines,
      uniqueKeys: true,
      strict: true,
    });
    for (const error of doc.errors)
      problems.push({
        severity: "error",
        code: "YAML_SYNTAX",
        message: error.message,
        line: error.linePos?.[0].line,
        column: error.linePos?.[0].col,
      });
    if (doc.errors.length) return { playbook: book, problems, editable: false };
    visit(doc, (_key, node) => {
      if (isAlias(node))
        issue(
          "Unsupported YAML construct: aliases. Original YAML is preserved.",
        );
      if (node && typeof node === "object" && "tag" in node && node.tag)
        issue(
          "Unsupported YAML construct: explicit tags. Original YAML is preserved.",
        );
    });
    if (problems.length) return { playbook: book, problems, editable: false };
    const root: unknown = doc.toJS({ maxAliasCount: 0 });
    const locate = (path: (string | number)[]): SourceLocation => {
      const node = doc.getIn(path, true);
      const offset =
        node && typeof node === "object" && "range" in node
          ? ((node.range as number[] | undefined)?.[0] ?? 0)
          : 0;
      const point = lines.linePos(offset);
      return { line: point.line, column: point.col, path };
    };
    function safe(value: Json, depth = 0): void {
      if (depth > 30) throw new Error("Maximum YAML nesting depth is 30.");
      if (value && typeof value === "object")
        for (const [key, v] of Object.entries(value)) {
          if (["__proto__", "constructor", "prototype"].includes(key))
            throw new Error("Unsafe YAML key.");
          safe(v, depth + 1);
        }
    }
    safe(root as Json);
    if (!Array.isArray(root) || !root.length)
      throw new Error(
        "Expected a non-empty Ansible playbook (a YAML list of plays).",
      );
    function tasks(
      value: Json | undefined,
      path: (string | number)[],
      handler = false,
    ): AutomationNode[] {
      if (value === undefined || value === null) return [];
      if (!Array.isArray(value)) {
        issue("Tasks must be a YAML list.", locate(path));
        return [];
      }
      return value.flatMap((raw, i) => {
        const location = locate([...path, i]);
        if (!object(raw)) {
          issue(
            "Unsupported YAML construct: task must be a mapping.",
            location,
          );
          return [];
        }
        const node: AutomationNode = {
          id: crypto.randomUUID(),
          type: handler
            ? "HANDLER"
            : raw.block !== undefined
              ? "BLOCK"
              : "MODULE",
          name: typeof raw.name === "string" ? raw.name : "Task",
          location,
        };
        const candidates = Object.keys(raw).filter(
          (k) =>
            /^\w+\.\w+\.\w+$/.test(k) || modules.some((m) => m.label === k),
        );
        if (raw.block !== undefined) {
          if (handler)
            issue("Unsupported YAML construct: handler block.", location);
          node.children = tasks(raw.block, [...path, i, "block"]);
          if (candidates.length)
            issue("A block cannot also invoke a module.", location);
        } else if (candidates.length !== 1)
          issue(
            "Unsupported YAML construct: expected one supported module invocation.",
            location,
          );
        else {
          const key = candidates[0];
          const args = raw[key];
          if (object(args)) node.module = { fqcn: normalizeModule(key), args };
          else if (args === null)
            node.module = { fqcn: normalizeModule(key), args: {} };
          else if (
            typeof args === "string" &&
            [
              "command",
              "shell",
              "ansible.builtin.command",
              "ansible.builtin.shell",
            ].includes(key)
          )
            node.module = { fqcn: normalizeModule(key), args: { cmd: args } };
          else
            issue(
              "Unsupported YAML construct: module arguments must be a mapping.",
              location,
            );
          if (node.module && raw.args !== undefined) {
            if (object(raw.args))
              node.module.args = { ...node.module.args, ...raw.args };
            else issue("Task args must be a mapping.", location);
          }
          if (!raw.name)
            node.name = node.module?.fqcn.split(".").at(-1) ?? "Task";
        }
        const extras: Record<string, Json> = {};
        for (const [key, val] of Object.entries(raw)) {
          if (["name", "block", "args", ...candidates].includes(key)) continue;
          if (taskExtra.has(key)) {
            extras[key] = val;
            continue;
          }
          if (!taskKeys.has(key)) {
            issue(
              `Unsupported YAML construct: task keyword “${key}”. Original content is preserved.`,
              location,
            );
            continue;
          }
          if (
            key === "when" &&
            (typeof val === "string" ||
              typeof val === "boolean" ||
              (Array.isArray(val) && val.every((v) => typeof v === "string")))
          )
            node.when = val as string | string[] | boolean;
          else if (
            key === "loop" &&
            (Array.isArray(val) || typeof val === "string")
          )
            node.loop = val;
          else if (
            ["tags", "notify"].includes(key) &&
            (typeof val === "string" ||
              (Array.isArray(val) && val.every((v) => typeof v === "string")))
          )
            Object.assign(node, {
              [key]: typeof val === "string" ? [val] : val,
            });
          else if (
            ["become", "ignore_errors", "run_once"].includes(key) &&
            typeof val === "boolean"
          )
            Object.assign(node, { [key]: val });
          else if (
            ["changed_when", "failed_when"].includes(key) &&
            (typeof val === "string" || typeof val === "boolean")
          )
            Object.assign(node, { [key]: val });
          else if (
            ["register", "delegate_to"].includes(key) &&
            typeof val === "string"
          )
            Object.assign(node, { [key]: val });
          else if (key === "environment" && object(val)) node.environment = val;
          else
            issue(`Unsupported YAML construct: value for “${key}”.`, location);
        }
        if (Object.keys(extras).length) node.extra = extras;
        return [node];
      });
    }
    root.forEach((raw, index) => {
      const location = locate([index]);
      if (!object(raw) || typeof raw.hosts !== "string") {
        issue("Expected an Ansible play with a string hosts field.", location);
        return;
      }
      const extra: Record<string, Json> = {};
      for (const [key, v] of Object.entries(raw)) {
        if (
          ["name", "hosts", "become", "vars", "tasks", "handlers"].includes(key)
        )
          continue;
        if (playExtra.has(key)) extra[key] = v;
        else
          issue(
            `Unsupported YAML construct: play keyword “${key}”. Original content is preserved.`,
            location,
          );
      }
      if (raw.vars !== undefined && !object(raw.vars))
        issue("Play vars must be a mapping.", location);
      if (raw.become !== undefined && typeof raw.become !== "boolean")
        issue("Play become must be boolean.", location);
      book.plays.push({
        id: crypto.randomUUID(),
        name: typeof raw.name === "string" ? raw.name : `Play ${index + 1}`,
        hosts: raw.hosts,
        become: typeof raw.become === "boolean" ? raw.become : undefined,
        vars: object(raw.vars) ? raw.vars : {},
        tasks: tasks(raw.tasks, [index, "tasks"]),
        handlers: tasks(raw.handlers, [index, "handlers"], true),
        extra,
        location,
      });
    });
  } catch (e) {
    issue((e as Error).message);
  }
  return {
    playbook: book,
    problems,
    editable:
      !problems.some((p) => p.severity === "error") && book.plays.length > 0,
  };
}
