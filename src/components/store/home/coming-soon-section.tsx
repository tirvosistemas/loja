import {
  BatteryCharging, Bluetooth, Cable, Car, Gamepad2, Headphones, Headset, HeartPulse, Joystick, Keyboard, Mouse, Smartphone,
  Sparkles, Speaker, Watch, Wind, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

// Um ícone por cartão, diferente em cada seção para a página não ficar repetida.
const ICONS = {
  destaques: [Headset, Gamepad2, Smartphone, Watch],
  ofertas: [Headphones, Speaker, Sparkles, BatteryCharging],
  lancamentos: [Joystick, Bluetooth, Wind, Mouse],
  "mais-vendidos": [Car, HeartPulse, Keyboard, Cable],
} satisfies Record<string, LucideIcon[]>;

/** Cartão no lugar de um produto que ainda vai ser cadastrado (decorativo, sem animação). */
function PlaceholderCard({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col overflow-hidden rounded-2xl border border-dashed border-border-strong bg-card", className)}>
      <div className="flex aspect-square flex-col items-center justify-center gap-2.5 bg-elevated text-subtle">
        <Icon className="size-8 opacity-70 sm:size-9" />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em]">Em breve</span>
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        <span className="h-3.5 w-4/5 rounded bg-muted" />
        <span className="h-4 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );
}

/** Seção da página inicial enquanto a loja ainda não tem produtos: mesmo título da seção real, com cartões "Em breve". */
export function ComingSoonSection({
  name,
  eyebrow,
  title,
  description,
}: {
  name: keyof typeof ICONS;
  eyebrow: string;
  title: string;
  description: string;
}) {
  const id = `${name}-titulo`;
  return (
    <section aria-labelledby={id} className="container-page">
      <SectionHeader id={id} eyebrow={eyebrow} title={title} description={description} />
      <div aria-hidden className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {ICONS[name].map((icon, i) => (
          // Em 3 colunas (tablet/notebook) mostra só 3, para não sobrar uma linha pela metade.
          <PlaceholderCard key={i} icon={icon} className={i >= 3 ? "md:max-xl:hidden" : undefined} />
        ))}
      </div>
    </section>
  );
}
