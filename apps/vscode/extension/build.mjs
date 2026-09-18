import { build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";
await build({
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  sourcemap: true,
});
await mkdir("media", { recursive: true });
await cp("../webview/dist", "media", { recursive: true });
await cp("../../../node_modules/monaco-editor/min/vs", "media/monaco/vs", {
  recursive: true,
});
