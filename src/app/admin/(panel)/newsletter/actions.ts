"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, type ActionResult } from "@/lib/action";

export async function deleteSubscriberAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.string().trim().min(1).max(40).safeParse(id);
  if (!parsed.success) return fail("Inscrição inválida.");
  try {
    const res = await db.newsletterSubscriber.deleteMany({ where: { id: parsed.data } });
    if (res.count === 0) return fail("Esse e-mail já tinha sido removido.");
    revalidatePath("/admin/newsletter");
    return { ok: true, message: "E-mail removido da newsletter." };
  } catch (e) {
    console.error("[newsletter] falha ao remover:", e);
    return fail("Não foi possível remover o e-mail.");
  }
}
