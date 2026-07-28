# North

Aplicação web mobile-first para educação financeira, acompanhamento manual de
carteira e planejamento de metas. O produto está em fase de planejamento; o
protótipo recebido foi preservado como referência e **não é código de
produção**.

## Estado do repositório

- [Plano de implementação](docs/PLANO_DE_IMPLEMENTACAO.md)
- [Arquitetura e modelo de dados](docs/ARQUITETURA_E_DADOS.md)
- [Baseline de segurança](docs/SEGURANCA.md)
- [Handoff e protótipo originais](docs/reference/prototype/README.md)
- [Política para relatos de vulnerabilidade](SECURITY.md)

O próximo incremento deve criar uma única aplicação Next.js na raiz e a
estrutura local do Supabase. Evitar um monorepo neste momento reduz
complexidade de deploy, dependências e superfície de ataque.

## Princípios obrigatórios

1. Nenhum segredo entra no Git, no bundle do navegador, em logs ou em prompts.
2. `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` são públicos por definição. A
   segurança dos dados depende de grants mínimos e RLS testada; a chave
   `SUPABASE_SECRET_KEY` é exclusiva do servidor e contorna RLS.
3. Toda tabela com dados de usuário começa com RLS bloqueando acesso por
   padrão e testes de isolamento entre duas contas.
4. Cálculos financeiros e regras de suitability são determinísticos. O LLM
   explica resultados, mas não é a fonte da verdade.
5. O PWA nunca armazena respostas autenticadas, carteira, metas ou conversa
   em cache persistente.
6. Preview, desenvolvimento e produção usam projetos Supabase e segredos
   separados. Dados reais não são copiados para ambientes inferiores.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` somente quando a aplicação for
inicializada. O arquivo local já está ignorado pelo Git:

```bash
cp .env.example .env.local
```

Valores reais devem ser criados diretamente nos cofres de cada ambiente da
Vercel e no gerenciador de segredos usado pela equipe. Nunca compartilhe
valores em issues, pull requests, screenshots ou mensagens.

## Estrutura-alvo

```text
src/
  app/                 # rotas e composição de telas
  components/          # componentes visuais compartilhados
  features/            # onboarding, carteira, metas, mercado e assistente
  server/              # DAL, integrações e módulos marcados como server-only
  styles/              # tokens e estilos globais
supabase/
  migrations/          # esquema versionado
  tests/               # pgTAP, incluindo cenários negativos de RLS
tests/
  e2e/                 # jornadas críticas no navegador
docs/
  reference/           # material original, nunca publicado
```

Detalhes, critérios de aceite e decisões pendentes estão nos documentos
listados acima.
