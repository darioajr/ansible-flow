import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { modules } from "@visual-ansible/module-metadata";
import { parsePlaybook } from "@visual-ansible/parser";
import { generateYaml } from "@visual-ansible/generator";
import { webviewMessageSchema } from "@visual-ansible/schemas";
import { editedDocument } from "../../apps/vscode/extension/src/document-service";
const fixture = readFileSync("tests/fixtures/roles-blocks.yml", "utf8");
for (const surface of ["web", "vscode"] as const) {
  test(`${surface}: roles, rescue, always and module forms share the same behavior`, async ({
    page,
  }) => {
    let text = fixture;
    let version = 1;
    let projectId = "";
    if (surface === "web") {
      const project = await (
        await page.request.post("/api/v1/projects", {
          data: { name: "Structures" },
        })
      ).json();
      project.playbooks = [parsePlaybook(fixture).playbook];
      projectId = project.id;
      expect(
        (
          await page.request.put(`/api/v1/projects/${project.id}`, {
            data: project,
          })
        ).ok(),
      ).toBe(true);
      await page.goto(`/editor/${project.id}`);
    } else {
      await page.exposeFunction("structureHost", async (input: unknown) => {
        const message = webviewMessageSchema.parse(input);
        const send = (message: unknown) =>
          page.evaluate((message) => window.postMessage(message, "*"), message);
        if (message.type === "ready") {
          await send({
            type: "document",
            text,
            version,
            name: "recovery.yml",
            dirty: false,
          });
          await send({
            type: "modules",
            modules: [
              {
                fqcn: "acme.demo.echo",
                label: "echo",
                category: "acme.demo",
                description: "Discovered module",
                parameters: {
                  message: { label: "message", type: "string", required: true },
                },
              },
              ...modules,
            ],
          });
        }
        if (message.type === "edit") {
          text = editedDocument(
            text,
            version,
            message.version,
            message.playbook,
          );
          version++;
          await send({
            type: "result",
            requestId: message.requestId,
            ok: true,
            version,
          });
        }
        if (message.type === "save" || message.type === "validate")
          await send({
            type: "result",
            requestId: message.requestId,
            ok: true,
            version,
          });
      });
      await page.addInitScript(() =>
        Object.assign(window, {
          acquireVsCodeApi: () => ({
            postMessage: (m: unknown) =>
              (
                window as unknown as {
                  structureHost(m: unknown): Promise<void>;
                }
              ).structureHost(m),
          }),
        }),
      );
      await page.goto("http://localhost:3101");
    }
    await page.getByRole("button", { name: /^Roles / }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await page.locator(".react-flow__node").first().click();
    await page
      .getByRole("textbox", { name: "Role name", exact: true })
      .fill("renamed_demo");
    await page.getByRole("button", { name: /^Tasks / }).click();
    await page
      .locator(".react-flow__node")
      .filter({ hasText: "Recoverable block" })
      .click();
    await page.getByRole("button", { name: /Edit rescue tasks/ }).click();
    await expect(page.locator(".react-flow__node")).toContainText(
      "Nested recovery",
    );
    await page.locator(".react-flow__node").click();
    await page.getByRole("button", { name: /Edit always tasks/ }).click();
    await page.locator(".react-flow__node").click();
    await page
      .getByRole("textbox", { name: "Task name", exact: true })
      .fill("Updated nested cleanup");
    await page.getByRole("button", { name: /^Tasks / }).click();
    await page.getByRole("button", { name: "Add apt", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Package name (name)", exact: true })
      .fill("nginx");
    await page
      .getByRole("button", { name: "Add replace", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "File path (path)", exact: true })
      .fill("/tmp/config");
    await page
      .getByRole("textbox", {
        name: "Regular expression (regexp)",
        exact: true,
      })
      .fill("before");
    await page.getByRole("button", { name: "Add ufw", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Rule (rule)", exact: true })
      .fill("allow");
    await page
      .getByRole("textbox", { name: "Port (port)", exact: true })
      .fill("80");
    if (surface === "vscode") {
      await page.getByRole("button", { name: "Add echo", exact: true }).click();
      await page
        .getByRole("textbox", { name: "message (message)", exact: true })
        .fill("discovered");
    }
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".save-status")).toHaveText(/Saved/);
    if (surface === "web") {
      const saved = await (
        await page.request.get(`/api/v1/projects/${projectId}`)
      ).json();
      text = generateYaml(saved.playbooks[0]);
      await page.reload();
      await page.getByRole("button", { name: /^Roles / }).click();
      await expect(page.locator(".react-flow__node").first()).toContainText(
        "renamed_demo",
      );
    }
    const play = parse(text)[0];
    expect(play.roles[0].role).toBe("renamed_demo");
    expect(play.tasks[0].rescue[0].always[0].name).toBe(
      "Updated nested cleanup",
    );
    expect(play.tasks.some((n: object) => "ansible.builtin.apt" in n)).toBe(
      true,
    );
    expect(play.tasks.some((n: object) => "community.general.ufw" in n)).toBe(
      true,
    );
    if (surface === "vscode")
      expect(play.tasks.at(-1)["acme.demo.echo"].message).toBe("discovered");
    expect(parsePlaybook(text).editable).toBe(true);
    await page.screenshot({
      path: `test-results/structures-${surface}.png`,
      fullPage: true,
    });
  });
}
