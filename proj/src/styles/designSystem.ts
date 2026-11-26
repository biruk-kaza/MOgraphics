export const W = 1920;
export const H = 1080;
export const CX = W / 2;
export const CY = H / 2;

export const COLORS = {
  midnight: '#050818',
  navy: '#0A1030',
  charcoal: '#10131F',
  purple: '#8B5CF6',
  cyan: '#3DD9EB',
  gold: '#E6B85C',
  white: '#F6F8FF',
  ink: '#03050F',
} as const;

export const FONT = {
  family: 'Noto Sans Ethiopic',
  weights: [300, 400, 500, 700, 900] as const,
  file: (w: number) => `fonts/NotoSansEthiopic-${w}.woff2`,
};

export type RGB = [number, number, number];
export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
export const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
export const mixColor = (a: string, b: string, t: number) => {
  const A = hexToRgb(a), B = hexToRgb(b);
  const k = Math.min(1, Math.max(0, t));
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(A[2] + (B[2] - A[2]) * k)})`;
};

/** The screen "stage" rectangle that the four guide lines form (matches the order-layout keeper lines). */
export const STAGE = {x0: 240, y0: 240, x1: 1680, y1: 840};
export const STAGE_W = STAGE.x1 - STAGE.x0;
export const STAGE_H = STAGE.y1 - STAGE.y0;

/** Where the converging beam and the later "seed" live. */
export const FOCUS = {x: 1240, y: 540};

export const BG_GRADIENT = `radial-gradient(1400px 900px at 22% 28%, rgba(139,92,246,0.20), transparent 62%),
 radial-gradient(1300px 900px at 82% 74%, rgba(61,217,235,0.13), transparent 60%),
 linear-gradient(160deg, ${COLORS.navy} 0%, ${COLORS.midnight} 55%, ${COLORS.charcoal} 100%)`;
