"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Download,
  FileArchive,
  FileSpreadsheet,
  FolderOpen,
  HardDrive,
  Loader2,
  Play,
  Sparkles,
  Square,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { AdminTable } from "@/components/admin/page-header";
import { Callout } from "@/components/admin/settings/form-kit";
import { uploadFile } from "@/components/admin/image-uploader";
import { formatBRL, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DADOS_TEMPLATE, isInfoPhoto, MAX_IMPORT_PHOTOS, pickPhotos } from "@/lib/importer/dados";
import { groupByProductFolder } from "@/lib/importer/folders";
import { parseCsv, parseXlsx, sheetToItems, SHEET_TEMPLATE } from "@/lib/importer/sheet";
import type { ImportPreview } from "@/lib/importer/server";
import {
  type ImportOptions,
  checkUploaded,
  importDrive,
  importFromUrls,
  importUploaded,
  listDriveFolder,
  previewDrive,
  previewItems,
  type ImportResult,
} from "@/app/admin/(panel)/produtos/importar/actions";
import { downloadText, fromDrop, fromFileList, fromZip, readText, shrinkIfNeeded, type PathFile } from "./import-files";

type Source = "pasta" | "zip" | "drive" | "planilha";

type Payload =
  | { kind: "files"; folder: string; dadosText: string | null; photos: File[]; aiFiles: File[] }
  | { kind: "sheet"; folder: string; dadosText: string; photoUrls: string[] }
  | { kind: "drive"; id: string; name: string };

type RowState = "idle" | "running" | "done" | "failed" | "skipped";
type Row = ImportPreview & { selected: boolean; state: RowState; message?: string; productId?: string; resultWarnings?: string[] };

const SOURCES: { id: Source; icon: typeof FolderOpen; title: string; text: string }[] = [
  { id: "pasta", icon: FolderOpen, title: "Pasta do computador", text: "Uma subpasta por produto, com fotos e dados.txt." },
  { id: "zip", icon: FileArchive, title: "Arquivo .zip", text: "A mesma pasta compactada (ex.: baixada do Drive)." },
  { id: "drive", icon: HardDrive, title: "Google Drive", text: "Lê a pasta direto do Drive, sem baixar." },
  { id: "planilha", icon: FileSpreadsheet, title: "Planilha", text: "Excel ou CSV: sua planilha ou a exportada do Mercado Livre / Shopee." },
];

const isImportable = (r: Row) => (r.status === "ok" || r.status === "warning") && r.state !== "done";

function chunk<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>, stopped: () => boolean) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length && !stopped()) await fn(items[next++]);
    }),
  );
}

/** aiReady: nome do provedor de IA configurado, ou null. */
export function ProductImporter({ driveReady, aiReady, photoStandard }: { driveReady: boolean; aiReady: string | null; photoStandard: boolean }) {
  const [source, setSource] = useState<Source>("pasta");
  const [publish, setPublish] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [barcode, setBarcode] = useState(true);
  const [standardize, setStandardize] = useState(photoStandard);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<null | "reading" | "importing">(null);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [driveLink, setDriveLink] = useState("");
  const [dragging, setDragging] = useState(false);
  const payloads = useRef(new Map<string, Payload>());
  const stopRef = useRef(false);
  const folderInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
  }, []);

  // Avisa antes de sair da página no meio da importação.
  useEffect(() => {
    if (busy !== "importing") return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [busy]);

  const patch = (key: string, p: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const counts = useMemo(() => {
    const c = { ok: 0, warning: 0, error: 0, duplicate: 0, done: 0, failed: 0, selected: 0 };
    for (const r of rows) {
      c[r.status]++;
      if (r.state === "done") c.done++;
      if (r.state === "failed") c.failed++;
      if (r.selected && isImportable(r)) c.selected++;
    }
    return c;
  }, [rows]);

  function reset() {
    setRows([]);
    payloads.current.clear();
    setProgress(null);
  }

  async function runPreview(batches: (() => Promise<{ ok: true; data?: ImportPreview[] } | { ok: false; error: string }>)[], total: number, label: string) {
    const all: Row[] = [];
    setProgress({ label, done: 0, total });
    for (const b of batches) {
      const r = await b();
      if (!r.ok) throw new Error(r.error);
      all.push(...(r.data ?? []).map((p) => ({ ...p, selected: p.status === "ok" || p.status === "warning", state: "idle" as RowState })));
      setRows([...all]);
      setProgress({ label, done: all.length, total });
    }
    setProgress(null);
    if (!all.length) toast.error("Nenhum produto encontrado.");
  }

  async function read(task: () => Promise<void>) {
    reset();
    setBusy("reading");
    try {
      await task();
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível ler os arquivos.");
      setProgress(null);
    } finally {
      setBusy(null);
    }
  }

  // ─────────────── Leitura das origens

  async function localTask(files: PathFile[]) {
    {
      const groups = groupByProductFolder(files);
      if (!groups.length) throw new Error("Não achei pastas de produto (fotos ou dados.txt) no que foi escolhido.");
      const items = await Promise.all(
        groups.map(async (g) => {
          const dadosText = g.dados ? await readText(g.dados) : null;
          const names = g.photos.map((p) => p.name);
          const byName = new Map(g.photos.map((p) => [p.name, p.file]));
          const picked = pickPhotos(names);
          const key = g.dir || g.folder;
          payloads.current.set(key, {
            kind: "files",
            folder: g.folder,
            dadosText,
            photos: picked.photos.map((n) => byName.get(n)!),
            aiFiles: [...g.photos.filter((p) => isInfoPhoto(p.name)).map((p) => p.file), ...g.info.map((p) => p.file)],
          });
          return { key, folder: g.folder, dadosText, photoNames: names, aiPhotos: g.info.length };
        }),
      );
      await runPreview(chunk(items, 25).map((b) => () => previewItems(b)), items.length, "Conferindo produtos");
    }
  }

  const loadLocal = (files: PathFile[]) => read(() => localTask(files));

  const loadZip = (file: File) =>
    read(async () => {
      setProgress({ label: "Abrindo o .zip", done: 0, total: 100 });
      const files = await fromZip(file, (r, t) => setProgress({ label: "Abrindo o .zip", done: Math.round((r / t) * 100), total: 100 }));
      await localTask(files);
    });

  const loadSheet = (file: File) =>
    read(async () => {
      const name = file.name.toLowerCase();
      let rowsData;
      if (name.endsWith(".xlsx")) rowsData = parseXlsx(new Uint8Array(await file.arrayBuffer()));
      else if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".tsv")) rowsData = parseCsv(await readText(file));
      else throw new Error("Use planilha .xlsx ou .csv. No Excel: Arquivo → Salvar como → Pasta de Trabalho do Excel (.xlsx).");
      const { items } = sheetToItems(rowsData);
      if (!items.length) throw new Error("A planilha não tem produtos abaixo da linha de títulos.");
      for (const it of items) payloads.current.set(it.key, { kind: "sheet", folder: it.folder, dadosText: it.dadosText, photoUrls: it.photoUrls });
      await runPreview(chunk(items, 25).map((b) => () => previewItems(b)), items.length, "Conferindo linhas");
    });

  const loadDrive = () =>
    read(async () => {
      setProgress({ label: "Abrindo a pasta do Drive", done: 0, total: 1 });
      const r = await listDriveFolder(driveLink);
      if (!r.ok) throw new Error(r.error);
      const folders = r.data!.folders;
      for (const f of folders) payloads.current.set(f.id, { kind: "drive", id: f.id, name: f.name });
      await runPreview(chunk(folders, 10).map((b) => () => previewDrive(b)), folders.length, `Lendo “${r.data!.root.name}”`);
    });

  // ─────────────── Importação

  async function importOne(row: Row, opts: ImportOptions) {
    const p = payloads.current.get(row.key);
    if (!p) return;
    patch(row.key, { state: "running", message: undefined });
    let r: ImportResult;
    const clientWarnings: string[] = [];
    try {
      if (p.kind === "drive") r = await importDrive({ id: p.id, name: p.name }, opts);
      else if (p.kind === "sheet") r = await importFromUrls({ folder: p.folder, dadosText: p.dadosText, photoUrls: p.photoUrls }, opts);
      else {
        const check = await checkUploaded(p.folder, p.dadosText);
        if (!check.ok) r = check;
        else {
          const images: ({ url: string; width: number | null; height: number | null } | null)[] = new Array(p.photos.length).fill(null);
          let i = 0;
          await Promise.all(
            Array.from({ length: 3 }, async () => {
              while (i < p.photos.length) {
                const idx = i++;
                try {
                  const up = await uploadFile(await shrinkIfNeeded(p.photos[idx]), "products");
                  images[idx] = { url: up.key, width: up.width, height: up.height };
                } catch (e) {
                  clientWarnings.push(`Foto ${p.photos[idx].name} não foi enviada: ${(e as Error).message}`);
                }
              }
            }),
          );
          const aiImages: string[] = [];
          if (opts.useAi) {
            for (const f of p.aiFiles.slice(0, 6)) {
              try {
                aiImages.push((await uploadFile(await shrinkIfNeeded(f), "misc")).key);
              } catch {
                clientWarnings.push(`Foto de apoio ${f.name} não foi enviada.`);
              }
            }
          }
          r = await importUploaded({ folder: p.folder, dadosText: p.dadosText, images: images.filter((x) => !!x), aiImages }, opts);
        }
      }
    } catch {
      r = { ok: false, error: "Falha de conexão. Tente de novo." };
    }
    if (r.ok) patch(row.key, { state: "done", productId: r.id, name: r.name, resultWarnings: [...clientWarnings, ...r.warnings].filter((w) => !row.warnings.includes(w)) });
    else if (r.duplicate) patch(row.key, { state: "skipped", status: "duplicate", duplicate: r.duplicate, message: r.error });
    else patch(row.key, { state: "failed", message: r.error });
  }

  async function startImport() {
    const queue = rows.filter((r) => r.selected && isImportable(r));
    if (!queue.length) return;
    stopRef.current = false;
    setBusy("importing");
    const opts: ImportOptions = { publish, useAi: useAi && !!aiReady, barcode, standardize: standardize && photoStandard };
    let done = 0;
    setProgress({ label: "Importando", done, total: queue.length });
    await pool(
      queue,
      source === "pasta" || source === "zip" ? 1 : 2,
      async (row) => {
        await importOne(row, opts);
        done++;
        setProgress({ label: "Importando", done, total: queue.length });
      },
      () => stopRef.current,
    );
    setBusy(null);
    setProgress(null);
    if (stopRef.current) toast.info(`Importação parada. ${pluralize(done, "produto processado", "produtos processados")}.`);
    else toast.success("Importação concluída.");
  }

  // ─────────────── Tela

  const disabled = busy !== null;
  const allSelected = rows.some(isImportable) && rows.filter(isImportable).every((r) => r.selected);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <fieldset disabled={disabled}>
          <legend className="mb-3 text-sm font-medium">1. De onde vêm os produtos?</legend>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {SOURCES.map((s) => {
              const active = source === s.id;
              return (
                <label
                  key={s.id}
                  className={cn(
                    "relative flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors",
                    active ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong",
                  )}
                >
                  <input type="radio" name="source" value={s.id} checked={active} onChange={() => setSource(s.id)} className="sr-only" />
                  <s.icon className={cn("mt-0.5 size-5 shrink-0", active ? "text-primary" : "text-subtle")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{s.title}</span>
                    <span className="mt-0.5 block text-[13px] text-subtle">{s.text}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-5">
          <p className="mb-3 text-sm font-medium">2. Escolha os arquivos</p>
          {source === "drive" ? (
            driveReady ? (
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (driveLink.trim()) loadDrive();
                }}
              >
                <Input
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/…"
                  aria-label="Link da pasta do Google Drive"
                  className="font-mono text-sm"
                  disabled={disabled}
                />
                <Button type="submit" loading={busy === "reading"} disabled={disabled || !driveLink.trim()}>
                  <HardDrive aria-hidden /> Ler pasta
                </Button>
              </form>
            ) : (
              <Callout tone="warning" title="Falta a chave do Google Drive">
                Cadastre em{" "}
                <Link href="/admin/configuracoes?aba=catalogo" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Configurações → Ferramentas do catálogo
                </Link>
                . Enquanto isso, baixe a pasta do Drive (vem em .zip) e use a opção “Arquivo .zip”.
              </Callout>
            )
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!disabled) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setDragging(false);
                if (disabled) return;
                const file = e.dataTransfer.files[0];
                if (source === "pasta") loadLocal(await fromDrop(e.dataTransfer.items));
                else if (file && source === "zip") loadZip(file);
                else if (file) loadSheet(file);
              }}
              className={cn(
                "flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors",
                dragging ? "border-primary bg-primary-soft" : "border-border-strong bg-elevated/40",
              )}
            >
              <p className="text-sm text-muted-foreground">
                {source === "pasta" && "Arraste a pasta “Produtos” para cá ou escolha no computador."}
                {source === "zip" && "Arraste o arquivo .zip para cá ou escolha no computador."}
                {source === "planilha" && "Arraste a planilha (.xlsx ou .csv) para cá ou escolha no computador."}
              </p>
              <Button
                type="button"
                variant="secondary"
                loading={busy === "reading"}
                disabled={disabled}
                onClick={() => (source === "pasta" ? folderInput.current : fileInput.current)?.click()}
              >
                {source === "pasta" ? <FolderOpen aria-hidden /> : source === "zip" ? <FileArchive aria-hidden /> : <FileSpreadsheet aria-hidden />}
                {source === "pasta" ? "Escolher pasta" : source === "zip" ? "Escolher .zip" : "Escolher planilha"}
              </Button>
            </div>
          )}
          <input
            ref={folderInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) loadLocal(fromFileList(e.target.files));
              e.target.value = "";
            }}
          />
          <input
            ref={fileInput}
            type="file"
            hidden
            accept={source === "zip" ? ".zip,application/zip" : ".xlsx,.csv,.txt,.tsv"}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) (source === "zip" ? loadZip : loadSheet)(f);
              e.target.value = "";
            }}
          />
          <HowTo source={source} />
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-sm font-medium">3. Opções</p>
          <Checkbox checked={publish} onChange={setPublish} disabled={disabled} label="Publicar direto na loja (sem passar por rascunho)" />
          <div>
            <Checkbox checked={barcode} onChange={setBarcode} disabled={disabled} label="Completar pelo código de barras (EAN)" />
            <p className="ml-7 mt-1 text-[13px] text-subtle">Quando o produto tem EAN, busca nome, marca, medidas e, se não houver fotos, as fotos da base.</p>
          </div>
          <div>
            <Checkbox checked={standardize && photoStandard} onChange={setStandardize} disabled={disabled || !photoStandard} label="Padronizar as fotos (fundo, formato quadrado e marca d'água)" />
            <p className="ml-7 mt-1 text-[13px] text-subtle">
              {photoStandard ? (
                "Usa o padrão das Configurações. A foto original fica guardada."
              ) : (
                <>
                  Ligue o padrão em{" "}
                  <Link href="/admin/configuracoes?aba=catalogo" className="font-medium text-foreground underline-offset-4 hover:underline">
                    Configurações → Ferramentas do catálogo
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
          <div>
            <Checkbox
              checked={useAi && !!aiReady}
              onChange={setUseAi}
              disabled={disabled || !aiReady}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="size-4 text-primary" aria-hidden /> Preencher com IA o que faltar (ficha técnica, descrição, SEO)
                </span>
              }
            />
            <p className="ml-7 mt-1 text-[13px] text-subtle">
              {aiReady ? (
                <>Usa o {aiReady}. Lê as fotos de apoio (info, caixa, manual) ou, sem elas, as primeiras fotos. O que você escreveu no dados.txt é mantido.</>
              ) : (
                <>
                  Escolha uma IA e cadastre a chave em{" "}
                  <Link href="/admin/configuracoes?aba=ia" className="font-medium text-foreground underline-offset-4 hover:underline">
                    Configurações → Inteligência artificial
                  </Link>{" "}
                  (o Gemini tem plano grátis).
                </>
              )}
            </p>
          </div>
        </div>
      </Card>

      {progress && (
        <div role="status" className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 font-medium">
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> {progress.label}…
            </span>
            <span className="tabular text-muted-foreground">
              {progress.total === 100 && progress.label.includes(".zip") ? `${progress.done}%` : `${progress.done} de ${progress.total}`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-elevated">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <section aria-label="Produtos encontrados" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge>{pluralize(rows.length, "produto", "produtos")}</Badge>
              {counts.ok > 0 && <Badge tone="success">{counts.ok === 1 ? "1 pronto" : `${counts.ok} prontos`}</Badge>}
              {counts.warning > 0 && <Badge tone="warning">{pluralize(counts.warning, "com avisos", "com avisos")}</Badge>}
              {counts.error > 0 && <Badge tone="danger">{pluralize(counts.error, "com erro", "com erro")}</Badge>}
              {counts.duplicate > 0 && <Badge tone="info">{counts.duplicate === 1 ? "1 já existe" : `${counts.duplicate} já existem`}</Badge>}
              {counts.done > 0 && <Badge tone="success">{counts.done === 1 ? "1 importado" : `${counts.done} importados`}</Badge>}
              {counts.failed > 0 && <Badge tone="danger">{counts.failed === 1 ? "1 falhou" : `${counts.failed} falharam`}</Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              {busy === "importing" ? (
                <Button variant="secondary" onClick={() => (stopRef.current = true)}>
                  <Square aria-hidden /> Parar
                </Button>
              ) : (
                <>
                  {counts.done > 0 && (
                    <Link href={publish ? "/admin/produtos" : "/admin/produtos?status=DRAFT"} className="inline-flex h-11 items-center rounded-xl px-4 text-[15px] font-medium hover:bg-elevated">
                      Ver produtos importados
                    </Link>
                  )}
                  <Button onClick={startImport} disabled={disabled || counts.selected === 0}>
                    <Play aria-hidden /> Importar {pluralize(counts.selected, "produto", "produtos")}
                  </Button>
                </>
              )}
            </div>
          </div>

          <AdminTable>
            <thead>
              <tr>
                <th className="w-10">
                  <Checkbox
                    checked={allSelected}
                    disabled={disabled}
                    onChange={(v) => setRows((list) => list.map((r) => (isImportable(r) ? { ...r, selected: v } : r)))}
                    label={<span className="sr-only">Selecionar todos</span>}
                  />
                </th>
                <th>Produto</th>
                <th>Preço</th>
                <th>Fotos</th>
                <th>Categoria · Marca</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ImportRow key={r.key} row={r} disabled={disabled} onSelect={(v) => patch(r.key, { selected: v })} />
              ))}
            </tbody>
          </AdminTable>
        </section>
      )}
    </div>
  );
}

function ImportRow({ row: r, disabled, onSelect }: { row: Row; disabled: boolean; onSelect: (v: boolean) => void }) {
  const notes = [...r.errors.map((t) => ({ t, tone: "danger" as const })), ...r.warnings.map((t) => ({ t, tone: "warning" as const })), ...(r.resultWarnings ?? []).map((t) => ({ t, tone: "warning" as const }))];
  const [open, setOpen] = useState(false);
  const visible = open ? notes : notes.slice(0, 2);
  return (
    <tr className="align-top">
      <td>
        <Checkbox checked={r.selected && isImportable(r)} disabled={disabled || !isImportable(r)} onChange={onSelect} label={<span className="sr-only">Selecionar {r.name}</span>} />
      </td>
      <td className="min-w-[220px]">
        <p className="font-medium">{r.name}</p>
        <p className="text-xs text-subtle">
          {r.folder}
          {r.variants > 0 && ` · ${pluralize(r.variants, "variação", "variações")}`}
        </p>
        {notes.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 text-[13px]">
            {visible.map((n, i) => (
              <li key={i} className={n.tone === "danger" ? "text-danger" : "text-warning"}>
                {n.t}
              </li>
            ))}
            {notes.length > 2 && (
              <li>
                <button type="button" onClick={() => setOpen(!open)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                  {open ? "Mostrar menos" : `Mais ${notes.length - 2}`}
                </button>
              </li>
            )}
          </ul>
        )}
      </td>
      <td className="tabular whitespace-nowrap">
        {r.priceCents ? formatBRL(r.priceCents) : <span className="text-subtle">—</span>}
        <p className="text-xs text-subtle">Estoque {r.stock}</p>
      </td>
      <td className="tabular whitespace-nowrap">
        {r.photos}/{MAX_IMPORT_PHOTOS}
        {r.aiPhotos > 0 && <p className="text-xs text-subtle">+{r.aiPhotos} de apoio</p>}
      </td>
      <td className="text-[13px]">
        {r.category ? <span className={r.categoryFound ? "" : "text-warning"}>{r.category}</span> : <span className="text-subtle">Sem categoria</span>}
        {r.brand && (
          <p className="text-xs text-subtle">
            {r.brand}
            {r.brandIsNew && " (nova)"}
          </p>
        )}
      </td>
      <td className="whitespace-nowrap">
        <RowStatus row={r} />
      </td>
    </tr>
  );
}

function RowStatus({ row: r }: { row: Row }) {
  const line = (icon: ReactNode, text: ReactNode, cls: string) => (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", cls)}>
      {icon} {text}
    </span>
  );
  if (r.state === "running") return line(<Loader2 className="size-4 animate-spin" aria-hidden />, "Importando…", "text-primary");
  if (r.state === "done")
    return (
      <Link href={`/admin/produtos/${r.productId}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success hover:underline">
        <CheckCircle2 className="size-4" aria-hidden /> Importado
      </Link>
    );
  if (r.state === "failed")
    return (
      <span className="block max-w-[260px] whitespace-normal">
        {line(<XCircle className="size-4" aria-hidden />, "Falhou", "text-danger")}
        <span className="mt-0.5 block text-xs text-danger">{r.message}</span>
      </span>
    );
  if (r.status === "duplicate")
    return r.duplicate ? (
      <Link href={`/admin/produtos/${r.duplicate.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-info hover:underline">
        <CircleSlash className="size-4" aria-hidden /> Já existe
      </Link>
    ) : (
      line(<CircleSlash className="size-4" aria-hidden />, "Já existe", "text-info")
    );
  if (r.status === "error") return line(<XCircle className="size-4" aria-hidden />, "Corrigir", "text-danger");
  if (r.status === "warning") return line(<AlertTriangle className="size-4" aria-hidden />, "Pronto, com avisos", "text-warning");
  return line(<CheckCircle2 className="size-4" aria-hidden />, "Pronto", "text-success");
}

function HowTo({ source }: { source: Source }) {
  const folderTree = `Produtos/
├─ Fone JBL Tune 520BT/
│  ├─ 01.jpg  ← capa
│  ├─ 02.jpg … 12.jpg
│  ├─ info-caixa.jpg  ← só para a IA ler
│  └─ dados.txt
└─ Headset Gamer XYZ/
   └─ …`;
  return (
    <details className="mt-3 rounded-xl border border-border px-4 py-3 text-[13px] text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">Como organizar</summary>
      <div className="mt-3 space-y-3">
        {source === "planilha" ? (
          <>
            <p>
              Uma linha por produto. Colunas reconhecidas pelo nome: nome, preço, preço antigo, estoque, categoria, marca, SKU, EAN, voltagem, garantia, peso, medidas,
              descrição e fotos (links separados por vírgula, ou várias colunas “Imagem 1”, “Imagem 2”…). Linhas com o mesmo código de anúncio viram variações.
            </p>
            <p>
              <strong className="font-medium text-foreground">Mercado Livre:</strong> Anúncios → Editar em massa → baixar planilha (Excel).{" "}
              <strong className="font-medium text-foreground">Shopee:</strong> Meus Produtos → Ferramentas em massa → Atualização em massa → baixar. Envie o arquivo do
              jeito que veio. Só importe anúncios seus.
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={() => downloadText("planilha-modelo.csv", `﻿${SHEET_TEMPLATE}`, "text/csv;charset=utf-8")}>
              <Download aria-hidden /> Baixar planilha modelo
            </Button>
          </>
        ) : (
          <>
            <pre className="overflow-x-auto rounded-lg bg-elevated/60 p-3 font-mono text-xs leading-relaxed text-foreground">{folderTree}</pre>
            <ul className="list-disc space-y-1 pl-5">
              <li>Uma subpasta por produto. O nome da pasta vira o nome do produto se o dados.txt não tiver “nome”.</li>
              <li>Fotos em ordem pelo nome (01, 02…), até {MAX_IMPORT_PHOTOS}. Fotos que começam com info, caixa, manual ou etiqueta (ou numa subpasta) não aparecem na loja.</li>
              <li>No dados.txt, só o preço é obrigatório. Pode ser documento do Google chamado “dados”.</li>
              {source === "drive" && <li>Compartilhe a pasta principal como “Qualquer pessoa com o link” (leitor) e cole o link acima.</li>}
              {source === "zip" && <li>No Google Drive: clique com o botão direito na pasta → Fazer download. O Drive entrega um .zip.</li>}
            </ul>
            <Button type="button" variant="secondary" size="sm" onClick={() => downloadText("dados.txt", DADOS_TEMPLATE)}>
              <Download aria-hidden /> Baixar modelo do dados.txt
            </Button>
          </>
        )}
      </div>
    </details>
  );
}
