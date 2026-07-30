"use client";

import { useEffect, useState } from "react";

export function PwaClient() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production"
      || !("serviceWorker" in navigator)
    ) return;

    let mounted = true;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      registration.update().catch(() => undefined);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (
            mounted
            && worker.state === "installed"
            && navigator.serviceWorker.controller
          ) setUpdateReady(true);
        });
      });
    }).catch(() => undefined);

    return () => { mounted = false; };
  }, []);

  function update() {
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration?.waiting) return;

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => window.location.reload(),
        { once: true },
      );
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    });
  }

  return updateReady ? <aside className="pwa-update" role="status">
    <span>Uma nova versão do North está pronta.</span>
    <button type="button" onClick={update}>Atualizar</button>
  </aside> : null;
}
