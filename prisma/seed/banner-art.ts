import { Ctx, circle, drawArt, ellipse, line, path, place, rect, type ArtKind, type Finish } from "./art";

// Fundos dos banners de demonstração no estilo Tirvo: preto profundo, grade técnica,
// brilho laranja, marcas de mira nos cantos e produtos à direita. O texto não vai na
// imagem: título, subtítulo e botão são campos do banner, editáveis no painel.

const ORANGE = "#ff5500";

type Item = { kind: ArtKind; finish: Finish; cx: number; floor: number; h: number; maxW?: number };
type Frame = { w: number; h: number };

function grid(c: Ctx, f: Frame) {
  const minor = c.pattern("grid-minor", 40, 40, `<path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity=".035" stroke-width="1"/>`);
  const major = c.pattern("grid-major", 200, 200, `<path d="M200 0H0V200" fill="none" stroke="#ffffff" stroke-opacity=".06" stroke-width="1"/>`);
  return rect(0, 0, f.w, f.h, 0, minor) + rect(0, 0, f.w, f.h, 0, major);
}

function corners(f: Frame, inset: number, len: number) {
  const s = `stroke="#ffffff" stroke-opacity=".28" stroke-width="2" fill="none" stroke-linecap="square"`;
  const a = inset;
  const b = f.w - inset;
  const t = inset;
  const u = f.h - inset;
  return [
    `<path d="M${a} ${t + len}V${t}H${a + len}" ${s}/>`,
    `<path d="M${b - len} ${t}H${b}V${t + len}" ${s}/>`,
    `<path d="M${a} ${u - len}V${u}H${a + len}" ${s}/>`,
    `<path d="M${b - len} ${u}H${b}V${u - len}" ${s}/>`,
  ].join("");
}

/** Mira (motivo da marca): círculo, cruz e ponto laranja. */
function crosshair(cx: number, cy: number, r: number, op = 0.35) {
  return (
    circle(cx, cy, r, "none", `stroke="#ffffff" stroke-opacity="${op}" stroke-width="1.5"`) +
    line(cx - r * 1.5, cy, cx - r * 0.45, cy, "#ffffff", 1.5, `stroke-opacity="${op}"`) +
    line(cx + r * 0.45, cy, cx + r * 1.5, cy, "#ffffff", 1.5, `stroke-opacity="${op}"`) +
    line(cx, cy - r * 1.5, cx, cy - r * 0.45, "#ffffff", 1.5, `stroke-opacity="${op}"`) +
    line(cx, cy + r * 0.45, cx, cy + r * 1.5, "#ffffff", 1.5, `stroke-opacity="${op}"`) +
    circle(cx, cy, Math.max(3, r * 0.12), ORANGE)
  );
}

function ticks(x: number, y: number, count: number, gap: number) {
  let s = "";
  for (let i = 0; i < count; i++) s += line(x + i * gap, y, x + i * gap, y + (i % 5 === 0 ? 14 : 7), "#ffffff", 1.2, `stroke-opacity=".22"`);
  return s;
}

function products(items: Item[], prefix: string) {
  let defs = "";
  let body = "";
  items.forEach((it, i) => {
    const c = new Ctx(`${prefix}${i}`);
    const d = drawArt(it.kind, it.finish, c);
    const scale = it.h / d.h;
    const w = Math.min(d.w * scale, it.maxW ?? Infinity);
    const p = place(d, { x: it.cx - w / 2, y: it.floor - it.h, w, h: it.h });
    const glow = c.rad("floorglow", [[0, ORANGE, 0.28], [1, ORANGE, 0]]);
    const shadow = c.rad("floorshadow", [[0, "#000", 0.85], [1, "#000", 0]]);
    body +=
      ellipse(p.x + p.w / 2, p.y + p.h + 4, p.w * 0.75, Math.max(14, p.w * 0.08), glow) +
      ellipse(p.x + p.w / 2, p.y + p.h, p.w * 0.6, Math.max(10, p.w * 0.05), shadow) +
      p.svg;
    defs += c.defsSvg();
  });
  return { defs, body };
}

function backdrop(c: Ctx, f: Frame, glowAt: { x: number; y: number; r: number }) {
  const bg = c.lin("bg", [[0, "#0d0d10"], [1, "#09090b"]], 0, 0, 0, 1);
  const glow = c.rad("glow", [[0, ORANGE, 0.42], [0.35, ORANGE, 0.14], [1, ORANGE, 0]]);
  const vignette = c.rad("vig", [[0.55, "#000", 0], [1, "#000", 0.55]], 0.5, 0.5, 0.75);
  return {
    under: rect(0, 0, f.w, f.h, 0, bg) + grid(c, f) + ellipse(glowAt.x, glowAt.y, glowAt.r, glowAt.r * 0.8, glow),
    over: rect(0, 0, f.w, f.h, 0, vignette),
  };
}

function svgDoc(f: Frame, defs: string, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f.w}" height="${f.h}" viewBox="0 0 ${f.w} ${f.h}">${defs}${body}</svg>`;
}

type Scene = {
  items: Item[];
  extra?: (f: Frame) => string;
  glow: { x: number; y: number; r: number };
  marks?: (f: Frame) => string;
};

function compose(f: Frame, scene: Scene, prefix: string) {
  const c = new Ctx(`${prefix}bg`);
  const back = backdrop(c, f, scene.glow);
  const prods = products(scene.items, prefix);
  const body =
    back.under +
    (scene.extra?.(f) ?? "") +
    prods.body +
    back.over +
    corners(f, Math.round(Math.min(f.w, f.h) * 0.045), Math.round(Math.min(f.w, f.h) * 0.05)) +
    (scene.marks?.(f) ?? "");
  return svgDoc(f, c.defsSvg() + prods.defs, body);
}

// ───────── Banners

const HERO: Frame = { w: 1920, h: 720 };
const HERO_M: Frame = { w: 1080, h: 1350 };
const STRIP: Frame = { w: 1200, h: 500 };
const STRIP_M: Frame = { w: 1080, h: 810 };

export type BannerArt = { desktop: string; mobile: string };

export function kitchenBanner(): BannerArt {
  return {
    desktop: compose(
      HERO,
      {
        glow: { x: 1380, y: 420, r: 560 },
        items: [
          { kind: "microwave", finish: "black", cx: 1700, floor: 610, h: 190 },
          { kind: "stove", finish: "inox", cx: 1360, floor: 640, h: 500 },
          { kind: "cooktop-induction", finish: "black", cx: 1060, floor: 650, h: 120 },
        ],
        marks: () => crosshair(1700, 170, 26) + ticks(1080, 96, 31, 18),
      },
      "hk",
    ),
    mobile: compose(
      HERO_M,
      {
        glow: { x: 560, y: 470, r: 520 },
        items: [
          { kind: "microwave", finish: "black", cx: 870, floor: 720, h: 180 },
          { kind: "stove", finish: "inox", cx: 540, floor: 760, h: 580 },
          { kind: "cooktop-induction", finish: "black", cx: 220, floor: 775, h: 110 },
        ],
        marks: () => crosshair(880, 190, 24) + ticks(120, 120, 25, 18),
      },
      "mk",
    ),
  };
}

export function climateBanner(): BannerArt {
  return {
    desktop: compose(
      HERO,
      {
        glow: { x: 1400, y: 380, r: 560 },
        items: [
          { kind: "ac", finish: "white", cx: 1190, floor: 260, h: 130 },
          { kind: "heater-oil", finish: "white", cx: 1240, floor: 640, h: 240 },
          { kind: "fan-column", finish: "black", cx: 1650, floor: 650, h: 540 },
        ],
        marks: () => crosshair(1500, 120, 22) + ticks(1080, 680, 31, 18),
      },
      "hc",
    ),
    mobile: compose(
      HERO_M,
      {
        glow: { x: 560, y: 420, r: 520 },
        items: [
          { kind: "ac", finish: "white", cx: 450, floor: 320, h: 170 },
          { kind: "heater-oil", finish: "white", cx: 330, floor: 780, h: 300 },
          { kind: "fan-column", finish: "black", cx: 800, floor: 790, h: 600 },
        ],
        marks: () => crosshair(900, 170, 22),
      },
      "mc",
    ),
  };
}

/** Raio de entrega: círculos de distância, rota tracejada e marcadores. */
function radar(cx: number, cy: number, r: number, route: [number, number][]) {
  let s = "";
  for (let i = 1; i <= 4; i++) {
    s += circle(cx, cy, (r * i) / 4, "none", `stroke="#ffffff" stroke-opacity="${0.16 - i * 0.02}" stroke-width="1.5" ${i % 2 ? `stroke-dasharray="6 10"` : ""}`);
  }
  s += line(cx - r, cy, cx + r, cy, "#ffffff", 1, `stroke-opacity=".08"`) + line(cx, cy - r, cx, cy + r, "#ffffff", 1, `stroke-opacity=".08"`);
  const d = `M${route.map(([x, y]) => `${x} ${y}`).join(" L")}`;
  s += path(d, "none", `stroke="${ORANGE}" stroke-width="4" stroke-dasharray="2 14" stroke-linecap="round" stroke-linejoin="round"`);
  const [ex, ey] = route[route.length - 1];
  s += circle(cx, cy, 16, ORANGE, `opacity=".25"`) + circle(cx, cy, 7, ORANGE);
  s += path(`M${ex} ${ey} c -16 -22 -26 -34 -26 -48 a26 26 0 0 1 52 0 c 0 14 -10 26 -26 48 Z`, ORANGE);
  s += circle(ex, ey - 48, 9, "#09090b");
  return s;
}

export function deliveryBanner(): BannerArt {
  return {
    desktop: compose(
      HERO,
      {
        glow: { x: 1380, y: 420, r: 520 },
        extra: () => radar(1380, 380, 330, [[1380, 380], [1470, 330], [1560, 350], [1650, 250], [1720, 200]]),
        items: [
          { kind: "fridge-duplex", finish: "inox", cx: 1210, floor: 660, h: 560 },
          { kind: "washer-front", finish: "graphite", cx: 1480, floor: 660, h: 300 },
        ],
        marks: () => ticks(1660, 620, 11, 18),
      },
      "hd",
    ),
    mobile: compose(
      HERO_M,
      {
        glow: { x: 540, y: 430, r: 520 },
        extra: () => radar(540, 400, 360, [[540, 400], [640, 340], [730, 360], [820, 250], [880, 190]]),
        items: [
          { kind: "fridge-duplex", finish: "inox", cx: 380, floor: 790, h: 640 },
          { kind: "washer-front", finish: "graphite", cx: 700, floor: 790, h: 340 },
        ],
      },
      "md",
    ),
  };
}

export function airfryerStrip(): BannerArt {
  return {
    desktop: compose(
      STRIP,
      {
        // Em 16:9 a faixa perde ~155 px de cada lado: os produtos ficam entre x 700 e 1040.
        glow: { x: 880, y: 280, r: 360 },
        items: [
          { kind: "airfryer-oven", finish: "black", cx: 962, floor: 412, h: 205 },
          { kind: "airfryer", finish: "black", cx: 772, floor: 440, h: 262 },
        ],
        marks: () => crosshair(990, 80, 16),
      },
      "sa",
    ),
    mobile: compose(
      STRIP_M,
      {
        // No celular o texto fica embaixo: produtos no alto, à direita.
        glow: { x: 760, y: 240, r: 400 },
        items: [
          { kind: "airfryer-oven", finish: "black", cx: 930, floor: 372, h: 230 },
          { kind: "airfryer", finish: "black", cx: 716, floor: 400, h: 280 },
        ],
        marks: () => crosshair(980, 80, 16),
      },
      "ma",
    ),
  };
}

/** Celular com a loja aberta e uma notificação de oferta chegando. */
function phone(c: Ctx, x: number, y: number, h: number) {
  const w = h * 0.49;
  const k = h / 600;
  const screen = c.lin("ph-screen", [[0, "#141417"], [1, "#0b0b0d"]], 0, 0, 0, 1);
  let s = rect(x + 10 * k, y + 14 * k, w, h, 46 * k, "#000", `opacity=".5"`);
  s += rect(x, y, w, h, 46 * k, c.lin("ph-frame", [[0, "#3a3d43"], [0.5, "#1a1b1e"], [1, "#2c2e33"]]), `stroke="#55595f" stroke-width="${2 * k}"`);
  s += rect(x + 12 * k, y + 12 * k, w - 24 * k, h - 24 * k, 36 * k, screen);
  s += rect(x + w / 2 - 34 * k, y + 24 * k, 68 * k, 18 * k, 9 * k, "#000");
  const ix = x + 30 * k;
  const iw = w - 60 * k;
  s += rect(ix, y + 64 * k, iw * 0.38, 12 * k, 6 * k, "#ffffff", `opacity=".85"`) + circle(ix + iw - 8 * k, y + 70 * k, 8 * k, ORANGE);
  s += rect(ix, y + 96 * k, iw, 30 * k, 15 * k, "#ffffff", `opacity=".08"`);
  s += rect(ix, y + 142 * k, iw, 120 * k, 18 * k, c.lin("ph-hero", [[0, "#2a1408"], [1, "#0f0f12"]], 0, 0, 1, 1), `stroke="#ffffff" stroke-opacity=".08"`);
  s += circle(ix + iw * 0.78, y + 200 * k, 46 * k, ORANGE, `opacity=".35"`);
  s += rect(ix + 16 * k, y + 176 * k, iw * 0.42, 12 * k, 6 * k, "#ffffff", `opacity=".9"`) + rect(ix + 16 * k, y + 198 * k, iw * 0.3, 8 * k, 4 * k, "#ffffff", `opacity=".45"`);
  s += rect(ix + 16 * k, y + 226 * k, 64 * k, 20 * k, 10 * k, ORANGE);
  for (let i = 0; i < 2; i++) {
    const cx = ix + i * (iw / 2 + 6 * k);
    const cw = iw / 2 - 6 * k;
    s += rect(cx, y + 278 * k, cw, 170 * k, 16 * k, "#ffffff", `opacity=".06"`);
    s += rect(cx + 10 * k, y + 288 * k, cw - 20 * k, 90 * k, 12 * k, "#f4f4f5", `opacity=".92"`);
    s += rect(cx + 10 * k, y + 392 * k, cw * 0.7, 8 * k, 4 * k, "#ffffff", `opacity=".6"`);
    s += rect(cx + 10 * k, y + 410 * k, cw * 0.45, 10 * k, 5 * k, ORANGE, `opacity=".9"`);
  }
  s += rect(ix, y + h - 92 * k, iw, 52 * k, 26 * k, "#ffffff", `opacity=".08"`);
  for (let i = 0; i < 4; i++) s += circle(ix + 30 * k + i * ((iw - 60 * k) / 3), y + h - 66 * k, 7 * k, i === 0 ? ORANGE : "#ffffff", i === 0 ? "" : `opacity=".4"`);
  return s;
}

function notification(c: Ctx, x: number, y: number, w: number) {
  const h = w * 0.3;
  let s = rect(x + 6, y + 10, w, h, h * 0.3, "#000", `opacity=".45"`);
  s += rect(x, y, w, h, h * 0.3, c.lin("notif", [[0, "#26272b"], [1, "#1a1b1e"]], 0, 0, 0, 1), `stroke="#ffffff" stroke-opacity=".14" stroke-width="1.5"`);
  const ic = h * 0.56;
  s += rect(x + h * 0.22, y + (h - ic) / 2, ic, ic, ic * 0.28, ORANGE);
  // sino
  const bx = x + h * 0.22 + ic / 2;
  const by = y + h / 2;
  const b = ic * 0.26;
  s += path(`M${bx - b} ${by + b * 0.6} Q${bx - b} ${by - b * 1.1} ${bx} ${by - b * 1.15} Q${bx + b} ${by - b * 1.1} ${bx + b} ${by + b * 0.6} Z`, "#09090b");
  s += circle(bx, by + b * 0.95, b * 0.28, "#09090b");
  const tx = x + h * 0.22 + ic + h * 0.2;
  s += rect(tx, y + h * 0.3, w * 0.42, h * 0.13, h * 0.065, "#ffffff", `opacity=".9"`);
  s += rect(tx, y + h * 0.56, w * 0.56, h * 0.11, h * 0.055, "#ffffff", `opacity=".45"`);
  s += circle(x + w - h * 0.22, y + h * 0.32, h * 0.07, ORANGE);
  return s;
}

export function appStrip(): BannerArt {
  const build = (f: Frame, prefix: string, ph: { x: number; y: number; h: number }, nt: { x: number; y: number; w: number }, glow: { x: number; y: number; r: number }) => {
    const c = new Ctx(prefix);
    const back = backdrop(c, f, glow);
    const body =
      back.under +
      phone(c, ph.x, ph.y, ph.h) +
      notification(c, nt.x, nt.y, nt.w) +
      back.over +
      corners(f, Math.round(Math.min(f.w, f.h) * 0.045), Math.round(Math.min(f.w, f.h) * 0.05)) +
      crosshair(nt.x - 34, nt.y - 40, 14);
    return svgDoc(f, c.defsSvg(), body);
  };
  return {
    desktop: build(STRIP, "sp", { x: 770, y: 56, h: 520 }, { x: 630, y: 140, w: 290 }, { x: 880, y: 250, r: 360 }),
    mobile: build(STRIP_M, "mp", { x: 700, y: 50, h: 560 }, { x: 470, y: 130, w: 330 }, { x: 800, y: 260, r: 400 }),
  };
}
