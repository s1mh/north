import "server-only";
import { unstable_cache } from "next/cache";
import { fetchBrapiQuote, normalizeBrapiSymbol, type BrapiQuote } from "@/features/market/brapi";
import { getPrivateEnv } from "@/server/env/private";

export const BRAPI_CACHE_SECONDS = 30 * 60;
export const MAX_BRAPI_SYMBOLS = 8;

const getCachedQuote = unstable_cache(
  async (symbol: string) => {
    const { MARKET_DATA_API_KEY } = getPrivateEnv();
    if (!MARKET_DATA_API_KEY) throw new Error("brapi_missing_key");
    return fetchBrapiQuote(symbol, MARKET_DATA_API_KEY);
  },
  ["brapi-delayed-quote-v1"],
  { revalidate: BRAPI_CACHE_SECONDS },
);

export async function getBrapiQuotes(symbols: Iterable<string>) {
  if (!getPrivateEnv().MARKET_DATA_API_KEY) return [];

  const normalized: string[] = [];
  for (const candidate of symbols) {
    try {
      const symbol = normalizeBrapiSymbol(candidate);
      if (!normalized.includes(symbol)) normalized.push(symbol);
    } catch {
      // Ignore unsupported portfolio identifiers instead of sending them upstream.
    }
    if (normalized.length === MAX_BRAPI_SYMBOLS) break;
  }

  const quotes: BrapiQuote[] = [];
  for (const symbol of normalized) {
    try {
      quotes.push(await getCachedQuote(symbol));
    } catch {
      // A provider error for one symbol must preserve cached official B3 data for the page.
    }
  }
  return quotes;
}
