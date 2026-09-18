# Visual Ansible — Playbook Flow

Visual Ansible playbook editing with PatternFly and React Flow. This extension shares its AIR, parser, generator, validator and editor with the Playbook Flow Web application.

Open a workspace and run **Visual Ansible: Open Playbook Visually**, or choose **Open With → Visual Ansible Editor** on a YAML file. Supported playbooks render as tasks with editable module arguments, conditions, loops, blocks and handlers.

Edits use native WorkspaceEdit, dirty state, save and undo/redo. The original YAML remains portable Ansible. Unsupported constructs are reported and visual writes are disabled, preserving the file.

Commands: Open Playbook Visually, Create Playbook, Validate Playbook, Show Generated YAML, Refresh Playbooks.

Validation defaults to shared core rules. To use external checks, set `visualAnsible.validationTool` to `syntax-check` or `ansible-lint`. Install the selected binary in the active Extension Host (local or Remote SSH, WSL, Dev Container). External commands require Workspace Trust and a saved file. Opening a playbook never executes automation.

This release targets VS Code Desktop and Remote Development, not a browser-only extension host. Roles, rescue/always, aliases and unsupported YAML tags require the text editor. Node positions are computed on reopen; no sidecar files are created.
