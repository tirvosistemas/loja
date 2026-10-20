import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { downloadFile, MAX_DRIVE_PHOTO_BYTES } from "./drive";

// Baixa fotos por link (planilhas do Mercado Livre, Shopee ou do próprio dono).
// Só endereços públicos: bloqueia rede interna do servidor (localhost, 10.x, 192.168.x…).

/** IPv6 nos 8 blocos de 16 bits ("::" expandido; IPv4 no fim vira 2 blocos). */
function ipv6Words(ip: string) {
  let v = ip.toLowerCase().replace(/%.*$/, "");
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    v = `${v.slice(0, v4.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const part = (s: string) => (s ? s.split(":").map((h) => parseInt(h, 16)) : []);
  const [head, tail] = v.split("::");
  if (tail === undefined) return part(head);
  const h = part(head);
  const t = part(tail);
  return [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill(0), ...t];
}

export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const w = ipv6Words(ip);
    if (w.length !== 8) return true;
    // IPv4 dentro do IPv6 (::a.b.c.d, ::ffff:a.b.c.d, 64:ff9b::a.b.c.d): vale a regra do IPv4.
    const zeros = (from: number, to: number) => w.slice(from, to).every((x) => x === 0);
    if ((zeros(0, 5) && (w[5] === 0 || w[5] === 0xffff)) || (w[0] === 0x64 && w[1] === 0xff9b && zeros(2, 6))) {
      return isPrivateIp([w[6] >> 8, w[6] & 255, w[7] >> 8, w[7] & 255].join("."));
    }
    return (w[0] & 0xfe00) === 0xfc00 || (w[0] & 0xffc0) === 0xfe80 || w[0] >= 0xff00;
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
    if (!opts.driveKey) throw new Error("Foto no Google Drive: cadastre a chave do Drive em Configurações → Ferramentas do catálogo.");
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
    return readLimited(res, maxBytes);
  }
  throw new Error("O link da foto redireciona demais.");
}

/** Lê o corpo aos pedaços e para assim que passa do limite. */
async function readLimited(res: Response, maxBytes: number) {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks);
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => null);
      throw new Error("Foto grande demais.");
    }
    chunks.push(value);
  }
}
