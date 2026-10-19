import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// Produto temporário dos testes de ponta a ponta. O seed não cria produtos de demonstração,
// e os testes de produto, carrinho e checkout precisam de um que dê para comprar: o
// globalSetup cria este direto no banco do DATABASE_URL e o globalTeardown apaga no final.

export const TEST_PRODUCT = { name: "Produto de teste (e2e)", slug: "produto-teste-e2e", sku: "E2E-TESTE" } as const;
export const TEST_CATEGORY_SLUG = "headsets-gamer";

/** Carrega o .env da raiz como o seed faz; variáveis já definidas (Docker, CI) têm prioridade. */
function loadEnv() {
  const file = path.resolve(__dirname, "../../.env");
  if (existsSync(file)) process.loadEnvFile(file);
}

/** Os testes rodam na loja local? Num E2E_BASE_URL remoto o banco do .env não é o da loja testada. */
function localStore() {
  const base = process.env.E2E_BASE_URL;
  if (!base) return true;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname);
  } catch {
    return false;
  }
}

/** Roda `fn` no banco do DATABASE_URL. Sem banco configurado ou com loja remota não faz nada e devolve false. */
export async function withTestDb(action: string, fn: (db: PrismaClient) => Promise<void>) {
  loadEnv();
  if (!process.env.DATABASE_URL || !localStore()) return false;
  const db = new PrismaClient();
  try {
    await fn(db);
  } catch (err) {
    // Banco fora do ar não derruba a suíte: a página inicial e o painel ainda são testados.
    console.warn(`[e2e] Não foi possível ${action}: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await db.$disconnect();
  }
  return true;
}
