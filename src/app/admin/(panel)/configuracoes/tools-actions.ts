"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, fromZod, type ActionResult } from "@/lib/action";
import { maskSecret } from "@/lib/crypto";
import { AI_PROVIDER_IDS, CLEAR_SECRET, getSettings, saveSettingsGroup, type AiProviderId } from "@/lib/settings";
import { AI_PROVIDERS, aiProvider, pickModel } from "@/lib/ai/providers";
import { aiErrorMessage, aiJson, listModels } from "@/lib/ai/client";
import { BarcodeError, lookupBarcode } from "@/lib/barcode";
import { readPhoto, standardizePreview } from "@/lib/photos";
import { isUploadKey } from "@/lib/images";

// Configurações → Inteligência artificial e Ferramentas do catálogo.

const ROLES: ("OWNER" | "ADMIN")[] = ["OWNER", "ADMIN"];

function done(message: string) {
  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin/produtos", "layout");
  return message;
}

const keyText = z
  .string()
  .trim()
  .max(400, "Chave longa demais.")
  .refine((v) => !/\s/.test(v), "A chave não pode ter espaços.");

function isHttpUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// ───────── Inteligência artificial

const providerEnum = z.enum(AI_PROVIDER_IDS);
const perProvider = <T extends z.ZodType>(t: T) => z.partialRecord(providerEnum, t);

const aiInput = z.object({
  provider: providerEnum,
  keys: perProvider(keyText),
  clear: perProvider(z.boolean()),
  models: perProvider(z.string().trim().max(120, "Nome de modelo longo demais.").regex(/^[\w.:/@-]*$/, "Use só o nome do modelo, sem espaços.")),
  customBaseUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || isHttpUrl(v), "Informe o endereço completo (https://…/v1)."),
});

export type AiSettingsInput = z.input<typeof aiInput>;
export type AiKeyPreviews = Record<AiProviderId, string>;

async function aiPreviews(): Promise<AiKeyPreviews> {
  const ai = (await getSettings()).ai;
  return Object.fromEntries(AI_PROVIDERS.map((p) => [p.id, maskSecret(ai[p.keyField])])) as AiKeyPreviews;
}

export async function saveAiSettings(input: AiSettingsInput): Promise<ActionResult<{ previews: AiKeyPreviews }>> {
  await requireAdmin(ROLES);
  const parsed = aiInput.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  if (v.provider === "custom" && (!v.customBaseUrl || !v.models.custom)) {
    return fail("Informe o endereço e o modelo do provedor.", {
      ...(v.customBaseUrl ? {} : { customBaseUrl: "Informe o endereço da API (ex.: https://api.groq.com/openai/v1)." }),
      ...(v.models.custom ? {} : { "models.custom": "Informe o nome do modelo." }),
    });
  }
  try {
    const patch: Record<string, unknown> = {
      provider: v.provider,
      customBaseUrl: v.customBaseUrl.replace(/\/+$/, ""),
      models: Object.fromEntries(Object.entries(v.models).filter(([, m]) => m)),
    };
    for (const p of AI_PROVIDERS) patch[p.keyField] = v.clear[p.id] ? CLEAR_SECRET : (v.keys[p.id] ?? "");
    await saveSettingsGroup("ai", patch);
    return { ok: true, data: { previews: await aiPreviews() }, message: done("Inteligência artificial salva.") };
  } catch (e) {
    console.error("[configurações] falha ao salvar IA:", e);
    return fail("Não foi possível salvar agora. Tente de novo.");
  }
}

export type AiTestResult = { model: string; auto: boolean; models: string[]; reply: string };

const aiTestInput = z.object({
  provider: providerEnum,
  apiKey: keyText.optional(),
  model: z.string().trim().max(120).optional(),
  baseUrl: z.string().trim().max(300).optional(),
});

/** Testa a chave (a digitada ou a salva): lista os modelos e faz uma pergunta curtinha. */
export async function testAiAction(input: z.input<typeof aiTestInput>): Promise<ActionResult<AiTestResult>> {
  await requireAdmin(ROLES);
  const parsed = aiTestInput.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const { provider } = parsed.data;
  const ai = (await getSettings()).ai;
  const info = aiProvider(provider);
  const apiKey = parsed.data.apiKey || ai[info.keyField];
  if (!apiKey) return fail(`Cole a chave do ${info.name} para testar.`);
  const baseUrl = provider === "custom" ? (parsed.data.baseUrl || ai.customBaseUrl).replace(/\/+$/, "") : info.baseUrl;
  if (!baseUrl || !isHttpUrl(baseUrl)) return fail("Informe o endereço da API.");
  try {
    let models: string[] = [];
    try {
      models = await listModels({ provider, apiKey, baseUrl });
    } catch (e) {
      if ((e as { status?: number }).status === 401) throw e;
    }
    const chosen = parsed.data.model || pickModel(provider, models);
    if (!chosen) return fail("Informe o nome do modelo.");
    const r = await aiJson({
      config: { provider, apiKey, baseUrl, model: chosen },
      schema: z.object({ resposta: z.string().nullable() }),
      system: "Você é um teste de conexão.",
      prompt: 'Responda {"resposta": "Funcionando"}.',
      maxTokens: 300,
    });
    return {
      ok: true,
      data: { model: r.model, auto: !parsed.data.model, models: models.slice(0, 300).sort(), reply: r.data.resposta ?? "" },
      message: `Conectado ao ${info.name}.`,
    };
  } catch (e) {
    return fail(aiErrorMessage(e));
  }
}

// ───────── Ferramentas do catálogo

const percent = (max: number) => z.number({ error: "Informe um número." }).min(0, "Não pode ser negativo.").max(max, `Máximo de ${max}%.`);
const cents = z.number({ error: "Informe o valor." }).int().min(0).max(100_000_00);

const watermarkSrc = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || isUploadKey(v) || /^\/brand\/[\w.-]+\.(svg|png|webp)$/.test(v), "Imagem inválida.");

const catalogInput = z.object({
  googleDriveApiKey: keyText,
  clearGoogleDriveApiKey: z.boolean(),
  cosmosToken: keyText,
  clearCosmosToken: z.boolean(),
  feeCardPercent: percent(30),
  feePixPercent: percent(30),
  taxPercent: percent(40),
  packagingCents: cents,
  otherCostCents: cents,
  targetMarginPercent: percent(80),
  priceEnding: z.enum(["90", "99", "00", "none"]),
  photoSquare: z.boolean(),
  photoBackground: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  photoPaddingPercent: percent(30),
  watermarkEnabled: z.boolean(),
  watermarkImage: watermarkSrc,
  watermarkPosition: z.enum(["bottom-right", "bottom-left", "top-right", "top-left", "center"]),
  watermarkOpacity: z.number().min(5).max(100),
  watermarkSizePercent: z.number().min(5).max(60),
  feedEnabled: z.boolean(),
});

export type CatalogSettingsInput = z.input<typeof catalogInput>;
export type CatalogPreviews = { googleDriveApiKey: string; cosmosToken: string };

export async function saveCatalogSettings(input: CatalogSettingsInput): Promise<ActionResult<{ previews: CatalogPreviews }>> {
  await requireAdmin(ROLES);
  const parsed = catalogInput.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  if (v.feeCardPercent + v.taxPercent + v.targetMarginPercent >= 95) {
    return fail("Taxa, imposto e margem somados passam de 95%.", { targetMarginPercent: "Com essa soma não há preço possível. Reduza a margem." });
  }
  if (v.watermarkEnabled && !v.watermarkImage) return fail("Escolha a imagem da marca d'água.", { watermarkImage: "Escolha um logo ou envie uma imagem." });
  try {
    const { googleDriveApiKey, clearGoogleDriveApiKey, cosmosToken, clearCosmosToken, ...rest } = v;
    const saved = await saveSettingsGroup("catalog", {
      ...rest,
      googleDriveApiKey: clearGoogleDriveApiKey ? CLEAR_SECRET : googleDriveApiKey,
      cosmosToken: clearCosmosToken ? CLEAR_SECRET : cosmosToken,
    });
    return {
      ok: true,
      data: { previews: { googleDriveApiKey: maskSecret(saved.googleDriveApiKey), cosmosToken: maskSecret(saved.cosmosToken) } },
      message: done("Ferramentas do catálogo salvas."),
    };
  } catch (e) {
    console.error("[configurações] falha ao salvar catálogo:", e);
    return fail("Não foi possível salvar agora. Tente de novo.");
  }
}

/** Testa o token do Cosmos (o digitado ou o salvo) com um código conhecido. */
export async function testCosmosAction(token?: string): Promise<ActionResult<{ name: string; source: string }>> {
  await requireAdmin(ROLES);
  const t = keyText.safeParse(token ?? "");
  const key = (t.success && t.data) || (await getSettings()).catalog.cosmosToken;
  if (!key) return fail("Cole o token do Cosmos para testar.");
  try {
    const r = await lookupBarcode("7894900011517", key);
    if (!r?.name) return fail("O Cosmos não devolveu o produto de teste.");
    return { ok: true, data: { name: r.name, source: r.source }, message: r.source === "Cosmos" ? "Token do Cosmos funcionando." : "O Cosmos não respondeu; a busca usou a base gratuita." };
  } catch (e) {
    return fail(e instanceof BarcodeError ? e.message : "Não foi possível testar agora.");
  }
}

const previewInput = catalogInput.pick({
  photoSquare: true,
  photoBackground: true,
  photoPaddingPercent: true,
  watermarkEnabled: true,
  watermarkImage: true,
  watermarkPosition: true,
  watermarkOpacity: true,
  watermarkSizePercent: true,
});

/** Foto de exemplo quando ainda não há produtos: um "produto" retangular no meio. */
async function samplePhoto() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#f1f1f1"/><rect x="330" y="170" rx="48" width="540" height="460" fill="#2b2b2b"/><circle cx="600" cy="400" r="120" fill="#ff5a1f"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Prévia do padrão das fotos numa foto real da loja (ou num exemplo). */
export async function previewPhotoStandard(input: z.input<typeof previewInput>): Promise<ActionResult<{ before: string; after: string }>> {
  await requireAdmin(ROLES);
  const parsed = previewInput.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  try {
    const img = await db.productImage.findFirst({ orderBy: { createdAt: "desc" }, select: { url: true, sourceUrl: true } });
    const source = (img && ((img.sourceUrl && (await readPhoto(img.sourceUrl))) || (await readPhoto(img.url)))) || (await samplePhoto());
    const [before, after] = await Promise.all([sharp(source).resize({ width: 480, height: 480, fit: "inside" }).jpeg({ quality: 80 }).toBuffer(), standardizePreview(source, parsed.data)]);
    const url = (b: Buffer) => `data:image/jpeg;base64,${b.toString("base64")}`;
    return { ok: true, data: { before: url(before), after: url(after) } };
  } catch (e) {
    console.error("[configurações] prévia das fotos:", e);
    return fail("Não foi possível gerar a prévia.");
  }
}
