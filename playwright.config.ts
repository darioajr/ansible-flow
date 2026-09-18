import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1600, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "pnpm prepare:assets && pnpm --filter @visual-ansible/web dev --port 3100",
      url: "http://localhost:3100/api/health",
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
      env: { DATA_DIR: path.join(tmpdir(), "visual-ansible-e2e") },
    },
    {
      command: "pnpm --filter @visual-ansible/webview dev --port 3101",
      url: "http://localhost:3101",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});
