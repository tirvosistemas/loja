import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { getBrandOptions, getCategoryOptions } from "@/lib/admin/catalog";
import { loadBulkRows, MAX_BULK_PRODUCTS } from "@/lib/admin/bulk-server";
import { rowsToSheet, sheetToCsv } from "@/lib/admin/bulk";
import { buildXlsx } from "@/lib/xlsx-write";

// Planilha com os produtos (e variações) da edição em massa, para editar no Excel e mandar de
// volta em Produtos → Edição em massa → “Atualizar pela planilha”. ?formato=csv para CSV.
// Acima de MAX_BULK_PRODUCTS, vão só os cadastrados mais recentemente (arquivo “-parcial”).
export async function GET(req: Request) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Faça login no painel." }, { status: 401 });
  const csv = new URL(req.url).searchParams.get("formato") === "csv";
  const [{ rows, truncated }, categories, brands] = await Promise.all([loadBulkRows(), getCategoryOptions(), getBrandOptions()]);
  const note = truncated ? `Atenção: planilha parcial. Só os ${MAX_BULK_PRODUCTS.toLocaleString("pt-BR")} produtos cadastrados mais recentemente estão aqui.` : undefined;
  const cells = rowsToSheet(rows, { categories, brands }, note);
  const date = new Date().toISOString().slice(0, 10);
  const name = `produtos-${date}${truncated ? "-parcial" : ""}`;
  const headers = { "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="${name}.${csv ? "csv" : "xlsx"}"` };
  if (csv) return new NextResponse(sheetToCsv(cells), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  const data = buildXlsx(cells, { sheetName: "Produtos", widths: [28, 28, 48, 18, 12, 12, 12, 10, 30, 18, 12, 10, 12, 12, 16, 12, 16, 22], frozenRows: note ? 2 : 1 });
  return new NextResponse(Buffer.from(data), { headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
}
