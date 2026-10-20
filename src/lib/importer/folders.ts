import { isDadosName, isImageName } from "./dados";

// Descobre as pastas de produto a partir dos caminhos dos arquivos (pasta escolhida no
// computador ou .zip). Uma pasta é produto quando tem dados.txt, ou fotos sem estar dentro
// de outro produto. Subpastas de um produto (ex.: "info") guardam fotos de apoio.

export type FolderGroup<T> = {
  dir: string;
  folder: string; // nome da pasta (último trecho do caminho)
  dados: T | null;
  photos: { name: string; file: T }[]; // na raiz da pasta do produto
  info: { name: string; file: T }[]; // em subpastas
};

const parentOf = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf("/")));
const isAncestor = (anc: string, dir: string) => anc === "" || dir === anc || dir.startsWith(`${anc}/`);

function cleanPath(p: string) {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  // Lixo de sistema: __MACOSX, .DS_Store, Thumbs.db, arquivos ocultos.
  if (parts.some((s) => s === "__MACOSX" || s.startsWith(".")) || /^thumbs\.db$/i.test(parts.at(-1) ?? "")) return null;
  return parts.join("/");
}

export function groupByProductFolder<T>(entries: { path: string; file: T }[]): FolderGroup<T>[] {
  const files = entries.flatMap((e) => {
    const path = cleanPath(e.path);
    if (!path) return [];
    const name = path.slice(path.lastIndexOf("/") + 1);
    return isImageName(name) || isDadosName(name) ? [{ path, dir: parentOf(path), name, file: e.file }] : [];
  });

  const withDados = new Set(files.filter((f) => isDadosName(f.name)).map((f) => f.dir));
  const withImages = new Set(files.filter((f) => isImageName(f.name)).map((f) => f.dir));
  const dadosDirs = [...withDados];
  const imageDirs = [...withImages].filter(
    (d) => !dadosDirs.some((a) => isAncestor(a, d)) && !dadosDirs.some((a) => isAncestor(d, a) && a !== d),
  );
  const looseDirs = imageDirs.filter((d) => !imageDirs.some((a) => a !== d && isAncestor(a, d)));
  const productDirs = [...dadosDirs, ...looseDirs].sort((a, b) => b.length - a.length); // mais fundo primeiro

  const groups = new Map<string, FolderGroup<T>>();
  for (const dir of productDirs) groups.set(dir, { dir, folder: dir.slice(dir.lastIndexOf("/") + 1) || "Produto", dados: null, photos: [], info: [] });

  for (const f of files) {
    const owner = productDirs.find((d) => isAncestor(d, f.dir));
    if (!owner) continue;
    const g = groups.get(owner)!;
    if (f.dir === owner) {
      if (isDadosName(f.name)) g.dados ??= f.file;
      else g.photos.push({ name: f.name, file: f.file });
    } else if (isImageName(f.name)) g.info.push({ name: f.name, file: f.file });
  }
  return [...groups.values()].sort((a, b) => a.dir.localeCompare(b.dir, "pt-BR", { numeric: true }));
}
