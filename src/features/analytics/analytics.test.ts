import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type DL = Window & { dataLayer?: unknown[] };

async function load(gtm: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_GTM_ID", gtm);
  const consent = await import("@/features/analytics/consent");
  const track = await import("@/features/analytics/track");
  return { consent, track };
}

describe("medição com consentimento", () => {
  beforeEach(() => { localStorage.clear(); (window as DL).dataLayer = undefined; });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("sem ID do GTM não há medição nem banner", async () => {
    const { consent, track } = await load("");
    consent.startConsent();
    track.track("cta_signup_click");
    expect((window as DL).dataLayer).toBeUndefined();
    expect(consent.shouldShowBanner()).toBe(false);
  });

  it("sem aceite não envia evento nem carrega o Google", async () => {
    const { consent, track } = await load("GTM-ABC123");
    consent.startConsent();
    track.track("cta_signup_click", { onde: "hero" });
    const layer = (window as DL).dataLayer as unknown[];
    expect(layer.some((item) => (item as { event?: string }).event === "cta_signup_click")).toBe(false);
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
    expect(consent.shouldShowBanner()).toBe(true);
  });

  it("depois do aceite envia o evento e carrega o GTM uma vez", async () => {
    const { consent, track } = await load("GTM-ABC123");
    consent.startConsent();
    consent.setChoice("accepted");
    track.track("simulator_used");
    const layer = (window as DL).dataLayer as unknown[];
    expect(layer.some((item) => (item as { event?: string }).event === "simulator_used")).toBe(true);
    expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);
    expect(consent.shouldShowBanner()).toBe(false);
  });

  it("recusar não envia nada", async () => {
    const { consent, track } = await load("GTM-ABC123");
    consent.startConsent();
    consent.setChoice("declined");
    track.track("cta_signup_click");
    const layer = (window as DL).dataLayer as unknown[];
    expect(layer.some((item) => (item as { event?: string }).event === "cta_signup_click")).toBe(false);
  });

  it("descarta parâmetros que podem trazer dado pessoal ou financeiro", async () => {
    const { track } = await load("GTM-ABC123");
    expect(track.sanitizeParams({ onde: "hero", email: "pessoa@exemplo.com", valor: "R$ 12.000,00", nome: "Ana Souza" }))
      .toEqual({ onde: "hero" });
    expect(track.safePath("/auth/callback?code=segredo", "faculdade")).toEqual({ page_path: "/auth/callback", origem: "faculdade" });
    expect(track.safePath("/inicio")).toEqual({ page_path: "/inicio" });
  });
});
