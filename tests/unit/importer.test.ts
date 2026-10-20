import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { DADOS_TEMPLATE, parseDados, parseMeasures, parseMoney, parseVoltage, parseWarranty, parseWeight, pickPhotos } from "@/lib/importer/dados";
import { buildDraft, nameFromFolder } from "@/lib/importer/build";
import { groupByProductFolder } from "@/lib/importer/folders";
import { parseCsv, parseXlsx, sheetToItems, SHEET_TEMPLATE } from "@/lib/importer/sheet";
import { parseFolderId } from "@/lib/importer/drive";
import { driveFileId } from "@/lib/importer/fetch-image";

describe("conversões do dados.txt", () => {
  it("lê preços no formato brasileiro", () => {
    expect(parseMoney("299,90")).toBe(29990);
    expect(parseMoney("R$ 1.299,90")).toBe(129990);
    expect(parseMoney("1299.90")).toBe(129990);
    expect(parseMoney("1.299")).toBe(129900);
    expect(parseMoney("89")).toBe(8900);
    expect(parseMoney("grátis")).toBeNull();
  });
  it("lê peso, medidas, garantia e voltagem", () => {
    expect(parseWeight("250 g")).toBe(250);
    expect(parseWeight("1,2 kg")).toBe(1200);
    expect(parseMeasures("20 x 18 x 6 cm")).toEqual({ width: 20, height: 18, depth: 6 });
    expect(parseMeasures("200x180x60mm")).toEqual({ width: 20, height: 18, depth: 6 });
    expect(parseWarranty("1 ano")).toBe(12);
    expect(parseWarranty("90 dias")).toBe(3);
    expect(parseVoltage("Bivolt")).toBe("BIVOLT");
    expect(parseVoltage("110/220V")).toBe("BIVOLT");
    expect(parseVoltage("220V")).toBe("V220");
    expect(parseVoltage("não se aplica")).toBe("NA");
  });
  it("separa campos, especificações, variações e descrição", () => {
    const p = parseDados("Nome: Fone X\nPreço de venda: 10,00\n# comentário\n[Ficha técnica]\nConexão: Bluetooth\n[variações]\nPreto | 10,00 | 3\n[descrição]\nLinha 1\n\nLinha 2: com dois-pontos");
    expect(p.fields.nome).toBe("Fone X");
    expect(p.fields.preco).toBe("10,00");
    expect(p.specs).toEqual([{ label: "Conexão", value: "Bluetooth" }]);
    expect(p.variants).toEqual([{ name: "Preto", price: "10,00", stock: "3", sku: "" }]);
    expect(p.description).toBe("Linha 1\n\nLinha 2: com dois-pontos");
  });
  it("o modelo do dados.txt vira um produto sem erros nem avisos", () => {
    const r = buildDraft("Pasta", DADOS_TEMPLATE);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.draft).toMatchObject({ name: "Fone de Ouvido Bluetooth JBL Tune 520BT Preto", priceCents: 29990, compareAtCents: 34990, stock: 10, voltage: "NA", warrantyMonths: 12, weightGrams: 250, widthCm: 20, isNew: true });
    expect(r.draft.specs).toHaveLength(3);
    expect(r.draft.description).toContain("Item 2");
  });
  it("sem dados.txt ou sem preço é erro; nome vem da pasta", () => {
    expect(buildDraft("01 - Fone_JBL", null).errors[0]).toMatch(/dados\.txt/);
    const r = buildDraft("Fone JBL", "estoque: 3");
    expect(r.errors[0]).toMatch(/preço/);
    expect(r.draft.name).toBe("Fone JBL");
    expect(r.nameFromFolder).toBe(true);
    expect(nameFromFolder("03 - Fone_JBL  Tune")).toBe("Fone JBL Tune");
  });
  it("preço antigo menor que o preço vira aviso", () => {
    const r = buildDraft("x", "preco: 100\npreco_antigo: 90");
    expect(r.draft.compareAtCents).toBeNull();
    expect(r.warnings[0]).toMatch(/antigo/);
  });
});

describe("fotos e pastas", () => {
  it("ordena fotos pelo número e separa as de apoio", () => {
    const r = pickPhotos(["10.jpg", "2.jpg", "info-caixa.jpg", "Manual.png", "1.JPG", "dados.txt"]);
    expect(r.photos).toEqual(["1.JPG", "2.jpg", "10.jpg"]);
    expect(r.info).toBe(2);
  });
  it("respeita o limite de 12 fotos", () => {
    const r = pickPhotos(Array.from({ length: 15 }, (_, i) => `${i + 1}.jpg`));
    expect(r.photos).toHaveLength(12);
    expect(r.extra).toBe(3);
  });
  it("acha uma pasta por produto, com subpasta de apoio", () => {
    const g = groupByProductFolder(
      [
        "Produtos/Fone/01.jpg",
        "Produtos/Fone/dados.txt",
        "Produtos/Fone/info/caixa.jpg",
        "Produtos/Headset/1.png",
        "Produtos/.DS_Store",
        "__MACOSX/Produtos/Fone/._01.jpg",
        "Produtos/leia-me.pdf",
      ].map((path) => ({ path, file: path })),
    );
    expect(g.map((x) => x.folder)).toEqual(["Fone", "Headset"]);
    expect(g[0]).toMatchObject({ dados: "Produtos/Fone/dados.txt", photos: [{ name: "01.jpg" }], info: [{ name: "caixa.jpg" }] });
  });
  it("aceita a pasta de um produto só", () => {
    const g = groupByProductFolder(["Fone/01.jpg", "Fone/dados.txt"].map((path) => ({ path, file: path })));
    expect(g).toHaveLength(1);
    expect(g[0].folder).toBe("Fone");
  });
});

describe("planilhas", () => {
  it("lê o CSV modelo", () => {
    const { items } = sheetToItems(parseCsv(SHEET_TEMPLATE));
    expect(items).toHaveLength(1);
    expect(items[0].photoUrls).toEqual(["https://exemplo.com/foto1.jpg", "https://exemplo.com/foto2.jpg"]);
    const r = buildDraft(items[0].folder, items[0].dadosText);
    expect(r.errors).toEqual([]);
    expect(r.draft).toMatchObject({ name: "Fone de Ouvido Bluetooth JBL Tune 520BT Preto", priceCents: 29990, stock: 10, brand: "JBL" });
  });
  it("CSV com aspas, vírgula e quebra de linha", () => {
    const rows = parseCsv('Título,Preço,Descrição\n"Fone ""Pro""",49.9,"Linha 1\nLinha 2"\n');
    expect(rows[1]).toEqual(['Fone "Pro"', "49.9", "Linha 1\nLinha 2"]);
  });
  it("agrupa variações pelo código do anúncio e pula linhas de instrução", () => {
    const rows = [
      ["Instruções: preencha abaixo"],
      ["Código do anúncio", "Título", "Variação", "Preço", "Estoque", "SKU", "Imagem 1", "Imagem 2"],
      ["Obrigatório", "Obrigatório", "", "Obrigatório", "", "", "", ""],
      ["MLB1", "Controle Sem Fio", "Preto", "149,90", "5", "CT-P", "https://a.com/1.jpg", "https://a.com/2.jpg"],
      ["MLB1", "Controle Sem Fio", "Branco", "159,90", "2", "CT-B", "https://a.com/3.jpg", ""],
      ["MLB2", "Suporte Veicular", "", "39,90", "8", "SV-1", "https://a.com/4.jpg", ""],
    ];
    const { items } = sheetToItems(rows);
    expect(items).toHaveLength(2);
    const ctrl = buildDraft(items[0].folder, items[0].dadosText);
    expect(ctrl.errors).toEqual([]);
    expect(ctrl.draft.priceCents).toBe(14990);
    expect(ctrl.draft.variants.map((v) => [v.name, v.priceCents, v.stock, v.sku])).toEqual([
      ["Preto", 14990, 5, "CT-P"],
      ["Branco", 15990, 2, "CT-B"],
    ]);
    expect(items[0].photoUrls).toHaveLength(3);
    expect(buildDraft(items[1].folder, items[1].dadosText).draft).toMatchObject({ name: "Suporte Veicular", sku: "SV-1", stock: 8 });
  });
  it("lê Excel (.xlsx) com textos compartilhados e números", () => {
    const xml = (s: string) => strToU8(`<?xml version="1.0" encoding="UTF-8"?>${s}`);
    const data = zipSync({
      "xl/workbook.xml": xml('<workbook xmlns:r="r"><sheets><sheet name="Produtos" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      "xl/_rels/workbook.xml.rels": xml('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
      "xl/sharedStrings.xml": xml("<sst><si><t>Nome</t></si><si><t>Preço</t></si><si><r><t>Fone </t></r><r><t>Bluetooth &amp; Mic</t></r></si></sst>"),
      "xl/worksheets/sheet1.xml": xml(
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>79.9</v></c></row></sheetData></worksheet>',
      ),
    });
    const rows = parseXlsx(data);
    expect(rows).toEqual([
      ["Nome", "", "Preço"],
      ["Fone Bluetooth & Mic", "", "79.9"],
    ]);
    const { items } = sheetToItems(rows);
    expect(buildDraft(items[0].folder, items[0].dadosText).draft).toMatchObject({ name: "Fone Bluetooth & Mic", priceCents: 7990 });
  });
});

describe("links do Google Drive", () => {
  it("extrai o ID da pasta e do arquivo", () => {
    expect(parseFolderId("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp?usp=sharing")).toBe("1AbCdEfGhIjKlMnOp");
    expect(parseFolderId("https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOp")).toBe("1AbCdEfGhIjKlMnOp");
    expect(parseFolderId("qualquer coisa")).toBeNull();
    expect(driveFileId("https://drive.google.com/file/d/1XyZxyzXYZ123/view?usp=sharing")).toBe("1XyZxyzXYZ123");
    expect(driveFileId("https://a.com/1.jpg")).toBeNull();
  });
});
