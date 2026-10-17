import { ImageOff } from "lucide-react";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

/** Miniatura da foto do produto sobre o fundo claro (as fotos têm fundo branco). */
export function ProductThumb({ src, alt = "", className }: { src: string | null; alt?: string; className?: string }) {
  return (
    <span className={cn("grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-well", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl(src, "sm")} alt={alt} loading="lazy" decoding="async" className="size-full object-contain p-1" />
      ) : (
        <ImageOff className="size-4 text-zinc-400" aria-hidden />
      )}
    </span>
  );
}
