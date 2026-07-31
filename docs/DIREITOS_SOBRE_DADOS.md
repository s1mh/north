# Exportação e exclusão de dados

## Exportação

Em **Conta e ajustes → Seus dados**, a pessoa autenticada pode baixar um JSON.
O arquivo contém:

- identidade mínima da conta, sem senha, token ou metadados administrativos;
- perfil, consentimentos e avaliações de suitability;
- instituições vinculadas e solicitações de pesquisa;
- carteira e histórico de movimentações;
- metas, aportes, planos e simulações;
- conversas do assistente e metadados técnicos associados.

Catálogos globais e dados de mercado não são duplicados no arquivo, pois não
são dados pessoais criados pelo usuário. A função do banco deriva a identidade
de `auth.uid()` e não aceita `user_id` enviado pelo navegador. A resposta usa
`private, no-store`, força download e não é armazenada pelo service worker.

O campo `schema_version` permite interpretar versões futuras. A exportação é
uma fotografia do instante indicado por `exported_at`.

## Exclusão

A exclusão exige:

1. sessão autenticada;
2. origem igual à origem do aplicativo;
3. frase exata `EXCLUIR MINHA CONTA`;
4. confirmação da senha atual no Supabase Auth.

Somente depois dessas verificações o servidor usa sua credencial administrativa
para excluir exatamente o `id` obtido da sessão. O navegador nunca envia nem
escolhe um `user_id`.

As chaves estrangeiras apagam em cascata perfil, consentimentos, suitability,
instituições privadas, carteira, metas, planos, simulações e conversas. Ao
terminar, cookies de sessão, tema, caches e estado local são limpos. Um evento
operacional anônimo registra que uma exclusão terminou, sem conservar ID,
e-mail ou outro identificador do titular.

No modelo atual, não existe retenção pessoal pós-exclusão. Caso uma obrigação
legal futura exija retenção ou bloqueio, o lançamento deve ser interrompido até
existirem base legal aprovada, tabela separada, acesso restrito, prazo e
processo documentados. Não se deve preservar silenciosamente uma cópia.

## Verificação

- testes pgTAP garantem isolamento de exportação entre duas contas;
- acesso anônimo à exportação é negado;
- a exclusão do usuário é testada através da cadeia completa da carteira;
- registros de outra conta permanecem intactos;
- a interface pede confirmação forte e não revela detalhes internos nos erros.

O exercício ponta a ponta em Staging deve usar somente contas sintéticas e ser
repetido sempre que uma nova tabela pessoal for criada.
