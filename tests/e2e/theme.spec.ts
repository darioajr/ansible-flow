import { test, expect, type Page } from "@playwright/test";

async function palette(page: Page) {
  return page.locator(".properties").evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    text: getComputedStyle(el).color,
  }));
}

test("Web: PatternFly theme follows system, persists choice and themes Monaco", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const project = await (
    await page.request.post("/api/v1/projects", {
      data: { name: "Theme check" },
    })
  ).json();
  await page.goto(`/editor/${project.id}`);
  await expect(page.locator("html")).toHaveClass(/pf-v6-theme-dark/);
  const dark = await palette(page);
  await page.getByRole("button", { name: "YAML editor", exact: true }).click();
  await expect(page.locator(".monaco-editor.vs-dark").first()).toBeVisible();
  await page.getByLabel("Color theme").selectOption("light");
  await expect(page.locator("html")).not.toHaveClass(/pf-v6-theme-dark/);
  await expect(page.locator(".monaco-editor.vs").first()).toBeVisible();
  await page.getByRole("button", { name: "YAML editor", exact: true }).click();
  const light = await palette(page);
  expect(light.background).not.toBe(dark.background);
  expect(light.text).not.toBe(dark.text);
  await page.reload();
  await expect(page.getByLabel("Color theme")).toHaveValue("light");
  await expect(page.locator("html")).not.toHaveClass(/pf-v6-theme-dark/);
  await page.getByLabel("Color theme").selectOption("system");
  await expect(page.locator("html")).toHaveClass(/pf-v6-theme-dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/pf-v6-theme-dark/);
  await page.getByRole("button", { name: "Add file", exact: true }).click();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/theme-light.png",
  });
  await page.getByLabel("Color theme").selectOption("dark");
  await expect(page.locator(".react-flow.dark")).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/theme-dark.png",
  });
});

test("VS Code: changes in the window theme update PatternFly and the canvas", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, {
      acquireVsCodeApi: () => ({
        postMessage(message: { type: string }) {
          if (message.type === "ready") {
            document.body.className = "vscode-dark";
            window.postMessage(
              {
                type: "document",
                text: "- hosts: localhost\n  tasks:\n    - name: Theme task\n      debug: {msg: hello}\n",
                version: 1,
                name: "theme.yml",
                dirty: false,
              },
              "*",
            );
          }
        },
      }),
    });
  });
  // The production host supplies Monaco assets; serve them from the test Web server.
  await page.route("http://localhost:3101/monaco/**", async (route) => {
    const response = await page.request.get(
      route.request().url().replace(":3101/", ":3100/"),
    );
    await route.fulfill({ response });
  });
  await page.goto("http://localhost:3101");
  await expect(page.locator(".react-flow.dark")).toBeVisible();
  const dark = await palette(page);
  await page.getByRole("button", { name: "YAML preview", exact: true }).click();
  await expect(page.locator(".monaco-editor.vs-dark").first()).toBeVisible();
  await page.evaluate(() => {
    document.body.className = "vscode-light";
  });
  await expect(page.locator("html")).not.toHaveClass(/pf-v6-theme-dark/);
  await expect(page.locator(".react-flow.light")).toBeVisible();
  await expect(page.locator(".monaco-editor.vs").first()).toBeVisible();
  await page.getByRole("button", { name: "YAML preview", exact: true }).click();
  expect((await palette(page)).background).not.toBe(dark.background);
  await page.evaluate(() => {
    document.body.className = "vscode-high-contrast";
  });
  await expect(page.locator("html")).toHaveClass(/pf-v6-theme-dark/);
  await page.evaluate(() => {
    document.body.className = "vscode-high-contrast-light";
  });
  await expect(page.locator("html")).not.toHaveClass(/pf-v6-theme-dark/);
});
