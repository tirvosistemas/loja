"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, fromZod, type ActionResult } from "@/lib/action";
import { deleteImage } from "@/lib/uploads";
import { unusedBannerImages } from "@/components/admin/marketing/data";
import { checkPeriod, entityId, hrefSchema, imageKeySchema, optionalDate } from "@/components/admin/marketing/rules";

// Banners do carrossel do topo (HERO) e das faixas do meio da página inicial (STRIP).

const bannerSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o título.").max(120, "Use até 120 caracteres."),
    subtitle: z.string().trim().max(300, "Use até 300 caracteres.").default(""),
    eyebrow: z.string().trim().max(60, "Use até 60 caracteres.").default(""),
    ctaLabel: z.string().trim().max(40, "Use até 40 caracteres.").default(""),
    href: hrefSchema.prefault(""),
    imageDesktop: z.string({ error: "Envie a imagem para computador." }).trim().min(1, "Envie a imagem para computador.").pipe(imageKeySchema),
    imageMobile: imageKeySchema.nullable().default(null),
    theme: z.enum(["dark", "light"]),
    align: z.enum(["left", "center", "right"]),
    placement: z.enum(["HERO", "STRIP"]),
    startsAt: optionalDate,
    endsAt: optionalDate,
    active: z.boolean(),
  })
  .superRefine(checkPeriod);

// A imagem pode chegar vazia do formulário; a validação devolve o erro do campo.
export type BannerInput = Omit<z.input<typeof bannerSchema>, "imageDesktop"> & { imageDesktop: string | null };

function refresh() {
  revalidatePath("/admin/banners");
  revalidatePath("/");
}

async function nextSortOrder(placement: "HERO" | "STRIP") {
  const last = await db.banner.findFirst({ where: { placement }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return (last?.sortOrder ?? -1) + 1;
}

async function removeFiles(keys: (string | null | undefined)[], exceptBannerId?: string) {
  try {
    const unused = await unusedBannerImages(keys, exceptBannerId);
    await Promise.all(unused.map((k) => deleteImage(k)));
  } catch (e) {
    console.error("[banners] falha ao apagar imagens:", e);
  }
}

export async function saveBannerAction(id: string | null, input: BannerInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  const data = {
    title: v.title,
    subtitle: v.subtitle || null,
    eyebrow: v.eyebrow || null,
    ctaLabel: v.ctaLabel || null,
    href: v.href,
    imageDesktop: v.imageDesktop,
    imageMobile: v.imageMobile,
    theme: v.theme,
    align: v.align,
    placement: v.placement,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    active: v.active,
  };
  try {
    if (!id) {
      const created = await db.banner.create({ data: { ...data, sortOrder: await nextSortOrder(v.placement) }, select: { id: true } });
      refresh();
      return { ok: true, data: { id: created.id }, message: "Banner criado." };
    }
    const parsedId = entityId.safeParse(id);
    if (!parsedId.success) return fail("Banner inválido.");
    const current = await db.banner.findUnique({ where: { id: parsedId.data } });
    if (!current) return fail("Este banner não existe mais.");
    const moved = current.placement !== v.placement;
    await db.banner.update({
      where: { id: current.id },
      data: { ...data, ...(moved ? { sortOrder: await nextSortOrder(v.placement) } : {}) },
    });
    // Imagens trocadas: apaga os arquivos antigos se nenhum outro banner usa.
    const replaced = [current.imageDesktop, current.imageMobile].filter((k) => k && k !== v.imageDesktop && k !== v.imageMobile);
    if (replaced.length) await removeFiles(replaced, current.id);
    refresh();
    return { ok: true, data: { id: current.id }, message: "Banner salvo." };
  } catch (e) {
    console.error("[banners] falha ao salvar:", e);
    return fail("Não foi possível salvar o banner. Tente de novo.");
  }
}

export async function toggleBannerAction(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: entityId, active: z.boolean() }).safeParse({ id, active });
  if (!parsed.success) return fail("Dados inválidos.");
  try {
    const r = await db.banner.updateMany({ where: { id: parsed.data.id }, data: { active: parsed.data.active } });
    if (!r.count) return fail("Este banner não existe mais.");
    refresh();
    return { ok: true, message: parsed.data.active ? "Banner ativado." : "Banner desativado." };
  } catch (e) {
    console.error("[banners] falha ao ativar/desativar:", e);
    return fail("Não foi possível alterar o banner.");
  }
}

/** Sobe ou desce o banner na ordem do seu grupo (renumera o grupo inteiro). */
export async function moveBannerAction(id: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: entityId, direction: z.enum(["up", "down"]) }).safeParse({ id, direction });
  if (!parsed.success) return fail("Dados inválidos.");
  try {
    const banner = await db.banner.findUnique({ where: { id: parsed.data.id }, select: { id: true, placement: true } });
    if (!banner) return fail("Este banner não existe mais.");
    const group = await db.banner.findMany({
      where: { placement: banner.placement },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true, sortOrder: true },
    });
    const i = group.findIndex((b) => b.id === banner.id);
    const j = parsed.data.direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= group.length) return { ok: true };
    [group[i], group[j]] = [group[j], group[i]];
    await db.$transaction(group.map((b, index) => db.banner.update({ where: { id: b.id }, data: { sortOrder: index } })));
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[banners] falha ao reordenar:", e);
    return fail("Não foi possível mudar a ordem.");
  }
}

export async function duplicateBannerAction(id: string): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = entityId.safeParse(id);
  if (!parsed.success) return fail("Banner inválido.");
  try {
    const b = await db.banner.findUnique({ where: { id: parsed.data } });
    if (!b) return fail("Este banner não existe mais.");
    const copy = await db.banner.create({
      data: {
        title: `${b.title} (cópia)`.slice(0, 120),
        subtitle: b.subtitle,
        eyebrow: b.eyebrow,
        ctaLabel: b.ctaLabel,
        href: b.href,
        imageDesktop: b.imageDesktop,
        imageMobile: b.imageMobile,
        theme: b.theme,
        align: b.align,
        placement: b.placement,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        active: false,
        sortOrder: await nextSortOrder(b.placement),
      },
      select: { id: true },
    });
    refresh();
    return { ok: true, data: { id: copy.id }, message: "Cópia criada (desativada). Edite e ative quando quiser." };
  } catch (e) {
    console.error("[banners] falha ao duplicar:", e);
    return fail("Não foi possível duplicar o banner.");
  }
}

export async function deleteBannerAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = entityId.safeParse(id);
  if (!parsed.success) return fail("Banner inválido.");
  try {
    const b = await db.banner.findUnique({ where: { id: parsed.data } });
    if (!b) return fail("Este banner já tinha sido excluído.");
    await db.banner.delete({ where: { id: b.id } });
    await removeFiles([b.imageDesktop, b.imageMobile]);
    refresh();
    return { ok: true, message: "Banner excluído." };
  } catch (e) {
    console.error("[banners] falha ao excluir:", e);
    return fail("Não foi possível excluir o banner.");
  }
}
