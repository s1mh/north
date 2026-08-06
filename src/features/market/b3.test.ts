import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import {
  fetchLatestB3EquityPrices,
  fetchLatestB3Ibovespa,
  parseB3EquitiesPriceReportXml,
  parseB3IndexReportXml,
} from "@/features/market/b3";

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

  it("extracts requested D-1 equity prices and ignores unrelated tickers", () => {
    const xml = `<Document>
      <PricRpt><TradDt><Dt>2026-07-30</Dt></TradDt><SctyId><TckrSymb>PETR4</TckrSymb></SctyId>
        <FinInstrmId><OthrId><Id>200002981938</Id></OthrId></FinInstrmId><FinInstrmAttrbts>
        <FrstPric>32.10</FrstPric><MinPric>31.90</MinPric><MaxPric>33.00</MaxPric><LastPric>32.80</LastPric>
      </FinInstrmAttrbts></PricRpt>
      <PricRpt><TradDt><Dt>2026-07-30</Dt></TradDt><SctyId><TckrSymb>VALE3</TckrSymb></SctyId>
        <FinInstrmId><OthrId><Id>other</Id></OthrId></FinInstrmId><FinInstrmAttrbts><LastPric>55.00</LastPric></FinInstrmAttrbts></PricRpt>
    </Document>`;

    expect(parseB3EquitiesPriceReportXml(xml, ["PETR4"], new Date("2026-07-31T12:00:00Z"))).toEqual([{
      sourceInstrumentId: "200002981938",
      symbol: "PETR4",
      name: "PETR4",
      open: 32.1,
      high: 33,
      low: 31.9,
      close: 32.8,
      observedOn: "2026-07-30",
    }]);
  });

  it("downloads the official simplified equities archive", async () => {
    const xml = `<Document><PricRpt><TradDt><Dt>2026-07-30</Dt></TradDt><SctyId><TckrSymb>PETR4</TckrSymb></SctyId><FinInstrmId><OthrId><Id>42</Id></OthrId></FinInstrmId><FinInstrmAttrbts><LastPric>32.80</LastPric></FinInstrmAttrbts></PricRpt></Document>`;
    const inner = zipSync({ "BVBG.186.01_report.xml": strToU8(xml) });
    const outer = zipSync({ "SPRE260730.zip": inner });
    const fetcher = vi.fn().mockResolvedValue(new Response(outer, {
      status: 200,
      headers: { "content-length": String(outer.byteLength) },
    }));

    const prices = await fetchLatestB3EquityPrices(
      ["PETR4"],
      new Date("2026-07-30T23:00:00-03:00"),
      { fetcher },
    );
    expect(prices[0]?.close).toBe(32.8);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("SPRE260730.zip%2C");
  });
});
