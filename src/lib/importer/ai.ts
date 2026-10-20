import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import { z } from "zod";
import type { ImportDraft } from "./build";

// Preenchimento com IA (Claude): lê as fotos da caixa, do manual e do produto e escreve o que
// o dados.txt não trouxe. Nunca inventa preço nem estoque; o que o dono escreveu prevalece.

const MODEL = "claude-opus-5-5";
export const MAX_AI_IMAGES = 6;

const aiSchema = z.object({
  name: z.string().nullable().describe("Nome do produto para a loja: tipo + marca + modelo + diferencial (ex.: cor). Até 120 caracteres."),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  color: z.string().nullable(),
  category: z.string().nullable().describe("Uma das categorias da loja, escrita exatamente como na lista; null se nenhuma servir."),
  shortDescription: z.string().nullable().describe("Uma frase de venda, até 200 caracteres."),
  description: z.string().nullable().describe("Descrição completa em português, 2 a 5 parágrafos curtos e uma lista de destaques com '- '. Sem exageros nem promessas que as fotos não mostram."),
  specs: z.array(z.object({ label: z.string(), value: z.string() })).describe("Ficha técnica lida da caixa/manual. Só o que estiver escrito."),
  voltage: z.enum(["V110", "V220", "BIVOLT", "NA"]).nullable().describe("NA para pilha, bateria ou USB."),
  warrantyMonths: z.number().int().nullable(),
  weightGrams: z.number().int().nullable(),
  widthCm: z.number().nullable(),
  heightCm: z.number().nullable(),
  depthCm: z.number().nullable(),
  ean: z.string().nullable().describe("Código de barras impresso na caixa, só números."),
  tags: z.array(z.string()).describe("Até 8 termos de busca curtos, em minúsculas."),
  metaTitle: z.string().nullable().describe("Título para o Google, até 60 caracteres."),
  metaDescription: z.string().nullable().describe("Descrição para o Google, até 155 caracteres."),
});

export type AiFill = z.infer<typeof aiSchema>;

const SYSTEM = `Você cadastra produtos de uma loja de eletrônicos no Brasil. Recebe fotos do produto, da caixa e do manual, e o que o dono já escreveu.
Leia com atenção os textos impressos (especificações, voltagem, potência, conteúdo da embalagem, código de barras, garantia).
Regras:
- Escreva em português do Brasil, claro e direto, sem emojis.
- Só afirme o que as fotos ou o texto do dono mostram. Na dúvida, deixe o campo null (ou a lista vazia).
- Medidas e peso são da embalagem, se estiverem impressos; não estime.
- Não repita o que o dono já preencheu: esses campos serão mantidos como ele escreveu.`;

/** Reduz para 1568 px no maior lado (o que o modelo aproveita) e converte em JPEG. */
async function toJpeg(input: Buffer) {
  return sharp(input).rotate().resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
}

export async function fillWithAi(opts: { apiKey: string; images: Buffer[]; draft: ImportDraft; folder: string; categories: string[] }): Promise<AiFill> {
  const client = new Anthropic({ apiKey: opts.apiKey, timeout: 180_000, maxRetries: 2 });
  const images = await Promise.all(opts.images.slice(0, MAX_AI_IMAGES).map(toJpeg));
  const d = opts.draft;
  const known = Object.entries({
    nome: d.name,
    marca: d.brand,
    modelo: d.model,
    cor: d.color,
    categoria: d.category,
    voltagem: d.voltage,
    garantia_meses: d.warrantyMonths,
    resumo: d.shortDescription,
    descricao: d.description,
    especificacoes: d.specs.map((s) => `${s.label}: ${s.value}`).join("; ") || null,
  })
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(aiSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...images.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: data.toString("base64") } })),
          {
            type: "text",
            text: `Pasta: ${opts.folder}\n\nJá preenchido pelo dono:\n${known || "(nada)"}\n\nCategorias da loja:\n${opts.categories.join("\n") || "(nenhuma)"}`,
          },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("A IA recusou ler estas fotos.");
  if (!response.parsed_output) throw new Error("A IA não devolveu os dados no formato esperado.");
  return response.parsed_output;
}

/** Mensagem curta para o painel a partir de um erro da API. */
export function aiErrorMessage(e: unknown) {
  if (e instanceof Anthropic.AuthenticationError) return "Chave da Anthropic inválida (Configurações → Integrações).";
  if (e instanceof Anthropic.PermissionDeniedError) return "A chave da Anthropic não tem permissão para este modelo.";
  if (e instanceof Anthropic.RateLimitError) return "A IA pediu uma pausa (limite de uso). O produto entrou sem o preenchimento automático.";
  if (e instanceof Anthropic.BadRequestError && /credit|balance/i.test(e.message)) return "Sem créditos na conta da Anthropic.";
  if (e instanceof Anthropic.APIError) return `A IA falhou (${e.status ?? "conexão"}).`;
  return (e as Error)?.message || "A IA falhou.";
}

/** Junta a resposta da IA no rascunho, só nos campos vazios. */
export function mergeAi(d: ImportDraft, ai: AiFill, nameFromFolder: boolean): ImportDraft {
  const clip = (s: string | null, n: number) => (s ? s.trim().slice(0, n) || null : null);
  const pos = (n: number | null, max: number) => (n != null && n > 0 && n <= max ? n : null);
  const ean = ai.ean?.replace(/\D/g, "") ?? "";
  return {
    ...d,
    name: nameFromFolder && ai.name && ai.name.trim().length >= 2 ? ai.name.trim().slice(0, 160) : d.name,
    brand: d.brand ?? clip(ai.brand, 80),
    model: d.model ?? clip(ai.model, 80),
    color: d.color ?? clip(ai.color, 60),
    category: d.category ?? clip(ai.category, 120),
    shortDescription: d.shortDescription ?? clip(ai.shortDescription, 500),
    description: d.description ?? clip(ai.description, 20000),
    specs: d.specs.length ? d.specs : ai.specs.filter((s) => s.label.trim() && s.value.trim()).map((s) => ({ label: s.label.trim().slice(0, 60), value: s.value.trim().slice(0, 300) })).slice(0, 60),
    voltage: d.voltage ?? ai.voltage,
    warrantyMonths: d.warrantyMonths ?? pos(ai.warrantyMonths, 240),
    weightGrams: d.weightGrams ?? pos(ai.weightGrams, 10_000_000),
    widthCm: d.widthCm ?? pos(ai.widthCm, 1000),
    heightCm: d.heightCm ?? pos(ai.heightCm, 1000),
    depthCm: d.depthCm ?? pos(ai.depthCm, 1000),
    ean: d.ean ?? (ean.length >= 8 && ean.length <= 14 ? ean : null),
    tags: d.tags.length ? d.tags : ai.tags.map((t) => t.trim().slice(0, 40)).filter(Boolean).slice(0, 8),
    metaTitle: d.metaTitle ?? clip(ai.metaTitle, 120),
    metaDescription: d.metaDescription ?? clip(ai.metaDescription, 320),
  };
}
