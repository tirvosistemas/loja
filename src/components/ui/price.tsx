import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Bloco de preço: "de" riscado, preço, desconto, Pix e parcelas. */
export function Price({
  priceCents,
  compareAtCents,
  pixPriceCents,
  installments,
  fromPrice,
  size = "md",
  className,
  showPix = true,
}: {
  priceCents: number;
  compareAtCents?: number | null;
  pixPriceCents?: number | null;
  installments?: { count: number; valueCents: number } | null;
  fromPrice?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  showPix?: boolean;
}) {
  const main = { sm: "text-base", md: "text-xl", lg: "text-3xl sm:text-4xl" }[size];
  return (
    <div className={cn("tabular min-w-0", className)}>
      {compareAtCents && compareAtCents > priceCents ? (
        <p className="text-[13px] text-subtle">
          de <s>{formatBRL(compareAtCents)}</s>
        </p>
      ) : null}
      <p className={cn("font-semibold tracking-tight text-foreground", main)}>
        {fromPrice && <span className="mr-1 text-[0.6em] font-normal text-muted-foreground">a partir de</span>}
        {formatBRL(priceCents)}
      </p>
      {installments && (
        <p className="text-[13px] text-muted-foreground">
          ou {installments.count}x de {formatBRL(installments.valueCents)} sem juros
        </p>
      )}
      {showPix && pixPriceCents != null && pixPriceCents < priceCents && (
        <p className="text-[13px] font-medium text-success">{formatBRL(pixPriceCents)} no Pix</p>
      )}
    </div>
  );
}
