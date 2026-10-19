// Destinos de links da loja (botão de banner, toque na notificação). Funções puras,
// usadas no servidor (listas) e no navegador (LinkPicker).

export type LinkKind = "none" | "home" | "ofertas" | "lancamentos" | "categoria" | "marca" | "produto" | "pagina" | "url";

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  none: "Sem link",
  home: "Página inicial",
  ofertas: "Ofertas",
  lancamentos: "Lançamentos",
  categoria: "Categoria",
  marca: "Marca",
  produto: "Produto",
  pagina: "Página institucional",
  url: "URL personalizada",
};

export const FIXED: Partial<Record<LinkKind, string>> = { home: "/", ofertas: "/ofertas", lancamentos: "/lancamentos" };
export const PREFIX: Partial<Record<LinkKind, string>> = { categoria: "/categoria/", marca: "/marca/", produto: "/produto/", pagina: "/pagina/" };

/** Descobre o tipo de link a partir do endereço salvo. */
export function parseHref(href: string | null | undefined): { kind: LinkKind; slug: string } {
  const v = (href ?? "").trim();
  if (!v) return { kind: "none", slug: "" };
  for (const [kind, path] of Object.entries(FIXED)) if (v === path) return { kind: kind as LinkKind, slug: "" };
  for (const [kind, prefix] of Object.entries(PREFIX)) {
    if (v.startsWith(prefix!)) {
      const slug = v.slice(prefix!.length);
      if (/^[a-z0-9-]+$/i.test(slug)) return { kind: kind as LinkKind, slug };
    }
  }
  return { kind: "url", slug: "" };
}

/** Descrição curta de um link salvo, para listas ("Categoria: Headsets Gamer"). */
export function describeHref(href: string | null | undefined, names?: { categories?: Map<string, string>; brands?: Map<string, string>; pages?: Map<string, string> }) {
  const { kind, slug } = parseHref(href);
  if (kind === "none") return "Sem link";
  if (kind === "categoria") return `Categoria: ${names?.categories?.get(slug) ?? slug}`;
  if (kind === "marca") return `Marca: ${names?.brands?.get(slug) ?? slug}`;
  if (kind === "pagina") return `Página: ${names?.pages?.get(slug) ?? slug}`;
  if (kind === "produto") return `Produto: ${slug}`;
  if (kind === "url") return href ?? "";
  return LINK_KIND_LABEL[kind];
}
