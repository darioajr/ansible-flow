# Roadmap — Playbook Flow

Atualizado em **18/09/2026**, com base na [spec.md — Draft v2.0](spec.md), no código do repositório e nas verificações realizadas durante o desenvolvimento.

Este documento acompanha a implementação; a spec continua sendo a referência de escopo. **Concluído** significa entregue no escopo indicado, **Parcial** significa que há implementação com lacunas, e **Pendente** significa que a capacidade ainda não foi entregue. Uma fase concluída não implica que todos os objetivos futuros do produto estejam prontos.

## Visão geral por fase da spec

| Fase                        | Referência   | Estado                      | Situação atual                                                                                                                               |
| --------------------------- | ------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Shared Core + Web MVP   | §56, §64.1   | Concluído no escopo MVP     | Editor visual, 20 módulos, projetos locais, geração/exportação YAML e histórico.                                                             |
| 1B — VS Code MVP            | §56.1, §64.2 | Concluído no escopo MVP     | Mesmo editor e engine, arquivos do workspace, edição/salvamento nativos, comandos e diagnostics. Distribuição local por VSIX.                |
| 2 — Validação               | §57          | Parcial                     | Validação compartilhada; syntax-check/lint opcionais no VS Code. Descoberta ansible-doc no VS Code entregue; falta validação externa no Web. |
| 3 — Importação              | §58          | Concluído no escopo da fase | Plays, tarefas, handlers, condições, loops, register, block/rescue/always e roles entregues; limites adicionais descritos abaixo.            |
| 4 — Git                     | §59          | Pendente                    | Sem integração Git dentro do produto. Versionar o código deste repositório não implementa essa fase.                                         |
| 4B — Fluxo do desenvolvedor | §59.1        | Parcial                     | Descoberta básica de playbooks e validação no Extension Host. Descoberta ansible-doc entregue; faltam descoberta completa do projeto e SCM.  |
| 5 — Execução                | §60          | Pendente                    | Não há execução de automação, Runner, inventários ou gestão de credenciais.                                                                  |
| 6 — AAP / AWX               | §61          | Pendente                    | Sem conexão com Controller, job templates ou acompanhamento de jobs.                                                                         |
| 7 — Kubernetes / OpenShift  | §62          | Parcial                     | Container e manifests iniciais com PVC, Ingress e Route. Faltam homologação em clusters, Helm e componentes de execução/secrets.             |
| 8 — Operator                | §63          | Pendente                    | Sem Operator, CRD ou distribuição OLM.                                                                                                       |

## 1. Fundação e Web MVP

Referências: §§5–18, 28–33, 46–49, 56, 64.1 e 72.

- [x] Monorepo pnpm com Turborepo e TypeScript.
- [x] Pacotes compartilhados `air`, `parser`, `generator`, `validator`, `module-metadata`, `schemas` e `editor`.
- [x] AIR independente de React Flow; editor independente de Next.js e das APIs do VS Code.
- [x] Fronteiras entre pacotes verificadas pelo lint.
- [x] Next.js App Router com PatternFly, React Flow e Zustand.
- [x] Shell com Projects, Settings e About.
- [x] Criar projetos, adicionar playbooks e plays, definir hosts, become e variáveis do play.
- [x] Catálogo pesquisável e formulários orientados pelos metadados incluídos.
- [x] Arrastar, mover, conectar, selecionar, duplicar, copiar/colar e remover tarefas.
- [x] Arestas sequenciais e proteção contra ciclos; blocos com tarefas internas.
- [x] Condições, loops, register, handlers e notify.
- [x] Propriedades comuns de tarefas, incluindo tags, become, environment e opções de execução suportadas.
- [x] Zoom, pan, minimapa e atalhos de teclado.
- [x] Undo/redo com até 100 snapshots no Web.
- [x] Geração de YAML padrão com FQCN e preservação de comentários nos casos suportados.
- [x] Preview com Monaco local, destaque de sintaxe, cópia e exportação `.yml`.
- [x] Persistência JSON com escrita atômica, revisão otimista e save/load.
- [x] Autosave com debounce e indicação de estado; gravações serializadas.
- [x] API `/api/v1` para projetos, playbooks, importação, geração, validação e catálogo.
- [x] Contrato de erros e endpoints de health/readiness.

Os 15 módulos do MVP (§12) estão disponíveis:

```text
ansible.builtin.command          ansible.builtin.shell
ansible.builtin.copy             ansible.builtin.file
ansible.builtin.template         ansible.builtin.service
ansible.builtin.systemd_service  ansible.builtin.dnf
ansible.builtin.package          ansible.builtin.user
ansible.builtin.group            ansible.builtin.uri
ansible.builtin.debug            ansible.builtin.set_fact
ansible.builtin.wait_for
```

**Limites:** o clipboard de nós é interno ao editor; campos complexos usam JSON. A persistência exige uma réplica/processo. Ainda não há PostgreSQL/Prisma, usuários ou histórico durável de versões. `notify` é configurado por propriedade e os handlers aparecem em uma aba separada; a aresta visual de notificação ilustrada no demo da spec (§65) não está implementada. Branching continua pendente (§15).

Evidências: [editor compartilhado](packages/editor/src/editor.tsx), [store](packages/editor/src/store.ts), [catálogo](packages/module-metadata/src/index.ts), [persistência](apps/web/server/store.ts), [API](docs/API.md).

## 2. VS Code MVP e fluxo do desenvolvedor

Referências: §§8.1–8.4, 52.1–52.3, 56.1, 59.1 e 64.2.

- [x] Extension Host TypeScript e Webview React/Vite, sem Next.js dentro da Webview.
- [x] Custom Editor opt-in para `.yml`/`.yaml`; não assume a abertura de todo YAML.
- [x] Comandos Open Playbook Visually, Create Playbook, Validate Playbook e Show Generated YAML.
- [x] Árvore básica de playbooks do workspace.
- [x] Importar construtos suportados e salvar por `WorkspaceEdit`.
- [x] Dirty state, save, undo/redo nativos do VS Code.
- [x] Atualizar a visualização quando o documento muda no editor de texto.
- [x] Controle de versão das mensagens para evitar sobrescrever alterações concorrentes.
- [x] Diagnostics com localização de origem quando disponível; seleção de nós pelo painel de problemas.
- [x] Adapter de CLI executado no Extension Host ativo, com timeout e limite de saída.
- [x] Workspace Trust, CSP restritiva, assets locais e mensagens validadas com Zod.
- [x] Build e pacote VSIX local; configuração F5 para desenvolvimento.
- [ ] Descobrir e interpretar `ansible.cfg`, roles, inventários e collections.
- [ ] Detectar ferramentas, versões e contexto Ansible automaticamente.
- [x] Executar `ansible-doc` e disponibilizar os resultados no catálogo do VS Code, com cache por workspace durante a sessão.
- [ ] Homologar os fluxos em Remote SSH, WSL, Dev Containers e Codespaces. A arquitetura usa o host do workspace, mas isso não equivale a validar todos esses ambientes.
- [ ] Integração com SCM/Git e publicação no VS Code Marketplace.
- [ ] Suporte futuro a `vscode.dev`, com estratégia para funcionalidades que dependem de Node/CLI.

Evidências: [documentação VS Code](docs/VSCODE.md), [extensão](apps/vscode/extension/src/extension.ts), [adapter de comandos](apps/vscode/extension/src/runner.ts), [testes nativos](tests/extension-host/suite.ts).

## 3. Validação, importação e edição bidirecional

Referências: §§17–20, 57 e 58.

### Entregue

- [x] YAML → parser → AIR → diagrama para o subconjunto suportado.
- [x] Plays, tasks, handlers, when, loop, register, notify e blocks.
- [x] Detecção de sintaxe inválida, chaves duplicadas e estruturas não representáveis.
- [x] Preservar o arquivo original e desabilitar escrita visual quando a importação não é segura.
- [x] Validação do modelo e dos parâmetros conhecidos; painel Problems.
- [x] Parser e descoberta de metadados via `ansible-doc` no VS Code, com Workspace Trust, seleção de módulos e mensagens validadas.
- [x] `ansible-playbook --syntax-check` ou `ansible-lint` no VS Code, mediante configuração, ferramentas instaladas, documento salvo e Workspace Trust.
- [x] Web: **YAML editor → Apply to diagram**, com validação antes da aplicação.
- [x] Manter o rascunho em caso de erro e permitir **Discard draft**.
- [x] Pausar edição visual e autosave enquanto há rascunho; retomar depois de aplicar/descartar.
- [x] Aplicar YAML como uma operação de histórico, preservando os outros playbooks.
- [x] Visual → YAML automático; YAML → visual por aplicação explícita no Web e por sincronização do documento no VS Code.

### Ampliação entregue em 18/09/2026

- [x] `rescue` e `always` aninhados no modelo, parser, gerador e editor.
- [x] Roles estáticas em escopo próprio; include_role/import_role como tarefas e pre/post tasks preservando a ordem.
- [x] Variáveis em lista de mapas e booleanos Ansible yes/no/on/off, com preservação de strings entre aspas.
- [x] Diagnósticos de importação com linha/coluna e orientação de indentação/tipo, inclusive nas mensagens de erro Web.
- [x] Formulários para apt, replace, ufw, include_role e import_role; 20 módulos incluídos no total.
- [x] Descoberta ansible-doc no VS Code e uso dos metadados/aliases na validação e nos formulários.
- [x] Diagnostics atuais/legados de syntax-check/lint e seleção do nó mais próximo da linha informada.

### Falta fazer

- [ ] Demais construções futuras fora do escopo entregue, como import_playbook e expansão de arquivos internos de roles.
- [ ] Ampliar compatibilidade com variantes válidas de YAML/Ansible, como aliases e formas de argumentos ainda não representadas.
- [x] Catálogo dinâmico via `ansible-doc --json` no VS Code, incluindo módulos de collections instaladas/customizadas. No Web, a descoberta externa continua pendente.
- [x] Ampliação inicial para 20 módulos e formulários descobertos. A cobertura de todas as restrições e subopções de cada módulo continua sendo evolução.
- [ ] Validação externa no Web por serviço/worker isolado, sem executar comandos no processo Next.js.
- [x] Melhorar a explicação de erros e de recursos não suportados com linha/coluna e orientações de estrutura.
- [x] Refinar o mapeamento de diagnostics externos para linhas, colunas e nós; erros de arquivos referenciados mantêm o caminho no texto.
- [ ] Preservar posições dos nós ao aplicar YAML; hoje o layout do playbook aplicado é recalculado.

**Distinções importantes:** editar YAML no Web não significa sincronização automática a cada tecla. A geração pode normalizar aspas e formatação; não há promessa de preservação byte a byte. O parser reconhece módulos FQCN com argumentos em mapa mesmo fora do catálogo, mas isso não fornece metadados completos nem validação específica desses módulos. Nomes curtos fora do catálogo podem ser recusados. `apt`, `replace` e `community.general.ufw`, presentes nos exemplos discutidos, agora têm formulários dedicados. Roles são referências: o editor não carrega automaticamente suas tarefas a partir do filesystem.

Evidências: [parser](packages/parser/src/index.ts), [gerador](packages/generator/src/index.ts), [validador](packages/validator/src/index.ts), [testes do engine](tests/core.test.ts), [E2E Web](tests/e2e/web.spec.ts).

## 4. Git e plataforma multiusuário

Referências: §§24–28, 30.3, 40–41 e 59.

- [ ] Conectar/clonar repositório e reconhecer a estrutura de projetos Ansible.
- [ ] Branches, diff, commit, pull e push dentro do produto.
- [ ] Pull requests e provedores GitHub, GitLab e Bitbucket.
- [ ] Autenticação OIDC e integrações previstas, incluindo OpenShift OAuth.
- [ ] RBAC global e por projeto.
- [ ] Colaboração, auditoria e histórico persistente de versões.
- [ ] Banco e estratégia de concorrência para operação multiusuário e múltiplas réplicas.
- [ ] Gerenciador de variáveis por projeto, playbook, play, grupo, host e tarefa.
- [ ] Integrações com Ansible Vault, HashiCorp Vault, Kubernetes/OpenShift Secrets e credenciais AAP.

Hoje o Web opera em modo local sem login. Variáveis do play e referências Jinja são suportadas; não há cofre de segredos. A rejeição de campos sensíveis conhecidos não é um detector universal de segredos em texto livre.

## 5. Execução e AAP/AWX

Referências: §§21–23, 42–45, 52, 60 e 61.

- [ ] Serviço de execução separado da UI/API Web, filas e workers isolados.
- [ ] Ansible Runner e escolha de Execution Environment por projeto.
- [ ] Inventários estáticos, YAML, INI e plugins dinâmicos.
- [ ] Credenciais e associação segura aos jobs.
- [ ] Histórico de execução, eventos, logs e status por nó.
- [ ] Kubernetes Jobs para execução em cluster.
- [ ] Conexão com Controller AAP/AWX.
- [ ] Descoberta/importação de projetos, inventários e job templates.
- [ ] Disparar jobs e acompanhar eventos/logs.

**Nenhuma automação é executada pelo produto hoje.** Syntax-check e lint são verificações, não execução do playbook. A ausência de execução está de acordo com o escopo do MVP.

## 6. Containers, Kubernetes/OpenShift e Operator

Referências: §§2.5, 34–39 e 62–63.

- [x] Dockerfile multi-stage com runtime standalone.
- [x] Build e execução local validados com Podman.
- [x] Verificação local de usuário não-root, UID arbitrário com grupo 0, root filesystem somente leitura e `/tmp` gravável.
- [x] Healthcheck e readiness; configuração por variáveis de ambiente.
- [x] Persistência em volume e teste de recriação do container sem perda de projetos.
- [x] Manifests Kubernetes: Deployment, Service, ConfigMap, ServiceAccount, PVC e Ingress opcional.
- [x] Overlay OpenShift e Route opcional.
- [ ] Homologar os manifests em clusters Kubernetes e OpenShift reais, incluindo SCC, storage e acesso externo.
- [ ] Helm chart e política de releases das imagens.
- [ ] Integração efetiva com Secrets; não há Secret fictício sem consumidor no MVP.
- [ ] Avaliar NetworkPolicy, PDB e escalabilidade após substituir a persistência de processo único.
- [ ] Execution Jobs, persistência e credenciais das futuras capacidades de execução.
- [ ] Operator em Go, CRD `VisualAnsible`, controller, RBAC, condições/status e reconciliação.
- [ ] Instalação, upgrade, configuração, escala e hooks de backup via Operator.
- [ ] OLM bundle, CSV e CatalogSource.

O teste local de UID arbitrário é evidência de compatibilidade do container, não uma homologação completa em OpenShift.

Evidências: [Dockerfile](Dockerfile), [Kubernetes](deploy/kubernetes/app.yaml), [overlay OpenShift](deploy/openshift/kustomization.yaml), [Route](deploy/openshift/route.yaml).

## 7. Qualidade, segurança e distribuição

Referências: §§49–55 e 73.

- [x] ESLint, Prettier, TypeScript, Vitest e Playwright configurados.
- [x] Testes de transformações AIR, grafo, parser/gerador, metadados, validação, API e protocolo da extensão.
- [x] E2E Web e Webview; testes com VS Code real em workspace/perfil isolados.
- [x] Teste opcional de sintaxe do YAML gerado com Ansible instalado.
- [x] Zod nas fronteiras, limites de entrada, identificadores validados e escrita atômica.
- [x] Validação de origem nas mutações Web, corrigida para o endereço público do container.
- [x] CSP e Workspace Trust no VS Code; CLI sem interpolação de shell.
- [x] Pipeline configurado para lint, tipos, testes, builds, pacote VSIX, container e scan Trivy.
- [x] Documentação de arquitetura, API, desenvolvimento, dependências e ADR.
- [ ] Ampliar logs estruturados e observabilidade; hoje há tratamento básico de falhas, não auditoria completa.
- [ ] Auditoria sistemática de acessibilidade, desempenho e compatibilidade entre ambientes.
- [ ] Pipeline de publicação de imagem e extensão, gestão de versões e releases.
- [ ] Validação de banco e das integrações futuras à medida que forem implementadas.

### Evidências de verificação já obtidas

- Última suíte de engine/API/protocolo: **53 testes passaram**, incluindo syntax-check de roles/recuperação e descoberta real com ansible-doc.
- Última suíte completa Playwright: **7 testes passaram**, cobrindo Web e Webview, edição de roles/recuperação, novos módulos e catálogo recebido do host.
- Lint e typecheck passaram após a ampliação de compatibilidade, estruturas e catálogo.
- Os testes nativos do Extension Host foram ampliados e passaram com edição/salvamento de roles e rescue/always. O teste visual em VS Code real também integra a verificação de distribuição.
- Build de produção e smoke test da edição YAML, aplicação, autosave e reload passaram em container Podman isolado.
- Container local atualizado com healthcheck saudável na última verificação.

Esses registros são evidências das rodadas realizadas, não uma garantia de que a CI remota ou um deploy em cluster já tenham sido executados. Os resultados acima foram atualizados após as mudanças de código desta entrega.

## 8. Melhorias já entregues após a recriação

- [x] Recriação do projeto com engine e editor compartilhados a partir da spec v2.
- [x] Documentação e validação de uso com Podman.
- [x] Correção de `Cross-origin writes are not allowed` ao acessar pelo endereço público do container.
- [x] Alinhamento vertical do logo, nome Playbook Flow e frase do cabeçalho.
- [x] Edição YAML bidirecional no Web, com aplicação explícita, validação, descarte e histórico.
- [x] Pausa e retomada do autosave durante rascunhos YAML.

Os exemplos YAML da conversa orientaram testes de compatibilidade e a inclusão dos novos módulos. YAML com indentação inválida continua sendo recusado; o editor não transforma automaticamente conteúdo inválido em um playbook diferente.

## 9. Sequência de entregas e próximos passos

A sequência abaixo é uma proposta de priorização, não um novo compromisso de escopo nem um cronograma aprovado.

| Ordem                   | Entrega                            | Critério de conclusão                                                                                                                    |
| ----------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Entregue            | Compatibilidade e diagnóstico YAML | Ampliar os casos válidos encontrados no uso real; mensagens claras com localização; testes de importação/geração sem perda silenciosa.   |
| 2 — Entregue no VS Code | Catálogo e validação               | Descoberta via ansible-doc no Extension Host, formulários ampliados e diagnósticos de CLI testados; planejar adapter isolado para o Web. |
| 3 — Entregue            | Completar fase 3                   | Representar rescue, always e roles no modelo, editor, parser e gerador, com testes nas duas superfícies.                                 |
| 4                       | Fluxo do desenvolvedor e Git       | Descobrir estrutura Ansible e completar diff/branch/commit/pull/push pelos adapters apropriados.                                         |
| 5                       | Plataforma e homologação           | Autenticação, RBAC, persistência compartilhada, Helm e validação real em Kubernetes/OpenShift.                                           |
| 6                       | Execução e AAP                     | Runner/EE isolados, inventários, credenciais, eventos e integrações Controller.                                                          |
| 7                       | Operator e distribuição            | Ciclo de vida reconciliado, status, upgrades, OLM e releases publicados.                                                                 |

Recursos de IA (§68) e marketplace de fluxos reutilizáveis (§69) permanecem **pendentes e futuros**, sem dependência para a autoria básica.

## Manutenção deste documento

Ao concluir uma entrega, atualizar seu estado, apontar a implementação/testes e registrar limitações. Usar a Definition of Done da spec (§73): comportamento, tratamento de erros, PatternFly, tipos, testes pertinentes, acessibilidade, contratos e compatibilidade das superfícies e do runtime afetados. Não marcar integração como concluída apenas por existir um adapter, parser ou manifesto inicial.
