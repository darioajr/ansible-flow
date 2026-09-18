# VS Code

## Desenvolvimento e distribuição

`pnpm build` gera Web, Webview e Extension Host. `pnpm package:vscode` cria o VSIX. O publisher configurado é `darioajr`. O pipeline de publicação está descrito em [Publicação no Marketplace](PUBLISHING.md); criar o pipeline não publica a extensão automaticamente. Ao migrar de um VSIX local com publisher `playbook-flow`, desinstale a extensão antiga para evitar comandos duplicados.

F5 usa `.vscode/launch.json`. O pacote não contém Next.js: `dist/extension.cjs` roda no host, e `media` contém assets Vite + Monaco local.

## Arquivos e sincronização

Open With é opt-in (`priority: option`). O comando Open verifica que o arquivo contém plays Ansible. A árvore mostra até 200 candidatos YAML no workspace, sem executar arquivos.

A Webview recebe texto, versão e nome pelo canal validado Zod. Alterações enviam AIR e versão. O host reconcilia com o documento e aplica WorkspaceEdit apenas ao URI vinculado. Save chama TextDocument.save. Undo/redo usa comandos nativos; mudanças externas atualizam a Webview. Colisões são rejeitadas para evitar sobrescrita silenciosa.

Construtos não suportados mostram texto original e problemas, sem permitir escrita visual. Diagnostics do AIR usam linhas do parser. A precisão de CLI depende das localizações retornadas pela ferramenta; syntax-check usa linha indicada na saída quando disponível.

## Segurança e execução remota

CSP começa com default-src none, scripts com nonce e origem restrita aos recursos da Webview. Não há unsafe-eval. Estilos inline são necessários ao React Flow/PatternFly. Recursos são limitados ao diretório media. YAML nunca é interpolado no HTML inicial.

`extensionKind: workspace` coloca os comandos no host remoto quando apropriado. Workspace Trust restringe os executáveis configuráveis. Ferramentas usam argumentos separados, timeout de 30 segundos e saída limitada a 1 MB.

Validação padrão é core. Configure `visualAnsible.validationTool` para syntax-check ou ansible-lint e caminhos correspondentes. Execute Validate explicitamente; o documento deve estar salvo para checks externos. Nenhum playbook é executado ao abrir, e execução de automação não está implementada.

`pnpm test:extension` baixa VS Code isolado e testa ativação, custom editor, WorkspaceEdit, dirty/save, undo/redo, diagnostics e reabertura. E2E Playwright também carrega o editor Vite e exercita o protocolo com o mesmo serviço de documentos.

## Descobrir módulos instalados

1. Abra um playbook em um workspace confiável.
2. Execute **Visual Ansible: Discover Ansible Modules** na paleta.
3. Selecione até 20 módulos por vez. Os formulários entram no catálogo de todas as Webviews desse workspace.

Configure `visualAnsible.ansibleDocPath` quando `ansible-doc` não estiver no PATH do Extension Host. A descoberta usa `ansible-doc --list --json --type module` e carrega a documentação JSON dos módulos selecionados. Metadados ficam na memória da sessão e podem ser recarregados pelo mesmo comando; não há instalação automática de collections. O Web continua usando o catálogo incluído.

Diagnostics externos interpretam os formatos atual e legado do syntax-check e localizações JSON do ansible-lint. O comando de validação também atualiza Problems na Webview. Mensagens de outros arquivos mantêm o nome do arquivo no texto em vez de selecionar incorretamente um nó do playbook atual. A edição visual permite pre-tasks, roles, tasks, post-tasks e handlers; blocos expõem as sequências block/rescue/always.
