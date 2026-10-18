import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  return {
    id: "/",
    name: `${s.store.name} · Eletrodomésticos`,
    short_name: s.store.name,
    description: s.store.description,
    start_url: "/?origem=app",
    scope: "/",
    display: "standalone",
    // Sem travar a orientação: no tablet a loja também funciona deitada.
    orientation: "any",
    background_color: "#09090b",
    theme_color: "#09090b",
    lang: "pt-BR",
    categories: ["shopping"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ofertas", url: "/ofertas", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Carrinho", url: "/carrinho", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Acompanhar pedido", url: "/acompanhar", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
