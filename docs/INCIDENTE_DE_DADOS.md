# Roteiro de incidente de dados (uma página)

Para quem opera o north. sozinho. Complementa `RUNBOOKS_OPERACIONAIS.md`. **Não é parecer jurídico.**

## O que é um incidente

Acesso indevido a dados de pessoas, vazamento (chave, banco, e-mail), conta invadida, perda ou apagamento indevido de dados, ou envio de e-mail para a pessoa errada com dados dela.

## Primeiros 30 minutos: conter

1. **Anote a hora** e o que você viu (sem copiar dados de pessoas, só descrição).
2. **Estanque**, na ordem que fizer sentido:
   - Chave exposta: gire a chave (Supabase: Settings → API Keys; Vercel: variável de ambiente; Resend: API Keys; AI Gateway: chave nova) e refaça o deploy.
   - Conta invadida: no Supabase (Authentication → Users), encerre as sessões e peça redefinição de senha. A pessoa pode ligar a verificação em duas etapas em Perfil.
   - Falha no app: volte o deploy anterior na Vercel (Deployments → o anterior → Promote to Production).
   - Cadastros suspeitos em massa: desligue novos cadastros (Authentication → Providers → Email).
3. **Não apague logs nem dados** que expliquem o que aconteceu.

## Nas primeiras horas: entender

Responda por escrito, mesmo que curto:
- O que aconteceu e quando começou? Está contido?
- Que dados foram atingidos (conta, carteira, metas, perguntas ao assistente)?
- Quantas pessoas, aproximadamente?
- Há risco ou dano relevante para elas (por exemplo, senha, dados financeiros)?

## Quando avisar

- **Risco ou dano relevante às pessoas:** a LGPD manda comunicar a **autoridade (ANPD)** e as **pessoas afetadas**.
- **Prazo:** fontes secundárias falam em **3 dias úteis** (6 para agentes de pequeno porte), contados do conhecimento do incidente. **Não confirmei no texto oficial.** Confirmar na hora no site da ANPD e agir pelo prazo mais curto.
- Sem risco relevante, registre mesmo assim (o que, quando, por que não havia risco).

## Modelo de aviso às pessoas

> Assunto: Aviso de segurança do north.
> Olá, [nome]. Queremos te contar o que aconteceu com os seus dados no north.
> **O que aconteceu:** [descrição simples].
> **Que dados:** [quais].
> **O que já fizemos:** [contenção].
> **O que você pode fazer:** [trocar a senha, ligar a verificação em duas etapas, desconfiar de mensagens suspeitas].
> **Contato:** contato@usenorthapp.com.br
> Sentimos muito. Estamos à disposição.

## Depois

1. Corrija a causa e teste.
2. Registre: linha do tempo, causa, o que mudou, quem foi avisado e quando.
3. Revise a política de privacidade se algo mudou.

## Contatos úteis

- Supabase, Vercel, Resend: suporte pelos painéis de cada serviço.
- ANPD: gov.br/anpd (canal de comunicação de incidente).
- O north.: contato@usenorthapp.com.br
