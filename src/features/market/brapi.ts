import type { MarketPrice } from "@/features/market/types";

const BRAPI_QUOTE_URL = "https://brapi.dev/api/v2/stocks/quote";
const MAX_RESPONSE_BYTES = 256_000;

type BrapiFetchOptions = {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  now?: Date;
};

type UnknownRecord = Record<string, unknown>;

export type BrapiQuote = MarketPrice & {
  changePercent: number | null;
  observedAt: string;
};

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function finiteNumber(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < minimum || value > maximum) return null;
  return value;
}

function optionalPrice(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = finiteNumber(value, 0, 10_000_000);
  if (parsed === null) throw new Error("brapi_value_out_of_range");
  return parsed;
}

export function normalizeBrapiSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(normalized)) {
    throw new Error("brapi_invalid_symbol");
  }
  return normalized;
}

export function parseBrapiQuote(
  payload: unknown,
  requestedSymbol: string,
  now = new Date(),
): BrapiQuote {
  const normalized = normalizeBrapiSymbol(requestedSymbol);
  const root = record(payload);
  const results = root?.results;
  if (!Array.isArray(results) || results.length !== 1) {
    throw new Error("brapi_invalid_payload");
  }

  const result = record(results[0]);
  const data = record(result?.data);
  if (!result || !data) throw new Error("brapi_invalid_payload");

  const symbol = typeof result.symbol === "string" ? result.symbol.toUpperCase() : "";
  const currency = data?.currency;
  const name = typeof data?.longName === "string" && data.longName.trim().length >= 2
    ? data.longName.trim()
    : typeof data?.shortName === "string"
      ? data.shortName.trim()
      : symbol;
  const close = finiteNumber(data?.regularMarketPrice, 0, 10_000_000);
  const observedAt = data?.regularMarketTime;

  if (
    symbol !== normalized
    || currency !== "BRL"
    || name.length < 2
    || name.length > 120
    || close === null
    || typeof observedAt !== "string"
  ) {
    throw new Error("brapi_invalid_payload");
  }

  const observedDate = new Date(observedAt);
  const maximumDate = new Date(now.valueOf() + 10 * 60 * 1000);
  const minimumDate = new Date(now.valueOf() - 14 * 24 * 60 * 60 * 1000);
  if (
    Number.isNaN(observedDate.valueOf())
    || observedDate > maximumDate
    || observedDate < minimumDate
  ) {
    throw new Error("brapi_invalid_date");
  }

  const changePercent = data.regularMarketChangePercent === null
    || data.regularMarketChangePercent === undefined
    ? null
    : finiteNumber(data.regularMarketChangePercent, -100, 10_000);
  if (
    data.regularMarketChangePercent !== null
    && data.regularMarketChangePercent !== undefined
    && changePercent === null
  ) {
    throw new Error("brapi_value_out_of_range");
  }

  return {
    sourceInstrumentId: symbol,
    symbol,
    name,
    open: optionalPrice(data.regularMarketOpen),
    high: optionalPrice(data.regularMarketDayHigh),
    low: optionalPrice(data.regularMarketDayLow),
    close,
    observedOn: observedDate.toISOString().slice(0, 10),
    observedAt: observedDate.toISOString(),
    changePercent,
  };
}

export async function fetchBrapiQuote(
  symbol: string,
  apiKey: string,
  { fetcher = fetch, timeoutMs = 4_000, now = new Date() }: BrapiFetchOptions = {},
) {
  const normalized = normalizeBrapiSymbol(symbol);
  if (apiKey.length < 20) throw new Error("brapi_missing_key");

  const url = new URL(BRAPI_QUOTE_URL);
  url.searchParams.set("symbols", normalized);
  const response = await fetcher(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error("brapi_unavailable");

  const declaredSize = Number(response.headers.get("content-length") ?? "0");
  if (declaredSize > MAX_RESPONSE_BYTES) throw new Error("brapi_payload_too_large");
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error("brapi_payload_too_large");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("brapi_invalid_payload");
  }
  return parseBrapiQuote(payload, normalized, now);
}
