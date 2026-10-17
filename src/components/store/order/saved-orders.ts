// Pedidos feitos neste aparelho (localStorage "tirvo-orders"), para achar o pedido depois
// sem precisar do código. Guarda só o código e a data.

export type SavedOrder = { code: string; createdAt: string };

const KEY = "tirvo-orders";
const MAX = 20;

export function readSavedOrders(): SavedOrder[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((o): o is SavedOrder => !!o && typeof o.code === "string" && typeof o.createdAt === "string")
      .map((o) => ({ code: o.code.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 16), createdAt: o.createdAt }))
      .filter((o) => o.code.length >= 4);
  } catch {
    return [];
  }
}

export function saveOrderCode(code: string) {
  try {
    const list = readSavedOrders().filter((o) => o.code !== code);
    list.unshift({ code, createdAt: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Navegação privada ou armazenamento cheio: o pedido continua no código da URL.
  }
}

export function forgetSavedOrders() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
