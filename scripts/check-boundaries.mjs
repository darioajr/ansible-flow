import { readdir, readFile } from "node:fs/promises";
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries
        .filter((e) => !["node_modules", "dist"].includes(e.name))
        .map((e) =>
          e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
        ),
    )
  ).flat();
}
for (const file of await files("packages"))
  if (/\.[jt]sx?$/.test(file)) {
    const content = await readFile(file, "utf8");
    if (
      /(?:from\s*|import\s*\()['"](?:next(?:\/|['"])|vscode['"]|.*apps\/)/.test(
        content,
      )
    )
      throw new Error(`Platform API leaked into shared package: ${file}`);
  }
console.log("Shared package boundaries verified.");
