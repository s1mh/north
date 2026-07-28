# Política de segurança

## Como relatar uma vulnerabilidade

Não abra uma issue pública e não inclua dados reais, credenciais ou
informações de usuários em um relato.

Use **Security → Report a vulnerability** neste repositório quando o private
vulnerability reporting estiver habilitado. Caso a opção não esteja
disponível, contate os mantenedores por um canal privado previamente acordado.

Inclua, quando possível:

- componente e ambiente afetados;
- passos mínimos de reprodução com dados sintéticos;
- impacto observado e impacto potencial;
- evidências redigidas, sem tokens, cookies ou PII;
- sugestão de mitigação, se houver.

Não acesse contas de terceiros, não faça persistência, não cause
indisponibilidade e não exfiltre dados para demonstrar impacto.

## Tratamento

O recebimento, a triagem e a comunicação devem ocorrer no canal privado. Uma
correção só deve ser divulgada depois de implantada e após rotação de qualquer
credencial afetada. Segredos expostos são revogados imediatamente; apagar o
commit não é considerado remediação suficiente.

## Escopo atual

O repositório está em planejamento e ainda não possui uma versão de produção
suportada. O protótipo em `docs/reference/prototype` é material de design, não
uma aplicação publicada.
