import {
  walk,
  playNodes,
  branches,
  type Playbook,
  type Problem,
  type Json,
  type Project,
} from "@visual-ansible/air";
import { modules, type ModuleMetadata } from "@visual-ansible/module-metadata";
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
export function validatePlaybook(
  book: Playbook,
  catalog: ModuleMetadata[] = modules,
): Problem[] {
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
    for (const node of walk(playNodes(play))) {
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
      if (node.type === "ROLE") {
        if (!node.role?.name.trim()) add("Define the role name.");
        if (node.module || branches.some((key) => node[key] !== undefined))
          add("A play role cannot also contain a module or block branches.");
        if (!play.roles?.some((r) => r.id === node.id))
          add("Play roles must belong to the roles scope.");
        continue;
      }
      if (node.role) add("Only role nodes may contain role options.");
      if (play.roles?.some((r) => r.id === node.id))
        add("The roles scope only accepts role nodes.");
      if (node.type === "BLOCK") {
        if (node.module) add("A block cannot invoke a module directly.");
        if (!node.children?.length) add("Add at least one task to this block.");
        if (node.loop !== undefined)
          add("Ansible does not allow loop on a block.");
        if (node.register) add("Ansible does not allow register on a block.");
      } else {
        if (branches.some((key) => node[key] !== undefined))
          add("Only blocks may have block, rescue or always branches.");
        const m = catalog.find((m) => m.fqcn === node.module?.fqcn);
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
              const value =
                args[key] ??
                p.aliases
                  ?.map((alias) => args[alias])
                  .find((value) => value !== undefined);
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
              if (
                !m.parameters[key] &&
                !Object.values(m.parameters).some((p) =>
                  p.aliases?.includes(key),
                )
              )
                add(
                  `Parameter “${key}” is not in bundled metadata.`,
                  "warning",
                );
          }
          if (
            m.fqcn === "ansible.builtin.apt" &&
            !args.name &&
            !args.update_cache &&
            !args.upgrade &&
            !args.autoremove
          )
            add(
              "Specify packages, cache update, upgrade or autoremove for apt.",
            );
          if (
            m.fqcn === "community.general.ufw" &&
            !args.rule &&
            !args.state &&
            !args.policy &&
            !args.logging
          )
            add("Specify a UFW rule, state, policy or logging action.");
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
        if (!handlers.includes(name))
          add(
            `Handler “${name}” is not declared in this play; it may be provided by a role.`,
            play.roles?.length ||
              walk(playNodes(play)).some((n) =>
                [
                  "ansible.builtin.include_role",
                  "ansible.builtin.import_role",
                ].includes(n.module?.fqcn ?? ""),
              )
              ? "warning"
              : "error",
          );
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
      ...b.plays.flatMap((p) => [p.id, ...walk(playNodes(p)).map((n) => n.id)]),
    ]),
  ];
  if (ids.length > 2000) throw new Error("Project exceeds 2000 objects.");
  if (new Set(ids).size !== ids.length) throw new Error("IDs must be unique.");
  if (containsLiteralSecret(project as unknown as Json))
    throw new Error("Replace literal credential values with Jinja references.");
}
