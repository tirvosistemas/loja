import Stripe from "stripe";
import { getSettings, stripeIsReady } from "./settings";

// Cliente da Stripe criado com a chave secreta salva em Configurações → Integrações.

let cached: { key: string; client: Stripe } | null = null;

export async function getStripe(): Promise<Stripe | null> {
  const s = await getSettings();
  if (!stripeIsReady(s)) return null;
  const key = s.integrations.stripeSecretKey;
  if (cached?.key !== key) cached = { key, client: new Stripe(key, { appInfo: { name: "Tirvo Loja" } }) };
  return cached.client;
}

export async function getStripeWebhookSecret() {
  return (await getSettings()).integrations.stripeWebhookSecret;
}

export function stripeMode(key: string): "live" | "test" | null {
  if (key.startsWith("sk_live_") || key.startsWith("pk_live_") || key.startsWith("rk_live_")) return "live";
  if (key.startsWith("sk_test_") || key.startsWith("pk_test_") || key.startsWith("rk_test_")) return "test";
  return null;
}
