// Menu do painel. Cada módulo do painel tem a sua rota em src/app/admin/(panel)/<rota>.
export const ADMIN_NAV = [
  {
    group: "Visão geral",
    items: [
      { href: "/admin", label: "Painel", icon: "LayoutDashboard" },
      { href: "/admin/loja-pronta", label: "Loja pronta", icon: "ListChecks" },
    ],
  },
  {
    group: "Vendas",
    items: [
      { href: "/admin/pedidos", label: "Pedidos", icon: "ShoppingBag", badge: "orders" },
      { href: "/admin/clientes", label: "Clientes", icon: "Users" },
    ],
  },
  {
    group: "Catálogo",
    items: [
      { href: "/admin/produtos", label: "Produtos", icon: "Package" },
      { href: "/admin/categorias", label: "Categorias", icon: "FolderTree" },
      { href: "/admin/marcas", label: "Marcas", icon: "Tags" },
      { href: "/admin/avaliacoes", label: "Avaliações", icon: "Star", badge: "reviews" },
    ],
  },
  {
    group: "Marketing",
    items: [
      { href: "/admin/banners", label: "Banners", icon: "GalleryHorizontal" },
      { href: "/admin/promocoes", label: "Promoções e ofertas", icon: "BadgePercent" },
      { href: "/admin/cupons", label: "Cupons", icon: "Ticket" },
      { href: "/admin/notificacoes", label: "Notificações do app", icon: "BellRing" },
      { href: "/admin/newsletter", label: "Newsletter", icon: "Mail" },
    ],
  },
  {
    group: "Loja",
    items: [
      { href: "/admin/paginas", label: "Páginas", icon: "FileText" },
      { href: "/admin/configuracoes", label: "Configurações", icon: "Settings" },
      { href: "/admin/usuarios", label: "Usuários", icon: "ShieldCheck" },
    ],
  },
] as const;
