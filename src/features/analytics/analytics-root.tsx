"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { setChoice, shouldShowBanner, startConsent, subscribe } from "@/features/analytics/consent";
import { safePath, track } from "@/features/analytics/track";

export function AnalyticsRoot() {
  const pathname = usePathname();
  const showBanner = useSyncExternalStore(subscribe, shouldShowBanner, () => false);

  useEffect(() => { startConsent(); }, []);

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
