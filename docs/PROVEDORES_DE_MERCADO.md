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

## Cotações com atraso no Staging

No Staging e no uso pessoal, o North consulta a brapi pelo endpoint
`/api/v2/stocks/quote`, sempre no servidor e com o token no cabeçalho
`Authorization`. O plano gratuito fornece um ativo por requisição, até 15 mil
requisições mensais e cotações com atraso aproximado de 30 minutos.

Para controlar consumo, cada símbolo fica em cache por 30 minutos e uma página
consulta no máximo oito símbolos distintos. Isso limita o pior caso contínuo a
11.520 requisições em um mês de 30 dias. Falha, ausência da chave ou resposta
inválida preserva o fechamento oficial D-1 da B3 já armazenado; respostas brutas
e tokens nunca são persistidos ou enviados ao navegador.

Esse uso não define autorização comercial para redistribuição em produção. Os
termos e a licença do provedor devem ser revistos antes do lançamento público.

Referências:

- https://brapi.dev/docs
- https://brapi.dev/faq/o-plano-gratuito-tem-limitacoes-importantes

## Operação

A rotina oficial é executada diariamente às 22h30 no horário de Brasília
(01h30 UTC). As cotações com atraso da brapi são buscadas sob demanda no
servidor e reutilizadas pelo cache por 30 minutos.
Ela usa o `CRON_SECRET` no cabeçalho `Authorization`, rejeita payloads
inesperados, aplica limites próprios por formato e interrompe novas execuções
de uma fonte após três falhas recentes.

Cada dia e fonte tem uma única execução lógica. Falhas geram um alerta
operacional sem armazenar resposta bruta, credencial ou dado pessoal.
