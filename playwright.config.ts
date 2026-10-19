import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Testes de ponta a ponta (fumaça) da loja e do painel.
//
//   npx playwright test                       todos os projetos (computador e celular)
//   npx playwright test --project=desktop     só computador
//   E2E_BASE_URL=https://loja.exemplo.com.br npx playwright test
//
// Precisam do banco com o seed (npm run db:seed: administrador, configurações e categorias) e do
// DATABASE_URL do .env: o globalSetup cria um produto temporário para os testes de produto,
// carrinho e checkout e o globalTeardown apaga no final (tests/e2e/test-product.ts). Sem
// DATABASE_URL ou com E2E_BASE_URL num site remoto nada é criado e valem os produtos da loja.

// Chromium já instalado no ambiente (ex.: contêiner de desenvolvimento); senão usa o do Playwright.
const LOCAL_CHROMIUM = "/opt/pw-browsers/chromium";
const executablePath = existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
