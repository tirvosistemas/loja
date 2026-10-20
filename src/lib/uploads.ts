import path from "node:path";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import sharp, { type Metadata as SharpMetadata } from "sharp";
import { IMAGE_WIDTHS, isUploadKey, type ImageSize } from "./images";
import { randomCode } from "./utils";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const UPLOAD_FOLDERS = ["products", "banners", "categories", "brands", "pages", "push", "misc"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

// Os comentários turbopackIgnore evitam que o build trate esses caminhos dinâmicos como
// dependências e copie o projeto inteiro para a saída standalone.
export function uploadRoot() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./data/uploads");
}

// Formatos aceitos na entrada (a saída é sempre WebP).
const ACCEPTED_FORMATS = new Set(["jpeg", "jpg", "png", "webp", "avif", "gif", "heif", "tiff"]);

/**
 * Converte qualquer imagem (JPG, PNG, WebP, AVIF, GIF, HEIC) em 3 WebP otimizados.
 * Retorna a chave para guardar no banco. SVG não é aceito (risco de script embutido).
 */
export async function saveImage(input: Buffer, folder: UploadFolder, opts: { fit?: "inside" | "cover"; maxBytes?: number } = {}) {
  const max = opts.maxBytes ?? MAX_UPLOAD_BYTES;
  if (input.byteLength > max) throw new Error(`Imagem maior que ${Math.round(max / 1024 / 1024)} MB.`);
  let meta: SharpMetadata;
  try {
    meta = await sharp(input, { failOn: "error" }).metadata();
  } catch {
    throw new Error("Arquivo não é uma imagem válida.");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) throw new Error("Formato não suportado. Use JPG, PNG ou WebP.");

  const now = new Date();
  const rel = path.posix.join(folder, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
  const id = `${Date.now().toString(36)}${randomCode(6).toLowerCase()}`;
  const dir = path.join(/*turbopackIgnore: true*/ uploadRoot(), rel);
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });

  let width = meta.width ?? 0;
  let height = meta.height ?? 0;
  const key = `/uploads/${rel}/${id}`;
  try {
    for (const [size, w] of Object.entries(IMAGE_WIDTHS) as [ImageSize, number][]) {
      const out = await sharp(input)
        .rotate()
        .resize({ width: w, withoutEnlargement: true, fit: opts.fit ?? "inside" })
        .webp({ quality: size === "sm" ? 78 : 82 })
        .toFile(path.join(/*turbopackIgnore: true*/ dir, `${id}-${size}.webp`));
      if (size === "lg") ({ width, height } = out);
    }
  } catch (e) {
    // Imagem corrompida no meio da conversão: não deixa tamanhos soltos no disco.
    await deleteImage(key).catch(() => null);
    throw e;
  }
  return { key, width, height };
}

export async function deleteImage(key: string | null | undefined) {
  if (!key || !isUploadKey(key)) return;
  const base = resolveUploadPath(key.replace(/^\/uploads\//, ""));
  if (!base) return;
  await Promise.all((Object.keys(IMAGE_WIDTHS) as ImageSize[]).map((s) => rm(/*turbopackIgnore: true*/ `${base}-${s}.webp`, { force: true })));
}

/** Caminho absoluto dentro de UPLOAD_DIR, ou null se tentar sair dele. */
export function resolveUploadPath(relative: string): string | null {
  const root = uploadRoot();
  const full = path.resolve(/*turbopackIgnore: true*/ root, relative);
  return full.startsWith(root + path.sep) ? full : null;
}

const MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

export async function readUpload(relative: string) {
  const full = resolveUploadPath(relative);
  if (!full) return null;
  const type = MIME[path.extname(full).toLowerCase()];
  if (!type) return null;
  try {
    const s = await stat(/*turbopackIgnore: true*/ full);
    if (!s.isFile()) return null;
    return { body: await readFile(/*turbopackIgnore: true*/ full), type, size: s.size, mtime: s.mtime };
  } catch {
    return null;
  }
}
