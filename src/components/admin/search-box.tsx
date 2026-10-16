"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Campo de busca que atualiza o parâmetro ?q= da URL (com atraso de digitação). */
export function SearchBox({ placeholder = "Buscar…", param = "q", className }: { placeholder?: string; param?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get(param) ?? "");
  useEffect(() => {
    const t = setTimeout(() => {
      if ((sp.get(param) ?? "") === value) return;
      const next = new URLSearchParams(sp.toString());
      if (value) next.set(param, value);
      else next.delete(param);
      next.delete("page");
      router.replace(`${pathname}?${next.toString()}`);
    }, 350);
    return () => clearTimeout(t);
  }, [value, param, pathname, router, sp]);
  return (
    <div className={className}>
      <Input type="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} leading={<Search />} aria-label={placeholder} />
    </div>
  );
}
