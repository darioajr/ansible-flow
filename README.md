# Playbook Flow

Recriação baseada na [spec v2](spec.md): **um engine e um editor visual compartilhados entre Web e VS Code**. Implementa o MVP Web, o MVP da extensão e a importação dos construtos suportados.

## Iniciar o Web

Node.js 22.12+ e pnpm 11.2.2.

```bash
corepack enable
pnpm install
pnpm dev
```

Abra http://localhost:3000. Crie um projeto ou importe um `.yml`. Projetos persistem no servidor em `apps/web/data`; configure `DATA_DIR` com um caminho absoluto para mudar. O modo local não tem login.

## Instalar a extensão

```bash
pnpm package:vscode
code --install-extension apps/vscode/extension/visual-ansible-extension-0.2.0.vsix
```

Alternativa: VS Code → Extensions → **Install from VSIX…**. Abra seu workspace e execute **Visual Ansible: Open Playbook Visually**, ou **Open With → Visual Ansible Editor** em um YAML. A extensão não assume a abertura de todo arquivo YAML. Para depurar, abra este monorepo e use a configuração F5 **Visual Ansible Extension**.

## Usar o editor

- Defina hosts e `become` em **Play properties**. Clique no fundo do canvas para retornar às propriedades do play.
- Arraste módulos do catálogo ou use `+`; clique no nó para configurar argumentos.
- Conecte uma saída à entrada de outra tarefa: o destino passa a executar logo após a origem. As arestas representam uma sequência, sem ciclos ou branching.
- Use **Block → Edit block tasks / Edit rescue tasks / Edit always tasks** para editar cada sequência. Blocos podem ser aninhados. **Condition** e **Loop** configuram o comportamento das tarefas.
- Use **Roles** e **Add Role** para referências de roles do play; **Pre-tasks** e **Post-tasks** preservam sua ordem em relação às roles. Para incluir/importar uma role dentro de tasks, use os módulos `include_role`/`import_role`.
- Defina handlers na aba **Handlers** e referencie seus nomes em **Notify handlers**.
- Use **YAML editor** (Web) ou **YAML preview** (VS Code), **Validate**, **Save** e, no Web, **Export YAML**.
- No Web, **YAML editor** permite editar: altere o texto e clique em **Apply to diagram**. A aplicação valida o YAML, atualiza o diagrama e salva automaticamente. **Discard draft** retorna ao YAML atual do diagrama. Enquanto houver rascunho, a edição visual e a troca de playbook ficam pausadas; salvar ou sair pelos links exige aplicar ou descartar. Erros mantêm o texto para correção. Aplicar recalcula o layout do playbook ativo e pode ser desfeito/refeito; os demais playbooks não são alterados.

O catálogo inclui 20 módulos: os 15 builtin do MVP, `apt`, `replace`, `community.general.ufw`, `include_role` e `import_role`. Campos complexos (loops, variáveis, environment, set_fact) usam JSON. Ctrl/Cmd+Z, Shift+Z, C, V, D, S e F, Delete, seleção múltipla e minimapa estão implementados. Clipboard é interno ao editor. O Web mantém 100 snapshots e autosave após 1 segundo; o VS Code usa o histórico e estado dirty nativos do documento.

## Monorepo

```text
apps/web                  Next.js, API e persistência local
apps/vscode/extension     Extension Host, workspace, comandos, diagnostics
apps/vscode/webview       React/Vite, adapter de mensagens
packages/air              Modelo e operações de grafo
packages/parser           YAML → AIR e localização de origem
packages/generator        AIR → YAML, preservação de comentários
packages/validator        Regras de domínio
packages/module-metadata  Catálogo e parser de ansible-doc
packages/schemas          Zod, AIR externo e protocolo Webview
packages/editor           PatternFly + React Flow + Zustand, sem Next/vscode
```

## Verificar

```bash
pnpm lint
pnpm typecheck
pnpm test
# Opcional, com Ansible instalado:
RUN_ANSIBLE_SYNTAX=1 pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
# Baixa um VS Code isolado para testar o Extension Host:
pnpm test:extension
```

A CI inclui testes, builds Web/Vite/Extension Host, E2E nas duas superfícies, testes reais do VS Code, pacote VSIX, container e scan. Nada é publicado automaticamente.

## Containers e clusters

Com Podman (no macOS, a VM deve estar ligada com `podman machine start`):

```bash
podman build --format docker -t localhost/playbook-flow:0.2.0 .
podman run --rm --name playbook-flow -p 127.0.0.1:3000:3000 --read-only --tmpfs /tmp -v playbook-flow-data:/data localhost/playbook-flow:0.2.0
```

Abra http://localhost:3000. O volume `playbook-flow-data` preserva os projetos entre execuções. `--format docker` mantém o `HEALTHCHECK` da imagem, que o formato OCI padrão do Podman ignora.

Com Docker ou para aplicar os manifests no cluster:

```bash
docker build -t playbook-flow:0.2.0 .
docker run --rm -p 3000:3000 --read-only --tmpfs /tmp -v playbook-flow-data:/data playbook-flow:0.2.0
kubectl apply -k deploy/kubernetes
# OpenShift:
oc apply -k deploy/openshift
```

Ajuste imagem/registry antes de aplicar. Manifests usam uma réplica com PVC, usuário não-root, capabilities removidas e filesystem somente leitura. O overlay OpenShift permite UID/grupo atribuídos pelo SCC. Ingress e Route são opcionais e aplicados separadamente. Configure autenticação no proxy antes de expor o modo local. Não há credenciais nesta fase, portanto nenhum Secret fictício é criado.

## Limites explícitos

- Web é modo local de autoria; RBAC, colaboração, Git, execução, AAP/AWX, inventários, Helm e Operator continuam nas fases futuras.
- Persistência Web em JSON atômico, UUID e revisão otimista: **uma réplica/processo**. PostgreSQL e histórico persistente são evolução do adapter.
- Importação cobre plays, módulos, tasks, block, handlers, when, loop, register, notify e opções comuns. Roles, pre/post tasks e blocos com rescue/always são suportados. Aliases, tags explícitas, import_playbook e construtos não representados bloqueiam escrita visual; o arquivo original é preservado. Veja [contrato de importação](docs/ARCHITECTURE.md).
- O gerador preserva comentários e valores; pode normalizar nomes de módulos, aspas e formatação. Não promete preservação byte a byte.
- Web valida AIR/metadados. VS Code pode executar syntax-check ou lint mediante comando explícito, Workspace Trust e ferramentas instaladas no Extension Host. Nenhum playbook é executado pela aplicação.
- VS Code Desktop e Remote Development são alvos; `vscode.dev` sem host Node não está incluído.
- Metadados incluídos cobrem argumentos comuns. No VS Code, execute **Visual Ansible: Discover Ansible Modules** para carregar formulários do `ansible-doc` do Extension Host (workspace confiável; até 20 módulos por seleção; cache por workspace durante a sessão). O Web usa o catálogo incluído.
- Não armazene segredos. Valores de campos sensíveis conhecidos são recusados no Web; texto livre não é varrido por um detector completo. Use referências Jinja e credenciais externas. No VS Code o YAML pertence ao usuário e segue o fluxo nativo de arquivos.
- Layout de nós é salvo no projeto Web; no VS Code o YAML permanece o único arquivo e o layout é calculado ao reabrir.

Detalhes: [arquitetura](docs/ARCHITECTURE.md), [API](docs/API.md), [VS Code](docs/VSCODE.md), [desenvolvimento](docs/DEVELOPMENT.md), [ADR](docs/ADR/001-shared-engine.md).

Detalhes das novas estruturas, exemplos e limites: [compatibilidade Ansible](docs/ANSIBLE-COMPATIBILITY.md).
