import { describe, expect, it, vi } from "vitest";
import { renderWelcomeEmail, sendWelcomeEmail } from "./welcome";

vi.mock("server-only", () => ({}));

describe("welcome email", () => {
  it("renders the North identity and a canonical app link", () => {
    const html = renderWelcomeEmail("https://north-alpha.vercel.app/onboarding/perfil");

    expect(html).toContain("north.");
    expect(html).toContain("Sua vida financeira, mais clara.");
    expect(html).toContain('href="https://north-alpha.vercel.app/inicio"');
  });

  it("skips delivery when the server key is not configured", async () => {
    const fetcher = vi.fn();

    await expect(sendWelcomeEmail({
      appUrl: "https://north-alpha.vercel.app",
      to: "pessoa@example.net",
      userId: "user-1",
      fetcher,
    })).resolves.toBe("skipped");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends once with a deterministic idempotency key", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await expect(sendWelcomeEmail({
      apiKey: "re_abcdefghijklmnopqrstuvwxyz",
      appUrl: "https://north-alpha.vercel.app",
      to: "pessoa@example.net",
      userId: "user-1",
      fetcher,
    })).resolves.toBe("sent");

    expect(fetcher).toHaveBeenCalledOnce();
    const [, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toMatchObject({
      "Idempotency-Key": "north-welcome-user-1",
    });
    expect(request.body).toContain("Seu North está pronto");
  });
});
