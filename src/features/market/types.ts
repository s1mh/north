export type MarketIndicator = {
  code: string;
  sourceSeries: string;
  label: string;
  value: number;
  unit: "percent_year" | "percent_month" | "brl" | "points";
  observedOn: string;
};

export type MarketPrice = {
  sourceInstrumentId: string;
  symbol: string;
  name: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  observedOn: string;
};
