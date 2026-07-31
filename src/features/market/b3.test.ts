import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { fetchLatestB3Ibovespa, parseB3IndexReportXml } from "@/features/market/b3";

function report({
  date = "2026-07-30",
  close = "177158.86",
}: { date?: string; close?: string } = {}) {
  return `<?xml version="1.0" encoding="utf-8"?>
  <Document><IndxRpt><TradDt><Dt>${date}</Dt></TradDt>
    <IndxInf><SctyInf><SctyId><TckrSymb>IFIX</TckrSymb></SctyId><ClsgPric Ccy="BRL">3798.1</ClsgPric></SctyInf></IndxInf>
    <IndxInf><SctyInf><SctyId><TckrSymb>IBOV</TckrSymb></SctyId><ClsgPric Ccy="BRL">${close}</ClsgPric></SctyInf></IndxInf>
  </IndxRpt></Document>`;
}

describe("B3 public EOD feed", () => {
  it("extracts the official Ibovespa closing value", () => {
    expect(parseB3IndexReportXml(report(), new Date("2026-07-31T12:00:00Z"))).toEqual({
      code: "ibovespa_close",
      sourceSeries: "BVBG.087.01:IBOV",
      label: "Ibovespa",
      value: 177158.86,
      unit: "points",
      observedOn: "2026-07-30",
    });
  });

  it.each([
    { close: "5", error: "b3_value_out_of_range" },
    { date: "2099-01-01", error: "b3_invalid_date" },
  ])("rejects an invalid official value", ({ close, date, error }) => {
    expect(() => parseB3IndexReportXml(
      report({ close, date }),
      new Date("2026-07-31T12:00:00Z"),
    )).toThrow(error);
  });

  it("opens the nested official archives with strict filenames", async () => {
    const inner = zipSync({ "BVBG.087.01_report.xml": strToU8(report()) });
    const outer = zipSync({ "IR260730.zip": inner });
    const fetcher = vi.fn().mockResolvedValue(new Response(outer, {
      status: 200,
      headers: { "content-length": String(outer.byteLength) },
    }));

    const indicator = await fetchLatestB3Ibovespa(
      new Date("2026-07-30T23:00:00-03:00"),
      { fetcher },
    );
    expect(indicator.value).toBe(177158.86);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("IR260730.zip%2C");
  });
});
