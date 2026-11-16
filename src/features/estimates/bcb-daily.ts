import { z } from "zod";
import type { DailyRate } from "./indexed";

/** Séries diárias públicas do Banco Central: 12 = CDI, 11 = Selic (taxa ao dia, em %). */
export const DAILY_SERIES = { cdi_pct: "12", selic_pct: "11" } as const;

const payloadSchema = z.array(z.object({
  data: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  valor: z.string().regex(/^\d+(?:[.,]\d+)?$/),
}).strict()).max(5000);

function toBcbDate(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function parseDailyPayload(payload: unknown): DailyRate[] {
  const rows = payloadSchema.parse(payload);
  return rows.map(({ data, valor }) => ({
    date: `${data.slice(6, 10)}-${data.slice(3, 5)}-${data.slice(0, 2)}`,
    pct: Number(valor.replace(",", ".")),
  })).filter((row) => Number.isFinite(row.pct) && row.pct >= 0 && row.pct < 5);
}

const cache = new Map<string, { at: number; rows: DailyRate[] }>();
const TTL_MS = 6 * 60 * 60 * 1000;

/** Busca a série desde `from` (AAAA-MM-DD) até hoje; devolve null se o Banco Central não responder. */
export async function fetchDailySeries(
  series: "12" | "11",
  from: string,
  to: string,
  fetcher: typeof fetch = fetch,
): Promise<DailyRate[] | null> {
  const key = `${series}:${from}:${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series}/dados?formato=json&dataInicial=${toBcbDate(from)}&dataFinal=${toBcbDate(to)}`;
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(6_000),
      headers: { Accept: "application/json" },
      next: { revalidate: 21_600 },
    } as RequestInit);
    if (!response.ok) return null;
    const rows = parseDailyPayload(await response.json());
    if (rows.length === 0) return null;
    cache.set(key, { at: Date.now(), rows });
    return rows;
  } catch {
    return null;
  }
}
