import { expect, test, type Page } from "@playwright/test";

// Fumaça da loja: página inicial, produto, carrinho, checkout e login no painel.
// Rode com a loja de demonstração carregada (npm run db:seed).

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@tirvo.com.br";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "tirvo123";

test.beforeEach(async ({ page }) => {
  // Sem o aviso de cookies e sem o convite de notificações cobrindo a tela.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("tirvo-consent", "essential");
      localStorage.setItem("tirvo-push-dismissed", String(Date.now()));
    } catch {}
  });
});

/** Links de produto visíveis na página atual (sem repetir). */
async function productLinks(page: Page) {
  const hrefs = await page
    .locator('main a[href^="/produto/"]')
    .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? "").filter(Boolean));
  return [...new Set(hrefs)];
}

/** Abre um produto da página inicial que possa ir para o carrinho. */
async function openBuyableProduct(page: Page) {
  await page.goto("/");
  const hrefs = await productLinks(page);
  expect(hrefs.length, "a página inicial deveria listar produtos (rode o seed de demonstração)").toBeGreaterThan(0);
  for (const href of hrefs.slice(0, 8)) {
    await page.goto(href);
    const add = page.getByRole("button", { name: "Adicionar ao carrinho", exact: true });
    if (await add.isVisible().catch(() => false)) return add;
  }
  throw new Error("Nenhum produto com estoque encontrado entre os primeiros da página inicial.");
}

test("página inicial mostra o logo animado e produtos", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Tirvo/);
  const logoLink = page.getByRole("banner").getByRole("link", { name: "Tirvo — página inicial" });
  await expect(logoLink).toBeVisible();
  await expect(logoLink.locator("svg.tirvo-anim")).toBeVisible();
  expect((await productLinks(page)).length).toBeGreaterThan(0);
});

test("produto abre a partir da página inicial", async ({ page }) => {
  await page.goto("/");
  const card = page.locator('main a[href^="/produto/"]').first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await expect(page).toHaveURL(/\/produto\/[a-z0-9-]+/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("carrinho: adicionar abre a gaveta, a página do carrinho mostra o item e o checkout abre o formulário", async ({ page }) => {
  const add = await openBuyableProduct(page);
  const name = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

  await test.step("escolhe a voltagem, quando houver", async () => {
    const option = page.locator('[role="radiogroup"] [role="radio"]:not([disabled])').first();
    if (await option.count()) await option.click();
  });

  await test.step("adicionar abre a gaveta do carrinho", async () => {
    await add.click();
    const drawer = page.getByRole("dialog").filter({ hasText: "Seu carrinho" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(name, { exact: false }).first()).toBeVisible();
    await drawer.getByRole("link", { name: "Ver carrinho" }).click();
  });

  await test.step("a página do carrinho mostra o item", async () => {
    await expect(page).toHaveURL(/\/carrinho/);
    await expect(page.locator("main").getByText(name, { exact: false }).first()).toBeVisible();
  });

  await test.step("o checkout mostra o formulário", async () => {
    await page.goto("/checkout");
    await expect(page.getByLabel("Nome completo")).toBeVisible();
    await expect(page.getByLabel("WhatsApp").first()).toBeVisible();
    // No celular o resumo do pedido começa recolhido: basta o item estar na página.
    await expect(page.locator("main").getByText(name, { exact: false }).first()).toBeAttached();
  });
});

test("painel: login do administrador chega ao dashboard", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Vendas · últimos 30 dias")).toBeVisible();
});
