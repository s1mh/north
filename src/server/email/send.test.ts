import { describe, expect, it, vi } from "vitest";
import { sendEmail } from "./send";
import { notifyIngestionFailure } from "@/server/market/notify-failure";

vi.mock("server-only", () => ({}));

describe("envio de e-mails", () => {
  it("não envia sem chave", async () => {
    const fetcher = vi.fn();
    await expect(sendEmail({ to: "a@b.co", subject: "x", html: "x", idempotencyKey: "k", fetcher })).resolves.toBe("skipped");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("envia com chave de idempotência e remetente padrão", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await expect(sendEmail({ apiKey: "re_abcdefghijklmnopqrstuvwxyz", to: "a@b.co", subject: "Oi", html: "<p>x</p>", idempotencyKey: "k1", fetcher })).resolves.toBe("sent");
    const [, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toMatchObject({ "Idempotency-Key": "k1" });
    expect(String(request.body)).toContain("no_reply@auth.usenorthapp.com.br");
  });

  it("devolve 'failed' em erro de rede, sem lançar", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("rede"));
    await expect(sendEmail({ apiKey: "re_abcdefghijklmnopqrstuvwxyz", to: "a@b.co", subject: "x", html: "x", idempotencyKey: "k", fetcher })).resolves.toBe("failed");
  });
});

describe("alerta de coleta", () => {
  it("não envia quando não há destinatário configurado", async () => {
    const fetcher = vi.fn();
    await expect(notifyIngestionFailure({ apiKey: "re_abcdefghijklmnopqrstuvwxyz", siteUrl: "https://usenorthapp.com.br", sourceId: "bcb-sgs", errorCode: "bcb_unavailable", jobKey: "daily-2026-11-16", fetcher })).resolves.toBe("skipped");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("envia um alerta por fonte e dia", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await notifyIngestionFailure({ apiKey: "re_abcdefghijklmnopqrstuvwxyz", to: "dono@example.net", siteUrl: "https://usenorthapp.com.br", sourceId: "bcb-sgs", errorCode: "bcb_unavailable", jobKey: "daily-2026-11-16", fetcher });
    const [, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toMatchObject({ "Idempotency-Key": "north-ops-bcb-sgs-daily-2026-11-16" });
    expect(String(request.body)).toContain("bcb_unavailable");
  });
});
