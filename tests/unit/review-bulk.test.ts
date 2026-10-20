import { beforeEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { applySheet, rowsToSheet, SHEET_COLUMNS, sheetToCsv, type BulkRow } from "@/lib/admin/bulk";
import { buildXlsx } from "@/lib/xlsx-write";
import { parseCsv, parseXlsx, readXlsx } from "@/lib/importer/sheet";
import { saveBulkEdit } from "@/app/admin/(panel)/produtos/editar-em-massa/actions";

// Banco falso para a server action: só o que saveBulkEdit usa, com rollback na transação.
const fake = vi.hoisted(() => {
  type V = { id: string; productId: string; name: string; sku: string | null; priceCents: number | null; compareAtCents: number | null; stock: number; active: boolean };
  type P = { id: string; name: string; sku: string | null; priceCents: number; compareAtCents: number | null; stock: number; variants: V[] };
  const s = { products: [] as P[] };
  const match = (row: Record<string, unknown>, where: Record<string, unknown>) => Object.entries(where).every(([k, v]) => row[k] === v);
  const variants = () => s.products.flatMap((p) => p.variants);
  const tx = {
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => structuredClone(s.products.find((p) => p.id === where.id) ?? null),
      findFirst: async () => null,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
        const list = s.products.filter((p) => match(p, where));
        list.forEach((p) => Object.assign(p, data));
        return { count: list.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: object }) => Object.assign(s.products.find((p) => p.id === where.id)!, data),
    },
    productVariant: {
      findFirst: async () => null,
      findMany: async ({ where }: { where: { productId: string; active: boolean } }) => variants().filter((v) => v.productId === where.productId && v.active),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
        const list = variants().filter((v) => match(v, where));
        list.forEach((v) => Object.assign(v, data));
        return { count: list.length };
      },
    },
  };
  const db = {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      const snap = structuredClone(s.products);
      try {
        return await fn(tx);
      } catch (e) {
        s.products = snap;
        throw e;
      }
    },
    category: { findMany: async () => [] },
    brand: { findMany: async () => [] },
  };
  return { s, db };
});

vi.mock("@/lib/db", () => ({ db: fake.db }));
vi.mock("@/lib/auth", () => ({ requireAdmin: async () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));


const row = (p: Partial<BulkRow>): BulkRow => ({
  key: "p:1",
  productId: "1",
  variantId: null,
  name: "Fone",
  sku: "F1",
  priceCents: 1999,
  compareAtCents: null,
  costCents: 1000,
  stock: 10,
  categoryId: "",
  brandId: "",
  status: "ACTIVE",
  weightGrams: 250,
  widthCm: null,
  heightCm: null,
  depthCm: null,
  freeShipping: false,
  ean: "7894900011517",
  hasVariants: false,
  image: null,
  ...p,
});

const lookup = { categories: [], brands: [] };
const col = (h: string) => SHEET_COLUMNS.findIndex((c) => c.header === h);
const PRICE = col("Preço");
const COST = col("Custo");
const STOCK = col("Estoque");
const WEIGHT = col("Peso (g)");
const EAN = col("EAN");
const SKU = col("SKU");
const NAME = col("Nome");

const viaXlsx = (current: BulkRow[], cells: (string | number | null)[][]) => {
  const x = readXlsx(buildXlsx(cells));
  return applySheet(current, x.rows, lookup, { numeric: x.numeric });
};
const viaCsv = (current: BulkRow[], cells: (string | number | null)[][]) => applySheet(current, parseCsv(sheetToCsv(cells).replace(/^\uFEFF/, "")), lookup);

describe("planilha: números do .xlsx (K1)", () => {
  it("lê célula numérica com ponto decimal, sem a regra de milhar", () => {
    const rows = [row({})];
    const cells = rowsToSheet(rows, lookup);
    cells[1][PRICE] = 19.99 * 1.1; // =E2*1,1 no Excel → 21.989
    cells[1][COST] = 0.125;
    cells[1][WEIGHT] = 1200.4;
    const r = viaXlsx(rows, cells);
    expect(r.rows[0]).toMatchObject({ priceCents: 2199, costCents: 13, weightGrams: 1200 });
    expect(r.notes).toEqual([]);
  });

  it("estoque fracionado no .xlsx vira aviso, não 45", () => {
    const rows = [row({})];
    const cells = rowsToSheet(rows, lookup);
    cells[1][STOCK] = 4.5;
    const r = viaXlsx(rows, cells);
    expect(r.rows[0].stock).toBe(10);
    expect(r.notes.join(" ")).toMatch(/estoque inválido/);
  });

  it("texto no .xlsx e CSV seguem o jeito brasileiro", () => {
    const rows = [row({})];
    const cells = rowsToSheet(rows, lookup);
    cells[1][PRICE] = "1.299"; // texto: mil duzentos e noventa e nove
    expect(viaXlsx(rows, cells).rows[0].priceCents).toBe(129900);
    expect(viaCsv(rows, cells).rows[0].priceCents).toBe(129900);
    cells[1][PRICE] = "21,99";
    expect(viaCsv(rows, cells).rows[0].priceCents).toBe(2199);
  });

  it("readXlsx marca só as células numéricas; parseXlsx continua igual", () => {
    const data = buildXlsx([["a", 1.5, null, "2"]]);
    expect(readXlsx(data)).toEqual({ rows: [["a", "1.5", "", "2"]], numeric: [[false, true, false, false]] });
    expect(parseXlsx(data)).toEqual([["a", "1.5", "", "2"]]);
  });
});

describe("planilha: EAN e SKU estragados pelo Excel (K2/K10)", () => {
  it("EAN em notação científica fica como estava, com aviso", () => {
    const rows = [row({})];
    const cells = rowsToSheet(rows, lookup);
    cells[1][EAN] = "7,89490E+12";
    const r = viaCsv(rows, cells);
    expect(r.rows[0].ean).toBe("7894900011517");
    expect(r.changed).toBe(0);
    expect(r.notes.join(" ")).toMatch(/notação científica/);
  });

  it("EAN com dígito verificador errado não entra; EAN válido entra (espaços ignorados)", () => {
    const rows = [row({})];
    const cells = rowsToSheet(rows, lookup);
    cells[1][EAN] = "78912312";
    expect(viaCsv(rows, cells).rows[0].ean).toBe("7894900011517");
    cells[1][EAN] = "7891 2345 67895";
    const r = viaCsv(rows, cells);
    expect(r.rows[0].ean).toBe("7891234567895");
    expect(r.notes).toEqual([]);
  });

  it("EAN atual inválido que volta igual não gera aviso", () => {
    const rows = [row({ ean: "12345678" })];
    const r = viaCsv(rows, rowsToSheet(rows, lookup));
    expect(r.changed).toBe(0);
    expect(r.notes).toEqual([]);
  });

  it("SKU sem os zeros à esquerda ou em notação científica fica como estava", () => {
    const rows = [row({ sku: "000123" })];
    const cells = rowsToSheet(rows, lookup);
    cells[1][SKU] = "123";
    let r = viaCsv(rows, cells);
    expect(r.rows[0].sku).toBe("000123");
    expect(r.notes.join(" ")).toMatch(/SKU “123”/);
    cells[1][SKU] = "1,23457E+11";
    r = viaCsv(rows, cells);
    expect(r.rows[0].sku).toBe("000123");
    cells[1][SKU] = "ABC-9";
    expect(viaCsv(rows, cells).rows[0].sku).toBe("ABC-9");
  });
});

describe("planilha: estoque na exportação (K3)", () => {
  const exported = [row({})]; // estoque 10 na exportação

  it("estoque não mexido não desfaz vendas feitas depois da exportação", () => {
    const cells = rowsToSheet(exported, lookup);
    cells[1][PRICE] = 25;
    const now = [row({ stock: 9 })]; // vendeu 1
    const r = viaXlsx(now, cells);
    expect(r.rows[0]).toMatchObject({ stock: 9, priceCents: 2500 });
    expect(r.notes).toEqual([]);
  });

  it("estoque mexido aplica só a diferença, com aviso quando o banco mudou", () => {
    const cells = rowsToSheet(exported, lookup);
    cells[1][STOCK] = 15;
    let r = viaXlsx([row({ stock: 9 })], cells);
    expect(r.rows[0].stock).toBe(14);
    expect(r.notes.join(" ")).toMatch(/mudou de 10 para 9.*\+5.*ficou 14/);
    r = viaXlsx(exported, cells);
    expect(r.rows[0].stock).toBe(15);
    expect(r.notes).toEqual([]);
    cells[1][STOCK] = 0;
    expect(viaXlsx([row({ stock: 3 })], cells).rows[0].stock).toBe(0); // não fica negativo
  });

  it("planilha antiga, sem a coluna, usa o valor absoluto", () => {
    const cells = rowsToSheet(exported, lookup).map((r) => r.slice(0, -1));
    cells[1][STOCK] = 12;
    expect(viaCsv([row({ stock: 9 })], cells).rows[0].stock).toBe(12);
  });

  it("a coluna nova vem por último e vale para variações", () => {
    const rows = [row({ hasVariants: true }), row({ key: "v:9", variantId: "9", name: "Preto", sku: "F1-P", stock: 4, costCents: null })];
    const cells = rowsToSheet(rows, lookup);
    expect(cells[0].at(-1)).toBe("Estoque na exportação (não editar)");
    expect(cells[1].at(-1)).toBeNull();
    expect(cells[2].at(-1)).toBe(4);
    expect(viaXlsx(rows, cells).changed).toBe(0);
  });
});

describe("planilha: categoria com nome repetido (K21)", () => {
  const cats = { categories: [{ id: "a", label: "Acessórios" }, { id: "cel", label: "Celulares" }, { id: "b", label: "Celulares › Acessórios" }, { id: "c", label: "Informática › Acessórios" }], brands: [] };

  it("exportação sem mudança não troca a categoria", () => {
    const rows = [row({ categoryId: "a" }), row({ key: "p:2", productId: "2", sku: "F2", categoryId: "b" })];
    const r = applySheet(rows, parseXlsx(buildXlsx(rowsToSheet(rows, cats))), cats);
    expect(r.changed).toBe(0);
    expect(r.notes).toEqual([]);
  });

  it("nome curto ambíguo pede o caminho completo", () => {
    const rows = [row({ categoryId: "cel" })];
    const cells = rowsToSheet(rows, { categories: cats.categories.slice(1), brands: [] });
    cells[1][col("Categoria")] = "Acessórios";
    const r = applySheet(rows, parseCsv(sheetToCsv(cells)), { categories: cats.categories.slice(1), brands: [] });
    expect(r.rows[0].categoryId).toBe("cel");
    expect(r.notes.join(" ")).toMatch(/Celulares › Acessórios ou Informática › Acessórios/);
  });
});

describe("planilha: peso com milhar (K24)", () => {
  it("“2.000” no CSV é 2000 g", () => {
    const rows = [row({})];
    const cells = rowsToSheet(rows, lookup);
    for (const [v, g] of [
      ["2.000", 2000],
      ["1.200 g", 1200],
      ["1,2 kg", 1200],
      ["1.200 kg", 1200],
      ["300", 300],
    ] as const) {
      cells[1][WEIGHT] = v;
      expect(viaCsv(rows, cells).rows[0].weightGrams).toBe(g);
    }
  });
});

describe("planilha parcial (K25)", () => {
  it("aviso na primeira linha, cabeçalho congelado junto, e a volta continua funcionando", () => {
    const rows = [row({})];
    const cells = rowsToSheet(rows, lookup, "Atenção: planilha parcial.");
    expect(cells[0][0]).toBe("Atenção: planilha parcial.");
    expect(cells[1][0]).toBe("ID");
    const data = buildXlsx(cells, { frozenRows: 2 });
    expect(strFromU8(unzipSync(data)["xl/worksheets/sheet1.xml"])).toContain('ySplit="2" topLeftCell="A3"');
    expect(viaXlsx(rows, cells)).toMatchObject({ changed: 0, notes: [] });
    cells[2][PRICE] = "x";
    expect(viaCsv(rows, cells).notes[0]).toMatch(/^Linha 3:/);
  });
});

describe("CSV sem fórmulas (K26)", () => {
  it("texto que começa com = + - @ ganha apóstrofo e volta sem ele", () => {
    const rows = [row({ name: '=HYPERLINK("https://x";"a")', sku: "-F1" }), row({ key: "p:2", productId: "2", name: "+Som", sku: "@2" })];
    const csv = sheetToCsv(rowsToSheet(rows, lookup));
    expect(csv).toContain(`"'=HYPERLINK(""https://x"";""a"")"`);
    expect(csv).toContain(";'-F1;");
    expect(csv).toContain(";'+Som;'@2;");
    const r = applySheet(rows, parseCsv(csv), lookup);
    expect(r.changed).toBe(0);
    expect(r.notes).toEqual([]);
  });

  it("número negativo e texto comum não mudam", () => {
    expect(sheetToCsv([["Fone", -1.5, "a-b"]])).toBe("\uFEFFFone;-1,5;a-b\r\n");
  });
});

describe("salvar edição em massa (K3/K22/K23)", () => {
  const product = (p: object) => ({ id: "1", name: "Fone", sku: null, priceCents: 1999, compareAtCents: null, stock: 10, variants: [], ...p });
  const variant = (v: object) => ({ id: "9", productId: "2", name: "Preto", sku: null, priceCents: null, compareAtCents: null, stock: 4, active: true, ...v });

  beforeEach(() => {
    fake.s.products = [product({}), product({ id: "2", name: "Controle", stock: 6, variants: [variant({}), variant({ id: "8", name: "Branco", stock: 2 })] })];
  });

  it("grava o estoque quando ainda é o que a página mostrou", async () => {
    const r = await saveBulkEdit([{ key: "p:1", productId: "1", variantId: null, fields: { stock: 30, name: "Fone novo" }, expectedStock: 10 }]);
    expect(r.ok && r.data).toEqual({ saved: 1, errors: [] });
    expect(fake.s.products[0]).toMatchObject({ stock: 30, name: "Fone novo" });
  });

  it("venda no meio tempo: recusa o produto inteiro", async () => {
    fake.s.products[0].stock = 7;
    const r = await saveBulkEdit([{ key: "p:1", productId: "1", variantId: null, fields: { stock: 30, priceCents: 2500 }, expectedStock: 10 }]);
    expect(r.ok && r.data?.saved).toBe(0);
    expect(r.ok && r.data?.errors[0]).toMatchObject({ key: "p:1", message: expect.stringMatching(/estoque mudou/) });
    expect(fake.s.products[0]).toMatchObject({ stock: 7, priceCents: 1999 });
  });

  it("variação: confere o estoque e refaz a soma do produto", async () => {
    let r = await saveBulkEdit([
      { key: "p:2", productId: "2", variantId: null, fields: { priceCents: 5000 }, expectedStock: 6 },
      { key: "v:9", productId: "2", variantId: "9", fields: { stock: 10 }, expectedStock: 3 },
    ]);
    expect(r.ok && r.data?.errors.map((e) => e.key)).toEqual(["v:9"]);
    expect(fake.s.products[1]).toMatchObject({ priceCents: 1999, stock: 6 });
    r = await saveBulkEdit([{ key: "v:9", productId: "2", variantId: "9", fields: { stock: 10 }, expectedStock: 4 }]);
    expect(r.ok && r.data?.saved).toBe(1);
    expect(fake.s.products[1]).toMatchObject({ stock: 12 });
    expect(fake.s.products[1].variants[0].stock).toBe(10);
  });

  it("linha inválida trava as outras linhas do mesmo produto", async () => {
    const r = await saveBulkEdit([
      { key: "p:2", productId: "2", variantId: null, fields: { priceCents: 12000 }, expectedStock: 6 },
      { key: "v:9", productId: "2", variantId: "9", fields: { priceCents: 0 }, expectedStock: 4 },
      { key: "p:1", productId: "1", variantId: null, fields: { name: "Fone 2" }, expectedStock: 10 },
    ]);
    expect(r.ok && r.data?.saved).toBe(1);
    const errors = r.ok ? (r.data?.errors ?? []) : [];
    expect(errors.map((e) => e.key).sort()).toEqual(["p:2", "v:9"]);
    expect(errors.find((e) => e.key === "p:2")?.message).toMatch(/nada dele foi salvo/);
    expect(fake.s.products[1].priceCents).toBe(1999);
    expect(fake.s.products[0].name).toBe("Fone 2");
  });
});
