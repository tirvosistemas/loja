"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Heart, Link2, MessageCircle, PackageX, Share2, ShoppingBag, Zap } from "lucide-react";
import { toast } from "sonner";
import { Price } from "@/components/ui/price";
import { Rating } from "@/components/ui/rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ui/countdown";
import { QuantityStepper } from "@/components/ui/quantity";
import { formatBRL } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { useLists } from "@/stores/wishlist";
import { usePurchase } from "./purchase-context";

// Caixa de compra: preço (por variação), escolha da variação, quantidade, botões de
// compra, favoritos e compartilhamento. No celular, uma barra fixa aparece quando os
// botões saem da tela.

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

function WishButton({ id, name }: { id: string; name: string }) {
  const mounted = useMounted();
  const wished = useLists((s) => s.wishlist.includes(id));
  const toggle = useLists((s) => s.toggleWish);
  const on = mounted && wished;
  return (
    <button
      type="button"
      onClick={() => {
        toggle(id);
        toast(on ? "Removido dos favoritos" : "Salvo nos favoritos", { description: name });
      }}
      aria-pressed={on}
      aria-label={on ? "Remover dos favoritos" : "Salvar nos favoritos"}
      className={cn(
        "grid size-11 place-items-center rounded-xl border transition-colors",
        on ? "border-primary/40 bg-primary-soft text-primary" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      <Heart className={cn("size-5", on && "fill-current")} />
    </button>
  );
}

function ShareButton({ name, slug }: { name: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const url = () => `${window.location.origin}/produto/${slug}`;

  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name, text: name, url: url() });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    setOpen((v) => !v);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Copie o endereço da barra do navegador.");
    }
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={share}
        aria-label="Compartilhar"
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid size-11 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
      >
        <Share2 className="size-5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-2xl"
          >
            <button type="button" role="menuitem" onClick={copy} className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-elevated">
              {copied ? <Check className="size-4 text-success" /> : <Link2 className="size-4 text-subtle" />}
              {copied ? "Link copiado" : "Copiar link"}
            </button>
            <a
              role="menuitem"
              href={`https://wa.me/?text=${encodeURIComponent(`${name}\n${url()}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-elevated"
            >
              <MessageCircle className="size-4 text-whatsapp" /> Enviar pelo WhatsApp
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VariantPicker() {
  const { product, variant, selectVariant, variantError, pickerRef } = usePurchase();
  if (!product.variants.length) return null;
  const label = product.variantLabel || "Opção";
  return (
    <div ref={pickerRef} className="scroll-mt-28">
      <p id="variant-label" className="mb-2.5 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">
          {label}
          {variant && <span className="font-normal text-muted-foreground">: {variant.name}</span>}
        </span>
      </p>
      <div role="radiogroup" aria-labelledby="variant-label" aria-invalid={variantError || undefined} className="flex flex-wrap gap-2">
        {product.variants.map((v) => {
          const on = variant?.id === v.id;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!v.inStock}
              onClick={() => selectVariant(v.id)}
              title={v.inStock ? undefined : "Esgotado"}
              className={cn(
                "relative flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors",
                on ? "border-primary bg-primary-soft text-foreground ring-1 ring-primary" : "border-border-strong text-foreground hover:border-foreground/40",
                !v.inStock && "cursor-not-allowed border-dashed border-border text-subtle line-through decoration-1 hover:border-border",
                variantError && !on && v.inStock && "border-danger/60",
              )}
            >
              {v.name}
              {!v.inStock && <span className="sr-only"> (esgotado)</span>}
            </button>
          );
        })}
      </div>
      <p role="alert" className={cn("text-sm text-danger", variantError ? "mt-2" : "sr-only")}>
        {variantError ? `Escolha ${label.toLowerCase()} para continuar.` : ""}
      </p>
    </div>
  );
}

function StickyBar({ visible }: { visible: boolean }) {
  const { product, price, needsVariant, available, addToCart } = usePurchase();
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: "120%" }}
          animate={{ y: 0 }}
          exit={{ y: "120%" }}
          transition={{ type: "spring", damping: 32, stiffness: 360 }}
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background/95 shadow-[0_-12px_32px_-16px_rgb(0_0_0/0.5)] backdrop-blur-md md:bottom-0 md:pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <div className="container-page flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">{product.name}</p>
              <p className="tabular flex items-baseline gap-2">
                <span className="text-lg font-semibold">
                  {price.fromPrice && <span className="mr-1 text-xs font-normal text-muted-foreground">a partir de</span>}
                  {formatBRL(price.priceCents)}
                </span>
                {price.compareAtCents && price.compareAtCents > price.priceCents ? (
                  <s className="text-xs text-subtle">{formatBRL(price.compareAtCents)}</s>
                ) : null}
              </p>
            </div>
            <Button size="lg" className="shrink-0 px-5" disabled={!available} onClick={() => addToCart()}>
              <ShoppingBag aria-hidden /> {!available ? "Esgotado" : needsVariant ? "Escolher" : "Adicionar"}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function BuyBox({ storeWhatsapp, productUrl }: { storeWhatsapp: string; productUrl: string }) {
  const { product, pay, price, variant, needsVariant, maxQuantity, available, quantity, setQuantity, addToCart } = usePurchase();
  const actions = useRef<HTMLDivElement>(null);
  const [sticky, setSticky] = useState(false);

  useEffect(() => {
    const el = actions.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSticky(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const lowStock = !needsVariant && maxQuantity > 0 && maxQuantity <= 3;
  const promo = product.promo;
  const sku = variant?.sku || product.sku;
  const meta = [sku && `Cód. ${sku}`, product.model && `Modelo ${product.model}`].filter(Boolean) as string[];
  const outOfStock = !available;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {product.brand &&
            (product.brandSlug ? (
              <Link href={`/marca/${product.brandSlug}`} className="font-mono text-xs uppercase tracking-[0.16em] text-subtle transition-colors hover:text-primary">
                {product.brand}
              </Link>
            ) : (
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-subtle">{product.brand}</p>
            ))}
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{product.name}</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <WishButton id={product.id} name={product.name} />
          <ShareButton name={product.name} slug={product.slug} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a href="#avaliacoes" className="group flex min-h-8 items-center gap-2 text-muted-foreground hover:text-foreground">
          {product.ratingCount > 0 ? (
            <>
              <Rating value={product.ratingAvg} />
              <span className="tabular font-medium text-foreground">{product.ratingAvg.toFixed(1).replace(".", ",")}</span>
              <span className="underline-offset-4 group-hover:underline">
                ({product.ratingCount} {product.ratingCount === 1 ? "avaliação" : "avaliações"})
              </span>
            </>
          ) : (
            <>
              <span aria-hidden>
                <Rating value={0} />
              </span>
              <span className="underline-offset-4 group-hover:underline">Seja o primeiro a avaliar</span>
            </>
          )}
        </a>
        {meta.length > 0 && <p className="font-mono text-xs text-subtle">{meta.join(" · ")}</p>}
      </div>

      {product.shortDescription && <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{product.shortDescription}</p>}

      <div className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
        {promo && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone={promo.flash ? "solid" : "accent"}>
              {promo.flash && <Zap aria-hidden />}
              {promo.badge || (promo.flash ? "Oferta relâmpago" : promo.name)}
            </Badge>
            {promo.flash && promo.endsAt && (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                termina em <Countdown endsAt={promo.endsAt} compact className="text-foreground" />
              </span>
            )}
          </div>
        )}

        <div>
          <Price
            size="lg"
            priceCents={price.priceCents}
            compareAtCents={price.compareAtCents}
            installments={price.installments}
            fromPrice={price.fromPrice}
            showPix={false}
          />
          {price.pixPriceCents < price.priceCents && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-success-soft px-2.5 py-1 text-sm text-success">
              <span className="tabular font-semibold">{formatBRL(price.pixPriceCents)}</span>
              <span>no Pix ({pay.pixDiscountPercent}% de desconto)</span>
            </p>
          )}
        </div>

        <VariantPicker />

        {lowStock && (
          <p className="flex items-center gap-2 text-sm font-medium text-warning">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-warning" aria-hidden />
            {maxQuantity === 1 ? "Última unidade em estoque" : `Últimas ${maxQuantity} unidades em estoque`}
          </p>
        )}

        {outOfStock ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2.5 rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-muted-foreground">
              <PackageX className="size-5 shrink-0 text-subtle" aria-hidden />
              {variant ? `${variant.name} está esgotado no momento.` : "Produto esgotado no momento."}
            </p>
            {storeWhatsapp && (
              <a
                href={whatsappLink(storeWhatsapp, `Olá! Tenho interesse no produto ${product.name}${variant ? ` (${variant.name})` : ""}: ${productUrl}. Vocês têm previsão de chegada?`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-whatsapp text-[15px] font-semibold text-[#04210f] transition hover:brightness-105"
              >
                <MessageCircle className="size-5" aria-hidden /> Avise-me quando chegar
              </a>
            )}
          </div>
        ) : (
          <div ref={actions} className="space-y-3">
            <div className="flex gap-3">
              <QuantityStepper value={quantity} onChange={setQuantity} min={1} max={Math.max(1, maxQuantity || 1)} className="h-13 shrink-0" />
              <Button size="lg" onClick={() => addToCart()} aria-label="Adicionar ao carrinho" className="min-w-0 flex-1 px-4 font-semibold">
                <ShoppingBag aria-hidden />
                <span className="sm:hidden">Adicionar</span>
                <span className="hidden sm:inline">Adicionar ao carrinho</span>
              </Button>
            </div>
            <Button size="lg" block variant="inverse" onClick={() => addToCart({ buyNow: true })} className="font-semibold">
              Comprar agora
            </Button>
          </div>
        )}

        {storeWhatsapp && !outOfStock && (
          <a
            href={whatsappLink(storeWhatsapp, `Olá! Tenho uma dúvida sobre o produto ${product.name}: ${productUrl}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-10 items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <MessageCircle className="size-4 text-whatsapp" aria-hidden /> Dúvidas? Fale com a gente no WhatsApp
          </a>
        )}
      </div>

      <StickyBar visible={sticky && !outOfStock} />
    </div>
  );
}
