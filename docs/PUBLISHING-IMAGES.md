# Publicar imagens de container

O workflow [Publish container images](../.github/workflows/publish-images.yml) publica a aplicação Web nestes destinos:

| Registry                  | Imagem                            |
| ------------------------- | --------------------------------- |
| Docker Hub                | `docker.io/darioajr/ansible-flow` |
| GitHub Container Registry | `ghcr.io/darioajr/ansible-flow`   |
| Quay                      | `quay.io/darioajr/ansible-flow`   |

Cada release estável recebe as tags `X.Y.Z` e `latest`, ambas com `linux/amd64` e `linux/arm64`. O nome dos destinos fica no bloco `env` do workflow.

## Configuração inicial

1. Crie os repositórios públicos `darioajr/ansible-flow` no Docker Hub e no Quay. No Quay, um robot account com permissão de escrita pode publicar no namespace `darioajr`.
2. No GitHub, configure os seguintes secrets em **Settings → Environments → production** (o mesmo ambiente usado pelo Marketplace):

   | Secret            | Conteúdo                                                |
   | ----------------- | ------------------------------------------------------- |
   | `DOCKERHUB_USER`  | Usuário do Docker Hub, normalmente `darioajr`           |
   | `DOCKERHUB_TOKEN` | Token com permissão de escrita no repositório           |
   | `QUAY_USER`       | Usuário ou robot account, por exemplo `darioajr+github` |
   | `QUAY_TOKEN`      | Token com permissão de escrita no repositório do Quay   |

3. O GHCR usa o `GITHUB_TOKEN` automático com `packages: write`; não precisa de PAT adicional. Se o pacote já existir, conceda acesso de Actions a este repositório nas configurações do pacote. Após a primeira publicação, ajuste a visibilidade do pacote para pública para permitir pull anônimo.
4. Permita tags de release nas regras do ambiente `production`. Se houver revisores obrigatórios, os jobs aguardarão aprovação. Runners ARM64 hospedados precisam estar disponíveis para o repositório.

## Validar sem publicar

Em **Actions → Publish container images → Run workflow**, selecione a branch e mantenha `publish` desmarcado. As duas arquiteturas são construídas em runners nativos, verificadas pelo Trivy e iniciadas para testar `/api/ready`. Nenhum login ou push é feito nesse modo; as regras de aprovação do ambiente ainda se aplicam.

## Publicar

A versão de `package.json` deve ser estável, no formato `X.Y.Z`. Para publicar `0.1.0`, com o workflow e as mudanças já commitados e enviados:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Essa tag também dispara o workflow existente do Marketplace; mantenha a versão do manifesto da extensão alinhada e configure `VSCE_PAT` para esse fluxo. As publicações de imagens e extensão são independentes.

Se a tag já existir ou você quiser publicar somente as imagens, execute manualmente **Publish container images** selecionando a tag da release e marque `publish`. O workflow usa a versão de `package.json` daquela referência.

O scan bloqueia vulnerabilidades HIGH/CRITICAL com correção disponível, conforme o Verify. Cada arquitetura aprovada é enviada com uma tag intermediária `build-<run-id>-<arquitetura>`. Somente quando ambas passam, o job final cria os manifests de versão e `latest` nos três registries. As tags intermediárias podem ser removidas depois da publicação bem-sucedida, preservando os manifests referenciados pelas tags finais.

A publicação entre registries não é uma transação: em caso de indisponibilidade de um destino, outros podem já ter recebido a imagem. Use **Re-run failed jobs** na mesma execução após corrigir credenciais ou disponibilidade. As tags intermediárias são reutilizadas nessa retomada. Publicar novamente uma versão substitui suas tags; use versões novas para releases novas. `latest` aponta para a última publicação concluída, inclusive se você republicar uma versão antiga.

## Conferir a imagem

```bash
podman manifest inspect docker.io/darioajr/ansible-flow:0.1.0
podman manifest inspect ghcr.io/darioajr/ansible-flow:0.1.0
podman manifest inspect quay.io/darioajr/ansible-flow:0.1.0
podman run --rm -p 127.0.0.1:3000:3000 \
  --read-only --tmpfs /tmp -v playbook-flow-data:/data \
  ghcr.io/darioajr/ansible-flow:0.1.0
```

O pipeline foi baseado no [YAML Doctor Docker](https://github.com/darioajr/yaml-doctor-docker/blob/main/.github/workflows/release.yml), ampliado para três registries e validação antes das tags finais.
