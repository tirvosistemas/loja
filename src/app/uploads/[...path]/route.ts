import { readUpload } from "@/lib/uploads";

// Serve as imagens enviadas pelo painel (pasta UPLOAD_DIR). Em produção o Caddy pode
// servir direto do disco; esta rota garante que funciona em qualquer ambiente.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.map((p) => decodeURIComponent(p)).join("/");
  if (rel.includes("..")) return new Response("Not found", { status: 404 });
  const file = await readUpload(rel);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.type,
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Last-Modified": file.mtime.toUTCString(),
    },
  });
}
