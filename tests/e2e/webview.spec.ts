import { test, expect } from "@playwright/test";
import {
  editedDocument,
  documentProblems,
} from "../../apps/vscode/extension/src/document-service";
import { parsePlaybook } from "@visual-ansible/parser";
import { generateYaml } from "@visual-ansible/generator";
import { webviewMessageSchema } from "@visual-ansible/schemas";
test("Vite Webview: host protocol, editing, native history, save and same YAML output", async ({
  page,
}) => {
  let text =
    "# Keep this comment\n- hosts: webservers\n  tasks:\n    - name: Install nginx\n      ansible.builtin.dnf:\n        name: nginx\n        state: present\n";
  let version = 1;
  let disk = text;
  const past: string[] = [];
  const future: string[] = [];
  await page.exposeFunction("extensionHost", async (input: unknown) => {
    const msg = webviewMessageSchema.parse(input);
    const send = async (data: unknown) =>
      page.evaluate((data) => window.postMessage(data, "*"), data);
    if (msg.type === "ready")
      await send({
        type: "document",
        text,
        version,
        name: "site.yml",
        dirty: false,
      });
    if (msg.type === "edit") {
      const next = editedDocument(text, version, msg.version, msg.playbook);
      if (next !== text) {
        past.push(text);
        text = next;
        version++;
      }
      await send({
        type: "result",
        requestId: msg.requestId,
        ok: true,
        version,
      });
    }
    if (msg.type === "save") {
      disk = text;
      await send({
        type: "result",
        requestId: msg.requestId,
        ok: true,
        version,
      });
    }
    if (msg.type === "validate") {
      await send({ type: "problems", problems: documentProblems(text) });
      await send({ type: "result", requestId: msg.requestId, ok: true });
    }
    if (msg.type === "undo" && past.length) {
      future.push(text);
      text = past.pop()!;
      version++;
      await send({
        type: "document",
        text,
        version,
        name: "site.yml",
        dirty: true,
      });
    }
    if (msg.type === "redo" && future.length) {
      past.push(text);
      text = future.pop()!;
      version++;
      await send({
        type: "document",
        text,
        version,
        name: "site.yml",
        dirty: true,
      });
    }
  });
  await page.addInitScript(() => {
    Object.assign(window, {
      acquireVsCodeApi: () => ({
        postMessage: (message: unknown) =>
          (
            window as unknown as {
              extensionHost: (m: unknown) => Promise<void>;
            }
          ).extensionHost(message),
      }),
    });
  });
  await page.goto("http://localhost:3101");
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.locator(".react-flow__node").click();
  await page
    .getByRole("textbox", { name: "Package name (name)" })
    .fill("httpd");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText(/Saved/);
  expect(disk).toContain("name: httpd");
  expect(disk).toContain("# Keep this comment");
  expect(disk).toBe(generateYaml(parsePlaybook(disk).playbook));
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => text).toContain("name: nginx");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(() => text).toContain("name: httpd");
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(page.getByText("No AIR validation problems.")).toBeVisible();
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.locator(".react-flow__node").click();
  await expect(
    page.getByRole("textbox", { name: "Package name (name)" }),
  ).toHaveValue("httpd");
  await page.screenshot({
    path: "test-results/webview-editor.png",
    fullPage: true,
  });
});
