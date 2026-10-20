import { db } from "@/lib/db";
import { deleteImage } from "@/lib/uploads";
import { isUploadKey } from "@/lib/images";

// Remove do disco as imagens que não são mais usadas em lugar nenhum.
// Fotos de produto podem ser compartilhadas (produto duplicado) e continuam
// aparecendo em pedidos antigos, então só apagamos quando nada mais aponta para elas.

export async function deleteUnusedUploads(keys: Iterable<string | null | undefined>) {
  const list = [...new Set([...keys].filter((k): k is string => !!k && isUploadKey(k)))];
  if (!list.length) return;
  try {
    const [images, items, categories, brands, banners, campaigns] = await Promise.all([
      db.productImage.findMany({ where: { OR: [{ url: { in: list } }, { sourceUrl: { in: list } }] }, select: { url: true, sourceUrl: true } }),
      db.orderItem.findMany({ where: { image: { in: list } }, select: { image: true }, distinct: ["image"] }),
      db.category.findMany({ where: { image: { in: list } }, select: { image: true } }),
      db.brand.findMany({ where: { logo: { in: list } }, select: { logo: true } }),
      db.banner.findMany({ where: { OR: [{ imageDesktop: { in: list } }, { imageMobile: { in: list } }] }, select: { imageDesktop: true, imageMobile: true } }),
      db.pushCampaign.findMany({ where: { image: { in: list } }, select: { image: true } }),
    ]);
    const used = new Set<string>([
      ...images.flatMap((i) => [i.url, i.sourceUrl ?? ""]),
      ...items.map((i) => i.image ?? ""),
      ...categories.map((c) => c.image ?? ""),
      ...brands.map((b) => b.logo ?? ""),
      ...banners.flatMap((b) => [b.imageDesktop, b.imageMobile ?? ""]),
      ...campaigns.map((c) => c.image ?? ""),
    ]);
    await Promise.all(list.filter((k) => !used.has(k)).map((k) => deleteImage(k).catch(() => null)));
  } catch (e) {
    // Arquivo que sobra no disco não quebra a loja; só registramos.
    console.error("[uploads] falha ao limpar imagens:", e);
  }
}
