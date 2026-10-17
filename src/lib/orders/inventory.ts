import type { Prisma } from "@prisma/client";

// Baixa e devolução de estoque dentro de uma transação. Só mexe no estoque dos produtos
// com controle ativo (trackStock) e que não aceitam venda sem estoque (allowBackorder).

type Tx = Prisma.TransactionClient;

export type StockLine = { productId: string; variantId: string | null; quantity: number; name: string };

export class OutOfStockError extends Error {
  constructor(public readonly itemName: string) {
    super(`${itemName}: acabou o estoque enquanto você finalizava a compra.`);
    this.name = "OutOfStockError";
  }
}

async function stockControlled(tx: Tx, productIds: string[]) {
  const rows = await tx.product.findMany({
    where: { id: { in: [...new Set(productIds)] } },
    select: { id: true, trackStock: true, allowBackorder: true },
  });
  return new Set(rows.filter((p) => p.trackStock && !p.allowBackorder).map((p) => p.id));
}

function sortedByRow<T extends { productId: string; variantId: string | null }>(lines: T[]): T[] {
  const key = (l: T) => `${l.productId}:${l.variantId ?? ""}`;
  return [...lines].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/**
 * Com variações, o estoque do produto é a soma das variações (o painel grava assim): acompanha
 * a baixa e a devolução da variação, com atualização atômica e sem ficar negativo.
 */
async function adjustVariantTotal(tx: Tx, productId: string, delta: number) {
  if (delta >= 0) {
    await tx.product.updateMany({ where: { id: productId }, data: { stock: { increment: delta } } });
    return;
  }
  const res = await tx.product.updateMany({ where: { id: productId, stock: { gte: -delta } }, data: { stock: { decrement: -delta } } });
  if (res.count === 0) await tx.product.updateMany({ where: { id: productId }, data: { stock: 0 } });
}

/** Baixa o estoque de forma atômica (só se ainda houver a quantidade). Lança OutOfStockError. */
export async function reserveStock(tx: Tx, lines: StockLine[]) {
  const controlled = await stockControlled(
    tx,
    lines.map((l) => l.productId),
  );
  // Sempre na mesma ordem: pedidos simultâneos com os mesmos itens não se travam (deadlock).
  for (const l of sortedByRow(lines)) {
    if (controlled.has(l.productId)) {
      const res = l.variantId
        ? await tx.productVariant.updateMany({
            where: { id: l.variantId, productId: l.productId, stock: { gte: l.quantity } },
            data: { stock: { decrement: l.quantity } },
          })
        : await tx.product.updateMany({
            where: { id: l.productId, stock: { gte: l.quantity } },
            data: { stock: { decrement: l.quantity } },
          });
      if (res.count === 0) throw new OutOfStockError(l.name);
      if (l.variantId) await adjustVariantTotal(tx, l.productId, -l.quantity);
    }
    await tx.product.update({ where: { id: l.productId }, data: { soldCount: { increment: l.quantity } } });
  }
}

/** Devolve ao estoque os itens de um pedido cancelado e desfaz a contagem de vendidos. */
export async function restoreStock(tx: Tx, items: { productId: string | null; variantId: string | null; quantity: number }[]) {
  const withProduct = items.filter((i): i is { productId: string; variantId: string | null; quantity: number } => !!i.productId);
  if (withProduct.length === 0) return;
  const controlled = await stockControlled(
    tx,
    withProduct.map((i) => i.productId),
  );
  for (const i of sortedByRow(withProduct)) {
    if (controlled.has(i.productId)) {
      if (i.variantId) {
        const res = await tx.productVariant.updateMany({ where: { id: i.variantId }, data: { stock: { increment: i.quantity } } });
        if (res.count > 0) await adjustVariantTotal(tx, i.productId, i.quantity);
      } else {
        await tx.product.updateMany({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
      }
    }
    // Não deixa a contagem de vendidos ficar negativa.
    const sold = await tx.product.updateMany({
      where: { id: i.productId, soldCount: { gte: i.quantity } },
      data: { soldCount: { decrement: i.quantity } },
    });
    if (sold.count === 0) await tx.product.updateMany({ where: { id: i.productId }, data: { soldCount: 0 } });
  }
}
