import { it, expect } from "vitest";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parsePlaybook } from "@visual-ansible/parser";
import { generateYaml } from "@visual-ansible/generator";
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
      const out = execFileSync(
        "ansible-playbook",
        ["--syntax-check", "-i", "localhost,", target],
        {
          encoding: "utf8",
          env: { ...process.env, ANSIBLE_LOCAL_TEMP: path.join(dir, "tmp") },
          timeout: 30000,
        },
      );
      expect(out).toContain("playbook:");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
