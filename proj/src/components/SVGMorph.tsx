import {random} from 'remotion';
import {W, H, CX, CY, FOCUS} from '../styles/designSystem';
import {clamp, lerp} from '../animation/frameMath';
import {easeInOutCubic} from '../animation/easing';

export type Pt = [number, number];
export type Curve = [Pt, Pt, Pt, Pt];

/** 23 cubic curves = 15 verticals + 8 horizontals of the final 120px grid. */
export const N_CURVES = 23;
/** Curves that survive "nothing unnecessary": x=240, x=1680, y=240, y=840 — they frame the stage. */
export const KEEPERS = new Set([1, 13, 16, 21]);

const edgePoint = (u: number, v: number): Pt => {
  const side = Math.floor(u * 4) % 4;
  if (side === 0) return [v * W, -70];
  if (side === 1) return [W + 70, v * H];
  if (side === 2) return [v * W, H + 70];
  return [-70, v * H];
};

const mk = (i: number): Curve => {
  const r = (k: string) => random(`chaos-${i}-${k}`);
  const p0 = edgePoint(r('a'), r('b'));
  const p3 = edgePoint((r('c') + 0.25 + 0.5 * r('c2')) % 1, r('d'));
  const c1: Pt = [CX + (r('e') - 0.5) * 2000, CY + (r('f') - 0.5) * 1300];
  const c2: Pt = [CX + (r('g') - 0.5) * 2000, CY + (r('h') - 0.5) * 1300];
  return [p0, c1, c2, p3];
};

export const CHAOS: Curve[] = Array.from({length: N_CURVES}, (_, i) => mk(i));

export const FLOW: Curve[] = Array.from({length: N_CURVES}, (_, i) => {
  const y = lerp(-80, 1160, i / (N_CURVES - 1));
  const p0: Pt = [-140, y];
  const p3: Pt = [FOCUS.x + 260, FOCUS.y + (i - 11) * 7];
  return [p0, [p0[0] + 700, p0[1]], [p3[0] - 620, p3[1]], p3];
});

export const ORDER: Curve[] = Array.from({length: N_CURVES}, (_, i) => {
  if (i < 15) {
    const x = 120 * (i + 1);
    return [[x, 0], [x, 360], [x, 720], [x, H]];
  }
  const y = 120 * (i - 15 + 1);
  return [[0, y], [640, y], [1280, y], [W, y]];
});

const ORD2 = Array.from({length: N_CURVES}, (_, i) => random(`o2-${i}`));
const DRIFT = Array.from({length: N_CURVES}, (_, i) =>
  Array.from({length: 4}, (_, k) => {
    const isCtrl = k === 1 || k === 2;
    return {
      ax: (isCtrl ? 50 : 14) + random(`dax-${i}-${k}`) * (isCtrl ? 110 : 30),
      ay: (isCtrl ? 50 : 14) + random(`day-${i}-${k}`) * (isCtrl ? 110 : 30),
      wx: 0.014 + random(`dwx-${i}-${k}`) * 0.04,
      wy: 0.014 + random(`dwy-${i}-${k}`) * 0.04,
      px: random(`dpx-${i}-${k}`) * 6.28,
      py: random(`dpy-${i}-${k}`) * 6.28,
    };
  }),
);

const loc = (p: number, order: number, S = 0.55) => easeInOutCubic(clamp(p * (1 + S) - S * order));
export const localFlow = (i: number, p1: number) => loc(p1, i / (N_CURVES - 1));
export const localOrder = (i: number, p2: number) => loc(p2, ORD2[i]);

/** Chaos → Flow → Order, per-curve staggered. Everything is a pure function of the arguments. */
export function morphCurve(i: number, frame: number, p1: number, p2: number, intensity: number): Curve {
  const a = localFlow(i, p1);
  const b = localOrder(i, p2);
  const pts: Pt[] = [];
  for (let k = 0; k < 4; k++) {
    const d = DRIFT[i][k];
    const amp = intensity * (1 - a);
    const cx = CHAOS[i][k][0] + Math.sin(frame * d.wx + d.px) * d.ax * amp;
    const cy = CHAOS[i][k][1] + Math.cos(frame * d.wy + d.py) * d.ay * amp;
    const fx = lerp(cx, FLOW[i][k][0], a);
    const fy = lerp(cy, FLOW[i][k][1], a);
    pts.push([lerp(fx, ORDER[i][k][0], b), lerp(fy, ORDER[i][k][1], b)]);
  }
  return pts as Curve;
}

export const curveToPath = (c: Curve) =>
  `M${c[0][0].toFixed(1)} ${c[0][1].toFixed(1)}C${c[1][0].toFixed(1)} ${c[1][1].toFixed(1)} ${c[2][0].toFixed(1)} ${c[2][1].toFixed(1)} ${c[3][0].toFixed(1)} ${c[3][1].toFixed(1)}`;

export function bezierPoint(c: Curve, u: number): Pt {
  const v = 1 - u;
  const a = v * v * v, b = 3 * v * v * u, d = 3 * v * u * u, e = u * u * u;
  return [a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0], a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1]];
}

/** Generic path interpolation helper for equal-length point lists (used for ad-hoc morphs). */
export const lerpPoints = (a: Pt[], b: Pt[], t: number): Pt[] => a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)] as Pt);
