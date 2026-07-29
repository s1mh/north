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

Cotações, índices e históricos da B3 não serão raspados de páginas públicas.
A Política de Consumo de Market Data da B3 condiciona distribuição,
desenvolvimento de produtos e até determinados usos próprios à licença
adequada.

Antes de ligar preços de ações, fundos ou índices, é necessário contratar e
documentar um provedor cuja licença cubra exibição ao usuário final, histórico,
cache e ambiente de desenvolvimento. O catálogo e a tabela de preços já
separam instrumento, provedor, moeda, instante observado e instante de coleta
para receber essa integração sem perder proveniência.

Referência oficial:

- https://www.b3.com.br/data/files/A0/D0/A2/FD/F441B9105B12E5A9AC094EA8/Politica%20de%20Consumo%20Market%20Data%20B3.pdf

## Operação

A rotina é executada diariamente às 22h30 no horário de Brasília (01h30 UTC).
Ela usa o `CRON_SECRET` no cabeçalho `Authorization`, rejeita payloads
inesperados, limita cada resposta a 10 KB, faz no máximo três tentativas por
série e interrompe novas execuções após três falhas recentes.

Cada dia e fonte tem uma única execução lógica. Falhas geram um alerta
operacional sem armazenar resposta bruta, credencial ou dado pessoal.
