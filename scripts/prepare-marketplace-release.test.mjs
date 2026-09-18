import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(
  new URL("prepare-marketplace-release.mjs", import.meta.url),
);
function prepare(overrides = {}, manifestOverrides = {}) {
  const cwd = mkdtempSync(path.join(tmpdir(), "marketplace-release-"));
  try {
    mkdirSync(path.join(cwd, "apps/vscode/extension"), { recursive: true });
    const manifest = {
      name: "visual-ansible-extension",
      publisher: "darioajr",
      version: "0.2.0",
      ...manifestOverrides,
    };
    const manifestPath = path.join(cwd, "apps/vscode/extension/package.json");
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const output = path.join(cwd, "outputs");
    writeFileSync(output, "");
    const result = spawnSync(process.execPath, [script], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: "push",
        GITHUB_REF: "refs/tags/v0.2.0",
        RELEASE_VERSION: "",
        GITHUB_REPOSITORY: "example/flow",
        GITHUB_OUTPUT: output,
        ...overrides,
      },
    });
    return {
      status: result.status,
      error: result.stderr,
      manifest: JSON.parse(readFileSync(manifestPath)),
      outputs: readFileSync(output, "utf8"),
    };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
test("tag packages the committed version and actual repository metadata", () => {
  const result = prepare();
  assert.equal(result.status, 0, result.error);
  assert.equal(result.manifest.version, "0.2.0");
  assert.equal(
    result.manifest.repository.url,
    "https://github.com/example/flow.git",
  );
  assert.equal(result.manifest.repository.directory, "apps/vscode/extension");
  assert.match(result.outputs, /vsix=visual-ansible-extension-0.2.0.vsix/);
});
test("manual packaging validates the explicit version", () => {
  assert.equal(
    prepare({
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_REF: "refs/heads/main",
      RELEASE_VERSION: "0.2.0",
    }).status,
    0,
  );
});
test("rejects version mismatch without rewriting the manifest", () => {
  const result = prepare({ GITHUB_REF: "refs/tags/v0.3.0" });
  assert.notEqual(result.status, 0);
  assert.equal(result.manifest.version, "0.2.0");
  assert.equal(result.manifest.repository, undefined);
  assert.equal(result.outputs, "");
});
test("rejects unsupported triggers, malformed tags and unsafe inputs", () => {
  for (const env of [
    { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_REF: "refs/heads/v0.2.0" },
    { GITHUB_REF: "refs/tags/v0.2.0-beta.1" },
    { GITHUB_REF: "refs/tags/v00.2.0" },
    {
      GITHUB_EVENT_NAME: "workflow_dispatch",
      RELEASE_VERSION: "0.2.0\nvsix=other",
    },
    { GITHUB_REPOSITORY: "owner/repo\ninvalid" },
  ])
    assert.notEqual(prepare(env).status, 0, JSON.stringify(env));
  assert.notEqual(prepare({}, { publisher: "other" }).status, 0);
});
