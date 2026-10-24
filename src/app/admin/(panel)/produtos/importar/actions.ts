"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { isUploadKey } from "@/lib/images";
import { deleteImage, readUpload, saveImage } from "@/lib/uploads";
import { deleteUnusedUploads } from "@/lib/admin/uploads";
import { fail, type ActionResult } from "@/lib/action";
import { isDadosName, isImageName, isInfoPhoto, MAX_IMPORT_PHOTOS, naturalCompare, pickPhotos } from "@/lib/importer/dados";
import { buildDraft } from "@/lib/importer/build";
import { DriveError, downloadFile, getFolder, isFolder, listFolder, MAX_DRIVE_PHOTO_BYTES, parseFolderId, readDados, type DriveFile } from "@/lib/importer/drive";
import { fetchImage } from "@/lib/importer/fetch-image";
import { mergeAi } from "@/lib/importer/ai";
import { aiErrorMessage, getAiConfig, MAX_AI_IMAGES } from "@/lib/ai/client";
import { aiFillProduct } from "@/lib/ai/product";
import { assertImportable, categoryLabels, findDuplicate, ImportError, loadCatalog, previewDraft, saveImported, type ImportPreview } from "@/lib/importer/server";
import { BarcodeError, lookupBarcode } from "@/lib/barcode";
import { photoStandard, standardizeImage } from "@/lib/admin/standardize";

// Importador de produtos (Produtos → Importar). O navegador manda um produto por vez,
// o que mostra o progresso e evita pedidos longos demais.

export type ImportResult =
  | { ok: true; id: string; name: string; status: "ACTIVE" | "DRAFT"; warnings: string[] }
  | { ok: false; error: string; duplicate?: { id: string; name: string } | null };

type Saved = { url: string; width: number | null; height: number | null };

const text = (max: number) => z.string().max(max);
const optionsSchema = z.object({ publish: z.boolean(), useAi: z.boolean(), barcode: z.boolean().default(false), standardize: z.boolean().default(false) });
export type ImportOptions = z.input<typeof optionsSchema>;

/** Roda `fn` em `items` com no máximo `limit` ao mesmo tempo, mantendo a ordem. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

function failImport(e: unknown, where: string): ImportResult {
  if (e instanceof ImportError) return { ok: false, error: e.message, duplicate: e.duplicate };
  if (e instanceof DriveError) return { ok: false, error: e.message };
  console.error(`[importar] falha ao ${where}:`, e);
  return { ok: false, error: "Falha inesperada ao importar este produto. Tente de novo." };
}

/** Preenche com IA, se pedido e configurado. Erro na IA não impede o cadastro. */
async function withAi(
  build: ReturnType<typeof buildDraft>,
  folder: string,
  useAi: boolean,
  images: () => Promise<Buffer[]>,
  catalog: Awaited<ReturnType<typeof loadCatalog>>,
  reference: string | null,
) {
  const warnings: string[] = [];
  let draft = build.draft;
  if (!useAi) return { draft, warnings };
  const config = await getAiConfig();
  if (!config) return { draft, warnings: ["IA não usada: cadastre uma chave em Configurações → Inteligência artificial."] };
  try {
    const pics = await images();
    if (!pics.length) return { draft, warnings: ["IA não usada: o produto não tem fotos."] };
    const ai = await aiFillProduct({ config, images: pics, known: draft, folder, categories: categoryLabels(catalog), reference });
    if (ai.imagesIgnored) warnings.push("O modelo de IA escolhido não lê fotos: só o texto foi usado.");
    draft = mergeAi(draft, ai.data, build.nameFromFolder);
    // O nome pode ter mudado: confere de novo se já existe.
    if (draft.name !== build.draft.name) {
      const dup = await findDuplicate(draft);
      if (dup) throw new ImportError(`Já existe na loja: ${dup.name}.`, dup);
    }
  } catch (e) {
    if (e instanceof ImportError) throw e;
    warnings.push(aiErrorMessage(e));
  }
  return { draft, warnings };
}

/**
 * Completa pelo código de barras (bases gratuitas) o que o dados.txt não trouxe.
 * Sem fotos próprias, baixa as da base. Erro na busca vira aviso.
 */
async function withBarcode(build: ReturnType<typeof buildDraft>, opts: { barcode: boolean; useAi: boolean }, hasPhotos: boolean) {
  const d = build.draft;
  const none = { build, warnings: [] as string[], photoUrls: [] as string[], reference: null as string | null };
  if (!opts.barcode || !d.ean) return none;
  try {
    const r = await lookupBarcode(d.ean);
    if (!r) return { ...none, warnings: [`Código ${d.ean} não encontrado nas bases.`] };
    // A UPCitemdb é americana (textos em inglês): com a IA, nome, cor e descrição dela só servem de consulta.
    const asReference = r.source === "UPCitemdb" && opts.useAi && !!(await getAiConfig());
    const texts = asReference ? { name: null, color: null, description: null } : r;
    const draft = {
      ...d,
      ean: r.ean,
      name: build.nameFromFolder && texts.name ? texts.name.slice(0, 160) : d.name,
      brand: d.brand ?? r.brand,
      model: d.model ?? r.model,
      color: d.color ?? texts.color,
      description: d.description ?? texts.description,
      weightGrams: d.weightGrams ?? r.weightGrams,
      widthCm: d.widthCm ?? r.widthCm,
      heightCm: d.heightCm ?? r.heightCm,
      depthCm: d.depthCm ?? r.depthCm,
    };
    // Nome ou código mudou: confere de novo se já existe.
    if (draft.name !== d.name || draft.ean !== d.ean) {
      const dup = await findDuplicate(draft);
      if (dup) throw new ImportError(`Já existe na loja: ${dup.name}.`, dup);
    }
    const reference = asReference ? [r.name && `nome: ${r.name}`, r.color && `cor: ${r.color}`, r.description && `descrição: ${r.description.slice(0, 2000)}`].filter(Boolean).join("\n") : "";
    return {
      build: { ...build, draft, nameFromFolder: build.nameFromFolder && !texts.name },
      warnings: [],
      photoUrls: hasPhotos ? [] : r.images.slice(0, 3),
      reference: reference || null,
    };
  } catch (e) {
    if (e instanceof ImportError) throw e;
    return { ...none, warnings: [e instanceof BarcodeError ? e.message : "Busca pelo código de barras falhou."] };
  }
}

/** Padroniza as fotos já gravadas (fundo, quadrado, marca d'água). Falha vira aviso. */
async function withStandard(images: Saved[], enabled: boolean, warnings: string[]): Promise<(Saved & { sourceUrl?: string | null })[]> {
  if (!enabled || !images.length) return images;
  const std = await photoStandard();
  return mapLimit(images, 2, async (im) => {
    try {
      return (await standardizeImage(im, std)) ?? im;
    } catch {
      warnings.push("Uma foto não pôde ser padronizada e entrou como estava.");
      return im;
    }
  });
}

// ─────────────── Prévia (pasta do computador, .zip e planilha)

const previewSchema = z
  .array(
    z.object({
      key: text(200),
      folder: text(300),
      dadosText: text(100_000).nullable(),
      photoNames: z.array(text(300)).max(500).optional(),
      photoUrls: z.array(text(2000)).max(100).optional(),
      aiPhotos: z.number().int().min(0).max(500).optional(),
    }),
  )
  .min(1)
  .max(25);

export async function previewItems(items: z.input<typeof previewSchema>): Promise<ActionResult<ImportPreview[]>> {
  await requireAdmin();
  const parsed = previewSchema.safeParse(items);
  if (!parsed.success) return fail("Lote inválido. Recarregue a página e tente de novo.");
  try {
    const catalog = await loadCatalog();
    const out = await mapLimit(parsed.data, 5, async (it) => {
      const warnings: string[] = [];
      let photos = 0;
      let aiPhotos = it.aiPhotos ?? 0;
      if (it.photoUrls) {
        photos = it.photoUrls.length;
        if (photos > MAX_IMPORT_PHOTOS) warnings.push(`${photos - MAX_IMPORT_PHOTOS} foto(s) além do limite de ${MAX_IMPORT_PHOTOS} ficaram de fora.`);
      } else {
        const p = pickPhotos(it.photoNames ?? []);
        photos = p.photos.length;
        aiPhotos += p.info;
        if (p.extra) warnings.push(`${p.extra} foto(s) além do limite de ${MAX_IMPORT_PHOTOS} ficaram de fora.`);
      }
      return previewDraft({ key: it.key, folder: it.folder, build: buildDraft(it.folder, it.dadosText), photos, aiPhotos, warnings }, catalog);
    });
    return { ok: true, data: out };
  } catch (e) {
    console.error("[importar] falha na prévia:", e);
    return fail("Não foi possível conferir os produtos agora.");
  }
}

// ─────────────── Google Drive

export async function listDriveFolder(link: string): Promise<ActionResult<{ root: { id: string; name: string }; folders: { id: string; name: string }[] }>> {
  await requireAdmin();
  const id = parseFolderId(String(link ?? "").slice(0, 500));
  if (!id) return fail("Cole o link da pasta do Google Drive (drive.google.com/drive/folders/…).");
  const key = (await getSettings()).catalog.googleDriveApiKey;
  if (!key) return fail("Cadastre a chave do Google Drive em Configurações → Ferramentas do catálogo.");
  try {
    const root = await getFolder(id, key);
    const files = await listFolder(id, key);
    const subfolders = files.filter(isFolder).sort((a, b) => naturalCompare(a.name, b.name));
    // Pasta de um produto só (fotos e dados.txt direto nela).
    const isProduct = files.some((f) => !isFolder(f) && (isDadosName(f.name) || isImageName(f.name)));
    const folders = isProduct ? [root] : subfolders.map((f) => ({ id: f.id, name: f.name }));
    if (!folders.length) return fail("A pasta está vazia. Crie uma subpasta para cada produto, com as fotos e o dados.txt.");
    if (folders.length > 2000) return fail("Pastas demais de uma vez (máximo 2.000). Divida em pastas menores.");
    return { ok: true, data: { root, folders } };
  } catch (e) {
    if (e instanceof DriveError) return fail(e.message);
    console.error("[importar] falha ao ler o Drive:", e);
    return fail("Não foi possível ler a pasta do Drive agora.");
  }
}

type DriveProduct = { files: DriveFile[]; photos: DriveFile[]; extra: number; info: DriveFile[]; dadosText: string | null };

async function readDriveProduct(id: string, key: string, withInfo: boolean): Promise<DriveProduct> {
  const files = await listFolder(id, key);
  const byName = new Map(files.filter((f) => !isFolder(f)).map((f) => [f.name, f]));
  const picked = pickPhotos([...byName.keys()]);
  const info = files.filter((f) => !isFolder(f) && isImageName(f.name) && isInfoPhoto(f.name));
  // Subpastas do produto (ex.: "info", "caixa") também guardam fotos de apoio.
  if (withInfo) {
    for (const sub of files.filter(isFolder).slice(0, 5)) {
      const inner = await listFolder(sub.id, key);
      info.push(...inner.filter((f) => !isFolder(f) && isImageName(f.name)).sort((a, b) => naturalCompare(a.name, b.name)));
    }
  }
  return { files, photos: picked.photos.map((n) => byName.get(n)!), extra: picked.extra, info, dadosText: await readDados(files, key) };
}

const driveFolders = z.array(z.object({ id: z.string().regex(/^[\w-]{10,100}$/), name: text(300) })).min(1).max(10);

export async function previewDrive(folders: { id: string; name: string }[]): Promise<ActionResult<ImportPreview[]>> {
  await requireAdmin();
  const parsed = driveFolders.safeParse(folders);
  if (!parsed.success) return fail("Lote inválido.");
  const key = (await getSettings()).catalog.googleDriveApiKey;
  if (!key) return fail("Cadastre a chave do Google Drive em Configurações → Ferramentas do catálogo.");
  try {
    const catalog = await loadCatalog();
    const out = await mapLimit(parsed.data, 4, async (f) => {
      try {
        const p = await readDriveProduct(f.id, key, true);
        const warnings = p.extra ? [`${p.extra} foto(s) além do limite de ${MAX_IMPORT_PHOTOS} ficaram de fora.`] : [];
        return await previewDraft({ key: f.id, folder: f.name, build: buildDraft(f.name, p.dadosText), photos: p.photos.length, aiPhotos: p.info.length, warnings }, catalog);
      } catch (e) {
        const msg = e instanceof DriveError ? e.message : "Não foi possível ler esta pasta.";
        if (!(e instanceof DriveError)) console.error("[importar] pasta do Drive:", e);
        return { key: f.id, folder: f.name, name: f.name, priceCents: null, stock: 0, variants: 0, category: null, categoryFound: false, brand: null, brandIsNew: false, photos: 0, aiPhotos: 0, status: "error" as const, errors: [msg], warnings: [], duplicate: null };
      }
    });
    return { ok: true, data: out };
  } catch (e) {
    if (e instanceof DriveError) return fail(e.message);
    console.error("[importar] falha na prévia do Drive:", e);
    return fail("Não foi possível conferir as pastas agora.");
  }
}

/** Baixa e grava as fotos; foto com problema vira aviso e as outras seguem. */
async function saveBuffers(sources: { label: string; load: () => Promise<Buffer> }[], warnings: string[]) {
  const results = await mapLimit(sources, 3, async (s) => {
    try {
      const buf = await s.load();
      const saved = await saveImage(buf, "products", { maxBytes: MAX_DRIVE_PHOTO_BYTES });
      return { saved: { url: saved.key, width: saved.width, height: saved.height } as Saved, buf };
    } catch (e) {
      warnings.push(`Foto ${s.label} não foi usada: ${(e as Error).message}`);
      return null;
    }
  });
  return results.filter((r): r is { saved: Saved; buf: Buffer } => !!r);
}

/** Fotos do código de barras (produto sem fotos próprias). */
async function barcodePhotos(urls: string[], warnings: string[]) {
  return saveBuffers(
    urls.map((u, i) => ({ label: `da base ${i + 1}`, load: () => fetchImage(u, { maxBytes: 10 * 1024 * 1024 }) })),
    warnings,
  );
}

export async function importDrive(folder: { id: string; name: string }, options: ImportOptions): Promise<ImportResult> {
  await requireAdmin();
  const f = driveFolders.safeParse([folder]);
  const o = optionsSchema.safeParse(options);
  if (!f.success || !o.success) return { ok: false, error: "Dados inválidos." };
  const key = (await getSettings()).catalog.googleDriveApiKey;
  if (!key) return { ok: false, error: "Cadastre a chave do Google Drive em Configurações → Ferramentas do catálogo." };
  let saved: (Saved & { sourceUrl?: string | null })[] = [];
  try {
    const p = await readDriveProduct(folder.id, key, o.data.useAi);
    const first = buildDraft(folder.name, p.dadosText);
    await assertImportable(first);
    const warnings: string[] = [];
    const bc = await withBarcode(first, o.data, p.photos.length > 0);
    const build = bc.build;
    const photos = [...(await saveBuffers(p.photos.map((ph) => ({ label: ph.name, load: () => downloadFile(ph, key) })), warnings)), ...(await barcodePhotos(bc.photoUrls, warnings))];
    saved = photos.map((x) => x.saved);
    const catalog = await loadCatalog();
    const ai = await withAi(
      build,
      folder.name,
      o.data.useAi,
      async () => (p.info.length ? mapLimit(p.info.slice(0, MAX_AI_IMAGES), 3, (x) => downloadFile(x, key)) : photos.slice(0, 4).map((x) => x.buf)),
      catalog,
      bc.reference,
    );
    // Cada foto padronizada fica no lugar da original (que segue em sourceUrl, para a limpeza).
    saved = await withStandard(saved, o.data.standardize, warnings);
    const r = await saveImported(ai.draft, saved, o.data, catalog);
    return { ok: true, ...r, warnings: [...build.warnings, ...bc.warnings, ...warnings, ...ai.warnings] };
  } catch (e) {
    await deleteUnusedUploads(saved.flatMap((s) => [s.url, s.sourceUrl]));
    return failImport(e, "importar do Drive");
  }
}

// ─────────────── Planilha (fotos por link)

const urlItem = z.object({ folder: text(300), dadosText: text(100_000), photoUrls: z.array(z.string().url().max(2000)).max(100) });

export async function importFromUrls(item: z.input<typeof urlItem>, options: ImportOptions): Promise<ImportResult> {
  await requireAdmin();
  const it = urlItem.safeParse(item);
  const o = optionsSchema.safeParse(options);
  if (!it.success || !o.success) return { ok: false, error: "Dados inválidos." };
  const { catalog: cfg } = await getSettings();
  let saved: (Saved & { sourceUrl?: string | null })[] = [];
  try {
    const first = buildDraft(it.data.folder, it.data.dadosText);
    await assertImportable(first);
    const warnings: string[] = [];
    const bc = await withBarcode(first, o.data, it.data.photoUrls.length > 0);
    const build = bc.build;
    const photos = [
      ...(await saveBuffers(
        it.data.photoUrls.slice(0, MAX_IMPORT_PHOTOS).map((u, i) => ({ label: `${i + 1}`, load: () => fetchImage(u, { driveKey: cfg.googleDriveApiKey }) })),
        warnings,
      )),
      ...(await barcodePhotos(bc.photoUrls, warnings)),
    ];
    saved = photos.map((x) => x.saved);
    const catalog = await loadCatalog();
    const ai = await withAi(build, it.data.folder, o.data.useAi, async () => photos.slice(0, 4).map((x) => x.buf), catalog, bc.reference);
    saved = await withStandard(saved, o.data.standardize, warnings);
    const r = await saveImported(ai.draft, saved, o.data, catalog);
    return { ok: true, ...r, warnings: [...build.warnings, ...bc.warnings, ...warnings, ...ai.warnings] };
  } catch (e) {
    await deleteUnusedUploads(saved.flatMap((s) => [s.url, s.sourceUrl]));
    return failImport(e, "importar da planilha");
  }
}

// ─────────────── Pasta do computador e .zip (fotos já enviadas pelo navegador)

const uploadKey = z.string().max(300).refine(isUploadKey, "Foto inválida.");
const uploadedItem = z.object({
  folder: text(300),
  dadosText: text(100_000).nullable(),
  images: z.array(z.object({ url: uploadKey, width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable() })).max(MAX_IMPORT_PHOTOS),
  // Fotos de apoio vão para a pasta "misc" e são apagadas no fim; nada fora dela.
  aiImages: z.array(uploadKey.refine((k) => k.startsWith("/uploads/misc/"), "Foto inválida.")).max(MAX_AI_IMAGES),
});

/** Confere antes de enviar as fotos (evita subir fotos de um produto que vai ser recusado). */
export async function checkUploaded(folder: string, dadosText: string | null): Promise<ImportResult | { ok: true }> {
  await requireAdmin();
  try {
    await assertImportable(buildDraft(String(folder).slice(0, 300), dadosText == null ? null : String(dadosText).slice(0, 100_000)));
    return { ok: true };
  } catch (e) {
    return failImport(e, "conferir");
  }
}

async function readLarge(key: string) {
  const file = await readUpload(`${key.replace(/^\/uploads\//, "")}-lg.webp`);
  return file?.body ?? null;
}

export async function importUploaded(item: z.input<typeof uploadedItem>, options: ImportOptions): Promise<ImportResult> {
  await requireAdmin();
  const it = uploadedItem.safeParse(item);
  const o = optionsSchema.safeParse(options);
  if (!it.success || !o.success) return { ok: false, error: "Dados inválidos." };
  const { aiImages } = it.data;
  let images: (Saved & { sourceUrl?: string | null })[] = it.data.images;
  try {
    const first = buildDraft(it.data.folder, it.data.dadosText);
    await assertImportable(first);
    const warnings: string[] = [];
    const bc = await withBarcode(first, o.data, images.length > 0);
    const build = bc.build;
    images = [...images, ...(await barcodePhotos(bc.photoUrls, warnings)).map((x) => x.saved)];
    const catalog = await loadCatalog();
    const ai = await withAi(
      build,
      it.data.folder,
      o.data.useAi,
      async () => (await Promise.all((aiImages.length ? aiImages : images.slice(0, 4).map((x) => x.url)).map(readLarge))).filter((b) => b != null),
      catalog,
      bc.reference,
    );
    images = await withStandard(images, o.data.standardize, warnings);
    const r = await saveImported(ai.draft, images, o.data, catalog);
    return { ok: true, ...r, warnings: [...build.warnings, ...bc.warnings, ...warnings, ...ai.warnings] };
  } catch (e) {
    await deleteUnusedUploads(images.flatMap((s) => [s.url, s.sourceUrl]));
    return failImport(e, "importar");
  } finally {
    // Fotos de apoio (caixa, manual) só servem para a IA.
    await Promise.all(aiImages.map((k) => deleteImage(k).catch(() => null)));
  }
}
