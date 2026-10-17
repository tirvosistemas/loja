import type { Metadata } from "next";
import Link from "next/link";
import { UserCog } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { UsersManager, type UserRow } from "@/components/admin/users/users-manager";

export const metadata: Metadata = { title: "Usuários" };

const ROLE_ORDER = { OWNER: 0, ADMIN: 1, EDITOR: 2 } as const;

export default async function UsersPage() {
  const session = await requireAdmin(["OWNER", "ADMIN"]);
  const rows = await db.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const users: UserRow[] = rows
    .sort((a, b) => Number(b.active) - Number(a.active) || ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name, "pt-BR"))
    .map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString() }));

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Quem pode entrar no painel e o que cada pessoa pode fazer."
        actions={
          <Link href="/admin/usuarios/minha-conta" className={buttonVariants({ variant: "secondary" })}>
            <UserCog aria-hidden /> Minha conta
          </Link>
        }
      />
      <UsersManager users={users} currentUserId={session.sub} currentRole={session.role} />
    </>
  );
}
