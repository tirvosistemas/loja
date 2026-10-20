"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { pluralize } from "@/lib/format";
import { barcodeLookupAction } from "@/app/admin/(panel)/produtos/tools-actions";
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
        if (stop || !video.current) return;
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
        setError("Não consegui abrir a câmera. Permita o acesso à câmera no navegador.");
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

/** Botões ao lado do campo EAN: buscar na base e ler pela câmera. */
export function BarcodeTools({ form, onBrandCreated }: { form: FormApi; onBrandCreated: (b: { id: string; name: string }) => void }) {
  const [pending, start] = useTransition();

  const lookup = (raw: string) =>
    start(async () => {
      const code = raw.replace(/\D/g, "");
      if (code.length < 8) {
        toast.error("Digite o código de barras (8 a 14 números).");
        return;
      }
      const v = form.values;
      let r: Awaited<ReturnType<typeof barcodeLookupAction>>;
      try {
        r = await barcodeLookupAction(code, Math.min(3, MAX_PHOTOS - v.images.length));
      } catch {
        toast.error("Falha de conexão. Tente de novo.");
        return;
      }
      if (!r.ok || !r.data) {
        toast.error(r.ok ? "Nada encontrado." : r.error);
        return;
      }
      const { result: b, brand, images, warnings } = r.data;
      if (brand) onBrandCreated(brand);
      const cur = form.values;
      const patch: Partial<ProductFormValues> = { ean: b.ean };
      if (!cur.name.trim() && b.name) patch.name = b.name.slice(0, 160);
      if (!cur.brandId && brand) patch.brandId = brand.id;
      if (!cur.model.trim() && b.model) patch.model = b.model.slice(0, 80);
      if (!cur.color.trim() && b.color) patch.color = b.color.slice(0, 60);
      if (!cur.description.trim() && b.description) patch.description = b.description.slice(0, 20000);
      if (cur.weightGrams == null && b.weightGrams) patch.weightGrams = b.weightGrams;
      if (cur.widthCm == null && b.widthCm) patch.widthCm = b.widthCm;
      if (cur.heightCm == null && b.heightCm) patch.heightCm = b.heightCm;
      if (cur.depthCm == null && b.depthCm) patch.depthCm = b.depthCm;
      if (images.length) patch.images = [...cur.images, ...images.map((im) => ({ url: im.url, alt: "", width: im.width, height: im.height }))].slice(0, MAX_PHOTOS);
      form.patch(patch);
      warnings.forEach((w) => toast.warning(w));
      const filled = Object.keys(patch).length - 1;
      toast.success(
        filled
          ? `Encontrado no ${b.source}: ${b.name ?? "produto"}. ${pluralize(filled, "campo preenchido", "campos preenchidos")}${images.length ? ` e ${pluralize(images.length, "foto adicionada", "fotos adicionadas")}` : ""}.`
          : `Encontrado no ${b.source}, mas os campos já estavam preenchidos.`,
      );
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
