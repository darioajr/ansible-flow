import { z } from "zod";
export interface Parameter {
  label: string;
  type: "string" | "boolean" | "number" | "json";
  required?: boolean;
  options?: string[];
  acceptsList?: boolean;
  aliases?: string[];
}
export interface ModuleMetadata {
  fqcn: string;
  label: string;
  description: string;
  category: string;
  parameters: Record<string, Parameter>;
}
const str = (
  label: string,
  required = false,
  options?: string[],
): Parameter => ({ label, type: "string", required, options });
const bool = (label: string): Parameter => ({ label, type: "boolean" });
const pkg = {
  name: { ...str("Package name", true), acceptsList: true },
  state: str("State", false, ["present", "absent", "latest"]),
};
const service = {
  name: str("Service name", true),
  state: str("State", false, ["started", "stopped", "restarted", "reloaded"]),
  enabled: bool("Enable at boot"),
};
const file = {
  src: str("Source path", true),
  dest: str("Destination path", true),
  owner: str("Owner"),
  group: str("Group"),
  mode: str("Permissions"),
};
const definitions: [string, string, string, Record<string, Parameter>][] = [
  [
    "command",
    "Commands",
    "Run a command without a shell.",
    {
      cmd: str("Command", true),
      chdir: str("Working directory"),
      creates: str("Skip if path exists"),
    },
  ],
  [
    "shell",
    "Commands",
    "Run a command through a shell.",
    { cmd: str("Shell command", true), chdir: str("Working directory") },
  ],
  [
    "copy",
    "Files",
    "Copy a file or content.",
    {
      ...file,
      src: str("Source path"),
      content: str("Content"),
      backup: bool("Create backup"),
    },
  ],
  [
    "file",
    "Files",
    "Manage files and directories.",
    {
      path: str("Path", true),
      state: str("State", false, [
        "file",
        "directory",
        "touch",
        "absent",
        "link",
        "hard",
      ]),
      src: str("Link source"),
      mode: str("Permissions"),
      owner: str("Owner"),
      group: str("Group"),
    },
  ],
  ["template", "Files", "Render a Jinja template.", file],
  ["service", "Services", "Manage a system service.", service],
  [
    "systemd_service",
    "Services",
    "Manage services using systemd.",
    {
      ...service,
      name: str("Service name"),
      daemon_reload: bool("Reload systemd"),
      masked: bool("Mask service"),
    },
  ],
  ["dnf", "Packages", "Manage Red Hat packages.", pkg],
  ["package", "Packages", "Use the host package manager.", pkg],
  [
    "user",
    "Identity",
    "Manage user accounts.",
    {
      name: str("Username", true),
      state: str("State", false, ["present", "absent"]),
      groups: str("Groups"),
      shell: str("Login shell"),
      create_home: bool("Create home directory"),
    },
  ],
  [
    "group",
    "Identity",
    "Manage system groups.",
    {
      name: str("Group name", true),
      state: str("State", false, ["present", "absent"]),
      gid: { label: "Group ID", type: "number" },
    },
  ],
  [
    "uri",
    "Network",
    "Interact with HTTP endpoints.",
    {
      url: str("URL", true),
      method: str("Method", false, [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "HEAD",
      ]),
      status_code: { label: "Expected status codes", type: "json" },
      body: { label: "Body", type: "json" },
      body_format: str("Body format", false, [
        "raw",
        "json",
        "form-urlencoded",
      ]),
    },
  ],
  [
    "debug",
    "Utilities",
    "Print messages or inspect variables.",
    { msg: str("Message"), var: str("Variable") },
  ],
  [
    "set_fact",
    "Utilities",
    "Set variables for the current host.",
    { facts: { label: "Facts", type: "json", required: true } },
  ],
  [
    "wait_for",
    "Network",
    "Wait for a port or condition.",
    {
      host: str("Host"),
      port: { label: "Port", type: "number" },
      path: str("Path"),
      timeout: { label: "Timeout", type: "number" },
      state: str("State", false, [
        "started",
        "stopped",
        "present",
        "absent",
        "drained",
      ]),
    },
  ],
];
definitions.push(
  [
    "apt",
    "Packages",
    "Manage Debian and Ubuntu packages.",
    {
      ...pkg,
      name: { ...pkg.name, required: false },
      update_cache: bool("Update package cache"),
      cache_valid_time: { label: "Cache validity (seconds)", type: "number" },
      upgrade: str("Upgrade", false, ["no", "yes", "safe", "full", "dist"]),
      autoremove: bool("Remove unused dependencies"),
      purge: bool("Purge configuration"),
    },
  ],
  [
    "replace",
    "Files",
    "Replace text matching a regular expression.",
    {
      path: str("File path", true),
      regexp: str("Regular expression", true),
      replace: str("Replacement"),
      before: str("Before pattern"),
      after: str("After pattern"),
      backup: bool("Create backup"),
      validate: str("Validation command"),
      owner: str("Owner"),
      group: str("Group"),
      mode: str("Permissions"),
    },
  ],
  [
    "include_role",
    "Roles",
    "Include a role dynamically.",
    {
      name: str("Role name", true),
      tasks_from: str("Tasks file"),
      handlers_from: str("Handlers file"),
      defaults_from: str("Defaults file"),
      vars_from: str("Variables file"),
      public: bool("Expose role variables"),
      apply: { label: "Task keywords", type: "json" },
      allow_duplicates: bool("Allow duplicates"),
    },
  ],
  [
    "import_role",
    "Roles",
    "Import a role statically.",
    {
      name: str("Role name", true),
      tasks_from: str("Tasks file"),
      handlers_from: str("Handlers file"),
      defaults_from: str("Defaults file"),
      vars_from: str("Variables file"),
      public: bool("Expose role variables"),
      allow_duplicates: bool("Allow duplicates"),
    },
  ],
);
export const modules: ModuleMetadata[] = definitions.map(
  ([label, category, description, parameters]) => ({
    fqcn: `ansible.builtin.${label}`,
    label,
    category,
    description,
    parameters,
  }),
);
modules.push({
  fqcn: "community.general.ufw",
  label: "ufw",
  category: "Firewall",
  description: "Manage UFW rules (requires community.general).",
  parameters: {
    rule: str("Rule", false, ["allow", "deny", "limit", "reject"]),
    port: str("Port"),
    proto: str("Protocol", false, [
      "any",
      "tcp",
      "udp",
      "ipv6",
      "esp",
      "ah",
      "gre",
      "igmp",
    ]),
    from_ip: str("Source address"),
    to_ip: str("Destination address"),
    direction: str("Direction", false, [
      "in",
      "incoming",
      "out",
      "outgoing",
      "routed",
    ]),
    state: str("Firewall state", false, [
      "enabled",
      "disabled",
      "reloaded",
      "reset",
    ]),
    policy: str("Default policy", false, ["allow", "deny", "reject"]),
    comment: str("Comment"),
    delete: bool("Delete rule"),
    logging: str("Logging", false, [
      "on",
      "off",
      "low",
      "medium",
      "high",
      "full",
    ]),
  },
});
export const moduleMetadataSchema: z.ZodType<ModuleMetadata> = z
  .object({
    fqcn: z.string().regex(/^\w+\.\w+\.\w+$/),
    label: z.string().max(500),
    category: z.string().max(500),
    description: z.string().max(20000),
    parameters: z.record(
      z.string(),
      z
        .object({
          label: z.string(),
          type: z.enum(["string", "boolean", "number", "json"]),
          required: z.boolean().optional(),
          options: z.array(z.string()).optional(),
          acceptsList: z.boolean().optional(),
          aliases: z.array(z.string()).optional(),
        })
        .strict(),
    ),
  })
  .strict();
export function mergeModules(discovered: ModuleMetadata[]): ModuleMetadata[] {
  return [
    ...new Map([...modules, ...discovered].map((m) => [m.fqcn, m])).values(),
  ];
}
export const getModule = (fqcn: string) => modules.find((m) => m.fqcn === fqcn);
export const normalizeModule = (name: string) =>
  name.includes(".")
    ? name
    : (modules.find((m) => m.label === name)?.fqcn ??
      `ansible.builtin.${name}`);
const docSchema = z.record(
  z.string(),
  z.object({
    doc: z.object({
      short_description: z.union([z.string(), z.array(z.string())]).optional(),
      options: z
        .record(
          z.string(),
          z.object({
            type: z.string().optional(),
            required: z.boolean().optional(),
            aliases: z.array(z.string()).optional(),
            description: z.union([z.string(), z.array(z.string())]).optional(),
            choices: z
              .array(z.union([z.string(), z.number(), z.boolean()]))
              .optional(),
          }),
        )
        .optional(),
    }),
  }),
);
export function parseAnsibleDoc(input: unknown): ModuleMetadata[] {
  return Object.entries(docSchema.parse(input))
    .filter(([fqcn]) => /^\w+\.\w+\.\w+$/.test(fqcn))
    .map(([fqcn, { doc }]) => ({
      fqcn,
      label: fqcn.split(".").at(-1)!,
      category: fqcn.split(".").slice(0, 2).join("."),
      description: Array.isArray(doc.short_description)
        ? doc.short_description.join(" ")
        : (doc.short_description ?? ""),
      parameters: Object.fromEntries(
        Object.entries(doc.options ?? {}).map(([key, p]) => [
          key,
          {
            label: key,
            type:
              p.type === "bool"
                ? "boolean"
                : ["int", "float"].includes(p.type ?? "")
                  ? "number"
                  : ["list", "dict"].includes(p.type ?? "")
                    ? "json"
                    : ["str", "path"].includes(p.type ?? "str")
                      ? "string"
                      : "json",
            required: p.required,
            aliases: p.aliases,
            options: p.choices?.map(String),
          },
        ]),
      ),
    }));
}
