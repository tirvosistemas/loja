import { TEST_PRODUCT, withTestDb } from "./test-product";

/** Depois da suíte: apaga o produto temporário criado em global-setup.ts. */
export default async function globalTeardown() {
  await withTestDb("apagar o produto de teste", async (db) => {
    await db.product.deleteMany({ where: { slug: TEST_PRODUCT.slug } });
  });
}
