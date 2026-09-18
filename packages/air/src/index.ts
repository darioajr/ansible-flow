export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export type NodeType =
  "TASK" | "MODULE" | "BLOCK" | "CONDITION" | "LOOP" | "HANDLER";
export interface SourceLocation {
  line: number;
  column: number;
  path: (string | number)[];
}
export interface AutomationNode {
  id: string;
  type: NodeType;
  name: string;
  module?: { fqcn: string; args: Record<string, Json> };
  when?: string | string[] | boolean;
  loop?: Json[] | string;
  register?: string;
  tags?: string[];
  become?: boolean;
  ignore_errors?: boolean;
  changed_when?: string | boolean;
  failed_when?: string | boolean;
  notify?: string[];
  delegate_to?: string;
  run_once?: boolean;
  environment?: Record<string, Json>;
  children?: AutomationNode[];
  extra?: Record<string, Json>;
  location?: SourceLocation;
}
export interface Play {
  id: string;
  name: string;
  hosts: string;
  become?: boolean;
  vars: Record<string, Json>;
  tasks: AutomationNode[];
  handlers: AutomationNode[];
  extra?: Record<string, Json>;
  location?: SourceLocation;
}
export interface Playbook {
  id: string;
  name: string;
  plays: Play[];
  source?: string;
}
export interface Project {
  id: string;
  name: string;
  description: string;
  playbooks: Playbook[];
  layout: Record<string, { x: number; y: number }>;
  revision: number;
  updatedAt: string;
}
export interface Problem {
  severity: "error" | "warning";
  message: string;
  nodeId?: string;
  line?: number;
  column?: number;
  code?: string;
}
export function newPlay(name = "Configure servers"): Play {
  return {
    id: crypto.randomUUID(),
    name,
    hosts: "all",
    vars: {},
    tasks: [],
    handlers: [],
  };
}
export function newPlaybook(name = "site.yml"): Playbook {
  return { id: crypto.randomUUID(), name, plays: [newPlay()] };
}
export function newProject(name: string, description = ""): Project {
  return {
    id: crypto.randomUUID(),
    name,
    description,
    playbooks: [newPlaybook()],
    layout: {},
    revision: 0,
    updatedAt: new Date().toISOString(),
  };
}
export function walk(nodes: AutomationNode[]): AutomationNode[] {
  return nodes.flatMap((n) => [n, ...walk(n.children ?? [])]);
}
export function updateNode(
  nodes: AutomationNode[],
  id: string,
  patch: Partial<AutomationNode>,
): AutomationNode[] {
  return nodes.map((n) =>
    n.id === id
      ? { ...n, ...patch }
      : n.children
        ? { ...n, children: updateNode(n.children, id, patch) }
        : n,
  );
}
export function removeNodes(
  nodes: AutomationNode[],
  ids: string[],
): AutomationNode[] {
  return nodes
    .filter((n) => !ids.includes(n.id))
    .map((n) =>
      n.children ? { ...n, children: removeNodes(n.children, ids) } : n,
    );
}
export function duplicateNodes(nodes: AutomationNode[]): AutomationNode[] {
  return nodes.map((n) => ({
    ...structuredClone(n),
    id: crypto.randomUUID(),
    name: `${n.name} (copy)`,
    location: undefined,
    children: n.children ? duplicateNodes(n.children) : undefined,
  }));
}
export function connectSequential(
  nodes: AutomationNode[],
  source: string,
  target: string,
): AutomationNode[] {
  if (source === target) throw new Error("A task cannot connect to itself.");
  const task = nodes.find((n) => n.id === target);
  if (!task || !nodes.some((n) => n.id === source))
    throw new Error("Tasks must belong to the same scope.");
  const result = nodes.filter((n) => n.id !== target);
  result.splice(result.findIndex((n) => n.id === source) + 1, 0, task);
  return result;
}

export const taskExtraKeys = [
  "vars",
  "become_user",
  "become_method",
  "check_mode",
  "no_log",
  "until",
  "retries",
  "delay",
  "any_errors_fatal",
  "listen",
  "timeout",
] as const;
export const playExtraKeys = [
  "gather_facts",
  "gather_subset",
  "gather_timeout",
  "vars_files",
  "vars_prompt",
  "serial",
  "strategy",
  "connection",
  "remote_user",
  "port",
  "become_user",
  "become_method",
  "any_errors_fatal",
  "max_fail_percentage",
  "tags",
  "environment",
  "order",
] as const;
