import { z } from "zod";
import {
  parseAnsibleDoc,
  moduleMetadataSchema,
  type ModuleMetadata,
} from "@visual-ansible/module-metadata";
import type { AnsibleCommandRunner } from "./runner";
export async function listModules(
  runner: AnsibleCommandRunner,
  executable: string,
  cwd: string,
) {
  const result = await runner.execute(
    executable,
    ["--list", "--json", "--type", "module"],
    cwd,
  );
  if (result.code !== 0)
    throw new Error(
      `ansible-doc discovery failed: ${(result.stderr || result.stdout).slice(0, 2000)}`,
    );
  return Object.entries(
    z.record(z.string(), z.string()).parse(JSON.parse(result.stdout)),
  ).filter(([name]) => /^\w+\.\w+\.\w+$/.test(name));
}
export async function loadModules(
  runner: AnsibleCommandRunner,
  executable: string,
  cwd: string,
  names: string[],
): Promise<ModuleMetadata[]> {
  if (names.length > 20 || names.some((name) => !/^\w+\.\w+\.\w+$/.test(name)))
    throw new Error("Select at most 20 fully qualified modules at a time.");
  const modules: ModuleMetadata[] = [];
  for (const name of names) {
    const result = await runner.execute(
      executable,
      ["--json", "--type", "module", name],
      cwd,
    );
    if (result.code !== 0)
      throw new Error(
        `ansible-doc failed for ${name}: ${(result.stderr || result.stdout).slice(0, 2000)}`,
      );
    const parsed = parseAnsibleDoc(JSON.parse(result.stdout));
    if (!parsed.some((m) => m.fqcn === name))
      throw new Error(`ansible-doc did not return metadata for ${name}.`);
    modules.push(...parsed.map((m) => moduleMetadataSchema.parse(m)));
  }
  return modules;
}
