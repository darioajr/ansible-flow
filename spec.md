# SPEC.md — Visual Ansible Builder

> **Working title:** Playbook Flow  
> **Status:** Draft v2.0  
> **Primary web stack:** Next.js + TypeScript + PatternFly + React Flow  
> **VS Code stack:** TypeScript Extension Host + React/Vite Webview + PatternFly + React Flow  
> **Shared architecture:** Monorepo with reusable AIR, parser, generator, validator and visual editor packages  
> **Target runtime:** Browser, VS Code Desktop/Remote, containers, Kubernetes and OpenShift  
> **Future distribution:** VS Code Marketplace + Kubernetes/OpenShift Operator via OLM

---

# 1. Vision

Build a visual low-code authoring platform for Ansible where users create automation by dragging, connecting and configuring visual blocks instead of writing YAML manually.

The product must support **multiple user surfaces backed by the same core engine**:

1. **Web Platform**
   - Next.js
   - PatternFly
   - React Flow
   - Multi-user and collaboration capabilities
   - Git integration
   - Execution, governance and platform features
   - Deployable on Kubernetes and OpenShift
   - Future installation through an Operator

2. **VS Code Extension**
   - Native VS Code extension shell
   - React/Vite Webview
   - PatternFly
   - React Flow
   - Direct workspace integration
   - Open existing `playbook.yml` files visually
   - Save visual changes back to standard Ansible YAML
   - Local or remote validation using the active VS Code environment

Both surfaces must reuse the same:

```text
AIR
Parser
Generator
Validator
Module metadata model
Visual editor components
Graph behavior
```

The Web application and VS Code extension are **different shells around the same product engine**.

The application must generate standard, readable and maintainable Ansible content.

The platform is **not intended to replace Ansible Automation Platform, AWX, Ansible CLI or VS Code**.

Its purpose is to provide a visual authoring layer for Ansible.

Long-term capabilities:

- Visual creation of playbooks.
- Import existing YAML playbooks.
- Convert YAML into a visual graph.
- Bidirectional YAML ↔ visual model synchronization.
- Support Ansible modules and collections.
- Validate playbooks.
- Integrate with Git.
- Work directly inside VS Code workspaces.
- Execute automation through Ansible Runner.
- Integrate with AWX / Red Hat Ansible Automation Platform.
- Run on Kubernetes and OpenShift.
- Be installable and managed by an Operator.
- Publish the developer experience as a VS Code extension.

---

# 2. Product Principles

## 2.1 Standard Ansible output

Generated automation must remain valid Ansible.

A generated project must be runnable without this platform:

```bash
ansible-playbook playbook.yml
```

The product must never require a proprietary runtime for generated playbooks.

---

## 2.2 Git-first

All generated YAML must be:

- deterministic;
- readable;
- stable between saves;
- compatible with Git;
- easy to review through pull requests.

The system must avoid unnecessary formatting changes.

---

## 2.3 Visual authoring is separate from execution

The canvas represents automation structure.

Execution jobs, logs, credentials and inventories are separate domain objects.

---

## 2.4 Open standards

Prefer:

- YAML
- JSON
- JSON Schema
- OpenAPI
- Git
- OCI containers
- Kubernetes APIs
- Ansible Collections
- Ansible Runner

---

## 2.5 OpenShift-ready

The application must:

- run as non-root;
- support arbitrary OpenShift UID;
- avoid privileged containers;
- avoid writing to the root filesystem;
- support read-only filesystem where practical;
- consume configuration through environment variables;
- consume sensitive configuration through Secrets;
- support Kubernetes Ingress;
- support OpenShift Route.


---

## 2.6 Multi-surface architecture

The visual editor must not depend directly on Next.js or VS Code APIs.

The following layers must remain reusable:

```text
Visual Editor
AIR
Ansible Parser
Ansible Generator
Validation Rules
Module Metadata
```

Platform-specific integrations belong in adapters:

```text
Web Adapter
VS Code Adapter
Git Adapter
Execution Adapter
AAP Adapter
```

---

## 2.7 VS Code is a first-class client, not the product backend

The VS Code extension should remain thin.

It is responsible for:

- discovering Ansible files in the active workspace;
- opening visual editors;
- reading and writing workspace files;
- invoking local/remote CLI tools;
- interacting with VS Code Git and commands where appropriate;
- sending messages between Extension Host and Webview.

It must not contain duplicated business rules already available in shared packages.

---

## 2.8 Web remains the platform surface

The Next.js application is the primary surface for capabilities that naturally require a shared platform:

- team collaboration;
- RBAC;
- centralized projects;
- audit history;
- credentials;
- execution history;
- AAP/AWX integration;
- shared inventories;
- shared Git connections;
- OpenShift deployment;
- Operator-managed lifecycle.

---

# 3. Target Users

Primary users:

- DevOps engineers
- SREs
- Platform engineers
- Infrastructure engineers
- System administrators
- Consultants
- Ansible beginners

Secondary users:

- Security engineers
- Cloud engineers
- Network engineers
- Developers
- Architects
- Automation teams

---

# 4. Main User Experience

The application should resemble Node-RED, n8n or a modern workflow editor.

Example:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Project: Configure Web Server     Save   Validate   Export   Run            │
├────────────────┬──────────────────────────────────┬──────────────────────────┤
│ Module Catalog │                                  │ Properties               │
│                │                                  │                          │
│ Search...      │        ┌───────────────┐         │ ansible.builtin.dnf      │
│                │        │ Install nginx │         │                          │
│ builtin        │        │ dnf           │         │ name: nginx              │
│ cloud          │        └───────┬───────┘         │ state: present           │
│ kubernetes     │                │                 │                          │
│ network        │                ▼                 │ when: ...                │
│ custom         │        ┌───────────────┐         │ register: ...            │
│                │        │ Start nginx   │         │                          │
│                │        │ service       │         │ [YAML Preview]           │
│                │        └───────────────┘         │                          │
├────────────────┴──────────────────────────────────┴──────────────────────────┤
│ Problems | Validation | Execution Output | Logs                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 5. Technology Stack

## 5.1 Monorepo

Use a JavaScript/TypeScript monorepo.

Recommended:

```text
pnpm workspaces
Turborepo
```

The architecture must allow web and VS Code clients to reuse the same packages.

---

## 5.2 Web Frontend

Required:

- Next.js
- App Router
- TypeScript
- React
- PatternFly 6
- `@patternfly/react-core`
- `@patternfly/react-icons`
- `@patternfly/react-code-editor`
- `@patternfly/react-table`
- React Flow / `@xyflow/react`
- Zustand
- Zod
- React Hook Form

Do not introduce Tailwind unless a concrete requirement cannot be implemented cleanly with PatternFly.

PatternFly must be the primary design system.

---

## 5.3 VS Code Extension

Required:

- TypeScript
- VS Code Extension API
- Extension Host
- Custom Editor or Webview Panel
- message passing between Extension Host and Webview
- workspace filesystem APIs
- workspace configuration APIs
- command registration
- diagnostics integration

The extension should support, where possible:

```text
VS Code Desktop
Remote SSH
Dev Containers
WSL
Codespaces-compatible architecture
```

The first supported release may target VS Code Desktop and Remote Development before VS Code Web.

---

## 5.4 VS Code Webview

Use:

- React
- Vite
- PatternFly 6
- React Flow / `@xyflow/react`
- Zustand
- Zod

Do not run Next.js inside the VS Code Webview.

The Webview is a client application bundled specifically for VS Code.

---

## 5.5 Visual Canvas

Use:

```text
@xyflow/react
```

React Flow will handle:

- nodes;
- edges;
- drag and drop;
- selection;
- zoom;
- pan;
- minimap;
- node handles;
- graph positioning.

Custom nodes must visually follow PatternFly.

---

## 5.6 Shared Core Packages

At minimum create reusable packages for:

```text
@visual-ansible/air
@visual-ansible/editor
@visual-ansible/parser
@visual-ansible/generator
@visual-ansible/validator
@visual-ansible/module-metadata
@visual-ansible/schemas
```

These packages must not import:

```text
next/*
vscode
```

unless the package is explicitly a platform adapter.

---

# 6. UI Design System

Use PatternFly wherever possible.

Preferred PatternFly components:

- Page
- Masthead
- Nav
- Toolbar
- Drawer
- Tabs
- Form
- FormGroup
- TextInput
- Select
- Checkbox
- NumberInput
- Modal
- Alert
- AlertGroup
- EmptyState
- Spinner
- Label
- Tooltip
- Popover
- Card
- TreeView
- Table
- CodeEditor
- ClipboardCopy
- Wizard
- Progress
- LogViewer

Do not rebuild generic controls manually.

---

# 7. Application Shell

Use PatternFly `Page`.

Structure:

```text
Page
├── Masthead
├── Sidebar
│   └── Nav
└── Main
```

Primary navigation:

```text
Projects
Collections
Executions
Settings
About
```

MVP navigation:

```text
Projects
Settings
About
```

---

# 8. Editor Layout

Recommended editor layout:

```text
PageSection
└── Editor
    ├── Toolbar
    ├── Left Panel
    │   └── Module Catalog
    ├── Canvas
    │   └── React Flow
    ├── Right Panel
    │   ├── Properties
    │   └── YAML Preview
    └── Bottom Panel
        ├── Validation
        ├── Problems
        └── Output
```

---

# 8.1 VS Code User Experience

The VS Code extension should allow:

```text
playbook.yml
   ↓
Open With...
   ↓
Visual Ansible Editor
```

or through the command palette:

```text
Visual Ansible: Open Playbook Visually
Visual Ansible: Create Playbook
Visual Ansible: Validate Playbook
Visual Ansible: Show Generated YAML
```

Recommended workspace view:

```text
Visual Ansible
├── Playbooks
├── Roles
├── Inventories
├── Collections
└── Validation
```

Example editor:

```text
┌─────────────────────────────────────────────────────────────┐
│ VS Code                                                     │
├───────────────┬──────────────────────────┬──────────────────┤
│ Explorer      │ Visual Ansible Canvas    │ Properties       │
│               │                          │                  │
│ site.yml      │ [dnf] → [template]       │ module: dnf      │
│ deploy.yml    │            │             │ name: nginx      │
│ roles/        │            └→ [handler]  │ state: present   │
│ inventory/    │                          │                  │
└───────────────┴──────────────────────────┴──────────────────┘
```

The Webview must use PatternFly for application controls and React Flow for the graph.

---

# 8.2 VS Code File Synchronization

The extension must support:

```text
YAML file
   ↓
shared parser
   ↓
AIR
   ↓
shared visual editor
```

When visual changes are saved:

```text
visual editor
   ↓
AIR
   ↓
shared generator
   ↓
workspace edit
   ↓
playbook.yml
```

The YAML file remains the source artifact in the developer workflow.

The extension should support dirty-state behavior and integrate with standard VS Code save semantics.

---

# 8.3 VS Code Execution Context

The extension must determine where Ansible tooling is available.

Possible contexts:

```text
Local Desktop
Remote SSH
WSL
Dev Container
Codespace
```

Commands such as:

```text
ansible-doc
ansible-lint
ansible-playbook
```

must execute in the active Extension Host environment, not blindly on the user's local machine.

The implementation must abstract command execution behind an interface.

Example:

```ts
interface AnsibleCommandRunner {
  execute(command: string, args: string[]): Promise<CommandResult>;
}
```

---

# 8.4 VS Code Web Limitations

Do not assume Node.js process access is always available.

For a future browser-based extension running on `vscode.dev`, features depending on local binaries may be unavailable or delegated to a remote service.

The architecture must therefore keep:

```text
visual editing
AIR transformations
YAML parsing
YAML generation
```

separate from:

```text
local CLI execution
filesystem-specific integrations
container execution
```

---

# 9. Core Domain Model

The application must not store the React Flow representation as the canonical domain model.

Create an intermediate representation.

Example:

```ts
interface AutomationProject {
  id: string;
  name: string;
  description?: string;
  playbooks: Playbook[];
}

interface Playbook {
  id: string;
  name: string;
  plays: Play[];
}

interface Play {
  id: string;
  name: string;
  hosts: string;
  become?: boolean;
  vars?: Record<string, unknown>;
  tasks: AutomationNode[];
  handlers?: AutomationNode[];
}

interface AutomationNode {
  id: string;
  type: AutomationNodeType;
  name: string;
  module?: ModuleInvocation;
  condition?: ConditionConfig;
  loop?: LoopConfig;
  register?: string;
  tags?: string[];
  children?: AutomationNode[];
}
```

The internal representation should be called:

```text
Automation Intermediate Representation
AIR
```

Flow:

```text
Visual Canvas
     ↓
    AIR
   ↙   ↘
YAML   JSON
```

---

# 10. Node Types

Initial node types:

```text
PLAY
TASK
MODULE
BLOCK
RESCUE
ALWAYS
CONDITION
LOOP
ROLE
INCLUDE_ROLE
IMPORT_ROLE
HANDLER
SET_FACT
DEBUG
PAUSE
WAIT_FOR
META
```

MVP must implement:

```text
TASK
MODULE
BLOCK
CONDITION
LOOP
HANDLER
```

---

# 11. Module Catalog

The platform must support Ansible module discovery.

Example:

```text
Ansible Modules
├── ansible.builtin
│   ├── command
│   ├── shell
│   ├── copy
│   ├── file
│   ├── template
│   ├── service
│   ├── systemd_service
│   ├── dnf
│   ├── package
│   ├── user
│   ├── group
│   ├── uri
│   └── debug
│
├── community.general
├── kubernetes.core
├── amazon.aws
├── azure.azcollection
└── custom collections
```

Module metadata should eventually come from:

```bash
ansible-doc --json
```

Do not hard-code module forms permanently.

---

# 12. Initial MVP Modules

Support at least:

```text
ansible.builtin.command
ansible.builtin.shell
ansible.builtin.copy
ansible.builtin.file
ansible.builtin.template
ansible.builtin.service
ansible.builtin.systemd_service
ansible.builtin.dnf
ansible.builtin.package
ansible.builtin.user
ansible.builtin.group
ansible.builtin.uri
ansible.builtin.debug
ansible.builtin.set_fact
ansible.builtin.wait_for
```

---

# 13. Module Properties

Each module node must display:

```text
Name
Module
Arguments
when
loop
register
tags
become
ignore_errors
changed_when
failed_when
notify
delegate_to
run_once
environment
```

The properties form must dynamically adapt to module metadata.

---

# 14. Drag and Drop

User workflow:

```text
Catalog
   ↓ drag
Canvas
   ↓
Configure properties
   ↓
Connect nodes
   ↓
Generate YAML
```

Users must be able to:

- drag module to canvas;
- move nodes;
- connect nodes;
- delete nodes;
- duplicate nodes;
- copy/paste nodes;
- multi-select nodes;
- undo;
- redo.

---

# 15. Connections

Edges indicate logical ordering.

Example:

```text
[Install package]
       ↓
[Configure file]
       ↓
[Start service]
```

Conditional path:

```text
[Check OS]
   ├── RedHat → [dnf]
   └── Debian → [apt]
```

The visual graph must eventually support branching.

---

# 16. YAML Generator

The application must convert AIR into valid Ansible YAML.

Example visual graph:

```text
Install nginx
     ↓
Start nginx
```

Expected output:

```yaml
- name: Configure web server
  hosts: webservers
  become: true

  tasks:
    - name: Install nginx
      ansible.builtin.dnf:
        name: nginx
        state: present

    - name: Start nginx
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true
```

Generated YAML should use fully-qualified collection names.

Correct:

```yaml
ansible.builtin.dnf:
```

Avoid:

```yaml
dnf:
```

---

# 17. YAML Preview

The editor must include a real-time YAML preview.

Use PatternFly CodeEditor.

Features:

- read-only by default;
- syntax highlighting;
- copy;
- download;
- formatting;
- validation indicators.

Later versions may enable YAML editing.

---

# 18. Bidirectional Editing

Long-term goal:

```text
Visual → AIR → YAML
YAML → Parser → AIR → Visual
```

The AIR model is essential to support this.

Never attempt direct React Flow → YAML transformation as the permanent architecture.

---

# 19. YAML Import

Users must be able to:

```text
Import playbook.yml
```

Pipeline:

```text
YAML
 ↓
Parser
 ↓
Ansible AST
 ↓
AIR
 ↓
Graph Layout
 ↓
React Flow
```

Unsupported constructs should not fail silently.

Show:

```text
Unsupported YAML construct
```

and preserve the original content whenever possible.

---

# 20. Validation Pipeline

Validation should support several levels.

```text
AIR validation
     ↓
YAML generation
     ↓
YAML syntax validation
     ↓
ansible-playbook --syntax-check
     ↓
ansible-lint
```

Results appear in:

```text
Problems Panel
```

Example:

```text
ERROR   task "Install nginx"
Module parameter "statex" does not exist

WARNING task "Run command"
Prefer command module over shell when shell features are unnecessary
```

---

# 21. Ansible Execution

Execution is NOT required for initial MVP.

Later architecture:

```text
UI
 ↓
API
 ↓
Execution Service
 ↓
Ansible Runner
 ↓
Execution Environment
 ↓
Target Hosts
```

Recommended execution technology:

```text
ansible-runner
```

---

# 22. Execution Environments

Future support for Ansible Execution Environments.

Example:

```text
EE:
registry.redhat.io/ansible-automation-platform-25/ee-supported-rhel9
```

Users may eventually choose an EE per project.

---

# 23. Inventory

Future inventory editor:

```text
Inventory
├── Groups
│   ├── web
│   ├── database
│   └── production
└── Hosts
    ├── server01
    └── server02
```

The system should support:

- static inventory;
- YAML inventory;
- INI inventory;
- dynamic inventory plugins.

---

# 24. Variables

Provide a variable manager.

```text
Variables
├── Project
├── Playbook
├── Play
├── Group
├── Host
└── Task
```

Sensitive values must not be stored as plain text.

---

# 25. Secrets

Future integrations:

- Kubernetes Secrets
- OpenShift Secrets
- HashiCorp Vault
- Ansible Vault
- Red Hat AAP Credentials

Never expose secrets inside generated visual graph exports.

---

# 26. Git Integration

Git integration is a major feature.

Future workflow:

```text
Visual Editor
    ↓
Generate YAML
    ↓
Commit
    ↓
Git Repository
    ↓
Pull Request
```

Initial supported operations:

- clone repository;
- detect project;
- open playbook;
- save changes;
- show diff;
- commit;
- push.

Later:

- branch creation;
- pull requests;
- GitHub;
- GitLab;
- Bitbucket.

---

# 27. Project Structure

A project may follow:

```text
project/
├── playbooks/
│   └── site.yml
├── roles/
├── inventories/
│   ├── dev/
│   └── prod/
├── group_vars/
├── host_vars/
├── collections/
│   └── requirements.yml
├── requirements.yml
└── ansible.cfg
```

---

# 28. Project Persistence

Initial entities:

```text
User
Project
Playbook
Play
Node
Edge
ProjectVersion
Execution
```

Suggested Prisma model direction:

```text
Project
 ├── Playbooks
 │    ├── Plays
 │    │    ├── Nodes
 │    │    └── Edges
 │    └── Versions
 └── Executions
```

---

# 29. API

All APIs should be versioned:

```text
/api/v1
```

Examples:

```text
GET    /api/v1/projects
POST   /api/v1/projects

GET    /api/v1/projects/:id
PUT    /api/v1/projects/:id
DELETE /api/v1/projects/:id

GET    /api/v1/projects/:id/playbooks
POST   /api/v1/projects/:id/playbooks

POST   /api/v1/playbooks/:id/generate
POST   /api/v1/playbooks/:id/validate
POST   /api/v1/playbooks/import

GET    /api/v1/modules
GET    /api/v1/modules/:fqcn
```

---

# 30. Next.js Architecture

Use App Router.

Server Components should be preferred for:

- project lists;
- project metadata;
- configuration pages;
- static content.

Client Components are required for:

- React Flow;
- drag and drop;
- node editor;
- YAML live preview;
- keyboard shortcuts;
- editor state.

Recommended boundary:

```text
Server Component
     ↓
Editor Bootstrap Data
     ↓
<ClientAutomationEditor />
```

---

# 30.1 Shared Editor Architecture

The visual editor must be implemented once and consumed by:

```text
apps/web
apps/vscode/webview
```

Example dependency graph:

```text
                   @visual-ansible/editor
                         │
            ┌────────────┴────────────┐
            │                         │
       Next.js Web               VS Code Webview
```

The shared editor may accept platform capabilities as dependencies.

Example:

```ts
interface EditorHost {
  save(content: string): Promise<void>;
  load(): Promise<string>;
  validate?(content: string): Promise<ValidationResult>;
  showNotification(message: string): void;
}
```

Web and VS Code provide separate implementations.

---

# 30.2 Platform Adapter Pattern

Use ports and adapters.

```text
                  Shared Domain
                      AIR
                       │
          ┌────────────┼────────────┐
          │            │            │
       Parser      Generator     Validator
          │            │            │
          └────────────┼────────────┘
                       │
                 Application Core
                       │
            ┌──────────┴──────────┐
            │                     │
        Web Adapter          VS Code Adapter
```

Platform APIs must never leak into AIR.

---

# 30.3 Git as Integration Boundary

Git should be the preferred bridge between developer tooling and the centralized platform.

Recommended workflow:

```text
VS Code Extension
      ↓
playbook.yml
      ↓
Git commit / push
      ↓
Repository
      ↓
Web Platform / AAP
```

This keeps the generated automation portable and auditable.

---

# 31. Backend Architecture

MVP can use Next.js Route Handlers.

However, business logic must not live inside route handlers.

Architecture:

```text
Route Handler
     ↓
Application Service
     ↓
Domain
     ↓
Infrastructure Adapter
```

This allows future extraction into Go services.

---

# 32. State Management

Use Zustand for editor state.

Suggested stores:

```text
editorStore
projectStore
selectionStore
historyStore
validationStore
```

Editor state must support undo and redo.

Use command history or immutable snapshots.

---

# 33. Suggested Repository Structure

Use a monorepo.

```text
.
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (app)/
│   │   │   ├── api/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   └── next.config.ts
│   │
│   └── vscode/
│       ├── extension/
│       │   ├── src/
│       │   │   ├── commands/
│       │   │   ├── editors/
│       │   │   ├── workspace/
│       │   │   ├── diagnostics/
│       │   │   └── extension.ts
│       │   └── package.json
│       │
│       └── webview/
│           ├── src/
│           ├── vite.config.ts
│           └── package.json
│
├── packages/
│   ├── air/
│   │   └── src/
│   ├── editor/
│   │   └── src/
│   │       ├── canvas/
│   │       ├── nodes/
│   │       ├── edges/
│   │       ├── catalog/
│   │       ├── properties/
│   │       └── yaml/
│   ├── parser/
│   │   └── src/
│   ├── generator/
│   │   └── src/
│   ├── validator/
│   │   └── src/
│   ├── module-metadata/
│   │   └── src/
│   ├── schemas/
│   │   └── src/
│   └── test-fixtures/
│
├── services/
│   ├── execution/
│   └── api/
│
├── infrastructure/
│   ├── persistence/
│   ├── ansible/
│   ├── git/
│   ├── aap/
│   └── execution/
│
├── prisma/
│   └── schema.prisma
│
├── deploy/
│   ├── container/
│   ├── kubernetes/
│   ├── openshift/
│   ├── helm/
│   └── operator/
│
├── operator/
│   ├── api/
│   ├── controllers/
│   ├── config/
│   └── go.mod
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── VSCODE.md
│   ├── DEVELOPMENT.md
│   ├── DEPENDENCIES.md
│   └── ADR/
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── spec.md
└── README.md
```

Rules:

- `apps/web` may depend on shared `packages/*`.
- `apps/vscode/webview` may depend on shared `packages/*`.
- `apps/vscode/extension` may depend on non-UI shared packages.
- shared packages must never depend on applications.
- `packages/editor` must not depend on Next.js or VS Code APIs.
- Operator implementation remains isolated in Go.

---

# 34. Container Requirements

Use multi-stage container build.

Example stages:

```text
dependencies
builder
runtime
```

Runtime image requirements:

- non-root;
- minimal;
- no development dependencies;
- health endpoint;
- arbitrary UID compatible;
- logs to stdout;
- config from environment.

Endpoints:

```text
/api/health
/api/ready
```

---

# 35. Kubernetes Deployment

Provide manifests or Helm chart supporting:

```text
Deployment
Service
ConfigMap
Secret
Ingress
ServiceAccount
```

Optional:

```text
PersistentVolumeClaim
NetworkPolicy
PodDisruptionBudget
HorizontalPodAutoscaler
```

---

# 36. OpenShift Support

Provide:

```text
Deployment
Service
Route
ConfigMap
Secret
ServiceAccount
```

The application must work under OpenShift restricted security defaults.

Avoid:

```text
runAsUser: 1000
```

unless necessary.

Prefer arbitrary UID-compatible filesystem permissions.

---

# 37. Future Operator

The future Operator should be written in Go.

Recommended technologies:

```text
Operator SDK
controller-runtime
Kubebuilder APIs
OLM bundle
```

Potential CRD:

```yaml
apiVersion: automation.example.io/v1alpha1
kind: VisualAnsible
metadata:
  name: visual-ansible
spec:
  replicas: 1

  image:
    repository: ghcr.io/example/visual-ansible
    tag: latest

  route:
    enabled: true

  database:
    mode: internal

  storage:
    size: 10Gi

  authentication:
    mode: openshift

  execution:
    enabled: true
```

---

# 38. Operator Responsibilities

The Operator may eventually manage:

```text
VisualAnsible CR
      ↓
Deployment
Service
Route / Ingress
ConfigMap
Secret
PVC
PostgreSQL
Execution workers
```

Responsibilities:

- install application;
- update application;
- configure routes;
- manage storage;
- manage database connection;
- reconcile configuration;
- manage execution workers;
- expose status;
- perform upgrades.

---

# 39. Operator Status

Example:

```yaml
status:
  phase: Ready

  version: 1.4.0

  url: https://visual-ansible.apps.example.com

  conditions:
    - type: Available
      status: "True"
```

---

# 40. Authentication

MVP:

```text
local development mode
```

Future:

```text
OpenID Connect
GitHub
GitLab
Keycloak
OpenShift OAuth
Red Hat SSO
```

When running on OpenShift, OpenShift OAuth should be a first-class option.

---

# 41. Authorization

Future roles:

```text
Admin
Editor
Viewer
Executor
```

Possible project roles:

```text
Owner
Maintainer
Contributor
Viewer
```

---

# 42. AAP / AWX Integration

Future integration should support Controller API.

Flow:

```text
Visual Project
      ↓
Git
      ↓
AAP Project
      ↓
Job Template
      ↓
Execution
```

Alternative:

```text
Visual Project
      ↓
AAP Controller API
      ↓
Job Template
```

Prefer Git-based integration where possible.

---

# 43. Import From AAP

Future functionality:

```text
AAP Project
    ↓
Git repository
    ↓
Discover playbooks
    ↓
Import
    ↓
Visualize
```

---

# 44. Execution Logs

Future execution page:

```text
Execution #342
────────────────────────────────────

PLAY [Configure servers]

TASK [Install nginx]
server01 ................. OK
server02 ................. CHANGED

TASK [Start nginx]
server01 ................. OK
server02 ................. OK
```

Use PatternFly LogViewer.

---

# 45. Node Status

During execution:

```text
gray    pending
blue    running
green   success
yellow  changed
red     failed
purple  skipped
```

Use PatternFly tokens rather than hardcoding colors.

---

# 46. Undo / Redo

Mandatory for MVP.

Keyboard:

```text
Ctrl/Cmd + Z
Ctrl/Cmd + Shift + Z
```

Store graph editing operations.

---

# 47. Keyboard Shortcuts

Recommended:

```text
Delete           Delete node
Ctrl/Cmd + C     Copy
Ctrl/Cmd + V     Paste
Ctrl/Cmd + D     Duplicate
Ctrl/Cmd + S     Save
Ctrl/Cmd + Z     Undo
Ctrl/Cmd + Shift + Z Redo
Ctrl/Cmd + F     Search
```

---

# 48. Autosave

Autosave should use a debounce.

Example:

```text
graph changed
    ↓
wait ~1 second
    ↓
save project
```

Show state:

```text
Saving...
Saved
Save failed
```

---

# 49. Error Handling

API errors should follow a consistent format:

```json
{
  "error": {
    "code": "PLAYBOOK_VALIDATION_FAILED",
    "message": "The playbook contains validation errors.",
    "details": []
  }
}
```

---

# 50. Logging

Use structured logs.

Example:

```json
{
  "level": "info",
  "event": "playbook.generated",
  "projectId": "p123",
  "durationMs": 31
}
```

Never log:

- passwords;
- private keys;
- vault passwords;
- tokens;
- secrets.

---

# 51. Security

Required baseline:

- validate all input;
- sanitize imported YAML;
- restrict filesystem access;
- prevent command injection;
- do not execute arbitrary shell from the web process;
- isolate Ansible execution;
- avoid exposing secret values;
- use CSRF-safe patterns;
- use secure cookies;
- validate Git URLs;
- validate uploaded files.

---

# 52. Execution Isolation

When Ansible execution is added, never run arbitrary automation in the Next.js server process.

Use isolated workers.

Preferred future model:

```text
API
 ↓
Job Queue
 ↓
Execution Worker
 ↓
Execution Environment
```

On Kubernetes:

```text
Execution Request
      ↓
Job
      ↓
Execution Environment container
      ↓
Target
```

---

# 52.1 VS Code Security

The extension must:

- define a strict Webview Content Security Policy;
- use nonce-based scripts;
- restrict resource roots;
- avoid injecting untrusted YAML as HTML;
- validate all Webview messages;
- avoid shell interpolation;
- use argument arrays when invoking commands;
- respect Workspace Trust;
- avoid automatically executing imported playbooks;
- never execute automation merely because a file was opened.

---

# 52.2 VS Code Diagnostics

Validation results should integrate with VS Code Diagnostics where possible.

Example:

```text
Problems
  deploy.yml
    line 14: unknown parameter "statex"
```

The visual editor should also highlight the corresponding AIR node.

The relationship should support:

```text
YAML location ↔ AIR node ↔ visual node
```

---

# 52.3 VS Code Custom Editor Strategy

Prefer a VS Code Custom Editor for `.yml/.yaml` files only when it can safely determine the file is an Ansible playbook.

Otherwise provide:

```text
Open With → Visual Ansible Editor
```

Do not hijack every YAML file.

---

# 53. Testing

Required:

## Unit

Test:

- AIR transformations;
- graph operations;
- YAML generator;
- module metadata parsing;
- validation logic.

## Integration

Test:

- database;
- project API;
- import/export;
- syntax validation.

## E2E

Use Playwright.

Minimum Web workflows:

```text
Create project
Add module
Configure module
Connect module
Generate YAML
Save project
Reload project
Export playbook
```

Minimum VS Code workflows:

```text
Open existing playbook
Parse YAML
Render visual graph
Change a module property
Save through VS Code
Verify YAML changed
Run validation
Show diagnostics
Reopen and preserve graph semantics
```

---

# 54. Code Quality

Required tooling:

```text
eslint
prettier
typescript
vitest
playwright
```

Optional:

```text
sonarqube
codecov
```

No merge if:

```text
lint fails
typecheck fails
unit tests fail
build fails
```

---

# 55. CI/CD

Pipeline example:

```text
Install
 ↓
Lint
 ↓
Typecheck
 ↓
Unit tests
 ↓
Build
 ↓
E2E
 ↓
Container build
 ↓
Container scan
 ↓
Publish
```

Future:

```text
Build Operator Bundle
 ↓
Validate Bundle
 ↓
Publish Catalog
```

---

# 56. Phase 1 — Shared Core + Web MVP

Goal:

Create the reusable engine and first web visual Ansible playbook builder.

Features:

- pnpm monorepo.
- Shared AIR package.
- Shared YAML generator.
- Shared validation primitives.
- Shared PatternFly + React Flow editor package.
- Next.js web application.
- PatternFly application shell.
- React Flow canvas.
- Module catalog.
- Drag/drop.
- Node properties.
- 15 builtin modules.
- Sequential edges.
- YAML generation.
- YAML preview.
- Save/load project.
- Undo/redo.
- Export `.yml`.

No Ansible execution required.

---

# 56.1 Phase 1B — VS Code MVP

Goal:

Reuse the same core and editor inside VS Code.

Features:

- VS Code extension.
- React/Vite Webview.
- PatternFly visual editor.
- Open Ansible YAML from workspace.
- YAML → AIR import for supported MVP constructs.
- AIR → YAML generation.
- Save using WorkspaceEdit.
- standard VS Code dirty/save semantics.
- command palette integration.
- basic workspace tree.
- validation command adapter.
- diagnostics integration.

The VS Code extension must not fork or duplicate editor business logic.

---

# 57. Phase 2 — Validation

Add:

- ansible-playbook syntax check;
- ansible-lint;
- validation panel;
- module metadata from ansible-doc;
- richer dynamic forms.

---

# 58. Phase 3 — Import

Add:

```text
YAML → AIR → Visual Graph
```

Support:

- play;
- tasks;
- handlers;
- when;
- loop;
- register;
- block;
- rescue;
- always;
- roles.

---

# 59. Phase 4 — Git

Add:

- repository connection;
- import project;
- branch support;
- diff;
- commit;
- push;
- pull.

---

# 59.1 Phase 4B — Developer Workflow

Add VS Code developer-oriented capabilities:

- discover `ansible.cfg`;
- discover playbooks;
- discover roles;
- discover inventories;
- discover collections;
- detect local/remote Ansible CLI;
- execute `ansible-doc`;
- execute `ansible-lint`;
- execute `ansible-playbook --syntax-check`;
- map diagnostics back to visual nodes;
- optional VS Code SCM integration.

---

# 60. Phase 5 — Execution

Add:

- ansible-runner;
- execution environment support;
- inventories;
- credentials;
- logs;
- execution history.

---

# 61. Phase 6 — AAP / AWX

Add:

- controller connection;
- inventory discovery;
- project discovery;
- job templates;
- launch jobs;
- job events;
- logs.

---

# 62. Phase 7 — Kubernetes / OpenShift

Add:

- Kubernetes manifests;
- OpenShift Route;
- Helm chart;
- execution Jobs;
- secrets integration;
- persistence.

---

# 63. Phase 8 — Operator

Create Operator:

```text
VisualAnsible CRD
Controller
RBAC
OLM Bundle
CatalogSource
CSV
```

Support lifecycle:

```text
install
upgrade
scale
configure
backup hooks
status reporting
```

---

# 64. MVP Acceptance Criteria

## 64.1 Web MVP

The Web MVP is considered complete when a user can:

1. Open the application.
2. Create a project.
3. Create a playbook.
4. Define hosts.
5. Drag an Ansible module onto the canvas.
6. Configure module arguments.
7. Add multiple tasks.
8. Connect tasks.
9. Configure `when`.
10. Configure `loop`.
11. Configure `register`.
12. Create a handler.
13. Use `notify`.
14. View generated YAML.
15. Save the project.
16. Reload the project.
17. Export a valid `.yml` file.

## 64.2 VS Code MVP

The VS Code MVP is considered complete when a developer can:

1. Install the extension.
2. Open a workspace containing an Ansible playbook.
3. Run `Visual Ansible: Open Playbook Visually`.
4. Parse the playbook into AIR.
5. Render supported tasks visually.
6. Edit task properties.
7. Save the visual changes.
8. Observe the original `.yml` file updated.
9. Undo/redo safely.
10. Run validation.
11. See validation errors in VS Code Problems.
12. Reopen the YAML without losing supported semantics.

---

# 65. Example Demo

Build this playbook visually:

```yaml
- name: Configure nginx
  hosts: webservers
  become: true

  tasks:
    - name: Install nginx
      ansible.builtin.dnf:
        name: nginx
        state: present

    - name: Deploy configuration
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
      notify:
        - Restart nginx

    - name: Start nginx
      ansible.builtin.service:
        name: nginx
        enabled: true
        state: started

  handlers:
    - name: Restart nginx
      ansible.builtin.service:
        name: nginx
        state: restarted
```

Expected visual representation:

```text
[Install nginx]
       ↓
[Deploy configuration] ───── notify ─────► [Restart nginx]
       ↓
[Start nginx]
```

---

# 66. UX Rule

A beginner should be able to create a basic playbook without knowing YAML.

An advanced user should still recognize the generated output as clean, conventional Ansible.

The product must serve both users.

---

# 67. Product Differentiation

The product is not:

```text
another Ansible dashboard
```

The core product is:

```text
Visual authoring for Ansible
```

Primary value proposition:

```text
Design automation visually.
Generate real Ansible.
Keep everything as code.
```

---

# 68. Future AI Features

AI should not be required for basic functionality.

Potential later features:

```text
Natural language → Playbook Graph
```

Example:

```text
"Install nginx on Red Hat,
deploy nginx.conf and restart
the service when the file changes."
```

Result:

```text
[dnf nginx]
     ↓
[template nginx.conf]
     │
     └─ notify → [restart nginx]
```

Other AI features:

- explain a playbook;
- detect automation issues;
- recommend modules;
- generate task descriptions;
- convert shell commands into Ansible modules;
- explain lint errors.

All generated automation must remain reviewable before execution.

---

# 69. Future Marketplace

Possible reusable visual components:

```text
Reusable Flows
├── Configure RHEL
├── Install PostgreSQL
├── Deploy JBoss
├── Configure Nginx
├── Kubernetes Deployment
└── Linux Hardening
```

These should map to standard Ansible roles or collections whenever possible.

---

# 70. Architecture Objective

The long-term architecture should allow this workflow:

```text
                              ┌────────────────┐
                              │ Natural Lang.  │
                              └────────┬───────┘
                                       ↓
┌────────────────┐            ┌────────────────┐
│ Existing YAML  │───────────►│      AIR       │◄────────────┐
└────────────────┘            └───────┬────────┘             │
                                     │                       │
                         ┌───────────┴───────────┐            │
                         │                       │            │
                    Web Editor             VS Code Editor ────┘
                    Next.js                React/Vite
                         │                       │
                         └───────────┬───────────┘
                                     ↓
                               Ansible YAML
                                     ↓
                                    Git
                                     ↓
                    ┌────────────────────────────┐
                    │ Web Platform / AAP / AWX   │
                    └──────────────┬─────────────┘
                                   ↓
                         Execution Environments
                                   ↓
                            Infrastructure
```

Shared code architecture:

```text
                        Shared Packages

                ┌──────────────────────────┐
                │ AIR / Parser / Generator │
                │ Validator / Metadata     │
                └─────────────┬────────────┘
                              │
                    ┌─────────┴─────────┐
                    │ Shared UI Editor  │
                    │ PatternFly + Flow │
                    └─────────┬─────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
             Next.js Web             VS Code Webview
                 │                         │
          Web Platform APIs          Extension Host
                 │                         │
          OpenShift / Operator       Local/Remote WS
```

---

# 71. Coding Agent Instructions

When implementing this project:

1. Read this entire specification first.
2. Do not skip architectural boundaries for speed.
3. Keep domain logic independent from React Flow.
4. Keep AIR independent from UI.
5. Keep YAML generation deterministic.
6. Prefer PatternFly over custom UI components.
7. Do not introduce Tailwind without justification.
8. Maintain strict TypeScript.
9. Validate external data with Zod.
10. Keep execution logic out of the Next.js UI process.
11. Add tests for domain transformations.
12. Document significant architectural decisions as ADRs.
13. Keep the project deployable as a container.
14. Preserve compatibility with Kubernetes and OpenShift.
15. Do not add Operator-specific coupling to the application domain.
16. Keep future Go Operator integration in mind.
17. Commit changes in small logical units.
18. Never replace working architecture with generated shortcuts without documenting the change.
19. Implement shared packages before duplicating functionality in apps.
20. The shared editor must run in both Next.js and a Vite Webview.
21. Never import `vscode` from shared domain or editor packages.
22. Never import Next.js APIs from shared domain or editor packages.
23. Model platform-specific capabilities as adapters/interfaces.
24. Treat YAML as a portable source artifact.
25. Respect VS Code Workspace Trust before running local commands.
26. Do not assume Ansible binaries execute on the local desktop; respect Remote SSH, WSL and Dev Containers.
27. Keep Webview CSP strict and message payloads validated.

---

# 72. First Development Milestone

The first milestone should prove the **shared-core architecture**, not only the Web UI.

Target:

```text
                    Shared AIR
                       ↓
               Shared Generator
                       ↓
                 Shared Editor
                 /           \
                /             \
          Next.js Web       VS Code Webview
                \             /
                 \           /
                 same YAML output
```

Web vertical slice:

```text
PatternFly Application Shell
          ↓
Projects Page
          ↓
Create Project
          ↓
Visual Editor
          ↓
Drag ansible.builtin.dnf
          ↓
Configure module
          ↓
Add ansible.builtin.service
          ↓
Connect nodes
          ↓
Generate valid Ansible YAML
          ↓
Download playbook.yml
```

VS Code proof-of-architecture slice:

```text
Open playbook.yml
       ↓
Parse YAML
       ↓
AIR
       ↓
Shared Visual Editor
       ↓
Change property
       ↓
Shared Generator
       ↓
Save playbook.yml
```

The milestone is not complete if Web and VS Code require separate AIR or generator implementations.

---

# 73. Definition of Done

A feature is done only when:

- behavior is implemented;
- UI follows PatternFly;
- TypeScript passes;
- tests pass;
- errors are handled;
- accessibility is considered;
- API contract is documented;
- generated Ansible remains valid;
- application remains container-compatible;
- no OpenShift compatibility regression is introduced;
- shared packages remain platform-neutral;
- shared editor behavior is verified in both Web and VS Code when affected;
- VS Code Workspace Trust is respected for executable actions;
- Webview security constraints remain valid when VS Code code is affected.

---

# 74. Suggested Project Names

Temporary internal names:

```text
Playbook Flow
Ansible Flow
Flowsible
Ansible Studio
Automation Canvas
Playbook Canvas
```

The repository name should remain replaceable until branding is finalized.

---

# 75. Final Product Direction

The product should evolve into a shared visual Ansible authoring engine exposed through multiple surfaces.

Developer workflow:

```text
             BUILD
               ↓
        VS Code Extension
               ↓
          Visual Flow
               ↓
           Validate
               ↓
         Generate YAML
               ↓
              Git
```

Platform workflow:

```text
              Git
               ↓
        Next.js Web Platform
               ↓
      Review / Collaborate
               ↓
          AAP / AWX
               ↓
     Execution Environments
               ↓
        Observe Results
```

OpenShift lifecycle:

```text
Operator
   ↓
VisualAnsible CR
   ↓
Web Platform
   ↓
Execution Services
   ↓
AAP / Runner
```

Unified architecture:

```text
                    Visual Ansible Core

          AIR + Parser + Generator + Validator
                         │
                  Shared Editor
                         │
              ┌──────────┴──────────┐
              │                     │
          VS Code                 Web
              │                     │
         Developer             Platform Team
              │                     │
              └──────── Git ────────┘
                                    │
                              OpenShift Operator
                                    │
                                   AAP
```

The platform should make Ansible easier to create without making Ansible itself invisible.

The YAML remains portable, reviewable and executable independently from the platform.

That distinction is fundamental to the product.
