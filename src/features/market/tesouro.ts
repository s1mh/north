import type { MarketIndicator } from "@/features/market/types";

export const TESOURO_CSV_URL =
  "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv";

const HEADER = [
  "Tipo Titulo", "Data Vencimento", "Data Base", "Taxa Compra Manha",
  "Taxa Venda Manha", "PU Compra Manha", "PU Venda Manha", "PU Base Manha",
];

// O arquivo é gigante (mais de 14 MB, desde 2002), mas vem do dia mais recente para o mais antigo.
// Lemos só o começo e paramos quando a data muda.
const MAX_BYTES_READ = 1_000_000;
const TARGET_YEARS = 5;

type Row = { type: string; maturity: string; base: string; rateBuy: number; puBuy: number };

function isoDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) throw new Error("tesouro_invalid_payload");
  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.getUTCDate() !== Number(day)) throw new Error("tesouro_invalid_payload");
  return `${year}-${month}-${day}`;
}

function number(value: string) {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error("tesouro_invalid_payload");
  return parsed;
}

export function parseTesouroLine(line: string): Row {
  const cells = line.split(";");
  if (cells.length !== HEADER.length) throw new Error("tesouro_invalid_payload");
  return {
    type: cells[0]!.trim(),
    maturity: isoDate(cells[1]!.trim()),
    base: isoDate(cells[2]!.trim()),
    // Na base do Tesouro, "Compra" é o lado do investidor que compra o título.
    rateBuy: number(cells[3]!),
    puBuy: number(cells[5]!),
  };
}

const BENCHMARKS = [
  { type: "Tesouro Selic", code: "tesouro_selic_preco", name: "Tesouro Selic", field: "pu" },
  { type: "Tesouro Prefixado", code: "tesouro_prefixado_taxa", name: "Tesouro Prefixado", field: "rate" },
  { type: "Tesouro IPCA+", code: "tesouro_ipca_taxa", name: "Tesouro IPCA+", field: "rate" },
] as const;

/** Escolhe, para cada tipo, o vencimento mais próximo de 5 anos e devolve um indicador. */
export function buildTesouroIndicators(rows: Row[], now = new Date()): MarketIndicator[] {
  if (rows.length === 0) throw new Error("tesouro_invalid_payload");
  const base = rows[0]!.base;
  if (new Date(`${base}T12:00:00Z`).valueOf() > now.valueOf() + 86_400_000) throw new Error("tesouro_invalid_date");
  const target = new Date(`${base}T12:00:00Z`);
  target.setUTCFullYear(target.getUTCFullYear() + TARGET_YEARS);

  const indicators: MarketIndicator[] = [];
  for (const benchmark of BENCHMARKS) {
    const candidates = rows.filter((row) => row.base === base && row.type === benchmark.type && row.maturity > base);
    if (candidates.length === 0) continue;
    const chosen = candidates.reduce((best, row) => Math.abs(Date.parse(`${row.maturity}T12:00:00Z`) - target.valueOf())
      < Math.abs(Date.parse(`${best.maturity}T12:00:00Z`) - target.valueOf()) ? row : best);
    const year = chosen.maturity.slice(0, 4);
    const isPrice = benchmark.field === "pu";
    const value = isPrice ? chosen.puBuy : chosen.rateBuy;
    if (value <= 0 || value > (isPrice ? 1_000_000 : 50)) throw new Error("tesouro_value_out_of_range");
    indicators.push({
      code: benchmark.code,
      sourceSeries: `${benchmark.type} ${chosen.maturity}`,
      label: `${benchmark.name} ${year} · ${isPrice ? "preço" : "taxa"}`,
      value,
      unit: isPrice ? "brl" : "percent_year",
      observedOn: base,
    });
  }
  if (indicators.length === 0) throw new Error("tesouro_invalid_payload");
  return indicators;
}

export async function fetchTesouroSnapshot({
  fetcher = fetch,
  timeoutMs = 15_000,
  now = new Date(),
}: { fetcher?: typeof fetch; timeoutMs?: number; now?: Date } = {}): Promise<MarketIndicator[]> {
  const response = await fetcher(TESOURO_CSV_URL, {
    headers: { accept: "text/csv" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok || !response.body) throw new Error("tesouro_unavailable");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const rows: Row[] = [];
  let buffered = "";
  let bytes = 0;
  let headerChecked = false;
  let done = false;

  try {
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BYTES_READ && rows.length === 0) throw new Error("tesouro_payload_too_large");
      buffered += decoder.decode(chunk.value, { stream: true });
      const lines = buffered.split(/\r?\n/);
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        if (!headerChecked) {
          if (line.replace(/^﻿/, "").trim().split(";").join("|") !== HEADER.join("|")) throw new Error("tesouro_invalid_payload");
          headerChecked = true;
          continue;
        }
        const row = parseTesouroLine(line);
        if (rows.length > 0 && row.base !== rows[0]!.base) { done = true; break; }
        rows.push(row);
      }
      if (bytes > MAX_BYTES_READ) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return buildTesouroIndicators(rows, now);
}
