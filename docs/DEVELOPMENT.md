# Desenvolvimento

Instale com pnpm 11.2.2, Node 22.12+. O lockfile é versionado. `pnpm dev` prepara Monaco local e inicia o Web. `pnpm build` usa Turborepo para compilar os três bundles; extensão depende do build da Webview.

`pnpm lint` verifica TypeScript/ESLint e fronteiras dos pacotes. `pnpm typecheck` verifica shared, Vite, host e Next. `pnpm test` cobre engine/API/protocolo; RUN_ANSIBLE_SYNTAX=1 também verifica o gerador com a CLI instalada. Playwright usa portas 3100/3101 e DATA_DIR temporário. Testes nativos do VS Code usam um perfil/workspace isolado; Linux precisa Xvfb.

Adicione módulos pelo contrato ModuleMetadata; não duplique formulários por plataforma. Novas capacidades entram em EditorHost e adapters, não em condicionais de Next/VS Code no domínio. Para execução, crie um serviço isolado em vez de invocar Ansible no processo Web.

Persistência JSON é single-process. Faça backup do volume e substitua o adapter antes de escalar. Não há migração de banco ou secrets nesta fase.
