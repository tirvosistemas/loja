import { feedEnabled, feedMetaCsv, loadFeedItems } from "@/lib/feed";

// Catálogo para o Gerenciador de Comércio da Meta (Instagram/Facebook), com os campos e valores dela.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await feedEnabled())) return new Response("Catálogo desligado nas Configurações.", { status: 404 });
  return new Response(feedMetaCsv(await loadFeedItems()), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=900" },
  });
}
