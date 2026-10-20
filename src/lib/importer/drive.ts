import { isDadosName } from "./dados";

// Leitura de pastas do Google Drive com a API oficial (Drive API v3) e uma chave de API.
// A pasta precisa estar compartilhada como "Qualquer pessoa com o link" (leitor).

const API = "https://www.googleapis.com/drive/v3/files";
const FOLDER = "application/vnd.google-apps.folder";
const GOOGLE_DOC = "application/vnd.google-apps.document";
export const MAX_DRIVE_PHOTO_BYTES = 40 * 1024 * 1024;

export class DriveError extends Error {}

export type DriveFile = { id: string; name: string; mimeType: string; size: number | null };

/** Aceita o link da pasta (…/folders/ID, ?id=ID) ou só o ID. */
export function parseFolderId(input: string): string | null {
  const s = input.trim();
  const m = /\/folders\/([\w-]{10,})/.exec(s) ?? /[?&]id=([\w-]{10,})/.exec(s) ?? /^([\w-]{10,})$/.exec(s);
  return m?.[1] ?? null;
}

async function request(url: URL, key: string, init?: { signal?: AbortSignal }) {
  url.searchParams.set("key", key);
  url.searchParams.set("supportsAllDrives", "true");
  let res: Response;
  try {
    res = await fetch(url, { signal: init?.signal ?? AbortSignal.timeout(60_000), cache: "no-store" });
  } catch {
    throw new DriveError("Não foi possível falar com o Google Drive. Tente de novo.");
  }
  if (res.ok) return res;
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; errors?: { reason?: string }[]; status?: string } } | null;
  const reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? "";
  const message = body?.error?.message ?? "";
  if (/keyInvalid|API_KEY_INVALID/i.test(reason + message)) throw new DriveError("A chave do Google Drive é inválida. Confira em Configurações → Ferramentas do catálogo.");
  if (/accessNotConfigured|SERVICE_DISABLED|has not been used/i.test(reason + message))
    throw new DriveError("A Google Drive API não está ativada no projeto da chave. Ative em console.cloud.google.com → APIs e serviços.");
  if (/referer|ip address|API_KEY_.*BLOCKED|blocked/i.test(reason + message))
    throw new DriveError("A chave tem restrição de site ou IP que bloqueia o servidor. No Google Cloud, deixe a chave restrita só à Drive API.");
  if (res.status === 404) throw new DriveError("Pasta ou arquivo não encontrado. Confira o link e se a pasta está compartilhada como “Qualquer pessoa com o link”.");
  if (res.status === 403) throw new DriveError("Sem acesso. Compartilhe a pasta como “Qualquer pessoa com o link” (leitor).");
  if (res.status === 429) throw new DriveError("O Google Drive pediu uma pausa (limite de uso). Aguarde um minuto e continue.");
  throw new DriveError(`O Google Drive recusou o pedido (${res.status}).`);
}

export async function getFolder(id: string, key: string): Promise<{ id: string; name: string }> {
  const url = new URL(`${API}/${encodeURIComponent(id)}`);
  url.searchParams.set("fields", "id,name,mimeType");
  const j = (await (await request(url, key)).json()) as { id: string; name: string; mimeType: string };
  if (j.mimeType !== FOLDER) throw new DriveError("O link não é de uma pasta. Copie o link da pasta (não de uma foto).");
  return { id: j.id, name: j.name };
}

/** Arquivos e pastas diretamente dentro da pasta. */
export async function listFolder(id: string, key: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(API);
    url.searchParams.set("q", `'${id.replace(/'/g, "")}' in parents and trashed = false`);
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size)");
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const j = (await (await request(url, key)).json()) as { nextPageToken?: string; files?: { id: string; name: string; mimeType: string; size?: string }[] };
    for (const f of j.files ?? []) out.push({ id: f.id, name: f.name, mimeType: f.mimeType, size: f.size ? Number(f.size) : null });
    pageToken = j.nextPageToken;
  } while (pageToken && out.length < 10_000);
  return out;
}

export const isFolder = (f: DriveFile) => f.mimeType === FOLDER;

/** Baixa o conteúdo de um arquivo, recusando os maiores que `maxBytes`. */
export async function downloadFile(file: DriveFile, key: string, maxBytes = MAX_DRIVE_PHOTO_BYTES): Promise<Buffer> {
  if (file.size != null && file.size > maxBytes) throw new DriveError(`“${file.name}” tem mais de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const url = new URL(`${API}/${encodeURIComponent(file.id)}`);
  url.searchParams.set("alt", "media");
  const res = await request(url, key, { signal: AbortSignal.timeout(120_000) });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) throw new DriveError(`“${file.name}” tem mais de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  return buf;
}

/** Texto do dados.txt (arquivo de texto ou documento do Google chamado "dados"). */
export async function readDados(files: DriveFile[], key: string): Promise<string | null> {
  const f = files.find((x) => !isFolder(x) && isDadosName(x.name));
  if (!f) return null;
  if (f.mimeType === GOOGLE_DOC) {
    const url = new URL(`${API}/${encodeURIComponent(f.id)}/export`);
    url.searchParams.set("mimeType", "text/plain");
    return (await request(url, key)).text();
  }
  return (await downloadFile(f, key, 512 * 1024)).toString("utf8");
}
