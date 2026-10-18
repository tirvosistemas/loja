"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Campo de busca que atualiza o parâmetro ?q= da URL (com atraso de digitação). */
export function SearchBox({ placeholder = "Buscar…", param = "q", className }: { placeholder?: string; param?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const urlValue = sp.get(param) ?? "";
  const [value, setValue] = useState(urlValue);
  // Último texto que este campo mandou para a URL.
  const pushed = useRef(urlValue);

  // A URL mudou por fora (“Ver todos”, menu, voltar do navegador): o campo acompanha,
  // senão o texto antigo voltaria para a URL logo em seguida.
  useEffect(() => {
    if (urlValue === pushed.current) return;
    pushed.current = urlValue;
    setValue(urlValue);
  }, [urlValue]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (urlValue === value) return;
      const next = new URLSearchParams(sp.toString());
      if (value) next.set(param, value);
      else next.delete(param);
      next.delete("page");
      pushed.current = value;
      router.replace(`${pathname}?${next.toString()}`);
    }, 350);
    return () => clearTimeout(t);
  }, [value, urlValue, param, pathname, router, sp]);

  return (
    <div className={className}>
      <Input type="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} leading={<Search />} aria-label={placeholder} />
    </div>
  );
}
