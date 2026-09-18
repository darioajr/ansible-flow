# Arquitetura

```text
AIR ← parser ← YAML
 ↓
editor compartilhado → generator → YAML
 ↑                          ↑
Next.js adapter       VS Code adapter
HTTP / JSON           mensagens / WorkspaceEdit
```

As regras do domínio ficam em packages independentes de plataforma. AIR não contém Node/Edge do React Flow. O editor recebe `EditorHost`; nenhum pacote compartilhado importa `next/*` ou `vscode`. A regra é verificada em `pnpm lint`.

Pacotes usam exports TypeScript e são compilados pelos bundlers das aplicações. Next transpila explicitamente os workspaces, Vite compila a Webview, esbuild empacota o Extension Host (com `vscode` externo). Não há duas implementações de AIR, parser ou gerador.

Cada instância do editor tem seu próprio store Zustand. Arrays AIR definem a sequência. Conectar reposiciona o destino; blocos possuem escopos de tarefas e handlers ficam separados. `notify` associa por nome. Layout é metadado de projeto e não vai para o YAML.

## Parser e gerador

O parser verifica tamanho, sintaxe, chaves duplicadas, profundidade, aliases/tags e formato de playbook. Associa caminhos e posições YAML aos nós AIR. Aceita módulos builtin curtos e FQCN, argumentos em mapas e free-form command/shell, normalizando estes para `cmd`.

Preserva opções comuns de plays/tarefas em `extra`: gather_facts, serial, strategy, vars_files, become_user, retries/until, no_log e outras. O parser recusa valores cujo tipo não é representado, em vez de convertê-los silenciosamente.

Unknown keywords, with_items, import_playbook, includes fora do modelo, tags explícitas e aliases tornam o documento somente leitura. O VS Code mostra o motivo e o texto original; o Web recusa a importação antes de alterar um projeto. Não existe transformação parcial silenciosa de arquivos não suportados.

O gerador reconcilia os valores AIR com a árvore YAML original, reutilizando os nós de origem para manter comentários associados quando tarefas são reordenadas. Argumentos novos são ordenados, FQCN é emitido e tipos são preservados. Formatação pode ser normalizada; fidelidade semântica é testada, preservação byte a byte não é prometida.

## Adapters

Web: Route Handler → serviço de aplicação → adapter de arquivos. JSON temporário + rename, revisão otimista, fila de escrita de um processo. Drafts incompletos podem ser salvos, mas a exportação exige validação sem erros. Uma réplica é obrigatória.

VS Code: CustomTextEditorProvider vincula cada Webview a um TextDocument. Mensagens não recebem caminhos ou comandos arbitrários. Cada alteração carrega versão do documento; conflitos recarregam o estado atual. WorkspaceEdit mantém undo/redo, dirty e save nativos. A fila Webview serializa versões, sem substituir mudanças externas por mensagens atrasadas.

CLI: porta AnsibleCommandRunner implementada apenas no Extension Host. Usa execFile, argumentos separados, timeout e limite de saída. Workspace Trust é verificado imediatamente antes de usar comandos. O Web não importa esse adapter.

## Roles, recuperação e metadados descobertos

AIR mantém `rescue` e `always` como listas opcionais de cada bloco, e `roles`, `pre_tasks` e `post_tasks` como escopos do play. As operações recursivas de cópia, remoção, patch e validação percorrem todos esses escopos. Roles estáticas são nós `ROLE` com nome e opções preservadas; include_role/import_role são invocações normais de módulo dentro de tasks. Não há expansão automática do conteúdo dos arquivos da role.

O parser aceita vars em mapa/lista de mapas e normaliza os booleanos Ansible yes/no/on/off sem converter strings entre aspas. Erros apontam linha/coluna e sugerem a estrutura esperada; o texto inválido não é reparado silenciosamente.

O catálogo base permanece compartilhado. Descoberta no VS Code usa ansible-doc mediante comando explícito e Workspace Trust; o Extension Host valida os metadados, mantém cache por workspace na sessão e envia uma mensagem `modules` tipada para suas Webviews. Cada instância do editor tem seu catálogo, sem modificar um registro global compartilhado entre workspaces. Não há execução de ansible-doc pelo processo Web.
