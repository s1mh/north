import { describe, expect, it, vi } from "vitest";
import {
  BCB_SERIES,
  bcbSeriesUrl,
  fetchBcbSnapshot,
  fetchLatestBcbIndicator,
  parseBcbPayload,
} from "@/features/market/bcb";

describe("BCB adapter", () => {
  it("normalizes the official SGS payload", () => {
    expect(parseBcbPayload(
      BCB_SERIES[0],
      [{ data: "25/07/2026", valor: "15.00" }],
      new Date("2026-07-28T12:00:00Z"),
    )).toEqual({
      code: "selic_target",
      sourceSeries: "432",
      label: "Selic",
      value: 15,
      unit: "percent_year",
      observedOn: "2026-07-25",
    });
  });

  it("rejects malformed and anomalous values", () => {
    expect(() => parseBcbPayload(
      BCB_SERIES[0],
      [{ data: "25/07/2026", valor: "999" }],
      new Date("2026-07-28T12:00:00Z"),
    ))
      .toThrow("bcb_value_out_of_range");
    expect(() => parseBcbPayload(
      BCB_SERIES[0],
      [{ data: "31/02/2026", valor: "15" }],
      new Date("2026-07-28T12:00:00Z"),
    ))
      .toThrow("bcb_invalid_date");
    expect(() => parseBcbPayload(
      BCB_SERIES[0],
      [{ date: "25/07/2026", value: "15" }],
      new Date("2026-07-28T12:00:00Z"),
    ))
      .toThrow();
  });

  it("rejects an observation dated beyond the server clock", () => {
    expect(() => parseBcbPayload(
      BCB_SERIES[0],
      [{ data: "05/08/2026", valor: "15" }],
      new Date("2026-07-28T12:00:00Z"),
    )).toThrow("bcb_future_date");
  });

  it("uses the latest observation already effective in São Paulo", () => {
    expect(parseBcbPayload(
      BCB_SERIES[0],
      [
        { data: "30/07/2026", valor: "15.00" },
        { data: "31/07/2026", valor: "14.75" },
        { data: "05/08/2026", valor: "14.25" },
      ],
      new Date("2026-07-31T12:00:00Z"),
    )).toMatchObject({ observedOn: "2026-07-31", value: 14.75 });

    expect(parseBcbPayload(
      BCB_SERIES[0],
      [
        { data: "30/07/2026", valor: "15.00" },
        { data: "31/07/2026", valor: "14.75" },
      ],
      new Date("2026-07-31T01:00:00Z"),
    )).toMatchObject({ observedOn: "2026-07-30", value: 15 });
  });

  it("retries a transient failure with a bounded number of calls", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response('[{"data":"25/07/2025","valor":"15.00"}]', {
        status: 200,
        headers: { "content-type": "application/json" },
      }));

    await expect(fetchLatestBcbIndicator(BCB_SERIES[0], {
      fetcher,
      retryDelayMs: 0,
    })).resolves.toMatchObject({ code: "selic_target", value: 15 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("dataInicial=");
  });

  it("refuses oversized payloads", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("[]", {
      status: 200,
      headers: { "content-length": "40001" },
    }));

    await expect(fetchLatestBcbIndicator(BCB_SERIES[0], {
      fetcher,
      attempts: 1,
    })).rejects.toThrow("bcb_payload_too_large");
  });

  it("pede uma janela de datas que termina hoje em São Paulo", () => {
    const url = new URL(bcbSeriesUrl(BCB_SERIES[0], new Date("2026-11-16T12:00:00Z")));
    expect(url.pathname).toBe("/dados/serie/bcdata.sgs.432/dados");
    expect(url.searchParams.get("dataFinal")).toBe("16/11/2026");
    expect(url.searchParams.get("dataInicial")).toBe("02/10/2026");
    expect(url.searchParams.get("formato")).toBe("json");
  });

  it("aceita uma janela diária com mais de 20 linhas e ignora datas futuras", () => {
    const rows = Array.from({ length: 50 }, (_, index) => {
      const day = new Date(Date.UTC(2026, 9, 2 + index, 12));
      const [y, m, d] = day.toISOString().slice(0, 10).split("-");
      return { data: `${d}/${m}/${y}`, valor: "14.50" };
    });
    expect(parseBcbPayload(BCB_SERIES[0], rows, new Date("2026-11-16T12:00:00Z")))
      .toMatchObject({ observedOn: "2026-11-16", value: 14.5 });
  });

  it("grava a série que funcionou quando a outra falha", async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => url.includes("sgs.432")
      ? new Response("erro", { status: 503 })
      : new Response('[{"data":"01/10/2026","valor":"0.48"}]', { status: 200 }));
    const indicators = await fetchBcbSnapshot({ fetcher, attempts: 1, retryDelayMs: 0 });
    expect(indicators.map((item) => item.code)).toEqual(["ipca_monthly"]);
  });

  it("falha a coleta quando nenhuma série responde", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("erro", { status: 503 }));
    await expect(fetchBcbSnapshot({ fetcher, attempts: 1, retryDelayMs: 0 })).rejects.toThrow("bcb_unavailable");
  });
});
