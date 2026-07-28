# Material original do protótipo

Esta pasta preserva o handoff, a biblioteca de telas, o mock navegável e as
capturas recebidas em 28 de julho de 2026.

Os dois ZIPs enviados eram idênticos:

```text
SHA-256  9e6495d84d0923943a635f1b397906fb6cf1a1c3d77883eb365c3277911bbcfb
```

## Arquivos

- `Handoff.md`: contexto de produto, design e esboço técnico.
- `North - App.dc.html`: biblioteca e variações de telas.
- `North - Mock.dc.html`: fluxo navegável.
- `support.js`: runtime gerado exigido pelos arquivos `.dc.html`.
- `uploads/`: referências visuais originais.
- `CLAUDE.md`: contexto resumido incluído no pacote.

## Aviso de segurança

Este material é somente uma referência de design:

- o runtime baixa React, ReactDOM e Babel de `unpkg.com` sem SRI;
- o runtime usa geração dinâmica de funções;
- o HTML contém dados pessoais fictícios;
- não há autenticação, autorização, validação ou persistência reais.

Por isso, estes arquivos não podem ser importados pela aplicação, colocados em
`public/` ou publicados na Vercel. A raiz do repositório exclui `docs/` do
artefato de deploy.

Se for necessário abrir o mock, faça isso em ambiente local isolado e sem
segredos no navegador. A implementação deve recriar os componentes no design
system do produto, não reutilizar o runtime do protótipo.
