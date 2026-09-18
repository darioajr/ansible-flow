# Playbook Flow

**Visual automation. Real Ansible.**

Crie e edite playbooks Ansible visualmente no navegador ou no VS Code. O Playbook Flow transforma YAML em um diagrama editável e gera YAML Ansible a partir das alterações, com um editor e uma engine compartilhados entre as duas interfaces.

O projeto está em desenvolvimento ativo: o foco atual é **autoria e validação de playbooks**. A aplicação não executa automações. Consulte o [roadmap](roadmap.md) para acompanhar as entregas e os próximos passos.

## O que já funciona

- Importação de YAML suportado, edição visual e exportação de playbooks.
- Múltiplos plays, variáveis, `become`, `pre_tasks`, roles, tasks, `post_tasks` e handlers.
- Blocos aninhados com `block`, `rescue` e `always`, condições, loops, resultados registrados e notificações.
- Catálogo inicial com 20 módulos, formulários de argumentos e edição de valores complexos em JSON.
- Diagnósticos com localização no YAML e proteção contra escrita visual em construções não suportadas.
- Seleção múltipla, organização de tarefas, copiar/colar interno, duplicação e desfazer/refazer.

| Recurso                | Web                            | VS Code                                             |
| ---------------------- | ------------------------------ | --------------------------------------------------- |
| Armazenamento          | Projetos locais no servidor    | Arquivos YAML do workspace                          |
| Edição textual         | YAML editor → Apply to diagram | Editor de texto nativo, sincronizado com o visual   |
| Salvamento e histórico | Autosave e snapshots da sessão | Save, dirty state e undo/redo nativos               |
| Validação básica       | Engine e catálogo incluído     | Mesma engine e catálogo                             |
| Validação externa      | Ainda não disponível           | `ansible-playbook --syntax-check` ou `ansible-lint` |
| Descoberta de módulos  | Catálogo incluído              | `ansible-doc` no Extension Host                     |
| Layout                 | Salvo no projeto               | Recalculado ao reabrir o arquivo                    |

## Começar pelo Web

Requisitos: **Node.js 22.12+** e **pnpm 11.2.2**. Ansible não é necessário para abrir o editor ou gerar YAML.

Na raiz do projeto:

```bash
corepack enable
corepack prepare pnpm@11.2.2 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Abra **http://localhost:3000** e crie um projeto ou importe um arquivo YAML. Os projetos ficam em `apps/web/data` por padrão; use `DATA_DIR` com um caminho absoluto para alterar o diretório.

O Web funciona em modo local, sem login, e usa persistência JSON com **uma única réplica/processo**. Faça backup do diretório de dados ou do volume. Para disponibilizá-lo em rede, configure autenticação no proxy e o controle de acesso apropriado.

### Experimentar um fluxo completo

Importe [examples/fluxos-complexos.yml](examples/fluxos-complexos.yml): são **3 plays, 90 nós e 10 blocos**, com preparação, implantação canário, rollback e auditoria. As tarefas usam apenas `debug` e `set_fact`.

Troque o play no seletor superior, explore **Pre-tasks**, **Tasks**, **Post-tasks** e **Handlers** e abra os escopos internos dos blocos para ver suas tarefas e caminhos de recuperação.

## Usar no VS Code

Com as dependências instaladas, gere e instale o pacote local:

```bash
pnpm package:vscode
code --install-extension apps/vscode/extension/visual-ansible-extension-0.2.0.vsix --force
```

Também é possível usar **Extensions → Install from VSIX…**. O nome do arquivo acompanha a versão do manifesto; ajuste o caminho em versões futuras.

Abra um workspace e execute **Visual Ansible: Open Playbook Visually**, ou clique com o botão direito em um YAML e escolha **Open With → Visual Ansible Editor**. A extensão não substitui o editor padrão de todos os arquivos YAML.

O publisher configurado é `darioajr`, com ID `darioajr.visual-ansible-extension`. Se usava o VSIX antigo com publisher `playbook-flow`, desinstale a extensão anterior para evitar comandos duplicados. O pipeline está preparado; a publicação no Marketplace ainda depende da configuração e execução da release.

Para validar com Ansible, instale as ferramentas no ambiente do Extension Host e configure `visualAnsible.validationTool`. Em workspaces confiáveis, **Visual Ansible: Discover Ansible Modules** carrega metadados de até 20 módulos por seleção usando `ansible-doc`. Funciona com VS Code Desktop e Remote Development; não há suporte a um Extension Host exclusivamente no navegador.

Veja [comandos, configuração e depuração da extensão](docs/VSCODE.md).

## Temas

O Web oferece **System theme**, **Light theme** e **Dark theme** no cabeçalho, com preferência salva no navegador. A extensão acompanha o tema claro/escuro da janela do VS Code. As interfaces usam os tokens padrão do PatternFly 6, inclusive no canvas e no editor YAML.

## Trabalhar com o diagrama

1. Configure hosts, variáveis e privilégios em **Play properties**. Clique no fundo do canvas para voltar a esse painel.
2. Arraste módulos do catálogo ou use `+`. Selecione uma tarefa para editar seus argumentos e comportamento.
3. Conecte tarefas para reorganizar a sequência. As conexões não representam execução paralela nem ramificações arbitrárias.
4. Nos blocos, use **Edit block tasks**, **Edit rescue tasks** e **Edit always tasks**. Cada sequência tem seu próprio escopo de edição.
5. Cadastre handlers em **Handlers** e use seus nomes em **Notify handlers**. Em **Roles**, adicione referências às roles do play.
6. Valide e salve; no Web, use **Export YAML** para obter o arquivo.

No Web, alterações em **YAML editor** entram no diagrama por **Apply to diagram**. Um rascunho pendente pausa a edição visual; **Discard draft** restaura o YAML do diagrama. Erros preservam o texto para correção. No VS Code, edite o YAML pelo editor de texto nativo e use **YAML preview** para visualizar o conteúdo gerado.

Os campos **Play variables (JSON)** e **All arguments (JSON object)** crescem até 14 linhas, com rolagem para conteúdos maiores e ajuste manual limitado a 320 px. Valores preenchidos aparecem em negrito; sugestões, em cinza itálico.

## Executar com Podman ou Docker

Com Podman no macOS, inicie a VM previamente com `podman machine start`:

```bash
podman build --format docker -t localhost/playbook-flow:0.2.0 .
podman run --rm --name playbook-flow \
  -p 127.0.0.1:3000:3000 \
  --read-only --tmpfs /tmp \
  -v playbook-flow-data:/data \
  localhost/playbook-flow:0.2.0
```

O volume preserva os projetos. `--format docker` mantém o `HEALTHCHECK` da imagem.

Com Docker:

```bash
docker build -t playbook-flow:0.2.0 .
docker run --rm --name playbook-flow \
  -p 127.0.0.1:3000:3000 \
  --read-only --tmpfs /tmp \
  -v playbook-flow-data:/data \
  playbook-flow:0.2.0
```

Existem manifests iniciais em [deploy/kubernetes](deploy/kubernetes) e [deploy/openshift](deploy/openshift). Ajuste registry, imagem, armazenamento e acesso antes de aplicar. Eles usam uma réplica com PVC; a homologação completa em clusters permanece no roadmap.

## Desenvolvimento e testes

```bash
pnpm lint
pnpm typecheck
pnpm test
node --test scripts/prepare-marketplace-release.test.mjs
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:extension
```

Com Ansible instalado, `RUN_ANSIBLE_SYNTAX=1 pnpm test` inclui verificações reais de sintaxe e descoberta de módulos. Os testes do Extension Host usam um VS Code isolado; no Linux, execute-os com Xvfb. Para depurar, use a configuração F5 **Visual Ansible Extension**.

```text
apps/web                  Aplicação Next.js, API e persistência local
apps/vscode/extension     Extension Host, workspace, comandos e diagnósticos
apps/vscode/webview       Interface React/Vite e protocolo de mensagens
packages/air              Modelo intermediário e operações de grafo
packages/parser           YAML → modelo, com localização de origem
packages/generator        Modelo → YAML
packages/validator        Regras de domínio
packages/module-metadata  Catálogo e leitura de ansible-doc
packages/schemas          Contratos Zod e protocolo da Webview
packages/editor           Editor compartilhado: PatternFly, React Flow e Zustand
```

Para contribuir, descreva o problema, mantenha as regras de domínio nos pacotes compartilhados e acrescente testes relevantes. Alterações devem respeitar os contratos das duas interfaces. Consulte [DEVELOPMENT.md](docs/DEVELOPMENT.md) e a [spec](spec.md).

## CI e publicação

[Verify](.github/workflows/ci.yml) executa lint, tipos, testes, builds, E2E, testes nativos do VS Code, empacotamento, build do container e scan Trivy.

[Publish VS Code Extension](.github/workflows/publish.yml) valida a versão, gera o VSIX e publica no Marketplace com o publisher `darioajr`. Tags `vX.Y.Z` iniciam a publicação; a execução manual permite apenas validar e empacotar. Releases por tag anexam o VSIX ao GitHub após sucesso no Marketplace.

Configure o ambiente `production` e o secret `VSCE_PAT` conforme [PUBLISHING.md](docs/PUBLISHING.md). A versão da tag deve coincidir com a do manifesto da extensão. A publicação de imagens ainda não está implementada.

## Limites atuais

- A aplicação não executa playbooks. Runner, AAP/AWX, inventários e credenciais estão previstos para fases futuras.
- Autenticação, RBAC, colaboração, integração Git, persistência compartilhada, Helm e Operator ainda não estão completos.
- Aliases YAML, tags explícitas, `import_playbook` e construções não representadas bloqueiam a escrita visual. O arquivo original é preservado.
- Roles são referências; seus arquivos internos não são expandidos pelo editor.
- O gerador preserva comentários e valores suportados, mas pode normalizar formatação e nomes de módulos. Não há garantia de reprodução byte a byte.
- A validação básica não substitui o Ansible nem cobre todas as opções dos módulos. Módulos e collections precisam existir no ambiente quando usados com ferramentas externas.
- Não armazene segredos nos projetos. Use referências Jinja e credenciais externas; a validação de campos conhecidos não é um detector geral de segredos.

## Documentação

| Documento                                                | Conteúdo                                   |
| -------------------------------------------------------- | ------------------------------------------ |
| [Roadmap](roadmap.md)                                    | Entregas concluídas, lacunas e prioridades |
| [Compatibilidade Ansible](docs/ANSIBLE-COMPATIBILITY.md) | YAML suportado, blocos, roles e limites    |
| [Arquitetura](docs/ARCHITECTURE.md)                      | Engine compartilhada e adapters            |
| [API](docs/API.md)                                       | Contratos do Web                           |
| [VS Code](docs/VSCODE.md)                                | Extensão, validação e depuração            |
| [Desenvolvimento](docs/DEVELOPMENT.md)                   | Ambiente e convenções                      |
| [Publicação](docs/PUBLISHING.md)                         | Pipeline, credenciais e releases           |
| [Dependências](docs/DEPENDENCIES.md)                     | Tecnologias e referências                  |
| [ADR 001](docs/ADR/001-shared-engine.md)                 | Decisão sobre engine compartilhada         |

## Licença

O Playbook Flow é distribuído sob a [Apache License 2.0](LICENSE). A escolha permite uso, modificação e distribuição, inclusive comercial, e inclui uma concessão explícita de direitos de patente pelos contribuidores nos termos da licença. As condições completas estão no [texto oficial](https://www.apache.org/licenses/LICENSE-2.0).

Copyright © 2026 Playbook Flow contributors. O [NOTICE](NOTICE) registra a atribuição do projeto. O aviso [MIT anterior](LICENSE-MIT) permanece preservado para o código originalmente distribuído nesses termos; licenças já concedidas não são revogadas. Bibliotecas e assets de terceiros mantêm suas próprias licenças.
