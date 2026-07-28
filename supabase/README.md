# Supabase

Diretório reservado ao schema versionado do North. A stack local ainda não
foi inicializada.

Estrutura esperada no primeiro incremento:

```text
supabase/
  config.toml
  migrations/
  seed.sql
  tests/
    rls/
    schema/
```

Regras:

- toda alteração de schema é uma migration revisada;
- toda tabela privada habilita RLS na mesma migration em que nasce;
- `seed.sql` contém somente dados sintéticos;
- testes pgTAP cobrem grants, policies e isolamento entre dois usuários;
- nenhum dump, senha, connection string ou chave entra neste diretório;
- alterações manuais no Dashboard devem ser reproduzidas em migration antes
  de promover ambiente.

Quando a CLI for adicionada, os gates mínimos serão:

```bash
supabase db reset
supabase test db
```
