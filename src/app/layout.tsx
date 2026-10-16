import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { getSettings } from "@/lib/settings";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import "./globals.css";

// Tudo depende do banco (configurações, produtos): renderiza a cada acesso.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const base = process.env.APP_URL || "http://localhost:3000";
  return {
    metadataBase: new URL(base),
    title: { default: s.seo.title, template: `%s · ${s.store.name}` },
    description: s.seo.description,
    keywords: s.seo.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    applicationName: s.store.name,
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/favicon.svg", type: "image/svg+xml" },
      ],
      apple: "/apple-touch-icon.png",
    },
    appleWebApp: { capable: true, title: s.store.name, statusBarStyle: "black-translucent" },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: s.store.name,
      title: s.seo.title,
      description: s.seo.description,
      images: [{ url: s.seo.ogImage || "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: s.seo.title, description: s.seo.description, images: [s.seo.ogImage || "/og-image.png"] },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [jar, s] = await Promise.all([cookies(), getSettings()]);
  const cookieTheme = jar.get("theme")?.value;
  const theme = cookieTheme === "light" || cookieTheme === "dark" ? cookieTheme : s.appearance.defaultTheme;
  return (
    <html lang="pt-BR" data-theme={theme} className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          closeButton
          toastOptions={{
            style: { background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border-strong)", borderRadius: 14 },
          }}
        />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
