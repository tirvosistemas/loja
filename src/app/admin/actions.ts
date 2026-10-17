"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, ensureInitialAdmin, verifyCredentials } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

/** Volta só para páginas do próprio painel (nada de "//site.com", "/\site.com" ou outro domínio). */
function safeBack(raw: FormDataEntryValue | null) {
  const back = typeof raw === "string" ? raw.trim() : "";
  if (!/^\/admin(?:[/?#]|$)/.test(back) || /[\\\s]|\/\//.test(back) || back.startsWith("/admin/login")) return "/admin";
  return back.slice(0, 500);
}

export async function loginAction(_prev: { error?: string } | null, form: FormData): Promise<{ error?: string }> {
  const ip = clientIp(await headers());
  const rl = rateLimit(`login:${ip}`, 8, 15 * 60_000);
  if (!rl.ok) return { error: `Muitas tentativas. Tente de novo em ${Math.ceil(rl.retryAfterMs / 60000)} min.` };
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Informe e-mail e senha." };
  await ensureInitialAdmin();
  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) return { error: "E-mail ou senha incorretos." };
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user);
  redirect(safeBack(form.get("voltar")));
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}
