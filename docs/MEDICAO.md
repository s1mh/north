# Medição de uso (GTM + GA4) com consentimento

O north. mede só o funil, só com aceite, e nunca envia dado pessoal ou financeiro.

## Como funciona

- `src/features/analytics/consent.ts`: guarda a escolha (aceitar ou recusar) por 183 dias, define o Consent Mode como "negado" por padrão e só carrega o GTM depois do aceite.
- `src/features/analytics/track.ts`: lista fechada de eventos e filtro de parâmetros. Valores com espaço, símbolo, e-mail ou texto livre são descartados.
- `src/features/analytics/analytics-root.tsx`: banner, `page_view` por rota (só o caminho, sem parâmetros de consulta, para não vazar códigos de login) e botão "Preferências de cookies" no rodapé.
- Sem `NEXT_PUBLIC_GTM_ID`, não há medição nem banner.

## Eventos

| Evento | Quando | Parâmetros |
|---|---|---|
| `page_view` | Troca de rota | `page_path`, `origem` (se vier `?origem=`) |
| `cta_signup_click` | Clique em "Criar conta" | `onde` (topo, hero, final, simulador) |
| `simulator_used` | Primeira mexida no simulador público | nenhum |
| `onboarding_skip` | Clique em "Pular por enquanto" | `onde` (bancos, perfil) |
| `profile_completed` | Perfil de investidor concluído | nenhum |
| `premium_interest` | Reservado para o botão "Premium em breve" | a definir |

Todo evento leva `page_location` (endereço limpo, sem parâmetros de consulta, exceto `?origem=`). No GTM, a tag de eventos usa esse valor no lugar da URL do navegador.

Nunca enviar: valores, instituições, ativos, metas, e-mail, nome, perguntas ao assistente.

## Para ligar (uma vez)

1. Criar um contêiner GTM "north." e uma propriedade GA4 "north.", separados do portfólio.
2. No GTM: tag `GA4 - Base` (Google tag, `send_page_view` desligado, acionador Initialization) e tag `GA4 - Eventos` (evento `{{Event}}`, acionador Evento personalizado com regex dos eventos acima).
3. No GA4, marcar `cta_signup_click` e `profile_completed` como eventos principais.
4. Definir `NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX` na Vercel (production e preview) e publicar.
5. Testar no Tempo real do GA4, aceitando e recusando o banner.
