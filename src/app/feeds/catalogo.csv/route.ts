import { feedCsv, feedEnabled, loadFeedItems } from "@/lib/feed";

// Mesmo catálogo do XML, em CSV (aceito pelo Gerenciador de Comércio da Meta e pelo Merchant Center).
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await feedEnabled())) return new Response("Catálogo desligado nas Configurações.", { status: 404 });
  return new Response(feedCsv(await loadFeedItems()), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=900" },
  });
}
