# Visual Ansible — Playbook Flow

**Visual automation. Real Ansible.**

Build, understand, and maintain Ansible playbooks with a visual editor inside VS Code. Open an existing YAML file, explore its tasks and recovery paths, and edit module arguments without leaving your workspace.

Your playbook stays a regular Ansible YAML file. Visual edits use VS Code's native document editing, saving, and undo/redo. Playbook Flow focuses on **authoring and validation**; it does not execute your automation.

[Source code](https://github.com/darioajr/ansible-flow) · [Report an issue](https://github.com/darioajr/ansible-flow/issues) · [Roadmap](https://github.com/darioajr/ansible-flow/blob/main/roadmap.md)

## Features

### Visual playbook editing

- **Task canvas:** add modules from the catalog, select tasks, and edit their properties.
- **Multiple plays:** switch between plays and configure target hosts, variables, and privilege escalation.
- **Task ordering:** connect tasks to change their sequence within the current scope.
- **Editing tools:** multi-selection, duplication, internal copy/paste, deletion, zoom, and minimap.
- **Readable properties:** entered values appear in bold, while placeholders use gray italic text. Play variables and module arguments have expandable JSON fields with bounded height.

### Ansible structures and recovery paths

- Separate scopes for **Pre-tasks**, **Roles**, **Tasks**, **Post-tasks**, and **Handlers**.
- Nested **block**, **rescue**, and **always** sequences.
- Task conditions (`when`), loops, registered results, tags, and handler notifications.
- Static role references and task-level `include_role` / `import_role` modules.

Connections represent Ansible task order. Conditions and recovery paths keep their Ansible semantics; the canvas does not introduce arbitrary branching or parallel execution.

### Module forms and discovery

The bundled catalog includes **20 modules**, covering common package, file, service, and command operations, plus tools such as `debug`, `set_fact`, `apt`, `replace`, and `community.general.ufw`.

Use the individual argument fields for everyday edits or **All arguments (JSON object)** for more complex values. In a trusted workspace, discover additional installed modules through `ansible-doc` and load their forms into the catalog.

### Native VS Code workflow

- Edit the actual workspace file, with native dirty state, save, and undo/redo.
- Switch to VS Code's text editor to change YAML directly; document changes update the visual editor.
- Inspect generated YAML in the built-in preview.
- View validation messages in VS Code's Problems panel and the visual editor.
- Work with local folders or a Remote SSH, WSL, or Dev Container Extension Host.

## Requirements

| Capability                             | Requirement                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| Visual editing and built-in validation | VS Code **1.96.0 or newer**, with a local or remote Node-based Extension Host |
| Ansible syntax checking                | `ansible-playbook` available in the active Extension Host                     |
| Ansible linting                        | `ansible-lint` available in the active Extension Host                         |
| Module discovery                       | `ansible-doc` available in the active Extension Host                          |
| External tool commands                 | A trusted workspace; external validation also requires a saved playbook       |

Docker, Podman, and a running Playbook Flow Web server are **not required** for the extension. Ansible is optional for visual editing and built-in validation. The extension does not install Ansible, roles, or collections for you.

## Getting started

### 1. Open a playbook

Open a workspace containing an Ansible playbook (`.yml` or `.yaml`), then choose one of these entry points:

- Right-click the file in Explorer → **Visual Ansible: Open Playbook Visually**.
- Use **Open With… → Visual Ansible Editor**.
- Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **Visual Ansible: Open Playbook Visually**.

You can also run **Visual Ansible: Create Playbook** to start a new file. The extension is opt-in and does not take over every YAML file in your workspace.

### 2. Configure the play and its tasks

1. Click the canvas background to open **Play properties**.
2. Set the target hosts, variables, and `become` option.
3. Add a module using the catalog's `+` button or drag it onto the canvas.
4. Select the task and edit its name, arguments, condition, or loop.
5. Use **Save** or VS Code's normal save command to persist the YAML.

JSON fields expect valid JSON: use double-quoted keys and strings. For example:

```json
{
  "app_name": "demo",
  "http_port": 8080,
  "enable_monitoring": true
}
```

### 3. Explore blocks and handlers

Select a block and use **Edit block tasks**, **Edit rescue tasks**, or **Edit always tasks** to open its sequences. Blocks can contain other blocks.

Add handlers in the **Handlers** scope, then reference their names in a task's **Notify handlers** field. Use the **Roles** scope to add role references; the role's internal files are not expanded into the canvas.

### 4. Edit YAML directly

Use **Open With… → Text Editor** when you want to edit the source. The visual editor follows changes to the document. Use **YAML preview** to inspect the generated representation. **Visual Ansible: Show Generated YAML** opens the current YAML document beside the visual editor.

If the file contains unsupported constructs, visual writes are disabled and the original content is preserved. Correct the reported content in the text editor before continuing visual edits.

## Try a playbook

Save this as `demo.yml` and open it with the visual editor:

```yaml
---
- name: Explore a recovery flow
  hosts: localhost
  vars:
    simulate_failure: false
  pre_tasks:
    - name: Announce the demonstration
      ansible.builtin.debug:
        msg: Starting the visual flow
  tasks:
    - name: Work with recovery
      block:
        - name: Simulate a health check
          ansible.builtin.debug:
            msg: Checking the application
          failed_when: simulate_failure | bool
        - name: Record a successful change
          ansible.builtin.debug:
            msg: Application is ready
          changed_when: true
          notify: Record completion
      rescue:
        - name: Describe the recovery action
          ansible.builtin.debug:
            msg: Restore the previous release
      always:
        - name: Close the maintenance window
          ansible.builtin.debug:
            msg: Verification finished
  handlers:
    - name: Record completion
      ansible.builtin.debug:
        msg: Change recorded
```

For a larger diagram, try the [complex flow example](https://github.com/darioajr/ansible-flow/blob/main/examples/fluxos-complexos.yml): **3 plays, 90 nodes, and 10 blocks**, including canary deployment, rollback, and auditing. Both examples use demonstration tasks; opening them never runs them.

## Validation

### Built-in checks

The default `core` mode checks the supported playbook model and available module metadata. It reports issues such as missing target hosts, required module arguments, invalid argument types, and unresolved handler references. Parser diagnostics include source locations where available.

Built-in checks do not replace Ansible's own validation or guarantee that a playbook will execute successfully.

### External checks

Save the file, select a validation tool in Settings, and run **Visual Ansible: Validate Playbook**:

```json
{
  "visualAnsible.validationTool": "syntax-check",
  "visualAnsible.ansiblePath": "ansible-playbook"
}
```

To use linting, set `visualAnsible.validationTool` to `ansible-lint` and configure `visualAnsible.lintPath` if necessary. External tools run in the active Extension Host, so a Remote SSH session uses tools installed on the remote machine, not on your desktop.

## Discover installed modules

1. Open a playbook in a trusted workspace.
2. Run **Visual Ansible: Discover Ansible Modules**.
3. Select up to **20 modules per operation** from the modules reported by `ansible-doc`.
4. Use the added forms in the module catalog.

Configure `visualAnsible.ansibleDocPath` when the executable is not on the Extension Host's `PATH`. Discovered metadata is shared by editors in that workspace for the current session. Run discovery again after restarting VS Code or changing installed collections.

## Commands

All commands are available through the Command Palette:

| Command                                      | Purpose                                                   |
| -------------------------------------------- | --------------------------------------------------------- |
| **Visual Ansible: Open Playbook Visually**   | Open an existing playbook in the visual editor            |
| **Visual Ansible: Create Playbook**          | Create a new playbook                                     |
| **Visual Ansible: Validate Playbook**        | Run built-in checks and the configured external validator |
| **Visual Ansible: Show Generated YAML**      | Inspect the YAML representation                           |
| **Visual Ansible: Refresh Playbooks**        | Refresh the playbook list in Explorer                     |
| **Visual Ansible: Discover Ansible Modules** | Load module metadata from `ansible-doc`                   |

## Extension settings

| Setting                        | Default            | Description                                                |
| ------------------------------ | ------------------ | ---------------------------------------------------------- |
| `visualAnsible.validationTool` | `core`             | Validation mode: `core`, `syntax-check`, or `ansible-lint` |
| `visualAnsible.ansiblePath`    | `ansible-playbook` | Executable used for syntax checking                        |
| `visualAnsible.lintPath`       | `ansible-lint`     | Executable used for linting                                |
| `visualAnsible.ansibleDocPath` | `ansible-doc`      | Executable used for module discovery                       |

External tool settings are restricted by Workspace Trust. Set executable paths in the settings appropriate to your local or remote environment.

## Troubleshooting

| Symptom                                                   | What to check                                                                                                                                        |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unsupported YAML construct — original file preserved**  | Review the reported line in the text editor. Aliases, explicit YAML tags, `import_playbook`, and other unsupported structures disable visual writes. |
| External checks are not configured                        | Choose `syntax-check` or `ansible-lint`, install the tool in the Extension Host, save the file, and run validation.                                  |
| Ansible executable cannot be found                        | Check the configured executable path in the active local or remote environment.                                                                      |
| A module is missing from the catalog                      | Install the relevant collection in your Ansible environment and run module discovery.                                                                |
| Changes conflict with another edit                        | Let the editor synchronize with the latest document, then reapply the intended change.                                                               |
| Commands appear twice after installing a development VSIX | Remove the old `playbook-flow.visual-ansible-extension` package before using `darioajr.visual-ansible-extension`.                                    |

## Current limitations

- Playbook execution, deployment monitoring, and AAP/AWX integration are not included.
- A browser-only Extension Host, such as standalone `vscode.dev`, is not supported.
- Role references are preserved, but role files are not expanded or installed.
- YAML aliases, explicit tags, `import_playbook`, and blocks inside handlers require the text editor.
- YAML formatting can be normalized when writing visual changes; byte-for-byte preservation is not promised.
- Node positions are recalculated when reopening a file. The extension does not create layout sidecar files.
- Module forms cover available metadata; conditional requirements and collection-specific behavior may need external Ansible validation.

See the [compatibility guide](https://github.com/darioajr/ansible-flow/blob/main/docs/ANSIBLE-COMPATIBILITY.md) for supported structures and the [roadmap](https://github.com/darioajr/ansible-flow/blob/main/roadmap.md) for planned features.

## Installing a local VSIX

If you are testing a build before publication, use **Extensions → … → Install from VSIX…** and select the generated package. For version `0.1.0`:

```bash
code --install-extension visual-ansible-extension-0.1.0.vsix --force
```

Build instructions and publishing requirements are available in the [project documentation](https://github.com/darioajr/ansible-flow/blob/main/README.md).

## Feedback and contributions

Report bugs and feature requests in [GitHub Issues](https://github.com/darioajr/ansible-flow/issues). Include your VS Code version, extension version, local or remote environment, and a minimal YAML example with sensitive information removed.

Contributions should preserve standard Ansible semantics and keep the shared Web/VS Code engine consistent. Start with the [development guide](https://github.com/darioajr/ansible-flow/blob/main/docs/DEVELOPMENT.md).

## License

Licensed under **Apache-2.0**. See `LICENSE` and `NOTICE` in the extension package. The previous MIT notice is retained in `LICENSE-MIT` for code originally distributed under those terms. Third-party libraries and assets retain their own licenses.
