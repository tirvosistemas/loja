import {
  BatteryCharging, Bike, Bluetooth, Cable, Camera, Car, Cctv, Gamepad2, Headphones, Headset, HeartPulse, Joystick,
  Keyboard, Lightbulb, MemoryStick, Mic, Monitor, Motorbike, Mouse, Package, Plug, Scissors, Smartphone, Sparkles,
  Speaker, Tv, Watch, Webcam, Wind, Zap, type LucideIcon,
} from "lucide-react";

// Ícones disponíveis para categorias (escolhidos no painel, exibidos na loja).
export const CATEGORY_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  headset: { icon: Headset, label: "Headset gamer" },
  headphones: { icon: Headphones, label: "Fones de ouvido" },
  gamepad: { icon: Gamepad2, label: "Controle / games" },
  joystick: { icon: Joystick, label: "Minigame / retrô" },
  speaker: { icon: Speaker, label: "Caixa de som" },
  mic: { icon: Mic, label: "Microfone" },
  smartphone: { icon: Smartphone, label: "Celular / suporte" },
  "battery-charging": { icon: BatteryCharging, label: "Carregador / power bank" },
  cable: { icon: Cable, label: "Cabos" },
  plug: { icon: Plug, label: "Tomada / adaptador" },
  car: { icon: Car, label: "Carro" },
  motorbike: { icon: Motorbike, label: "Moto" },
  bike: { icon: Bike, label: "Bicicleta" },
  bluetooth: { icon: Bluetooth, label: "Bluetooth" },
  sparkles: { icon: Sparkles, label: "Beleza / cabelo" },
  wind: { icon: Wind, label: "Secador" },
  scissors: { icon: Scissors, label: "Aparador / barbeador" },
  "heart-pulse": { icon: HeartPulse, label: "Massageador / bem-estar" },
  watch: { icon: Watch, label: "Smartwatch / relógio" },
  mouse: { icon: Mouse, label: "Mouse" },
  keyboard: { icon: Keyboard, label: "Teclado / periféricos" },
  webcam: { icon: Webcam, label: "Webcam" },
  monitor: { icon: Monitor, label: "Monitor / informática" },
  "memory-stick": { icon: MemoryStick, label: "Pendrive / memória" },
  camera: { icon: Camera, label: "Câmera" },
  cctv: { icon: Cctv, label: "Câmera de segurança" },
  lightbulb: { icon: Lightbulb, label: "Iluminação / LED" },
  tv: { icon: Tv, label: "TV / vídeo" },
  zap: { icon: Zap, label: "Energia" },
  package: { icon: Package, label: "Outros" },
};

export function CategoryIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && CATEGORY_ICONS[name]?.icon) || Package;
  return <Icon className={className} aria-hidden />;
}
