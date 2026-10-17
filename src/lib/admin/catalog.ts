import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";

// Apoio ao painel de catálogo: opções de categoria/marca e URLs únicas.

export type CategoryOption = { id: string; label: string; name: string; parentId: string | null; depth: number; active: boolean };
export type BrandOption = { id: string; name: string; active: boolean };

type CatRow = { id: string; name: string; parentId: string | null; sortOrder: number; active: boolean };

/** Ordena a árvore: pais pela ordem, filhos logo abaixo de cada pai. */
export function flattenCategoryTree<T extends CatRow>(rows: T[]): (T & { depth: number; path: string[] })[] {
  const byParent = new Map<string | null, T[]>();
  const ids = new Set(rows.map((r) => r.id));
  for (const r of rows) {
    // Pai inexistente (dados antigos) vira primeiro nível.
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), r]);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"));
  const out: (T & { depth: number; path: string[] })[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number, path: string[]) => {
    for (const r of byParent.get(parent) ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const p = [...path, r.name];
      out.push({ ...r, depth, path: p });
      walk(r.id, depth + 1, p);
    }
  };
  walk(null, 0, []);
  return out;
}

export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const rows = await db.category.findMany({ select: { id: true, name: true, parentId: true, sortOrder: true, active: true } });
  return flattenCategoryTree(rows).map((c) => ({ id: c.id, name: c.name, label: c.path.join(" › "), parentId: c.parentId, depth: c.depth, active: c.active }));
}

export async function getBrandOptions(): Promise<BrandOption[]> {
  return db.brand.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } });
}

/** Primeira URL livre a partir de `base` (base, base-2, base-3…). */
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base) || "item";
  if (!(await exists(root))) return root;
  for (let i = 2; i < 500; i++) {
    const suffix = `-${i}`;
    const candidate = `${root.slice(0, 120 - suffix.length)}${suffix}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root.slice(0, 110)}-${Date.now().toString(36)}`;
}
