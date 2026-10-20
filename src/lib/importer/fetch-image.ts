import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { downloadFile, MAX_DRIVE_PHOTO_BYTES } from "./drive";

// Baixa fotos por link (planilhas do Mercado Livre, Shopee ou do próprio dono).
// Só endereços públicos: bloqueia rede interna do servidor (localhost, 10.x, 192.168.x…).

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Link de foto inválido (use http ou https).");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error(`Não encontrei o site da foto: ${url.hostname}.`);
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("Link de foto aponta para endereço interno; não é permitido.");
}

/** ID de arquivo do Google Drive num link (…/file/d/ID, open?id=ID, uc?id=ID). */
export function driveFileId(url: string) {
  if (!/drive\.google\.com|docs\.google\.com/.test(url)) return null;
  return /\/file\/d\/([\w-]{10,})/.exec(url)?.[1] ?? /[?&]id=([\w-]{10,})/.exec(url)?.[1] ?? null;
}

export async function fetchImage(rawUrl: string, opts: { driveKey?: string; maxBytes?: number } = {}): Promise<Buffer> {
  const maxBytes = opts.maxBytes ?? MAX_DRIVE_PHOTO_BYTES;
  const driveId = driveFileId(rawUrl);
  if (driveId) {
    if (!opts.driveKey) throw new Error("Foto no Google Drive: cadastre a chave do Drive em Configurações → Integrações.");
    return downloadFile({ id: driveId, name: "foto", mimeType: "", size: null }, opts.driveKey, maxBytes);
  }

  let url = new URL(rawUrl);
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(60_000), headers: { "user-agent": "Mozilla/5.0 (TirvoImportador)", accept: "image/*" } }).catch(() => null);
    if (!res) throw new Error(`Não consegui baixar a foto: ${url.hostname}.`);
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new Error(`O site da foto respondeu ${res.status} (${url.hostname}).`);
    const type = res.headers.get("content-type") ?? "";
    if (type && !/^image\/|octet-stream/i.test(type)) throw new Error(`O link não é de uma imagem (${url.hostname}).`);
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > maxBytes) throw new Error("Foto grande demais.");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) throw new Error("Foto grande demais.");
    return buf;
  }
  throw new Error("O link da foto redireciona demais.");
}
