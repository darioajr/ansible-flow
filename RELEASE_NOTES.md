# Playbook Flow 0.1.2

This release improves block navigation and fixes task selection in the visual editor, both in the Web application and the VS Code extension.

## What's new

- **Navigate up one level:** the **← Back** button appears when you enter a block and returns you to its parent scope, including nested blocks and `rescue` and `always` sequences.
- **Keep context when going back:** the block you exit remains selected, with its properties open so you can continue editing.

## Fixes

- **Properties for tasks inside blocks:** fixed an issue where clicking **Open block** left the previous block selected and prevented properties from appearing for tasks inside it. These tasks can now be selected and edited normally.
- **Version displayed in the Web interface:** the footer now reads the version from the root `package.json`, matching the version used to publish the Docker image. The hardcoded `Web + VS Code · v0.2` label now uses the project version: `v0.1.2` for this release.

## Validation

- UI tests for the Web application and VS Code Webview cover selecting, editing, and saving tasks inside blocks, as well as navigating back between levels.
- Navigation tests cover nested blocks, `rescue`, `always`, pre-tasks, and post-tasks.
- Lint and TypeScript checks passed.

## Updating

- **VS Code:** update the extension to version 0.1.2 or install the corresponding VSIX when available.
- **Web with Docker:** update the image to version 0.1.2 when available and recreate the container, keeping the existing data volume.

This release does not require any changes to your playbooks.

Code comparison: [v0.1.1 → v0.1.2](https://github.com/darioajr/ansible-flow/compare/v0.1.1...v0.1.2).
