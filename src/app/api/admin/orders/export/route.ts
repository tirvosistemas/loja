import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { DELIVERY_TYPE_LABEL, ORDER_STATUS_LABEL, PAYMENT_METHOD_SHORT, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { formatCep, formatDateTime, formatPhone } from "@/lib/format";
import { orderWhere, parseOrderFilters } from "@/components/admin/orders/filters";
import { spDateKey } from "@/components/admin/orders/time";

// Exporta os pedidos filtrados em CSV para o Excel em português:
// separador ";", vírgula decimal e BOM UTF-8 para os acentos abrirem certo.

const MAX_ROWS = 20_000;

function cell(v: string | number | null | undefined) {
  let s = v == null ? "" : String(v);
  // Texto digitado pelo cliente não pode virar fórmula no Excel.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function money(cents: number | null | undefined) {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export async function GET(req: Request) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Faça login no painel." }, { status: 401 });

  const filters = parseOrderFilters(new URL(req.url).searchParams);
  const orders = await db.order.findMany({
    where: orderWhere(filters),
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    include: { items: { select: { name: true, variantName: true, quantity: true } } },
  });

  const header = [
    "Código", "Data", "Status", "Cliente", "WhatsApp", "E-mail", "CPF", "Entrega", "Endereço", "Bairro", "Cidade", "UF", "CEP",
    "Distância (km)", "Itens", "Qtd. de itens", "Subtotal", "Cupom", "Desconto do cupom", "Desconto Pix", "Frete", "Total",
    "Forma de pagamento", "Status do pagamento", "Troco para", "Observações do cliente", "Anotações internas",
  ];

  const lines = orders.map((o) => {
    const address = [o.street, o.number].filter(Boolean).join(", ") + (o.complement ? ` - ${o.complement}` : "");
    const items = o.items.map((i) => `${i.quantity}x ${i.name}${i.variantName ? ` (${i.variantName})` : ""}`).join(" | ");
    return [
      o.code,
      formatDateTime(o.createdAt),
      ORDER_STATUS_LABEL[o.status]?.label ?? o.status,
      o.customerName,
      formatPhone(o.customerPhone),
      o.customerEmail,
      o.customerDoc,
      DELIVERY_TYPE_LABEL[o.deliveryType],
      o.deliveryType === "DELIVERY" ? address : "",
      o.neighborhood,
      o.city,
      o.state,
      o.cep ? formatCep(o.cep) : "",
      o.distanceKm != null ? o.distanceKm.toFixed(1).replace(".", ",") : "",
      items,
      o.items.reduce((n, i) => n + i.quantity, 0),
      money(o.subtotalCents),
      o.couponCode,
      money(o.discountCents),
      money(o.pixDiscountCents),
      money(o.shippingCents),
      money(o.totalCents),
      PAYMENT_METHOD_SHORT[o.paymentMethod],
      PAYMENT_STATUS_LABEL[o.paymentStatus]?.label ?? o.paymentStatus,
      money(o.changeForCents),
      o.notes,
      o.adminNotes,
    ]
      .map(cell)
      .join(";");
  });

  const csv = "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n") + "\r\n";
  const filename = `pedidos-${spDateKey(new Date())}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
