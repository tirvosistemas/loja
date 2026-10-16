import { imageSrcSet, imageUrl, type ImageSize } from "@/lib/images";
import { cn } from "@/lib/utils";

// <img> com srcset dos 3 tamanhos gerados no upload. Funciona também com URLs comuns.
export function SmartImage({
  src,
  alt,
  size = "md",
  sizes = "(min-width: 1024px) 25vw, 50vw",
  className,
  priority,
  ...rest
}: {
  src: string | null | undefined;
  alt: string;
  size?: ImageSize;
  sizes?: string;
  className?: string;
  priority?: boolean;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "alt">) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl(src, size)}
      srcSet={imageSrcSet(src)}
      sizes={imageSrcSet(src) ? sizes : undefined}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn("block", className)}
      {...rest}
    />
  );
}
