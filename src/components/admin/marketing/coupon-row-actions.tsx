"use client";

import { deleteCouponAction } from "@/app/admin/(panel)/cupons/actions";
import { RowActions } from "./row-actions";

export function CouponRowActions({ id, code, used }: { id: string; code: string; used: number }) {
  return (
    <RowActions
      editHref={`/admin/cupons/${id}`}
      name={`o cupom ${code}`}
      noun="cupom"
      onDelete={() => deleteCouponAction(id)}
      deleteDescription={
        used > 0
          ? `O cupom ${code} já foi usado ${used === 1 ? "1 vez" : `${used} vezes`}. Os pedidos continuam com o desconto, mas as estatísticas do cupom somem. Para só pausar, desative.`
          : `O cupom ${code} deixa de funcionar na hora. Essa ação não pode ser desfeita.`
      }
    />
  );
}
