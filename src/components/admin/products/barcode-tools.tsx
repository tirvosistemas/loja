"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { pluralize } from "@/lib/format";
import { barcodeLookupAction, type BarcodeLookupResult } from "@/app/admin/(panel)/produtos/tools-actions";
import type { ProductFormValues } from "./form-values";
import type { FormApi } from "./form-kit";

const MAX_PHOTOS = 12;

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

function getDetector(): DetectorCtor | null {
  return typeof window !== "undefined" && "BarcodeDetector" in window ? ((window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector ?? null) : null;
}

/** Lê o código de barras pela câmera (celular). Só aparece onde o navegador tem BarcodeDetector. */
function CameraScan({ onCode }: { onCode: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [supported, setSupported] = useState(false);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  useEffect(() => setSupported(!!getDetector() && !!navigator.mediaDevices?.getUserMedia), []);

  useEffect(() => {
    if (!open) return;
    const Ctor = getDetector();
    if (!Ctor) return;
    let stream: MediaStream | null = null;
    let stop = false;
    let timer = 0;
    const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "itf"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        // Fechou antes da câmera abrir: a limpeza já rodou, então desliga aqui.
        if (stop || !video.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stop || !video.current) return;
          try {
            const found = await detector.detect(video.current);
            const code = found.map((f) => f.rawValue.replace(/\D/g, "")).find((c) => c.length >= 8);
            if (code) {
              onCodeRef.current(code);
              setOpen(false);
              return;
            }
          } catch {
            /* quadro sem imagem ainda */
          }
          timer = window.setTimeout(tick, 250);
        };
        tick();
      } catch {
        if (!stop) setError("Não consegui abrir a câmera. Permita o acesso à câmera no navegador.");
      }
    })();
    return () => {
      stop = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  if (!supported) return null;
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label="Ler código de barras com a câmera"
        title="Ler com a câmera"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Camera aria-hidden />
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Aponte para o código de barras" size="sm">
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <div className="space-y-2">
            <video ref={video} muted playsInline className="aspect-[4/3] w-full rounded-xl bg-black object-cover" />
            <p className="text-center text-[13px] text-muted-foreground">Segure firme, com boa luz. Lê sozinho.</p>
          </div>
        )}
      </Dialog>
    </>
  );
}

type Found = BarcodeLookupResult["result"];
type Photo = { url: string; alt: string; width: number; height: number };

/** O que a base trouxe vira mudança no estado mais recente: só campos vazios; as fotos entram depois das que já estão. */
export function mergeBarcode(cur: ProductFormValues, code: string, b: Found, brandId: string | null, photos: Photo[]): Partial<ProductFormValues> {
  const patch: Partial<ProductFormValues> = { ean: b.ean || code };
  if (!cur.name.trim() && b.name) patch.name = b.name.slice(0, 160);
  if (!cur.brandId && brandId) patch.brandId = brandId;
  if (!cur.model.trim() && b.model) patch.model = b.model.slice(0, 80);
  if (!cur.color.trim() && b.color) patch.color = b.color.slice(0, 60);
  if (!cur.description.trim() && b.description) patch.description = b.description.slice(0, 20000);
  if (cur.weightGrams == null && b.weightGrams) patch.weightGrams = b.weightGrams;
  if (cur.widthCm == null && b.widthCm) patch.widthCm = b.widthCm;
  if (cur.heightCm == null && b.heightCm) patch.heightCm = b.heightCm;
  if (cur.depthCm == null && b.depthCm) patch.depthCm = b.depthCm;
  if (photos.length) patch.images = [...cur.images, ...photos].slice(0, MAX_PHOTOS);
  return patch;
}

/** Resumo do que veio da base (não depende do que já estava preenchido no formulário). */
export function barcodeSummary(b: Found, brand: BarcodeLookupResult["brand"], photos: number): string {
  const got = [
    b.name && "nome",
    brand?.id && "marca",
    b.model && "modelo",
    b.color && "cor",
    b.description && "descrição",
    (b.weightGrams || b.widthCm || b.heightCm || b.depthCm) && "medidas",
    photos > 0 && pluralize(photos, "foto", "fotos"),
  ].filter((x): x is string => !!x);
  const head = `Encontrado no ${b.source}: ${b.name ?? "produto"}.`;
  if (!got.length) return `${head} A base não trouxe outros dados.`;
  const list = got.length > 1 ? `${got.slice(0, -1).join(", ")} e ${got[got.length - 1]}` : got[0];
  return `${head} Veio ${list}. Só os campos vazios foram preenchidos.`;
}

/** Botões ao lado do campo EAN: buscar na base e ler pela câmera. */
export function BarcodeTools({
  form,
  productId,
  onBrandFound,
  onExisting,
}: {
  form: FormApi;
  productId: string | null;
  onBrandFound: (b: { id: string | null; name: string }) => void;
  onExisting: (p: { id: string; name: string } | null) => void;
}) {
  const [pending, start] = useTransition();

  const lookup = (raw: string) =>
    start(async () => {
      const code = raw.replace(/\D/g, "");
      if (code.length < 8) {
        toast.error("Digite o código de barras (8 a 14 números).");
        return;
      }
      onExisting(null);
      const v = form.values;
      let r: Awaited<ReturnType<typeof barcodeLookupAction>>;
      try {
        r = await barcodeLookupAction(code, Math.min(3, MAX_PHOTOS - v.images.length), productId);
      } catch {
        toast.error("Falha de conexão. Tente de novo.");
        return;
      }
      if (!r.ok || !r.data) {
        toast.error(r.ok ? "Nada encontrado." : r.error);
        return;
      }
      const { result: b, brand, existing, images, warnings } = r.data;
      if (brand) onBrandFound(brand);
      onExisting(existing);
      const photos = images.map((im) => ({ url: im.url, alt: "", width: im.width, height: im.height }));
      // `form.values` é de quando clicou em Buscar; junta no estado atual para não perder o que mudou durante a busca.
      form.update((cur) => mergeBarcode(cur, code, b, brand?.id ?? null, photos));
      warnings.forEach((w) => toast.warning(w));
      if (existing) toast.warning(`Este código já está cadastrado em ${existing.name}. Veja o link abaixo do campo EAN.`);
      toast.success(barcodeSummary(b, brand, photos.length));
      if (brand && !brand.id && !v.brandId) toast.info(`A marca ${brand.name} ainda não está cadastrada. Crie com um clique no campo Marca.`);
    });

  return (
    <div className="flex gap-2">
      <Button type="button" variant="secondary" loading={pending} onClick={() => lookup(form.values.ean)} title="Buscar nome, marca, foto e medidas pelo código">
        <ScanBarcode aria-hidden /> Buscar
      </Button>
      <CameraScan
        onCode={(code) => {
          form.set("ean", code.slice(0, 14));
          lookup(code);
        }}
      />
    </div>
  );
}
