import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isUploadKey } from "@/lib/images";
import { saveImage } from "@/lib/uploads";
import { readPhoto, standardizePhoto, type PhotoStandard } from "@/lib/photos";
import { deleteUnusedUploads } from "./uploads";

// Aplica (ou desfaz) o padrão das fotos. Sempre parte da original, guardada em sourceUrl.

export type StdImage = { url: string; sourceUrl: string | null; width: number | null; height: number | null };

export async function photoStandard(): Promise<PhotoStandard> {
  return (await getSettings()).catalog;
}

/** Nova versão padronizada de uma foto. Fotos por link externo ficam como estão. */
export async function standardizeImage(img: { url: string; sourceUrl?: string | null }, std: PhotoStandard): Promise<StdImage | null> {
  const source = img.sourceUrl || img.url;
  if (!isUploadKey(source)) return null;
  const buf = await readPhoto(source);
  if (!buf) return null;
  const out = await standardizePhoto(buf, std);
  const saved = await saveImage(out, "products", { maxBytes: 60 * 1024 * 1024 });
  return { url: saved.key, sourceUrl: source, width: saved.width, height: saved.height };
}

/** Padroniza (ou desfaz) as fotos dos produtos. Devolve quantas fotos mudaram. */
export async function standardizeProducts(ids: string[], undo: boolean): Promise<{ photos: number; products: number; failed: number }> {
  const std = await photoStandard();
  const images = await db.productImage.findMany({ where: { productId: { in: ids } }, select: { id: true, productId: true, url: true, sourceUrl: true } });
  const stale: string[] = [];
  let photos = 0;
  let failed = 0;
  const touched = new Set<string>();
  for (const im of images) {
    try {
      if (undo) {
        if (!im.sourceUrl) continue;
        await db.productImage.update({ where: { id: im.id }, data: { url: im.sourceUrl, sourceUrl: null, width: null, height: null } });
        stale.push(im.url);
      } else {
        const next = await standardizeImage(im, std);
        if (!next) continue;
        await db.productImage.update({ where: { id: im.id }, data: { url: next.url, sourceUrl: next.sourceUrl, width: next.width, height: next.height } });
        if (im.sourceUrl && im.url !== im.sourceUrl) stale.push(im.url);
      }
      photos++;
      touched.add(im.productId);
    } catch (e) {
      failed++;
      console.error("[fotos] falha ao padronizar:", e);
    }
  }
  // Volta as dimensões da original ao desfazer.
  if (undo && photos) {
    const restored = await db.productImage.findMany({ where: { productId: { in: [...touched] }, width: null }, select: { id: true, url: true } });
    const sharp = (await import("sharp")).default;
    for (const r of restored) {
      const buf = await readPhoto(r.url);
      if (!buf) continue;
      const m = await sharp(buf).metadata();
      if (m.width && m.height) await db.productImage.update({ where: { id: r.id }, data: { width: m.width, height: m.height } });
    }
  }
  await deleteUnusedUploads(stale);
  return { photos, products: touched.size, failed };
}
