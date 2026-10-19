import path from "node:path";
import { readFile, rm } from "node:fs/promises";
import { deleteImage, uploadRoot } from "../../src/lib/uploads";

// Versões antigas do seed geravam ilustrações e anotavam as chaves num manifesto oculto.
// O --reset usa esse manifesto para apagar só essas imagens (as enviadas pelo painel ficam).

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

/** Apaga os arquivos gerados por execuções anteriores do seed. */
export async function deleteSeedImages() {
  const keys = await readManifest();
  for (const key of keys) await deleteImage(key);
  await rm(manifestPath(), { force: true });
  return keys.length;
}
