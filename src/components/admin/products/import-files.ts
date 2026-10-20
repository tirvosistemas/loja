"use client";

import { Unzip, UnzipInflate } from "fflate";
import { isDadosName, isImageName } from "@/lib/importer/dados";

// Leitura de arquivos no navegador para o importador: pasta escolhida ou arrastada, .zip
// (lido em partes, sem carregar tudo na memória), texto com acentos e fotos grandes.

export type PathFile = { path: string; file: File };

const wanted = (name: string) => isImageName(name) || isDadosName(name);

/** Arquivos de <input webkitdirectory>, com o caminho relativo à pasta escolhida. */
export function fromFileList(list: FileList | File[]): PathFile[] {
  return [...list].filter((f) => wanted(f.name)).map((f) => ({ path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, file: f }));
}

/** Pastas e arquivos arrastados para a página (inclui subpastas). */
export async function fromDrop(items: DataTransferItemList): Promise<PathFile[]> {
  const roots = [...items].map((i) => i.webkitGetAsEntry()).filter((e): e is FileSystemEntry => !!e);
  const out: PathFile[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      if (!wanted(entry.name)) return;
      const file = await new Promise<File>((ok, err) => (entry as FileSystemFileEntry).file(ok, err));
      out.push({ path: entry.fullPath.replace(/^\//, ""), file });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries devolve no máximo 100 por vez: repete até vir vazio.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((ok, err) => reader.readEntries(ok, err));
        if (!batch.length) break;
        for (const e of batch) await walk(e);
      }
    }
  };
  for (const r of roots) await walk(r);
  return out;
}

/** Fotos e dados.txt de dentro de um .zip, lidos aos poucos. */
export async function fromZip(zip: File, onProgress?: (read: number, total: number) => void): Promise<PathFile[]> {
  const out: PathFile[] = [];
  const pending: Promise<void>[] = [];
  let failure: unknown = null;
  const uz = new Unzip((entry) => {
    const name = entry.name.split("/").pop() ?? "";
    if (entry.name.endsWith("/") || !wanted(name)) return;
    const chunks: Uint8Array[] = [];
    pending.push(
      new Promise<void>((resolve) => {
        entry.ondata = (err, data, final) => {
          if (err) {
            failure = err;
            return resolve();
          }
          chunks.push(data);
          if (final) {
            out.push({ path: entry.name, file: new File(chunks as BlobPart[], name) });
            resolve();
          }
        };
      }),
    );
    entry.start();
  });
  uz.register(UnzipInflate);
  const reader = zip.stream().getReader();
  let read = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      uz.push(new Uint8Array(0), true);
      break;
    }
    uz.push(value);
    read += value.byteLength;
    onProgress?.(read, zip.size);
  }
  await Promise.all(pending);
  if (failure) throw new Error("O .zip está corrompido ou usa um formato não suportado. Tente compactar de novo.");
  return out;
}

/** Texto em UTF-8; se tiver caracteres quebrados, tenta o padrão antigo do Windows. */
export async function readText(file: Blob) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8;
}

const MAX_UPLOAD = 8 * 1024 * 1024;

/** Foto acima de 8 MB é reduzida no navegador (2560 px, WebP) antes de enviar. */
export async function shrinkIfNeeded(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`“${file.name}” tem mais de 8 MB e o navegador não consegue reduzir. Salve em JPG menor.`);
  }
  const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.92));
  if (!blob || blob.size > MAX_UPLOAD) throw new Error(`“${file.name}” continua grande demais depois de reduzida.`);
  return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
}

/** Baixa um texto como arquivo (modelos do dados.txt e da planilha). */
export function downloadText(name: string, content: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
