"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { readChoice, setChoice, shouldShowBanner, startConsent, subscribe } from "@/features/analytics/consent";
import { safePath, track } from "@/features/analytics/track";

export function AnalyticsRoot() {
  const pathname = usePathname();
  const showBanner = useSyncExternalStore(subscribe, shouldShowBanner, () => false);

  const wasShowing = useRef(false);

  useEffect(() => { startConsent(); }, []);

  // Quem acaba de aceitar o banner: a página em que está conta como a primeira visita medida.
  useEffect(() => {
    if (wasShowing.current && !showBanner && readChoice() === "accepted") {
      const origin = new URLSearchParams(window.location.search).get("origem");
      track("page_view", safePath(window.location.pathname, origin));
    }
    wasShowing.current = showBanner;
  }, [showBanner]);

  useEffect(() => {
    const origin = new URLSearchParams(window.location.search).get("origem");
    track("page_view", safePath(pathname, origin));
  }, [pathname]);

  if (!showBanner) return null;
  return <section className="cookie-banner" role="region" aria-label="Cookies de medição">
    <p><b>Cookies de medição.</b> O north. usa o Google Analytics para entender quais telas ajudam e quais confundem. Só medimos se você aceitar, e nunca enviamos valores, nomes de bancos ou dados da sua carteira. <a href="/privacidade">Saiba mais</a></p>
    <div>
      <button type="button" className="cookie-secondary" onClick={() => setChoice("declined")}>Recusar</button>
      <button type="button" className="cookie-primary" onClick={() => setChoice("accepted")}>Aceitar</button>
    </div>
  </section>;
}

export function CookiePreferencesButton() {
  return <button type="button" className="cookie-link" onClick={() => import("@/features/analytics/consent").then((m) => m.openPreferences())}>Preferências de cookies</button>;
}
