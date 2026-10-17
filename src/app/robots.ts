import type { MetadataRoute } from "next";

// Lido a cada acesso para usar o APP_URL do ambiente em produção.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/checkout", "/carrinho", "/pedido"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
