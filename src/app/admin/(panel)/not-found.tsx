import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

/** 404 dentro do painel (registro excluído ou link antigo), sem sair do menu do admin. */
export default function AdminNotFound() {
  return (
    <EmptyState
      className="mt-6"
      icon={<SearchX />}
      title="Não encontramos este registro"
      description="Ele pode ter sido excluído ou o link está incompleto. Volte para a lista e tente de novo."
      action={
        <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
          Ir para o painel
        </Link>
      }
    />
  );
}
