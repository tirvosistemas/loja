// Carga inicial da Tirvo: admin, configurações, páginas institucionais e as categorias
// de eletrônicos. Não cria produtos, banners, promoções, cupons nem pedidos de exemplo.
//
//   npx tsx prisma/seed.ts                          cria o que falta (pode rodar de novo quando quiser)
//   npx tsx prisma/seed.ts --reset                  apaga produtos, pedidos, marketing, categorias, marcas e
//                                                   páginas e recria páginas e categorias
//   npx tsx prisma/seed.ts --demo-settings          preenche WhatsApp, endereço e Pix de demonstração (testes locais)
//   npx tsx prisma/seed.ts --reset-admin-password   volta a senha do ADMIN_EMAIL para ADMIN_PASSWORD
//
// --minimal ainda é aceito, sem efeito, para os comandos antigos continuarem funcionando.
// Usuários, configurações e inscrições de notificação nunca são apagados.

import "./seed/env";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { getSettings, saveSettingsGroup, type Settings } from "../src/lib/settings";
import { ensureVapidKeys } from "../src/lib/push";
import { absoluteUrl } from "../src/lib/utils";
import { deleteSeedImages } from "./seed/images";
import { CATEGORIES, type SeedCategory } from "./seed/data/categories";
import { PAGES } from "./seed/data/pages";

const args = new Set(process.argv.slice(2));
const RESET = args.has("--reset");
const DEMO_SETTINGS = args.has("--demo-settings");
const RESET_ADMIN_PASSWORD = args.has("--reset-admin-password");

const DEMO_WHATSAPP = "5541999999999";
const DEMO_PIX_KEY = "11222333000181";
const DEMO_LEGAL_NAME = "Tirvo Eletrônicos Ltda.";
const DEMO_PIX_HOLDER = "Tirvo Eletrônicos (demonstração)";
const DEMO_ADDRESS = {
  cep: "80420000",
  street: "Rua Comendador Araújo",
  number: "500",
  complement: "Loja 1",
  neighborhood: "Centro",
  city: "Curitiba",
  state: "PR",
  lat: -25.4372,
  lng: -49.2804,
};

const notices: string[] = [];
const log = (msg: string) => console.log(`  ${msg}`);
const step = (msg: string) => console.log(`\n▸ ${msg}`);

// ───────── Admin e configurações

async function ensureAdmin() {
  step("Administrador");
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 6) {
    notices.push("Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 6 caracteres) no .env e rode o seed de novo para criar o administrador.");
    log("ADMIN_EMAIL/ADMIN_PASSWORD ausentes: nenhum administrador criado.");
    return null;
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (RESET_ADMIN_PASSWORD) {
      await db.user.update({ where: { id: existing.id }, data: { role: "OWNER", active: true, passwordHash: await bcrypt.hash(password, 12) } });
      log(`${email}: senha redefinida para a do ADMIN_PASSWORD.`);
      return { email, created: true };
    }
    if (existing.role !== "OWNER" || !existing.active) await db.user.update({ where: { id: existing.id }, data: { role: "OWNER", active: true } });
    log(`${email} já existe (senha mantida).`);
    return { email, created: false };
  }
  await db.user.create({ data: { name: "Administrador", email, passwordHash: await bcrypt.hash(password, 12), role: "OWNER" } });
  log(`${email} criado como proprietário.`);
  return { email, created: true };
}

async function ensureSettings() {
  step("Configurações");
  const s = await getSettings();

  const store: Partial<Settings["store"]> = {};
  if (DEMO_SETTINGS) {
    Object.assign(store, {
      whatsapp: DEMO_WHATSAPP,
      phone: s.store.phone || "4130300000",
      email: s.store.email || "contato@tirvo.com.br",
      legalName: s.store.legalName || DEMO_LEGAL_NAME,
      cnpj: s.store.cnpj || DEMO_PIX_KEY,
      instagram: s.store.instagram || "tirvo",
    });
  }
  await saveSettingsGroup("store", store);
  if (DEMO_SETTINGS || s.store.whatsapp === DEMO_WHATSAPP) {
    notices.push(`WhatsApp de pedidos com número de DEMONSTRAÇÃO (${DEMO_WHATSAPP}): troque no painel em Configurações → Loja antes de vender.`);
  } else if (!s.store.whatsapp) notices.push("Configure o WhatsApp que recebe os pedidos em Configurações → Loja.");

  const address: Partial<Settings["address"]> = {};
  if (DEMO_SETTINGS) Object.assign(address, DEMO_ADDRESS);
  await saveSettingsGroup("address", address);
  if (DEMO_SETTINGS || (s.address.street === DEMO_ADDRESS.street && s.address.number === DEMO_ADDRESS.number)) {
    notices.push("Endereço da loja de DEMONSTRAÇÃO (Rua Comendador Araújo, 500, Curitiba): troque em Configurações → Endereço. O frete por km sai dele.");
  } else if (!s.address.street) notices.push("Cadastre o endereço da loja em Configurações → Endereço (o frete por km é calculado a partir dele).");

  const payment: Partial<Settings["payment"]> = {};
  if (DEMO_SETTINGS) {
    Object.assign(payment, {
      pixManualEnabled: true,
      pixKeyType: "cnpj",
      pixKey: DEMO_PIX_KEY,
      pixHolder: DEMO_PIX_HOLDER,
      onDeliveryCash: true,
      onDeliveryCard: true,
      onDeliveryPix: true,
      pixDiscountPercent: 5,
    } satisfies Partial<Settings["payment"]>);
  }
  await saveSettingsGroup("payment", payment);
  if (DEMO_SETTINGS || s.payment.pixKey === DEMO_PIX_KEY) notices.push("Chave Pix de DEMONSTRAÇÃO: troque em Configurações → Pagamentos.");

  for (const group of ["shipping", "integrations", "seo", "appearance", "push"] as const) await saveSettingsGroup(group, {});
  await ensureVapidKeys();
  log("Grupos salvos: loja, endereço, frete, pagamentos, integrações, notificações, SEO e aparência.");
}

// ───────── Limpeza (--reset)

async function resetData() {
  step("Limpando catálogo, pedidos e conteúdo");
  await db.$transaction([
    db.orderEvent.deleteMany(),
    db.orderItem.deleteMany(),
    db.order.deleteMany(),
    db.review.deleteMany(),
    db.productVariant.deleteMany(),
    db.productImage.deleteMany(),
    db.product.deleteMany(),
    db.promotion.deleteMany(),
    db.coupon.deleteMany(),
    db.banner.deleteMany(),
    db.category.updateMany({ data: { parentId: null } }),
    db.category.deleteMany(),
    db.brand.deleteMany(),
    db.page.deleteMany(),
    db.pushCampaign.deleteMany(),
    db.geoCache.deleteMany(),
    db.newsletterSubscriber.deleteMany(),
  ]);
  const files = await deleteSeedImages();
  log(`Pedidos, catálogo, marketing e páginas apagados. ${files} imagens geradas por versões antigas do seed removidas.`);
}

// ───────── Conteúdo básico

async function ensurePages() {
  step("Páginas institucionais");
  let created = 0;
  for (const [i, p] of PAGES.entries()) {
    const exists = await db.page.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (exists) continue;
    await db.page.create({ data: { slug: p.slug, title: p.title, content: p.content, published: true, showInFooter: true, sortOrder: i + 1 } });
    created++;
  }
  log(`${created} criadas, ${PAGES.length - created} já existiam.`);
}

async function ensureCategories() {
  step("Categorias");
  let total = 0;
  let created = 0;
  const upsert = async (c: SeedCategory, sortOrder: number, parentId: string | null) => {
    total++;
    const found = await db.category.findUnique({ where: { slug: c.slug }, select: { id: true } });
    if (found) return found.id;
    const row = await db.category.create({
      data: { name: c.name, slug: c.slug, icon: c.icon, description: c.description, featured: !!c.featured, sortOrder, parentId, active: true },
    });
    created++;
    return row.id;
  };
  for (const [i, c] of CATEGORIES.entries()) {
    const id = await upsert(c, (i + 1) * 10, null);
    for (const [j, child] of (c.children ?? []).entries()) await upsert(child, j + 1, id);
  }
  log(`${created} criadas, ${total - created} já existiam.`);
}

// ───────── Execução

async function summary(admin: Awaited<ReturnType<typeof ensureAdmin>>) {
  const [products, categories, brands, pages, orders, banners, promotions, coupons] = await Promise.all([
    db.product.count(),
    db.category.count(),
    db.brand.count(),
    db.page.count(),
    db.order.count(),
    db.banner.count(),
    db.promotion.count(),
    db.coupon.count(),
  ]);
  console.log("\n────────────────────────────────────────────");
  console.log(" Tirvo pronta");
  console.log("────────────────────────────────────────────");
  console.log(`  Produtos ${products} · Categorias ${categories} · Marcas ${brands} · Páginas ${pages}`);
  console.log(`  Pedidos ${orders} · Banners ${banners} · Promoções ${promotions} · Cupons ${coupons}`);
  console.log("");
  if (admin) {
    console.log(`  Painel: ${absoluteUrl("/admin")}`);
    console.log(`  Login:  ${admin.email}${admin.created ? " (senha do ADMIN_PASSWORD)" : ""}`);
  }
  if (!products) notices.push("Nenhum produto cadastrado ainda: cadastre em Painel → Produtos (as categorias já estão prontas).");
  if (notices.length) {
    console.log("\n  Atenção:");
    for (const n of notices) console.log(`  • ${n}`);
  }
  console.log("");
}

async function main() {
  console.log(`\nTirvo · seed${RESET ? " com --reset" : ""}${DEMO_SETTINGS ? " e configurações de demonstração" : ""}`);
  if (RESET) await resetData();
  const admin = await ensureAdmin();
  await ensureSettings();
  await ensurePages();
  await ensureCategories();
  await summary(admin);
}

main()
  .catch((e) => {
    console.error("\nFalha no seed:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
