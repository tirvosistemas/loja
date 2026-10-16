import {
  AirVent, Blend, Coffee, CookingPot, Droplets, Fan, Flame, Heater, Microwave, Package, Plug, Refrigerator, Snowflake,
  Sparkles, Speaker, Tv, Utensils, WashingMachine, Wind, Zap, Lamp, Shirt, Baby, type LucideIcon,
} from "lucide-react";

// Ícones disponíveis para categorias (escolhidos no painel, exibidos na loja).
export const CATEGORY_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  refrigerator: { icon: Refrigerator, label: "Geladeira" },
  snowflake: { icon: Snowflake, label: "Freezer / gelo" },
  flame: { icon: Flame, label: "Fogão / chama" },
  "cooking-pot": { icon: CookingPot, label: "Cozinha" },
  microwave: { icon: Microwave, label: "Micro-ondas / forno" },
  "washing-machine": { icon: WashingMachine, label: "Lavadora" },
  "air-vent": { icon: AirVent, label: "Ar-condicionado" },
  fan: { icon: Fan, label: "Ventilador" },
  wind: { icon: Wind, label: "Climatização" },
  heater: { icon: Heater, label: "Aquecedor" },
  coffee: { icon: Coffee, label: "Cafeteira" },
  blend: { icon: Blend, label: "Liquidificador / mixer" },
  utensils: { icon: Utensils, label: "Utensílios / lava-louças" },
  tv: { icon: Tv, label: "TV" },
  speaker: { icon: Speaker, label: "Áudio" },
  sparkles: { icon: Sparkles, label: "Limpeza" },
  droplets: { icon: Droplets, label: "Água / purificador" },
  shirt: { icon: Shirt, label: "Roupas / passadoria" },
  lamp: { icon: Lamp, label: "Iluminação" },
  plug: { icon: Plug, label: "Eletrônicos" },
  zap: { icon: Zap, label: "Energia" },
  baby: { icon: Baby, label: "Bebê" },
  package: { icon: Package, label: "Outros" },
};

export function CategoryIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && CATEGORY_ICONS[name]?.icon) || Package;
  return <Icon className={className} aria-hidden />;
}
