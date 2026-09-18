import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@visual-ansible\/(.+)$/,
        replacement: `${root}packages/$1/src/index.ts`,
      },
      { find: "@", replacement: `${root}apps/web` },
    ],
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
