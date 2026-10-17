import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { spDateKey } from "@/components/admin/orders/time";

// Lista de inscritos da newsletter em CSV (Excel em português: ";" e BOM UTF-8).

function cell(v: string) {
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Faça login no painel." }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 120).toLowerCase();
  const rows = await db.newsletterSubscriber.findMany({
    where: q ? { email: { contains: q } } : {},
    orderBy: { createdAt: "desc" },
    take: 100_000,
  });
  const lines = rows.map((r) => [cell(r.email), cell(formatDateTime(r.createdAt))].join(";"));
  const csv = "﻿" + ["E-mail;Inscrito em", ...lines].join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="newsletter-${spDateKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
