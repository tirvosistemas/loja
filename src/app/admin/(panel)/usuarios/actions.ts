"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, requireAdmin, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, fromZod, isUniqueError, type ActionResult } from "@/lib/action";
import { rateLimit } from "@/lib/rate-limit";

// Usuários do painel. Regras: ninguém se exclui ou se desativa, a loja sempre tem pelo
// menos um dono (OWNER) ativo e só um dono cria, promove ou altera outros donos.

const ROLES: ("OWNER" | "ADMIN")[] = ["OWNER", "ADMIN"];
const roleSchema = z.enum(["OWNER", "ADMIN", "EDITOR"], { error: "Escolha o papel." });
const nameSchema = z.string().trim().min(2, "Informe o nome.").max(80, "Use até 80 caracteres.");
const passwordSchema = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(128, "Use até 128 caracteres.");
const idSchema = z.string().trim().min(1).max(40);

function refresh() {
  revalidatePath("/admin/usuarios");
}

/** Conta donos ativos além do usuário informado (dentro da transação). */
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
async function otherActiveOwners(tx: Tx, exceptId: string) {
  return tx.user.count({ where: { role: "OWNER", active: true, id: { not: exceptId } } });
}

class RuleError extends Error {}

const createSchema = z.object({
  name: nameSchema,
  email: z.string().trim().toLowerCase().max(160).pipe(z.email("E-mail inválido.")),
  password: passwordSchema,
  role: roleSchema,
});

export async function createUserAction(input: z.input<typeof createSchema>): Promise<ActionResult> {
  const session = await requireAdmin(ROLES);
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  if (v.role === "OWNER" && session.role !== "OWNER") return fail("Só o dono da loja pode criar outro dono.", { role: "Escolha Administrador ou Editor." });
  try {
    await db.user.create({ data: { name: v.name, email: v.email, role: v.role, passwordHash: await hashPassword(v.password) } });
    refresh();
    return { ok: true, message: `${v.name} já pode entrar no painel.` };
  } catch (e) {
    if (isUniqueError(e, "email")) return fail("Esse e-mail já tem acesso.", { email: "Já existe um usuário com esse e-mail." });
    console.error("[usuários] falha ao criar:", e);
    return fail("Não foi possível criar o usuário.");
  }
}

const updateSchema = z.object({ id: idSchema, name: nameSchema, role: roleSchema, active: z.boolean() });

export async function updateUserAction(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const session = await requireAdmin(ROLES);
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  const self = v.id === session.sub;
  if (self && !v.active) return fail("Você não pode desativar a sua própria conta.");
  try {
    await db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: v.id }, select: { role: true, active: true } });
      if (!target) throw new RuleError("Usuário não encontrado.");
      if (session.role !== "OWNER" && (target.role === "OWNER" || v.role === "OWNER")) throw new RuleError("Só o dono da loja pode alterar ou promover donos.");
      const losesOwner = target.role === "OWNER" && target.active && (v.role !== "OWNER" || !v.active);
      if (losesOwner && (await otherActiveOwners(tx, v.id)) === 0) throw new RuleError("A loja precisa de pelo menos um dono ativo. Promova outra pessoa a dono antes.");
      await tx.user.update({ where: { id: v.id }, data: { name: v.name, role: v.role, active: v.active } });
    }, { isolationLevel: "Serializable" });
    refresh();
    return { ok: true, message: "Usuário atualizado." };
  } catch (e) {
    if (e instanceof RuleError) return fail(e.message);
    console.error("[usuários] falha ao atualizar:", e);
    return fail("Não foi possível atualizar o usuário.");
  }
}

const resetSchema = z.object({ id: idSchema, password: passwordSchema });

export async function resetPasswordAction(input: z.input<typeof resetSchema>): Promise<ActionResult> {
  const session = await requireAdmin(ROLES);
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const target = await db.user.findUnique({ where: { id: parsed.data.id }, select: { role: true, name: true } });
  if (!target) return fail("Usuário não encontrado.");
  if (target.role === "OWNER" && session.role !== "OWNER") return fail("Só o dono da loja pode trocar a senha de outro dono.");
  try {
    await db.user.update({ where: { id: parsed.data.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
    refresh();
    return { ok: true, message: `Senha de ${target.name} redefinida.` };
  } catch (e) {
    console.error("[usuários] falha ao redefinir senha:", e);
    return fail("Não foi possível redefinir a senha.");
  }
}

export async function deleteUserAction(id: string): Promise<ActionResult> {
  const session = await requireAdmin(ROLES);
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return fail("Usuário inválido.");
  if (parsed.data === session.sub) return fail("Você não pode excluir a sua própria conta.");
  try {
    await db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: parsed.data }, select: { role: true, active: true } });
      if (!target) throw new RuleError("Usuário não encontrado.");
      if (target.role === "OWNER" && session.role !== "OWNER") throw new RuleError("Só o dono da loja pode excluir outro dono.");
      if (target.role === "OWNER" && target.active && (await otherActiveOwners(tx, parsed.data)) === 0) {
        throw new RuleError("A loja precisa de pelo menos um dono ativo.");
      }
      await tx.user.delete({ where: { id: parsed.data } });
    }, { isolationLevel: "Serializable" });
    refresh();
    return { ok: true, message: "Usuário excluído." };
  } catch (e) {
    if (e instanceof RuleError) return fail(e.message);
    console.error("[usuários] falha ao excluir:", e);
    return fail("Não foi possível excluir o usuário.");
  }
}

// ───────── Minha conta (qualquer papel)

const ownPasswordSchema = z
  .object({
    current: z.string().min(1, "Informe a senha atual.").max(200),
    next: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "As senhas não conferem." })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "A nova senha precisa ser diferente da atual." });

export async function changeOwnPasswordAction(input: z.input<typeof ownPasswordSchema>): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = ownPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const rl = rateLimit(`own-password:${session.sub}`, 8, 15 * 60_000);
  if (!rl.ok) return fail(`Muitas tentativas. Tente de novo em ${Math.ceil(rl.retryAfterMs / 60_000)} min.`);
  const user = await db.user.findUnique({ where: { id: session.sub }, select: { passwordHash: true } });
  if (!user) return fail("Conta não encontrada.");
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return fail("Senha atual incorreta.", { current: "Senha atual incorreta." });
  try {
    await db.user.update({ where: { id: session.sub }, data: { passwordHash: await hashPassword(parsed.data.next) } });
    return { ok: true, message: "Senha alterada." };
  } catch (e) {
    console.error("[usuários] falha ao trocar a própria senha:", e);
    return fail("Não foi possível alterar a senha.");
  }
}

export async function updateOwnNameAction(input: { name: string }): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = z.object({ name: nameSchema }).safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await db.user.update({ where: { id: session.sub }, data: { name: parsed.data.name } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Nome atualizado." };
  } catch (e) {
    console.error("[usuários] falha ao atualizar o próprio nome:", e);
    return fail("Não foi possível salvar o nome.");
  }
}
