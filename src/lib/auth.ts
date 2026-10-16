import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type SessionPayload } from "./session";

export type { SessionPayload };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: { id: string; name: string; email: string; role: SessionPayload["role"] }) {
  const token = await signSession({ sub: user.id, name: user.name, email: user.email, role: user.role });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Sessão atual, conferindo se o usuário ainda existe e está ativo. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.sub }, select: { active: true, role: true, name: true } });
  if (!user?.active) return null;
  return { ...payload, role: user.role, name: user.name };
}

/**
 * Para páginas e server actions do painel: garante login (e papel, se informado).
 * Sem sessão, manda para /admin/login.
 */
export async function requireAdmin(roles?: SessionPayload["role"][]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (roles && !roles.includes(session.role)) redirect("/admin?erro=permissao");
  return session;
}

/** Para route handlers: devolve a sessão ou null (responda 401). */
export async function getApiSession(roles?: SessionPayload["role"][]) {
  const session = await getSession();
  if (!session) return null;
  if (roles && !roles.includes(session.role)) return null;
  return session;
}

/** Cria o primeiro administrador a partir de ADMIN_EMAIL / ADMIN_PASSWORD se não houver nenhum. */
export async function ensureInitialAdmin() {
  const count = await db.user.count();
  if (count > 0) return;
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 6) return;
  await db.user.create({
    data: { name: "Administrador", email, passwordHash: await hashPassword(password), role: "OWNER" },
  });
}
