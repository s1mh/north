# North — App assessor de investimentos

Contexto persistente do projeto (ler antes de qualquer tela nova).

## Produto
- Assessor de investimentos com IA no core (modelo básico via API). Deploy: Vercel. Banco: Supabase.
- Público: todos os perfis (o onboarding classifica via suitability).
- Idioma: PT-BR. Moeda: BRL.

## Direção visual (escolhida)
- Nome: **North**. Direção **Editorial / Pós-moderno** (opção 1a): fundo paper #EFEDE7, tipografia Archivo (display 800/900), blocos de cor pastel por classe de ativo, anotações editoriais, tinta #12110E.
- Classes → cores: Renda Fixa #F2C9D0 · Ações #E9DE9E · FIIs #A8E2DC · Fundos #CDE5C4 · Cripto #D9CDEE · Internacional #F2D3B6 · Caixinhas #C9D8EE.
- Menu inferior: **pílula frosted/liquid glass** flutuante (formato de texto do home-a é o preferido).

## Regras de conteúdo da IA (IMPORTANTES)
- **Sem Open Finance no MVP.** A IA NÃO sabe saldo em conta corrente. Nunca escrever coisas como "você tem R$ X parados na conta".
- As sugestões se baseiam APENAS no que o app conhece: perfil de investidor, carteira registrada no app, metas e dados de mercado. Ex.: rebalancear porque uma classe passou do alvo do perfil, oportunidade de renda fixa dado o nível da Selic, ritmo pra bater a meta.
- Postura **educacional**: sempre com disclaimer "Sugestão educacional. Não é recomendação de investimento." (regulação CVM).
- Não usar o rótulo "(assessor)" nos cards.

## Bancos
- Lista dos principais + opção de adicionar manualmente. Ao adicionar um banco manual, a IA pesquisa/sintetiza e disponibiliza os produtos que aquele banco oferece.

## Dados de mercado
- Atualização diária pós-fechamento: Ibovespa/B3, dólar/câmbio, Selic/CDI, cripto, mercado internacional, watchlist, notícias com resumo da IA.
