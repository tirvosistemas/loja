"use client";

import { deletePromotionAction, duplicatePromotionAction } from "@/app/admin/(panel)/promocoes/actions";
import { RowActions } from "./row-actions";

export function PromotionRowActions({ id, name }: { id: string; name: string }) {
  return (
    <RowActions
      editHref={`/admin/promocoes/${id}`}
      name={`a promoção “${name}”`}
      noun="promoção"
      onDuplicate={() => duplicatePromotionAction(id)}
      onDelete={() => deletePromotionAction(id)}
      deleteDescription={`Os produtos de “${name}” voltam ao preço normal na hora. Essa ação não pode ser desfeita.`}
    />
  );
}
