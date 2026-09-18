import { _electron as electron } from "@playwright/test";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const directory = await mkdtemp(path.join(tmpdir(), "visual-vscode-ui-"));
const file = path.join(directory, "site.yml");
await writeFile(
  file,
  "# Native visual editing\n- name: Configure nginx\n  hosts: webservers\n  tasks:\n    - name: Install nginx\n      ansible.builtin.dnf:\n        name: nginx\n        state: present\n",
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const executable =
  process.env.VSCODE_EXECUTABLE ??
  path.resolve(
    ".vscode-test/vscode-darwin-arm64-1.138.0/Visual Studio Code.app/Contents/MacOS/Code",
  );
let application;
try {
  application = await electron.launch({
    executablePath: executable,
    args: [
      directory,
      file,
      "--disable-extensions",
      "--disable-workspace-trust",
      "--skip-welcome",
      "--skip-release-notes",
      `--extensionDevelopmentPath=${path.resolve("apps/vscode/extension")}`,
      "--user-data-dir",
      path.join(directory, "profile"),
    ],
    env,
    timeout: 60000,
  });
  const page = await application.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.locator(".monaco-workbench").waitFor({ timeout: 30000 });
  await page.bringToFront();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/vscode-before-command.png" });
  console.log("Workbench loaded:", page.url());
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+Shift+P" : "Control+Shift+P",
  );
  const input = page.locator(".quick-input-widget input");
  await input.fill(">Visual Ansible: Open Playbook Visually");
  await page
    .getByText("Visual Ansible: Open Playbook Visually", { exact: true })
    .first()
    .click();
  let frame;
  for (let i = 0; i < 100; i++) {
    for (const candidate of page.frames()) {
      if (await candidate.locator(".react-flow__node").count()) {
        frame = candidate;
        break;
      }
    }
    if (frame) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(frame, "Production Webview rendered its shared React Flow editor");
  await frame.locator(".react-flow__node").click();
  await frame
    .getByRole("textbox", { name: "Package name (name)" })
    .fill("httpd");
  await frame.getByRole("button", { name: "Save", exact: true }).click();
  await frame
    .locator(".save-status")
    .filter({ hasText: "Saved" })
    .waitFor({ state: "attached" });
  assert.ok(
    (await readFile(file, "utf8")).includes("name: httpd"),
    "Visual UI saved YAML through the real Extension Host",
  );
  await frame
    .getByRole("button", { name: "YAML preview", exact: true })
    .click();
  await frame.locator(".monaco-editor").waitFor({ timeout: 30000 });
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/vscode-native-editor.png",
    fullPage: true,
  });
  console.log(
    "Native VS Code UI: production Webview, property edit, save and Monaco under CSP passed.",
  );
} finally {
  await application?.close();
  await rm(directory, { recursive: true, force: true });
}
