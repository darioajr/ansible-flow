import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const manifestPath = "apps/vscode/extension/package.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const {
  GITHUB_EVENT_NAME: event,
  GITHUB_REF: ref,
  RELEASE_VERSION: requested,
  GITHUB_REPOSITORY: repository,
} = process.env;
const version =
  event === "push" && ref?.startsWith("refs/tags/v")
    ? ref.slice("refs/tags/v".length)
    : event === "workflow_dispatch"
      ? requested
      : undefined;
if (!version || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
  throw new Error(
    "Use a stable version X.Y.Z, via tag vX.Y.Z or workflow_dispatch version.",
  );
}
if (version !== manifest.version) {
  throw new Error(
    `Release ${version} does not match extension manifest ${manifest.version}. Commit the version change before releasing.`,
  );
}
if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  throw new Error(
    "GITHUB_REPOSITORY must identify the destination owner/repository.",
  );
}
if (manifest.publisher !== "darioajr") {
  throw new Error("Expected Marketplace publisher darioajr.");
}
const url = `https://github.com/${repository}`;
manifest.repository = {
  type: "git",
  url: `${url}.git`,
  directory: "apps/vscode/extension",
};
manifest.homepage = `${url}#readme`;
manifest.bugs = { url: `${url}/issues` };
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `version=${version}\nvsix=visual-ansible-extension-${version}.vsix\n`,
  );
}
console.log(
  `Release validated: ${manifest.publisher}.${manifest.name}@${version}`,
);
