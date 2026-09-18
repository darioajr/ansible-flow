import { test, expect } from "@playwright/test";
test("Web: create, configure, connect, save, reload and export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/projects");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill(`Web ${Date.now()}`);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .last()
    .click();
  await expect(page.getByRole("button", { name: "Export YAML" })).toBeVisible();
  await page.getByRole("textbox", { name: "Target hosts" }).fill("webservers");
  await page.getByLabel("Privilege escalation (become)").check();
  await page.getByRole("button", { name: "Add dnf", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Task name", exact: true })
    .fill("Install nginx");
  await page
    .getByRole("textbox", { name: "Package name (name)" })
    .fill("nginx");
  await page.getByRole("combobox", { name: "State (state)" }).fill("present");
  await page
    .getByRole("textbox", { name: "Condition (when)" })
    .fill('ansible_facts.os_family == "RedHat"');
  await page
    .getByRole("textbox", { name: "Register result" })
    .fill("nginx_result");
  await page.getByRole("button", { name: "Add service", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Task name", exact: true })
    .fill("Start nginx");
  await page
    .getByRole("textbox", { name: "Service name (name)" })
    .fill("nginx");
  await page.getByRole("combobox", { name: "State (state)" }).fill("started");
  await page
    .getByRole("combobox", { name: "Enable at boot (enabled)" })
    .selectOption("true");
  await page
    .locator(".react-flow__node")
    .filter({ hasText: "Install nginx" })
    .locator(".react-flow__handle-bottom")
    .dragTo(
      page
        .locator(".react-flow__node")
        .filter({ hasText: "Start nginx" })
        .locator(".react-flow__handle-top"),
    );
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await page.getByRole("button", { name: /^Handlers/ }).click();
  await page.getByRole("button", { name: "Add service", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Task name", exact: true })
    .fill("Restart nginx");
  await page
    .getByRole("textbox", { name: "Service name (name)" })
    .fill("nginx");
  await page.getByRole("combobox", { name: "State (state)" }).fill("restarted");
  await page.getByRole("button", { name: /^Tasks/ }).click();
  await page
    .locator(".react-flow__node")
    .filter({ hasText: "Install nginx" })
    .click();
  await page
    .getByRole("textbox", { name: "Notify handlers" })
    .fill("Restart nginx");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText(/Saved/);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(page.getByText("No AIR validation problems.")).toBeVisible();
  await page.getByRole("button", { name: "YAML preview", exact: true }).click();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export YAML" }).click();
  const download = await event;
  const stream = await download.createReadStream();
  let yaml = "";
  for await (const chunk of stream!) yaml += chunk.toString();
  expect(yaml).toContain("hosts: webservers");
  expect(yaml).toContain("Restart nginx");
  expect(yaml).toContain("register: nginx_result");
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/web-editor.png",
    fullPage: true,
  });
});
test("Web: drag, nested blocks, multi-select, clipboard, history and import", async ({
  page,
}) => {
  const p = await (
    await page.request.post("/api/v1/projects", {
      data: { name: `History ${Date.now()}` },
    })
  ).json();
  await page.goto(`/editor/${p.id}`);
  const item = page.locator(".catalog-item").filter({
    has: page.getByRole("button", { name: "Add debug", exact: true }),
  });
  await item.dragTo(page.locator(".flow-canvas"));
  await page.getByRole("button", { name: "Add debug", exact: true }).click();
  const nodes = page.locator(".react-flow__node");
  await nodes.first().click();
  await nodes.nth(1).click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+v");
  await expect(nodes).toHaveCount(4);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(nodes).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(nodes).toHaveCount(4);
  await page.getByRole("button", { name: "Add Block", exact: true }).click();
  await page.getByRole("button", { name: /Edit block tasks/ }).click();
  await page.getByRole("button", { name: "Add debug", exact: true }).click();
  await page.getByRole("textbox", { name: "Message (msg)" }).fill("Nested");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText(/Saved/);
  const saved = await (
    await page.request.get(`/api/v1/projects/${p.id}`)
  ).json();
  expect(saved.playbooks[0].plays[0].tasks[4].children[0].module.args.msg).toBe(
    "Nested",
  );
  await page.goto("/projects");
  await page.locator("input[type=file]").setInputFiles({
    name: "imported.yml",
    mimeType: "application/yaml",
    buffer: Buffer.from(
      "- hosts: all\n  tasks:\n    - name: Imported task\n      debug: {msg: hello}\n",
    ),
  });
  await expect(page.locator(".react-flow__node")).toHaveText(/Imported task/);
});
test("Web flushes pending edits before navigating away", async ({ page }) => {
  const p = await (
    await page.request.post("/api/v1/projects", {
      data: { name: `Navigation ${Date.now()}` },
    })
  ).json();
  await page.goto(`/editor/${p.id}`);
  await page.getByRole("textbox", { name: "Target hosts" }).fill("staging");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  expect(
    (await (await page.request.get(`/api/v1/projects/${p.id}`)).json())
      .playbooks[0].plays[0].hosts,
  ).toBe("staging");
});
