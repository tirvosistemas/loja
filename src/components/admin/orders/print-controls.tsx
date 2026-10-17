"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

/** Barra da tela de impressão (some no papel). Com ?auto=1 abre a impressão sozinha. */
export function PrintControls({ backHref, auto }: { backHref: string; auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <div className="print-hide sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
      <Link href={backHref} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
        <ArrowLeft className="size-4" aria-hidden /> Voltar ao pedido
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#ff5500] px-4 text-sm font-semibold text-zinc-950 hover:bg-[#ff6a1f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5500]"
      >
        <Printer className="size-4" aria-hidden /> Imprimir
      </button>
    </div>
  );
}
