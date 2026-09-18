import {
  walk,
  type Playbook,
  type Problem,
  type Json,
  type Project,
} from "@visual-ansible/air";
import { getModule } from "@visual-ansible/module-metadata";
export function containsLiteralSecret(value: Json): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, v]) =>
      (/^(password|passwd|secret|api_key|private_key|token|vault_password)$/i.test(
        key,
      ) &&
        v !== null &&
        v !== "" &&
        !(typeof v === "string" && /^\s*{{[\s\S]+}}\s*$/.test(v))) ||
      containsLiteralSecret(v),
  );
}
export function validatePlaybook(book: Playbook): Problem[] {
  const result: Problem[] = [];
  const ids = new Set<string>();
  for (const play of book.plays) {
    if (!play.hosts.trim())
      result.push({
        severity: "error",
        message: "Define target hosts for every play.",
        line: play.location?.line,
      });
    const handlers = play.handlers.map((h) => h.name);
    if (new Set(handlers).size !== handlers.length)
      result.push({
        severity: "error",
        message: "Handler names must be unique.",
      });
    for (const node of walk([...play.tasks, ...play.handlers])) {
      const add = (message: string, severity: Problem["severity"] = "error") =>
        result.push({
          severity,
          message,
          nodeId: node.id,
          line: node.location?.line,
          column: node.location?.column,
        });
      if (ids.has(node.id)) add("Duplicate node ID.");
      ids.add(node.id);
      if (!node.name.trim()) add("Task name is required.");
      if (node.register && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(node.register))
        add("Register must be a valid variable name.");
      if (node.type === "BLOCK") {
        if (!node.children?.length) add("Add at least one task to this block.");
        if (node.loop !== undefined)
          add("Ansible does not allow loop on a block.");
        if (node.register) add("Ansible does not allow register on a block.");
      } else {
        if (node.children?.length) add("Only blocks may have children.");
        const m = getModule(node.module?.fqcn ?? "");
        if (!node.module) add("Choose a module.");
        else if (!m)
          add(
            "Module metadata is unavailable; check this module with Ansible.",
            "warning",
          );
        else {
          const args = node.module.args;
          if (m.label === "set_fact") {
            if (!Object.keys(args).length) add("Provide at least one fact.");
          } else {
            for (const [key, p] of Object.entries(m.parameters)) {
              const value = args[key];
              if (p.required && (value === undefined || value === ""))
                add(`Parameter “${key}” is required.`);
              if (
                value !== undefined &&
                p.type !== "json" &&
                typeof value !== p.type &&
                !(
                  p.acceptsList &&
                  Array.isArray(value) &&
                  value.every((v) => typeof v === "string")
                ) &&
                !(typeof value === "string" && value.includes("{{"))
              )
                add(`Parameter “${key}” must be ${p.type}.`);
              if (
                p.options &&
                typeof value === "string" &&
                !value.includes("{{") &&
                !p.options.includes(value)
              )
                add(`Invalid value for “${key}”.`);
            }
            for (const key of Object.keys(args))
              if (!m.parameters[key])
                add(
                  `Parameter “${key}” is not in bundled metadata.`,
                  "warning",
                );
          }
          if (m.label === "copy" && !args.src && !args.content)
            add("Copy requires source or content.");
          if (m.label === "copy" && args.src && args.content)
            add("Choose either source or content.");
          if (m.label === "debug" && args.msg && args.var)
            add("Choose either message or variable.");
          if (m.label === "shell")
            add(
              "Prefer command when shell features are unnecessary.",
              "warning",
            );
          if (
            ["service", "systemd_service"].includes(m.label) &&
            args.state === undefined &&
            args.enabled === undefined &&
            args.masked === undefined &&
            args.daemon_reload !== true
          )
            add("Specify service state, enabled, masked or daemon_reload.");
        }
      }
      for (const name of node.notify ?? [])
        if (!handlers.includes(name)) add(`Handler “${name}” does not exist.`);
    }
  }
  if (containsLiteralSecret({ ...book, source: undefined } as unknown as Json))
    result.push({
      severity: "error",
      message: "Replace literal credential values with Jinja references.",
    });
  return result;
}
export function assertProject(project: Project): void {
  const ids = [
    project.id,
    ...project.playbooks.flatMap((b) => [
      b.id,
      ...b.plays.flatMap((p) => [
        p.id,
        ...walk([...p.tasks, ...p.handlers]).map((n) => n.id),
      ]),
    ]),
  ];
  if (ids.length > 2000) throw new Error("Project exceeds 2000 objects.");
  if (new Set(ids).size !== ids.length) throw new Error("IDs must be unique.");
  if (containsLiteralSecret(project as unknown as Json))
    throw new Error("Replace literal credential values with Jinja references.");
}
