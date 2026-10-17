import type { SVGProps } from "react";

// Ícones de redes sociais em traço (a biblioteca de ícones não inclui marcas).

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

function Base({ children, className, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

export function WhatsAppIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </Base>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <path d="M17.5 6.5h.01" />
    </Base>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </Base>
  );
}

export function TikTokIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M21 7.92v4.03A9.95 9.95 0 0 1 16 10v4.5a6.5 6.5 0 1 1-8-6.33v4.33a2.5 2.5 0 1 0 4 2V3h4.08A6 6 0 0 0 21 7.92z" />
    </Base>
  );
}

export function YouTubeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <path d="M9.75 15.02l5.75-3.27-5.75-3.27v6.54z" />
    </Base>
  );
}

/** Normaliza o que foi digitado no painel ("@tirvo", "tirvo" ou URL) em um link. */
export function socialUrl(network: "instagram" | "facebook" | "tiktok" | "youtube", value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").replace(/^\/+/, "");
  if (!handle) return null;
  const bases = {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tiktok: "https://www.tiktok.com/@",
    youtube: "https://youtube.com/@",
  } as const;
  if (/^(www\.)?(instagram|facebook|tiktok|youtube)\.com\//i.test(handle)) return `https://${handle}`;
  return `${bases[network]}${encodeURIComponent(handle)}`;
}
