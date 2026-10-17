// Carga inicial da Tirvo.
//
//   npx tsx prisma/seed.ts             admin, configurações e loja de demonstração completa
//   npx tsx prisma/seed.ts --reset     apaga catálogo, pedidos e conteúdo e recria a demonstração
//   npx tsx prisma/seed.ts --minimal   só admin, configurações, páginas e categorias (produção)
//   npx tsx prisma/seed.ts --demo-settings   regrava WhatsApp, endereço e Pix de demonstração
//   npx tsx prisma/seed.ts --minimal --reset-admin-password   volta a senha do ADMIN_EMAIL para ADMIN_PASSWORD
//
// Usuários, configurações e inscrições de notificação nunca são apagados. Na demonstração,
// WhatsApp, endereço e Pix só são preenchidos quando estão vazios (ou com --demo-settings).

import "./seed/env";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import { getSettings, saveSettingsGroup, type Settings } from "../src/lib/settings";
import { ensureVapidKeys } from "../src/lib/push";
import { computeTotals, effectivePrice, evaluateCoupon, type CouponLine, type PromoLite } from "../src/lib/pricing";
import { computeShippingFee } from "../src/lib/shipping/quote";
import { haversineKm } from "../src/lib/shipping/geo";
import { buildOrderMessage } from "../src/lib/whatsapp";
import { absoluteUrl, randomCode, slugify } from "../src/lib/utils";
import { PIX_METHODS, type PaymentMethodKey } from "../src/lib/constants";
import { iconShot, productShot } from "./seed/art";
import { airfryerStrip, appStrip, climateBanner, deliveryBanner, kitchenBanner, type BannerArt } from "./seed/banner-art";
import { deleteSeedImages, flushManifest, svgToUpload } from "./seed/images";
import { BRANDS, CATEGORIES, FLASH_KEYS, PRODUCTS, type SeedCategory, type SeedProduct } from "./seed/data/catalog";
import { PAGES } from "./seed/data/pages";
import { ADDRESSES, CUSTOMERS, NEWSLETTER, ORDERS, REVIEWS, type SeedOrder } from "./seed/data/people";

const args = new Set(process.argv.slice(2));
const RESET = args.has("--reset");
const MINIMAL = args.has("--minimal");
const FORCE_DEMO_SETTINGS = args.has("--demo-settings") && !MINIMAL;
const RESET_ADMIN_PASSWORD = args.has("--reset-admin-password");

const DEMO_WHATSAPP = "5541999999999";
const DEMO_PIX_KEY = "11222333000181";
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

const H = 3_600_000;
const DAY = 24 * H;
const NOW = Date.now();

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

async function ensureSettings(demo: boolean) {
  step("Configurações");
  const s = await getSettings();

  const store: Partial<Settings["store"]> = {};
  if (demo && (!s.store.whatsapp || FORCE_DEMO_SETTINGS)) {
    Object.assign(store, {
      whatsapp: DEMO_WHATSAPP,
      phone: s.store.phone || "4130300000",
      email: s.store.email || "contato@tirvo.com.br",
      legalName: s.store.legalName || "Tirvo Eletrodomésticos Ltda.",
      cnpj: s.store.cnpj || DEMO_PIX_KEY,
      instagram: s.store.instagram || "tirvo",
    });
    notices.push(`WhatsApp de pedidos com número de DEMONSTRAÇÃO (${DEMO_WHATSAPP}): troque no painel em Configurações → Loja antes de vender.`);
  }
  await saveSettingsGroup("store", store);
  if (!demo && !s.store.whatsapp) notices.push("Configure o WhatsApp que recebe os pedidos em Configurações → Loja.");

  const address: Partial<Settings["address"]> = {};
  if (demo && (!s.address.street || FORCE_DEMO_SETTINGS)) {
    Object.assign(address, DEMO_ADDRESS);
    notices.push("Endereço da loja de DEMONSTRAÇÃO (Rua Comendador Araújo, 500, Curitiba): troque em Configurações → Endereço. O frete por km sai dele.");
  }
  await saveSettingsGroup("address", address);
  if (!demo && !s.address.street) notices.push("Cadastre o endereço da loja em Configurações → Endereço (o frete por km é calculado a partir dele).");

  const payment: Partial<Settings["payment"]> = {};
  if (demo && (!s.payment.pixKey || FORCE_DEMO_SETTINGS)) {
    Object.assign(payment, {
      pixManualEnabled: true,
      pixKeyType: "cnpj",
      pixKey: DEMO_PIX_KEY,
      pixHolder: "Tirvo Eletrodomésticos (demonstração)",
      onDeliveryCash: true,
      onDeliveryCard: true,
      onDeliveryPix: true,
      pixDiscountPercent: 5,
    } satisfies Partial<Settings["payment"]>);
    notices.push("Chave Pix de DEMONSTRAÇÃO: troque em Configurações → Pagamentos.");
  }
  await saveSettingsGroup("payment", payment);

  for (const group of ["shipping", "integrations", "seo", "appearance", "push"] as const) await saveSettingsGroup(group, {});
  await ensureVapidKeys();
  log("Grupos salvos: loja, endereço, frete, pagamentos, integrações, notificações, SEO e aparência.");
  return getSettings();
}

// ───────── Limpeza (--reset)

async function resetData() {
  step("Limpando dados de demonstração");
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
  log(`Pedidos, catálogo, marketing e páginas apagados. ${files} imagens geradas removidas.`);
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

async function ensureCategories(withImages: boolean) {
  step("Categorias");
  const ids = new Map<string, string>();
  let created = 0;
  const upsert = async (c: SeedCategory, sortOrder: number, parentId: string | null) => {
    const found = await db.category.findUnique({ where: { slug: c.slug } });
    if (found) {
      ids.set(c.slug, found.id);
      if (withImages && !found.image && c.art) {
        const img = await svgToUpload(iconShot(c.art[0], c.art[1]), "categories");
        await db.category.update({ where: { id: found.id }, data: { image: img.key } });
      }
      return found.id;
    }
    const image = withImages && c.art ? (await svgToUpload(iconShot(c.art[0], c.art[1]), "categories")).key : null;
    const row = await db.category.create({
      data: { name: c.name, slug: c.slug, icon: c.icon, description: c.description, featured: !!c.featured, sortOrder, parentId, image, active: true },
    });
    created++;
    ids.set(c.slug, row.id);
    return row.id;
  };
  for (const [i, c] of CATEGORIES.entries()) {
    const id = await upsert(c, (i + 1) * 10, null);
    for (const [j, child] of (c.children ?? []).entries()) await upsert(child, j + 1, id);
  }
  log(`${created} criadas, ${ids.size - created} já existiam.`);
  return ids;
}

// ───────── Catálogo de demonstração

function ean13(seed: number) {
  const base = `789${String(1000000000 + ((seed * 7919) % 899999999)).slice(0, 9)}`;
  const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return base + ((10 - (sum % 10)) % 10);
}

function description(p: SeedProduct) {
  return [
    ...p.about,
    "**Destaques**",
    p.highlights.map((h) => `- ${h}`).join("\n"),
    `Entregamos em Curitiba e região metropolitana por motoboy, com frete calculado pela distância até a loja. Produto novo, com nota fiscal e **${p.warrantyMonths} meses de garantia** do fabricante.`,
  ].join("\n\n");
}

type ProductRef = { id: string; categoryId: string | null; brandId: string | null; priceCents: number; compareAtCents: number | null; name: string; image: string | null; sku: string; variants: Map<string, { id: string; priceCents: number | null; compareAtCents: number | null; sku: string | null }> };

async function seedCatalog(categoryIds: Map<string, string>) {
  step("Marcas");
  const brandIds = new Map<string, string>();
  for (const name of BRANDS) {
    const slug = slugify(name);
    const row = await db.brand.upsert({ where: { slug }, create: { name, slug }, update: {} });
    brandIds.set(name, row.id);
  }
  log(`${brandIds.size} marcas.`);

  step(`Produtos e imagens (${PRODUCTS.length} produtos, 2 ilustrações cada)`);
  const refs = new Map<string, ProductRef>();
  for (const [i, p] of PRODUCTS.entries()) {
    const sku = `TRV-${String(1001 + i)}`;
    const categoryId = categoryIds.get(p.category) ?? null;
    const brandId = brandIds.get(p.brand) ?? null;
    const createdAt = new Date(NOW - (p.isNew ? 1 + (i % 9) : 35 + ((i * 17) % 150)) * DAY - (i % 7) * H);
    const variants = p.variants ?? [];
    const product = await db.product.create({
      data: {
        name: p.name,
        slug: slugify(p.name),
        sku,
        shortDescription: p.short,
        description: description(p),
        status: "ACTIVE",
        priceCents: p.priceCents,
        compareAtCents: p.compareAtCents ?? null,
        costCents: p.costCents,
        stock: variants.length ? variants.reduce((s, v) => s + v.stock, 0) : (p.stock ?? 0),
        trackStock: true,
        lowStockAlert: 3,
        featured: !!p.featured,
        isNew: !!p.isNew,
        freeShipping: !!p.freeShipping,
        voltage: variants.length ? null : (p.voltage ?? null),
        variantLabel: variants.length ? "Voltagem" : null,
        warrantyMonths: p.warrantyMonths,
        weightGrams: Math.round(p.weightKg * 1000),
        widthCm: p.dims[0],
        heightCm: p.dims[1],
        depthCm: p.dims[2],
        color: p.color,
        model: p.model,
        ean: ean13(i + 1),
        specs: p.specs.map(([label, value]) => ({ label, value })),
        tags: p.tags.join(", "),
        metaDescription: p.short.slice(0, 320),
        soldCount: p.sold,
        viewCount: p.views,
        categoryId,
        brandId,
        createdAt,
        variants: {
          create: variants.map((v, j) => ({ name: v.name, sku: `${sku}-${v.name.replace("V", "")}`, stock: v.stock, priceCents: v.priceCents ?? null, sortOrder: j })),
        },
      },
      include: { variants: true },
    });

    let firstImage: string | null = null;
    for (const [j, view] of (["front", "alt"] as const).entries()) {
      const shot = productShot(p.art, p.finish, view);
      const img = await svgToUpload(shot.svg, "products");
      firstImage ??= img.key;
      await db.productImage.create({
        data: { productId: product.id, url: img.key, alt: `${p.name} — ${shot.label}`, width: img.width, height: img.height, sortOrder: j },
      });
    }
    refs.set(p.key, {
      id: product.id,
      categoryId,
      brandId,
      priceCents: product.priceCents,
      compareAtCents: product.compareAtCents,
      name: product.name,
      image: firstImage,
      sku,
      variants: new Map(product.variants.map((v) => [v.name, { id: v.id, priceCents: v.priceCents, compareAtCents: v.compareAtCents, sku: v.sku }])),
    });
    process.stdout.write(`  ${String(i + 1).padStart(2, " ")}/${PRODUCTS.length} ${p.name}\n`);
  }
  await flushManifest();
  return { refs, brandIds };
}

async function seedMarketing(categoryIds: Map<string, string>, refs: Map<string, ProductRef>) {
  step("Promoções e cupons");
  const kitchenEnds = new Date(NOW + 7 * DAY);
  const promos = [
    await db.promotion.create({
      data: {
        name: "Semana da Cozinha",
        description: "15% de desconto em fogões e cooktops.",
        type: "PERCENT",
        value: 15,
        scope: "CATEGORY",
        categoryIds: [categoryIds.get("fogoes-e-cooktops")].filter(Boolean) as string[],
        badge: "Semana da Cozinha",
        priority: 5,
        startsAt: new Date(NOW - 36 * H),
        endsAt: kitchenEnds,
      },
    }),
    await db.promotion.create({
      data: {
        name: "Oferta relâmpago",
        description: "20% de desconto em produtos selecionados por tempo limitado.",
        type: "PERCENT",
        value: 20,
        scope: "PRODUCTS",
        productIds: FLASH_KEYS.map((k) => refs.get(k)?.id).filter(Boolean) as string[],
        flash: true,
        badge: "Oferta relâmpago",
        priority: 10,
        startsAt: new Date(NOW - 2 * H),
        endsAt: new Date(NOW + 30 * H),
      },
    }),
    await db.promotion.create({
      data: {
        name: "Esquenta Black Friday",
        description: "10% em lavadoras e secadoras. Começa em breve.",
        type: "PERCENT",
        value: 10,
        scope: "CATEGORY",
        categoryIds: [categoryIds.get("lavadoras-e-secadoras")].filter(Boolean) as string[],
        badge: "Esquenta Black Friday",
        priority: 3,
        startsAt: new Date(NOW + 10 * DAY),
        endsAt: new Date(NOW + 17 * DAY),
      },
    }),
  ];
  log("3 promoções: Semana da Cozinha (ativa), Oferta relâmpago (30 h) e Esquenta Black Friday (agendada).");

  const coupons = await Promise.all([
    db.coupon.create({
      data: {
        code: "BEMVINDO10",
        description: "10% de desconto na primeira compra (até R$ 150).",
        type: "PERCENT",
        value: 10,
        minSubtotalCents: 20000,
        maxDiscountCents: 15000,
        firstOrderOnly: true,
        perCustomerLimit: 1,
      },
    }),
    db.coupon.create({
      data: { code: "FRETEGRATIS", description: "Frete grátis em compras a partir de R$ 300.", type: "FREE_SHIPPING", value: 0, minSubtotalCents: 30000 },
    }),
    db.coupon.create({
      data: { code: "TIRVO50", description: "R$ 50 de desconto em compras a partir de R$ 500.", type: "FIXED", value: 5000, minSubtotalCents: 50000, usageLimit: 100 },
    }),
  ]);
  log("3 cupons: BEMVINDO10, FRETEGRATIS e TIRVO50.");

  step("Banners (fundos gerados)");
  const save = async (art: BannerArt) => {
    const desktop = await svgToUpload(art.desktop, "banners");
    const mobile = await svgToUpload(art.mobile, "banners");
    return { imageDesktop: desktop.key, imageMobile: mobile.key };
  };
  const banners: Prisma.BannerCreateInput[] = [
    {
      title: "Semana da Cozinha",
      subtitle: "Fogões e cooktops com até 15% OFF",
      eyebrow: "Só até domingo",
      ctaLabel: "Ver ofertas",
      href: "/categoria/fogoes-e-cooktops",
      placement: "HERO",
      sortOrder: 1,
      endsAt: kitchenEnds,
      ...(await save(kitchenBanner())),
    },
    {
      title: "Climatize sua casa",
      subtitle: "Ar-condicionado inverter, ventiladores e aquecedores para o verão e o inverno de Curitiba.",
      eyebrow: "Conforto o ano todo",
      ctaLabel: "Ver climatização",
      href: "/categoria/ar-e-climatizacao",
      placement: "HERO",
      sortOrder: 2,
      ...(await save(climateBanner())),
    },
    {
      title: "Frete por km, entrega no mesmo dia",
      subtitle: "Motoboy saindo da nossa loja para Curitiba e região. Pedidos confirmados até as 14h chegam hoje.",
      eyebrow: "Entrega Tirvo",
      ctaLabel: "Como funciona",
      href: "/pagina/entregas",
      placement: "HERO",
      sortOrder: 3,
      ...(await save(deliveryBanner())),
    },
    {
      title: "Air fryers a partir de R$ 349",
      subtitle: "Digitais, compactas e com cesto antiaderente.",
      eyebrow: "Eletroportáteis",
      ctaLabel: "Ver air fryers",
      href: "/categoria/air-fryers",
      placement: "STRIP",
      sortOrder: 1,
      ...(await save(airfryerStrip())),
    },
    {
      title: "Baixe o app e receba ofertas",
      subtitle: "Instale a Tirvo no celular e ative as notificações de promoções.",
      eyebrow: "App Tirvo",
      ctaLabel: "Instalar o app",
      href: "/app",
      placement: "STRIP",
      sortOrder: 2,
      ...(await save(appStrip())),
    },
  ];
  for (const b of banners) await db.banner.create({ data: { theme: "dark", align: "left", active: true, ...b } });
  await flushManifest();
  log(`${banners.length} banners (3 no carrossel e 2 faixas), com versão para celular.`);

  return { promos, coupons };
}

async function seedReviews(refs: Map<string, ProductRef>) {
  step("Avaliações");
  let approved = 0;
  for (const [i, r] of REVIEWS.entries()) {
    const ref = refs.get(r.product);
    if (!ref) continue;
    const ok = r.approved !== false;
    await db.review.create({
      data: {
        productId: ref.id,
        name: r.name,
        city: r.city,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        approved: ok,
        createdAt: new Date(NOW - r.daysAgo * DAY - ((i * 5) % 11) * H - 20 * 60_000),
      },
    });
    if (ok) approved++;
  }
  for (const ref of refs.values()) {
    const agg = await db.review.aggregate({ where: { productId: ref.id, approved: true }, _avg: { rating: true }, _count: { _all: true } });
    await db.product.update({
      where: { id: ref.id },
      data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count._all },
    });
  }
  log(`${approved} aprovadas e ${REVIEWS.length - approved} aguardando moderação. Notas médias recalculadas.`);
}

// ───────── Pedidos de demonstração

function promosAt(
  date: Date,
  rows: { id: string; name: string; type: "PERCENT" | "FIXED"; value: number; scope: PromoLite["scope"]; flash: boolean; badge: string | null; priority: number; startsAt: Date | null; endsAt: Date | null; categoryIds: unknown; brandIds: unknown; productIds: unknown }[],
): PromoLite[] {
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return rows
    .filter((p) => (!p.startsAt || p.startsAt <= date) && (!p.endsAt || p.endsAt > date))
    .map((p) => ({
      id: p.id, name: p.name, type: p.type, value: p.value, scope: p.scope, flash: p.flash, badge: p.badge, priority: p.priority,
      endsAt: p.endsAt, categoryIds: ids(p.categoryIds), brandIds: ids(p.brandIds), productIds: ids(p.productIds),
    }));
}

/** Data em Curitiba (UTC-3) N dias atrás, no horário informado, sem passar de agora. */
function localTime(daysAgo: number, hour: number) {
  const d = new Date(NOW - daysAgo * DAY);
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour + 3, (daysAgo * 13) % 50);
  return new Date(Math.min(utc, NOW - (daysAgo === 0 ? 40 : 0) * 60_000 - 5 * 60_000));
}

type Ev = { type: "status" | "payment"; status: string; note: string | null; at: Date };

function timeline(o: SeedOrder, start: Date): { events: Ev[]; paymentStatus: "PENDING" | "PAID" | "EXPIRED" } {
  const at = (min: number) => new Date(Math.min(start.getTime() + min * 60_000, NOW - 60_000));
  const ev: Ev[] = [{ type: "status", status: "NEW", note: "Pedido criado pelo site", at: start }];
  const online = o.method === "ONLINE_STRIPE";
  const pixNow = o.method === "PIX_MANUAL";
  const onDelivery = !online && !pixNow;
  const flow = o.address === "PICKUP"
    ? ["CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "DELIVERED"]
    : ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"];
  let paid = false;

  if (o.status === "CANCELED") {
    if (online) {
      ev.push({ type: "status", status: "CANCELED", note: o.cancelNote ?? "Pagamento online não concluído a tempo · por sistema", at: at(125) });
    } else {
      ev.push({ type: "status", status: "CONFIRMED", note: "Confirmado pelo WhatsApp · por Administrador", at: at(18) });
      ev.push({ type: "status", status: "CANCELED", note: o.cancelNote ?? "Cancelado a pedido do cliente · por Administrador", at: at(95) });
    }
    return { events: ev, paymentStatus: "EXPIRED" };
  }

  if (online && o.status !== "NEW") {
    ev.push({ type: "payment", status: "PAID", note: "Pagamento confirmado pela Stripe", at: at(3) });
    paid = true;
  }
  const target = flow.indexOf(o.status);
  const minutes = [20, 75, o.address === "PICKUP" ? 150 : 190, o.address === "PICKUP" ? 1500 : 290];
  for (let i = 0; i <= target; i++) {
    const status = flow[i];
    const notes: Record<string, string> = {
      CONFIRMED: "Confirmado pelo WhatsApp · por Administrador",
      PREPARING: "Separando os produtos · por Administrador",
      OUT_FOR_DELIVERY: "Saiu com o motoboy · por Administrador",
      READY_FOR_PICKUP: "Pronto para retirada no balcão · por Administrador",
      DELIVERED: o.address === "PICKUP" ? "Retirado na loja · por Administrador" : "Entregue ao cliente · por Administrador",
    };
    ev.push({ type: "status", status, note: notes[status] ?? null, at: at(minutes[i]) });
    if (pixNow && status === "CONFIRMED" && !paid) {
      ev.push({ type: "payment", status: "PAID", note: "Comprovante do Pix recebido · por Administrador", at: at(minutes[i] + 1) });
      paid = true;
    }
    if (onDelivery && status === "DELIVERED" && !paid) {
      ev.push({ type: "payment", status: "PAID", note: "Pago na entrega · por Administrador", at: at(minutes[i] + 1) });
      paid = true;
    }
  }
  return { events: ev.sort((a, b) => a.at.getTime() - b.at.getTime()), paymentStatus: paid ? "PAID" : "PENDING" };
}

async function seedOrders(settings: Settings, refs: Map<string, ProductRef>, marketing: Awaited<ReturnType<typeof seedMarketing>>) {
  step("Pedidos de demonstração");
  const origin = settings.address.lat != null && settings.address.lng != null ? { lat: settings.address.lat, lng: settings.address.lng } : { lat: DEMO_ADDRESS.lat, lng: DEMO_ADDRESS.lng };
  const storeName = settings.store.name || "Tirvo";
  const couponByCode = new Map(marketing.coupons.map((c) => [c.code, c]));
  const usedCodes = new Set<string>();
  const ordersByPhone = new Map<string, number>();
  const couponUses = new Map<string, number>();
  const sold = new Map<string, number>();
  let count = 0;

  // Do mais antigo para o mais novo, para "primeira compra" e usos de cupom fazerem sentido.
  const list = [...ORDERS].sort((a, b) => b.daysAgo - a.daysAgo || a.hour - b.hour);
  for (const o of list) {
    const customer = CUSTOMERS[o.customer];
    const createdAt = localTime(o.daysAgo, o.hour);
    const promos = promosAt(createdAt, marketing.promos);

    const lines = o.items.flatMap(([key, variantName, qty = 1]) => {
      const ref = refs.get(key);
      if (!ref) return [];
      const variant = variantName ? ref.variants.get(variantName) ?? null : null;
      const price = effectivePrice(ref, variant, promos);
      return [{ ref, variantId: variant?.id ?? null, variantName: variant ? variantName! : null, sku: variant?.sku ?? ref.sku, quantity: qty, unit: price.priceCents, original: price.basePriceCents, promoted: !!price.promotion }];
    });
    if (!lines.length) continue;
    const subtotal = lines.reduce((s, l) => s + l.unit * l.quantity, 0);
    const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

    let couponDiscount = 0;
    let freeShippingCoupon = false;
    let coupon: { id: string; code: string } | null = null;
    if (o.coupon) {
      const row = couponByCode.get(o.coupon);
      if (row) {
        const couponLines: CouponLine[] = lines.map((l) => ({ id: l.ref.id, categoryId: l.ref.categoryId, brandId: l.ref.brandId, unitPriceCents: l.unit, quantity: l.quantity, promoted: l.promoted }));
        const res = evaluateCoupon(
          { ...row, usedCount: couponUses.get(row.id) ?? 0 },
          couponLines,
          { now: createdAt, usesByCustomer: 0, customerOrders: ordersByPhone.get(customer.phone) ?? 0 },
        );
        if (res.ok) {
          couponDiscount = res.discountCents;
          freeShippingCoupon = res.freeShipping;
          coupon = { id: row.id, code: row.code };
        } else log(`Cupom ${row.code} não aplicado: ${res.error}`);
      }
    }

    const pickup = o.address === "PICKUP";
    const addr = pickup ? null : ADDRESSES[o.address as number];
    let distanceKm: number | null = null;
    let shippingCents = 0;
    if (addr) {
      distanceKm = Math.round(haversineKm(origin, addr) * settings.shipping.straightLineFactor * 10) / 10;
      const fee = computeShippingFee(settings.shipping, {
        distanceKm,
        subtotalCents: subtotal,
        itemCount,
        freeShippingCoupon,
        allItemsFreeShipping: lines.every((l) => PRODUCTS.find((p) => refs.get(p.key)?.id === l.ref.id)?.freeShipping),
      });
      shippingCents = fee.available ? fee.feeCents : 0;
    }
    const method = o.method as PaymentMethodKey;
    const totals = computeTotals({
      subtotalCents: subtotal,
      couponDiscountCents: couponDiscount,
      shippingCents,
      paymentMethod: method,
      pixDiscountPercent: PIX_METHODS.includes(method) ? settings.payment.pixDiscountPercent : 0,
    });
    const changeForCents = o.method === "CASH_ON_DELIVERY" ? Math.ceil((totals.totalCents + 1) / 5000) * 5000 : null;

    let code = "";
    do code = `TV${randomCode(7)}`;
    while (usedCodes.has(code) || (await db.order.findUnique({ where: { code }, select: { id: true } })));
    usedCodes.add(code);

    const items = lines.map((l) => ({
      productId: l.ref.id,
      variantId: l.variantId,
      name: l.ref.name,
      variantName: l.variantName,
      sku: l.sku,
      image: l.ref.image,
      unitPriceCents: l.unit,
      originalUnitPriceCents: l.original,
      quantity: l.quantity,
      totalCents: l.unit * l.quantity,
    }));
    const whatsappMessage = buildOrderMessage({
      code,
      storeName,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email ?? null,
      deliveryType: pickup ? "PICKUP" : "DELIVERY",
      street: addr?.street,
      number: addr?.number,
      complement: addr?.complement,
      neighborhood: addr?.neighborhood,
      city: addr?.city,
      state: addr ? "PR" : null,
      cep: addr?.cep,
      reference: addr?.reference,
      distanceKm,
      items: items.map((i) => ({ name: i.name, variantName: i.variantName, quantity: i.quantity, unitPriceCents: i.unitPriceCents, totalCents: i.totalCents })),
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      couponCode: coupon?.code ?? null,
      pixDiscountCents: totals.pixDiscountCents,
      shippingCents: totals.shippingCents,
      totalCents: totals.totalCents,
      paymentMethod: method,
      paymentStatus: "PENDING",
      changeForCents,
      notes: o.notes ?? null,
      trackUrl: absoluteUrl(`/pedido/${code}`),
    });

    const { events, paymentStatus } = timeline(o, createdAt);
    const last = events[events.length - 1].at;
    await db.order.create({
      data: {
        code,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email ?? null,
        customerDoc: customer.doc ?? null,
        deliveryType: pickup ? "PICKUP" : "DELIVERY",
        cep: addr?.cep ?? null,
        street: addr?.street ?? null,
        number: addr?.number ?? null,
        complement: addr?.complement ?? null,
        neighborhood: addr?.neighborhood ?? null,
        city: addr?.city ?? null,
        state: addr ? "PR" : null,
        reference: addr?.reference ?? null,
        lat: addr?.lat ?? null,
        lng: addr?.lng ?? null,
        distanceKm,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        pixDiscountCents: totals.pixDiscountCents,
        shippingCents: totals.shippingCents,
        totalCents: totals.totalCents,
        couponCode: coupon?.code ?? null,
        couponId: coupon?.id ?? null,
        paymentMethod: method,
        paymentStatus,
        changeForCents,
        status: o.status,
        notes: o.notes ?? null,
        whatsappMessage,
        ip: "127.0.0.1",
        userAgent: "Pedido de demonstração (seed)",
        createdAt,
        updatedAt: last,
        items: { create: items },
        events: { create: events.map((e) => ({ type: e.type, status: e.status, note: e.note, createdAt: e.at })) },
      },
    });
    count++;

    if (o.status !== "CANCELED") {
      ordersByPhone.set(customer.phone, (ordersByPhone.get(customer.phone) ?? 0) + 1);
      if (coupon) couponUses.set(coupon.id, (couponUses.get(coupon.id) ?? 0) + 1);
      for (const l of lines) sold.set(l.ref.id, (sold.get(l.ref.id) ?? 0) + l.quantity);
    }
  }

  for (const [id, used] of couponUses) await db.coupon.update({ where: { id }, data: { usedCount: used } });
  for (const [id, qty] of sold) await db.product.update({ where: { id }, data: { soldCount: { increment: qty } } });
  log(`${count} pedidos nos últimos 30 dias, com histórico de status e pagamento.`);
  return count;
}

async function seedNewsletter() {
  step("Newsletter");
  let created = 0;
  for (const [i, email] of NEWSLETTER.entries()) {
    const exists = await db.newsletterSubscriber.findUnique({ where: { email } });
    if (exists) continue;
    await db.newsletterSubscriber.create({ data: { email, createdAt: new Date(NOW - (i * 3 + 1) * DAY) } });
    created++;
  }
  log(`${created} inscritos.`);
}

// ───────── Execução

async function summary(admin: Awaited<ReturnType<typeof ensureAdmin>>) {
  const [products, categories, brands, orders, reviews, banners, promotions, coupons, pages, subscribers] = await Promise.all([
    db.product.count(),
    db.category.count(),
    db.brand.count(),
    db.order.count(),
    db.review.count(),
    db.banner.count(),
    db.promotion.count(),
    db.coupon.count(),
    db.page.count(),
    db.newsletterSubscriber.count(),
  ]);
  console.log("\n────────────────────────────────────────────");
  console.log(" Tirvo pronta");
  console.log("────────────────────────────────────────────");
  console.log(`  Produtos ${products} · Categorias ${categories} · Marcas ${brands}`);
  console.log(`  Pedidos ${orders} · Avaliações ${reviews} · Banners ${banners}`);
  console.log(`  Promoções ${promotions} · Cupons ${coupons} · Páginas ${pages} · Newsletter ${subscribers}`);
  console.log("");
  if (admin) {
    console.log(`  Painel: ${absoluteUrl("/admin")}`);
    console.log(`  Login:  ${admin.email}${admin.created ? " (senha do ADMIN_PASSWORD)" : ""}`);
  }
  if (notices.length) {
    console.log("\n  Atenção:");
    for (const n of notices) console.log(`  • ${n}`);
  }
  console.log("");
}

async function main() {
  console.log(`\nTirvo · seed ${MINIMAL ? "mínimo (produção)" : "de demonstração"}${RESET ? " com --reset" : ""}`);
  if (RESET) await resetData();
  const admin = await ensureAdmin();
  const settings = await ensureSettings(!MINIMAL);
  await ensurePages();

  if (MINIMAL) {
    await ensureCategories(false);
    await summary(admin);
    return;
  }

  const existing = await db.product.count();
  if (existing > 0) {
    console.log(`\n  Já existem ${existing} produtos cadastrados. Nada de demonstração foi criado.`);
    console.log("  Para apagar catálogo, pedidos e conteúdo e recriar a demonstração: npm run db:seed -- --reset");
    await summary(admin);
    return;
  }

  const categoryIds = await ensureCategories(true);
  const { refs } = await seedCatalog(categoryIds);
  const marketing = await seedMarketing(categoryIds, refs);
  await seedReviews(refs);
  await seedOrders(settings, refs, marketing);
  await seedNewsletter();
  await summary(admin);
}

main()
  .catch(async (e) => {
    console.error("\nFalha no seed:", e);
    await flushManifest().catch(() => null);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
