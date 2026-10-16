import { cn } from "@/lib/utils";

// Logo Tirvo em vetor (mesmos desenhos do kit da marca). A cor do nome e da mira segue
// o texto (currentColor), então funciona no tema escuro e no claro. O ponto é sempre laranja.

const CORNERS = "M6.5 35.5V6.5H35.5V13.5H13.5V35.5Z M93.5 35.5V6.5H64.5V13.5H86.5V35.5Z M6.5 64.5V93.5H35.5V86.5H13.5V64.5Z M93.5 64.5V93.5H64.5V86.5H86.5V64.5Z";
const TICKS = "M48.5 22h3v12h-3Z M48.5 66h3v12h-3Z M22 48.5h12v3h-12Z M66 48.5h12v3h-12Z";
export const WORDMARK =
  "M 285.5 0 Q 204.4 0 166.3 -37.6 Q 128.2 -75.1 128.2 -156.2 V -660.2 H 265 V -170.6 Q 265 -132.7 281.2 -118.5 Q 297.5 -104.2 331 -104.2 H 406 V 0ZM 43.5 -430.6 V -534.8 H 406 V -430.6Z M 460.5 0 V -534.8 H 597.3 V 0ZM 458 -603.9 V -720.1 H 599.8 V -603.9Z M 710.5 0 V -534.8 H 839.2 L 844.2 -383.5 L 833.3 -386 Q 845.7 -464.6 878.9 -499.7 Q 912.2 -534.8 970.1 -534.8 H 1019.2 V -419.3 H 969.7 Q 928.2 -419.3 901.3 -407.7 Q 874.3 -396 860.8 -371.1 Q 847.3 -346.2 847.3 -305.1 V 0Z M 1220.4 0 1025 -534.8 H 1168.9 L 1301.3 -137.8 L 1433.2 -534.8 H 1577 L 1381.2 0Z M 1844.8 12 Q 1764.6 12 1704.5 -22.5 Q 1644.5 -57 1611.4 -119.9 Q 1578.2 -182.9 1578.2 -267.4 Q 1578.2 -352.4 1611.4 -414.9 Q 1644.5 -477.4 1704.5 -512.1 Q 1764.6 -546.8 1844.8 -546.8 Q 1925 -546.8 1984.7 -512.1 Q 2044.5 -477.4 2077.6 -414.9 Q 2110.8 -352.4 2110.8 -267.4 Q 2110.8 -182.9 2077.6 -119.9 Q 2044.5 -57 1984.7 -22.5 Q 1925 12 1844.8 12ZM 1844.8 -96.3 Q 1904.3 -96.3 1936.9 -141.4 Q 1969.5 -186.4 1969.5 -267.4 Q 1969.5 -347.9 1936.9 -393.2 Q 1904.3 -438.5 1844.8 -438.5 Q 1785.2 -438.5 1752.4 -393.2 Q 1719.5 -347.9 1719.5 -267.4 Q 1719.5 -186.4 1752.4 -141.4 Q 1785.2 -96.3 1844.8 -96.3Z";

export function LogoMarkPaths({ glow = true }: { glow?: boolean }) {
  return (
    <>
      <path fill="currentColor" d={CORNERS} />
      <path fill="currentColor" fillOpacity={0.45} d={TICKS} />
      {glow && <circle cx="50" cy="50" r="10" fill="#ff5500" opacity={0.55} style={{ filter: "blur(3px)" }} />}
      <circle cx="50" cy="50" r="10" fill="#ff5500" />
    </>
  );
}

/** Logo horizontal (mira + nome). */
export function Logo({ className, title = "Tirvo" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="-46.98 -793.48 3365.74 876.96" className={cn("h-7 w-auto", className)} role="img" aria-label={title}>
      <g transform="translate(-58.5 -805) scale(9)">
        <LogoMarkPaths />
      </g>
      <path fill="currentColor" transform="translate(1161.02 0)" d={WORDMARK} />
    </svg>
  );
}

/** Só a mira com o ponto laranja. */
export function LogoMark({ className, title = "Tirvo" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="3 3 94 94" className={cn("size-8", className)} role="img" aria-label={title}>
      <LogoMarkPaths />
    </svg>
  );
}

/** Logo com a frase (arquivo do kit; troca a versão conforme o tema). */
export function LogoWithTagline({ className }: { className?: string }) {
  return (
    <span className={cn("block", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/tirvo-logo-com-frase-para-fundo-escuro.svg" alt="Tirvo. Se algo pode ser melhorado, ainda não está pronto." className="hidden h-full w-auto dark:block" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/tirvo-logo-com-frase-para-fundo-claro.svg" alt="Tirvo. Se algo pode ser melhorado, ainda não está pronto." className="block h-full w-auto dark:hidden" />
    </span>
  );
}

/** O Next (mascote) apresentando a marca. Para páginas de erro e estados vazios. */
export function NextMascot({ className }: { className?: string }) {
  return (
    <span className={cn("block", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/tirvo-next-em-cima-para-fundo-escuro.svg" alt="Next, o mascote da Tirvo" className="hidden h-full w-auto dark:block" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/tirvo-next-em-cima-para-fundo-claro.svg" alt="Next, o mascote da Tirvo" className="block h-full w-auto dark:hidden" />
    </span>
  );
}
