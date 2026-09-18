# API v1

| Método | Caminho                          | Contrato                                                |
| ------ | -------------------------------- | ------------------------------------------------------- |
| GET    | `/api/v1/projects`               | lista de resumos                                        |
| POST   | `/api/v1/projects`               | `{name, description?}` → projeto AIR, 201               |
| GET    | `/api/v1/projects/:id`           | projeto completo                                        |
| PUT    | `/api/v1/projects/:id`           | projeto completo + revisão atual → revisão incrementada |
| DELETE | `/api/v1/projects/:id`           | body `{}` → 204                                         |
| GET    | `/api/v1/projects/:id/playbooks` | lista de playbooks                                      |
| POST   | `/api/v1/projects/:id/playbooks` | `{name}` → projeto atualizado                           |
| POST   | `/api/v1/playbooks/import`       | `{name, yaml}` → `{playbook, problems, editable}`       |
| POST   | `/api/v1/playbooks/:id/generate` | `{playbook?: AIR}` → `{yaml, problems}`                 |
| POST   | `/api/v1/playbooks/:id/validate` | `{playbook?: AIR}` → `{problems, checks, unavailable}`  |
| GET    | `/api/v1/modules`                | catálogo de metadados                                   |
| GET    | `/api/v1/modules/:fqcn`          | módulo                                                  |
| GET    | `/api/health`                    | liveness                                                |
| GET    | `/api/ready`                     | acesso ao diretório de dados                            |

Erros: `{error: {code, message, details}}`. 400 input, 403 origem, 404 inexistente, 409 revisão, 413 tamanho, 415 content type, 422 regras/importação, 500 falha interna.

Corpos mutáveis exigem application/json e limite de 1 MB. Origem diferente da URL pública é recusada; clientes CLI sem Origin são permitidos no modo local. Configure o proxy preservando a origem pública. PUT não é upsert. Em 409, recarregue e concilie mudanças.

O schema AIR é publicado em packages/schemas. Identidades são UUIDs. Nenhum endpoint executa comandos ou recebe caminhos arbitrários. Não há login nesta fase; exposição compartilhada exige proxy autenticado.
