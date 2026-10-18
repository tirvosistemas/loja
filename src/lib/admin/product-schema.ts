import { z } from "zod";
import { isUploadKey } from "@/lib/images";
import { onlyDigits, slugify } from "@/lib/utils";

// Validação do cadastro de produto (painel). Valores em dinheiro sempre em centavos.
// Usado no servidor; o formulário importa só os tipos.

export const PRODUCT_STATUSES = ["ACTIVE", "DRAFT", "ARCHIVED"] as const;
export const VOLTAGES = ["V110", "V220", "BIVOLT", "NA"] as const;
export const MAX_PRODUCT_IMAGES = 12;
export const MAX_VARIANTS = 50;
export const MAX_SPECS = 60;
export const MAX_PRICE_CENTS = 100_000_000; // R$ 1 milhão

const tooLong = (max: number) => `Use até ${max} caracteres.`;

/** Texto opcional: vazio vira null. */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, tooLong(max))
    .nullish()
    .transform((v) => v || null);

const int = (min: number, max: number, label = "o valor") =>
  z
    .number({ error: "Informe um número." })
    .int("Use um número inteiro.")
    .min(min, min === 0 ? "Não pode ser negativo." : `Mínimo de ${min}.`)
    .max(max, `Valor alto demais para ${label}.`);

const money = z.number({ error: "Informe o valor." }).int("Valor inválido.").min(0, "Não pode ser negativo.").max(MAX_PRICE_CENTS, "Valor alto demais.");

const optNumber = (max: number, label: string, integer = false) => {
  const base = z.number({ error: "Informe um número." }).min(0, "Não pode ser negativo.").max(max, `Valor alto demais para ${label}.`);
  return (integer ? base.int("Use um número inteiro.") : base).nullish().transform((v) => v ?? null);
};

const sku = z
  .string()
  .trim()
  .max(64, tooLong(64))
  .regex(/^[\w\-./ ]*$/, "Use letras, números, hífen, ponto ou barra.")
  .nullish()
  .transform((v) => v || null);

const imageSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((u) => isUploadKey(u) || /^https:\/\/[^\s"'<>]+$/i.test(u) || /^\/[\w\-./]+$/.test(u), "Imagem inválida."),
  alt: optText(191),
  // Dimensões devolvidas pelo upload (fotos novas); as já gravadas vêm do banco.
  width: z.number().int().min(1).max(20_000).nullish().transform((v) => v ?? null),
  height: z.number().int().min(1).max(20_000).nullish().transform((v) => v ?? null),
});

const variantSchema = z.object({
  id: z.string().trim().max(40).nullish().transform((v) => v || null),
  name: z.string().trim().min(1, "Informe o nome da variação.").max(80, tooLong(80)),
  sku,
  priceCents: money.min(1, "O preço precisa ser maior que zero.").nullish().transform((v) => v ?? null),
  compareAtCents: money.nullish().transform((v) => v || null),
  stock: int(0, 1_000_000, "o estoque"),
  active: z.boolean(),
});

const specSchema = z.object({
  label: z.string().trim().max(60, tooLong(60)),
  value: z.string().trim().max(300, tooLong(300)),
});

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do produto.").max(160, tooLong(160)),
    slug: z.string().trim().max(200).default(""),
    slugAuto: z.boolean().optional(),
    shortDescription: optText(500),
    description: optText(20000),
    categoryId: z.string().trim().max(40).nullish().transform((v) => v || null),
    brandId: z.string().trim().max(40).nullish().transform((v) => v || null),
    status: z.enum(PRODUCT_STATUSES, { error: "Escolha o status." }),
    featured: z.boolean(),
    isNew: z.boolean(),
    freeShipping: z.boolean(),
    tags: z.array(z.string().trim().max(40, "Cada tag pode ter até 40 caracteres.")).max(40, "Use até 40 tags."),
    images: z.array(imageSchema).max(MAX_PRODUCT_IMAGES, `Use até ${MAX_PRODUCT_IMAGES} fotos.`),
    videoUrl: z
      .string()
      .trim()
      .max(300, tooLong(300))
      .refine((v) => !v || /^https?:\/\/[^\s"'<>]+$/i.test(v), "Cole o link completo do vídeo (https://…).")
      .nullish()
      .transform((v) => v || null),
    priceCents: money.min(1, "Informe o preço de venda."),
    compareAtCents: money.nullish().transform((v) => v || null),
    costCents: money.nullish().transform((v) => v ?? null),
    sku,
    ean: z
      .string()
      .nullish()
      .transform((v) => onlyDigits(v))
      .refine((v) => !v || (v.length >= 8 && v.length <= 14), "O EAN tem de 8 a 14 números.")
      .transform((v) => v || null),
    trackStock: z.boolean(),
    stock: int(0, 1_000_000, "o estoque"),
    allowBackorder: z.boolean(),
    lowStockAlert: int(0, 10_000, "o alerta"),
    variantLabel: optText(40),
    variants: z.array(variantSchema).max(MAX_VARIANTS, `Use até ${MAX_VARIANTS} variações.`),
    voltage: z.enum(VOLTAGES).nullish().transform((v) => v ?? null),
    warrantyMonths: optNumber(240, "a garantia", true),
    model: optText(80),
    color: optText(60),
    weightGrams: optNumber(10_000_000, "o peso", true),
    widthCm: optNumber(1000, "a largura"),
    heightCm: optNumber(1000, "a altura"),
    depthCm: optNumber(1000, "a profundidade"),
    specs: z.array(specSchema).max(MAX_SPECS, `Use até ${MAX_SPECS} especificações.`),
    metaTitle: optText(120),
    metaDescription: optText(320),
  })
  .superRefine((v, ctx) => {
    if (v.compareAtCents != null && v.compareAtCents <= v.priceCents) {
      ctx.addIssue({ code: "custom", path: ["compareAtCents"], message: "O preço “de” precisa ser maior que o preço de venda." });
    }
    if (!slugify(v.slug || v.name)) ctx.addIssue({ code: "custom", path: ["slug"], message: "Informe a URL do produto." });

    const joined = v.tags.filter(Boolean).join(", ");
    if (joined.length > 500) ctx.addIssue({ code: "custom", path: ["tags"], message: "As tags somam mais de 500 caracteres. Remova algumas." });

    if (v.variants.length && !v.variantLabel) {
      ctx.addIssue({ code: "custom", path: ["variantLabel"], message: "Dê um nome ao grupo de variações (ex.: Voltagem)." });
    }
    const names = new Map<string, number>();
    const skus = new Map<string, string>();
    if (v.sku) skus.set(v.sku.toLowerCase(), "sku");
    v.variants.forEach((variant, i) => {
      const key = variant.name.toLowerCase();
      if (names.has(key)) ctx.addIssue({ code: "custom", path: ["variants", i, "name"], message: "Já existe uma variação com esse nome." });
      names.set(key, i);
      if (variant.sku) {
        const k = variant.sku.toLowerCase();
        if (skus.has(k)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "SKU repetido neste produto." });
        else skus.set(k, `variants.${i}.sku`);
      }
      const price = variant.priceCents ?? v.priceCents;
      if (variant.compareAtCents != null && variant.compareAtCents <= price) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "compareAtCents"], message: "O “de” precisa ser maior que o preço." });
      }
    });

    v.specs.forEach((s, i) => {
      if (!s.label && !s.value) return;
      if (!s.label) ctx.addIssue({ code: "custom", path: ["specs", i, "label"], message: "Informe o nome do item." });
      if (!s.value) ctx.addIssue({ code: "custom", path: ["specs", i, "value"], message: "Informe o valor." });
    });
  })
  .transform((v) => ({
    ...v,
    slug: slugify(v.slug || v.name),
    tags: [...new Set(v.tags.filter(Boolean))].join(", ") || null,
    specs: v.specs.filter((s) => s.label && s.value),
  }));

export type ProductInput = z.input<typeof productSchema>;
export type ProductData = z.output<typeof productSchema>;
