import { db } from "@/lib/db";
import { isUniqueError } from "@/lib/action";
import { slugify } from "@/lib/utils";
import { getCategoryOptions, uniqueSlug } from "@/lib/admin/catalog";
import { createProduct } from "@/app/admin/(panel)/produtos/actions";
import type { ProductInput } from "@/lib/admin/product-schema";
import { normalizeKey, MAX_IMPORT_PHOTOS } from "./dados";
import type { BuildResult, ImportDraft } from "./build";

// Parte do importador que fala com o banco: categorias e marcas, produtos repetidos e o
// cadastro final (pelo mesmo caminho do formulário de produto, com as mesmas validações).

export type ImportStatus = "ok" | "warning" | "error" | "duplicate";

export type ImportPreview = {
  key: string;
  folder: string;
  name: string;
  priceCents: number | null;
  stock: number;
  variants: number;
  category: string | null;
  categoryFound: boolean;
  brand: string | null;
  brandIsNew: boolean;
  photos: number;
  aiPhotos: number;
  status: ImportStatus;
  errors: string[];
  warnings: string[];
  duplicate: { id: string; name: string } | null;
};

export class ImportError extends Error {
  constructor(
    message: string,
    public duplicate: { id: string; name: string } | null = null,
  ) {
    super(message);
  }
}

export type Catalog = {
  categories: { id: string; name: string; label: string; keys: string[] }[];
  brands: { id: string; name: string; key: string }[];
};

const loose = (k: string) => k.replace(/s(?=_|$)/g, ""); // "fones_de_ouvido" ≈ "fone_de_ouvido"

export async function loadCatalog(): Promise<Catalog> {
  const [cats, brands] = await Promise.all([getCategoryOptions(), db.brand.findMany({ select: { id: true, name: true, slug: true } })]);
  const slugs = new Map((await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.id, c.slug]));
  return {
    categories: cats.map((c) => ({ id: c.id, name: c.name, label: c.label, keys: [normalizeKey(c.name), normalizeKey(c.label), normalizeKey(slugs.get(c.id) ?? "")].filter(Boolean) })),
    brands: brands.map((b) => ({ id: b.id, name: b.name, key: normalizeKey(b.name) })),
  };
}

export function categoryLabels(catalog: Catalog) {
  return catalog.categories.map((c) => c.label);
}

export function findCategory(name: string | null, catalog: Catalog) {
  if (!name) return null;
  const k = normalizeKey(name);
  return catalog.categories.find((c) => c.keys.includes(k)) ?? catalog.categories.find((c) => c.keys.some((x) => loose(x) === loose(k))) ?? null;
}

export function findBrand(name: string | null, catalog: Catalog) {
  if (!name) return null;
  const k = normalizeKey(name);
  return catalog.brands.find((b) => b.key === k) ?? null;
}

/** Produto já cadastrado com o mesmo SKU (do produto ou das variações) ou a mesma URL. */
export async function findDuplicate(d: ImportDraft) {
  const skus = [d.sku, ...d.variants.map((v) => v.sku)].filter((s): s is string => !!s);
  if (skus.length) {
    const bySku =
      (await db.product.findFirst({ where: { sku: { in: skus } }, select: { id: true, name: true } })) ??
      (await db.productVariant.findFirst({ where: { sku: { in: skus } }, select: { product: { select: { id: true, name: true } } } }))?.product;
    if (bySku) return bySku;
  }
  const slug = slugify(d.name);
  return slug ? db.product.findUnique({ where: { slug }, select: { id: true, name: true } }) : null;
}

export async function previewDraft(
  input: { key: string; folder: string; build: BuildResult; photos: number; aiPhotos?: number; warnings?: string[] },
  catalog: Catalog,
): Promise<ImportPreview> {
  const { draft, errors } = input.build;
  const warnings = [...input.build.warnings, ...(input.warnings ?? [])];
  const category = findCategory(draft.category, catalog);
  if (draft.category && !category) warnings.push(`A categoria “${draft.category}” não existe na loja; o produto entra sem categoria.`);
  if (!input.photos) warnings.push("Sem fotos do anúncio.");
  const duplicate = errors.length ? null : await findDuplicate(draft);
  return {
    key: input.key,
    folder: input.folder,
    name: draft.name,
    priceCents: draft.priceCents,
    stock: draft.variants.length ? draft.variants.reduce((n, v) => n + v.stock, 0) : draft.stock,
    variants: draft.variants.length,
    category: category?.label ?? draft.category,
    categoryFound: !!category,
    brand: draft.brand,
    brandIsNew: !!draft.brand && !findBrand(draft.brand, catalog),
    photos: Math.min(input.photos, MAX_IMPORT_PHOTOS),
    aiPhotos: input.aiPhotos ?? 0,
    status: errors.length ? "error" : duplicate ? "duplicate" : warnings.length ? "warning" : "ok",
    errors,
    warnings,
    duplicate,
  };
}

/** Recusa antes de baixar fotos ou chamar a IA: dados com erro ou produto já cadastrado. */
export async function assertImportable(build: BuildResult) {
  if (build.errors.length) throw new ImportError(build.errors.join(" "));
  const dup = await findDuplicate(build.draft);
  if (dup) throw new ImportError(`Já existe na loja: ${dup.name}.`, dup);
}

/** Marca pelo nome; cria se ainda não existe. */
export async function ensureBrand(name: string | null, catalog: Catalog): Promise<string | null> {
  if (!name) return null;
  const found = findBrand(name, catalog);
  if (found) return found.id;
  const slug = await uniqueSlug(name, async (s) => !!(await db.brand.findUnique({ where: { slug: s }, select: { id: true } })));
  try {
    const b = await db.brand.create({ data: { name, slug }, select: { id: true } });
    catalog.brands.push({ id: b.id, name, key: normalizeKey(name) });
    return b.id;
  } catch (e) {
    // Outra importação em paralelo criou a mesma marca.
    if (!isUniqueError(e)) throw e;
    const again = await db.brand.findFirst({ where: { name }, select: { id: true } });
    return again?.id ?? null;
  }
}

export async function saveImported(
  draft: ImportDraft,
  images: { url: string; sourceUrl?: string | null; width: number | null; height: number | null }[],
  opts: { publish: boolean },
  catalog: Catalog,
): Promise<{ id: string; name: string; status: "ACTIVE" | "DRAFT" }> {
  const status = draft.status ?? (opts.publish ? "ACTIVE" : "DRAFT");
  const input: ProductInput = {
    name: draft.name,
    slug: "",
    slugAuto: true,
    shortDescription: draft.shortDescription,
    description: draft.description,
    categoryId: findCategory(draft.category, catalog)?.id ?? null,
    brandId: await ensureBrand(draft.brand, catalog),
    status,
    featured: draft.featured,
    isNew: draft.isNew,
    freeShipping: draft.freeShipping,
    tags: draft.tags,
    images: images.slice(0, MAX_IMPORT_PHOTOS).map((im, i) => ({ url: im.url, sourceUrl: im.sourceUrl ?? null, alt: i === 0 ? draft.name.slice(0, 191) : `${draft.name.slice(0, 170)} – foto ${i + 1}`, width: im.width, height: im.height })),
    videoUrl: draft.videoUrl,
    priceCents: draft.priceCents ?? 0,
    compareAtCents: draft.compareAtCents,
    costCents: draft.costCents,
    sku: draft.sku,
    ean: draft.ean,
    trackStock: true,
    stock: draft.stock,
    allowBackorder: false,
    lowStockAlert: 3,
    variantLabel: draft.variantLabel,
    variants: draft.variants.map((v) => ({ id: null, name: v.name, sku: v.sku, priceCents: v.priceCents, compareAtCents: null, stock: v.stock, active: v.active })),
    voltage: draft.voltage,
    warrantyMonths: draft.warrantyMonths,
    model: draft.model,
    color: draft.color,
    weightGrams: draft.weightGrams,
    widthCm: draft.widthCm,
    heightCm: draft.heightCm,
    depthCm: draft.depthCm,
    specs: draft.specs,
    metaTitle: draft.metaTitle,
    metaDescription: draft.metaDescription,
  };
  const r = await createProduct(input);
  if (!r.ok) {
    const details = Object.entries(r.fieldErrors ?? {})
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    throw new ImportError(details ? `${r.error} (${details})` : r.error);
  }
  return { id: r.data!.id, name: draft.name, status };
}
