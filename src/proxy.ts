import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Protege o painel. Cada página e ação do painel também confere a sessão no servidor.
// Também limita a página pública do pedido, para ninguém sair testando códigos em massa.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/pedido/")) {
    const rl = rateLimit(`pedido:${clientIp(request.headers)}`, 60, 60_000);
    if (rl.ok) return NextResponse.next();
    return new NextResponse("Muitas consultas seguidas. Aguarde um minuto e tente de novo.", {
      status: 429,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  if (pathname === "/admin/login") return NextResponse.next();
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = pathname === "/admin" && !search ? "" : `?voltar=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*", "/pedido/:path*"] };
