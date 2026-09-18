import path from "node:path";
import { walk, playNodes, type Problem } from "@visual-ansible/air";
import { parsePlaybook } from "@visual-ansible/parser";
import type { CommandResult } from "./runner";

export function cliProblems(
  tool: string,
  result: CommandResult,
  filename: string,
  text: string,
): Problem[] {
  const nodes = parsePlaybook(text).playbook.plays.flatMap((p) =>
    walk(playNodes(p)),
  );
  const locate = (problem: Problem, file?: string): Problem => {
    if (
      file &&
      path.resolve(path.dirname(filename), file) !== path.resolve(filename)
    )
      return {
        ...problem,
        message: `${file}:${problem.line ?? 1}: ${problem.message}`,
        line: 1,
        column: 1,
      };
    const node = nodes
      .filter((n) => n.location && n.location.line <= (problem.line ?? 1))
      .sort((a, b) => b.location!.line - a.location!.line)[0];
    return { ...problem, ...(node ? { nodeId: node.id } : {}) };
  };
  if (tool === "ansible-lint") {
    try {
      const entries: unknown = JSON.parse(result.stdout);
      if (!Array.isArray(entries)) throw new Error();
      const problems = entries.flatMap((entry): Problem[] => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const location = item.location as
          | {
              path?: string;
              lines?: { begin?: number };
              positions?: { begin?: { line?: number; column?: number } };
            }
          | undefined;
        const line =
          location?.positions?.begin?.line ?? location?.lines?.begin ?? 1;
        return [
          locate(
            {
              severity: ["info", "minor", "warning"].includes(
                String(item.severity),
              )
                ? "warning"
                : "error",
              code:
                typeof item.check_name === "string"
                  ? item.check_name
                  : "ANSIBLE_LINT",
              message: String(
                item.description ?? item.message ?? "Ansible lint finding.",
              ),
              line: Number.isInteger(line) && line > 0 ? line : 1,
              column: location?.positions?.begin?.column ?? 1,
            },
            location?.path,
          ),
        ];
      });
      if (problems.length || result.code === 0) return problems;
    } catch {
      /* Fall back to the actionable tool output. */
    }
  }
  if (result.code === 0) return [];
  // Current Ansible uses "Origin: /path:line:column"; older versions use "line N, column M".
  const output = (result.stderr || result.stdout).replace(
    /\u001b\[[0-9;]*m/g,
    "",
  );
  const origin = output.match(/Origin:\s*(.+?):(\d+):(\d+)/);
  const legacyFile = output.match(/appears to be in ['"]([^'"]+)['"]/);
  return [
    locate(
      {
        severity: "error",
        code: tool === "syntax-check" ? "ANSIBLE_SYNTAX" : "ANSIBLE_LINT",
        message:
          output.slice(0, 4000) ||
          `${tool} exited with code ${result.code}. Check executable configuration and dependencies.`,
        line: Number(origin?.[2] ?? output.match(/line (\d+)/i)?.[1] ?? 1),
        column: Number(origin?.[3] ?? output.match(/column (\d+)/i)?.[1] ?? 1),
      },
      origin?.[1] ?? legacyFile?.[1],
    ),
  ];
}
