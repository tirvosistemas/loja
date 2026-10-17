"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Abre (ou reabre) a página de pagamento da Stripe para um pedido que ainda não foi pago. */
export function RetryPayment({
  code,
  label = "Tentar pagar de novo",
  size = "xl",
  className,
}: {
  code: string;
  label?: string;
  size?: "md" | "lg" | "xl";
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(code)}/pay`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (res.ok && data?.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data?.error || "Não foi possível abrir o pagamento agora. Tente de novo em instantes.");
      if (res.status === 409) setTimeout(() => window.location.reload(), 2500);
    } catch {
      setError("Sem conexão. Confira sua internet e tente de novo.");
    }
    setLoading(false);
  };

  return (
    <div className={cn("flex flex-col items-stretch gap-2 sm:items-start", className)}>
      <Button size={size} onClick={pay} loading={loading} className="w-full sm:w-auto">
        {!loading && <Lock aria-hidden />}
        {loading ? "Abrindo pagamento…" : label}
      </Button>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
