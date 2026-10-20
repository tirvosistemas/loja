import { feedEnabled, feedXml, loadFeedItems } from "@/lib/feed";
import { getSettings } from "@/lib/settings";

// Catálogo para Google Merchant Center e Meta (formato RSS 2.0 com campos g:).
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await feedEnabled())) return new Response("Catálogo desligado nas Configurações.", { status: 404 });
  const [items, s] = await Promise.all([loadFeedItems(), getSettings()]);
  return new Response(feedXml(items, { name: s.store.name, description: s.store.description }), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" },
  });
}
