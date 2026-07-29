import { describe, expect, it } from "vitest";
import {
  formatIndicatorValue,
  isIndicatorStale,
  latestIndicators,
  type MarketIndicatorRow,
} from "@/features/market/presentation";

const indicator: MarketIndicatorRow = {
  code: "selic_target",
  label: "Selic",
  value: "15.00000000",
  unit: "percent_year",
  observed_on: "2026-07-25",
  fetched_at: "2026-07-25T22:00:00Z",
  market_data_sources: {
    display_name: "Banco Central do Brasil · SGS",
    attribution: "Fonte: Banco Central do Brasil",
  },
};

describe("market presentation", () => {
  it("keeps only the newest row per indicator", () => {
    expect(latestIndicators([
      indicator,
      { ...indicator, observed_on: "2026-07-24" },
    ])).toEqual([indicator]);
  });

  it("formats percentages in pt-BR", () => {
    expect(formatIndicatorValue(indicator)).toBe("15,00%");
  });

  it("uses the expected freshness window for each frequency", () => {
    expect(isIndicatorStale(indicator, new Date("2026-07-28T12:00:00Z"))).toBe(false);
    expect(isIndicatorStale(indicator, new Date("2026-08-05T12:00:00Z"))).toBe(true);
    expect(isIndicatorStale({
      ...indicator,
      code: "ipca_monthly",
      observed_on: "2026-06-30",
    }, new Date("2026-07-28T12:00:00Z"))).toBe(false);
  });
});
