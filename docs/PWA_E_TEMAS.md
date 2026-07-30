# PWA, atualização e temas

## Escopo de cache

O service worker do North usa o cache versionado `north-static-v1`. Ele pode
armazenar somente:

- a tela pública e neutra `/offline`;
- manifest e ícones do aplicativo;
- arquivos com hash sob `/_next/static/`.

Navegações continuam **network-first**. APIs, RSC, Supabase e qualquer outra
resposta não entram na estratégia de cache. Se uma navegação falhar, o
service worker mostra `/offline`; ele nunca devolve uma cópia anterior de
Início, carteira, metas, produtos ou conversa.

## Atualização

`/sw.js` é servido com `no-cache, no-store, must-revalidate`. Uma versão nova
instala em paralelo e a interface avisa quando a atualização está pronta.
Depois da confirmação, o worker assume o controle e a página recarrega.
Caches `north-*` de versões anteriores são removidos no evento `activate`.

## Logout

O logout:

1. encerra a sessão local do Supabase;
2. envia `CLEAR_NORTH_CACHES` ao worker ativo e ao worker em espera;
3. remove diretamente todos os caches cujo nome começa com `north-`;
4. limpa `sessionStorage` e o cookie de tema;
5. volta para a tela pública.

Nenhum dado financeiro é gravado em Cache API, IndexedDB ou armazenamento
local pelo North.

## Tema

A preferência `system`, `light` ou `dark` é salva no perfil autenticado por
uma função SQL restrita. Um cookie sem conteúdo pessoal permite aplicar o
tema antes da hidratação e é removido no logout. `system` acompanha a
preferência de cor do aparelho.

## Verificação manual

Em um build de produção local:

```bash
npm run build
npm run start
```

Verifique:

1. manifest, ícones 192/512 e ícone maskable no painel Application;
2. instalação e abertura em modo standalone;
3. troca de tema, recarga e persistência;
4. atualização do service worker após alterar a versão do cache;
5. offline em rota autenticada exibindo somente a tela neutra;
6. Cache Storage sem HTML autenticado, API, RSC ou respostas do Supabase;
7. logout removendo todos os caches `north-*`.

O service worker não é registrado durante `next dev`, evitando cache
persistente enquanto a interface está em desenvolvimento.
