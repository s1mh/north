export type MarketIndicatorRow = {
  code: string;
  label: string;
  value: string | number;
  unit: "percent_year" | "percent_month" | "brl" | "points";
  observed_on: string;
  fetched_at: string;
  market_data_sources: {
    display_name: string;
    attribution: string;
  } | null;
};

const maximumAgeDays: Record<string, number> = {
  selic_target: 7,
  ipca_monthly: 70,
  ibovespa_close: 4,
};

export function latestIndicators(rows: MarketIndicatorRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.code)) return false;
    seen.add(row.code);
    return true;
  });
}

export function isIndicatorStale(indicator: MarketIndicatorRow, now = new Date()) {
  const observed = new Date(`${indicator.observed_on}T12:00:00Z`);
  const ageDays = (now.valueOf() - observed.valueOf()) / 86_400_000;
  return ageDays > (maximumAgeDays[indicator.code] ?? 7);
}

export function formatIndicatorValue(indicator: MarketIndicatorRow) {
  const value = Number(indicator.value);
  if (indicator.unit === "brl") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }
  if (indicator.unit === "points") {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
  }
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

export function formatObservedDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
