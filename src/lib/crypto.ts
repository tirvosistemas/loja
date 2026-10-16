import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Segredos (chave da Stripe, chave de mapas, chave VAPID) são guardados no banco
// criptografados com AES-256-GCM. A chave vem de AUTH_SECRET.

const PREFIX = "enc:v1:";

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET ausente ou curto demais (mínimo 16 caracteres).");
  return createHash("sha256").update(`tirvo-settings:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) return value; // valor antigo em texto puro
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function isEncrypted(value: string | null | undefined) {
  return !!value && value.startsWith(PREFIX);
}

/** "sk_live_51Hx...9xQ" → "sk_live_••••9xQ" para exibir no painel. */
export function maskSecret(plain: string): string {
  if (!plain) return "";
  const head = plain.match(/^[a-z]+_(live|test)_/i)?.[0] ?? plain.slice(0, 4);
  return `${head}••••${plain.slice(-4)}`;
}
