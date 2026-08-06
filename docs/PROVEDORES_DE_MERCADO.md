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

O fechamento diário do Ibovespa usa o arquivo oficial `BVBG.087.01` e as
cotações individuais dos ativos acompanhados usam o
`BVBG.186.01 EquitiesSimplifiedPriceReport`, ambos publicados pela B3 com
atraso D-1. A orientação da B3 permite distribuir gratuitamente dados de fim
de dia e históricos obtidos pelas plataformas de Market Data. A rotina baixa
somente arquivos oficiais, valida data, código e faixa dos valores, limita o
tamanho compactado e expandido e mantém a atribuição na interface.

Isso não autoriza chamar os valores de tempo real. Cripto e mercados externos
continuam dependendo de outra fonte com termos compatíveis. Não há raspagem de
páginas nem valores ilustrativos.

Referência oficial:

- https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/distribuidores/perguntas-frequentes/
- https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/boletins-diarios/pesquisa-por-pregao/pesquisa-por-pregao/
- https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/boletins-diarios/pesquisa-por-pregao/layout-dos-arquivos/

## Operação

A rotina é executada diariamente às 22h30 no horário de Brasília (01h30 UTC).
Ela usa o `CRON_SECRET` no cabeçalho `Authorization`, rejeita payloads
inesperados, aplica limites próprios por formato e interrompe novas execuções
de uma fonte após três falhas recentes.

Cada dia e fonte tem uma única execução lógica. Falhas geram um alerta
operacional sem armazenar resposta bruta, credencial ou dado pessoal.
