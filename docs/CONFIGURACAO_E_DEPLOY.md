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
`.env.local`. Copie também `SECRET_KEY` para `SUPABASE_SECRET_KEY`; ela é
necessária no servidor para a exclusão de conta e para jobs administrativos.
Nunca exponha o resultado completo do comando em mensagens ou screenshots.
Rode `supabase test db` para comprovar o isolamento RLS.

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
- `SUPABASE_SECRET_KEY` (server-side; exclusão de conta e jobs privilegiados);
- `CRON_SECRET` para autenticar a coleta diária;
- `AI_GATEWAY_API_KEY` apenas para desenvolvimento local fora da Vercel. Nos
  deployments, o AI Gateway usa automaticamente o token OIDC da Vercel;
- `MARKET_DATA_API_KEY` somente quando um futuro provedor licenciado exigir;
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` antes de introduzir Server Actions.

O Preview deve apontar exclusivamente para o projeto não produtivo. Ative
Deployment Protection em Staging e revisão obrigatória antes da promoção.

## 4. Provedor de IA

O assistente usa o Vercel AI Gateway no servidor, com modelo primário de baixo
custo e fallback de outro provedor. A resposta é estruturada, recebe disclaimer
no servidor e não inclui nome, e-mail nem IDs estáveis no prompt.

Em Staging na Vercel, habilite o AI Gateway e use o OIDC automático, sem criar
uma chave estática. Para executar a integração remotamente fora da Vercel,
grave `AI_GATEWAY_API_KEY` apenas no ambiente local. O endpoint mantém
autenticação, rate limit, timeout, validação da resposta e logs redigidos.

Configure um limite de gastos no painel antes dos testes. O aplicativo pode
voltar à resposta local controlada quando o gateway não está configurado.

## 5. Checklist de produção

- `npm run check` e `supabase test db` aprovados;
- domínio e redirects de Auth revisados;
- CSP migrada de Report-Only para enforcement após observar violações;
- branch protection, push protection, Dependabot e CodeQL habilitados;
- backups/PITR, RPO/RTO, retenção e exclusão LGPD aprovados;
- logs sem PII, prompts, tokens ou valores financeiros;
- revisão jurídica dos textos de suitability e educação financeira;
- rotação e teste de revogação de todos os segredos.
