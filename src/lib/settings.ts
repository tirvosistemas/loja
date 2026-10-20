import { cache } from "react";
import { z } from "zod";
import { db } from "./db";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto";
import { freeShippingRule } from "./shipping/free";

// Configurações da loja, editadas no painel (Configurações) e guardadas na tabela Setting,
// um registro por grupo. Cada grupo tem valores padrão, então a loja funciona antes de
// qualquer configuração.

export const RMC_CITIES = [
  "Curitiba", "Adrianópolis", "Agudos do Sul", "Almirante Tamandaré", "Araucária", "Balsa Nova",
  "Bocaiúva do Sul", "Campina Grande do Sul", "Campo do Tenente", "Campo Largo", "Campo Magro",
  "Cerro Azul", "Colombo", "Contenda", "Doutor Ulysses", "Fazenda Rio Grande", "Itaperuçu", "Lapa",
  "Mandirituba", "Piên", "Pinhais", "Piraquara", "Quatro Barras", "Quitandinha", "Rio Branco do Sul",
  "Rio Negro", "São José dos Pinhais", "Tijucas do Sul", "Tunas do Paraná",
];

const str = (d = "") => z.string().trim().default(d);
const cents = (d: number) => z.number().int().min(0).default(d);
const nullableCents = (d: number | null) => z.number().int().min(0).nullable().default(d);

export const storeSchema = z.object({
  name: str("Tirvo"),
  tagline: str("Se algo pode ser melhorado, ainda não está pronto."),
  description: str("Eletrônicos e acessórios com entrega rápida por motoboy em Curitiba e região metropolitana."),
  whatsapp: str(""), // número que recebe os pedidos, só dígitos com DDI: 5541999998888
  phone: str(""),
  email: str(""),
  legalName: str(""),
  cnpj: str(""),
  instagram: str(""),
  facebook: str(""),
  tiktok: str(""),
  youtube: str(""),
  businessHours: str("Seg a sex, 9h às 18h · Sáb, 9h às 13h"),
  announcementEnabled: z.boolean().default(true),
  announcementText: str("Entrega rápida por motoboy em Curitiba e região metropolitana"),
  announcementHref: str("/ofertas"),
});

export const addressSchema = z.object({
  cep: str(""),
  street: str(""),
  number: str(""),
  complement: str(""),
  neighborhood: str(""),
  city: str("Curitiba"),
  state: str("PR"),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
  showOnSite: z.boolean().default(true),
  pickupEnabled: z.boolean().default(true),
  pickupInstructions: str("Retire na loja em horário comercial. Leve o número do pedido."),
});

export const shippingSchema = z.object({
  enabled: z.boolean().default(true),
  pricePerKmCents: cents(250), // R$ 2,50 por km
  baseFeeCents: cents(500), // taxa fixa de saída
  minFeeCents: cents(1000),
  extraPerItemCents: cents(0), // por unidade a partir da 2ª
  maxDistanceKm: z.number().min(0).default(60),
  // Frete grátis da loja, para todos os produtos: até freeShippingMaxKm da loja (null = toda a
  // área de entrega) e a partir de freeShippingAboveCents em produtos (null ou 0 = sem mínimo).
  freeShippingEnabled: z.boolean().default(false),
  freeShippingAboveCents: nullableCents(2000),
  freeShippingMaxKm: z.number().min(0).nullable().default(30),
  roundToCents: cents(50), // arredonda para cima: 50 = de R$ 0,50 em R$ 0,50
  distanceMode: z.enum(["route", "straight"]).default("route"),
  straightLineFactor: z.number().min(1).max(3).default(1.3),
  restrictToAllowedCities: z.boolean().default(true),
  allowedCities: z.array(z.string()).default(RMC_CITIES),
  etaText: str("Entrega em até 24 horas úteis"),
});

export const paymentSchema = z.object({
  stripeEnabled: z.boolean().default(false),
  pixManualEnabled: z.boolean().default(true),
  pixKeyType: z.enum(["cnpj", "cpf", "email", "phone", "random"]).default("cnpj"),
  pixKey: str(""),
  pixHolder: str(""),
  onDeliveryCash: z.boolean().default(true),
  onDeliveryCard: z.boolean().default(true),
  onDeliveryPix: z.boolean().default(true),
  pixDiscountPercent: z.number().min(0).max(50).default(5),
  installmentsMax: z.number().int().min(1).max(24).default(12),
  installmentsMinCents: cents(5000),
});

export const integrationsSchema = z.object({
  stripePublishableKey: str(""),
  stripeSecretKey: str(""), // criptografado
  stripeWebhookSecret: str(""), // criptografado
  mapsProvider: z.enum(["osm", "google", "openrouteservice", "mapbox"]).default("osm"),
  mapsApiKey: str(""), // criptografado
  googleAnalyticsId: str(""),
  metaPixelId: str(""),
});

export const AI_PROVIDER_IDS = ["gemini", "openai", "anthropic", "deepseek", "xai", "mistral", "openrouter", "custom"] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

// Inteligência artificial do painel (importador, cadastro de produto). Uma chave por provedor,
// para trocar de provedor sem perder as outras. Modelo vazio = escolhido automaticamente.
export const aiSchema = z.object({
  provider: z.enum(AI_PROVIDER_IDS).default("gemini"),
  geminiKey: str(""), // criptografado
  openaiKey: str(""), // criptografado
  anthropicKey: str(""), // criptografado
  deepseekKey: str(""), // criptografado
  xaiKey: str(""), // criptografado
  mistralKey: str(""), // criptografado
  openrouterKey: str(""), // criptografado
  customKey: str(""), // criptografado
  customBaseUrl: str(""), // ex.: https://api.exemplo.com/v1 (compatível com a API da OpenAI)
  models: z.record(z.string(), z.string().trim().max(120)).default({}),
});

// Ferramentas do catálogo: chaves do importador, calculadora de preço, padrão das fotos e feed.
export const catalogSchema = z.object({
  googleDriveApiKey: str(""), // criptografado · importador de produtos
  cosmosToken: str(""), // criptografado · busca por código de barras (Cosmos/Bluesoft)
  // Calculadora de preço: porcentagens sobre o preço de venda, valores fixos em centavos.
  feeCardPercent: z.number().min(0).max(30).default(4.99), // maquininha / cartão online
  feePixPercent: z.number().min(0).max(30).default(0),
  taxPercent: z.number().min(0).max(40).default(6), // Simples Nacional, faixa inicial do comércio
  packagingCents: cents(200),
  otherCostCents: cents(0), // por unidade (etiqueta, brinde, …)
  targetMarginPercent: z.number().min(0).max(80).default(30),
  priceEnding: z.enum(["90", "99", "00", "none"]).default("90"),
  // Padrão das fotos dos produtos.
  photoSquare: z.boolean().default(true),
  photoBackground: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"),
  photoPaddingPercent: z.number().min(0).max(30).default(6),
  watermarkEnabled: z.boolean().default(false),
  watermarkImage: str("/brand/tirvo-logo-para-fundo-claro.svg"),
  watermarkPosition: z.enum(["bottom-right", "bottom-left", "top-right", "top-left", "center"]).default("bottom-right"),
  watermarkOpacity: z.number().min(5).max(100).default(35),
  watermarkSizePercent: z.number().min(5).max(60).default(22),
  // Catálogo para Google Shopping e Meta (Instagram/Facebook).
  feedEnabled: z.boolean().default(true),
});

export const pushSchema = z.object({
  vapidPublicKey: str(""),
  vapidPrivateKey: str(""), // criptografado
  subject: str("mailto:contato@tirvo.com.br"),
  promptEnabled: z.boolean().default(true),
  promptDelaySeconds: z.number().int().min(0).max(600).default(25),
  autoNotifyPromotions: z.boolean().default(true),
});

export const seoSchema = z.object({
  title: str("Tirvo · Eletrônicos em Curitiba e região"),
  description: str(
    "Headsets, fones, controles, minigames, suportes de celular, acessórios para carro, chapinhas e mais, com entrega rápida por motoboy em Curitiba e região metropolitana.",
  ),
  keywords: str("eletrônicos, Curitiba, headset gamer, fone de ouvido, controle de videogame, minigame, suporte de celular, chapinha, babyliss, massageador"),
  ogImage: str("/og-image.png"),
});

export const appearanceSchema = z.object({
  defaultTheme: z.enum(["dark", "light"]).default("dark"),
  heroAutoplayMs: z.number().int().min(0).max(30000).default(6000),
  showBrands: z.boolean().default(true),
  showNewsletter: z.boolean().default(true),
  showAppSection: z.boolean().default(true),
});

export const settingsSchemas = {
  store: storeSchema,
  address: addressSchema,
  shipping: shippingSchema,
  payment: paymentSchema,
  integrations: integrationsSchema,
  ai: aiSchema,
  catalog: catalogSchema,
  push: pushSchema,
  seo: seoSchema,
  appearance: appearanceSchema,
} as const;

export type SettingsGroup = keyof typeof settingsSchemas;
export type Settings = { [K in SettingsGroup]: z.infer<(typeof settingsSchemas)[K]> };
export type StoreSettings = Settings["store"];
export type AddressSettings = Settings["address"];
export type ShippingSettings = Settings["shipping"];
export type PaymentSettings = Settings["payment"];
export type IntegrationsSettings = Settings["integrations"];
export type PushSettings = Settings["push"];
export type AiSettings = Settings["ai"];
export type CatalogSettings = Settings["catalog"];

/** Campos guardados criptografados. */
export const SECRET_FIELDS: { [K in SettingsGroup]?: string[] } = {
  integrations: ["stripeSecretKey", "stripeWebhookSecret", "mapsApiKey"],
  ai: ["geminiKey", "openaiKey", "anthropicKey", "deepseekKey", "xaiKey", "mistralKey", "openrouterKey", "customKey"],
  catalog: ["googleDriveApiKey", "cosmosToken"],
  push: ["vapidPrivateKey"],
};

/** Valor que o formulário envia num campo secreto para apagá-lo. Vazio mantém o atual. */
export const CLEAR_SECRET = "__CLEAR__";

const GROUPS = Object.keys(settingsSchemas) as SettingsGroup[];

function parseGroup<K extends SettingsGroup>(group: K, raw: unknown): Settings[K] {
  const schema = settingsSchemas[group];
  const parsed = schema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data as Settings[K];
  // Campo inválido no banco: usa os padrões só onde falhou.
  const base = schema.parse({}) as Record<string, unknown>;
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  for (const k of Object.keys(base)) {
    if (!(k in obj)) continue;
    const field = (schema.shape as Record<string, z.ZodType>)[k];
    const ok = field.safeParse(obj[k]);
    if (ok.success) base[k] = ok.data;
  }
  return base as Settings[K];
}

function decryptGroup<K extends SettingsGroup>(group: K, value: Settings[K]): Settings[K] {
  const fields = SECRET_FIELDS[group];
  if (!fields) return value;
  const copy = { ...value } as Record<string, unknown>;
  for (const f of fields) copy[f] = decryptSecret(copy[f] as string);
  return copy as Settings[K];
}

type RawRows = Partial<Record<"integrations" | "ai" | "catalog", unknown>>;

/**
 * A versão anterior guardava as chaves da Anthropic e do Google Drive em Integrações. Copia o
 * valor (já criptografado) para "ai" e "catalog" quando lá estiver vazio e tira os campos
 * antigos de Integrações. Devolve as linhas a gravar, ou null se não há nada a migrar.
 */
export function legacyKeyMoves(raw: RawRows): Record<string, Record<string, unknown>> | null {
  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  const old = obj(raw.integrations);
  if (!old || !("anthropicApiKey" in old || "googleDriveApiKey" in old)) return null;
  const { anthropicApiKey, googleDriveApiKey, ...integrations } = old;
  const out: Record<string, Record<string, unknown>> = { integrations };
  const ai = obj(raw.ai);
  if (typeof anthropicApiKey === "string" && anthropicApiKey && !ai?.anthropicKey) {
    out.ai = { ...(ai ?? { provider: "anthropic" }), anthropicKey: anthropicApiKey };
  }
  const catalog = obj(raw.catalog);
  if (typeof googleDriveApiKey === "string" && googleDriveApiKey && !catalog?.googleDriveApiKey) {
    out.catalog = { ...catalog, googleDriveApiKey };
  }
  return out;
}

/** Grava a migração das chaves antigas (uma vez só) e atualiza as linhas lidas. */
async function migrateLegacyKeys(byKey: Map<string, unknown>) {
  const moves = legacyKeyMoves({ integrations: byKey.get("integrations"), ai: byKey.get("ai"), catalog: byKey.get("catalog") });
  if (!moves) return;
  await db.$transaction(
    Object.entries(moves).map(([key, value]) => db.setting.upsert({ where: { key }, create: { key, value: value as object }, update: { value: value as object } })),
  );
  for (const [key, value] of Object.entries(moves)) byKey.set(key, value);
}

async function loadAll(): Promise<Settings> {
  const rows = await db.setting.findMany({ where: { key: { in: GROUPS } } });
  const byKey = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));
  try {
    await migrateLegacyKeys(byKey);
  } catch (e) {
    console.error("[configurações] falha ao migrar chaves antigas:", e);
  }
  const out = {} as Record<SettingsGroup, unknown>;
  for (const g of GROUPS) out[g] = decryptGroup(g, parseGroup(g, byKey.get(g)));
  return out as Settings;
}

/** Todas as configurações, com segredos já descriptografados. Use só no servidor. */
export const getSettings = cache(loadAll);

export async function getSettingsGroup<K extends SettingsGroup>(group: K): Promise<Settings[K]> {
  return (await getSettings())[group];
}

/**
 * Salva um grupo. Mescla com o que já existe; campos secretos vazios mantêm o valor atual
 * e CLEAR_SECRET apaga. Retorna o grupo salvo (descriptografado).
 */
export async function saveSettingsGroup<K extends SettingsGroup>(
  group: K,
  patch: Partial<Settings[K]>,
): Promise<Settings[K]> {
  if (group === "integrations") {
    // Salvar Integrações descarta as chaves antigas: copia antes para os grupos novos.
    const rows = await db.setting.findMany({ where: { key: { in: ["integrations", "ai", "catalog"] } } });
    await migrateLegacyKeys(new Map(rows.map((r) => [r.key, r.value])));
  }
  const row = await db.setting.findUnique({ where: { key: group } });
  const current = parseGroup(group, row?.value) as Record<string, unknown>; // segredos ainda criptografados
  const next: Record<string, unknown> = { ...current };
  const secrets = new Set(SECRET_FIELDS[group] ?? []);
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === undefined) continue;
    if (secrets.has(k)) {
      if (v === "" || v === null) continue;
      next[k] = v === CLEAR_SECRET ? "" : encryptSecret(String(v));
    } else next[k] = v;
  }
  const validated = settingsSchemas[group].parse(next) as Record<string, unknown>;
  await db.setting.upsert({
    where: { key: group },
    create: { key: group, value: validated as object },
    update: { value: validated as object },
  });
  return decryptGroup(group, validated as Settings[K]);
}

/** Prévia mascarada dos segredos para o painel ("sk_live_••••9xQ"). */
export async function getSecretPreviews() {
  const s = await getSettings();
  return {
    stripeSecretKey: maskSecret(s.integrations.stripeSecretKey),
    stripeWebhookSecret: maskSecret(s.integrations.stripeWebhookSecret),
    mapsApiKey: maskSecret(s.integrations.mapsApiKey),
    vapidPrivateKey: maskSecret(s.push.vapidPrivateKey),
  };
}

export function stripeIsReady(s: Settings) {
  return s.payment.stripeEnabled && !!s.integrations.stripeSecretKey && !!s.integrations.stripePublishableKey;
}

/** Métodos de pagamento disponíveis no checkout, na ordem de exibição. */
export function enabledPaymentMethods(s: Settings) {
  const list: Array<"ONLINE_STRIPE" | "PIX_MANUAL" | "PIX_ON_DELIVERY" | "CARD_ON_DELIVERY" | "CASH_ON_DELIVERY"> = [];
  if (stripeIsReady(s)) list.push("ONLINE_STRIPE");
  if (s.payment.pixManualEnabled && s.payment.pixKey) list.push("PIX_MANUAL");
  if (s.payment.onDeliveryPix) list.push("PIX_ON_DELIVERY");
  if (s.payment.onDeliveryCard) list.push("CARD_ON_DELIVERY");
  if (s.payment.onDeliveryCash) list.push("CASH_ON_DELIVERY");
  return list;
}

/** O que pode ir para o navegador: nada de segredos. */
export async function getPublicSettings() {
  const s = await getSettings();
  return {
    store: s.store,
    address: s.address.showOnSite
      ? {
          street: s.address.street,
          number: s.address.number,
          complement: s.address.complement,
          neighborhood: s.address.neighborhood,
          city: s.address.city,
          state: s.address.state,
          cep: s.address.cep,
        }
      : null,
    pickupEnabled: s.address.pickupEnabled,
    pickupInstructions: s.address.pickupInstructions,
    shipping: {
      enabled: s.shipping.enabled,
      freeShipping: freeShippingRule(s.shipping),
      maxDistanceKm: s.shipping.maxDistanceKm,
      etaText: s.shipping.etaText,
      allowedCities: s.shipping.restrictToAllowedCities ? s.shipping.allowedCities : null,
    },
    payment: {
      methods: enabledPaymentMethods(s),
      pixDiscountPercent: s.payment.pixDiscountPercent,
      installmentsMax: s.payment.installmentsMax,
      installmentsMinCents: s.payment.installmentsMinCents,
      pixKeyType: s.payment.pixKeyType,
      pixKey: s.payment.pixManualEnabled ? s.payment.pixKey : "",
      pixHolder: s.payment.pixHolder,
    },
    push: {
      vapidPublicKey: s.push.vapidPublicKey,
      promptEnabled: s.push.promptEnabled,
      promptDelaySeconds: s.push.promptDelaySeconds,
    },
    appearance: s.appearance,
    seo: s.seo,
    analytics: { googleAnalyticsId: s.integrations.googleAnalyticsId, metaPixelId: s.integrations.metaPixelId },
  };
}

export type PublicSettings = Awaited<ReturnType<typeof getPublicSettings>>;
