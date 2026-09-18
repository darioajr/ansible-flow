# Publicação da extensão no Marketplace

O workflow [publish.yml](../.github/workflows/publish.yml) segue o fluxo do [YAML Doctor](https://github.com/darioajr/yaml-doctor-vscode/blob/main/.github/workflows/publish.yml): validação, empacotamento, publicação pelo ambiente `production` e release com VSIX. Aqui ele usa pnpm e os builds compartilhados do monorepo. O destino é o VS Code Marketplace; Open VSX não é publicado por este workflow.

## Configuração inicial

1. Envie este projeto para um repositório GitHub com Actions habilitado. O checkout local ainda não possui remoto configurado. O pipeline preenche `repository`, `homepage` e `bugs` no manifesto do pacote com o repositório em que estiver executando; não altera a versão nem faz commits.
2. Use o publisher **darioajr**, com acesso à publicação da extensão `visual-ansible-extension`. O ID resultante será `darioajr.visual-ansible-extension`.
3. Em **Settings → Environments**, configure o ambiente **production** e suas regras de acesso às tags/branches de release.
4. Nesse ambiente, cadastre o secret **VSCE_PAT** com uma credencial autorizada para esse publisher e escopo **Marketplace → Manage**. Não coloque o token nos arquivos do projeto. O token fica disponível somente no passo de publicação.

A autenticação por PAT acompanha o projeto de referência. A [documentação oficial do VS Code](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) recomenda Microsoft Entra ID para automação e informa a aposentadoria de PATs globais em **1º de dezembro de 2026**. Antes desse prazo, migre a autenticação do job para identidade federada/Entra; o restante do fluxo de pacote permanece aplicável.

## Primeiro ensaio, sem publicar

Em **Actions → Publish VS Code Extension → Run workflow**, selecione a branch, informe a versão já presente em `apps/vscode/extension/package.json` (atualmente `0.2.0`) e deixe **publish** desmarcado.

O job confere versão e publisher, executa lint, tipos, testes da engine com Ansible, build, Playwright e Extension Host real. Depois gera o artefato `marketplace-vsix`, retido por 30 dias. Esse ensaio não usa o PAT e não cria release nem publica no Marketplace.

Instale o VSIX baixado e confira a extensão. Se usava o pacote local antigo `playbook-flow.visual-ansible-extension`, desinstale-o antes de instalar o novo publisher para evitar duas extensões com os mesmos comandos.

## Publicação por tag

Atualize a versão no manifesto da extensão, registre as alterações e envie o commit. Crie uma tag com exatamente a mesma versão:

```bash
# Exemplo da primeira publicação, se 0.2.0 ainda não foi publicada:
git tag v0.2.0
git push origin v0.2.0
```

O envio da tag inicia a publicação automaticamente após as validações e as regras do ambiente `production`. O workflow publica o mesmo VSIX produzido e testado pelo job de pacote. Após sucesso no Marketplace, cria uma GitHub Release com notas geradas e o VSIX anexado. Não são criadas tags automaticamente.

Para publicação manual, execute o workflow com a versão do manifesto e marque **publish**. Esse modo publica no Marketplace, mas não cria tag ou GitHub Release.

## Contrato e falhas

- Somente versões estáveis `X.Y.Z` são aceitas; pré-releases não estão configuradas.
- Divergências entre tag/input e manifesto interrompem o processo antes de publicar.
- A extensão precisa de uma versão nova para cada publicação. Uma versão já publicada causa falha explícita; o pipeline não a sobrescreve nem incrementa silenciosamente.
- Jobs de release são serializados e não cancelam uma publicação em andamento.
- `contents: write` existe apenas no job que cria a GitHub Release. Não é necessário PAT do GitHub para anexar o VSIX.
- Se apenas a criação da GitHub Release falhar após a publicação, reexecute somente os jobs com falha.
- Criar este workflow não configura secrets remotos nem publica a extensão. A execução completa depende de enviar o projeto ao GitHub e configurar a credencial do publisher.
