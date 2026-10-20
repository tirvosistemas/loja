import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { z } from "zod";
import { pickModel } from "@/lib/ai/providers";
import { AiError, aiJson, claudeAcceptsEffort, extractJson, httpError, retryDelayMs } from "@/lib/ai/client";
import { productAiSchema } from "@/lib/ai/product";
import { legacyKeyMoves } from "@/lib/settings";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("IA · escolha do modelo", () => {
  it("compara a versão inteira (claude-sonnet-5-5 é mais novo que claude-sonnet-5)", () => {
    expect(pickModel("anthropic", ["claude-sonnet-5-5", "claude-sonnet-5"])).toBe("claude-sonnet-5-5");
    expect(pickModel("anthropic", ["claude-sonnet-5", "claude-sonnet-5-5"])).toBe("claude-sonnet-5-5");
    const list = ["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-4-5-20250929", "claude-sonnet-5", "claude-sonnet-4-6", "claude-sonnet-5-5", "claude-haiku-4-5-20251001"];
    expect(pickModel("anthropic", list)).toBe("claude-sonnet-5-5");
  });
  it("não confunde data ou sufixo com versão", () => {
    expect(pickModel("xai", ["grok-4-0709", "grok-4.1-fast"])).toBe("grok-4.1-fast");
    expect(pickModel("gemini", ["gemini-3.5-flash", "gemini-3-flash", "gemini-2.0-flash-001"])).toBe("gemini-3.5-flash");
    expect(pickModel("openai", ["gpt-5.4-mini", "gpt-5-mini"])).toBe("gpt-5.4-mini");
  });
});

describe("IA · leitura do JSON", () => {
  it("ignora o raciocínio em <think> mesmo com chaves dentro", () => {
    expect(extractJson('<think>Preciso montar {"name": ...} com os campos</think>\n{"name":"Fone"}')).toEqual({ name: "Fone" });
    expect(extractJson('Vou pensar {campos}…</think>{"name":"Fone"}')).toEqual({ name: "Fone" });
  });
  it("prefere o bloco ```json e aceita texto em volta", () => {
    expect(extractJson('Aqui está:\n```json\n{"name":"Fone","tags":["a"]}\n```\nSe precisar, ajuste {campos}.')).toEqual({ name: "Fone", tags: ["a"] });
    expect(extractJson('Claro! {campos} → {"name":"Fone {X}","n":1} pronto.')).toEqual({ name: "Fone {X}", n: 1 });
    expect(extractJson('{"name":"Fone"}')).toEqual({ name: "Fone" });
    expect(extractJson('```json\n{"name":"Fone"}')).toEqual({ name: "Fone" });
  });
  it("falha em português quando não há JSON", () => {
    expect(() => extractJson("Não sei.")).toThrow(AiError);
    expect(() => extractJson("{quebrado")).toThrow("A IA não devolveu os dados no formato esperado.");
  });
});

describe("IA · Claude e o parâmetro effort", () => {
  it("só manda effort para modelos que aceitam", () => {
    for (const m of ["claude-sonnet-5-5", "claude-sonnet-5", "claude-sonnet-4-6", "claude-opus-4-5-20251101", "claude-haiku-5-5", "claude-opus-4-8", "claude-fable-5-1"]) expect(claudeAcceptsEffort(m), m).toBe(true);
    for (const m of ["claude-haiku-4-5-20251001", "claude-haiku-4-5", "claude-sonnet-4-5-20250929", "claude-sonnet-4-20250514", "claude-opus-4-1-20250805", "claude-opus-4-0", "claude-3-7-sonnet-20250219", "claude-3-5-haiku-latest"]) {
      expect(claudeAcceptsEffort(m), m).toBe(false);
    }
  });
});

const geminiMinute = JSON.stringify({
  error: {
    code: 429,
    message: "You exceeded your current quota, please check your plan and billing details. * Quota exceeded for metric: generate_content_free_tier_requests, limit: 10. Please retry in 33.952s.",
    status: "RESOURCE_EXHAUSTED",
    details: [
      { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }] },
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "33s" },
    ],
  },
});
const geminiDay = geminiMinute.replace("PerMinute", "PerDay");
const openaiQuota = JSON.stringify({ error: { message: "You exceeded your current quota, please check your plan and billing details.", type: "insufficient_quota", code: "insufficient_quota" } });

describe("IA · repetir pedidos recusados por limite", () => {
  it("espera o tempo pedido pelo provedor, até 60 s", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(retryDelayMs(429, geminiMinute, null, 0)).toBe(33_000);
    expect(retryDelayMs(429, "{}", "5", 0)).toBe(5000);
    expect(retryDelayMs(429, '{"error":{"message":"Rate limit reached for gpt-5-mini on tokens per min. Please try again in 1.5s."}}', null, 0)).toBe(1500);
    expect(retryDelayMs(429, "{}", "120", 0)).toBeNull();
  });
  it("usa espera crescente em 5xx e 429 sem tempo", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(retryDelayMs(503, '{"error":{"message":"The model is overloaded."}}', null, 0)).toBe(2500);
    expect(retryDelayMs(503, "", null, 1)).toBe(4500);
    expect(retryDelayMs(429, "{}", null, 0)).toBe(2500);
  });
  it("não repete cota diária, falta de crédito nem outros erros", () => {
    expect(retryDelayMs(429, geminiDay, null, 0)).toBeNull();
    expect(retryDelayMs(429, openaiQuota, null, 0)).toBeNull();
    expect(retryDelayMs(429, '{"error":"Your team has run out of credits"}', null, 0)).toBeNull();
    expect(retryDelayMs(400, "{}", null, 0)).toBeNull();
    expect(retryDelayMs(404, "{}", null, 0)).toBeNull();
  });
});

describe("IA · mensagens de erro", () => {
  const msg = (status: number, raw: string, provider: "gemini" | "openai" | "openrouter" = "gemini") => httpError(status, provider, JSON.parse(raw), raw).message;
  it("limite por minuto pede pausa; cota diária ou crédito vira falta de cota", () => {
    expect(msg(429, geminiMinute)).toMatch(/pediu uma pausa/);
    expect(msg(429, geminiDay)).toBe("Sem créditos ou cota no Google Gemini.");
    expect(msg(429, openaiQuota, "openai")).toBe("Sem créditos ou cota no ChatGPT (OpenAI).");
    expect(msg(402, '{"error":{"message":"Insufficient credits"}}', "openrouter")).toBe("Sem créditos ou cota no OpenRouter.");
  });
  it("modelo que não lê fotos não é tratado como modelo inexistente", () => {
    expect(msg(404, '{"error":{"message":"No endpoints found that support image input","code":404}}', "openrouter")).toMatch(/recusou o pedido \(404\): No endpoints found that support image input/);
    expect(msg(404, '{"error":{"message":"No endpoints found for foo/bar."}}', "openrouter")).toMatch(/^Modelo não encontrado/);
  });
});

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("IA · pedidos (fetch simulado)", () => {
  const schema = z.object({ name: z.string().nullable() });
  const chat = (content: string) => ({ choices: [{ message: { content } }] });

  it("OpenRouter: 404 por causa da foto repete só com o texto", async () => {
    const photo = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#ff0000" } }).png().toBuffer();
    const bodies: { messages: { content: unknown }[] }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return bodies.length === 1 ? jsonResponse(404, { error: { message: "No endpoints found that support image input", code: 404 } }) : jsonResponse(200, chat('{"name":"Fone"}'));
      }),
    );
    const r = await aiJson({ config: { provider: "openrouter", apiKey: "k", model: "deepseek/deepseek-v4-flash", baseUrl: "https://openrouter.ai/api/v1" }, schema, system: "s", prompt: "p", images: [photo] });
    expect(r).toMatchObject({ data: { name: "Fone" }, imagesIgnored: true });
    expect(Array.isArray(bodies[0].messages[1].content)).toBe(true);
    expect(bodies[1].messages[1].content).toBe("p");
  });

  it("repete depois de um 429 por minuto ou 503", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const replies = [jsonResponse(429, { error: { message: "Rate limit" } }, { "retry-after": "0" }), jsonResponse(503, { error: { message: "overloaded" } }, { "retry-after": "0" }), jsonResponse(200, chat('{"name":"Fone"}'))];
    const fetchMock = vi.fn(async () => replies.shift()!);
    vi.stubGlobal("fetch", fetchMock);
    const r = await aiJson({ config: { provider: "deepseek", apiKey: "k", model: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1" }, schema, system: "s", prompt: "p" });
    expect(r.data).toEqual({ name: "Fone" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("não repete cota diária", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(429, JSON.parse(geminiDay)));
    vi.stubGlobal("fetch", fetchMock);
    await expect(aiJson({ config: { provider: "gemini", apiKey: "k", model: "gemini-3.5-flash", baseUrl: "https://x/v1beta" }, schema, system: "s", prompt: "p" })).rejects.toThrow("Sem créditos ou cota no Google Gemini.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  const claudeReply = (text: string) => ({
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "m",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  });

  it("Claude: campo fora do formato vira null em vez de perder tudo; effort só em modelo que aceita", async () => {
    const sent: { output_config?: { effort?: string } }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return jsonResponse(200, claudeReply(JSON.stringify({ name: "Fone", voltage: "Bivolt", tags: ["fone"], specs: [] })));
      }),
    );
    const config = { provider: "anthropic" as const, apiKey: "sk-ant-x", baseUrl: "https://api.anthropic.com" };
    const r = await aiJson({ config: { ...config, model: "claude-haiku-4-5-20251001" }, schema: productAiSchema, system: "s", prompt: "p" });
    expect(r.data).toMatchObject({ name: "Fone", voltage: null, tags: ["fone"], brand: null });
    expect(sent[0].output_config?.effort).toBeUndefined();
    await aiJson({ config: { ...config, model: "claude-sonnet-5-5" }, schema: productAiSchema, system: "s", prompt: "p" });
    expect(sent[1].output_config?.effort).toBe("low");
  });

  it("Claude: erros em português, com o motivo da API", async () => {
    const config = { provider: "anthropic" as const, apiKey: "sk-ant-x", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-5-5" };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, claudeReply("isso não é JSON"))));
    await expect(aiJson({ config, schema, system: "s", prompt: "p" })).rejects.toThrow("A IA não devolveu os dados no formato esperado.");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(400, { type: "error", error: { type: "invalid_request_error", message: "This model does not support the effort parameter." } })));
    await expect(aiJson({ config, schema, system: "s", prompt: "p" })).rejects.toThrow("A IA falhou (400): This model does not support the effort parameter.");
  });
});

describe("configurações · chaves da versão anterior", () => {
  const enc = (s: string) => `enc:v1:${s}`;

  it("leva a chave da Anthropic para a IA e a do Drive para o catálogo", () => {
    const integrations = { stripePublishableKey: "pk", mapsProvider: "osm", anthropicApiKey: enc("a"), googleDriveApiKey: enc("d") };
    expect(legacyKeyMoves({ integrations })).toEqual({
      integrations: { stripePublishableKey: "pk", mapsProvider: "osm" },
      ai: { provider: "anthropic", anthropicKey: enc("a") },
      catalog: { googleDriveApiKey: enc("d") },
    });
  });

  it("não troca o provedor nem sobrescreve chaves já cadastradas", () => {
    const integrations = { anthropicApiKey: enc("a"), googleDriveApiKey: enc("d") };
    expect(legacyKeyMoves({ integrations, ai: { provider: "gemini", geminiKey: enc("g") }, catalog: { googleDriveApiKey: enc("novo"), taxPercent: 6 } })).toEqual({
      integrations: {},
      ai: { provider: "gemini", geminiKey: enc("g"), anthropicKey: enc("a") },
    });
    expect(legacyKeyMoves({ integrations, ai: { provider: "openai", anthropicKey: enc("novo") }, catalog: { googleDriveApiKey: "" } })).toEqual({
      integrations: {},
      catalog: { googleDriveApiKey: enc("d") },
    });
  });

  it("campos antigos vazios só saem de Integrações; sem campos antigos, nada a fazer", () => {
    expect(legacyKeyMoves({ integrations: { metaPixelId: "1", anthropicApiKey: "", googleDriveApiKey: "" } })).toEqual({ integrations: { metaPixelId: "1" } });
    expect(legacyKeyMoves({ integrations: { metaPixelId: "1" } })).toBeNull();
    expect(legacyKeyMoves({})).toBeNull();
    expect(legacyKeyMoves({ integrations: "x" })).toBeNull();
  });

  it("roda uma vez só", () => {
    const raw = { integrations: { anthropicApiKey: enc("a"), googleDriveApiKey: enc("d") } };
    const moves = legacyKeyMoves(raw)!;
    expect(legacyKeyMoves({ ...raw, ...moves })).toBeNull();
  });
});
