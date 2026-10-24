import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidGtin, tidyTitle, upcEToUpcA } from "@/lib/barcode";
import { fetchImage, isPrivateIp } from "@/lib/importer/fetch-image";
import { ensureBrand, findDuplicate, type Catalog } from "@/lib/importer/server";
import { buildDraft } from "@/lib/importer/build";

const db = vi.hoisted(() => ({
  brand: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  product: { findFirst: vi.fn(), findUnique: vi.fn() },
  productVariant: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/app/admin/(panel)/produtos/actions", () => ({ createProduct: vi.fn() }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("títulos das bases de código de barras", () => {
  it("mantém siglas, marcas e códigos com números", () => {
    expect(tidyTitle("LG")).toBe("LG");
    expect(tidyTitle("3M")).toBe("3M");
    expect(tidyTitle('SMART TV LG 43" 4K UHD')).toBe('Smart TV LG 43" 4K UHD');
    expect(tidyTitle("CARREGADOR 20W USB-C IPHONE")).toBe("Carregador 20W USB-C Iphone");
    expect(tidyTitle("FONE DE OUVIDO JBL TUNE 510BT")).toBe("Fone De Ouvido JBL Tune 510BT");
    expect(tidyTitle("SMART TV LED 43 LG 43LM6300PSB FULL HD")).toBe("Smart TV LED 43 LG 43LM6300PSB Full HD");
    expect(tidyTitle("ROTEADOR WI-FI TP-LINK")).toBe("Roteador Wi-Fi TP-Link");
    expect(tidyTitle("ÁUDIO E VÍDEO")).toBe("Áudio E Vídeo");
    expect(tidyTitle("Fone JBL")).toBe("Fone JBL");
  });
});

describe("UPC-E", () => {
  it("vira UPC-A por extenso", () => {
    expect(isValidGtin("04252614")).toBe(false);
    expect(upcEToUpcA("04252614")).toBe("042100005264");
    expect(upcEToUpcA("01234531")).toBe("012300000451");
    expect(upcEToUpcA("01234565")).toBe("012345000065");
    expect(upcEToUpcA("01234522")).toBeNull(); // dígito verificador não fecha
    expect(upcEToUpcA("21234565")).toBeNull(); // só sistema 0 ou 1
    expect(upcEToUpcA("7891234567895")).toBeNull();
  });
});

describe("busca pelo código de barras", () => {
  beforeEach(() => {
    vi.resetModules(); // fila e cache da UPCitemdb zerados
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
  });
  const load = async () => (await import("@/lib/barcode")).lookupBarcode;
  // As bases Open*Facts não acham nada; o `fetch` do teste recebe só o resto (Cosmos e UPCitemdb).
  const stub = (fetch: (url: string) => Promise<Response>) => vi.stubGlobal("fetch", (url: string) => (url.includes("facts.org/") ? json({ status: 0 }, 404) : fetch(url)));

  it("acha nas bases Open*Facts antes da UPCitemdb", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes("openbeautyfacts") ? json({ status: 1, product: { product_name_pt: "Protetor solar FPS 50", brands: "Sundown", quantity: "200 ml" } }) : json({ status: 0 }, 404),
    );
    vi.stubGlobal("fetch", fetch);
    expect(await (await load())("7891010031855", "")).toMatchObject({ source: "Open Beauty Facts", name: "Protetor solar FPS 50", brand: "Sundown", weightGrams: null });
    expect(fetch.mock.calls.some(([u]) => u.includes("upcitemdb"))).toBe(false);
  });

  it("busca UPC-E como UPC-A e devolve o código buscado", async () => {
    const fetch = vi.fn(async (_url: string) => json({ items: [{ title: "Pilha AA" }] }));
    stub(fetch);
    const r = await (await load())("04252614", "");
    expect(r?.ean).toBe("042100005264");
    expect(fetch.mock.calls[0][0]).toContain("upc=042100005264");
  });

  it("Cosmos: peso em gramas inteiras, medida fora do limite fica de fora e marca como veio", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ description: "FONE DE OUVIDO JBL TUNE 510BT", brand: { name: "JBL" }, gross_weight: 395.5, width: 2000, height: 18.5, length: 6 })));
    const r = await (await load())("7891234567895", "token");
    expect(r).toMatchObject({ source: "Cosmos", name: "Fone De Ouvido JBL Tune 510BT", brand: "JBL", weightGrams: 396, widthCm: null, heightCm: 18.5, depthCm: 6 });
  });

  it("UPCitemdb: uma consulta a cada 10 s, a primeira na hora, e guarda o resultado", async () => {
    const fetch = vi.fn(async (url: string) => (url.includes("7891000000014") ? json({ code: "OK", items: [] }) : json({ items: [{ title: "Fone", brand: "baseus" }] })));
    stub(fetch);
    const lookup = await load();
    expect(await lookup("7891234567895", "")).toMatchObject({ name: "Fone", brand: "baseus" });
    const second = lookup("7891000000014", "");
    await vi.advanceTimersByTimeAsync(9_999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await second).toBeNull();
    // Já consultados (inclusive o não encontrado) não gastam a cota.
    expect(await lookup("7891234567895", "")).toMatchObject({ name: "Fone" });
    expect(await lookup("7891000000014", "")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("UPCitemdb rápido demais: espera e tenta mais uma vez", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ code: "TOO_FAST" }, 429)).mockResolvedValueOnce(json({ items: [{ title: "Fone" }] }));
    stub(fetch);
    const p = (await load())("7891234567895", "");
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toMatchObject({ name: "Fone" });
  });

  it("UPCitemdb ainda rápido demais depois de esperar: aviso próprio, não o de limite diário", async () => {
    const fetch = vi.fn(async () => json({ code: "TOO_FAST" }, 429));
    stub(fetch);
    const check = expect((await load())("7891234567895", "")).rejects.toThrow("Muitas consultas seguidas");
    await vi.advanceTimersByTimeAsync(30_000);
    await check;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("UPCitemdb sem cota no dia: avisa e não consulta de novo", async () => {
    const fetch = vi.fn(async () => json({ code: "EXCEED_LIMIT" }, 429));
    stub(fetch);
    const lookup = await load();
    await expect(lookup("7891234567895", "")).rejects.toThrow("limite de hoje");
    await expect(lookup("7891000000014", "")).rejects.toThrow("limite de hoje");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("fotos por link", () => {
  it("reconhece endereço interno também dentro do IPv6", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "::1", "::", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "::7f00:1", "64:ff9b::a00:1", "64:ff9b::10.0.0.1", "fd00::1", "fe80::1", "ff02::1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "::ffff:808:808", "64:ff9b::808:808", "2001:4860:4860::8888"]) expect(isPrivateIp(ip), ip).toBe(false);
  });

  it("não baixa de IPv6 que aponta para a rede interna", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const u of ["http://[::ffff:127.0.0.1]:9/x.jpg", "http://[::ffff:a9fe:a9fe]/x.jpg", "http://[64:ff9b::a00:1]/x.jpg"]) {
      await expect(fetchImage(u)).rejects.toThrow("endereço interno");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("para de ler assim que a foto passa do limite", async () => {
    let chunks = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        chunks++;
        c.enqueue(new Uint8Array(1024));
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { headers: { "content-type": "image/jpeg" } })));
    await expect(fetchImage("http://93.184.216.34/x.jpg", { maxBytes: 4096 })).rejects.toThrow("Foto grande demais.");
    expect(chunks).toBeLessThan(10);
  });

  it("lê a foto inteira dentro do limite", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } })));
    expect([...(await fetchImage("http://93.184.216.34/x.png"))]).toEqual([1, 2, 3]);
  });
});

describe("importador no banco", () => {
  const catalog = (): Catalog => ({ categories: [], brands: [] });

  it("acha produto repetido pelo EAN", async () => {
    db.product.findFirst.mockResolvedValueOnce({ id: "p1", name: "Fone JBL Tune 510BT" });
    const { draft } = buildDraft("Fone Bluetooth", "preço: 99\nean: 7891234567895");
    expect(await findDuplicate(draft)).toEqual({ id: "p1", name: "Fone JBL Tune 510BT" });
    expect(db.product.findFirst).toHaveBeenCalledWith({ where: { ean: "7891234567895" }, select: { id: true, name: true } });
  });

  it("usa a marca que outra importação acabou de criar", async () => {
    db.brand.findFirst.mockResolvedValueOnce({ id: "b1", name: "Baseus" });
    const cat = catalog();
    expect(await ensureBrand("BASEUS", cat)).toBe("b1");
    expect(db.brand.create).not.toHaveBeenCalled();
    expect(cat.brands).toEqual([{ id: "b1", name: "Baseus", key: "baseus" }]);
  });

  it("cria a marca com o nome como veio quando não existe", async () => {
    db.brand.findFirst.mockResolvedValueOnce(null);
    db.brand.findUnique.mockResolvedValue(null);
    db.brand.create.mockResolvedValueOnce({ id: "b2" });
    const cat = catalog();
    expect(await ensureBrand("JBL", cat)).toBe("b2");
    expect(db.brand.create).toHaveBeenCalledWith({ data: { name: "JBL", slug: "jbl" }, select: { id: true } });
  });
});

describe("importação com código de barras e fotos padronizadas", () => {
  const upc = { source: "UPCitemdb", ean: "7891234567895", name: "JBL Tune 510BT Wireless Headphones", brand: "JBL", model: "T510BT", color: "Black", description: "Pure Bass Sound", category: null, images: [], weightGrams: 160, widthCm: null, heightCm: null, depthCm: null };
  const mocked = ["@/lib/auth", "@/lib/settings", "@/lib/uploads", "@/lib/admin/uploads", "@/lib/ai/client", "@/lib/ai/product", "@/lib/barcode", "@/lib/importer/server", "@/lib/admin/standardize"];
  afterEach(() => mocked.forEach((path) => vi.doUnmock(path)));
  const fill = { name: "Fone de Ouvido JBL Tune 510BT Preto", brand: null, model: null, color: "Preto", category: null, shortDescription: null, description: "Fone sem fio com graves fortes.", specs: [], voltage: null, warrantyMonths: null, weightGrams: null, widthCm: null, heightCm: null, depthCm: null, ean: null, tags: [], metaTitle: null, metaDescription: null };

  async function setup(opts: { useAi: boolean; duplicate?: { id: string; name: string } | null }) {
    vi.resetModules();
    const m = {
      findDuplicate: vi.fn(async () => opts.duplicate ?? null),
      saveImported: vi.fn(async (draft: { name: string }, _images: { url: string }[]) => ({ id: "p1", name: draft.name, status: "DRAFT" as const })),
      aiFillProduct: vi.fn(async () => ({ data: fill, imagesIgnored: false })),
      deleteUnusedUploads: vi.fn(async () => {}),
    };
    vi.doMock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
    vi.doMock("@/lib/settings", () => ({ getSettings: async () => ({ catalog: { cosmosToken: "" } }) }));
    vi.doMock("@/lib/uploads", () => ({ deleteImage: vi.fn(async () => {}), readUpload: async () => ({ body: Buffer.from("foto") }), saveImage: vi.fn() }));
    vi.doMock("@/lib/admin/uploads", () => ({ deleteUnusedUploads: m.deleteUnusedUploads }));
    vi.doMock("@/lib/ai/client", () => ({ aiErrorMessage: () => "erro", getAiConfig: async () => ({ provider: "x" }), MAX_AI_IMAGES: 8 }));
    vi.doMock("@/lib/ai/product", () => ({ aiFillProduct: m.aiFillProduct }));
    vi.doMock("@/lib/barcode", () => ({ BarcodeError: class extends Error {}, lookupBarcode: async () => upc }));
    vi.doMock("@/lib/importer/server", async (orig) => ({
      ...(await orig<typeof import("@/lib/importer/server")>()),
      assertImportable: async () => {},
      findDuplicate: m.findDuplicate,
      loadCatalog: async () => ({ categories: [], brands: [] }),
      saveImported: m.saveImported,
    }));
    vi.doMock("@/lib/admin/standardize", () => ({
      photoStandard: async () => ({}),
      standardizeImage: async (im: { url: string }) => {
        if (im.url.endsWith("/2")) throw new Error("sharp");
        return { url: `${im.url}-std`, sourceUrl: im.url, width: 800, height: 800 };
      },
    }));
    const { importUploaded } = await import("@/app/admin/(panel)/produtos/importar/actions");
    const images = [1, 2, 3].map((i) => ({ url: `/uploads/products/${i}`, width: 100, height: 100 }));
    const result = await importUploaded({ folder: "Fone Bluetooth", dadosText: "preço: 199\nean: 7891234567895", images, aiImages: [] }, { publish: false, useAi: opts.useAi, barcode: true, standardize: true });
    return { m, result };
  }

  it("foto que não foi padronizada fica no mesmo lugar; a capa continua a 1", async () => {
    const { m, result } = await setup({ useAi: false });
    expect(result.ok).toBe(true);
    expect(m.saveImported.mock.calls[0][1].map((x) => x.url)).toEqual(["/uploads/products/1-std", "/uploads/products/2", "/uploads/products/3-std"]);
  });

  it("sem IA usa os textos da base e confere de novo se o produto já existe", async () => {
    const { m, result } = await setup({ useAi: false, duplicate: { id: "p0", name: "JBL Tune 510BT Wireless Headphones" } });
    expect(result).toEqual({ ok: false, error: "Já existe na loja: JBL Tune 510BT Wireless Headphones.", duplicate: { id: "p0", name: "JBL Tune 510BT Wireless Headphones" } });
    expect(m.findDuplicate.mock.calls[0]).toMatchObject([{ name: "JBL Tune 510BT Wireless Headphones" }]);
    expect(m.saveImported).not.toHaveBeenCalled();
  });

  it("com IA, os textos em inglês da UPCitemdb só vão como consulta e o português da IA fica", async () => {
    const { m } = await setup({ useAi: true });
    const args = m.aiFillProduct.mock.calls[0] as unknown as [{ known: { name: string; color: string | null; description: string | null; brand: string | null }; reference: string }];
    expect(args[0].known).toMatchObject({ name: "Fone Bluetooth", color: null, description: null, brand: "JBL" });
    expect(args[0].reference).toBe("nome: JBL Tune 510BT Wireless Headphones\ncor: Black\ndescrição: Pure Bass Sound");
    expect(m.saveImported.mock.calls[0][0]).toMatchObject({ name: "Fone de Ouvido JBL Tune 510BT Preto", color: "Preto", description: "Fone sem fio com graves fortes.", brand: "JBL", model: "T510BT", weightGrams: 160 });
  });
});
