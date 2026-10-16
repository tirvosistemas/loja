"use client";

import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** Estado da instalação do app (Android/Chrome usa o prompt nativo; iPhone mostra instruções). */
export function useInstallPrompt() {
  const [, force] = useState(0);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(isStandalone());
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const install = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    force((n) => n + 1);
    return outcome;
  }, []);
  return { canPrompt: !!deferred, installed, ios: isIos(), install };
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type PushState = "unsupported" | "default" | "granted" | "denied" | "subscribed";

/** Inscrição nas notificações de ofertas. */
export function usePush(vapidPublicKey: string) {
  const [state, setState] = useState<PushState>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "subscribed" : (Notification.permission as PushState));
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!vapidPublicKey) return false;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "default");
        return false;
      }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("Falha ao salvar inscrição");
      setState("subscribed");
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [vapidPublicKey]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("default");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, subscribe, unsubscribe };
}
