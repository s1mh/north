export type MarketIndicator = {
  code: string;
  sourceSeries: string;
  label: string;
  value: number;
  unit: "percent_year" | "percent_month" | "brl" | "points";
  observedOn: string;
};
