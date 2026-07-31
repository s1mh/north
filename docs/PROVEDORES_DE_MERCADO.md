# Provedores de dados de mercado

## Decisão deste recorte

O North usa o SGS do Banco Central do Brasil para os indicadores
macroeconômicos iniciais:

- série 432: meta Selic definida pelo Copom, percentual ao ano;
- série 433: variação mensal do IPCA, em percentual.

O Banco Central publica esses conjuntos como dados abertos, processáveis por
máquina e reutilizáveis. A interface credita a fonte e mostra a data observada.

Referências oficiais:

- https://www.bcb.gov.br/acessoinformacao/dadosabertos
- https://dadosabertos.bcb.gov.br/dataset/432-taxa-de-juros---meta-selic-definida-pelo-copom
- https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json

## Cotações da B3

O fechamento diário do Ibovespa usa o arquivo oficial `BVBG.087.01` publicado
pela B3, com atraso D-1. A orientação da B3 permite acesso gratuito a arquivos
históricos e de D-1 sem autorização prévia. A rotina baixa somente o arquivo
oficial, valida data, código e faixa do valor, limita o tamanho compactado e
expandido e mantém a atribuição na interface.

Isso não autoriza cotações em tempo real nem preços individuais de ações,
fundos ou cripto. Antes de ligar esses dados, será necessário documentar um
provedor cuja licença cubra exibição ao usuário final, histórico, cache e
ambiente de desenvolvimento. Não há raspagem de páginas.

Referência oficial:

- https://www.b3.com.br/data/files/A0/D0/A2/FD/F441B9105B12E5A9AC094EA8/Politica%20de%20Consumo%20Market%20Data%20B3.pdf
- https://clientes.b3.com.br/w/market-data-produtos-e-servicos-de-dados

## Operação

A rotina é executada diariamente às 22h30 no horário de Brasília (01h30 UTC).
Ela usa o `CRON_SECRET` no cabeçalho `Authorization`, rejeita payloads
inesperados, aplica limites próprios por formato e interrompe novas execuções
de uma fonte após três falhas recentes.

Cada dia e fonte tem uma única execução lógica. Falhas geram um alerta
operacional sem armazenar resposta bruta, credencial ou dado pessoal.
