import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import { z } from "zod";
import { getSettings, type AiProviderId } from "@/lib/settings";
import { aiProvider, pickModel } from "./providers";

// Cliente único de IA do painel. Três formatos de API cobrem todos os provedores:
// Gemini (nativo), Claude (SDK da Anthropic, com saída estruturada) e o padrão da OpenAI
// (ChatGPT, DeepSeek, Grok, Mistral, OpenRouter e "outro"). Sempre pede JSON e valida com zod.

export type AiConfig = { provider: AiProviderId; apiKey: string; model: string; baseUrl: string };

export class AiError extends Error {}

const TIMEOUT_MS = 180_000;
export const MAX_AI_IMAGES = 6;

/** Provedor escolhido nas Configurações, se tiver chave. */
export async function getAiConfig(): Promise<AiConfig | null> {
  const ai = (await getSettings()).ai;
  const info = aiProvider(ai.provider);
  const apiKey = ai[info.keyField];
  const baseUrl = ai.provider === "custom" ? ai.customBaseUrl.replace(/\/+$/, "") : info.baseUrl;
  const model = ai.models[ai.provider] ?? "";
  if (!apiKey || !baseUrl || (ai.provider === "custom" && !model)) return null;
  return { provider: ai.provider, apiKey, model, baseUrl };
}

/** Reduz para 1568 px no maior lado (o que os modelos aproveitam) e converte em JPEG. */
async function toJpeg(input: Buffer) {
  return sharp(input).rotate().resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
}

// ───────── Lista de modelos

const modelCache = new Map<string, { model: string; at: number }>();

async function httpJson(url: string, init: RequestInit & { provider: AiProviderId }) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (e) {
    throw new AiError((e as Error)?.name === "TimeoutError" ? "A IA demorou demais para responder." : "Não foi possível conectar à IA. Confira a internet do servidor.");
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) throw httpError(res.status, init.provider, body, text);
  return body as Record<string, unknown>;
}

function httpError(status: number, provider: AiProviderId, body: unknown, raw: string) {
  const name = aiProvider(provider).name;
  const b = (Array.isArray(body) ? body[0] : body) as { error?: { message?: string } | string; message?: string } | null;
  const detail = (typeof b?.error === "string" ? b.error : b?.error?.message) ?? b?.message ?? raw.slice(0, 200);
  const e = new AiError(
    status === 401 || (status === 400 && /api[_ ]?key/i.test(detail)) || (status === 403 && /key|auth|permission/i.test(detail))
      ? `Chave de API recusada pelo ${name}. Confira em Configurações → Inteligência artificial.`
      : status === 402 || /credit|balance|billing|quota exceeded|insufficient/i.test(detail)
        ? `Sem créditos ou cota no ${name}.`
        : status === 429
          ? `O ${name} pediu uma pausa (limite de uso atingido). Tente de novo em alguns minutos.`
          : status === 404
            ? `Modelo não encontrado no ${name}. Escolha outro em Configurações → Inteligência artificial.`
            : `O ${name} recusou o pedido (${status}): ${detail}`.slice(0, 300),
  );
  (e as AiError & { status: number; detail: string }).status = status;
  (e as AiError & { status: number; detail: string }).detail = detail;
  return e;
}

/** Modelos disponíveis para a chave (ids). */
export async function listModels(cfg: Pick<AiConfig, "provider" | "apiKey" | "baseUrl">): Promise<string[]> {
  if (cfg.provider === "gemini") {
    const body = await httpJson(`${cfg.baseUrl}/models?pageSize=1000`, { headers: { "x-goog-api-key": cfg.apiKey }, provider: cfg.provider });
    const models = (body.models ?? []) as { name: string; supportedGenerationMethods?: string[] }[];
    return models.filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => m.name.replace(/^models\//, ""));
  }
  if (cfg.provider === "anthropic") {
    const client = new Anthropic({ apiKey: cfg.apiKey, timeout: 30_000, maxRetries: 1 });
    try {
      const out: string[] = [];
      for await (const m of client.models.list({ limit: 100 })) out.push(m.id);
      return out;
    } catch (e) {
      throw anthropicError(e);
    }
  }
  const body = await httpJson(`${cfg.baseUrl}/models`, { headers: { Authorization: `Bearer ${cfg.apiKey}` }, provider: cfg.provider });
  return ((body.data ?? []) as { id: string }[]).map((m) => m.id).filter(Boolean);
}

/** Modelo a usar: o fixado nas Configurações ou o escolhido automaticamente na lista. */
export async function resolveModel(cfg: AiConfig): Promise<string> {
  if (cfg.model) return cfg.model;
  const key = `${cfg.provider}:${cfg.apiKey.slice(-8)}`;
  const hit = modelCache.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.model;
  let model: string;
  try {
    model = pickModel(cfg.provider, await listModels(cfg));
  } catch (e) {
    // Chave recusada não adianta tentar o modelo reserva.
    if ((e as { status?: number }).status === 401) throw e;
    model = aiProvider(cfg.provider).fallbackModel;
  }
  modelCache.set(key, { model, at: Date.now() });
  return model;
}

// ───────── Pedido com resposta em JSON

/**
 * Lê o JSON da IA de forma tolerante: campo inválido vira null (ou lista vazia) em vez de
 * perder a resposta inteira; itens inválidos de listas são descartados.
 */
export function looseParse<S extends z.ZodObject>(schema: S, data: unknown): z.infer<S> {
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, field] of Object.entries(schema.shape) as [string, z.ZodType][]) {
    const v = obj[k] ?? null;
    const ok = field.safeParse(v);
    if (ok.success) {
      out[k] = ok.data;
      continue;
    }
    if (Array.isArray(v) && field instanceof z.ZodArray) {
      const el = field.element as z.ZodType;
      out[k] = v.map((x) => el.safeParse(x)).filter((r) => r.success).map((r) => r.data);
    } else if (field.safeParse(null).success) out[k] = null;
    else if (field.safeParse([]).success) out[k] = [];
    else throw new AiError("A IA não devolveu os dados no formato esperado.");
  }
  return out as z.infer<S>;
}

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1));
      } catch {
        /* cai no erro abaixo */
      }
    }
    throw new AiError("A IA não devolveu os dados no formato esperado.");
  }
}

function anthropicError(e: unknown) {
  if (e instanceof Anthropic.AuthenticationError) return Object.assign(new AiError("Chave da Anthropic recusada. Confira em Configurações → Inteligência artificial."), { status: 401 });
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError("A chave da Anthropic não tem permissão para este modelo.");
  if (e instanceof Anthropic.RateLimitError) return new AiError("A IA pediu uma pausa (limite de uso). Tente de novo em alguns minutos.");
  if (e instanceof Anthropic.NotFoundError) return new AiError("Modelo não encontrado na Anthropic. Escolha outro em Configurações → Inteligência artificial.");
  if (e instanceof Anthropic.BadRequestError && /credit|balance/i.test(e.message)) return new AiError("Sem créditos na conta da Anthropic.");
  if (e instanceof Anthropic.APIError) return new AiError(`A IA falhou (${e.status ?? "conexão"}).`);
  return e instanceof AiError ? e : new AiError((e as Error)?.message || "A IA falhou.");
}

export type AiJsonResult<T> = { data: T; model: string; imagesIgnored: boolean };

/**
 * Pede à IA um objeto JSON no formato do schema (todos os campos obrigatórios, com null para
 * "não sei"). As fotos vão junto quando o modelo aceita; se ele recusar fotos, repete só com texto.
 */
export async function aiJson<S extends z.ZodObject>(opts: { config: AiConfig; schema: S; system: string; prompt: string; images?: Buffer[]; maxTokens?: number }): Promise<AiJsonResult<z.infer<S>>> {
  const { config: cfg, schema } = opts;
  const model = await resolveModel(cfg);
  const images = await Promise.all((opts.images ?? []).slice(0, MAX_AI_IMAGES).map(toJpeg));
  const maxTokens = opts.maxTokens ?? 8000;

  if (cfg.provider === "anthropic") {
    const client = new Anthropic({ apiKey: cfg.apiKey, timeout: TIMEOUT_MS, maxRetries: 2 });
    try {
      const response = await client.beta.messages.parse({
        model,
        max_tokens: Math.max(maxTokens, 16000),
        output_config: { effort: "low", format: betaZodOutputFormat(schema) },
        system: opts.system,
        messages: [
          {
            role: "user",
            content: [
              ...images.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: data.toString("base64") } })),
              { type: "text" as const, text: opts.prompt },
            ],
          },
        ],
      });
      if (response.stop_reason === "refusal") throw new AiError("A IA recusou o pedido.");
      if (!response.parsed_output) throw new AiError("A IA não devolveu os dados no formato esperado.");
      return { data: response.parsed_output as z.infer<S>, model, imagesIgnored: false };
    } catch (e) {
      throw anthropicError(e);
    }
  }

  // Os demais recebem o formato descrito em JSON Schema no próprio texto.
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
  const system = `${opts.system}\n\nResponda somente com um objeto JSON válido, sem texto fora dele, seguindo este JSON Schema (use null quando não souber):\n${jsonSchema}`;

  const run = async (withImages: boolean, jsonMode: boolean) => {
    if (cfg.provider === "gemini") {
      const body = await httpJson(`${cfg.baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        provider: cfg.provider,
        headers: { "x-goog-api-key": cfg.apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [
            {
              role: "user",
              parts: [...(withImages ? images.map((d) => ({ inline_data: { mime_type: "image/jpeg", data: d.toString("base64") } })) : []), { text: opts.prompt }],
            },
          ],
          generationConfig: { maxOutputTokens: Math.max(maxTokens, 16000), ...(jsonMode ? { responseMimeType: "application/json" } : {}) },
        }),
      });
      const blocked = (body.promptFeedback as { blockReason?: string } | undefined)?.blockReason;
      if (blocked) throw new AiError("O Gemini recusou ler este conteúdo.");
      const cand = ((body.candidates ?? []) as { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[])[0];
      const text = (cand?.content?.parts ?? []).filter((p) => !p.thought && p.text).map((p) => p.text).join("");
      if (!text) throw new AiError(cand?.finishReason === "MAX_TOKENS" ? "A resposta da IA ficou longa demais." : "A IA não respondeu. Tente de novo.");
      return text;
    }
    const content = [
      ...(withImages ? images.map((d) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${d.toString("base64")}` } })) : []),
      { type: "text", text: opts.prompt },
    ];
    const body = await httpJson(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      provider: cfg.provider,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "content-type": "application/json",
        ...(cfg.provider === "openrouter" ? { "X-Title": "Tirvo · painel" } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: withImages ? content : opts.prompt },
        ],
        ...(cfg.provider === "openai" ? { max_completion_tokens: Math.max(maxTokens, 16000) } : { max_tokens: maxTokens }),
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    const choice = ((body.choices ?? []) as { message?: { content?: string | { text?: string }[]; refusal?: string } }[])[0];
    if (choice?.message?.refusal) throw new AiError("A IA recusou o pedido.");
    const c = choice?.message?.content;
    const text = typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p.text ?? "").join("") : "";
    if (!text) throw new AiError("A IA não respondeu. Tente de novo.");
    return text;
  };

  let withImages = images.length > 0;
  let jsonMode = true;
  let imagesIgnored = false;
  for (let attempt = 0; ; attempt++) {
    try {
      const text = await run(withImages, jsonMode);
      return { data: looseParse(schema, extractJson(text)), model, imagesIgnored };
    } catch (e) {
      const err = e as AiError & { status?: number; detail?: string };
      if (attempt >= 2 || err.status !== 400) throw e;
      const detail = err.detail ?? "";
      // Modelo só de texto: tenta de novo sem as fotos. Sem modo JSON: pede JSON só pelo texto.
      if (withImages && /image|vision|multimodal|content type|image_url|unsupported/i.test(detail)) {
        withImages = false;
        imagesIgnored = true;
      } else if (jsonMode && /response_format|json|mime/i.test(detail)) jsonMode = false;
      else throw e;
    }
  }
}

/** Mensagem curta para o painel. */
export function aiErrorMessage(e: unknown) {
  if (e instanceof AiError) return e.message;
  return (e as Error)?.message || "A IA falhou.";
}
