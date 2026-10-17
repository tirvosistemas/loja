"use client";

import { Boxes, FolderTree, Package, Tags } from "lucide-react";
import { FieldError } from "@/components/ui/input";
import type { BrandOption, CategoryOption } from "./data";
import { ChoiceCards } from "./form-bits";
import { SCOPE_OPTIONS } from "./labels";
import { BrandMultiSelect, CategoryMultiSelect } from "./option-multi-select";
import { ProductPicker } from "./product-picker";
import type { ScopeKey } from "./rules";

const ICONS: Record<ScopeKey, React.ReactNode> = {
  ALL: <Boxes aria-hidden />,
  CATEGORY: <FolderTree aria-hidden />,
  BRAND: <Tags aria-hidden />,
  PRODUCTS: <Package aria-hidden />,
};

export type ScopeValue = { scope: ScopeKey; categoryIds: string[]; brandIds: string[]; productIds: string[] };

/** Escolha do escopo (todos, categorias, marcas ou produtos) com o seletor correspondente. */
export function ScopeFields({
  value,
  onChange,
  categories,
  brands,
  errors,
  name = "scope",
}: {
  value: ScopeValue;
  onChange: (patch: Partial<ScopeValue>) => void;
  categories: CategoryOption[];
  brands: BrandOption[];
  errors: Record<string, string>;
  name?: string;
}) {
  return (
    <div className="space-y-4">
      <ChoiceCards
        name={name}
        value={value.scope}
        onChange={(scope) => onChange({ scope })}
        columns={4}
        options={SCOPE_OPTIONS.map((o) => ({ value: o.value, label: o.label, hint: o.hint, icon: ICONS[o.value] }))}
      />

      {value.scope === "CATEGORY" && (
        <div data-field="categoryIds">
          <p className="mb-1.5 text-sm font-medium">Categorias</p>
          <CategoryMultiSelect options={categories} value={value.categoryIds} onChange={(categoryIds) => onChange({ categoryIds })} invalid={!!errors.categoryIds} />
          {!errors.categoryIds && categories.some((c) => c.parentId) && <p className="mt-1.5 text-[13px] text-subtle">Ao marcar uma categoria, as subcategorias dela são marcadas juntas.</p>}
          <FieldError>{errors.categoryIds}</FieldError>
        </div>
      )}
      {value.scope === "BRAND" && (
        <div data-field="brandIds">
          <p className="mb-1.5 text-sm font-medium">Marcas</p>
          <BrandMultiSelect options={brands} value={value.brandIds} onChange={(brandIds) => onChange({ brandIds })} invalid={!!errors.brandIds} />
          <FieldError>{errors.brandIds}</FieldError>
        </div>
      )}
      {value.scope === "PRODUCTS" && (
        <div data-field="productIds">
          <p className="mb-1.5 text-sm font-medium">Produtos</p>
          <ProductPicker value={value.productIds} onChange={(productIds) => onChange({ productIds })} invalid={!!errors.productIds} />
          <FieldError>{errors.productIds}</FieldError>
        </div>
      )}
    </div>
  );
}
