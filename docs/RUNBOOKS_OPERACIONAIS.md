# Runbooks operacionais

Este documento define os procedimentos mínimos para operar o North. Ele não
substitui os exercícios em Staging: restauração, rotação e resposta a incidente
precisam ser executadas, datadas e aprovadas antes da produção.

Nunca copie tokens, cookies, prompts, valores de carteira ou dados pessoais
para tickets, chats ou logs. Use identificadores internos e mensagens
redigidas.

## Responsabilidades

| Papel | Responsabilidade |
| --- | --- |
| Líder do incidente | coordena, define severidade e registra decisões |
| Operação | contém o impacto, restaura o serviço e acompanha métricas |
| Segurança | investiga acesso indevido, segredos e sessões afetadas |
| Privacidade | avalia titulares, operadores, prazos e notificações |
| Produto | comunica impacto funcional sem expor detalhes internos |

Uma mesma pessoa pode exercer mais de um papel no MVP, mas nenhuma operação
crítica de produção deve ocorrer sem revisão de outra pessoa.

## Incidente de segurança ou privacidade

1. Abra um registro privado com horário, ambiente, sintomas e responsável.
2. Classifique:
   - **P0:** acesso ativo ou destruição ampla de dados, segredo de produção
     exposto ou indisponibilidade total prolongada;
   - **P1:** acesso indevido provável, exclusão/exportação incorreta ou perda
     parcial relevante;
   - **P2:** falha contida sem evidência de acesso a dados;
   - **P3:** desvio operacional sem impacto ao usuário.
3. Contenha com a menor mudança segura: desabilite o endpoint, revogue a
   credencial ou interrompa o job afetado.
4. Preserve evidências redigidas. Não mova dados reais para ambiente local.
5. Identifique período, ambientes, categorias de dados e operadores externos.
6. Corrija a causa, valide em Staging e promova o mesmo artefato revisado.
7. Segurança e Privacidade decidem sobre invalidação de sessões e comunicação
   a titulares ou autoridades.
8. Registre causa, impacto, ações e prevenção. Feche somente após confirmar as
   métricas e tarefas posteriores.

Segredo exposto sempre é rotacionado; remover o texto do Git não é suficiente.

## Restauração do banco

Antes da produção, preencher e aprovar RPO e RTO no registro do exercício.

1. Confirme que o incidente exige restauração e congele migrations e escritas.
2. Escolha um ponto anterior ao incidente usando os recursos de backup/PITR do
   projeto correto. Preview, Staging e produção nunca compartilham projeto.
3. Restaure primeiro em um projeto isolado.
4. Aplique os checks de integridade:
   - migrations presentes e na ordem esperada;
   - Auth e perfil com relação íntegra;
   - constraints, grants e RLS;
   - contagens por categoria, sem imprimir linhas pessoais;
   - `supabase test db` em uma cópia sintética equivalente.
5. Valide login, exportação, exclusão, carteira, metas e assistente com contas
   sintéticas.
6. Faça a troca controlada somente com dupla revisão e plano de retorno.
7. Registre ponto restaurado, duração, perda observada e lacunas do exercício.

Uma restauração que apenas inicia o Postgres não conta como teste concluído.

## Rotação de segredos

Rotacione um segredo por vez, mantendo janela curta de sobreposição quando o
provedor permitir.

| Credencial | Onde atualizar | Verificação |
| --- | --- | --- |
| chave secreta Supabase | Supabase e Vercel server-side | APIs administrativas e exclusão |
| chave publicável Supabase | Vercel/cliente | login e leituras com RLS |
| `AI_GATEWAY_API_KEY` | ambiente local, se necessário | resposta controlada do assistente |
| `MARKET_DATA_API_KEY` | brapi e Vercel server-side | cotação com atraso, sem expor o token |
| `CRON_SECRET` | Vercel e agendador | cron rejeita antigo e aceita novo |
| chave de Server Actions | Vercel | build e ação assinada, quando existir |
| credencial de deploy | GitHub/Vercel | deploy do mesmo artefato revisado |

Procedimento:

1. crie a nova credencial com escopo mínimo;
2. atualize Staging e execute o check específico;
3. atualize produção e faça uma verificação curta sem dados reais no log;
4. revogue a credencial anterior;
5. confirme que o valor antigo falha;
6. registre responsável, horário, serviços e resultado, nunca o valor;
7. invalide sessões ou dados derivados quando o tipo de segredo exigir.

## Indisponibilidade

1. Confirme o componente: aplicação, Supabase/Auth, provedor de mercado ou IA.
2. Proteja a verdade do produto:
   - sem banco/Auth, não mostre dados antigos nem aceite mutações;
   - sem mercado, mantenha a última observação identificada como vencida;
   - sem IA, use apenas o fallback determinístico já validado;
   - sem internet, mostre somente a tela pública neutra da PWA.
3. Não contorne RLS, não use a chave secreta no navegador e não desative
   validações para restaurar rapidamente.
4. Comunique o recurso afetado, início e próxima atualização, sem revelar a
   arquitetura de segurança.
5. Após recuperar, valide uma leitura e uma mutação sintéticas e acompanhe
   erros antes de encerrar.

## Exercício e evidência

Cada exercício registra data, ambiente, participantes, duração, resultado,
achados e links privados para evidências redigidas. Frequência mínima proposta:

- restauração: antes do lançamento e trimestral;
- rotação: antes do lançamento e a cada mudança de responsável/provedor;
- incidente e indisponibilidade: exercício semestral;
- exportação e exclusão: em todo release que altera o modelo de dados.

As frequências finais, o RPO e o RTO dependem de aceite de Segurança,
Privacidade e negócio.
