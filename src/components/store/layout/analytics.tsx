"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useConsent } from "./consent";

type Fbq = (...args: unknown[]) => void;

// Só aceita IDs no formato esperado (o valor entra em um script).
const GA_RE = /^G-[A-Z0-9]{4,20}$/i;
const PIXEL_RE = /^\d{6,20}$/;

/** Google Analytics 4 e Meta Pixel, carregados só com ID configurado e cookies aceitos. */
export function Analytics({ googleAnalyticsId, metaPixelId }: { googleAnalyticsId: string; metaPixelId: string }) {
  const consent = useConsent();
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const gaId = GA_RE.test(googleAnalyticsId.trim()) ? googleAnalyticsId.trim().toUpperCase() : "";
  const pixelId = PIXEL_RE.test(metaPixelId.trim()) ? metaPixelId.trim() : "";
  const allowed = consent === "all";

  // O GA4 mede as trocas de página sozinho (medição otimizada); o Pixel precisa do aviso.
  useEffect(() => {
    if (!allowed || !pixelId) {
      lastPath.current = null;
      return;
    }
    // A primeira visualização já é contada pelo script de início.
    if (lastPath.current === null || lastPath.current === pathname) {
      lastPath.current = pathname;
      return;
    }
    lastPath.current = pathname;
    const fbq = (window as unknown as { fbq?: Fbq }).fbq;
    fbq?.("track", "PageView");
  }, [pathname, allowed, pixelId]);

  if (!allowed || (!gaId && !pixelId)) return null;

  return (
    <>
      {gaId && (
        <>
          <Script id="ga4-lib" src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {pixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
