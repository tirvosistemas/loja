import { db } from "@/lib/db";
import { enabledPaymentMethods, getSettings, stripeIsReady } from "@/lib/settings";
import { getAiConfig } from "@/lib/ai/client";
import { LEGAL_PAGES } from "@/lib/legal-pages";

// Checklist "Loja pronta": o que falta antes de abrir (e o que melhora as vendas).

export type CheckLevel = "required" | "recommended" | "optional";

export type ReadinessCheck = {
  id: string;
  title: string;
  ok: boolean;
  level: CheckLevel;
  detail: string;
  href?: string;
  cta?: string;
  /** Alguns itens com problema (ex.: produtos sem foto). */
  examples?: { label: string; href: string }[];
  count?: number;
};

export type ReadinessGroup = { title: string; checks: ReadinessCheck[] };

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

async function productsWhere(where: object, take = 5) {
  const [count, rows] = await Promise.all([
    db.product.count({ where: { status: "ACTIVE", ...where } }),
    db.product.findMany({ where: { status: "ACTIVE", ...where }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" }, take }),
  ]);
  return { count, examples: rows.map((r) => ({ label: r.name, href: `/admin/produtos/${r.id}` })) };
}

export async function getReadiness(): Promise<ReadinessGroup[]> {
  const s = await getSettings();
  const [active, drafts, categories, emptyCats, noPhoto, noDesc, noCat, noCost, noWeight, outOfStock, pages, banners, ai] = await Promise.all([
    db.product.count({ where: { status: "ACTIVE" } }),
    db.product.count({ where: { status: "DRAFT" } }),
    db.category.count({ where: { active: true } }),
    db.category.findMany({ where: { active: true, parentId: { not: null }, products: { none: { status: "ACTIVE" } } }, select: { id: true, name: true }, take: 50 }),
    productsWhere({ images: { none: {} } }),
    productsWhere({ OR: [{ description: null }, { description: "" }] }),
    productsWhere({ categoryId: null }),
    productsWhere({ costCents: null }),
    productsWhere({ OR: [{ weightGrams: null }, { widthCm: null }] }),
    productsWhere({ trackStock: true, allowBackorder: false, stock: 0 }),
    db.page.findMany({ where: { published: true }, select: { slug: true } }),
    db.banner.count({ where: { active: true, placement: "HERO" } }),
    getAiConfig(),
  ]);
  const pageSlugs = new Set(pages.map((p) => p.slug));
  const missingLegal = LEGAL_PAGES.filter((p) => p.id !== "entregas" && !pageSlugs.has(p.id));
  const methods = enabledPaymentMethods(s);
  const appUrl = process.env.APP_URL ?? "";
  const st = s.store;

  return [
    {
      title: "Dados da loja",
      checks: [
        {
          id: "whatsapp",
          title: "WhatsApp que recebe os pedidos",
          ok: st.whatsapp.length >= 12,
          level: "required",
          detail: "Todo pedido chega por ele. Sem o número, o cliente não consegue finalizar.",
          href: "/admin/configuracoes?aba=loja",
          cta: "Cadastrar WhatsApp",
        },
        {
          id: "company",
          title: "Razão social e CNPJ",
          ok: !!st.legalName && !!st.cnpj,
          level: "required",
          detail: "A lei do comércio eletrônico (Decreto 7.962/2013) exige mostrar no site.",
          href: "/admin/configuracoes?aba=loja",
          cta: "Preencher",
        },
        {
          id: "email",
          title: "E-mail de contato",
          ok: !!st.email,
          level: "recommended",
          detail: "Aparece no rodapé e nas páginas legais.",
          href: "/admin/configuracoes?aba=loja",
          cta: "Preencher",
        },
        {
          id: "address",
          title: "Endereço da loja localizado no mapa",
          ok: !!s.address.street && s.address.lat != null,
          level: "required",
          detail: "O frete por km é calculado a partir dele.",
          href: "/admin/configuracoes?aba=endereco",
          cta: "Configurar endereço",
        },
        {
          id: "domain",
          title: "Endereço do site (domínio)",
          ok: /^https:\/\//.test(appUrl) && !/localhost|127\.0\.0\.1/.test(appUrl),
          level: "required",
          detail: `${appUrl ? `Hoje está como ${appUrl}.` : "Ainda não definido."} É configurado na hospedagem (APP_URL), com o domínio da loja em https. Pagamento, Google e catálogo usam esse endereço.`,
        },
      ],
    },
    {
      title: "Venda e entrega",
      checks: [
        {
          id: "payment",
          title: "Formas de pagamento",
          ok: methods.length > 0,
          level: "required",
          detail: methods.length ? plural(methods.length, "forma ativa", "formas ativas") : "Nenhuma forma de pagamento ligada.",
          href: "/admin/configuracoes?aba=pagamentos",
          cta: "Configurar",
        },
        {
          id: "pix",
          title: "Chave Pix da loja",
          ok: !!s.payment.pixKey,
          level: "recommended",
          detail: "Pix com desconto costuma ser a forma mais usada.",
          href: "/admin/configuracoes?aba=pagamentos",
          cta: "Cadastrar chave",
        },
        {
          id: "stripe",
          title: "Pagamento online com cartão",
          ok: stripeIsReady(s),
          level: "optional",
          detail: "Cartão, Pix e boleto online pela Stripe, com confirmação automática.",
          href: "/admin/configuracoes?aba=integracoes",
          cta: "Conectar Stripe",
        },
        {
          id: "shipping",
          title: "Entrega ou retirada",
          ok: (s.shipping.enabled && s.address.lat != null) || s.address.pickupEnabled,
          level: "required",
          detail: "Frete por km, frete grátis e cidades atendidas.",
          href: "/admin/configuracoes?aba=frete",
          cta: "Configurar frete",
        },
      ],
    },
    {
      title: "Catálogo",
      checks: [
        {
          id: "products",
          title: "Produtos ativos na loja",
          ok: active > 0,
          level: "required",
          detail: active ? `${plural(active, "produto ativo", "produtos ativos")}${drafts ? ` · ${plural(drafts, "rascunho", "rascunhos")} esperando revisão` : ""}.` : drafts ? `${plural(drafts, "rascunho", "rascunhos")}: revise e ative.` : "Cadastre ou importe os produtos.",
          href: active || !drafts ? "/admin/produtos/importar" : "/admin/produtos?status=DRAFT",
          cta: active || !drafts ? "Importar produtos" : "Ver rascunhos",
        },
        {
          id: "categories",
          title: "Categorias",
          ok: categories > 0 && emptyCats.length === 0,
          level: "recommended",
          detail: categories ? (emptyCats.length ? `${plural(emptyCats.length, "subcategoria sem produto aparece vazia", "subcategorias sem produtos aparecem vazias")} na loja.` : "Todas com produtos.") : "Crie as categorias do menu.",
          href: "/admin/categorias",
          cta: "Ver categorias",
          examples: emptyCats.slice(0, 5).map((c) => ({ label: c.name, href: "/admin/categorias" })),
          count: emptyCats.length,
        },
        {
          id: "photos",
          title: "Produtos com foto",
          ok: noPhoto.count === 0,
          level: "required",
          detail: noPhoto.count ? `${plural(noPhoto.count, "produto ativo está", "produtos ativos estão")} sem foto.` : "Todos os ativos têm foto.",
          href: "/admin/produtos",
          cta: "Ver produtos",
          examples: noPhoto.examples,
          count: noPhoto.count,
        },
        {
          id: "description",
          title: "Produtos com descrição",
          ok: noDesc.count === 0,
          level: "recommended",
          detail: noDesc.count ? `${plural(noDesc.count, "produto sem descrição", "produtos sem descrição")}. Use “Preencher com IA” no cadastro.` : "Todos têm descrição.",
          href: "/admin/produtos",
          cta: "Ver produtos",
          examples: noDesc.examples,
          count: noDesc.count,
        },
        {
          id: "category",
          title: "Produtos com categoria",
          ok: noCat.count === 0,
          level: "recommended",
          detail: noCat.count ? `${plural(noCat.count, "produto não aparece", "produtos não aparecem")} no menu de categorias.` : "Todos estão em uma categoria.",
          href: "/admin/produtos/editar-em-massa",
          cta: "Editar em massa",
          examples: noCat.examples,
          count: noCat.count,
        },
        {
          id: "cost",
          title: "Custo cadastrado (para a margem)",
          ok: noCost.count === 0,
          level: "optional",
          detail: noCost.count ? `${plural(noCost.count, "produto sem custo", "produtos sem custo")}: a calculadora de preço não consegue sugerir.` : "Todos têm custo.",
          href: "/admin/produtos/editar-em-massa",
          cta: "Editar em massa",
          examples: noCost.examples,
          count: noCost.count,
        },
        {
          id: "weight",
          title: "Peso e medidas",
          ok: noWeight.count === 0,
          level: "optional",
          detail: noWeight.count ? `${plural(noWeight.count, "produto sem peso ou medidas", "produtos sem peso ou medidas")} (usados no Google Shopping e em envios futuros).` : "Todos preenchidos.",
          href: "/admin/produtos/editar-em-massa",
          cta: "Editar em massa",
          examples: noWeight.examples,
          count: noWeight.count,
        },
        {
          id: "stock",
          title: "Estoque",
          ok: outOfStock.count === 0,
          level: "optional",
          detail: outOfStock.count ? `${plural(outOfStock.count, "produto ativo está zerado", "produtos ativos estão zerados")} e aparece como esgotado.` : "Nenhum ativo zerado.",
          href: "/admin/produtos?estoque=zerado",
          cta: "Ver zerados",
          examples: outOfStock.examples,
          count: outOfStock.count,
        },
      ],
    },
    {
      title: "Páginas e aparência",
      checks: [
        {
          id: "legal",
          title: "Trocas, privacidade e termos de uso",
          ok: missingLegal.length === 0,
          level: "required",
          detail: missingLegal.length ? `Faltam: ${missingLegal.map((p) => p.title.toLowerCase()).join(", ")}. Gere com os dados da loja em um clique.` : "Publicadas.",
          href: "/admin/paginas",
          cta: "Gerar páginas",
        },
        {
          id: "banners",
          title: "Banner na página inicial",
          ok: banners > 0,
          level: "recommended",
          detail: "Destaque ofertas e novidades no topo da loja.",
          href: "/admin/banners",
          cta: "Criar banner",
        },
        {
          id: "seo",
          title: "Título e descrição para o Google",
          ok: !!s.seo.title && !!s.seo.description && s.seo.description.length >= 70,
          level: "recommended",
          detail: "É o que aparece no resultado da busca.",
          href: "/admin/configuracoes?aba=seo",
          cta: "Revisar SEO",
        },
      ],
    },
    {
      title: "Divulgação e ferramentas",
      checks: [
        {
          id: "analytics",
          title: "Google Analytics ou Pixel da Meta",
          ok: !!s.integrations.googleAnalyticsId || !!s.integrations.metaPixelId,
          level: "optional",
          detail: "Para medir visitas e anúncios.",
          href: "/admin/configuracoes?aba=integracoes",
          cta: "Configurar",
        },
        {
          id: "feed",
          title: "Catálogo para Google e Instagram",
          ok: s.catalog.feedEnabled,
          level: "optional",
          detail: "Link pronto para o Merchant Center e o Gerenciador de Comércio.",
          href: "/admin/configuracoes?aba=catalogo",
          cta: "Ver links",
        },
        {
          id: "ai",
          title: "Inteligência artificial",
          ok: !!ai,
          level: "optional",
          detail: "Preenche cadastros a partir das fotos. O Gemini tem plano grátis.",
          href: "/admin/configuracoes?aba=ia",
          cta: "Configurar IA",
        },
      ],
    },
  ];
}

export function readinessScore(groups: ReadinessGroup[]) {
  const all = groups.flatMap((g) => g.checks);
  const required = all.filter((c) => c.level === "required");
  return { done: all.filter((c) => c.ok).length, total: all.length, requiredMissing: required.filter((c) => !c.ok).length };
}
