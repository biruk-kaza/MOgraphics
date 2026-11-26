import React from 'react';
import {COLORS, rgba, W, H} from '../styles/designSystem';
import {progress} from '../animation/frameMath';
import {easeOutExpo, easeOutCubic} from '../animation/easing';

/** Expanding ring: a physical "shock" that carries a transformation. */
export const ShockRing: React.FC<{frame: number; start: number; cx: number; cy: number; maxR?: number; color?: string; duration?: number; width?: number}> = ({
  frame, start, cx, cy, maxR = 900, color = COLORS.cyan, duration = 30, width = 3,
}) => {
  const p = progress(frame, start, start + duration);
  if (p <= 0 || p >= 1) return null;
  const r = maxR * easeOutExpo(p);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={rgba(color, 0.85 * (1 - p))} strokeWidth={width * (1 - p * 0.6)} />
      <circle cx={cx} cy={cy} r={r * 0.82} fill="none" stroke={rgba('#FFFFFF', 0.35 * (1 - p))} strokeWidth={1.2} />
    </svg>
  );
};

/** Short radial flash. */
export const ImpactFlash: React.FC<{frame: number; start: number; cx: number; cy: number; duration?: number; intensity?: number; color?: string}> = ({
  frame, start, cx, cy, duration = 14, intensity = 0.5, color = COLORS.white,
}) => {
  const p = progress(frame, start, start + duration);
  if (p <= 0 || p >= 1) return null;
  const a = intensity * (1 - easeOutCubic(p));
  return <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(700px 500px at ${cx}px ${cy}px, ${rgba(color, a)}, transparent 70%)`}} />;
};
