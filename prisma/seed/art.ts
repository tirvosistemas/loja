// Ilustrações vetoriais dos produtos de demonstração. Cada aparelho é desenhado em SVG
// (formas simples, acabamento inox/branco/preto, sombras suaves e um LED laranja discreto)
// e depois convertido em PNG com o sharp antes de ir para o armazenamento de imagens.

export type Finish = "inox" | "white" | "black" | "graphite" | "red";

export type ArtKind =
  | "fridge-duplex" | "fridge-inverse" | "fridge-side" | "fridge-1door" | "freezer"
  | "stove" | "stove-4" | "cooktop-induction" | "cooktop-gas"
  | "microwave" | "oven"
  | "washer-front" | "dryer" | "washer-top" | "dishwasher"
  | "ac" | "fan-column" | "heater-oil" | "heater-fan"
  | "airfryer" | "airfryer-oven" | "espresso" | "coffee-drip" | "blender" | "mixer" | "stand-mixer"
  | "tv" | "soundbar" | "vacuum-stick" | "robot-vacuum" | "purifier" | "water-cooler";

export type Drawing = {
  w: number;
  h: number;
  svg: string;
  /** Profundidade da caixa, para a vista em perspectiva. */
  depth?: number;
  /** Altura do corpo (sem pés) usada na lateral da perspectiva. */
  boxH?: number;
  /** Recorte [x, y, largura, altura] para a vista de detalhe. */
  detail?: [number, number, number, number];
  /** Segunda vista própria (porta aberta, vista de cima…). */
  alt?: () => Drawing;
  altLabel?: string;
};

type Stop = [number, string, number?];

const LED = "#ff5500";

const n = (v: number) => Math.round(v * 10) / 10;
const attrs = (extra?: string) => (extra ? ` ${extra}` : "");

export const rect = (x: number, y: number, w: number, h: number, rx: number, fill: string, extra?: string) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(rx)}" fill="${fill}"${attrs(extra)}/>`;
export const circle = (cx: number, cy: number, r: number, fill: string, extra?: string) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${attrs(extra)}/>`;
export const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, extra?: string) =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${attrs(extra)}/>`;
export const path = (d: string, fill: string, extra?: string) => `<path d="${d}" fill="${fill}"${attrs(extra)}/>`;
export const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, sw: number, extra?: string) =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"${attrs(extra)}/>`;

const FIN: Record<Finish, { body: string[]; edge: string; side: [string, string]; top: [string, string]; ink: string; soft: string; dark: boolean }> = {
  inox: { body: ["#a9aeb5", "#dcdfe3", "#f3f4f6", "#c6cad0", "#a3a8af"], edge: "#80868d", side: ["#868c93", "#b3b8be"], top: ["#d6d9dd", "#f0f1f3"], ink: "#474c53", soft: "#959ba2", dark: false },
  white: { body: ["#e0e1e4", "#f5f5f6", "#ffffff", "#eeeff1", "#dbdde0"], edge: "#c1c4c9", side: ["#c9ccd1", "#e4e5e8"], top: ["#ecedef", "#fbfbfc"], ink: "#6b7077", soft: "#c6c9ce", dark: false },
  black: { body: ["#111214", "#23252a", "#30333a", "#1a1c20", "#0d0e10"], edge: "#030304", side: ["#060708", "#141518"], top: ["#2a2d33", "#3c4047"], ink: "#a7acb4", soft: "#3a3d43", dark: true },
  graphite: { body: ["#32353a", "#4d5158", "#60646c", "#41444a", "#2d2f33"], edge: "#1d1f22", side: ["#212326", "#373a3f"], top: ["#565a61", "#6c7077"], ink: "#c7cbd1", soft: "#595d64", dark: true },
  red: { body: ["#8a1318", "#b51e25", "#cd2b32", "#a31a20", "#7d1015"], edge: "#590a0d", side: ["#670e12", "#8a1318"], top: ["#c2252c", "#da4248"], ink: "#f7d6d7", soft: "#a1262c", dark: true },
};

/** Registro de gradientes e padrões de um desenho (ids únicos por prefixo). */
export class Ctx {
  private defs = new Map<string, string>();
  constructor(readonly prefix: string) {}

  private add(key: string, build: (id: string) => string) {
    const id = `${this.prefix}-${key}`;
    if (!this.defs.has(id)) this.defs.set(id, build(id));
    return `url(#${id})`;
  }

  lin(key: string, stops: Stop[], x1 = 0, y1 = 0, x2 = 1, y2 = 0) {
    return this.add(key, (id) => {
      const s = stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ""}/>`).join("");
      return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${s}</linearGradient>`;
    });
  }

  rad(key: string, stops: Stop[], cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy) {
    return this.add(key, (id) => {
      const s = stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ""}/>`).join("");
      return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${s}</radialGradient>`;
    });
  }

  pattern(key: string, w: number, h: number, body: string) {
    return this.add(key, (id) => `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${body}</pattern>`);
  }

  // Materiais
  fin(f: Finish) {
    const b = FIN[f].body;
    return this.lin(`fin-${f}`, [[0, b[0]], [0.28, b[1]], [0.5, b[2]], [0.74, b[3]], [1, b[4]]]);
  }
  finV(f: Finish) {
    const b = FIN[f].body;
    return this.lin(`finv-${f}`, [[0, b[2]], [0.45, b[1]], [1, b[4]]], 0, 0, 0, 1);
  }
  side(f: Finish) {
    const s = FIN[f].side;
    return this.lin(`side-${f}`, [[0, s[1]], [1, s[0]]]);
  }
  top(f: Finish) {
    const t = FIN[f].top;
    return this.lin(`top-${f}`, [[0, t[0]], [1, t[1]]], 0, 1, 0, 0);
  }
  chrome() {
    return this.lin("chrome", [[0, "#767c83"], [0.3, "#e7e9ec"], [0.5, "#ffffff"], [0.72, "#aeb3b9"], [1, "#80868d"]]);
  }
  chromeV() {
    return this.lin("chromev", [[0, "#ffffff"], [0.45, "#d5d8dc"], [1, "#7c8289"]], 0, 0, 0, 1);
  }
  glass() {
    return this.lin("glass", [[0, "#2b2f35"], [0.55, "#141619"], [1, "#0a0b0c"]], 0, 0, 0, 1);
  }
  gloss() {
    return this.lin("gloss", [[0, "#ffffff", 0.34], [0.38, "#ffffff", 0.07], [0.62, "#ffffff", 0], [1, "#ffffff", 0]], 0, 0, 1, 1);
  }
  sheen() {
    return this.lin("sheen", [[0, "#ffffff", 0], [0.5, "#ffffff", 0.16], [1, "#ffffff", 0]]);
  }
  shade() {
    return this.lin("shade", [[0, "#000000", 0], [1, "#000000", 0.22]], 0, 0, 0, 1);
  }
  brushed() {
    return this.pattern("brushed", 7, 60, `<rect width="1.2" height="60" fill="#ffffff" opacity=".22"/><rect x="4" width=".8" height="60" fill="#000000" opacity=".05"/>`);
  }
  ledGlow() {
    return this.rad("ledglow", [[0, LED, 0.55], [1, LED, 0]]);
  }
  edge(f: Finish) {
    return FIN[f].edge;
  }
  ink(f: Finish) {
    return FIN[f].ink;
  }
  soft(f: Finish) {
    return FIN[f].soft;
  }
  isDark(f: Finish) {
    return FIN[f].dark;
  }

  defsSvg() {
    return `<defs>${[...this.defs.values()].join("")}</defs>`;
  }
}

// ───────── Peças reutilizáveis

function led(c: Ctx, x: number, y: number, r = 4) {
  return circle(x, y, r * 3.2, c.ledGlow()) + circle(x, y, r, LED) + circle(x - r * 0.3, y - r * 0.3, r * 0.35, "#ffd2bd", `opacity=".9"`);
}

/** "88" estilizado de mostrador digital. */
function digits(x: number, y: number, h: number, count: number, color = "#e9eef6") {
  const w = h * 0.56;
  const sw = Math.max(1.2, h * 0.13);
  let s = "";
  for (let i = 0; i < count; i++) {
    const dx = x + i * (w + h * 0.28);
    s += rect(dx, y, w, h, h * 0.12, "none", `stroke="${color}" stroke-width="${n(sw)}" opacity=".9"`);
    s += line(dx + sw, y + h / 2, dx + w - sw, y + h / 2, color, sw, `opacity=".9"`);
  }
  return s;
}

function displayPanel(c: Ctx, x: number, y: number, w: number, h: number, nDigits = 2, withLed = true) {
  const dh = h * 0.5;
  let s = rect(x, y, w, h, Math.min(8, h * 0.25), "#0c0d0f", `stroke="#000" stroke-opacity=".4"`);
  s += rect(x, y, w, h * 0.45, Math.min(8, h * 0.25), "#ffffff", `opacity=".05"`);
  s += digits(x + w * 0.14, y + (h - dh) / 2, dh, nDigits);
  if (withLed) s += led(c, x + w - Math.max(8, h * 0.28), y + h / 2, Math.max(2.4, h * 0.09));
  return s;
}

function handleV(c: Ctx, x: number, y: number, h: number, w = 10) {
  return (
    rect(x + 3, y + 5, w, h, w / 2, "#000", `opacity=".13"`) +
    rect(x - 1, y + 4, w + 2, 10, 3, "#6e747b") +
    rect(x - 1, y + h - 14, w + 2, 10, 3, "#6e747b") +
    rect(x, y, w, h, w / 2, c.chrome(), `stroke="#7a8087" stroke-width="1"`)
  );
}

function handleH(c: Ctx, x: number, y: number, w: number, h = 10) {
  return (
    rect(x + 2, y + 4, w, h, h / 2, "#000", `opacity=".14"`) +
    rect(x, y, w, h, h / 2, c.chromeV(), `stroke="#7a8087" stroke-width="1"`)
  );
}

function knob(c: Ctx, cx: number, cy: number, r: number, dark = false) {
  const face = dark
    ? c.rad("knob-d", [[0, "#4a4d53"], [1, "#16171a"]], 0.4, 0.35, 0.7)
    : c.rad("knob-l", [[0, "#ffffff"], [0.6, "#d3d6da"], [1, "#8c9198"]], 0.4, 0.35, 0.75);
  return (
    circle(cx + r * 0.08, cy + r * 0.14, r * 1.04, "#000", `opacity=".16"`) +
    circle(cx, cy, r, face, `stroke="${dark ? "#000" : "#7d838a"}" stroke-width="1.2"`) +
    circle(cx, cy, r * 0.72, "none", `stroke="${dark ? "#ffffff" : "#000000"}" stroke-opacity=".12" stroke-width="1"`) +
    line(cx, cy - r * 0.2, cx, cy - r * 0.78, dark ? "#e8eaed" : "#3a3e44", Math.max(1.6, r * 0.14))
  );
}

function feet(xs: number[], y: number, w = 26, h = 12) {
  return xs.map((x) => rect(x, y, w, h, 4, "#121315")).join("");
}

function vents(x: number, y: number, w: number, count: number, gap: number, color = "#000", op = 0.35, sw = 2) {
  let s = "";
  for (let i = 0; i < count; i++) s += line(x, y + i * gap, x + w, y + i * gap, color, sw, `opacity="${op}"`);
  return s;
}

function bodyBox(c: Ctx, f: Finish, x: number, y: number, w: number, h: number, r: number) {
  let s = rect(x, y, w, h, r, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  if (f === "inox") s += rect(x, y, w, h, r, c.brushed());
  s += rect(x, y, w, h, r, c.gloss());
  return s;
}

function glassPanel(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  return (
    rect(x, y, w, h, r, c.glass(), `stroke="#000" stroke-opacity=".5"`) +
    path(`M${n(x + w * 0.08)} ${n(y)} L${n(x + w * 0.42)} ${n(y)} L${n(x + w * 0.16)} ${n(y + h)} L${n(x)} ${n(y + h)} L${n(x)} ${n(y + h * 0.35)} Z`, "#ffffff", `opacity=".07"`)
  );
}

// ───────── Refrigeração

function fridgeDuplex(c: Ctx, f: Finish): Drawing {
  const W = 300;
  let s = bodyBox(c, f, 0, 0, W, 848, 16);
  s += rect(2, 252, W - 4, 4, 0, "#000", `opacity=".3"`) + rect(2, 256, W - 4, 1.5, 0, "#fff", `opacity=".55"`);
  s += handleV(c, 20, 140, 96) + handleV(c, 20, 278, 230);
  s += displayPanel(c, 210, 290, 66, 32);
  s += rect(W / 2 - 22, 26, 44, 5, 2.5, c.soft(f), `opacity=".8"`);
  s += rect(8, 818, W - 16, 26, 6, "#17181b") + vents(18, 825, W - 36, 3, 6, "#ffffff", 0.12, 1.5);
  s += feet([16, W - 42], 846);
  return { w: W, h: 858, svg: s, depth: 290, boxH: 848, altLabel: "vista em perspectiva" };
}

function fridgeInverse(c: Ctx, f: Finish): Drawing {
  const W = 320;
  let s = bodyBox(c, f, 0, 0, W, 868, 16);
  s += rect(2, 560, W - 4, 4, 0, "#000", `opacity=".3"`) + rect(2, 564, W - 4, 1.5, 0, "#fff", `opacity=".55"`);
  s += handleV(c, 22, 300, 240);
  s += handleH(c, 60, 590, W - 120, 11);
  s += displayPanel(c, 44, 70, 78, 38, 2);
  s += rect(W / 2 - 24, 30, 48, 5, 2.5, c.soft(f), `opacity=".8"`);
  s += rect(8, 838, W - 16, 26, 6, "#17181b") + vents(18, 845, W - 36, 3, 6, "#ffffff", 0.12, 1.5);
  s += feet([16, W - 42], 866);
  return { w: W, h: 878, svg: s, depth: 300, boxH: 868, altLabel: "vista em perspectiva" };
}

function fridgeSide(c: Ctx, f: Finish): Drawing {
  const W = 470;
  let s = bodyBox(c, f, 0, 0, W, 868, 16);
  s += rect(W / 2 - 2, 2, 4, 836, 0, "#000", `opacity=".32"`) + rect(W / 2 + 2, 2, 1.5, 836, 0, "#fff", `opacity=".5"`);
  s += handleV(c, W / 2 - 30, 170, 520, 11) + handleV(c, W / 2 + 19, 170, 520, 11);
  // dispensador de água e gelo na porta esquerda
  s += rect(56, 200, 120, 190, 14, "#1b1d21", `stroke="#000" stroke-opacity=".4"`);
  s += rect(64, 248, 104, 132, 10, c.lin("disp", [[0, "#0b0c0e"], [1, "#2a2d33"]], 0, 0, 0, 1));
  s += rect(100, 256, 32, 54, 6, "#3a3d43") + rect(84, 362, 64, 10, 4, "#4a4e55");
  s += displayPanel(c, 66, 210, 100, 30, 2);
  s += rect(W / 2 - 26, 30, 52, 5, 2.5, c.soft(f), `opacity=".8"`);
  s += rect(8, 838, W - 16, 26, 6, "#17181b") + vents(18, 845, W - 36, 3, 6, "#ffffff", 0.12, 1.5);
  s += feet([18, W - 44], 866);
  return { w: W, h: 878, svg: s, depth: 330, boxH: 868, altLabel: "vista em perspectiva" };
}

function fridgeOneDoor(c: Ctx, f: Finish): Drawing {
  const W = 290;
  let s = bodyBox(c, f, 0, 0, W, 750, 16);
  s += rect(W - 30, 90, 12, 150, 6, c.lin("recess", [[0, "#000", 0.25], [1, "#000", 0.05]]));
  s += rect(W - 28, 96, 8, 138, 4, c.chrome(), `opacity=".9"`);
  s += rect(W / 2 - 20, 26, 40, 5, 2.5, c.soft(f), `opacity=".8"`);
  s += led(c, W - 24, 30, 3);
  s += rect(8, 720, W - 16, 26, 6, "#17181b") + vents(18, 727, W - 36, 3, 6, "#ffffff", 0.12, 1.5);
  s += feet([16, W - 42], 748);
  return { w: W, h: 760, svg: s, depth: 270, boxH: 750, altLabel: "vista em perspectiva" };
}

function freezer(c: Ctx, f: Finish): Drawing {
  const W = 290;
  let s = bodyBox(c, f, 0, 0, W, 790, 16);
  s += rect(14, 14, W - 28, 64, 10, c.isDark(f) ? "#000" : "#e9eaec", `opacity=".55"`);
  s += displayPanel(c, 30, 26, 74, 40, 2);
  s += rect(2, 84, W - 4, 3, 0, "#000", `opacity=".28"`);
  s += handleV(c, 20, 140, 260);
  s += vents(40, 700, W - 80, 4, 9, "#000", 0.22, 2.5);
  s += rect(8, 760, W - 16, 26, 6, "#17181b") + vents(18, 767, W - 36, 3, 6, "#ffffff", 0.12, 1.5);
  s += feet([16, W - 42], 788);
  return { w: W, h: 798, svg: s, depth: 280, boxH: 790, altLabel: "vista em perspectiva" };
}

// ───────── Fogões e cooktops

function burner(c: Ctx, cx: number, cy: number, rx: number, big = false) {
  const ry = rx * 0.32;
  let s = ellipse(cx, cy + 3, rx * 1.05, ry * 1.1, "#000", `opacity=".35"`);
  s += ellipse(cx, cy, rx, ry, "#1b1c1f", `stroke="#5c6168" stroke-width="2"`);
  s += ellipse(cx, cy - 2, rx * 0.62, ry * 0.62, c.lin("cap", [[0, "#6a6f76"], [1, "#25272b"]], 0, 0, 0, 1));
  if (big) s += ellipse(cx, cy - 3, rx * 0.36, ry * 0.36, "#141517", `stroke="#7b8087" stroke-width="1.5"`);
  // grade
  s += line(cx - rx * 1.08, cy, cx + rx * 1.08, cy, "#2f3134", 5);
  s += line(cx, cy - ry * 1.2, cx, cy + ry * 1.2, "#2f3134", 5);
  return s;
}

function stove(c: Ctx, f: Finish, burners: 4 | 5): Drawing {
  const W = 420;
  let s = "";
  // tampa de vidro levantada
  s += rect(14, 0, W - 28, 120, 10, c.lin("lid", [[0, "#2a2e34", 0.92], [1, "#0f1012", 0.95]], 0, 0, 0, 1), `stroke="#000" stroke-opacity=".5"`);
  s += path(`M60 0 L170 0 L110 120 L20 120 Z`, "#ffffff", `opacity=".08"`);
  // mesa
  const glassTop = burners === 5;
  s += path(`M14 118 L406 118 L420 200 L0 200 Z`, glassTop ? c.lin("table", [[0, "#24272c"], [1, "#0e0f11"]], 0, 0, 0, 1) : c.top(f), `stroke="${c.edge(f)}" stroke-width="2" stroke-linejoin="round"`);
  if (glassTop) s += path(`M40 122 L130 122 L90 198 L8 198 Z`, "#ffffff", `opacity=".06"`);
  if (burners === 5) {
    s += burner(c, 105, 140, 42) + burner(c, 315, 140, 42) + burner(c, 210, 160, 56, true) + burner(c, 92, 182, 50) + burner(c, 328, 182, 50);
  } else {
    s += burner(c, 120, 142, 46) + burner(c, 300, 142, 46) + burner(c, 112, 180, 54, true) + burner(c, 308, 180, 54);
  }
  // corpo frontal
  s += bodyBox(c, f, 0, 200, W, 316, 6);
  s += rect(0, 200, W, 52, 4, c.isDark(f) ? "#0d0e10" : "#1b1c1f", `opacity=".92"`);
  const knobs = burners === 5 ? 6 : 5;
  for (let i = 0; i < knobs; i++) s += knob(c, 60 + i * ((W - 120) / (knobs - 1)), 226, 14, false);
  s += led(c, W - 22, 226, 3);
  // porta do forno
  s += rect(20, 262, W - 40, 206, 10, c.fin(f), `stroke="${c.edge(f)}" stroke-width="1.5"`);
  s += handleH(c, 54, 272, W - 108, 13);
  s += glassPanel(c, 48, 300, W - 96, 140, 8);
  s += rect(70, 420, W - 140, 3, 1.5, LED, `opacity=".35"`);
  s += rect(20, 478, W - 40, 34, 6, "#000", `opacity=".14"`) + rect(W / 2 - 40, 490, 80, 6, 3, "#000", `opacity=".25"`);
  s += feet([16, W - 42], 514, 26, 12);
  return { w: W, h: 526, svg: s, alt: () => stoveTop(c, f, burners), altLabel: "vista de cima da mesa" };
}

/** Mesa do fogão vista de cima: queimadores, trempes e acabamento. */
function stoveTop(c: Ctx, f: Finish, burners: 4 | 5): Drawing {
  const W = 560;
  const H = 520;
  const glassTop = burners === 5;
  const surface = glassTop ? c.lin("st-glass", [[0, "#2c2f35"], [1, "#0c0d0e"]], 0, 0, 1, 1) : c.top(f);
  let s = rect(0, 0, W, H, 20, c.chrome(), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += rect(10, 10, W - 20, H - 20, 14, surface);
  if (!glassTop && f === "inox") s += rect(10, 10, W - 20, H - 20, 14, c.brushed());
  s += path(`M40 10 L230 10 L70 ${H - 10} L10 ${H - 10} L10 70 Z`, "#ffffff", `opacity="${glassTop ? 0.05 : 0.12}"`);
  const grate = "#26272a";
  const b = (cx: number, cy: number, r: number) =>
    circle(cx + 4, cy + 6, r * 1.02, "#000", `opacity=".18"`) +
    circle(cx, cy, r * 0.62, "#1b1c1f", `stroke="#5c6168" stroke-width="2"`) +
    circle(cx, cy, r * 0.42, c.rad("st-cap", [[0, "#7a7f86"], [1, "#24262a"]], 0.4, 0.35, 0.7), `stroke="#111" stroke-width="2"`) +
    circle(cx, cy, r, "none", `stroke="${grate}" stroke-width="10"`) +
    line(cx - r * 1.12, cy, cx + r * 1.12, cy, grate, 10) +
    line(cx, cy - r * 1.12, cx, cy + r * 1.12, grate, 10);
  if (burners === 5) {
    s += b(135, 125, 58) + b(425, 125, 58) + b(280, 260, 82) + b(135, 395, 66) + b(425, 395, 66);
  } else {
    s += b(150, 150, 70) + b(410, 150, 62) + b(150, 370, 80) + b(410, 370, 74);
  }
  s += led(c, W - 34, H - 30, 4);
  return { w: W, h: H, svg: s };
}

function cooktopSlab(c: Ctx, top: string, W: number, H: number) {
  let s = path(`M58 0 L${W - 58} 0 L${W} ${H} L0 ${H} Z`, top, `stroke="#000" stroke-width="2" stroke-linejoin="round"`);
  s += path(`M90 4 L230 4 L150 ${H - 4} L8 ${H - 4} Z`, "#ffffff", `opacity=".06"`);
  s += rect(0, H, W, 18, 3, c.lin("slab-edge", [[0, "#5d626a"], [0.5, "#c9ccd1"], [1, "#4d5157"]]));
  return s;
}

function cooktopInduction(c: Ctx): Drawing {
  const W = 580;
  const H = 250;
  const black = c.lin("ind-top", [[0, "#2a2d33"], [1, "#0b0c0d"]], 0, 0, 0, 1);
  let s = cooktopSlab(c, black, W, H);
  const zone = (cx: number, cy: number, rx: number) =>
    ellipse(cx, cy, rx, rx * 0.34, "none", `stroke="#8d939b" stroke-opacity=".7" stroke-width="2"`) +
    ellipse(cx, cy, rx * 0.72, rx * 0.72 * 0.34, "none", `stroke="#8d939b" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="6 6"`);
  s += zone(178, 62, 70) + zone(398, 62, 62) + zone(160, 150, 92) + zone(420, 150, 84);
  s += line(200, 222, 380, 222, "#5d636b", 3);
  for (let i = 0; i < 5; i++) s += circle(206 + i * 42, 222, 4, "#c9ced6", `opacity=".8"`);
  s += led(c, 290, 222, 4);
  return { w: W, h: H + 18, svg: s, alt: () => cooktopTop(c, false), altLabel: "vista de cima" };
}

function gasGrate(cx: number, cy: number, rx: number, ry: number) {
  return (
    ellipse(cx, cy, rx, ry, "none", `stroke="#2b2c2f" stroke-width="7"`) +
    line(cx - rx * 1.15, cy, cx + rx * 1.15, cy, "#2b2c2f", 7) +
    line(cx, cy - ry * 1.3, cx, cy + ry * 1.3, "#2b2c2f", 7)
  );
}

function cooktopGas(c: Ctx): Drawing {
  const W = 580;
  const H = 250;
  const black = c.lin("gas-top", [[0, "#2a2d33"], [1, "#0b0c0d"]], 0, 0, 0, 1);
  let s = cooktopSlab(c, black, W, H);
  const b = (cx: number, cy: number, rx: number) =>
    ellipse(cx, cy, rx * 0.62, rx * 0.2, c.lin("cap", [[0, "#6a6f76"], [1, "#25272b"]], 0, 0, 0, 1), `stroke="#1a1b1d" stroke-width="2"`) +
    gasGrate(cx, cy, rx, rx * 0.32);
  s += b(150, 52, 54) + b(430, 52, 54) + b(290, 104, 74) + b(132, 158, 62) + b(448, 158, 62);
  for (let i = 0; i < 5; i++) s += ellipse(186 + i * 52, 222, 16, 7, "#c9cdd2", `stroke="#5d626a" stroke-width="1.5"`);
  s += led(c, 470, 222, 3);
  return { w: W, h: H + 18, svg: s, alt: () => cooktopTop(c, true), altLabel: "vista de cima" };
}

function cooktopTop(c: Ctx, gas: boolean): Drawing {
  const W = 580;
  const H = 520;
  let s = rect(0, 0, W, H, 22, c.lin("ct-top", [[0, "#2c2f35"], [1, "#0c0d0e"]], 0, 0, 1, 1), `stroke="#000" stroke-width="2"`);
  s += path(`M40 0 L240 0 L60 ${H} L0 ${H} L0 60 Z`, "#ffffff", `opacity=".05"`);
  if (gas) {
    const b = (cx: number, cy: number, r: number) =>
      circle(cx, cy, r * 0.55, c.rad("gcap", [[0, "#7a7f86"], [1, "#24262a"]], 0.4, 0.35, 0.7), `stroke="#111" stroke-width="2"`) +
      circle(cx, cy, r, "none", `stroke="#2a2b2e" stroke-width="10"`) +
      line(cx - r * 1.12, cy, cx + r * 1.12, cy, "#2a2b2e", 10) +
      line(cx, cy - r * 1.12, cx, cy + r * 1.12, "#2a2b2e", 10);
    s += b(130, 120, 62) + b(450, 120, 62) + b(290, 250, 82) + b(130, 380, 70) + b(450, 380, 70);
    for (let i = 0; i < 5; i++) s += circle(170 + i * 60, 480, 15, "#c9cdd2", `stroke="#5d626a" stroke-width="1.5"`);
  } else {
    const z = (cx: number, cy: number, r: number) =>
      circle(cx, cy, r, "none", `stroke="#8d939b" stroke-opacity=".7" stroke-width="3"`) +
      circle(cx, cy, r * 0.7, "none", `stroke="#8d939b" stroke-opacity=".35" stroke-width="2" stroke-dasharray="8 8"`);
    s += z(160, 140, 96) + z(420, 140, 84) + z(160, 340, 110) + z(420, 340, 100);
    s += line(170, 476, 410, 476, "#5d636b", 4);
    for (let i = 0; i < 5; i++) s += circle(178 + i * 56, 476, 5, "#c9ced6", `opacity=".8"`);
    s += led(c, 290, 476, 5);
  }
  return { w: W, h: H, svg: s };
}

// ───────── Micro-ondas e fornos

function microwave(c: Ctx, f: Finish): Drawing {
  const W = 520;
  const H = 300;
  let s = bodyBox(c, f, 0, 0, W, H, 18);
  s += rect(14, 14, 364, 272, 12, c.isDark(f) ? "#0b0c0e" : "#1d1f23");
  const mesh = c.pattern("mesh", 8, 8, `<circle cx="4" cy="4" r="1.3" fill="#000" opacity=".55"/>`);
  s += rect(40, 40, 300, 220, 10, c.lin("mw-in", [[0, "#3a3f46"], [1, "#16181b"]], 0, 0, 1, 1));
  s += ellipse(190, 228, 120, 18, "#ffffff", `opacity=".06"`);
  s += rect(40, 40, 300, 220, 10, mesh);
  s += path(`M60 40 L170 40 L90 260 L40 260 L40 120 Z`, "#ffffff", `opacity=".07"`);
  s += rect(364, 30, 10, 240, 5, c.chrome());
  s += displayPanel(c, 396, 30, 104, 42, 3);
  const btn = c.isDark(f) ? "#2a2c31" : "#d9dce0";
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) s += rect(398 + k * 34, 92 + r * 26, 28, 18, 5, btn, `stroke="#000" stroke-opacity=".12"`);
  s += knob(c, 448, 240, 26, c.isDark(f));
  s += feet([24, W - 50], H - 2, 26, 10);
  return { w: W, h: H + 8, svg: s, depth: 380, boxH: H, altLabel: "vista em perspectiva" };
}

function oven(c: Ctx, f: Finish): Drawing {
  const W = 580;
  const H = 360;
  let s = bodyBox(c, f, 0, 0, W, H, 20);
  s += rect(22, 30, 392, 304, 12, c.isDark(f) ? "#0a0b0c" : "#1d1f23");
  s += rect(44, 74, 348, 236, 8, c.lin("ov-in", [[0, "#2b2420"], [0.6, "#171312"], [1, "#0e0c0b"]], 0, 0, 0, 1));
  s += path(`M64 96 l24 14 l24 -14 l24 14 l24 -14 l24 14 l24 -14 l24 14 l24 -14 l24 14 l24 -14 l24 14 l24 -14`, "none", `stroke="${LED}" stroke-width="3" opacity=".75"`);
  s += rect(56, 190, 324, 4, 2, "#8a8f96", `opacity=".6"`) + rect(56, 262, 324, 4, 2, "#8a8f96", `opacity=".6"`);
  s += ellipse(218, 150, 170, 60, c.rad("ov-glow", [[0, LED, 0.18], [1, LED, 0]]));
  s += path(`M64 74 L170 74 L100 310 L44 310 L44 160 Z`, "#ffffff", `opacity=".06"`);
  s += handleH(c, 60, 46, 316, 14);
  for (let i = 0; i < 3; i++) s += knob(c, 496, 82 + i * 92, 30, c.isDark(f));
  s += led(c, 548, 40, 3.5);
  s += feet([30, W - 56], H - 2, 26, 10);
  return { w: W, h: H + 8, svg: s, depth: 380, boxH: H, altLabel: "vista em perspectiva" };
}

// ───────── Lavanderia e lava-louças

function washerFront(c: Ctx, f: Finish, dryer: boolean): Drawing {
  const W = 330;
  const H = 440;
  let s = bodyBox(c, f, 0, 0, W, H, 16);
  s += rect(2, 74, W - 4, 2.5, 0, "#000", `opacity=".22"`);
  s += rect(16, 18, 92, 40, 6, "#000", `opacity=".08"`) + rect(22, 46, 80, 4, 2, "#000", `opacity=".25"`);
  s += displayPanel(c, 150, 20, 92, 36, 3);
  s += knob(c, 286, 38, 23, c.isDark(f));
  const cx = W / 2;
  const cy = 252;
  s += circle(cx + 4, cy + 6, 126, "#000", `opacity=".1"`);
  s += circle(cx, cy, 124, c.lin("ring", [[0, "#f4f5f7"], [0.5, "#a9aeb5"], [1, "#e3e5e8"]], 0, 0, 1, 1), `stroke="#7d838a" stroke-width="2"`);
  s += circle(cx, cy, 104, dryer ? "#3b3f45" : "#22252a");
  s += circle(cx, cy, 92, c.rad(dryer ? "door-d" : "door-w", dryer ? [[0, "#5d636b"], [1, "#2a2d32"]] : [[0, "#46607a"], [0.7, "#1b2633"], [1, "#0f141b"]], 0.42, 0.4, 0.6));
  if (!dryer) {
    let holes = "";
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      holes += circle(cx + Math.cos(a) * 66, cy + Math.sin(a) * 66, 2.2, "#c9d6e3", `opacity=".28"`);
    }
    s += holes + circle(cx, cy, 44, "none", `stroke="#c9d6e3" stroke-opacity=".18" stroke-width="2"`);
  }
  s += path(`M${cx - 70} ${cy - 40} A 82 82 0 0 1 ${cx + 20} ${cy - 84}`, "none", `stroke="#ffffff" stroke-opacity=".35" stroke-width="7" stroke-linecap="round"`);
  s += rect(cx + 104, cy - 22, 16, 44, 6, c.chrome(), `stroke="#7d838a"`);
  s += rect(12, H - 34, W - 24, 24, 6, "#000", `opacity=".12"`);
  s += feet([18, W - 44], H - 2, 26, 10);
  return { w: W, h: H + 8, svg: s, depth: 330, boxH: H, altLabel: "vista em perspectiva" };
}

function washerTop(c: Ctx, f: Finish): Drawing {
  const W = 340;
  let s = "";
  // painel traseiro
  s += rect(0, 0, W, 96, 16, c.finV(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += rect(70, 18, 200, 52, 12, "#0d0e10") + digits(150, 30, 26, 2) + led(c, 248, 44, 3.5);
  s += knob(c, 40, 46, 20, c.isDark(f));
  for (let i = 0; i < 3; i++) s += circle(90 + i * 22, 44, 5, "#c9ced6", `opacity=".7"`);
  s += knob(c, 302, 46, 20, c.isDark(f));
  // tampa de vidro em perspectiva
  s += path(`M10 96 L${W - 10} 96 L${W} 168 L0 168 Z`, c.top(f), `stroke="${c.edge(f)}" stroke-width="2" stroke-linejoin="round"`);
  s += path(`M44 104 L${W - 44} 104 L${W - 30} 160 L30 160 Z`, c.lin("lid-g", [[0, "#2a3440", 0.85], [1, "#11161c", 0.92]], 0, 0, 0, 1));
  s += ellipse(W / 2, 134, 110, 16, "none", `stroke="#9fb3c8" stroke-opacity=".35" stroke-width="2"`);
  s += path(`M70 106 L150 106 L120 158 L44 158 Z`, "#ffffff", `opacity=".08"`);
  // corpo
  s += bodyBox(c, f, 0, 168, W, 392, 10);
  s += rect(0, 168, W, 10, 0, "#000", `opacity=".1"`);
  s += rect(12, 526, W - 24, 26, 6, "#000", `opacity=".12"`);
  s += feet([18, W - 44], 558, 26, 10);
  return { w: W, h: 570, svg: s, detail: [-40, -30, 420, 420], altLabel: "detalhe do painel e da tampa de vidro" };
}

function dishwasher(c: Ctx, f: Finish): Drawing {
  const W = 300;
  const H = 440;
  let s = bodyBox(c, f, 0, 0, W, H, 14);
  s += rect(0, 0, W, 58, 12, c.isDark(f) ? "#08090a" : "#1c1d21", `opacity=".9"`);
  s += digits(26, 18, 22, 2) + led(c, 92, 29, 3.5);
  for (let i = 0; i < 5; i++) s += circle(130 + i * 30, 29, 6, "#c9ced6", `opacity=".75"`);
  s += handleH(c, 40, 76, W - 80, 12);
  s += rect(14, 100, W - 28, 280, 10, c.sheen(), `opacity=".7"`);
  s += rect(0, H - 50, W, 50, 10, "#16171a") + vents(20, H - 38, W - 40, 3, 9, "#ffffff", 0.12, 2);
  return { w: W, h: H, svg: s, depth: 320, boxH: H, altLabel: "vista em perspectiva" };
}

// ───────── Climatização

function acIndoor(c: Ctx): Drawing {
  const W = 660;
  const H = 190;
  let s = rect(4, 8, W, H, 46, "#000", `opacity=".08"`);
  s += rect(0, 0, W, H, 46, c.lin("ac-body", [[0, "#ffffff"], [0.55, "#f1f2f4"], [1, "#d9dbdf"]], 0, 0, 0, 1), `stroke="#c3c6cb" stroke-width="2"`);
  s += vents(70, 22, W - 140, 3, 8, "#000", 0.1, 2);
  s += rect(0, 0, 24, H, 12, "#000", `opacity=".04"`) + rect(W - 24, 0, 24, H, 12, "#000", `opacity=".06"`);
  s += rect(60, 140, W - 120, 30, 15, "#1b1c1f");
  s += rect(72, 152, W - 144, 12, 6, c.lin("louver", [[0, "#f5f6f7"], [1, "#c9ccd1"]], 0, 0, 0, 1));
  s += digits(470, 72, 30, 2, "#9aa3ad") + led(c, 548, 87, 3.5);
  return { w: W + 4, h: H + 8, svg: s, alt: () => acPair(c), altLabel: "unidade interna e condensadora" };
}

function acOutdoor(c: Ctx): string {
  const W = 440;
  const H = 340;
  let s = rect(0, 0, W, H, 16, c.lin("cond", [[0, "#f6f6f7"], [1, "#d7d9dd"]], 0, 0, 0, 1), `stroke="#bfc3c8" stroke-width="2"`);
  const cx = 170;
  const cy = 170;
  s += circle(cx, cy, 128, "#2a2c30");
  for (let r = 40; r <= 124; r += 14) s += circle(cx, cy, r, "none", `stroke="#d9dbdf" stroke-width="2.4" opacity=".85"`);
  s += line(cx - 126, cy, cx + 126, cy, "#d9dbdf", 3) + line(cx, cy - 126, cx, cy + 126, "#d9dbdf", 3);
  s += circle(cx, cy, 22, "#e9eaec", `stroke="#9aa0a6"`);
  s += vents(330, 40, 84, 22, 12, "#000", 0.18, 3);
  s += rect(20, H, 70, 16, 4, "#1c1d20") + rect(W - 90, H, 70, 16, 4, "#1c1d20");
  return s;
}

function acPair(c: Ctx): Drawing {
  const indoor = acIndoor(c);
  const s = `<g transform="translate(0 0)">${indoor.svg}</g><g transform="translate(260 300)">${acOutdoor(c)}</g>`;
  return { w: 700, h: 660, svg: s };
}

function fanColumn(c: Ctx, f: Finish): Drawing {
  const W = 440;
  const dark = c.isDark(f);
  const grille = dark ? "#26282c" : "#cfd2d6";
  const cx = 220;
  const cy = 215;
  let s = "";
  // base e haste
  s += ellipse(cx, 1078, 176, 34, "#000", `opacity=".12"`);
  s += ellipse(cx, 1064, 170, 34, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += ellipse(cx, 1056, 150, 26, c.top(f), `opacity=".9"`);
  s += rect(cx - 14, 400, 28, 650, 10, c.fin(f), `stroke="${c.edge(f)}" stroke-width="1.5"`);
  s += rect(cx - 30, 760, 60, 120, 14, c.fin(f), `stroke="${c.edge(f)}" stroke-width="1.5"`);
  for (let i = 0; i < 3; i++) s += circle(cx, 788 + i * 30, 7, i === 0 ? LED : "#c9ced6", i === 0 ? "" : `opacity=".8"`);
  s += circle(cx, 788, 18, c.ledGlow());
  // motor
  s += rect(cx - 52, 300, 104, 120, 40, c.fin(f), `stroke="${c.edge(f)}" stroke-width="1.5"`);
  // hélices atrás da grade
  let blades = "";
  for (let i = 0; i < 6; i++) {
    blades += path(`M${cx} ${cy} C ${cx + 40} ${cy - 40}, ${cx + 150} ${cy - 70}, ${cx + 160} ${cy - 8} C ${cx + 150} ${cy + 30}, ${cx + 60} ${cy + 28}, ${cx} ${cy} Z`, dark ? "#5b6068" : "#aeb4bb", `opacity=".55" transform="rotate(${i * 60} ${cx} ${cy})"`);
  }
  s += circle(cx, cy, 204, dark ? "#0f1012" : "#f0f1f3", `opacity="${dark ? 0.92 : 0.65}"`);
  s += blades;
  // grade
  for (const r of [56, 92, 128, 164, 200]) s += circle(cx, cy, r, "none", `stroke="${grille}" stroke-width="${r === 200 ? 7 : 3}"`);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    s += line(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40, cx + Math.cos(a) * 200, cy + Math.sin(a) * 200, grille, 1.6);
  }
  s += circle(cx, cy, 40, c.rad("hub", [[0, "#ffffff"], [0.7, "#c5c9ce"], [1, "#868c93"]], 0.4, 0.35, 0.7), `stroke="#6e747b" stroke-width="1.5"`);
  s += circle(cx, cy, 5, LED);
  return { w: W, h: 1112, svg: s, detail: [-30, -30, 500, 500], altLabel: "detalhe da grade e das 6 pás" };
}

function heaterOil(c: Ctx, f: Finish): Drawing {
  const W = 600;
  let s = "";
  const finFill = c.lin("oilfin", [[0, "#cfd2d6"], [0.35, "#ffffff"], [0.7, "#e3e5e8"], [1, "#b9bdc2"]]);
  s += rect(70, 0, 300, 44, 22, "none", `stroke="${c.edge(f)}" stroke-width="12"`);
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 50;
    s += rect(x, 40, 44, 430, 22, finFill, `stroke="#b3b7bc" stroke-width="1.5"`);
    s += rect(x + 10, 60, 6, 390, 3, "#ffffff", `opacity=".6"`);
  }
  s += rect(14, 120, 452, 12, 6, "#000", `opacity=".06"`) + rect(14, 390, 452, 12, 6, "#000", `opacity=".06"`);
  // caixa de comando
  s += rect(472, 150, 110, 230, 16, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += knob(c, 527, 210, 26) + knob(c, 527, 290, 22);
  s += rect(507, 336, 40, 20, 6, "#1b1c1f") + led(c, 527, 346, 4);
  // rodas
  s += rect(30, 470, 420, 16, 8, "#2a2c30");
  for (const x of [60, 200, 280, 420]) s += circle(x, 500, 18, "#17181b") + circle(x, 500, 7, "#5a5e64");
  return { w: W, h: 520, svg: s, detail: [250, 40, 380, 380], altLabel: "detalhe do termostato" };
}

function heaterFan(c: Ctx, f: Finish): Drawing {
  const W = 300;
  let s = rect(110, 0, 80, 46, 20, "none", `stroke="${c.edge(f)}" stroke-width="12"`);
  s += bodyBox(c, f, 0, 36, W, 320, 44);
  s += rect(32, 84, W - 64, 190, 20, "#141518");
  s += rect(32, 84, W - 64, 190, 20, c.rad("hf-glow", [[0, LED, 0.45], [1, LED, 0]], 0.5, 0.55, 0.6));
  for (let i = 0; i < 11; i++) s += line(46, 100 + i * 16, W - 46, 100 + i * 16, "#d9dbde", 3, `opacity=".55"`);
  s += knob(c, 92, 312, 20, c.isDark(f)) + knob(c, 208, 312, 20, c.isDark(f));
  s += led(c, 150, 312, 4);
  return { w: W, h: 360, svg: s, depth: 200, boxH: 356, altLabel: "vista em perspectiva" };
}

// ───────── Eletroportáteis

function airfryer(c: Ctx, f: Finish): Drawing {
  const W = 360;
  const H = 430;
  let s = path(`M60 0 H300 Q352 0 356 60 L360 380 Q360 430 310 430 H50 Q0 430 0 380 L4 60 Q8 0 60 0 Z`, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += path(`M60 0 H300 Q352 0 356 60 L360 380 Q360 430 310 430 H50 Q0 430 0 380 L4 60 Q8 0 60 0 Z`, c.gloss());
  s += vents(110, 14, 140, 3, 7, "#000", 0.35, 2.5);
  s += rect(66, 44, 228, 120, 24, "#0b0c0e", `stroke="#000"`);
  s += rect(66, 44, 228, 52, 24, "#ffffff", `opacity=".05"`);
  s += digits(132, 70, 36, 3);
  for (let i = 0; i < 6; i++) s += circle(104 + i * 30, 138, 6, "#d6dbe3", `opacity="${i === 2 ? 1 : 0.55}"`);
  s += led(c, 270, 64, 4);
  // gaveta
  s += rect(14, 196, W - 28, 214, 40, c.isDark(f) ? "#0c0d0f" : "#000", `opacity="${c.isDark(f) ? 0.6 : 0.1}"`);
  s += rect(2, 190, W - 4, 3, 0, "#000", `opacity=".35"`);
  s += rect(118, 240, 124, 82, 22, c.lin("af-handle", [[0, "#3a3d43"], [1, "#0e0f11"]], 0, 0, 0, 1), `stroke="#000"`);
  s += rect(130, 248, 100, 16, 8, "#ffffff", `opacity=".12"`);
  s += feet([40, W - 70], H - 4, 30, 10);
  return { w: W, h: H + 6, svg: s, detail: [-50, -30, 460, 460], altLabel: "detalhe do painel digital" };
}

function airfryerOven(c: Ctx, f: Finish): Drawing {
  const W = 430;
  const H = 450;
  let s = bodyBox(c, f, 0, 0, W, H, 30);
  s += rect(28, 24, W - 56, 82, 16, "#0b0c0e");
  s += digits(70, 46, 36, 3) + led(c, W - 64, 65, 4);
  for (let i = 0; i < 4; i++) s += circle(220 + i * 32, 65, 7, "#d6dbe3", `opacity=".6"`);
  s += rect(28, 124, W - 56, 296, 18, "#0d0e10");
  s += rect(46, 160, W - 92, 240, 10, c.lin("afo-in", [[0, "#2a231f"], [1, "#0f0d0c"]], 0, 0, 0, 1));
  s += ellipse(W / 2, 250, 140, 70, c.rad("afo-glow", [[0, LED, 0.22], [1, LED, 0]]));
  s += line(60, 250, W - 60, 250, "#a1a6ad", 4) + rect(70, 310, W - 140, 4, 2, "#8a8f96") + rect(70, 360, W - 140, 4, 2, "#8a8f96");
  s += path(`M66 160 L170 160 L110 400 L46 400 L46 260 Z`, "#ffffff", `opacity=".06"`);
  s += handleH(c, 60, 134, W - 120, 13);
  s += feet([30, W - 60], H - 2, 30, 10);
  return { w: W, h: H + 8, svg: s, depth: 340, boxH: H, altLabel: "vista em perspectiva" };
}

function espresso(c: Ctx, f: Finish): Drawing {
  const W = 400;
  let s = "";
  s += bodyBox(c, f, 40, 0, 320, 410, 26);
  s += rect(60, 10, 280, 14, 7, "#000", `opacity=".14"`);
  // painel
  s += rect(70, 44, 260, 70, 16, "#0d0e10");
  s += circle(120, 79, 22, "none", `stroke="${LED}" stroke-width="3"`) + circle(120, 79, 26, c.ledGlow());
  s += circle(120, 79, 8, "#e9eef6") + circle(180, 79, 12, "#c9ced6", `opacity=".6"`) + circle(220, 79, 12, "#c9ced6", `opacity=".6"`);
  s += circle(286, 79, 26, "#f4f5f7", `stroke="#8a9097" stroke-width="3"`) + line(286, 79, 300, 66, "#c2410c", 2.5) + circle(286, 79, 3, "#333");
  // grupo e porta-filtro
  s += rect(150, 140, 100, 40, 10, c.chromeV(), `stroke="#7d838a"`);
  s += rect(140, 178, 120, 26, 10, c.chrome(), `stroke="#7d838a"`);
  s += path(`M150 190 L30 226 Q18 230 22 242 Q26 252 40 248 L160 210 Z`, "#151619");
  s += rect(186, 204, 10, 18, 3, "#6d737a") + rect(204, 204, 10, 18, 3, "#6d737a");
  // xícara
  s += path(`M166 268 H236 L230 318 Q228 330 214 330 H188 Q174 330 172 318 Z`, "#ffffff", `stroke="#cfd3d8" stroke-width="2"`);
  s += path(`M236 280 Q256 282 254 298 Q252 312 232 310`, "none", `stroke="#cfd3d8" stroke-width="6"`);
  s += ellipse(201, 270, 35, 6, "#5a3a24");
  // bandeja
  s += rect(80, 334, 240, 46, 10, c.chromeV(), `stroke="#7d838a"`);
  s += vents(96, 346, 208, 3, 10, "#000", 0.28, 3);
  // vaporizador
  s += path(`M332 150 L340 150 L366 330 L356 332 Z`, c.chrome(), `stroke="#7d838a"`);
  s += rect(326, 132, 22, 26, 6, "#16171a");
  return { w: W, h: 412, svg: s, detail: [10, 10, 400, 400], altLabel: "detalhe do porta-filtro e do painel" };
}

function coffeeDrip(c: Ctx, f: Finish): Drawing {
  const W = 320;
  let s = "";
  s += rect(200, 0, 120, 430, 26, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += rect(282, 70, 14, 230, 7, c.lin("water", [[0, "#9cc4e8", 0.6], [1, "#4d86bf", 0.8]], 0, 0, 0, 1), `stroke="#000" stroke-opacity=".2"`);
  s += rect(0, 0, 236, 66, 22, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += path(`M34 66 H200 L184 140 Q182 150 170 150 H62 Q50 150 48 140 Z`, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  // jarra
  s += path(`M58 176 H186 L196 330 Q198 372 156 374 H82 Q42 372 46 330 Z`, c.lin("carafe", [[0, "#ffffff", 0.35], [1, "#dfe7ef", 0.25]], 0, 0, 1, 0), `stroke="#9aa6b2" stroke-width="3"`);
  s += path(`M50 268 H192 L196 330 Q198 370 156 372 H82 Q44 370 47 330 Z`, c.lin("coffee", [[0, "#5b351f"], [1, "#2a160c"]], 0, 0, 0, 1), `opacity=".92"`);
  s += path(`M58 176 H186 L190 196 H54 Z`, "#151619");
  s += path(`M54 200 Q14 210 18 262 Q22 300 50 304`, "none", `stroke="#151619" stroke-width="14" stroke-linecap="round"`);
  s += path(`M70 190 L84 190 L70 360 L60 360 Z`, "#ffffff", `opacity=".35"`);
  s += rect(0, 372, 236, 58, 18, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += rect(80, 392, 70, 20, 8, "#1b1c1f") + led(c, 132, 402, 4);
  return { w: W, h: 430, svg: s, detail: [-30, 100, 340, 340], altLabel: "detalhe da jarra de vidro" };
}

function blender(c: Ctx, f: Finish): Drawing {
  const W = 300;
  let s = "";
  // jarra
  s += path(`M44 50 H256 L216 384 H84 Z`, c.lin("jar", [[0, "#ffffff", 0.55], [0.5, "#e8eef4", 0.3], [1, "#ffffff", 0.5]]), `stroke="#9fb0c0" stroke-width="3" stroke-linejoin="round"`);
  s += path(`M256 90 Q300 96 296 170 Q292 250 238 262`, "none", `stroke="${c.isDark(f) ? "#1b1c1f" : "#c9ccd1"}" stroke-width="16" stroke-linecap="round"`);
  for (let i = 0; i < 6; i++) s += line(90 + i * 4, 120 + i * 40, 120 + i * 4, 120 + i * 40, "#7b8a99", 2.5);
  s += path(`M70 66 L96 66 L104 370 L92 370 Z`, "#ffffff", `opacity=".6"`);
  s += path(`M120 360 L150 336 L180 360 L150 350 Z`, "#9aa0a7");
  s += rect(32, 18, 236, 46, 14, c.isDark(f) ? "#151619" : c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += rect(126, 0, 48, 24, 8, c.isDark(f) ? "#151619" : c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  // base
  s += path(`M70 384 H230 L258 560 H42 Z`, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2" stroke-linejoin="round"`);
  s += path(`M70 384 H230 L258 560 H42 Z`, c.gloss());
  s += circle(150, 468, 40, "#0d0e10") + knob(c, 150, 468, 30, false);
  s += circle(150, 468, 44, "none", `stroke="${LED}" stroke-width="2.5" stroke-dasharray="4 7" opacity=".9"`);
  s += rect(84, 524, 30, 14, 6, "#c9ced6", `opacity=".7"`) + rect(186, 524, 30, 14, 6, "#c9ced6", `opacity=".7"`);
  return { w: W, h: 562, svg: s, detail: [-60, 220, 420, 420], altLabel: "detalhe do seletor de velocidades" };
}

function mixer(c: Ctx, f: Finish): Drawing {
  const W = 430;
  let s = "";
  // copo medidor
  s += path(`M236 330 H400 L388 610 Q386 630 366 630 H270 Q250 630 248 610 Z`, c.lin("beaker", [[0, "#ffffff", 0.55], [1, "#e6edf3", 0.35]]), `stroke="#a9b6c3" stroke-width="3"`);
  for (let i = 0; i < 5; i++) s += line(258, 380 + i * 46, 286, 380 + i * 46, "#8796a5", 2.5);
  s += path(`M256 340 L276 340 L268 620 L258 620 Z`, "#ffffff", `opacity=".6"`);
  // mixer
  s += rect(70, 0, 110, 270, 50, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += rect(70, 0, 110, 270, 50, c.gloss());
  s += rect(100, 60, 50, 110, 25, "#0e0f11");
  s += circle(125, 90, 12, "#d6dbe3", `opacity=".8"`) + circle(125, 140, 12, "#d6dbe3", `opacity=".8"`);
  s += led(c, 125, 196, 4);
  s += rect(98, 262, 54, 30, 10, "#17181b");
  s += rect(106, 290, 38, 300, 12, c.chrome(), `stroke="#7d838a"`);
  s += path(`M70 640 Q70 588 125 584 Q180 588 180 640 Z`, c.chromeV(), `stroke="#7d838a" stroke-width="2"`);
  s += rect(72, 632, 106, 12, 6, "#6d737a");
  return { w: W, h: 646, svg: s, detail: [-20, -30, 460, 460], altLabel: "detalhe dos botões de velocidade" };
}

function standMixer(c: Ctx, f: Finish): Drawing {
  const W = 540;
  let s = "";
  s += rect(40, 400, 430, 52, 24, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += path(`M330 120 Q330 92 360 92 H420 Q450 92 450 122 L470 420 H320 Z`, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  // tigela inox
  s += path(`M90 250 H350 Q348 340 300 382 Q280 400 220 400 Q160 400 140 382 Q92 340 90 250 Z`, c.lin("bowl", [[0, "#9aa0a7"], [0.35, "#f4f5f7"], [0.6, "#c4c8cd"], [1, "#8a9097"]]), `stroke="#7d838a" stroke-width="2"`);
  s += ellipse(220, 250, 130, 18, c.lin("bowl-rim", [[0, "#ffffff"], [1, "#b3b8be"]], 0, 0, 0, 1), `stroke="#7d838a" stroke-width="2"`);
  s += rect(140, 396, 160, 14, 6, "#6d737a");
  // batedor
  s += rect(212, 180, 16, 80, 6, c.chrome());
  s += path(`M196 250 Q220 236 244 250 L238 330 Q220 346 202 330 Z`, "none", `stroke="#c9cdd2" stroke-width="8"`);
  // cabeça
  s += path(`M60 120 Q60 30 160 26 H420 Q492 26 496 96 Q500 168 430 176 H150 Q70 176 60 120 Z`, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += path(`M60 120 Q60 30 160 26 H420 Q492 26 496 96 Q500 168 430 176 H150 Q70 176 60 120 Z`, c.gloss());
  s += rect(150, 168, 140, 16, 8, "#000", `opacity=".2"`);
  s += circle(470, 100, 24, c.chrome(), `stroke="#7d838a"`);
  s += rect(380, 120, 60, 14, 7, c.chrome()) + led(c, 400, 70, 4);
  s += rect(84, 60, 4, 70, 2, "#ffffff", `opacity=".35"`);
  return { w: W, h: 454, svg: s, detail: [20, 70, 420, 420], altLabel: "detalhe da tigela de inox" };
}

// ───────── TV, áudio e limpeza

function tv(c: Ctx, size: "55" | "43" = "55"): Drawing {
  const W = size === "55" ? 920 : 780;
  const H = Math.round(W * 0.57);
  let s = rect(0, 0, W, H, 10, "#0a0a0b", `stroke="#2a2c30" stroke-width="2"`);
  s += rect(8, 8, W - 16, H - 16, 4, c.lin("wall", [[0, "#0b1022"], [0.55, "#171032"], [1, "#2a0f12"]], 0, 0, 1, 1));
  // brilhos preenchendo só a tela (o gradiente acompanha o retângulo)
  s += rect(8, 8, W - 16, H - 16, 4, c.rad("tvglow", [[0, LED, 0.75], [0.45, "#ff7a2f", 0.28], [1, LED, 0]], 0.72, 0.72, 0.5));
  s += rect(8, 8, W - 16, H - 16, 4, c.rad("tvglow2", [[0, "#3b5bff", 0.45], [1, "#3b5bff", 0]], 0.25, 0.25, 0.36));
  s += path(`M8 ${H * 0.62} C ${W * 0.3} ${H * 0.42}, ${W * 0.55} ${H * 0.9}, ${W - 8} ${H * 0.48}`, "none", `stroke="#ffffff" stroke-opacity=".22" stroke-width="3"`);
  s += path(`M8 ${H * 0.7} C ${W * 0.35} ${H * 0.52}, ${W * 0.6} ${H * 0.98}, ${W - 8} ${H * 0.58}`, "none", `stroke="${LED}" stroke-opacity=".5" stroke-width="2"`);
  s += path(`M${W * 0.08} 8 L${W * 0.38} 8 L${W * 0.16} ${H - 8} L8 ${H - 8} L8 ${H * 0.4} Z`, "#ffffff", `opacity=".05"`);
  s += rect(W / 2 - 18, H - 7, 36, 4, 2, "#3a3d42");
  const footY = H;
  s += path(`M${W * 0.16} ${footY} L${W * 0.12} ${footY + 46} L${W * 0.14} ${footY + 46} L${W * 0.19} ${footY}`, "#1c1d20");
  s += path(`M${W * 0.84} ${footY} L${W * 0.88} ${footY + 46} L${W * 0.86} ${footY + 46} L${W * 0.81} ${footY}`, "#1c1d20");
  return { w: W, h: H + 48, svg: s, alt: () => tvAngled(c, W, H), altLabel: "vista em ângulo" };
}

/** TV girada (a borda direita mais distante fica menor). */
function tvAngled(c: Ctx, W0: number, H: number): Drawing {
  const W = Math.round(W0 * 0.8);
  const k = H * 0.07;
  const q = (pts: number[][]) => `M${pts.map((p) => `${n(p[0])} ${n(p[1])}`).join(" L")} Z`;
  let s = path(q([[W, k], [W + 14, k + 4], [W + 14, H - k - 4], [W, H - k]]), "#2a2c30");
  s += path(q([[0, 0], [W, k], [W, H - k], [0, H]]), "#0a0a0b", `stroke="#2a2c30" stroke-width="2" stroke-linejoin="round"`);
  const inner = q([[9, 9], [W - 8, k + 8], [W - 8, H - k - 8], [9, H - 9]]);
  s += path(inner, c.lin("wall", [[0, "#0b1022"], [0.55, "#171032"], [1, "#2a0f12"]], 0, 0, 1, 1));
  s += path(inner, c.rad("tvglow-a", [[0, LED, 0.7], [0.45, "#ff7a2f", 0.25], [1, LED, 0]], 0.7, 0.72, 0.5));
  s += path(inner, c.rad("tvglow-b", [[0, "#3b5bff", 0.4], [1, "#3b5bff", 0]], 0.25, 0.25, 0.4));
  s += path(`M9 ${n(H * 0.64)} C ${n(W * 0.3)} ${n(H * 0.46)}, ${n(W * 0.55)} ${n(H * 0.86)}, ${W - 8} ${n(H * 0.5)}`, "none", `stroke="#ffffff" stroke-opacity=".2" stroke-width="3"`);
  s += path(q([[W * 0.06, 9 + k * 0.06], [W * 0.34, 9 + k * 0.34], [W * 0.14, H - 9 - k * 0.14], [9, H - 9]]), "#ffffff", `opacity=".05"`);
  s += path(`M${n(W * 0.16)} ${n(H - k * 0.16)} L${n(W * 0.1)} ${n(H + 46)} L${n(W * 0.13)} ${n(H + 46)} L${n(W * 0.2)} ${n(H - k * 0.2)}`, "#1c1d20");
  s += path(`M${n(W * 0.84)} ${n(H - k * 0.84)} L${n(W * 0.9)} ${n(H - k * 0.6 + 40)} L${n(W * 0.87)} ${n(H - k * 0.6 + 40)} L${n(W * 0.81)} ${n(H - k * 0.81)}`, "#1c1d20");
  return { w: W + 14, h: H + 48, svg: s };
}

function soundbar(c: Ctx): Drawing {
  const W = 920;
  const grille = c.pattern("grille", 10, 10, `<circle cx="5" cy="5" r="2" fill="#000" opacity=".55"/>`);
  let s = rect(0, 300, 660, 84, 36, c.fin("graphite"), `stroke="#1d1f22" stroke-width="2"`);
  s += rect(20, 312, 620, 60, 26, grille);
  s += rect(290, 330, 80, 24, 10, "#0b0c0d") + led(c, 330, 342, 3.5);
  s += rect(700, 40, 220, 380, 22, c.fin("graphite"), `stroke="#1d1f22" stroke-width="2"`);
  s += rect(716, 56, 188, 348, 16, grille);
  s += circle(810, 330, 34, "#0c0d0e", `stroke="#3a3d42" stroke-width="3"`);
  s += rect(700, 40, 220, 380, 22, c.gloss());
  return { w: W, h: 422, svg: s, detail: [380, -20, 560, 560], altLabel: "detalhe da barra de som e do subwoofer" };
}

function vacuumStick(c: Ctx, f: Finish): Drawing {
  const W = 340;
  let s = "";
  s += path(`M150 0 H220 Q250 0 250 30 V150 H220 V40 Q220 30 210 30 H160 Q150 30 150 40 V170 H120 V30 Q120 0 150 0 Z`, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += rect(110, 150, 130, 250, 56, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += rect(130, 200, 90, 160, 40, c.lin("cup", [[0, "#ffffff", 0.75], [1, "#b8c4cf", 0.55]]), `stroke="#8796a5" stroke-width="2"`);
  s += path(`M150 230 Q175 260 200 230 M150 270 Q175 300 200 270 M150 310 Q175 340 200 310`, "none", `stroke="#7d8a97" stroke-width="2.5" opacity=".7"`);
  s += led(c, 175, 176, 4.5);
  s += rect(162, 396, 26, 590, 12, c.lin("wand", [[0, "#6d737a"], [0.5, "#d5d8dc"], [1, "#6d737a"]]));
  s += path(`M120 980 H250 Q300 980 310 1030 L316 1070 Q316 1090 296 1090 H40 Q20 1090 22 1070 L30 1030 Q42 980 120 980 Z`, c.fin(f), `stroke="${c.edge(f)}" stroke-width="2"`);
  s += rect(36, 1056, 270, 22, 10, "#0e0f11");
  s += rect(60, 1000, 220, 6, 3, LED, `opacity=".75"`);
  return { w: W, h: 1092, svg: s, detail: [-40, -30, 440, 440], altLabel: "detalhe do reservatório ciclônico" };
}

function robotVacuum(c: Ctx): Drawing {
  const W = 620;
  let s = ellipse(310, 214, 300, 86, "#000", `opacity=".12"`);
  s += path(`M10 150 A300 86 0 0 0 610 150 L610 196 A300 86 0 0 1 10 196 Z`, c.lin("rv-side", [[0, "#0b0c0d"], [0.5, "#2b2e33"], [1, "#0b0c0d"]]));
  s += path(`M30 176 A280 80 0 0 0 590 176`, "none", `stroke="#4a4e55" stroke-width="3"`);
  s += ellipse(310, 150, 300, 86, c.lin("rv-top", [[0, "#3a3e45"], [1, "#0f1012"]], 0, 0, 0, 1), `stroke="#000" stroke-width="2"`);
  s += ellipse(250, 130, 170, 40, "#ffffff", `opacity=".06"`);
  s += path(`M262 120 A48 14 0 0 0 358 120 L358 96 A48 14 0 0 1 262 96 Z`, "#1b1d21");
  s += ellipse(310, 96, 48, 14, c.lin("lidar", [[0, "#4a4e55"], [1, "#1b1d21"]], 0, 0, 0, 1));
  s += ellipse(310, 186, 46, 12, "#1b1d21", `stroke="#5b6068"`);
  s += led(c, 310, 186, 4);
  return { w: W, h: 304, svg: s, alt: () => robotTop(c), altLabel: "vista de cima" };
}

function robotTop(c: Ctx): Drawing {
  const W = 600;
  let s = circle(300, 300, 296, c.rad("rv-t", [[0, "#3a3e45"], [1, "#0e0f11"]], 0.4, 0.35, 0.75), `stroke="#000" stroke-width="3"`);
  s += path(`M60 180 A270 270 0 0 1 540 180`, "none", `stroke="#4a4e55" stroke-width="10"`);
  s += circle(300, 210, 62, "#1b1d21", `stroke="#5b6068" stroke-width="3"`) + circle(300, 210, 40, "#2b2e33");
  s += rect(250, 380, 100, 40, 20, "#1b1d21", `stroke="#5b6068"`) + led(c, 300, 400, 5);
  s += path(`M120 120 A240 240 0 0 1 300 60`, "none", `stroke="#ffffff" stroke-opacity=".12" stroke-width="12" stroke-linecap="round"`);
  return { w: W, h: W, svg: s };
}

function purifier(c: Ctx, f: Finish): Drawing {
  const W = 300;
  let s = bodyBox(c, f, 0, 0, W, 500, 28);
  s += rect(36, 36, W - 72, 120, 16, "#0d0e10");
  s += digits(80, 64, 34, 2) + led(c, 214, 80, 4);
  for (let i = 0; i < 3; i++) s += circle(100 + i * 50, 128, 7, "#c9ced6", `opacity=".7"`);
  s += rect(56, 184, W - 112, 250, 22, c.lin("recess2", [[0, "#000", 0.32], [0.3, "#000", 0.12], [1, "#000", 0.04]], 0, 0, 0, 1));
  s += rect(W / 2 - 18, 190, 36, 54, 8, c.chromeV(), `stroke="#7d838a"`) + rect(W / 2 - 5, 242, 10, 18, 3, "#6d737a");
  s += rect(76, 400, W - 152, 26, 8, c.chromeV(), `stroke="#7d838a"`) + vents(90, 408, W - 180, 2, 9, "#000", 0.3, 2.5);
  s += rect(14, 500, W - 28, 30, 10, "#1b1c1f");
  return { w: W, h: 530, svg: s, depth: 260, boxH: 500, altLabel: "vista em perspectiva" };
}

function waterCooler(c: Ctx, f: Finish): Drawing {
  const W = 330;
  let s = "";
  // garrafão
  s += path(`M60 30 Q60 0 100 0 H230 Q270 0 270 30 V320 Q270 352 238 356 L200 362 V392 H130 V362 L92 356 Q60 352 60 320 Z`, c.lin("bottle", [[0, "#cfe4f6", 0.85], [0.5, "#9cc8ec", 0.65], [1, "#cfe4f6", 0.85]]), `stroke="#7fa9cf" stroke-width="3"`);
  for (let i = 0; i < 4; i++) s += rect(64, 70 + i * 70, 202, 6, 3, "#ffffff", `opacity=".45"`);
  s += path(`M86 20 L110 20 L100 340 L84 330 Z`, "#ffffff", `opacity=".45"`);
  // gabinete
  s += bodyBox(c, f, 0, 386, W, 650, 20);
  s += rect(40, 440, W - 80, 210, 18, c.lin("recess3", [[0, "#000", 0.3], [1, "#000", 0.06]], 0, 0, 0, 1));
  s += rect(98, 452, 34, 56, 8, "#2563eb", `opacity=".85"`) + rect(108, 504, 14, 20, 4, "#6d737a");
  s += rect(198, 452, 34, 56, 8, LED) + rect(208, 504, 14, 20, 4, "#6d737a");
  s += rect(60, 610, W - 120, 24, 8, c.chromeV(), `stroke="#7d838a"`);
  s += circle(165, 420, 6, LED) + circle(165, 420, 16, c.ledGlow());
  s += rect(30, 690, W - 60, 310, 14, "#000", `opacity=".06"`) + rect(W - 64, 790, 10, 90, 5, c.chrome());
  return { w: W, h: 1036, svg: s, detail: [-50, 330, 430, 430], altLabel: "detalhe das torneiras de água gelada e natural" };
}

// ───────── Catálogo de desenhos

export function drawArt(kind: ArtKind, finish: Finish, c: Ctx): Drawing {
  switch (kind) {
    case "fridge-duplex": return fridgeDuplex(c, finish);
    case "fridge-inverse": return fridgeInverse(c, finish);
    case "fridge-side": return fridgeSide(c, finish);
    case "fridge-1door": return fridgeOneDoor(c, finish);
    case "freezer": return freezer(c, finish);
    case "stove": return stove(c, finish, 5);
    case "stove-4": return stove(c, finish, 4);
    case "cooktop-induction": return cooktopInduction(c);
    case "cooktop-gas": return cooktopGas(c);
    case "microwave": return microwave(c, finish);
    case "oven": return oven(c, finish);
    case "washer-front": return washerFront(c, finish, false);
    case "dryer": return washerFront(c, finish, true);
    case "washer-top": return washerTop(c, finish);
    case "dishwasher": return dishwasher(c, finish);
    case "ac": return acIndoor(c);
    case "fan-column": return fanColumn(c, finish);
    case "heater-oil": return heaterOil(c, finish);
    case "heater-fan": return heaterFan(c, finish);
    case "airfryer": return airfryer(c, finish);
    case "airfryer-oven": return airfryerOven(c, finish);
    case "espresso": return espresso(c, finish);
    case "coffee-drip": return coffeeDrip(c, finish);
    case "blender": return blender(c, finish);
    case "mixer": return mixer(c, finish);
    case "stand-mixer": return standMixer(c, finish);
    case "tv": return tv(c, "55");
    case "soundbar": return soundbar(c);
    case "vacuum-stick": return vacuumStick(c, finish);
    case "robot-vacuum": return robotVacuum(c);
    case "purifier": return purifier(c, finish);
    case "water-cooler": return waterCooler(c, finish);
  }
}

/** Caixa em perspectiva (projeção oblíqua): frente + lateral + tampo. */
function oblique(c: Ctx, d: Drawing, f: Finish): Drawing {
  const D = d.depth ?? 200;
  const bh = d.boxH ?? d.h;
  const dx = Math.round(D * 0.5);
  const dy = Math.round(D * 0.3);
  const w = d.w;
  let s = `<g transform="translate(0 ${dy})">`;
  s += path(`M${w - 2} 0 L${w + dx} ${-dy} L${w + dx} ${bh - dy} L${w - 2} ${bh} Z`, c.side(f), `stroke="${c.edge(f)}" stroke-width="2" stroke-linejoin="round"`);
  s += path(`M${w - 2} 0 L${w + dx} ${-dy} L${w + dx} ${bh - dy} L${w - 2} ${bh} Z`, c.shade());
  s += path(`M2 2 L${dx + 2} ${-dy} L${w + dx} ${-dy} L${w - 2} 2 Z`, c.top(f), `stroke="${c.edge(f)}" stroke-width="2" stroke-linejoin="round"`);
  s += d.svg;
  s += `</g>`;
  return { w: w + dx, h: d.h + dy, svg: s };
}

export type View = "front" | "alt";

/** Desenho final da vista pedida (com perspectiva, recorte ou vista própria). */
export function viewOf(kind: ArtKind, finish: Finish, c: Ctx, view: View): { d: Drawing; crop?: [number, number, number, number]; label: string } {
  const d = drawArt(kind, finish, c);
  if (view === "front") return { d, label: "vista frontal" };
  if (d.alt) return { d: d.alt(), label: d.altLabel ?? "outra vista" };
  if (d.depth) return { d: oblique(c, d, finish), label: d.altLabel ?? "vista em perspectiva" };
  if (d.detail) return { d, crop: d.detail, label: d.altLabel ?? "detalhe" };
  return { d, label: "vista frontal" };
}

/** Sombra suave no chão. */
export function floorShadow(c: Ctx, cx: number, y: number, w: number, dark = false) {
  const soft = c.rad(dark ? "fs-d" : "fs", [[0, "#000", dark ? 0.7 : 0.26], [1, "#000", 0]]);
  const hard = c.rad(dark ? "fh-d" : "fh", [[0, "#000", dark ? 0.8 : 0.32], [1, "#000", 0]]);
  return ellipse(cx, y, w * 0.62, Math.max(16, w * 0.07), soft) + ellipse(cx, y - 2, w * 0.48, Math.max(6, w * 0.022), hard);
}

/** Posiciona um desenho dentro de uma caixa (centralizado, apoiado no chão da caixa). */
export function place(d: Drawing, box: { x: number; y: number; w: number; h: number }, align: "center" | "bottom" = "bottom") {
  const s = Math.min(box.w / d.w, box.h / d.h);
  const w = d.w * s;
  const h = d.h * s;
  const x = box.x + (box.w - w) / 2;
  const y = align === "bottom" ? box.y + box.h - h : box.y + (box.h - h) / 2;
  return { x, y, w, h, s, svg: `<g transform="translate(${n(x)} ${n(y)}) scale(${s.toFixed(4)})">${d.svg}</g>` };
}

const SIZE = 1600;

/** Foto de produto 1600×1600 em fundo cinza-claro, pronta para o sharp. */
export function productShot(kind: ArtKind, finish: Finish, view: View): { svg: string; label: string } {
  const c = new Ctx("p");
  const v = viewOf(kind, finish, c, view);
  const bg = c.lin("bg", [[0, "#f4f4f5"], [1, "#ffffff"]], 0, 0, 0, 1);
  const halo = c.rad("halo", [[0, "#ffffff", 1], [1, "#ffffff", 0]]);
  let body: string;
  if (v.crop) {
    const [x, y, w, h] = v.crop;
    body = `<svg x="0" y="0" width="${SIZE}" height="${SIZE}" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="xMidYMid slice">${v.d.svg}</svg>`;
  } else {
    const ratio = v.d.w / v.d.h;
    const boxH = ratio > 2.2 ? 760 : 1180;
    const top = (SIZE - boxH) / 2 + (ratio > 2.2 ? 40 : 30);
    const p = place(v.d, { x: 200, y: top, w: SIZE - 400, h: boxH }, ratio > 2.2 ? "center" : "bottom");
    body = floorShadow(c, p.x + p.w / 2, p.y + p.h, p.w) + p.svg;
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    c.defsSvg() +
    rect(0, 0, SIZE, SIZE, 0, bg) +
    ellipse(SIZE / 2, SIZE * 0.46, SIZE * 0.48, SIZE * 0.42, halo) +
    body +
    `</svg>`;
  return { svg, label: v.label };
}

/** Ilustração com fundo transparente (miniatura de categoria). */
export function iconShot(kind: ArtKind, finish: Finish, size = 800): string {
  const c = new Ctx("i");
  const d = drawArt(kind, finish, c);
  const pad = size * 0.08;
  const p = place(d, { x: pad, y: pad, w: size - pad * 2, h: size - pad * 2 }, "center");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${c.defsSvg()}${p.svg}</svg>`;
}
