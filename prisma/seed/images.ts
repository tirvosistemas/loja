import path from "node:path";
import { readFile, rm, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { deleteImage, saveImage, uploadRoot, type UploadFolder } from "../../src/lib/uploads";

// Rasteriza as ilustrações (SVG → PNG) e salva no armazenamento de imagens da loja.
// As chaves geradas ficam num manifesto oculto para o --reset apagar só o que o seed criou.

const MANIFEST = ".seed-manifest.json";

function manifestPath() {
  return path.join(uploadRoot(), MANIFEST);
}

async function readManifest(): Promise<string[]> {
  try {
    const data = JSON.parse(await readFile(manifestPath(), "utf8"));
    return Array.isArray(data) ? data.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

const created: string[] = [];

export async function svgToUpload(svg: string, folder: UploadFolder) {
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 7 }).toBuffer();
  const saved = await saveImage(png, folder);
  created.push(saved.key);
  return saved;
}

/** Grava no manifesto as imagens criadas nesta execução. */
export async function flushManifest() {
  if (!created.length) return;
  const all = [...new Set([...(await readManifest()), ...created])];
  await writeFile(manifestPath(), JSON.stringify(all), "utf8");
  created.length = 0;
}

/** Apaga os arquivos gerados por execuções anteriores do seed. */
export async function deleteSeedImages() {
  const keys = await readManifest();
  for (const key of keys) await deleteImage(key);
  await rm(manifestPath(), { force: true });
  return keys.length;
}
