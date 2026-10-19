// Categorias iniciais de uma loja de eletrônicos em Curitiba. Sem imagens: a loja
// mostra o ícone (chaves de src/components/ui/category-icon.tsx). Tudo pode ser
// editado no painel, em Categorias.

export type SeedCategory = {
  name: string;
  slug: string;
  icon: string;
  featured?: boolean;
  description: string;
  children?: SeedCategory[];
};

export const CATEGORIES: SeedCategory[] = [
  {
    name: "Headsets Gamer",
    slug: "headsets-gamer",
    icon: "headset",
    featured: true,
    description: "Headsets com microfone para PC, PlayStation, Xbox, Nintendo Switch e celular.",
  },
  {
    name: "Fones de Ouvido",
    slug: "fones-de-ouvido",
    icon: "headphones",
    featured: true,
    description: "Fones Bluetooth, sem fio e com fio para o dia a dia, o treino e o trabalho.",
    children: [
      { name: "Fones Bluetooth", slug: "fones-bluetooth", icon: "bluetooth", description: "Fones sem fio com estojo de carregamento e fones de cabeça Bluetooth." },
      { name: "Fones com Fio", slug: "fones-com-fio", icon: "headphones", description: "Fones intra-auriculares e de cabeça com fio, P2 ou USB-C." },
    ],
  },
  {
    name: "Controles",
    slug: "controles",
    icon: "gamepad",
    featured: true,
    description: "Controles com e sem fio para videogame, PC e celular.",
  },
  {
    name: "Minigames",
    slug: "minigames",
    icon: "joystick",
    featured: true,
    description: "Minigames portáteis, consoles retrô e videogames de bolso com jogos na memória.",
  },
  {
    name: "Caixas de Som",
    slug: "caixas-de-som",
    icon: "speaker",
    featured: true,
    description: "Caixas de som Bluetooth portáteis, à prova d'água e para festa.",
  },
  {
    name: "Suportes de Celular",
    slug: "suportes-de-celular",
    icon: "smartphone",
    featured: true,
    description: "Suportes de celular para moto, bicicleta, carro e mesa.",
    children: [
      { name: "Suporte para Moto", slug: "suporte-para-moto", icon: "motorbike", description: "Suportes de guidão e retrovisor, com trava e proteção contra vibração." },
      { name: "Suporte para Bicicleta", slug: "suporte-para-bicicleta", icon: "bike", description: "Suportes de guidão para pedalar com o GPS à vista." },
      { name: "Suporte para Carro", slug: "suporte-para-carro", icon: "car", description: "Suportes de painel, para-brisa e saída de ar, magnéticos e com garra." },
      { name: "Suporte de Mesa e Tripé", slug: "suporte-de-mesa-e-tripe", icon: "smartphone", description: "Suportes de mesa, tripés e bastões para fotos, vídeos e chamadas." },
    ],
  },
  {
    name: "Acessórios para Carro",
    slug: "acessorios-para-carro",
    icon: "car",
    featured: true,
    description: "Bluetooth para carro, transmissores FM, carregadores veiculares e outros eletrônicos automotivos.",
    children: [
      { name: "Bluetooth para Carro", slug: "bluetooth-para-carro", icon: "bluetooth", description: "Receptores Bluetooth e transmissores FM para ouvir música e atender chamadas no carro." },
      { name: "Carregadores Veiculares", slug: "carregadores-veiculares", icon: "battery-charging", description: "Carregadores de acendedor com USB e USB-C, com carga rápida." },
      { name: "Câmeras Veiculares", slug: "cameras-veiculares", icon: "camera", description: "Câmeras de painel (dashcam) e de ré para gravar o trajeto e estacionar com segurança." },
    ],
  },
  {
    name: "Carregadores e Cabos",
    slug: "carregadores-e-cabos",
    icon: "battery-charging",
    featured: true,
    description: "Carregadores rápidos, cabos USB-C, Lightning e micro USB e power banks.",
    children: [
      { name: "Carregadores", slug: "carregadores", icon: "plug", description: "Carregadores de tomada com carga rápida e várias saídas." },
      { name: "Cabos", slug: "cabos", icon: "cable", description: "Cabos USB-C, Lightning e micro USB reforçados." },
      { name: "Power Banks", slug: "power-banks", icon: "battery-charging", description: "Baterias portáteis para carregar o celular em qualquer lugar." },
    ],
  },
  {
    name: "Beleza e Cabelo",
    slug: "beleza-e-cabelo",
    icon: "sparkles",
    featured: true,
    description: "Chapinhas, babyliss, secadores e aparadores para cuidar do cabelo em casa.",
    children: [
      { name: "Chapinhas", slug: "chapinhas", icon: "sparkles", description: "Pranchas alisadoras com placas de cerâmica e titânio e controle de temperatura." },
      { name: "Babyliss e Modeladores", slug: "babyliss-e-modeladores", icon: "sparkles", description: "Modeladores de cachos, babyliss e escovas modeladoras." },
      { name: "Secadores de Cabelo", slug: "secadores-de-cabelo", icon: "wind", description: "Secadores potentes, com íons e ar frio." },
      { name: "Aparadores e Barbeadores", slug: "aparadores-e-barbeadores", icon: "scissors", description: "Máquinas de cortar cabelo, aparadores de barba e barbeadores elétricos." },
    ],
  },
  {
    name: "Massageadores",
    slug: "massageadores",
    icon: "heart-pulse",
    featured: true,
    description: "Massageadores elétricos, pistolas de massagem e aparelhos para relaxar.",
  },
  {
    name: "Smartwatches",
    slug: "smartwatches",
    icon: "watch",
    featured: true,
    description: "Relógios inteligentes e pulseiras fitness compatíveis com Android e iPhone.",
  },
  {
    name: "Periféricos",
    slug: "perifericos",
    icon: "keyboard",
    featured: true,
    description: "Mouses, teclados, mousepads e webcams para PC e notebook.",
    children: [
      { name: "Mouses", slug: "mouses", icon: "mouse", description: "Mouses com e sem fio, gamer e para escritório." },
      { name: "Teclados", slug: "teclados", icon: "keyboard", description: "Teclados mecânicos, gamer e sem fio." },
      { name: "Mousepads", slug: "mousepads", icon: "mouse", description: "Mousepads gamer, grandes e com apoio de pulso." },
      { name: "Webcams", slug: "webcams", icon: "webcam", description: "Webcams Full HD com microfone para chamadas e lives." },
    ],
  },
];
