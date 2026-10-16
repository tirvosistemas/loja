// Imagens enviadas pelo painel são salvas em 3 tamanhos WebP:
//   <chave>-sm.webp (480px), <chave>-md.webp (960px), <chave>-lg.webp (1600px)
// No banco guardamos só a chave (ex.: "/uploads/products/2026/10/k3j2h1").
// URLs completas ou caminhos com extensão (ex.: "/brand/x.svg") são usados como estão.

export type ImageSize = "sm" | "md" | "lg";
export const IMAGE_WIDTHS: Record<ImageSize, number> = { sm: 480, md: 960, lg: 1600 };

export function isUploadKey(src: string) {
  return src.startsWith("/uploads/") && !/\.[a-z0-9]{2,5}$/i.test(src);
}

export function imageUrl(src: string | null | undefined, size: ImageSize = "md"): string {
  if (!src) return "/brand/tirvo-icone-para-fundo-claro.svg";
  return isUploadKey(src) ? `${src}-${size}.webp` : src;
}

export function imageSrcSet(src: string | null | undefined): string | undefined {
  if (!src || !isUploadKey(src)) return undefined;
  return (Object.keys(IMAGE_WIDTHS) as ImageSize[]).map((s) => `${src}-${s}.webp ${IMAGE_WIDTHS[s]}w`).join(", ");
}
