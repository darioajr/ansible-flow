import { build } from "esbuild";
import { runTests, downloadAndUnzipVSCode } from "@vscode/test-electron";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
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
let executable = await downloadAndUnzipVSCode("1.138.0");
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
