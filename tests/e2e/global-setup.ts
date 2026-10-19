import { TEST_CATEGORY_SLUG, TEST_PRODUCT, withTestDb } from "./test-product";

/** Antes da suíte: cria o produto temporário (apagado em global-teardown.ts). */
export default async function globalSetup() {
  const hasDb = await withTestDb("criar o produto de teste", async (db) => {
    // Sobra de uma execução interrompida. Fotos, variações e avaliações saem junto (cascata)
    // e itens de pedido só perdem o vínculo; o SKU também é único, então entra no filtro.
    await db.product.deleteMany({ where: { OR: [{ slug: TEST_PRODUCT.slug }, { sku: TEST_PRODUCT.sku }] } });
    const category = await db.category.findUnique({ where: { slug: TEST_CATEGORY_SLUG }, select: { id: true } });
    await db.product.create({
      data: {
        ...TEST_PRODUCT,
        status: "ACTIVE",
        priceCents: 9990,
        stock: 50,
        trackStock: true,
        featured: true,
        isNew: true,
        categoryId: category?.id ?? null,
      },
    });
    console.log(`[e2e] Produto temporário criado: /produto/${TEST_PRODUCT.slug}`);
  });
  if (!hasDb) {
    console.warn("[e2e] Sem DATABASE_URL ou com E2E_BASE_URL remoto: o produto de teste não foi criado. Produto, carrinho e checkout usam os produtos que a loja já tiver.");
  }
}
