import { z } from "zod";
export interface Parameter {
  label: string;
  type: "string" | "boolean" | "number" | "json";
  required?: boolean;
  options?: string[];
  acceptsList?: boolean;
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
export const modules: ModuleMetadata[] = definitions.map(
  ([label, category, description, parameters]) => ({
    fqcn: `ansible.builtin.${label}`,
    label,
    category,
    description,
    parameters,
  }),
);
export const getModule = (fqcn: string) => modules.find((m) => m.fqcn === fqcn);
export const normalizeModule = (name: string) =>
  name.includes(".") ? name : `ansible.builtin.${name}`;
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
  return Object.entries(docSchema.parse(input)).map(([fqcn, { doc }]) => ({
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
              : p.type === "int"
                ? "number"
                : ["list", "dict"].includes(p.type ?? "")
                  ? "json"
                  : "string",
          required: p.required,
          options: p.choices?.map(String),
        },
      ]),
    ),
  }));
}
