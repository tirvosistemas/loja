import type { ProductInput } from "@/lib/admin/product-schema";
import type { GalleryImage } from "@/components/admin/image-uploader";

// Estado do formulário de produto e conversões (banco → formulário → server action).
// Arquivo puro: usado pela página (servidor) e pelo formulário (cliente).

export type ProductStatusKey = "ACTIVE" | "DRAFT" | "ARCHIVED";
export type VoltageKey = "V110" | "V220" | "BIVOLT" | "NA";

export type VariantRow = {
  key: string; // chave estável para a lista na tela
  id: string | null; // id no banco (null = nova)
  name: string;
  sku: string;
  priceCents: number | null;
  compareAtCents: number | null;
  stock: number;
  active: boolean;
};

export type SpecRow = { key: string; label: string; value: string };

export type ProductFormValues = {
  name: string;
  slug: string;
  slugAuto: boolean; // a URL acompanha o nome até ser editada à mão
  shortDescription: string;
  description: string;
  categoryId: string;
  brandId: string;
  status: ProductStatusKey;
  featured: boolean;
  isNew: boolean;
  freeShipping: boolean;
  tags: string[];
  images: GalleryImage[];
  videoUrl: string;
  priceCents: number | null;
  compareAtCents: number | null;
  costCents: number | null;
  sku: string;
  ean: string;
  trackStock: boolean;
  stock: number;
  allowBackorder: boolean;
  lowStockAlert: number;
  variantLabel: string;
  variants: VariantRow[];
  voltage: VoltageKey | "";
  warrantyMonths: number | null;
  model: string;
  color: string;
  weightGrams: number | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  specs: SpecRow[];
  metaTitle: string;
  metaDescription: string;
};

let seq = 0;
/** Chave para linhas novas (variações, especificações). */
export function rowKey() {
  seq += 1;
  return `n${Date.now().toString(36)}${seq.toString(36)}`;
}

export function emptyProductValues(): ProductFormValues {
  return {
    name: "",
    slug: "",
    slugAuto: true,
    shortDescription: "",
    description: "",
    categoryId: "",
    brandId: "",
    status: "ACTIVE",
    featured: false,
    isNew: false,
    freeShipping: false,
    tags: [],
    images: [],
    videoUrl: "",
    priceCents: null,
    compareAtCents: null,
    costCents: null,
    sku: "",
    ean: "",
    trackStock: true,
    stock: 0,
    allowBackorder: false,
    lowStockAlert: 3,
    variantLabel: "",
    variants: [],
    voltage: "",
    warrantyMonths: null,
    model: "",
    color: "",
    weightGrams: null,
    widthCm: null,
    heightCm: null,
    depthCm: null,
    specs: [],
    metaTitle: "",
    metaDescription: "",
  };
}

type ProductRecord = {
  name: string;
  slug: string;
  sku: string | null;
  shortDescription: string | null;
  description: string | null;
  status: ProductStatusKey;
  priceCents: number;
  compareAtCents: number | null;
  costCents: number | null;
  stock: number;
  trackStock: boolean;
  allowBackorder: boolean;
  lowStockAlert: number;
  featured: boolean;
  isNew: boolean;
  freeShipping: boolean;
  voltage: VoltageKey | null;
  variantLabel: string | null;
  warrantyMonths: number | null;
  weightGrams: number | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  color: string | null;
  model: string | null;
  ean: string | null;
  specs: unknown;
  tags: string | null;
  videoUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  categoryId: string | null;
  brandId: string | null;
  images: { url: string; sourceUrl?: string | null; alt: string | null; width: number | null; height: number | null }[];
  variants: { id: string; name: string; sku: string | null; priceCents: number | null; compareAtCents: number | null; stock: number; active: boolean }[];
};

function readSpecs(value: unknown): SpecRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((s, i) => {
      const o = (s ?? {}) as { label?: unknown; value?: unknown };
      return { key: `s${i}`, label: typeof o.label === "string" ? o.label : "", value: typeof o.value === "string" ? o.value : String(o.value ?? "") };
    })
    .filter((s) => s.label || s.value);
}

export function productToValues(p: ProductRecord): ProductFormValues {
  return {
    name: p.name,
    slug: p.slug,
    slugAuto: false,
    shortDescription: p.shortDescription ?? "",
    description: p.description ?? "",
    categoryId: p.categoryId ?? "",
    brandId: p.brandId ?? "",
    status: p.status,
    featured: p.featured,
    isNew: p.isNew,
    freeShipping: p.freeShipping,
    tags: (p.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    images: p.images.map((im) => ({ url: im.url, sourceUrl: im.sourceUrl ?? null, alt: im.alt ?? "", width: im.width, height: im.height })),
    videoUrl: p.videoUrl ?? "",
    priceCents: p.priceCents,
    compareAtCents: p.compareAtCents,
    costCents: p.costCents,
    sku: p.sku ?? "",
    ean: p.ean ?? "",
    trackStock: p.trackStock,
    stock: p.stock,
    allowBackorder: p.allowBackorder,
    lowStockAlert: p.lowStockAlert,
    variantLabel: p.variantLabel ?? "",
    variants: p.variants.map((v) => ({
      key: v.id,
      id: v.id,
      name: v.name,
      sku: v.sku ?? "",
      priceCents: v.priceCents,
      compareAtCents: v.compareAtCents,
      stock: v.stock,
      active: v.active,
    })),
    voltage: p.voltage ?? "",
    warrantyMonths: p.warrantyMonths,
    model: p.model ?? "",
    color: p.color ?? "",
    weightGrams: p.weightGrams,
    widthCm: p.widthCm,
    heightCm: p.heightCm,
    depthCm: p.depthCm,
    specs: readSpecs(p.specs),
    metaTitle: p.metaTitle ?? "",
    metaDescription: p.metaDescription ?? "",
  };
}

/** Dados enviados à server action (a validação de verdade acontece no servidor). */
export function valuesToInput(v: ProductFormValues): ProductInput {
  return {
    name: v.name,
    slug: v.slug,
    slugAuto: v.slugAuto,
    shortDescription: v.shortDescription,
    description: v.description,
    categoryId: v.categoryId || null,
    brandId: v.brandId || null,
    status: v.status,
    featured: v.featured,
    isNew: v.isNew,
    freeShipping: v.freeShipping,
    tags: v.tags,
    images: v.images.map((im) => ({ url: im.url, sourceUrl: im.sourceUrl ?? null, alt: im.alt ?? "", width: im.width ?? null, height: im.height ?? null })),
    videoUrl: v.videoUrl,
    priceCents: v.priceCents ?? 0,
    compareAtCents: v.compareAtCents,
    costCents: v.costCents,
    sku: v.sku,
    ean: v.ean,
    trackStock: v.trackStock,
    stock: v.stock,
    allowBackorder: v.allowBackorder,
    lowStockAlert: v.lowStockAlert,
    variantLabel: v.variantLabel,
    variants: v.variants.map((x) => ({
      id: x.id,
      name: x.name,
      sku: x.sku,
      priceCents: x.priceCents,
      compareAtCents: x.compareAtCents,
      stock: x.stock,
      active: x.active,
    })),
    voltage: v.voltage || null,
    warrantyMonths: v.warrantyMonths,
    model: v.model,
    color: v.color,
    weightGrams: v.weightGrams,
    widthCm: v.widthCm,
    heightCm: v.heightCm,
    depthCm: v.depthCm,
    specs: v.specs.map((s) => ({ label: s.label, value: s.value })),
    metaTitle: v.metaTitle,
    metaDescription: v.metaDescription,
  };
}
