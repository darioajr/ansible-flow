import { it, expect } from "vitest";
import { readFile, mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parsePlaybook } from "@visual-ansible/parser";
import { generateYaml } from "@visual-ansible/generator";

const executeFile = promisify(execFile);
const commandTimeout = 30_000;
const cleanupAllowance = 5_000;
it.skipIf(process.env.RUN_ANSIBLE_SYNTAX !== "1")(
  "real Ansible accepts the shared generator output",
  async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "visual-syntax-"));
    try {
      const text = await readFile(
        new URL("./fixtures/nginx.yml", import.meta.url),
        "utf8",
      );
      const target = path.join(dir, "playbook.yml");
      await writeFile(target, generateYaml(parsePlaybook(text).playbook));
      const { stdout } = await executeFile(
        "ansible-playbook",
        ["--syntax-check", "-i", "localhost,", target],
        {
          encoding: "utf8",
          env: { ...process.env, ANSIBLE_LOCAL_TEMP: path.join(dir, "tmp") },
          timeout: commandTimeout,
        },
      );
      expect(stdout).toContain("playbook:");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
  commandTimeout + cleanupAllowance,
);

it.skipIf(process.env.RUN_ANSIBLE_SYNTAX !== "1")(
  "real Ansible accepts roles, nested rescue/always and vars lists after generation",
  async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "visual-roles-syntax-"));
    try {
      await mkdir(path.join(dir, "roles/demo/tasks"), { recursive: true });
      await writeFile(
        path.join(dir, "roles/demo/tasks/main.yml"),
        "- name: Role task\n  ansible.builtin.debug: {msg: role}\n",
      );
      const text = await readFile(
        new URL("./fixtures/roles-blocks.yml", import.meta.url),
        "utf8",
      );
      const target = path.join(dir, "playbook.yml");
      await writeFile(target, generateYaml(parsePlaybook(text).playbook));
      const { stdout } = await executeFile(
        "ansible-playbook",
        ["--syntax-check", "-i", "localhost,", target],
        {
          encoding: "utf8",
          cwd: dir,
          env: { ...process.env, ANSIBLE_LOCAL_TEMP: path.join(dir, "tmp") },
          timeout: commandTimeout,
        },
      );
      expect(stdout).toContain("playbook:");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
  commandTimeout + cleanupAllowance,
);

it.skipIf(process.env.RUN_ANSIBLE_SYNTAX !== "1")(
  "real ansible-doc produces usable discovered forms",
  async () => {
    const { listModules, loadModules } =
      await import("../apps/vscode/extension/src/module-discovery");
    const dir = await mkdtemp(path.join(tmpdir(), "visual-doc-"));
    try {
      const runner = {
        execute: async (command: string, args: string[], cwd: string) => {
          const { stdout, stderr } = await executeFile(command, args, {
            cwd,
            encoding: "utf8",
            env: { ...process.env, ANSIBLE_LOCAL_TEMP: path.join(dir, "tmp") },
            timeout: commandTimeout,
            maxBuffer: 1_000_000,
          });
          return { code: 0, stdout, stderr };
        },
      };
      const available = await listModules(runner, "ansible-doc", dir);
      expect(available.some(([fqcn]) => fqcn === "ansible.builtin.debug")).toBe(
        true,
      );
      const loaded = await loadModules(runner, "ansible-doc", dir, [
        "ansible.builtin.debug",
        "ansible.builtin.apt",
      ]);
      expect(
        loaded.find((m) => m.fqcn === "ansible.builtin.debug")!.parameters.msg,
      ).toBeDefined();
      expect(
        loaded.find((m) => m.fqcn === "ansible.builtin.apt")!.parameters
          .update_cache.type,
      ).toBe("boolean");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
  // One catalog query followed by two module queries, each bounded separately.
  3 * commandTimeout + cleanupAllowance,
);
