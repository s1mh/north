import { measurementAvailable, readChoice } from "@/features/analytics/consent";

/**
 * Só eventos de funil, sem dado pessoal e sem dado financeiro.
 * Nunca enviar valores, nomes de instituições, ativos, metas, e-mail ou texto digitado.
 */
export const TRACKED_EVENTS = [
  "page_view",
  "cta_signup_click",
  "simulator_used",
  "onboarding_skip",
  "profile_completed",
  "premium_interest",
] as const;

export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

const SAFE_VALUE = /^[a-z0-9_\-/]{1,60}$/i;

export function sanitizeParams(params: Record<string, string> = {}) {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (/^[a-z_]{1,30}$/.test(key) && SAFE_VALUE.test(value)) clean[key] = value;
  }
  return clean;
}

/** Caminho sem parâmetros de consulta, que podem trazer código de login ou convite. */
export function safePath(pathname: string, origin?: string | null): Record<string, string> {
  const path = pathname.split("?")[0]!.slice(0, 80);
  return origin && SAFE_VALUE.test(origin) ? { page_path: path, origem: origin } : { page_path: path };
}

/**
 * Endereço limpo da página atual: só origem do site, caminho e, se houver, `?origem=`.
 * O GA4 usa este valor no lugar da URL completa, que pode trazer códigos de login ou convite.
 */
export function safeLocation(href: string) {
  const url = new URL(href);
  const origin = url.searchParams.get("origem");
  const clean = `${url.origin}${url.pathname.slice(0, 80)}`;
  return origin && SAFE_VALUE.test(origin) ? `${clean}?origem=${origin}` : clean;
}

export function track(event: TrackedEvent, params?: Record<string, string>) {
  if (!measurementAvailable || typeof window === "undefined") return;
  if (readChoice() !== "accepted") return;
  const layer = ((window as Window & { dataLayer?: unknown[] }).dataLayer ??= []);
  // `onde: undefined` limpa o valor do evento anterior (a camada de dados do GTM guarda o último valor).
  layer.push({ event, onde: undefined, ...sanitizeParams(params), page_location: safeLocation(window.location.href) });
}
