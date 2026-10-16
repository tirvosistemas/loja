import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { AdminShell } from "@/components/admin/shell";

export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel Tirvo" }, robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const [orders, reviews, settings] = await Promise.all([
    db.order.count({ where: { status: "NEW" } }),
    db.review.count({ where: { approved: false } }),
    getSettings(),
  ]);
  return (
    <AdminShell user={{ name: session.name, email: session.email, role: session.role }} counts={{ orders, reviews }} storeName={settings.store.name}>
      {children}
    </AdminShell>
  );
}
