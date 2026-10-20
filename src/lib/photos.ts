import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { isUploadKey } from "./images";
import { readUpload } from "./uploads";
import type { CatalogSettings } from "./settings";

// Padronizador das fotos de produto: fundo da cor escolhida, formato quadrado com respiro
// em volta e marca d'água. Trabalha sempre a partir da foto original (guardada em
// ProductImage.sourceUrl), então reaplicar com outro padrão não acumula marca d'água.

export type PhotoStandard = Pick<
  CatalogSettings,
  "photoSquare" | "photoBackground" | "photoPaddingPercent" | "watermarkEnabled" | "watermarkImage" | "watermarkPosition" | "watermarkOpacity" | "watermarkSizePercent"
>;

/** Logos da marca disponíveis para marca d'água (pasta public/brand). */
export const BRAND_WATERMARKS = [
  { value: "/brand/tirvo-logo-para-fundo-claro.svg", label: "Logo (para fundo claro)" },
  { value: "/brand/tirvo-logo-para-fundo-escuro.svg", label: "Logo (para fundo escuro)" },
  { value: "/brand/tirvo-icone-para-fundo-claro.svg", label: "Ícone (para fundo claro)" },
  { value: "/brand/tirvo-icone-para-fundo-escuro.svg", label: "Ícone (para fundo escuro)" },
  { value: "/brand/tirvo-logo-com-frase-para-fundo-claro.svg", label: "Logo com frase (fundo claro)" },
  { value: "/brand/tirvo-logo-vertical-para-fundo-claro.svg", label: "Logo vertical (fundo claro)" },
] as const;

const OUT = 1600;

/** Lê a imagem da marca d'água: arquivo de public/brand ou upload do painel. */
async function loadWatermark(src: string): Promise<Buffer | null> {
  if (isUploadKey(src)) return (await readUpload(`${src.replace(/^\/uploads\//, "")}-lg.webp`))?.body ?? null;
  if (/^\/brand\/[\w.-]+\.(svg|png|webp)$/.test(src)) {
    try {
      return await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", src));
    } catch {
      return null;
    }
  }
  return null;
}

/** Lê a versão grande de uma foto já enviada. */
export async function readPhoto(key: string): Promise<Buffer | null> {
  if (!isUploadKey(key)) return null;
  return (await readUpload(`${key.replace(/^\/uploads\//, "")}-lg.webp`))?.body ?? null;
}

/** Aplica o padrão numa imagem e devolve um PNG pronto para saveImage. */
export async function standardizePhoto(input: Buffer, s: PhotoStandard): Promise<Buffer> {
  const bg = s.photoBackground;
  // Fundo transparente (PNG recortado) vira a cor de fundo.
  let img = sharp(input).rotate().flatten({ background: bg });
  const meta = await sharp(input).rotate().metadata();
  let w = meta.autoOrient?.width ?? meta.width ?? OUT;
  let h = meta.autoOrient?.height ?? meta.height ?? OUT;

  if (s.photoSquare) {
    const inner = Math.round(OUT * (1 - (2 * s.photoPaddingPercent) / 100));
    const resized = await img.resize({ width: inner, height: inner, fit: "inside", withoutEnlargement: false }).png().toBuffer({ resolveWithObject: true });
    const left = Math.floor((OUT - resized.info.width) / 2);
    const top = Math.floor((OUT - resized.info.height) / 2);
    img = sharp({ create: { width: OUT, height: OUT, channels: 3, background: bg } }).composite([{ input: resized.data, left, top }]);
    w = OUT;
    h = OUT;
  } else {
    const resized = await img.resize({ width: OUT, height: OUT, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
    img = sharp(resized.data);
    w = resized.info.width;
    h = resized.info.height;
  }

  if (s.watermarkEnabled && s.watermarkImage) {
    const mark = await loadWatermark(s.watermarkImage);
    if (mark) {
      const markW = Math.max(40, Math.round((Math.min(w, h) * s.watermarkSizePercent) / 100));
      const resizedMark = await sharp(mark, { density: 300 }).resize({ width: markW, height: markW, fit: "inside" }).ensureAlpha().png().toBuffer({ resolveWithObject: true });
      // Opacidade: multiplica o canal alfa.
      const { data, info } = await sharp(resizedMark.data).raw().toBuffer({ resolveWithObject: true });
      const k = s.watermarkOpacity / 100;
      for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * k);
      const faded = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
      const margin = Math.round(Math.min(w, h) * 0.035);
      const pos = s.watermarkPosition;
      const left = pos === "center" ? Math.round((w - info.width) / 2) : pos.endsWith("left") ? margin : w - info.width - margin;
      const top = pos === "center" ? Math.round((h - info.height) / 2) : pos.startsWith("top") ? margin : h - info.height - margin;
      img = sharp(await img.png().toBuffer()).composite([{ input: faded, left: Math.max(0, left), top: Math.max(0, top) }]);
    }
  }
  return img.png().toBuffer();
}

/** Prévia pequena (para as Configurações), em JPEG. */
export async function standardizePreview(input: Buffer, s: PhotoStandard): Promise<Buffer> {
  const out = await standardizePhoto(input, s);
  return sharp(out).resize({ width: 480 }).jpeg({ quality: 80 }).toBuffer();
}
