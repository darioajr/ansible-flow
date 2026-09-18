import { taskExtraKeys, playExtraKeys } from "@visual-ansible/air";
import { z } from "zod";
import type {
  AutomationNode,
  Json,
  Playbook,
  Project,
} from "@visual-ansible/air";
export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);
const id = z.uuid();
const record = z.record(z.string(), jsonSchema);
const location = z
  .object({
    line: z.number().int().positive(),
    column: z.number().int().positive(),
    path: z.array(z.union([z.string(), z.number().int().nonnegative()])),
  })
  .strict();
export const nodeSchema: z.ZodType<AutomationNode> = z.lazy(() =>
  z
    .object({
      id,
      type: z.enum(["TASK", "MODULE", "BLOCK", "CONDITION", "LOOP", "HANDLER"]),
      name: z.string().max(500),
      module: z
        .object({ fqcn: z.string().regex(/^\w+\.\w+\.\w+$/), args: record })
        .strict()
        .optional(),
      when: z.union([z.string(), z.array(z.string()), z.boolean()]).optional(),
      loop: z.union([z.array(jsonSchema), z.string()]).optional(),
      register: z.string().optional(),
      tags: z.array(z.string()).optional(),
      become: z.boolean().optional(),
      ignore_errors: z.boolean().optional(),
      changed_when: z.union([z.string(), z.boolean()]).optional(),
      failed_when: z.union([z.string(), z.boolean()]).optional(),
      notify: z.array(z.string()).optional(),
      delegate_to: z.string().optional(),
      run_once: z.boolean().optional(),
      environment: record.optional(),
      children: z.array(nodeSchema).max(500).optional(),
      extra: record
        .refine(
          (v) =>
            Object.keys(v).every((k) =>
              (taskExtraKeys as readonly string[]).includes(k),
            ),
          "Unsupported task extra keyword",
        )
        .optional(),
      location: location.optional(),
    })
    .strict(),
);
export const playbookSchema: z.ZodType<Playbook> = z
  .object({
    id,
    name: z.string().min(1).max(200),
    source: z.string().max(1000000).optional(),
    plays: z
      .array(
        z
          .object({
            id,
            name: z.string().max(500),
            hosts: z.string().max(1000),
            become: z.boolean().optional(),
            vars: record,
            tasks: z.array(nodeSchema).max(500),
            handlers: z.array(nodeSchema).max(500),
            extra: record
              .refine(
                (v) =>
                  Object.keys(v).every((k) =>
                    (playExtraKeys as readonly string[]).includes(k),
                  ),
                "Unsupported play extra keyword",
              )
              .optional(),
            location: location.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
export const projectSchema: z.ZodType<Project> = z
  .object({
    id,
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000),
    playbooks: z.array(playbookSchema).min(1).max(50),
    layout: z.record(
      z.string(),
      z.object({ x: z.number().finite(), y: z.number().finite() }),
    ),
    revision: z.number().int().nonnegative(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000).optional(),
  })
  .strict();
export const importSchema = z
  .object({ name: z.string().min(1).max(200), yaml: z.string().max(1000000) })
  .strict();
// No path, URI, executable or HTML can be selected by a Webview message.
export const webviewMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }).strict(),
  z
    .object({
      type: z.literal("edit"),
      requestId: id,
      version: z.number().int().positive(),
      playbook: playbookSchema,
    })
    .strict(),
  z.object({ type: z.literal("save"), requestId: id }).strict(),
  z
    .object({
      type: z.literal("validate"),
      requestId: id,
      external: z.boolean().default(false),
    })
    .strict(),
  z.object({ type: z.literal("undo") }).strict(),
  z.object({ type: z.literal("redo") }).strict(),
]);
export const hostMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("document"),
      version: z.number().int().positive(),
      text: z.string().max(1000000),
      name: z.string(),
      dirty: z.boolean(),
      requestId: id.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("result"),
      requestId: id,
      ok: z.boolean(),
      message: z.string().optional(),
      version: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("problems"),
      problems: z.array(
        z.object({
          severity: z.enum(["error", "warning"]),
          message: z.string(),
          line: z.number().optional(),
          column: z.number().optional(),
          nodeId: z.string().optional(),
          code: z.string().optional(),
        }),
      ),
    })
    .strict(),
]);
export type WebviewMessage = z.infer<typeof webviewMessageSchema>;
export type HostMessage = z.infer<typeof hostMessageSchema>;
