# North — Handoff de engenharia

Assessor de investimentos com IA no core. Este documento é o contrato de handoff para construção no **Claude Code**. Design de referência nos arquivos `North - Mock.dc.html` (protótipo navegável, com modo escuro) e `North - App.dc.html` (biblioteca de todas as telas + painel "Decisões finais").

---

## 1. Produto

- **O que é:** app mobile-first (PWA) que ajuda a pessoa a investir e atua como assessor. A IA raciocina sobre o que o app conhece e devolve orientações **educacionais**.
- **Público:** todos os perfis. O onboarding classifica via questionário de suitability.
- **Idioma:** PT-BR. **Moeda:** BRL.
- **Plataforma:** web mobile-first / PWA. Deploy **Vercel**. Banco **Supabase**. IA por **API** (modelo básico).

---

## 2. Stack & arquitetura

| Camada | Escolha | Notas |
|---|---|---|
| Front | Next.js (App Router) na Vercel | PWA, mobile-first, tema claro/escuro |
| Auth | Supabase Auth (e-mail/senha) | cadastro no onboarding |
| DB | Supabase (Postgres + RLS) | RLS por `user_id` em todas as tabelas |
| IA | API de LLM (server-side) | chamadas só no backend; nunca expor chave no client |
| Dados de mercado | job diário pós-fechamento | cron da Vercel grava snapshot no Supabase |

**Regra de ouro de segurança:** a chave da IA e as integrações de mercado ficam **no servidor** (route handlers / edge functions). O client nunca fala direto com o provedor de IA.

---

## 3. Regras de conteúdo da IA (CRÍTICO — reveja antes de qualquer prompt)

1. **Sem Open Finance no MVP.** A IA **não** sabe saldo em conta corrente. Nunca gerar frases como "você tem R$ X parados na conta".
2. As sugestões se baseiam **apenas** no que o app conhece: **perfil de investidor + carteira registrada no app + metas + dados de mercado**. Ex.: rebalancear porque uma classe passou do alvo do perfil; oportunidade de renda fixa dado o nível da Selic; ritmo de aporte para bater a meta.
3. **Postura educacional.** Toda saída da IA carrega o disclaimer: **"Sugestão educacional. Não é recomendação de investimento."** (regulação CVM).
4. **Voz / copy:** sem persona "IA" ou "Bússola". O próprio **North** orienta, em voz humana ("a gente", "pra você", "sugestão"). O chat se chama **North · seu assessor**. Tom amigável e didático.
5. Não usar o rótulo "(assessor)" nos cards.

**Superfícies da IA:** insights no Início ("Sugestões pra você"), chat (North), distribuição no Investir, plano das metas, resumo do fechamento no Mercado, síntese de produtos de banco adicionado manualmente.

---

## 4. Design system

### 4.1 Direção
Editorial / pós-moderno. Tipografia display grande, blocos de cor pastel por classe de ativo, anotações, muito respiro. Referências: Revolut/Wise + pós-modernismo.

### 4.2 Tipografia
- **Família única:** `Archivo` (Google Fonts), pesos 400–900.
- Display/números: 800/900, `letter-spacing:-.02em a -.04em`.
- Labels de seção: 600, 10px, `letter-spacing:.13em`, `text-transform:uppercase`, cor muted.
- Mínimos: texto ≥ 12px; toques ≥ 44px.

### 4.3 Tokens de cor (tema claro / escuro)
Implementar como CSS custom properties com troca via classe/atributo no root do app.

| Token | Claro | Escuro |
|---|---|---|
| `--bg` | `#EFEDE7` | `#1B1814` |
| `--ink` (texto/borda/ícone; e fundo de CTA) | `#12110E` | `#F1EFEA` |
| `--oncta` (texto sobre CTA) | `#F5F4EF` | `#1B1814` |
| `--muted` | `#6B6659` | `#ADA79B` |
| `--muted2` | `#9A9488` | `#8E887C` |
| `--line` (hairlines/tracks) | `#E3E1DA` | `rgba(255,255,255,.15)` |
| `--hair` | `rgba(0,0,0,.1)` | `rgba(255,255,255,.1)` |
| `--track` (barra de progresso) | `rgba(18,17,14,.16)` | `rgba(255,255,255,.2)` |
| `--glass` (menu frosted) | `rgba(249,248,243,.62)` | `rgba(24,21,17,.6)` |
| `--oncol` (texto sobre bloco de classe) | `rgba(18,17,14,.6)` | `rgba(255,255,255,.66)` |

CTA/nav ativo: fundo `--ink`, texto `--oncta` (inverte sozinho no dark). Splash é tela de marca escura nos dois temas (`#131210` / texto `#F6F5F0`).

### 4.4 Cores por classe de ativo (claro → escuro/jewel)
| Classe | Token | Claro | Escuro |
|---|---|---|---|
| Renda Fixa | `--rf` | `#F2C9D0` | `#5E2C37` |
| Ações | `--ac` | `#E9DE9E` | `#575121` |
| FIIs | `--fi` | `#A8E2DC` | `#1E4E48` |
| Fundos | `--fu` | `#CDE5C4` | `#2F4B2B` |
| Cripto | `--cr` | `#D9CDEE` | `#403458` |
| Internacional | `--intl` | `#F2D3B6` | `#5C3F23` |
| Caixinhas | `--cx` | `#C9D8EE` | `#263A57` |

Semânticos: alta `#1E7A4D` · queda `#B4442F` · destaque editorial `#C08A72` (usar iguais nos dois temas).

### 4.5 Componentes
- **Menu inferior:** pílula flutuante **frosted/liquid glass** (`backdrop-filter: blur(18px) saturate(1.5)`, borda translúcida, sombra). Itens fixos: **Início · Investir · Carteira · Mercado**. Item ativo = pílula sólida `--ink`.
- **CTA primário:** pílula full-width, fundo `--ink`, texto `--oncta`, `padding:15px`, `font:700 14px`. Altura consistente em todas as telas.
- **Cartão de classe:** bloco `border-radius:12–16px`, fundo do token da classe, texto `--ink`.
- **Cartão editorial:** borda `1.5px solid --ink`, `border-radius:5px` (usado em insights, "Vale a pena?", resumos).
- **Status bar** mock: 9:41 + bateria (só para o protótipo; no app real usa a nativa).
- **Atalhos do Início:** 4 quadrados (`Assistente · Investir · Metas · Produtos`) — Assistente em 1º, swatch com gradiente cônico dos pastéis.
- **Gráficos:** SVG (área com preenchimento translúcido para preço; barras para volume/rentabilidade). Seletor de período 1D · 1S · 1M · 3M · 6M · 1A.

---

## 5. Modelo de dados (Supabase — esboço)

> Sem Open Finance: a carteira é **fonte da verdade mantida pelo usuário** (registro manual + o que investe via app). Valores factuais = preço de mercado (fechamento diário) × quantidade.

- **profiles** — `id (=auth.uid)`, `nome`, `email`, `perfil_suitability` (`conservador|moderado|arrojado`), `suitability_respostas jsonb`, `theme` (`light|dark`), `created_at`.
- **banks** — catálogo dos principais + `is_custom bool`. Ao adicionar banco manual, a IA pesquisa/sintetiza os produtos.
- **user_banks** — `user_id`, `bank_id`. (vínculos simulados no MVP)
- **products** — `bank_id`, `classe` (enum das 7 classes), `nome`, `descricao`, `taxa`, `liquidez`, `vencimento`, `minimo`, `protecao` (ex.: FGC), `fonte` (ex.: "sintetizado pela IA de fontes públicas").
- **holdings** — `user_id`, `classe`, `ativo` (ticker/nome), `quantidade`, `preco_medio`, `bank_id?`, `origem` (`manual|north`).
- **goals** — `user_id`, `tipo` (`aposentadoria|viagem|imovel|carro|reserva|personalizada`), `nome`, `valor_alvo`, `prazo`, `aporte_mensal`, `valor_atual` (derivado).
- **market_snapshots** — `data`, `ibov`, `usd`, `selic`, `cdi`, `btc`, `sp500`, `nasdaq` … (1 linha/dia pós-fechamento).
- **watchlist** — `user_id`, `ativo`.
- **news** — `data`, `categoria`, `titulo`, `resumo` (feito pela IA), `fonte`, `url`, `img_url`.
- **ai_suggestions** (opcional, cache/auditoria) — `user_id`, `tipo`, `payload jsonb`, `disclaimer`, `created_at`.

RLS: tudo por `user_id`, exceto `banks/products/market_snapshots/news` (leitura pública autenticada).

---

## 6. Dados de mercado (job diário)
Cron da Vercel **após o fechamento** grava `market_snapshots` e atualiza `news` (com resumo gerado pela IA). Fontes: Ibovespa/B3, dólar/câmbio, Selic/CDI, cripto, internacional (S&P/Nasdaq). Watchlist e detalhe de ativo leem desse snapshot + histórico.

---

## 7. Mapa de telas & navegação

Fonte visual: `North - Mock.dc.html` (interativo) e `North - App.dc.html` (variações ★ = escolhida).

**Onboarding (pré-login, sequência):**
`splash → cadastro (nome/e-mail/senha + termos) → seus bancos (lista principais + adicionar manual → IA sintetiza produtos) → suitability (12 perguntas, 1 por vez) → resultado do perfil (Moderado + carteira-alvo) → Início`

**App (logado) — tabs:**
- **Início** (`home-a` ★): patrimônio, barra de distribuição, atalhos, **Sugestões pra você** (insights educacionais), hero de meta, feed de notícias (imagem + prévia + "Ler completo").
- **Investir** (`inv-d`/`inv-e` ★): seletor **Livre / Para uma meta**; aporte **único / mensal**; distribuição vinda do **perfil** (editável); estimativa; "Aplicar". Alocação por classe **+ exemplos de produtos**.
- **Carteira** (`cart-d` ★): patrimônio, rentabilidade (gráfico + vs CDI), blocos por classe com holdings detalhados; **+ Ativo** (registro manual).
- **Mercado** (`merc-d` + `merc-e` ★): índices, resumo do fechamento, **Entenda o dia** (didático p/ iniciantes), watchlist, altas/baixas, manchetes → **detalhe do ativo** (gráfico de área, períodos 1D–1A, indicadores).

**Fora das tabs (drill-in / atalhos):**
- **Assistente (North)** — chat educacional; abre pelo atalho e pelos insights.
- **Metas** — lista (predefinidas + **personalizadas**: nome livre); detalhe com **plano sugerido**; criar nova.
- **Produtos** — por banco → **Oportunidades pra você** → **detalhe do produto** ("Vale a pena?" + "Simular no Investir").
- **Perfil / ajustes** — conta, perfil (refazer suitability → volta ao Perfil), bancos/produtos, metas, aportes recorrentes, notificações, **Modo escuro**.

**Regras de navegação:** menu = 4 tabs fixas. Drill-ins usam **voltar com histórico** (retorna de onde veio). "Refazer perfil" reusa o questionário e **volta ao Perfil** (não reentra no onboarding).

---

## 8. Prioridades de build (sugestão)
1. Auth + onboarding + suitability → grava `profiles`.
2. Carteira manual (holdings) + cálculo de patrimônio/distribuição.
3. Job de mercado + Início (patrimônio, distribuição, notícias).
4. Investir (distribuição por perfil + estimativa) e Metas.
5. Chat North + insights (IA server-side, com disclaimer sempre).
6. Produtos por banco + adição manual (síntese via IA).
7. Modo escuro (tokens) + PWA.

## 9. Não-metas do MVP
Open Finance / saldo real; execução de ordens (o app orienta e simula, não correta); recomendação personalizada de ativo específico (mantém-se educacional/CVM).
