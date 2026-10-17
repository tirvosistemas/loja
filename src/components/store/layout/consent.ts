"use client";

import { useSyncExternalStore } from "react";

// Consentimento de cookies (LGPD), guardado no navegador.
// "all" libera medição (Google Analytics / Meta Pixel); "essential" só o necessário.

export type ConsentValue = "all" | "essential";
/** "pending" = ainda no servidor/hidratação; "" = a pessoa ainda não escolheu. */
export type ConsentState = ConsentValue | "" | "pending";

const KEY = "tirvo-consent";
const EVENT = "tirvo:consent";

function read(): ConsentState {
  try {
    const v = localStorage.getItem(KEY);
    return v === "all" || v === "essential" ? v : "";
  } catch {
    return "";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useConsent(): ConsentState {
  return useSyncExternalStore(subscribe, read, () => "pending");
}

export function saveConsent(value: ConsentValue) {
  try {
    localStorage.setItem(KEY, value);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}
