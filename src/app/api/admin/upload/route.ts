import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, saveImage, UPLOAD_FOLDERS, type UploadFolder } from "@/lib/uploads";

function sameOrigin(origin: string, host: string) {
  try {
    return new URL(origin).host === host;
  } catch {
    return false; // "null" (iframe isolado) ou valor inválido
  }
}

// Upload de imagens do painel. Campo "file" (uma imagem) e "folder" (products, banners…).
export async function POST(req: Request) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Faça login no painel." }, { status: 401 });
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !sameOrigin(origin, host)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });

  // Recusa antes de ler o corpo inteiro (folga para os campos do formulário).
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return NextResponse.json({ error: "Imagem maior que 8 MB." }, { status: 413 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const folderRaw = String(form?.get("folder") ?? "misc");
  const folder = (UPLOAD_FOLDERS as readonly string[]).includes(folderRaw) ? (folderRaw as UploadFolder) : "misc";
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie um arquivo de imagem." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Imagem maior que 8 MB." }, { status: 413 });
  try {
    const saved = await saveImage(Buffer.from(await file.arrayBuffer()), folder);
    return NextResponse.json(saved);
  } catch (e) {
    const msg = (e as Error).message;
    // Mensagens próprias (em português) vão para a tela; erros internos do sharp ficam no log.
    if (/^(Imagem|Arquivo|Formato)/.test(msg)) return NextResponse.json({ error: msg }, { status: 400 });
    console.error("[upload] falha ao salvar imagem:", e);
    return NextResponse.json({ error: "Não foi possível processar a imagem. Tente outro arquivo." }, { status: 400 });
  }
}
