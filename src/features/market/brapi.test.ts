import { describe, expect, it, vi } from "vitest";
import { fetchBrapiQuote, normalizeBrapiSymbol, parseBrapiQuote } from "@/features/market/brapi";

const payload = {
  results: [{
    requestedSymbol: "PETR4",
    symbol: "PETR4",
    changed: false,
    data: {
      shortName: "PETROBRAS PN",
      longName: "Petróleo Brasileiro S.A. - Petrobras",
      currency: "BRL",
      regularMarketPrice: 38.5,
      regularMarketOpen: 38.2,
      regularMarketDayHigh: 39,
      regularMarketDayLow: 38.1,
      regularMarketChangePercent: 0.78,
      regularMarketTime: "2026-08-05T17:08:00.000Z",
    },
  }],
};
const baseResult = payload.results[0]!;

describe("brapi delayed quotes", () => {
  it("normalizes valid B3 tickers and rejects unsafe symbols", () => {
    expect(normalizeBrapiSymbol(" petr4 ")).toBe("PETR4");
    expect(() => normalizeBrapiSymbol("PETR4,VALE3")).toThrow("brapi_invalid_symbol");
  });

  it("parses and bounds the provider response", () => {
    expect(parseBrapiQuote(payload, "PETR4", new Date("2026-08-05T18:00:00Z"))).toEqual({
      sourceInstrumentId: "PETR4",
      symbol: "PETR4",
      name: "Petróleo Brasileiro S.A. - Petrobras",
      open: 38.2,
      high: 39,
      low: 38.1,
      close: 38.5,
      observedOn: "2026-08-05",
      observedAt: "2026-08-05T17:08:00.000Z",
      changePercent: 0.78,
    });
  });

  it.each([
    [{ ...payload, results: [{ ...baseResult, symbol: "VALE3" }] }, "brapi_invalid_payload"],
    [{ ...payload, results: [{ ...baseResult, data: { ...baseResult.data, currency: "USD" } }] }, "brapi_invalid_payload"],
    [{ ...payload, results: [{ ...baseResult, data: { ...baseResult.data, regularMarketPrice: -1 } }] }, "brapi_invalid_payload"],
    [{ ...payload, results: [{ ...baseResult, data: { ...baseResult.data, regularMarketTime: "2099-01-01T00:00:00Z" } }] }, "brapi_invalid_date"],
  ])("rejects a mismatched or implausible response", (invalidPayload, error) => {
    expect(() => parseBrapiQuote(
      invalidPayload,
      "PETR4",
      new Date("2026-08-05T18:00:00Z"),
    )).toThrow(error);
  });

  it("keeps the key in the Authorization header", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await fetchBrapiQuote("PETR4", "secret-token-with-enough-characters", {
      fetcher,
      now: new Date("2026-08-05T18:00:00Z"),
    });

    const [url, options] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://brapi.dev/api/v2/stocks/quote?symbols=PETR4");
    expect(options.headers.authorization).toBe("Bearer secret-token-with-enough-characters");
    expect(String(url)).not.toContain("secret-token");
  });
});
