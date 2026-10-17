import type { ProductDetailDTO } from "@/lib/catalog";

// Ficha técnica: especificações cadastradas + campos fixos do produto (sem repetir rótulos).

function num(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function specRows(p: ProductDetailDTO) {
  const rows: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  const push = (label: string, value: string | null | undefined) => {
    const key = label.trim().toLowerCase();
    if (!value?.trim() || seen.has(key)) return;
    seen.add(key);
    rows.push({ label, value: value.trim() });
  };
  for (const s of p.specs) push(s.label, s.value);

  push("Marca", p.brand);
  push("Modelo", p.model);
  push("Voltagem", p.voltage);
  const v = p.variants.map((x) => x.name).join(", ");
  if (v) push(p.variantLabel || "Opções", v);
  push("Cor", p.color);
  const { widthCm: w, heightCm: h, depthCm: d } = p.dimensions;
  if (w && h && d) push("Dimensões (L × A × P)", `${num(w)} × ${num(h)} × ${num(d)} cm`);
  else if (w || h || d)
    push("Dimensões", [w && `largura ${num(w)} cm`, h && `altura ${num(h)} cm`, d && `profundidade ${num(d)} cm`].filter(Boolean).join(" · ").replace(/^./, (c) => c.toUpperCase()));
  if (p.weightGrams) push("Peso", p.weightGrams >= 1000 ? `${num(p.weightGrams / 1000)} kg` : `${p.weightGrams} g`);
  if (p.warrantyMonths) push("Garantia", `${p.warrantyMonths} ${p.warrantyMonths === 1 ? "mês" : "meses"}`);
  push("Código de barras (EAN)", p.ean);
  push("Código (SKU)", p.sku);
  return rows;
}

export function SpecsTable({ product }: { product: ProductDetailDTO }) {
  const rows = specRows(product);
  if (!rows.length) return <p className="text-sm text-muted-foreground">A ficha técnica deste produto ainda não foi cadastrada.</p>;
  return (
    <div className="max-w-4xl overflow-hidden rounded-2xl border border-border">
      <dl className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-1 px-4 py-3 odd:bg-card even:bg-elevated/50 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4 sm:px-5">
            <dt className="text-sm text-muted-foreground">{r.label}</dt>
            <dd className="break-words text-sm font-medium text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
