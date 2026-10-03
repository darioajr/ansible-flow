import { build } from "esbuild";
import { runTests, downloadAndUnzipVSCode } from "@vscode/test-electron";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
delete process.env.ELECTRON_RUN_AS_NODE;
const folder = await mkdtemp(path.join(tmpdir(), "visual-extension-"));
await build({
  entryPoints: ["tests/extension-host/suite.ts"],
  outfile: "tests/extension-host/dist/suite.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["vscode"],
  target: "node20",
});
const VSCODE_VERSION = "1.138.0";
const DOWNLOAD_ATTEMPTS = 4;
async function downloadVSCode() {
  for (let attempt = 1; ; attempt++) {
    try {
      return await downloadAndUnzipVSCode(VSCODE_VERSION);
    } catch (error) {
      if (attempt >= DOWNLOAD_ATTEMPTS) throw error;
      const delay = 15_000 * attempt;
      console.warn(
        `VS Code ${VSCODE_VERSION} download failed (${error.code ?? error.message}); retrying in ${delay / 1000}s (${attempt}/${DOWNLOAD_ATTEMPTS - 1}).`,
      );
      await sleep(delay);
    }
  }
}
let executable = await downloadVSCode();
if (process.platform === "darwin") {
  try {
    await access(executable);
  } catch {
    executable = path.join(path.dirname(executable), "Code");
  }
}
try {
  await runTests({
    vscodeExecutablePath: executable,
    extensionDevelopmentPath: path.resolve("apps/vscode/extension"),
    extensionTestsPath: path.resolve("tests/extension-host/dist/suite.cjs"),
    launchArgs: [
      folder,
      "--disable-extensions",
      "--disable-workspace-trust",
      "--skip-welcome",
      "--skip-release-notes",
      "--user-data-dir",
      path.join(folder, "profile"),
    ],
    version: "stable",
  });
} finally {
  await rm(folder, { recursive: true, force: true });
}
