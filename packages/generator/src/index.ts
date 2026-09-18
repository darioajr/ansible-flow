import {
  Document,
  isMap,
  isSeq,
  isScalar,
  parseDocument,
  type Node,
} from "yaml";
import type { AutomationNode, Json, Playbook } from "@visual-ansible/air";
function stable(value: Json): Json {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, stable(value[k])]),
    );
  return value;
}
export function generateYaml(book: Playbook): string {
  const paths = new WeakMap<object, (string | number)[]>();
  function task(n: AutomationNode): Record<string, Json> {
    const result: Record<string, Json> = { name: n.name };
    if (n.location) paths.set(result, n.location.path);
    if (n.type === "BLOCK") {
      result.block = (n.children ?? []).map(task);
      if (n.rescue !== undefined) result.rescue = n.rescue.map(task);
      if (n.always !== undefined) result.always = n.always.map(task);
    } else if (n.module) result[n.module.fqcn] = stable(n.module.args);
    for (const key of [
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
    ] as const) {
      const value = n[key];
      if (
        value !== undefined &&
        value !== "" &&
        (!Array.isArray(value) || value.length)
      )
        result[key] = stable(value);
    }
    for (const [key, value] of Object.entries(n.extra ?? {}))
      if (!(key in result)) result[key] = stable(value);
    return result;
  }
  const data = book.plays.map((p) => {
    const value: Record<string, Json> = {
      name: p.name,
      hosts: p.hosts,
      ...(p.become !== undefined ? { become: p.become } : {}),
      ...(Object.keys(p.vars).length ? { vars: stable(p.vars) } : {}),
      ...(p.pre_tasks?.length ? { pre_tasks: p.pre_tasks.map(task) } : {}),
      ...(p.roles?.length
        ? {
            roles: p.roles.map((n) => {
              const role: Record<string, Json> = {
                role: n.role!.name,
                ...(stable(n.role!.options) as Record<string, Json>),
              };
              if (n.location) paths.set(role, n.location.path);
              return role;
            }),
          }
        : {}),
      tasks: p.tasks.map(task),
      ...(p.post_tasks?.length ? { post_tasks: p.post_tasks.map(task) } : {}),
      ...(p.handlers.length ? { handlers: p.handlers.map(task) } : {}),
      ...p.extra,
    };
    if (p.location) paths.set(value, p.location.path);
    return value;
  });
  const original = book.source ? parseDocument(book.source) : undefined;
  const doc: Document = original?.clone() ?? new Document();
  function reconcile(previous: unknown, value: Json): Node {
    const sourcePath =
      value && typeof value === "object" ? paths.get(value) : undefined;
    if (sourcePath && original) {
      const origin = original.getIn(sourcePath, true);
      if (origin && typeof origin === "object" && "clone" in origin) {
        previous = (origin as Node).clone();
        if (sourcePath.at(-1) === 0) {
          const parent = original.getIn(sourcePath.slice(0, -1), true);
          if (isSeq(parent) && parent.commentBefore) {
            const copied = previous as Node;
            copied.commentBefore = [parent.commentBefore, copied.commentBefore]
              .filter(Boolean)
              .join("\n");
          }
        }
      }
    }
    if (Array.isArray(value)) {
      const seq = isSeq(previous) ? previous : doc.createNode([]);
      const old = seq.items.slice();
      if (
        value.some(
          (item) => item && typeof item === "object" && paths.has(item),
        )
      )
        seq.commentBefore = undefined;
      seq.items = value.map((item, i) => reconcile(old[i], item));
      return seq;
    }
    if (value && typeof value === "object") {
      const map = isMap(previous) ? previous : doc.createNode({});
      map.items = map.items.filter((pair) =>
        Object.hasOwn(value, String(pair.key)),
      );
      for (const [key, item] of Object.entries(value))
        map.set(key, reconcile(map.get(key, true), item));
      return map;
    }
    if (isScalar(previous)) {
      previous.value = value;
      return previous;
    }
    return doc.createNode(value);
  }
  doc.contents = reconcile(doc.contents, data);
  return doc.toString({ lineWidth: 0, indent: 2 });
}
