# Visual Ansible — Playbook Flow

Visual Ansible playbook editing with PatternFly and React Flow. This extension shares its AIR, parser, generator, validator and editor with the Playbook Flow Web application.

Open a workspace and run **Visual Ansible: Open Playbook Visually**, or choose **Open With → Visual Ansible Editor** on a YAML file. Supported playbooks render as tasks with editable module arguments, conditions, loops, blocks and handlers.

Edits use native WorkspaceEdit, dirty state, save and undo/redo. The original YAML remains portable Ansible. Unsupported constructs are reported and visual writes are disabled, preserving the file.

Commands: Open Playbook Visually, Create Playbook, Validate Playbook, Show Generated YAML, Refresh Playbooks.

Validation defaults to shared core rules. To use external checks, set `visualAnsible.validationTool` to `syntax-check` or `ansible-lint`. Install the selected binary in the active Extension Host (local or Remote SSH, WSL, Dev Container). External commands require Workspace Trust and a saved file. Opening a playbook never executes automation.

This release targets VS Code Desktop and Remote Development, not a browser-only extension host. Roles, pre/post tasks and nested block/rescue/always are supported. Aliases, import_playbook and unsupported YAML tags still require the text editor. Node positions are computed on reopen; no sidecar files are created.

Run **Visual Ansible: Discover Ansible Modules** in a trusted workspace to load forms from ansible-doc in the active Extension Host. Configure `visualAnsible.ansibleDocPath` if needed. Select up to 20 modules at a time; metadata remains in memory for this workspace during the session.

## License

Apache-2.0. See LICENSE and NOTICE in the extension package. The previous MIT notice is retained in LICENSE-MIT for code originally distributed under those terms. Third-party components retain their own licenses.
