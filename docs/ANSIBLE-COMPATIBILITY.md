# Compatibilidade Ansible e novos fluxos

## YAML aceito

O editor aceita plays com hosts, variáveis em mapa ou lista de mapas, pre_tasks, roles, tasks, post_tasks e handlers. Listas de variáveis são normalizadas para um mapa; chaves repetidas entre mapas seguem a ordem da lista, com o último valor prevalecendo. Chaves duplicadas dentro do mesmo mapa são rejeitadas.

Literais yes/no/on/off são lidos como booleanos; valores entre aspas continuam strings. Erros de sintaxe, nomes de variáveis com barras indevidas e palavras-chave fora da posição esperada mostram linha e coluna. Não há correção automática de indentação.

```yaml
- hosts: all
  vars:
    - username: sammy
    - create_user_file: yes
  tasks:
    - name: Create file
      ansible.builtin.file:
        path: "/home/{{ username }}/myfile"
        state: touch
      when: create_user_file
```

## Blocos e recuperação

Selecione um bloco e use **Edit block tasks**, **Edit rescue tasks** ou **Edit always tasks**. É possível adicionar blocos dentro desses escopos. Copiar, duplicar, remover, conectar e desfazer percorrem também as sequências de recuperação.

```yaml
- hosts: all
  tasks:
    - name: Work with recovery
      block:
        - name: Work
          ansible.builtin.debug: { msg: work }
      rescue:
        - name: Recover
          ansible.builtin.debug: { msg: recovery }
      always:
        - name: Cleanup
          ansible.builtin.debug: { msg: cleanup }
```

Os escopos mantêm a semântica sequencial de [blocks, rescue e always](https://docs.ansible.com/projects/ansible/latest/playbook_guide/playbooks_blocks.html). Não representam execução paralela nem branching arbitrário. O produto não executa essas tarefas.

## Roles

Use **Roles → Add Role** para uma referência estática do play. Em **Role options and variables**, informe um objeto JSON com opções como vars, tags, when ou parâmetros da role. Pre-tasks e post-tasks possuem escopos próprios. `include_role` e `import_role` estão no catálogo para uso dentro de tasks.

```yaml
- hosts: all
  roles:
    - role: my_role
      vars:
        package_name: nginx
      tags: [setup]
  tasks:
    - name: Include another role
      ansible.builtin.include_role:
        name: another_role
```

A role precisa existir no projeto/ambiente Ansible quando o playbook for validado externamente ou executado. O editor preserva a referência e as opções; não expande, cria nem instala seus arquivos internos. Handlers fornecidos por roles podem não ser conhecidos pela validação básica; referências não resolvidas geram um aviso quando há roles.

## Catálogo e validação

O catálogo incluído tem 20 módulos. Foram adicionados formulários para [apt](https://docs.ansible.com/projects/ansible/latest/collections/ansible/builtin/apt_module.html), replace, [community.general.ufw](https://docs.ansible.com/projects/ansible/latest/collections/community/general/ufw_module.html), include_role e import_role. UFW requer a collection correspondente no ambiente de execução; disponibilizar o formulário não instala a collection.

No VS Code, **Visual Ansible: Discover Ansible Modules** consulta o ansible-doc do Extension Host. O comando exige workspace confiável e permite selecionar até 20 módulos por vez. Os metadados são validados, aplicados somente às Webviews daquele workspace e mantidos na memória da sessão. Use `visualAnsible.ansibleDocPath` para configurar o executável. Falhas preservam o catálogo anterior.

Os formulários suportam opções simples, JSON para listas/mapas e aliases de argumentos. **All arguments** permite editar argumentos não cobertos por um formulário simples. A validação dos metadados não substitui todas as regras condicionais, subopções e dependências do próprio Ansible. Para validar externamente, configure `visualAnsible.validationTool` e execute **Visual Ansible: Validate Playbook** com o arquivo salvo. O Web mantém apenas a validação básica.

## Limites restantes

Aliases YAML, tags explícitas, import_playbook, with_items, includes fora do modelo e blocos em handlers continuam recusados. Módulos FQCN fora do catálogo aceitam argumentos em mapa e recebem aviso de metadados ausentes; nomes curtos só são normalizados quando conhecidos pelo catálogo incluído. Formatação pode ser normalizada. Persistência de layout após aplicação de YAML, descoberta automática de todo o projeto e serviço externo de validação Web continuam no roadmap.
