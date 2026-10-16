"use client";

import { useRef, useState } from "react";
import { GripVertical, ImagePlus, Loader2, Star, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

export type UploadFolder = "products" | "banners" | "categories" | "brands" | "pages" | "push" | "misc";
export type GalleryImage = { url: string; alt?: string | null };

async function uploadFile(file: File, folder: UploadFolder): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const j = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
  if (!res.ok || !j.key) throw new Error(j.error || "Falha no envio da imagem.");
  return j.key;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif";

/** Uma imagem só (banner, categoria, marca). Clique ou arraste para enviar. */
export function ImageUpload({
  value,
  onChange,
  folder,
  aspect = "aspect-video",
  label = "Enviar imagem",
  hint = "JPG, PNG ou WebP até 8 MB",
  className,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: UploadFolder;
  aspect?: string;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const handle = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      onChange(await uploadFile(f, folder));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={className}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files);
        }}
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-dashed bg-elevated/40 transition-colors",
          aspect,
          drag ? "border-primary bg-primary-soft" : "border-border-strong hover:border-primary/60",
        )}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(value, "md")} alt="" className="size-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              <button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-900">
                Trocar
              </button>
              <button type="button" onClick={() => onChange(null)} className="rounded-lg bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
                Remover
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center">
            <UploadCloud className="size-7 text-subtle" />
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-subtle">{hint}</span>
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-background/70">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => handle(e.target.files)} />
    </div>
  );
}

/** Galeria de fotos do produto: várias imagens, arrastar para ordenar, a primeira é a capa. */
export function ImageGallery({
  value,
  onChange,
  folder = "products",
  max = 12,
}: {
  value: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  folder?: UploadFolder;
  max?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);

  const handleFiles = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    const room = Math.max(0, max - value.length);
    const toSend = list.slice(0, room);
    if (list.length > room) toast.warning(`Máximo de ${max} fotos por produto.`);
    setUploading((n) => n + toSend.length);
    const added: GalleryImage[] = [];
    for (const f of toSend) {
      try {
        added.push({ url: await uploadFile(f, folder), alt: "" });
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (added.length) onChange([...value, ...added]);
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  return (
    <div
      onDragOver={(e) => {
        if (dragIndex === null) {
          e.preventDefault();
          setDropActive(true);
        }
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(e) => {
        if (dragIndex !== null) return;
        e.preventDefault();
        setDropActive(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn("rounded-2xl border border-dashed p-3 transition-colors", dropActive ? "border-primary bg-primary-soft" : "border-border-strong")}
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((img, i) => (
          <li
            key={img.url}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) move(dragIndex, i);
              setDragIndex(null);
            }}
            className={cn("group relative overflow-hidden rounded-xl border bg-well", i === 0 ? "border-primary" : "border-border", dragIndex === i && "opacity-40")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(img.url, "sm")} alt={img.alt ?? ""} className="aspect-square w-full object-contain p-2" />
            {i === 0 && (
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                <Star className="size-3" /> Capa
              </span>
            )}
            <span className="absolute right-2 top-2 hidden cursor-grab rounded-md bg-black/60 p-1 text-white sm:block" title="Arraste para ordenar">
              <GripVertical className="size-3.5" />
            </span>
            <div className="flex items-center gap-1 border-t border-border bg-card p-1.5">
              <input
                value={img.alt ?? ""}
                onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, alt: e.target.value } : v)))}
                placeholder="Descrição da foto"
                aria-label="Descrição da foto"
                className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-xs outline-none placeholder:text-subtle focus:bg-elevated"
              />
              {i > 0 && (
                <button type="button" onClick={() => move(i, 0)} title="Usar como capa" aria-label="Usar como capa" className="grid size-7 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-primary">
                  <Star className="size-3.5" />
                </button>
              )}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} title="Remover" aria-label="Remover foto" className="grid size-7 place-items-center rounded-md text-subtle hover:bg-danger-soft hover:text-danger">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </li>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <li key={`up${i}`} className="grid aspect-square place-items-center rounded-xl border border-border bg-elevated">
            <Loader2 className="size-6 animate-spin text-primary" />
          </li>
        ))}
        {value.length + uploading < max && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-elevated/40 text-center text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
            >
              <ImagePlus className="size-6" />
              <span className="px-2">Adicionar fotos</span>
              <span className="px-2 text-[11px] text-subtle">ou arraste aqui</span>
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
