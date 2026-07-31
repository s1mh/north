import { describe, expect, it, vi } from "vitest";
import {
  BCB_SERIES,
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
    expect(fetcher.mock.calls[0]?.[0]).toContain("ultimos/10");
  });

  it("refuses oversized payloads", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("[]", {
      status: 200,
      headers: { "content-length": "10001" },
    }));

    await expect(fetchLatestBcbIndicator(BCB_SERIES[0], {
      fetcher,
      attempts: 1,
    })).rejects.toThrow("bcb_payload_too_large");
  });
});
