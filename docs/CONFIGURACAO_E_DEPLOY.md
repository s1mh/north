# Configuração local e deploy

Esta etapa entrega uma aplicação navegável e o contrato inicial do banco. As
integrações reais devem ser habilitadas por ambiente, sem compartilhar
credenciais entre Preview e Produção.

## 1. Desenvolvimento local

Pré-requisitos: Node 20, Docker e Supabase CLI.

```bash
npm install
cp .env.example .env.local
supabase start
supabase db reset
npm run dev
```

Copie a URL e a chave publicável exibidas pelo `supabase status` para
`.env.local`. A chave secreta local só será necessária para jobs
administrativos. Rode `supabase test db` para comprovar o isolamento RLS.

## 2. Supabase

Crie projetos separados para **Preview/Staging** e **Produção**, preferindo a
mesma região definida pela política LGPD. Em cada projeto:

1. vincule a CLI com `supabase link --project-ref <ref>`;
2. revise o diff com `supabase db diff`;
3. publique migrations versionadas com `supabase db push`;
4. configure URLs de autenticação para o domínio daquele ambiente;
5. habilite confirmação de e-mail, proteção contra senha vazada e MFA quando
   a decisão de produto estiver registrada;
6. rode os testes RLS antes de promover a migration.

Não edite o schema apenas pelo Dashboard. Nunca use a chave secreta em código
cliente, Preview público ou requisições normais de usuário.

## 3. Vercel

Importe o repositório como um único projeto Next.js, sem mudar o diretório
raiz. Configure separadamente os escopos Preview e Production:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_SECRET_KEY` (somente quando um job privilegiado existir);
- `LLM_API_KEY`, `MARKET_DATA_API_KEY` e `CRON_SECRET` apenas nos marcos que
  utilizarem essas integrações;
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` antes de introduzir Server Actions.

O Preview deve apontar exclusivamente para o projeto não produtivo. Ative
Deployment Protection em Staging e revisão obrigatória antes da promoção.

## 4. Provedor de IA

A chave ainda não é consumida nesta fundação. Antes de ativar o gateway:

1. escolha provedor, região, retenção, política de treinamento e contrato;
2. salve `LLM_API_KEY` somente no cofre da Vercel;
3. implemente a chamada em `src/server/ai`, nunca em Client Components;
4. envie somente agregados mínimos, sem nome, e-mail ou IDs estáveis;
5. valide resposta estruturada e acrescente o disclaimer no servidor;
6. aplique autenticação, rate limit, orçamento, timeout e fallback;
7. registre apenas versão, status e métricas redigidas.

## 5. Checklist de produção

- `npm run check` e `supabase test db` aprovados;
- domínio e redirects de Auth revisados;
- CSP migrada de Report-Only para enforcement após observar violações;
- branch protection, push protection, Dependabot e CodeQL habilitados;
- backups/PITR, RPO/RTO, retenção e exclusão LGPD aprovados;
- logs sem PII, prompts, tokens ou valores financeiros;
- revisão jurídica dos textos de suitability e educação financeira;
- rotação e teste de revogação de todos os segredos.
