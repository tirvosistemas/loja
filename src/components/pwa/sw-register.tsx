"use client";

import { useEffect } from "react";

/** Registra o service worker (app instalável + notificações). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !location.search.includes("sw=1")) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
