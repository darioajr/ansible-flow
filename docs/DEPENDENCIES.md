# Dependências e referências

pnpm workspaces e Turborepo; Next App Router; TypeScript estrito; React 19; PatternFly 6; React Flow 12; Zustand; Zod; React Hook Form; YAML AST; Vite; esbuild; API VS Code. ESLint, Prettier, Vitest, Playwright, test-electron e vsce cobrem qualidade e empacotamento. As versões exatas estão no lockfile.

Monaco é servido dos assets locais, sem CDN de runtime. Scripts de dependências nativas de assinatura/publicação do vsce foram desabilitados porque não são usados no empacotamento local.

Fontes primárias consultadas: [Next.js](https://nextjs.org/docs/app/getting-started/installation), [PatternFly Page](https://www.patternfly.org/components/page/), [React Flow](https://reactflow.dev/api-reference/react-flow), [Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors), [Webview CSP](https://code.visualstudio.com/api/extension-guides/webview), [Workspace Trust](https://code.visualstudio.com/api/extension-guides/workspace-trust), [Vite build](https://vite.dev/guide/build). As declarações das dependências instaladas e a documentação local de Next.js foram verificadas durante a implementação.
