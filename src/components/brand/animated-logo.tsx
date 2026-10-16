"use client";

import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import ANIM from "./logo-anim.json";

// Versão animada da logo (a mesma animação em código do kit da marca, pasta 09):
// os cantos da mira entram girando e travam, o ponto laranja acende com um pulso e o
// nome se forma letra por letra com o cursor do terminal. Depois o cursor pisca.
// Com "reduzir movimento" ligado no aparelho, mostra a logo parada.

type Glyph = { x: number; adv: number; d: string };
const DATA = ANIM as unknown as {
  word: Glyph[];
  wx: number;
  pen: number[];
  decode: Record<string, string>;
  keys: string[];
  piv: [number, number][];
  tick: number;
};

const CORNER_D = [
  "M6.5 35.5V6.5H35.5V13.5H13.5V35.5Z",
  "M93.5 35.5V6.5H64.5V13.5H86.5V35.5Z",
  "M6.5 64.5V93.5H35.5V86.5H13.5V64.5Z",
  "M93.5 64.5V93.5H64.5V86.5H86.5V64.5Z",
];
const FROM: [number, number, number][] = [[-1, -1, -90], [1, -1, 90], [-1, 1, 90], [1, 1, -90]];
const ACC = "#ff5500";
const T0 = 0.15;
const TT = 1.45;
const STEP = 0.11;
const DEC = 0.045;
const T_DONE = TT + 5 * STEP + 0.3;

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (t: number, a: number, d: number) => clamp((t - a) / d);
function bez(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}
const E = { corner: bez(0.7, 0, 0.2, 1), out: bez(0, 0, 0.58, 1), ease: bez(0.25, 0.1, 0.25, 1), pop: bez(0.3, 1.8, 0.5, 1) };
function rnd(a: number, b: number) {
  let h = Math.imul(a + 1, 374761393) ^ Math.imul(b + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const f = (v: number) => Math.round(v * 100) / 100;

export function AnimatedLogo({ className, replayOnHover = true, title = "Tirvo" }: { className?: string; replayOnHover?: boolean; title?: string }) {
  const corners = useRef<(SVGPathElement | null)[]>([]);
  const cornersG = useRef<SVGGElement>(null);
  const ticks = useRef<SVGPathElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const halo = useRef<SVGCircleElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const letters = useRef<(SVGPathElement | null)[]>([]);
  const cur = useRef<SVGRectElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const raf = useRef(0);
  const lastPlay = useRef(0);

  const render = useCallback((t: number) => {
    const T = t - T0;
    const pc = seg(T, 0, 1.05);
    const ec = E.corner(pc);
    corners.current.forEach((el, i) => {
      if (!el) return;
      const [sx, sy, r] = FROM[i];
      const [px, py] = DATA.piv[i];
      const op = pc <= 0 ? 0 : pc < 0.3 ? E.corner(pc / 0.3) : 1;
      el.setAttribute("transform", `translate(${f(sx * 34 * (1 - ec))} ${f(sy * 34 * (1 - ec))}) rotate(${f(r * (1 - ec))} ${px} ${py})`);
      el.setAttribute("opacity", String(f(op)));
    });
    const pl = seg(T, 1.05, 0.22);
    let ls = 1;
    if (pl > 0 && pl < 1) ls = pl < 0.5 ? 1 - 0.06 * E.out(pl / 0.5) : 0.94 + 0.06 * E.out((pl - 0.5) / 0.5);
    cornersG.current?.setAttribute("transform", `translate(50 50) scale(${f(ls * 1000) / 1000}) translate(-50 -50)`);
    ticks.current?.setAttribute("opacity", String(f(DATA.tick * E.out(seg(T, 1.1, 0.3)))));
    const ds = E.pop(seg(T, 1.2, 0.5));
    const dsT = `translate(50 50) scale(${f(ds * 1000) / 1000}) translate(-50 -50)`;
    dot.current?.setAttribute("transform", dsT);
    halo.current?.setAttribute("transform", dsT);
    const pr = seg(T, 1.25, 0.9);
    if (ring.current) {
      if (pr > 0 && pr < 1) {
        const e = E.out(pr);
        ring.current.setAttribute("opacity", String(f(0.9 * (1 - e))));
        ring.current.setAttribute("transform", `translate(50 50) scale(${f(0.4 + 2.8 * e)}) translate(-50 -50)`);
      } else ring.current.setAttribute("opacity", "0");
    }
    letters.current.forEach((p, i) => {
      if (!p) return;
      const ti = TT + i * STEP;
      const w = DATA.word[i];
      if (T < ti) {
        p.setAttribute("opacity", "0");
        return;
      }
      if (T < ti + 6 * DEC) {
        const kk = Math.floor((T - ti) / DEC);
        const key = DATA.keys[Math.floor(rnd(i, kk) * DATA.keys.length)];
        p.setAttribute("d", DATA.decode[key]);
        p.setAttribute("transform", `translate(${f((w.adv - 30 - 600 * 0.8) / 2)} 0) scale(.8)`);
        p.setAttribute("fill", ACC);
        p.setAttribute("opacity", "0.55");
      } else {
        p.setAttribute("d", w.d);
        p.removeAttribute("transform");
        p.setAttribute("fill", "currentColor");
        p.setAttribute("opacity", String(f(0.55 + 0.45 * E.ease(seg(T, ti + 6 * DEC, 0.35)))));
      }
    });
    if (cur.current) {
      let cx: number | null = null;
      let on = false;
      if (T >= 0) {
        if (T < TT) {
          cx = 0;
          on = T % 1 < 0.5;
        } else if (T < T_DONE) {
          cx = DATA.pen[Math.min(4, Math.floor((T - TT) / STEP))];
          on = true;
        } else {
          cx = DATA.pen[4];
          on = true;
        }
      }
      if (cx === null) cur.current.setAttribute("opacity", "0");
      else {
        cur.current.setAttribute("x", String(f(DATA.wx + cx + 60)));
        cur.current.setAttribute("opacity", on ? "1" : "0");
      }
    }
  }, []);

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    svg.current?.classList.remove("tirvo-idle");
    const start = performance.now();
    lastPlay.current = start;
    const end = T0 + T_DONE + 0.4;
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      render(Math.min(t, end));
      if (t < end) raf.current = requestAnimationFrame(tick);
      else svg.current?.classList.add("tirvo-idle"); // depois: cursor pisca e ponto respira (CSS)
    };
    raf.current = requestAnimationFrame(tick);
  }, [render]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      render(T0 + T_DONE + 1);
      cur.current?.setAttribute("opacity", "0");
      return;
    }
    render(0);
    play();
    return () => cancelAnimationFrame(raf.current);
  }, [play, render]);

  const onEnter = () => {
    if (!replayOnHover) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (performance.now() - lastPlay.current > 4000) play();
  };

  return (
    <svg
      ref={svg}
      viewBox="-47 -794 3800 878"
      className={cn("tirvo-anim h-7 w-auto overflow-visible", className)}
      role="img"
      aria-label={title}
      onMouseEnter={onEnter}
    >
      <style>{`
        .tirvo-idle .tv-cur { animation: tvBlink 1.1s steps(1, end) infinite; }
        .tirvo-idle .tv-halo { animation: tvBreath 2.6s ease-in-out infinite; }
        @keyframes tvBlink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: 0 } }
        @keyframes tvBreath { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
        @media (prefers-reduced-motion: reduce) { .tirvo-idle .tv-cur, .tirvo-idle .tv-halo { animation: none } }
      `}</style>
      <defs>
        <filter id="tv-halo-blur" x="-150%" y="-150%" width="400%" height="400%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <g transform="translate(-58.5 -805) scale(9)">
        <g ref={cornersG}>
          {CORNER_D.map((d, i) => (
            <path key={i} ref={(el) => { corners.current[i] = el; }} d={d} fill="currentColor" opacity={0} />
          ))}
        </g>
        <path ref={ticks} d="M48.5 22h3v12h-3Z M48.5 66h3v12h-3Z M22 48.5h12v3h-12Z M66 48.5h12v3h-12Z" fill="currentColor" opacity={0} />
        <circle ref={ring} cx="50" cy="50" r="10" fill="none" stroke={ACC} strokeWidth="2" opacity={0} />
        <circle ref={halo} className="tv-halo" cx="50" cy="50" r="11" fill={ACC} filter="url(#tv-halo-blur)" transform="scale(0)" />
        <circle ref={dot} cx="50" cy="50" r="10" fill={ACC} transform="scale(0)" />
      </g>
      <g transform={`translate(${DATA.wx} 0)`}>
        {DATA.word.map((w, i) => (
          <g key={i} transform={`translate(${w.x} 0)`}>
            <path ref={(el) => { letters.current[i] = el; }} d={w.d} fill="currentColor" opacity={0} />
          </g>
        ))}
      </g>
      <rect ref={cur} className="tv-cur" y={-120} width={400} height={120} fill={ACC} opacity={0} />
    </svg>
  );
}
