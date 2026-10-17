"use client";

import { useEffect } from "react";
import "./globals.css";

/** Último recurso: falha no layout raiz. Página mínima, com estilos próprios. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR" data-theme="dark">
      <body
        style={{
          minHeight: "100dvh",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#f4f4f5",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <title>Algo deu errado · Tirvo</title>
        <main style={{ maxWidth: 420 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/tirvo-logo-para-fundo-escuro.svg" alt="Tirvo" style={{ height: 32, width: "auto", margin: "0 auto 32px", display: "block" }} />
          <p style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#71717a", margin: 0 }}>
            Erro inesperado
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 600, margin: "8px 0 12px" }}>Algo deu errado por aqui</h1>
          <p style={{ color: "#a1a1aa", margin: "0 0 28px", lineHeight: 1.5 }}>
            Já estamos de olho. Tente carregar de novo em alguns segundos; seu carrinho continua salvo.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{ height: 48, padding: "0 22px", borderRadius: 14, border: 0, background: "#ff5500", color: "#09090b", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
            >
              Tentar de novo
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{ height: 48, padding: "0 22px", borderRadius: 14, border: "1px solid #2e2e36", color: "#f4f4f5", fontWeight: 500, fontSize: 15, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
            >
              Ir para o início
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
