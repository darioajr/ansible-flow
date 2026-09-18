# ADR 001 — Um engine para Web e VS Code

Status: aceito para o MVP v2.

A especificação atualizada exige comprovar dois clientes no primeiro marco. Foram criados os sete pacotes mínimos em um monorepo pnpm/Turborepo, antes dos adapters de plataforma.

Decisões:

1. Editor único, instância de store por montagem, capacidades injetadas por EditorHost.
2. Arrays AIR representam execução sequencial. Conectar reordena, impedindo ciclos por construção. Branching futuro exige um modelo explícito.
3. CustomTextEditorProvider usa o documento nativo e WorkspaceEdit, evitando replicar o mecanismo de persistência/undo do VS Code. O editor customizado tem prioridade `option` para não capturar todos os YAMLs.
4. Importações não representáveis são somente leitura/recusadas, preservando o original. O primeiro parser é limitado e não afirma suporte completo a Ansible.
5. Preservar AST/comentários onde possível, com fonte/caminho como metadados; o YAML continua o artefato portátil.
6. Adapter Web em arquivos atômicos para o MVP sem infraestrutura externa. Escalar exige banco e locks entre processos. A API e os serviços não dependem dessa escolha.
7. Pacotes internos exportam TypeScript para bundlers; extensão final é um bundle Node + assets Vite, sem dependências pnpm no runtime do VSIX.
8. Layout VS Code é transitório; evitar sidecar proprietário. Web persiste layout fora do domínio Ansible.
9. Metadados locais extensíveis, parser de ansible-doc compartilhado; discovery dinâmico permanece para a próxima fase.

Consequências: o mesmo input AIR produz o mesmo YAML nos dois clientes. O VS Code exige host Node, enquanto o núcleo permanece compatível com browser. Não se implementam Git, execução, RBAC ou Operator nesta fase.

## Atualização — 18/09/2026

A descoberta de metadados prevista no item 9 foi implementada no Extension Host, com cache por workspace na sessão e distribuição por mensagens validadas. O editor recebe o catálogo pela porta `EditorHost`, preservando a independência de plataforma.
