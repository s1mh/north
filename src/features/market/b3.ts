import { strFromU8, unzipSync } from "fflate";
import type { MarketIndicator } from "@/features/market/types";

const B3_DOWNLOAD_URL = "https://www.b3.com.br/pesquisapregao/download";
const MAX_ARCHIVE_BYTES = 1_000_000;
const MAX_INNER_ARCHIVE_BYTES = 1_000_000;
const MAX_XML_BYTES = 2_000_000;
const MAX_LOOKBACK_DAYS = 8;

type B3FetchOptions = {
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

function dateInSaoPaulo(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function previousDates(now: Date) {
  const localDate = new Date(`${dateInSaoPaulo(now)}T12:00:00Z`);
  return Array.from({ length: MAX_LOOKBACK_DAYS }, (_, offset) => {
    const candidate = new Date(localDate);
    candidate.setUTCDate(candidate.getUTCDate() - offset);
    return candidate.toISOString().slice(0, 10);
  });
}

function fileDate(date: string) {
  return `${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}`;
}

async function readLimitedBody(response: Response, maximumBytes: number) {
  const declaredSize = Number(response.headers.get("content-length") ?? "0");
  if (declaredSize > maximumBytes) throw new Error("b3_payload_too_large");
  if (!response.body) throw new Error("b3_invalid_payload");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new Error("b3_payload_too_large");
    }
    chunks.push(value);
  }

  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function unzipSingleFile(
  archive: Uint8Array,
  suffix: string,
  maximumExpandedBytes: number,
) {
  const files = unzipSync(archive, {
    filter(file) {
      if (file.originalSize > maximumExpandedBytes) {
        throw new Error("b3_payload_too_large");
      }
      return file.name.endsWith(suffix);
    },
  });
  const entries = Object.entries(files);
  if (entries.length !== 1) throw new Error("b3_invalid_payload");
  return entries[0]![1];
}

export function parseB3IndexReportXml(xml: string, now = new Date()): MarketIndicator {
  if (Buffer.byteLength(xml, "utf8") > MAX_XML_BYTES) {
    throw new Error("b3_payload_too_large");
  }

  const observedOn = xml.match(/<TradDt>\s*<Dt>(\d{4}-\d{2}-\d{2})<\/Dt>\s*<\/TradDt>/)?.[1];
  const ibovespaBlocks = Array.from(xml.matchAll(/<IndxInf>([\s\S]*?)<\/IndxInf>/g))
    .map((match) => match[1] ?? "")
    .filter((block) => /<TckrSymb>IBOV<\/TckrSymb>/.test(block));
  if (!observedOn || ibovespaBlocks.length !== 1) {
    throw new Error("b3_invalid_payload");
  }

  const closingText = ibovespaBlocks[0]!
    .match(/<ClsgPric(?:\s[^>]*)?>(\d+(?:\.\d+)?)<\/ClsgPric>/)?.[1];
  const value = Number(closingText);
  if (!closingText || !Number.isFinite(value) || value < 1_000 || value > 1_000_000) {
    throw new Error("b3_value_out_of_range");
  }

  const parsedDate = new Date(`${observedOn}T12:00:00Z`);
  const maximumObservedDate = new Date(now);
  maximumObservedDate.setUTCDate(maximumObservedDate.getUTCDate() + 1);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate > maximumObservedDate) {
    throw new Error("b3_invalid_date");
  }

  return {
    code: "ibovespa_close",
    sourceSeries: "BVBG.087.01:IBOV",
    label: "Ibovespa",
    value,
    unit: "points",
    observedOn,
  };
}

async function fetchB3IndexForDate(
  date: string,
  now: Date,
  fetcher: typeof fetch,
  timeoutMs: number,
) {
  const archiveName = `IR${fileDate(date)}.zip`;
  const url = new URL(B3_DOWNLOAD_URL);
  url.searchParams.set("filelist", `${archiveName},`);
  const response = await fetcher(url, {
    headers: { accept: "application/octet-stream" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error("b3_unavailable");

  const outerArchive = await readLimitedBody(response, MAX_ARCHIVE_BYTES);
  const innerArchive = unzipSingleFile(
    outerArchive,
    archiveName,
    MAX_INNER_ARCHIVE_BYTES,
  );
  const xmlBytes = unzipSingleFile(innerArchive, ".xml", MAX_XML_BYTES);
  const indicator = parseB3IndexReportXml(strFromU8(xmlBytes), now);
  if (indicator.observedOn !== date) throw new Error("b3_invalid_date");
  return indicator;
}

export async function fetchLatestB3Ibovespa(
  now = new Date(),
  { fetcher = fetch, timeoutMs = 3_000 }: B3FetchOptions = {},
) {
  let lastError: unknown;
  for (const date of previousDates(now)) {
    try {
      return await fetchB3IndexForDate(date, now, fetcher, timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("b3_unavailable");
}
