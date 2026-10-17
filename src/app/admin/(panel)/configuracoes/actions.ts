"use server";

import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { fail, fromZod, type ActionResult } from "@/lib/action";
import { maskSecret } from "@/lib/crypto";
import { CLEAR_SECRET, getSettings, saveSettingsGroup, type Settings } from "@/lib/settings";
import { stripeMode } from "@/lib/stripe";
import { locateStoreAddress, quoteShipping, type ShippingQuote } from "@/lib/shipping/quote";
import { geocodeWith, routeMetersWith, type MapsProvider } from "@/lib/shipping/providers";
import { isValidCpf } from "@/lib/orders/cpf";
import { onlyDigits } from "@/lib/utils";
import { feeBreakdown, type FeeBreakdown } from "@/components/admin/settings/fee-breakdown";

// Ações das Configurações. Só dono e administradores mexem aqui.

const ROLES: ("OWNER" | "ADMIN")[] = ["OWNER", "ADMIN"];

function done(message = "Configurações salvas.") {
  revalidatePath("/admin/configuracoes");
  revalidatePath("/", "layout");
  return message;
}

function saveError(e: unknown): ActionResult<never> {
  console.error("[configurações] falha ao salvar:", e);
  return fail("Não foi possível salvar agora. Tente de novo.");
}

// ───────── Campos comuns

const text = (max: number, msg?: string) => z.string().trim().max(max, msg ?? `Use até ${max} caracteres.`);

function normalizeUrl(v: string) {
  const s = v.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
}

function isHttpUrl(v: string) {
  try {
    const u = new URL(v);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

const urlField = text(300)
  .transform(normalizeUrl)
  .refine((v) => v === "" || isHttpUrl(v), "Informe um link válido (https://…).");

const emailOrEmpty = text(160)
  .transform((v) => v.toLowerCase())
  .refine((v) => v === "" || z.email().safeParse(v).success, "E-mail inválido.");

const brPhone = (msg: string) =>
  z
    .string()
    .transform(onlyDigits)
    .transform((d) => (d.length >= 12 && d.startsWith("55") ? d.slice(2) : d))
    .refine((d) => d.length === 10 || d.length === 11, msg);

// ───────── Loja

const storeInput = z
  .object({
    name: z.string().trim().min(2, "Informe o nome da loja.").max(60, "Use até 60 caracteres."),
    tagline: text(140),
    description: text(300),
    whatsapp: brPhone("Informe o WhatsApp com DDD, ex.: (41) 99999-8888.").transform((d) => `55${d}`),
    phone: z
      .string()
      .trim()
      .max(30)
      .refine((v) => v === "" || [10, 11].includes(onlyDigits(v).replace(/^55(?=\d{10,11}$)/, "").length), "Telefone com DDD, ex.: (41) 3333-4444."),
    email: emailOrEmpty,
    legalName: text(120),
    cnpj: z
      .string()
      .transform(onlyDigits)
      .refine((d) => d === "" || d.length === 14, "O CNPJ tem 14 números.")
      .transform((d) => (d ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : "")),
    businessHours: text(120),
    instagram: urlField,
    facebook: urlField,
    tiktok: urlField,
    youtube: urlField,
    announcementEnabled: z.boolean(),
    announcementText: text(160),
    // "//site.com" e "/\site.com" levariam para outro domínio: caminho interno é só "/algo".
    announcementHref: text(300).refine(
      (v) => v === "" || (/^\/(?![/\\])/.test(v) && !/[\s\\]/.test(v)) || isHttpUrl(v),
      "Use um caminho do site (ex.: /ofertas) ou um link completo.",
    ),
  })
  .refine((v) => !v.announcementEnabled || v.announcementText.length > 0, { path: ["announcementText"], message: "Escreva o texto da barra de aviso." });

export type StoreInput = z.input<typeof storeInput>;

export async function saveStoreSettings(input: StoreInput): Promise<ActionResult<Settings["store"]>> {
  await requireAdmin(ROLES);
  const parsed = storeInput.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const data = await saveSettingsGroup("store", parsed.data);
    return { ok: true, data, message: done() };
  } catch (e) {
    return saveError(e);
  }
}

// ───────── Endereço e retirada

const coord = (min: number, max: number) => z.number().min(min, "Coordenada inválida.").max(max, "Coordenada inválida.").nullable();

const addressInput = z.object({
  cep: z
    .string()
    .transform(onlyDigits)
    .refine((d) => d.length === 8, "Informe o CEP com 8 números."),
  street: z.string().trim().min(2, "Informe a rua.").max(160),
  number: z.string().trim().min(1, "Informe o número (ou s/n).").max(20),
  complement: text(120),
  neighborhood: z.string().trim().min(2, "Informe o bairro.").max(120),
  city: z.string().trim().min(2, "Informe a cidade.").max(120),
  state: z
    .string()
    .trim()
    .length(2, "UF com 2 letras.")
    .transform((s) => s.toUpperCase()),
  lat: coord(-90, 90),
  lng: coord(-180, 180),
  showOnSite: z.boolean(),
  pickupEnabled: z.boolean(),
  pickupInstructions: text(300),
});

export type AddressInput = z.input<typeof addressInput>;
type AddressResult = { address: Settings["address"]; located: boolean };

const ADDRESS_FIELDS = ["cep", "street", "number", "neighborhood", "city", "state"] as const;

async function locate(address: Settings["address"]): Promise<AddressResult> {
  const s = await getSettings();
  // Usa o endereço recém-salvo (o cache da requisição pode guardar o antigo).
  const point = await locateStoreAddress({ ...s, address });
  return { address: point ? { ...address, lat: point.lat, lng: point.lng } : address, located: !!point };
}

export async function saveAddressSettings(input: AddressInput): Promise<ActionResult<AddressResult>> {
  await requireAdmin(ROLES);
  const parsed = addressInput.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const next = parsed.data;
  try {
    const current = (await getSettings()).address;
    const moved = ADDRESS_FIELDS.some((k) => String(current[k] ?? "").trim().toLowerCase() !== String(next[k] ?? "").trim().toLowerCase());
    const manualPoint = next.lat != null && next.lng != null && (next.lat !== current.lat || next.lng !== current.lng);
    // Endereço mudou e ninguém ajustou as coordenadas à mão: localiza de novo no mapa.
    if (moved && !manualPoint) {
      const saved = await saveSettingsGroup("address", { ...next, lat: null, lng: null });
      const r = await locate(saved);
      done();
      return {
        ok: true,
        data: r,
        message: r.located ? "Endereço salvo e localizado no mapa." : "Endereço salvo, mas não conseguimos localizá-lo no mapa. Ajuste as coordenadas abaixo.",
      };
    }
    const saved = await saveSettingsGroup("address", next);
    if (saved.lat == null || saved.lng == null) {
      const r = await locate(saved);
      done();
      return { ok: true, data: r, message: r.located ? "Endereço salvo e localizado no mapa." : "Endereço salvo. Ajuste as coordenadas para o frete funcionar." };
    }
    return { ok: true, data: { address: saved, located: true }, message: done("Endereço salvo.") };
  } catch (e) {
    return saveError(e);
  }
}

/** Localiza de novo o endereço salvo da loja (botão “Localizar novamente”). */
export async function relocateStoreAction(): Promise<ActionResult<AddressResult>> {
  await requireAdmin(ROLES);
  try {
    const current = (await getSettings()).address;
    if (!current.city || !current.street) return fail("Salve o endereço da loja primeiro.");
    const r = await locate(current);
    if (!r.located) return fail("Não conseguimos localizar o endereço. Confira rua e número ou ajuste as coordenadas manualmente.");
    done();
    return { ok: true, data: r, message: "Endereço localizado no mapa." };
  } catch (e) {
    return saveError(e);
  }
}

// ───────── Frete

const km = (max: number) => z.number({ error: "Informe um número." }).min(0, "Não pode ser negativo.").max(max, `Máximo de ${max} km.`);
const money = z.number({ error: "Informe um valor." }).int().min(0, "Não pode ser negativo.").max(10_000_000, "Valor alto demais.");

const shippingInput = z
  .object({
    enabled: z.boolean(),
    pricePerKmCents: money,
    baseFeeCents: money,
    minFeeCents: money,
    extraPerItemCents: money,
    maxDistanceKm: km(500),
    freeShippingAboveCents: money.nullable(),
    freeShippingMaxKm: km(500).nullable(),
    roundToCents: z.union([z.literal(1), z.literal(10), z.literal(50), z.literal(100)]),
    distanceMode: z.enum(["route", "straight"]),
    straightLineFactor: z.number({ error: "Informe o fator." }).min(1, "O fator mínimo é 1.").max(3, "O fator máximo é 3."),
    restrictToAllowedCities: z.boolean(),
    allowedCities: z
      .array(z.string().trim().min(2).max(80))
      .max(300)
      .transform((list) => {
        const seen = new Set<string>();
        return list.filter((c) => {
          const k = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }),
    etaText: text(120),
  })
  .refine((v) => !v.restrictToAllowedCities || v.allowedCities.length > 0, { path: ["allowedCities"], message: "Marque pelo menos uma cidade atendida." });

export type ShippingInput = z.input<typeof shippingInput>;

export async function saveShippingSettings(input: ShippingInput): Promise<ActionResult<Settings["shipping"]>> {
  await requireAdmin(ROLES);
  const parsed = shippingInput.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const data = await saveSettingsGroup("shipping", parsed.data);
    return { ok: true, data, message: done("Frete salvo.") };
  } catch (e) {
    return saveError(e);
  }
}

const simulateInput = z.object({
  shipping: shippingInput,
  cep: z
    .string()
    .transform(onlyDigits)
    .refine((d) => d.length === 8, "Informe um CEP com 8 números."),
  number: text(20),
  subtotalCents: money,
  itemCount: z.number().int().min(1).max(99),
});

export type SimulationResult = {
  quote: Pick<ShippingQuote, "ok" | "available" | "reason" | "feeCents" | "free" | "freeReason" | "missingForFreeCents" | "distanceKm" | "method" | "address">;
  breakdown: FeeBreakdown | null;
  deliveryDisabled: boolean;
};

/** Simula o frete com os valores do formulário (ainda não salvos). */
export async function simulateShippingAction(input: z.input<typeof simulateInput>): Promise<ActionResult<SimulationResult>> {
  await requireAdmin(ROLES);
  const parsed = simulateInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "");
    return fail(field === "shipping" ? "Corrija os campos do frete antes de simular." : (issue?.message ?? "Confira os dados da simulação."));
  }
  const { shipping, cep, number, subtotalCents, itemCount } = parsed.data;
  try {
    const s = await getSettings();
    const draft = { ...s.shipping, ...shipping, enabled: true };
    const q = await quoteShipping({ cep, number, subtotalCents, itemCount }, { ...s, shipping: draft });
    const breakdown = q.ok ? feeBreakdown(draft, { distanceKm: q.distanceKm, itemCount, subtotalCents }) : null;
    return {
      ok: true,
      data: {
        quote: {
          ok: q.ok,
          available: q.available,
          reason: q.reason,
          feeCents: q.feeCents,
          free: q.free,
          freeReason: q.freeReason,
          missingForFreeCents: q.missingForFreeCents,
          distanceKm: q.distanceKm,
          method: q.method,
          address: q.address,
        },
        breakdown,
        deliveryDisabled: !shipping.enabled,
      },
    };
  } catch (e) {
    console.error("[configurações] simulação de frete falhou:", e);
    return fail("Não foi possível calcular agora. Tente de novo em instantes.");
  }
}

// ───────── Pagamentos

const paymentInput = z
  .object({
    stripeEnabled: z.boolean(),
    pixManualEnabled: z.boolean(),
    pixKeyType: z.enum(["cnpj", "cpf", "email", "phone", "random"]),
    pixKey: text(140),
    pixHolder: text(120),
    onDeliveryCash: z.boolean(),
    onDeliveryCard: z.boolean(),
    onDeliveryPix: z.boolean(),
    pixDiscountPercent: z.number({ error: "Informe a porcentagem." }).min(0, "Não pode ser negativo.").max(50, "O desconto máximo é 50%."),
    installmentsMax: z.number({ error: "Informe o número de parcelas." }).int("Use um número inteiro.").min(1, "Mínimo de 1 parcela.").max(24, "Máximo de 24 parcelas."),
    installmentsMinCents: money,
  })
  .transform((v, ctx) => {
    let key = v.pixKey.trim();
    if (key) {
      const d = onlyDigits(key);
      const bad = (message: string) => ctx.addIssue({ code: "custom", path: ["pixKey"], message });
      switch (v.pixKeyType) {
        case "cpf":
          if (!isValidCpf(d)) bad("CPF inválido.");
          key = d;
          break;
        case "cnpj":
          if (d.length !== 14) bad("O CNPJ tem 14 números.");
          key = d;
          break;
        case "email":
          key = key.toLowerCase();
          if (!z.email().safeParse(key).success) bad("E-mail inválido.");
          break;
        case "phone": {
          const local = d.length >= 12 && d.startsWith("55") ? d.slice(2) : d;
          if (local.length !== 10 && local.length !== 11) bad("Telefone com DDD, ex.: (41) 99999-8888.");
          key = `+55${local}`;
          break;
        }
        case "random":
          key = key.toLowerCase();
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key)) bad("A chave aleatória tem 32 letras e números, no formato 1234abcd-…");
          break;
      }
    } else if (v.pixManualEnabled) {
      ctx.addIssue({ code: "custom", path: ["pixKey"], message: "Informe a chave Pix para receber os pagamentos." });
    }
    if (v.pixManualEnabled && !v.pixHolder) ctx.addIssue({ code: "custom", path: ["pixHolder"], message: "Informe o nome do titular da conta." });
    return { ...v, pixKey: key, pixDiscountPercent: Math.round(v.pixDiscountPercent * 10) / 10 };
  });

export type PaymentInput = z.input<typeof paymentInput>;

export async function savePaymentSettings(input: PaymentInput): Promise<ActionResult<Settings["payment"]>> {
  await requireAdmin(ROLES);
  const parsed = paymentInput.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const data = await saveSettingsGroup("payment", parsed.data);
    return { ok: true, data, message: done("Pagamentos salvos.") };
  } catch (e) {
    return saveError(e);
  }
}

// ───────── Integrações (chaves de API)

const PK_RE = /^pk_(live|test)_[A-Za-z0-9]+$/;
const SK_RE = /^(sk|rk)_(live|test)_[A-Za-z0-9]+$/;
const WH_RE = /^whsec_[A-Za-z0-9+/=]+$/;

const integrationsInput = z.object({
  stripePublishableKey: text(255).refine((v) => v === "" || PK_RE.test(v), "A chave publicável começa com pk_live_ ou pk_test_."),
  stripeSecretKey: text(255).refine((v) => v === "" || SK_RE.test(v), "A chave secreta começa com sk_live_ ou sk_test_ (ou rk_ para chave restrita)."),
  clearStripeSecretKey: z.boolean(),
  stripeWebhookSecret: text(255).refine((v) => v === "" || WH_RE.test(v), "O segredo do webhook começa com whsec_."),
  clearStripeWebhookSecret: z.boolean(),
  mapsProvider: z.enum(["osm", "google", "openrouteservice", "mapbox"]),
  mapsApiKey: text(400).refine((v) => !/\s/.test(v), "A chave não pode ter espaços."),
  clearMapsApiKey: z.boolean(),
  googleAnalyticsId: text(30)
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "" || /^G-[A-Z0-9]{4,20}$/.test(v), "O ID do Google Analytics 4 começa com G-, ex.: G-ABC123XYZ."),
  metaPixelId: text(30).refine((v) => v === "" || /^\d{6,20}$/.test(v), "O ID do Pixel tem só números."),
});

export type IntegrationsInput = z.input<typeof integrationsInput>;
export type SecretPreviews = { stripeSecretKey: string; stripeWebhookSecret: string; mapsApiKey: string };

export async function saveIntegrationsSettings(input: IntegrationsInput): Promise<ActionResult<{ previews: SecretPreviews; publishableKey: string }>> {
  await requireAdmin(ROLES);
  const parsed = integrationsInput.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  try {
    const current = (await getSettings()).integrations;
    const effSk = v.clearStripeSecretKey ? "" : v.stripeSecretKey || current.stripeSecretKey;
    const effPk = v.stripePublishableKey;
    if (effPk && effSk && stripeMode(effPk) !== stripeMode(effSk)) {
      const field = v.stripeSecretKey ? "stripeSecretKey" : "stripePublishableKey";
      return fail("As chaves da Stripe são de modos diferentes.", {
        [field]: "Use as duas chaves do mesmo modo: teste (pk_test_ + sk_test_) ou produção (pk_live_ + sk_live_).",
      });
    }
    const effMapsKey = v.clearMapsApiKey ? "" : v.mapsApiKey || current.mapsApiKey;
    if (v.mapsProvider !== "osm" && !effMapsKey) {
      return fail("Informe a chave do provedor de mapas.", { mapsApiKey: "Esse provedor precisa de uma chave de API. Sem chave, use o OpenStreetMap." });
    }
    const saved = await saveSettingsGroup("integrations", {
      stripePublishableKey: effPk,
      stripeSecretKey: v.clearStripeSecretKey ? CLEAR_SECRET : v.stripeSecretKey,
      stripeWebhookSecret: v.clearStripeWebhookSecret ? CLEAR_SECRET : v.stripeWebhookSecret,
      mapsProvider: v.mapsProvider,
      mapsApiKey: v.clearMapsApiKey ? CLEAR_SECRET : v.mapsApiKey,
      googleAnalyticsId: v.googleAnalyticsId,
      metaPixelId: v.metaPixelId,
    });
    return {
      ok: true,
      data: {
        publishableKey: saved.stripePublishableKey,
        previews: {
          stripeSecretKey: maskSecret(saved.stripeSecretKey),
          stripeWebhookSecret: maskSecret(saved.stripeWebhookSecret),
          mapsApiKey: maskSecret(saved.mapsApiKey),
        },
      },
      message: done("Integrações salvas."),
    };
  } catch (e) {
    return saveError(e);
  }
}

/** Testa a chave secreta (a digitada ou a salva) consultando o saldo da conta. */
export async function testStripeAction(secretKey?: string): Promise<ActionResult<{ mode: "test" | "live"; account: string | null }>> {
  await requireAdmin(ROLES);
  const typed = z.string().trim().max(255).optional().safeParse(secretKey);
  if (!typed.success) return fail("Chave inválida.");
  const key = typed.data || (await getSettings()).integrations.stripeSecretKey;
  if (!key) return fail("Cadastre a chave secreta da Stripe para testar.");
  if (!SK_RE.test(key)) return fail("A chave secreta começa com sk_live_ ou sk_test_ (ou rk_ para chave restrita).");
  try {
    const stripe = new Stripe(key, { timeout: 15_000, maxNetworkRetries: 0, appInfo: { name: "Tirvo Loja" } });
    const balance = await stripe.balance.retrieve();
    let account: string | null = null;
    try {
      const acc = await stripe.accounts.retrieveCurrent();
      account = acc.business_profile?.name || acc.settings?.dashboard?.display_name || acc.email || null;
    } catch {
      // Chaves restritas podem não ler os dados da conta; o saldo já confirma a conexão.
    }
    return { ok: true, data: { mode: balance.livemode ? "live" : "test", account }, message: "Conexão com a Stripe funcionando." };
  } catch (e) {
    const err = e as { type?: string; message?: string };
    if (err.type === "StripeAuthenticationError") return fail("A Stripe recusou a chave. Confira se copiou a chave secreta inteira.");
    if (err.type === "StripePermissionError") return fail("A chave restrita não tem permissão de leitura do saldo. Dê permissão de leitura em “Balance”.");
    if (err.type === "StripeConnectionError") return fail("Não foi possível falar com a Stripe agora. Verifique a internet do servidor.");
    return fail(`A Stripe respondeu com erro: ${err.message ?? "desconhecido"}`);
  }
}

// Ponto de referência para a rota de teste: Praça Tiradentes, Centro de Curitiba.
const SAMPLE_POINT = { lat: -25.4296, lng: -49.2713, label: "Praça Tiradentes, Centro de Curitiba" };

const mapsTestInput = z.object({
  provider: z.enum(["osm", "google", "openrouteservice", "mapbox"]),
  apiKey: text(400).optional(),
});

export type MapsTestResult = { lat: number; lng: number; routeKm: number | null; straightKm: number; sample: string; addressLabel: string };

/** Localiza o endereço da loja com o provedor escolhido e calcula uma rota de exemplo. */
export async function testMapsAction(input: z.input<typeof mapsTestInput>): Promise<ActionResult<MapsTestResult>> {
  await requireAdmin(ROLES);
  const parsed = mapsTestInput.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const s = await getSettings();
  const provider = parsed.data.provider as MapsProvider;
  const key = parsed.data.apiKey || (provider === s.integrations.mapsProvider ? s.integrations.mapsApiKey : "");
  if (provider !== "osm" && !key) return fail("Informe a chave de API desse provedor para testar.");
  const a = s.address;
  const query = a.street
    ? { street: a.street, number: a.number, neighborhood: a.neighborhood, city: a.city || "Curitiba", state: a.state || "PR", cep: a.cep }
    : { street: "Rua XV de Novembro", number: "", neighborhood: "Centro", city: "Curitiba", state: "PR" };
  const addressLabel = [[query.street, query.number].filter(Boolean).join(", "), query.city].join(" · ");
  try {
    const point = await geocodeWith(provider, key, query, null);
    if (!point) return fail(`O provedor não encontrou o endereço “${addressLabel}”. Confira o endereço da loja.`);
    const meters = await routeMetersWith(provider, key, point, SAMPLE_POINT);
    const rad = (d: number) => (d * Math.PI) / 180;
    const h =
      Math.sin(rad(SAMPLE_POINT.lat - point.lat) / 2) ** 2 +
      Math.cos(rad(point.lat)) * Math.cos(rad(SAMPLE_POINT.lat)) * Math.sin(rad(SAMPLE_POINT.lng - point.lng) / 2) ** 2;
    const straightKm = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
    return {
      ok: true,
      data: {
        lat: point.lat,
        lng: point.lng,
        routeKm: meters != null ? Math.round(meters / 100) / 10 : null,
        straightKm: Math.round(straightKm * 10) / 10,
        sample: SAMPLE_POINT.label,
        addressLabel,
      },
      message: meters != null ? "Mapa e rotas funcionando." : "Endereço localizado, mas o provedor não calculou a rota.",
    };
  } catch (e) {
    return fail(`O provedor respondeu com erro: ${(e as Error).message || "desconhecido"}`);
  }
}

// ───────── App e notificações

const pushInput = z.object({
  subject: z
    .string()
    .trim()
    .max(160)
    .transform((v) => v.replace(/^mailto:/i, "").toLowerCase())
    .refine((v) => z.email().safeParse(v).success, "Informe um e-mail de contato válido."),
  promptEnabled: z.boolean(),
  promptDelaySeconds: z.number({ error: "Informe os segundos." }).int("Use um número inteiro.").min(0, "Não pode ser negativo.").max(600, "Máximo de 600 segundos."),
  autoNotifyPromotions: z.boolean(),
});

export type PushInput = z.input<typeof pushInput>;

export async function savePushSettings(input: PushInput): Promise<ActionResult> {
  await requireAdmin(ROLES);
  const parsed = pushInput.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    // Só os campos editáveis: as chaves VAPID continuam as mesmas.
    await saveSettingsGroup("push", { ...parsed.data, subject: `mailto:${parsed.data.subject}` });
    return { ok: true, message: done("Notificações salvas.") };
  } catch (e) {
    return saveError(e);
  }
}

// ───────── SEO e aparência

const seoInput = z.object({
  title: z.string().trim().min(3, "Informe o título do site.").max(90, "Use até 90 caracteres."),
  description: z.string().trim().min(20, "Escreva uma descrição de pelo menos 20 caracteres.").max(320, "Use até 320 caracteres."),
  keywords: text(500),
  ogImage: text(500).refine((v) => v === "" || v.startsWith("/") || isHttpUrl(v), "Imagem inválida."),
  defaultTheme: z.enum(["dark", "light"]),
  heroAutoplayMs: z.number({ error: "Informe o tempo." }).int().min(0, "Não pode ser negativo.").max(30_000, "Máximo de 30 segundos."),
  showBrands: z.boolean(),
  showNewsletter: z.boolean(),
  showAppSection: z.boolean(),
});

export type SeoInput = z.input<typeof seoInput>;

export async function saveSeoSettings(input: SeoInput): Promise<ActionResult> {
  await requireAdmin(ROLES);
  const parsed = seoInput.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  try {
    await saveSettingsGroup("seo", { title: v.title, description: v.description, keywords: v.keywords, ogImage: v.ogImage });
    await saveSettingsGroup("appearance", {
      defaultTheme: v.defaultTheme,
      heroAutoplayMs: v.heroAutoplayMs,
      showBrands: v.showBrands,
      showNewsletter: v.showNewsletter,
      showAppSection: v.showAppSection,
    });
    return { ok: true, message: done("SEO e aparência salvos.") };
  } catch (e) {
    return saveError(e);
  }
}
