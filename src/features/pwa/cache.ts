export async function clearNorthBrowserState() {
  if (typeof window === "undefined") return;

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    registration?.active?.postMessage({ type: "CLEAR_NORTH_CACHES" });
    registration?.waiting?.postMessage({ type: "CLEAR_NORTH_CACHES" });
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith("north-"))
        .map((key) => caches.delete(key)),
    );
  }
  sessionStorage.clear();
  document.cookie = "north-theme=; Path=/; Max-Age=0; SameSite=Lax";
}
