import { z } from "zod";
import type { MarketIndicator } from "@/features/market/types";

export const BCB_SERIES = [
  {
    code: "selic_target",
    sourceSeries: "432",
    label: "Selic",
    unit: "percent_year" as const,
    minimum: 0,
    maximum: 100,
  },
  {
    code: "ipca_monthly",
    sourceSeries: "433",
    label: "IPCA",
    unit: "percent_month" as const,
    minimum: -10,
    maximum: 50,
  },
] as const;

const bcbPayloadSchema = z.array(z.object({
  data: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  valor: z.string().regex(/^-?\d+(?:[.,]\d+)?$/),
}).strict()).min(1).max(20);

function dateInSaoPaulo(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseBcbPayload(
  series: (typeof BCB_SERIES)[number],
  payload: unknown,
  now = new Date(),
): MarketIndicator {
  const parsed = bcbPayloadSchema.parse(payload);
  const observations = parsed.map(({ data, valor }) => {
    const [day, month, year] = data.split("/");
    const observedOn = `${year}-${month}-${day}`;
    const parsedDate = new Date(`${observedOn}T12:00:00Z`);
    if (
      Number.isNaN(parsedDate.valueOf())
      || parsedDate.getUTCFullYear() !== Number(year)
      || parsedDate.getUTCMonth() + 1 !== Number(month)
      || parsedDate.getUTCDate() !== Number(day)
    ) {
      throw new Error("bcb_invalid_date");
    }
    return { observedOn, value: Number(valor.replace(",", ".")) };
  });
  const maximumObservedOn = dateInSaoPaulo(now);
  const observation = observations
    .filter(({ observedOn }) => observedOn <= maximumObservedOn)
    .sort((left, right) => right.observedOn.localeCompare(left.observedOn))[0];
  if (!observation) throw new Error("bcb_future_date");
  const { observedOn, value } = observation;

  if (!Number.isFinite(value) || value < series.minimum || value > series.maximum) {
    throw new Error("bcb_value_out_of_range");
  }

  return {
    code: series.code,
    sourceSeries: series.sourceSeries,
    label: series.label,
    value,
    unit: series.unit,
    observedOn,
  };
}

type FetchLatestOptions = {
  fetcher?: typeof fetch;
  attempts?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
};

export async function fetchLatestBcbIndicator(
  series: (typeof BCB_SERIES)[number],
  {
    fetcher = fetch,
    attempts = 3,
    timeoutMs = 4_000,
    retryDelayMs = 150,
  }: FetchLatestOptions = {},
) {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series.sourceSeries}/dados/ultimos/10?formato=json`;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetcher(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error("bcb_unavailable");

      const declaredSize = Number(response.headers.get("content-length") ?? "0");
      if (declaredSize > 10_000) throw new Error("bcb_payload_too_large");

      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > 10_000) {
        throw new Error("bcb_payload_too_large");
      }

      return parseBcbPayload(series, JSON.parse(body) as unknown);
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts && retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("bcb_unavailable");
}

export async function fetchBcbSnapshot(options: FetchLatestOptions = {}) {
  return Promise.all(BCB_SERIES.map((series) => fetchLatestBcbIndicator(series, options)));
}
