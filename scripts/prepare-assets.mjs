import { cp, mkdir } from "node:fs/promises";
await mkdir("apps/web/public/monaco", { recursive: true });
await cp("node_modules/monaco-editor/min/vs", "apps/web/public/monaco/vs", {
  recursive: true,
});
