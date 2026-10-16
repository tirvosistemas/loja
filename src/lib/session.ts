import { SignJWT, jwtVerify } from "jose";

// Token da sessão do painel. Sem dependências do Next para poder rodar no proxy.

export const SESSION_COOKIE = "tirvo_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

export type SessionPayload = { sub: string; name: string; email: string; role: "OWNER" | "ADMIN" | "EDITOR" };

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("Defina AUTH_SECRET (mínimo 16 caracteres) no .env");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ name: payload.name, email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      role: (payload.role as SessionPayload["role"]) ?? "EDITOR",
    };
  } catch {
    return null;
  }
}
