import { z } from "zod";
import { aiJson, type AiConfig } from "./client";

// Cadastro de produto com IA: lê as fotos (produto, caixa, manual) e o que o dono já escreveu
// e devolve os campos do cadastro. Nunca inventa preço nem estoque.

export const productAiSchema = z.object({
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

export type ProductAiFill = z.infer<typeof productAiSchema>;

const SYSTEM = `Você cadastra produtos de uma loja de eletrônicos no Brasil. Recebe fotos do produto, da caixa e do manual (quando houver) e o que o dono já escreveu.
Leia com atenção os textos impressos (especificações, voltagem, potência, conteúdo da embalagem, código de barras, garantia).
Regras:
- Escreva em português do Brasil, claro e direto, sem emojis.
- Só afirme o que as fotos ou o texto do dono mostram. Na dúvida, deixe o campo null (ou a lista vazia).
- Medidas e peso são da embalagem, se estiverem impressos; não estime.
- Não repita o que o dono já preencheu: esses campos serão mantidos como ele escreveu.`;

const SYSTEM_REWRITE = `${SYSTEM}
- Agora o dono pediu para REESCREVER os textos de venda (nome, resumo, descrição, tags e SEO) com base no que ele já escreveu e nas fotos. Mantenha todos os fatos técnicos; melhore a clareza e a organização.`;

export type KnownProduct = {
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  category?: string | null;
  voltage?: string | null;
  warrantyMonths?: number | null;
  shortDescription?: string | null;
  description?: string | null;
  specs?: { label: string; value: string }[];
  ean?: string | null;
};

export async function aiFillProduct(opts: { config: AiConfig; images: Buffer[]; known: KnownProduct; categories: string[]; folder?: string; rewrite?: boolean }) {
  const k = opts.known;
  const known = Object.entries({
    nome: k.name,
    marca: k.brand,
    modelo: k.model,
    cor: k.color,
    categoria: k.category,
    voltagem: k.voltage,
    garantia_meses: k.warrantyMonths,
    codigo_de_barras: k.ean,
    resumo: k.shortDescription,
    descricao: k.description,
    especificacoes: k.specs?.map((s) => `${s.label}: ${s.value}`).join("; ") || null,
  })
    .filter(([, v]) => v != null && v !== "")
    .map(([key, v]) => `${key}: ${v}`)
    .join("\n");
  const prompt = [
    opts.folder ? `Pasta: ${opts.folder}` : null,
    `Já preenchido pelo dono:\n${known || "(nada)"}`,
    `Categorias da loja:\n${opts.categories.join("\n") || "(nenhuma)"}`,
    opts.images.length ? null : "(Sem fotos: use só o texto acima.)",
  ]
    .filter(Boolean)
    .join("\n\n");
  return aiJson({ config: opts.config, schema: productAiSchema, system: opts.rewrite ? SYSTEM_REWRITE : SYSTEM, prompt, images: opts.images });
}
