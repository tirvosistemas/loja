import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { saveImage, UPLOAD_FOLDERS, type UploadFolder } from "@/lib/uploads";

// Upload de imagens do painel. Campo "file" (uma imagem) e "folder" (products, banners…).
export async function POST(req: Request) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Faça login no painel." }, { status: 401 });
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const folderRaw = String(form?.get("folder") ?? "misc");
  const folder = (UPLOAD_FOLDERS as readonly string[]).includes(folderRaw) ? (folderRaw as UploadFolder) : "misc";
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie um arquivo de imagem." }, { status: 400 });
  try {
    const saved = await saveImage(Buffer.from(await file.arrayBuffer()), folder);
    return NextResponse.json(saved);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Não foi possível salvar a imagem." }, { status: 400 });
  }
}
