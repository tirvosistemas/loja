import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OwnNameForm, OwnPasswordForm } from "@/components/admin/users/account-forms";

export const metadata: Metadata = { title: "Minha conta" };

const ROLE_LABEL = { OWNER: "Dono", ADMIN: "Administrador", EDITOR: "Editor" } as const;

export default async function MyAccountPage() {
  // Qualquer papel pode cuidar da própria conta.
  const session = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: session.sub }, select: { name: true, email: true, role: true, lastLoginAt: true, createdAt: true } });
  if (!user) notFound();
  const canManageUsers = session.role === "OWNER" || session.role === "ADMIN";

  return (
    <>
      <PageHeader
        title="Minha conta"
        description="Seus dados de acesso ao painel."
        back={canManageUsers ? { href: "/admin/usuarios", label: "Usuários" } : { href: "/admin", label: "Painel" }}
      />
      <div className="grid max-w-4xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Dados" />
            <CardBody>
              <OwnNameForm initial={user.name} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Senha" description="Depois de trocar, use a nova senha no próximo acesso." />
            <CardBody>
              <OwnPasswordForm email={user.email} />
            </CardBody>
          </Card>
        </div>
        <Card className="h-fit">
          <CardBody>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-subtle">E-mail de acesso</dt>
                <dd className="mt-0.5 break-all">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Papel</dt>
                <dd className="mt-1">
                  <Badge tone={user.role === "OWNER" ? "accent" : user.role === "ADMIN" ? "info" : "neutral"}>
                    {user.role === "OWNER" && <ShieldCheck aria-hidden />}
                    {ROLE_LABEL[user.role]}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Último acesso</dt>
                <dd className="tabular mt-0.5">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Conta criada em</dt>
                <dd className="tabular mt-0.5">{formatDateTime(user.createdAt)}</dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-border pt-4 text-[13px] text-muted-foreground">O e-mail de acesso não muda. Para usar outro, peça a um dono ou administrador que crie um novo usuário.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
