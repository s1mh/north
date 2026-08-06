# Baseline de segurança

Este documento define requisitos de entrega. “Depois a gente endurece” não é
uma opção para autenticação, dados financeiros, integrações ou IA.

## Dados e ameaças principais

Dados de carteira, movimentações, metas e suitability são classificados como
**restritos**. Nome/e-mail e conversas são **confidenciais**. Catálogo
publicado e conteúdo institucional são **públicos**, mas ainda exigem
integridade e proveniência.

Principais cenários de ameaça:

- usuário acessa ou altera dados de outra conta;
- chave privilegiada aparece no bundle, log, erro, prompt ou Git;
- sessão autenticada é armazenada por CDN, navegador ou service worker;
- endpoint de IA/cron é usado sem autorização para gerar custo ou exfiltrar;
- prompt injection em notícia, site de banco ou mensagem manipula o sistema;
- URL externa causa SSRF contra rede interna ou serviço de metadados;
- dependência ou GitHub Action comprometida executa código no build;
- cotação errada, vencida ou sem fonte produz orientação incorreta;
- analytics ou observabilidade capturam PII e valores financeiros;
- conta tomada por credential stuffing ou recuperação de acesso fraca.

## Gestão de segredos

### Classificação das variáveis

| Variável | Navegador | Uso |
| --- | ---: | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | identifica o projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sim | acesso sujeito a grants e RLS |
| `SUPABASE_SECRET_KEY` | nunca | job administrativo isolado |
| `AI_GATEWAY_API_KEY` | nunca | gateway server-only fora da Vercel; deployments usam OIDC |
| `MARKET_DATA_API_KEY` | nunca | adapter server-side da brapi |
| `CRON_SECRET` | nunca | autentica invocação do cron |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | nunca | chave comum entre instâncias |

Qualquer nome com `NEXT_PUBLIC_` deve ser tratado como conteúdo publicado e
inserido no JavaScript no build.

### Regras

- valores reais vivem no cofre do ambiente, não em arquivos versionados;
- `.env.example` contém somente nomes e valores vazios;
- desenvolvimento, preview, staging e produção usam credenciais diferentes;
- cada integração recebe uma chave própria, com menor escopo possível;
- rotação tem dono, periodicidade e runbook testado;
- segredos não são passados por argumento de linha de comando;
- logs imprimem somente presença/ausência de configuração, nunca o valor;
- erros de validação de ambiente citam o nome da variável, não o conteúdo;
- módulos privados importam `server-only` e não são reexportados para UI;
- um scan de bundle procura nomes/prefixos de segredos antes do deploy.

`.gitignore` reduz acidentes, mas não é um cofre. Se um segredo entrar em um
commit, ele deve ser revogado e rotacionado imediatamente, mesmo que o commit
seja apagado depois.

## Autenticação e sessão

- usar o fluxo SSR oficial do Supabase com rotação de refresh token;
- em código servidor, validar claims assinadas; não confiar apenas em dados de
  sessão não revalidados;
- confirmar e-mail e proteger recuperação contra enumeração;
- política de senha e bloqueio/rate limit alinhados ao Supabase;
- oferecer MFA e decidir com compliance se será obrigatório;
- ações sensíveis exigem autenticação recente;
- logout invalida sessão, estado em memória e caches do PWA;
- respostas autenticadas usam `Cache-Control: private, no-store`;
- não colocar token em URL, query string, analytics ou `localStorage`;
- cookies adotam atributos seguros compatíveis com o fluxo oficial;
- mudanças de e-mail, senha, MFA e exclusão geram evento de segurança.

Mensagens de erro de login e recuperação não confirmam se uma conta existe.

## Autorização e banco

- RLS habilitada na criação de toda tabela exposta;
- grants explícitos substituem permissões padrão;
- `auth.uid()` determina o tenant; `user_id` enviado pelo cliente é ignorado;
- `USING` e `WITH CHECK` são definidos para cada mutação;
- cliente privilegiado não participa de requisições normais;
- views usam invoker e funções privilegiadas fixam `search_path`;
- Storage, quando adotado, recebe políticas equivalentes por owner e bucket;
- migrations passam por revisão e testes antes de qualquer ambiente;
- backups são criptografados, com acesso limitado e restauração testada;
- produção habilita PITR conforme RPO/RTO aprovados.

O gate mínimo de CI cria dois usuários e prova que o segundo não consegue
selecionar, inserir, atualizar ou excluir recursos do primeiro.

## APIs, Server Actions e validação

Cada operação segue a ordem:

1. limitar método, origem, tamanho e tipo de conteúdo;
2. autenticar;
3. aplicar rate limit;
4. validar schema e normalizar entrada;
5. autorizar o recurso específico;
6. executar com timeout e idempotency key quando aplicável;
7. retornar DTO mínimo;
8. registrar resultado redigido.

Requisitos adicionais:

- schemas rejeitam campos desconhecidos em operações sensíveis;
- IDs são opacos e não substituem autorização;
- mutações baseadas em cookies validam `Origin`/`Host` e estratégia CSRF;
- erros externos viram mensagens genéricas, sem stack trace;
- nenhum endpoint funciona como proxy ou fetch de URL arbitrária;
- webhooks verificam assinatura sobre bytes brutos antes do parsing;
- rate limits usam identidade + IP com cuidado para NAT e IPv6;
- limites de custo são independentes do rate limit;
- operações repetíveis usam chave de idempotência e constraint no banco.

## Navegador e headers

Configuração mínima:

- Content Security Policy com nonce ou hash, iniciada em `Report-Only`;
- `frame-ancestors 'none'`;
- `object-src 'none'`;
- `base-uri 'self'`;
- `form-action 'self'`;
- HSTS após confirmar HTTPS em todos os subdomínios relevantes;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` bloqueando recursos não usados;
- política de `connect-src`, `img-src` e `font-src` por allowlist.

Evitar scripts inline e gestores de tag. Qualquer analytics exige avaliação de
privacidade, consentimento quando aplicável e configuração que não capture
inputs, textos, URLs sensíveis, IDs ou valores.

Server Components não devem serializar linha completa de banco para um Client
Component. Inspecionar HTML e payload RSC faz parte da revisão.

## PWA

- service worker só faz cache de assets estáticos versionados e shell público;
- rotas autenticadas, `/_next/data`, RSC, APIs e respostas do Supabase são
  network-only/no-store;
- nenhum valor financeiro ou conversa vai para Cache API, IndexedDB ou
  armazenamento persistente;
- logout envia mensagem ao service worker e remove caches do North;
- mudança de versão invalida caches antigos;
- offline mostra uma tela neutra, não uma cópia potencialmente desatualizada
  da carteira;
- notificações push, se adotadas, não revelam patrimônio na tela bloqueada.

## IA

O LLM é um componente não confiável e probabilístico.

- regras de suitability, cálculos, limites e disclaimer vivem em código;
- contexto é montado no servidor a partir de dados autorizados;
- enviar apenas agregados necessários, sem nome, e-mail ou IDs estáveis;
- instruções e dados externos ficam separados no prompt;
- notícias/sites são marcados como conteúdo não confiável;
- saída usa schema estruturado com tamanho e valores permitidos;
- links e Markdown são sanitizados antes de renderizar;
- ferramentas disponíveis ao modelo usam allowlist e argumentos validados;
- modelo não possui ferramenta para consultar usuário arbitrário, segredo ou
  banco diretamente;
- toda resposta factual cita snapshot/fonte e informa defasagem;
- o servidor acrescenta o disclaimer após validar a saída;
- timeout, orçamento, limite por usuário e circuit breaker são obrigatórios;
- fallback determinístico existe quando provedor ou validação falha;
- retenção e uso para treinamento pelo provedor precisam de contrato aprovado.

Testes adversariais incluem prompt injection, pedido para ignorar regras,
tentativa de extrair prompt/segredo, dado ausente, preço desatualizado e
resposta que tenta executar uma ação fora do MVP.

## Ingestão externa e SSRF

- não aceitar URL arbitrária enviada pelo usuário;
- resolver DNS e bloquear loopback, link-local, redes privadas e redirects
  para destinos não permitidos;
- usar HTTPS, host allowlist, timeout, limite de redirects e limite de bytes;
- validar `Content-Type`, schema e encoding;
- tratar HTML, JSON, PDF e imagem como não confiáveis;
- não executar JavaScript do site pesquisado;
- registrar URL canônica, fonte, licença, coleta e hash;
- não publicar automaticamente material produzido pela pesquisa/IA;
- detectar valores fora de faixa e comparar com fonte secundária quando o
  impacto justificar.

## Logs, métricas e privacidade

Nunca registrar:

- cookies, Authorization, chaves ou URLs assinadas;
- senha, código MFA ou link de recuperação;
- nome/e-mail junto com carteira ou suitability;
- mensagem/prompt completo sem processo explícito de redaction;
- corpo bruto de webhook ou resposta do provedor;
- valores completos de carteira em eventos de analytics.

Usar correlation ID aleatório por requisição, ID interno não reversível quando
necessário e mensagens estruturadas. Acesso aos logs é mínimo e auditado.
Retenção é definida por categoria e exclusão de conta alcança todos os
processadores previstos pela LGPD.

## Dependências e CI/CD

- runtime, gerenciador e dependências fixados; lockfile obrigatório;
- dependências novas precisam de justificativa, licença e avaliação de
  manutenção;
- GitHub Actions são fixadas por SHA completo;
- permissões do `GITHUB_TOKEN` começam em somente leitura;
- workflows não executam texto de issue/PR ou artefato não confiável como
  shell;
- secrets não são disponibilizados a pull requests de forks;
- secret scan roda em push e PR;
- dependency review bloqueia vulnerabilidade incompatível com a política;
- SAST/CodeQL, lint, types, testes e build são gates de branch;
- artefato é gerado uma vez e promovido, não reconstruído com dependências
  diferentes;
- deploy de produção exige revisão e usa somente a branch protegida;
- preview usa credenciais sem acesso a dados reais.

Configurações que dependem do GitHub e não podem ser garantidas por arquivos
do repositório devem ser ativadas manualmente: push protection, private
vulnerability reporting, proteção de branch, revisão obrigatória, assinatura
de commits conforme política da equipe e restrição de Actions permitidas.

## Resposta a incidente de segredo

1. interromper o uso da credencial e revogá-la;
2. criar nova credencial com escopo mínimo;
3. atualizar cofres e redeploy dos ambientes afetados;
4. buscar uso indevido em logs sem expor novamente o valor;
5. invalidar sessões/dados derivados quando aplicável;
6. remover o material do Git como contenção secundária;
7. documentar impacto, causa e ações preventivas;
8. notificar titulares/autoridades conforme avaliação jurídica.

Remover o commit não substitui rotação.

## Checklist de release

- [ ] RLS/grants testados contra usuário adversário e anônimo.
- [ ] Nenhuma chave secreta no bundle, source map ou artefato.
- [ ] CSP e demais headers validados no domínio final.
- [ ] Cache autenticado e PWA testados em login/logout/troca de usuário.
- [ ] Rate limit, custo e timeout testados nos endpoints externos.
- [ ] Backups e restauração testados.
- [ ] Alertas de auth, ingestão, IA e erro configurados sem PII.
- [ ] Exclusão/exportação de dados testadas ponta a ponta.
- [ ] Dependências, licenças e achados de segurança revisados.
- [ ] Pentest concluído; nenhum achado crítico/alto aberto.
- [ ] Jurídico/compliance aprovou fluxos, suitability e textos.
