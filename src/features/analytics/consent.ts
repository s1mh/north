/**
 * Consentimento para a medição de uso (Google Tag Manager + GA4).
 * Sem aceite, nenhum script do Google é carregado e nada é enviado. O padrão do Consent Mode é "negado".
 * Sem NEXT_PUBLIC_GTM_ID não há medição nem banner.
 */
export const GTM_ID = (process.env.NEXT_PUBLIC_GTM_ID ?? "").trim();
export const measurementAvailable = /^GTM-[A-Z0-9]+$/.test(GTM_ID);

export type Choice = "accepted" | "declined" | null;
const STORAGE_KEY = "north_consent";
const VALIDITY_MS = 1000 * 60 * 60 * 24 * 183;
const CHANGE_EVENT = "north:consent";

type DataLayerWindow = Window & { dataLayer?: unknown[] };

let loaded = false;
let reopened = false;

// O Consent Mode exige o objeto "arguments", não um array.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function gtag(..._args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  ((window as DataLayerWindow).dataLayer ??= []).push(arguments);
}

export function readChoice(): Choice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { c, t } = JSON.parse(raw) as { c?: string; t?: number };
    if ((c !== "accepted" && c !== "declined") || typeof t !== "number" || Date.now() - t > VALIDITY_MS) return null;
    return c;
  } catch {
    return null;
  }
}

function clearGoogleCookies() {
  const hosts = [location.hostname, `.${location.hostname}`];
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]!.trim();
    if (name !== "_ga" && !name.startsWith("_ga_") && name !== "_gid") continue;
    for (const domain of hosts) document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`;
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}

function loadGtm() {
  if (loaded || !measurementAvailable) return;
  loaded = true;
  ((window as DataLayerWindow).dataLayer ??= []).push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
  document.head.appendChild(script);
}

function apply(choice: Choice) {
  if (!measurementAvailable) return;
  const granted = choice === "accepted";
  gtag("consent", "update", { analytics_storage: granted ? "granted" : "denied" });
  if (granted) loadGtm();
  else if (choice === "declined") clearGoogleCookies();
}

/** Define o padrão "negado" antes de qualquer tag e aplica a escolha guardada. Chamar uma vez ao abrir o app. */
export function startConsent() {
  if (!measurementAvailable) return;
  gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  });
  apply(readChoice());
}

export function setChoice(choice: "accepted" | "declined") {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ c: choice, t: Date.now() }));
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
  reopened = false;
  apply(choice);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function openPreferences() {
  reopened = true;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribe(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

export const shouldShowBanner = () => measurementAvailable && (reopened || readChoice() === null);
