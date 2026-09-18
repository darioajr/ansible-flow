import { taskExtraKeys, playExtraKeys } from "@visual-ansible/air";
import { parseDocument, LineCounter, visit, isAlias, isNode } from "yaml";
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
  "rescue",
  "always",
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
      line: location?.line ?? 1,
      column: location?.column ?? 1,
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
      customTags: [
        {
          tag: "tag:yaml.org,2002:bool",
          default: true,
          test: /^(?:yes|no|on|off)$/i,
          resolve: (value: string) => /^(?:yes|on)$/i.test(value),
        },
      ],
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
          "YAML aliases are not supported yet. Expand the referenced value before visual editing.",
          {
            ...lines.linePos(node.range?.[0] ?? 0),
            column: lines.linePos(node.range?.[0] ?? 0).col,
            path: [],
          },
        );
      if (isNode(node) && node.tag)
        issue(
          "Explicit YAML tags are not supported yet. Use plain values or edit this file as text.",
          {
            ...lines.linePos(node.range?.[0] ?? 0),
            column: lines.linePos(node.range?.[0] ?? 0).col,
            path: [],
          },
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
    const booleanValue = (value: Json | undefined): boolean | undefined => {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        if (["yes", "true", "on"].includes(value.toLowerCase())) return true;
        if (["no", "false", "off"].includes(value.toLowerCase())) return false;
      }
      return undefined;
    };
    function variables(
      value: Json | undefined,
      path: (string | number)[],
    ): Record<string, Json> {
      if (value === undefined || value === null) return {};
      const entries = Array.isArray(value) ? value : [value];
      const result: Record<string, Json> = {};
      entries.forEach((entry, i) => {
        const at = Array.isArray(value) ? [...path, i] : path;
        if (!object(entry)) {
          issue(
            "Variables must be a mapping or a list of mappings.",
            locate(at),
          );
          return;
        }
        for (const [key, val] of Object.entries(entry)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key))
            issue(
              `Invalid variable name “${key}”. Use letters, digits and underscores without backslashes.`,
              locate([...at, key]),
            );
          result[key] = val;
        }
      });
      return result;
    }
    function roles(
      value: Json | undefined,
      path: (string | number)[],
    ): AutomationNode[] {
      if (value === undefined || value === null) return [];
      if (!Array.isArray(value)) {
        issue(
          "Roles must be a list of role names or mappings containing role.",
          locate(path),
        );
        return [];
      }
      return value.flatMap((entry, i) => {
        const name =
          typeof entry === "string"
            ? entry
            : object(entry)
              ? entry.role
              : undefined;
        if (typeof name !== "string" || !name.trim()) {
          issue("A role requires a non-empty role name.", locate([...path, i]));
          return [];
        }
        const options = object(entry)
          ? Object.fromEntries(
              Object.entries(entry).filter(([key]) => key !== "role"),
            )
          : {};
        if (options.vars !== undefined)
          options.vars = variables(options.vars, [...path, i, "vars"]);
        return [
          {
            id: crypto.randomUUID(),
            type: "ROLE",
            name,
            role: { name, options },
            location: locate([...path, i]),
          },
        ];
      });
    }
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
        if (raw.name !== undefined && typeof raw.name !== "string")
          issue("Task name must be a string.", locate([...path, i, "name"]));
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
          if (raw.args !== undefined)
            issue(
              "args belongs to a module task, not a block.",
              locate([...path, i, "args"]),
            );
          node.children = tasks(raw.block, [...path, i, "block"]);
          for (const key of ["rescue", "always"] as const)
            if (raw[key] !== undefined)
              node[key] = tasks(raw[key], [...path, i, key]);
          if (candidates.length)
            issue("A block cannot also invoke a module.", location);
        } else if (candidates.length !== 1)
          issue(
            "Expected exactly one module invocation. Indent its arguments under the module name; use an FQCN for modules outside the catalog.",
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
        if (
          raw.block === undefined &&
          (raw.rescue !== undefined || raw.always !== undefined)
        )
          issue(
            "rescue and always must belong to a block, alongside the block keyword.",
            locate([
              ...path,
              i,
              raw.rescue !== undefined ? "rescue" : "always",
            ]),
          );
        const extras: Record<string, Json> = {};
        for (const [key, val] of Object.entries(raw)) {
          if (
            [
              "name",
              "block",
              "rescue",
              "always",
              "args",
              ...candidates,
            ].includes(key)
          )
            continue;
          if (taskExtra.has(key)) {
            extras[key] =
              key === "vars" ? variables(val, [...path, i, key]) : val;
            continue;
          }
          if (!taskKeys.has(key)) {
            issue(
              `Unsupported task keyword “${key}”. Check indentation: module arguments belong under the module, while when/notify belong beside it.`,
              locate([...path, i, key]),
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
            booleanValue(val) !== undefined
          )
            Object.assign(node, { [key]: booleanValue(val) });
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
            issue(
              `Unsupported value for “${key}”. Check the expected type and indentation.`,
              locate([...path, i, key]),
            );
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
      if (raw.name !== undefined && typeof raw.name !== "string")
        issue("Play name must be a string.", locate([index, "name"]));
      const extra: Record<string, Json> = {};
      for (const [key, v] of Object.entries(raw)) {
        if (
          [
            "name",
            "hosts",
            "become",
            "vars",
            "tasks",
            "handlers",
            "roles",
            "pre_tasks",
            "post_tasks",
          ].includes(key)
        )
          continue;
        if (playExtra.has(key)) extra[key] = v;
        else
          issue(
            `Unsupported play keyword “${key}”. Variables belong under vars; module invocations belong inside tasks.`,
            locate([index, key]),
          );
      }
      if (raw.become !== undefined && booleanValue(raw.become) === undefined)
        issue(
          "Play become must be a boolean (true/false or yes/no).",
          locate([index, "become"]),
        );
      book.plays.push({
        id: crypto.randomUUID(),
        name: typeof raw.name === "string" ? raw.name : `Play ${index + 1}`,
        hosts: raw.hosts,
        become: booleanValue(raw.become),
        vars: variables(raw.vars, [index, "vars"]),
        tasks: tasks(raw.tasks, [index, "tasks"]),
        handlers: tasks(raw.handlers, [index, "handlers"], true),
        ...(raw.roles !== undefined
          ? { roles: roles(raw.roles, [index, "roles"]) }
          : {}),
        ...(raw.pre_tasks !== undefined
          ? { pre_tasks: tasks(raw.pre_tasks, [index, "pre_tasks"]) }
          : {}),
        ...(raw.post_tasks !== undefined
          ? { post_tasks: tasks(raw.post_tasks, [index, "post_tasks"]) }
          : {}),
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
