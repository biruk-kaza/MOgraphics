import React from 'react';
import {random} from 'remotion';
import {COLORS} from '../styles/designSystem';
import {W, H} from '../styles/designSystem';
import {clamp, lerp, progress} from '../animation/frameMath';
import {easeInOutCubic, easeOutBack} from '../animation/easing';
import {getWorld, TL} from '../animation/world';
import {N_CURVES, KEEPERS, morphCurve, bezierPoint} from './SVGMorph';

const P = 64;
const PARTS = Array.from({length: P}, (_, j) => ({
  c: Math.floor(random(`pc-${j}`) * N_CURVES),
  u0: random(`pu-${j}`),
  speed: 0.0012 + random(`ps-${j}`) * 0.0022,
  size: 1.8 + random(`pz-${j}`) * 3.4,
  rank: random(`pr-${j}`),
  rem: random(`pm-${j}`),
  gold: random(`pg-${j}`) < 0.12,
}));

/**
 * Particles that ride the very same morphing curves as the line field, so they scatter in chaos,
 * stream along the beam during the turn, and settle on the grid — then only the guide-line riders survive.
 */
export const ParticleSystem: React.FC<{frame: number}> = ({frame}) => {
  const w = getWorld(frame);
  const flowBoost = easeInOutCubic(w.p1);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {PARTS.map((p, j) => {
        const t0 = 4 + (TL.l1End - 14) * (1 - Math.pow(1 - p.rank, 1.8));
        const appear = easeOutBack(progress(frame, t0, t0 + 12));
        if (appear <= 0.01) return null;
        const keeper = KEEPERS.has(p.c);
        let alpha = 1;
        if (!keeper) alpha = 1 - easeInOutCubic(clamp(w.removal * 1.5 - 0.5 * p.rem));
        else alpha = 1 - w.guideFade;
        if (alpha <= 0.01) return null;
        const curve = morphCurve(p.c, frame, w.p1, w.p2, w.intensity);
        const u = (((p.u0 + p.speed * (frame + 42 * flowBoost)) % 1) + 1) % 1;
        const [x, y] = bezierPoint(curve, u);
        const tailU = Math.max(0, u - (0.012 + 0.06 * flowBoost * (1 - w.p2)));
        const [tx, ty] = bezierPoint(curve, tailU);
        const jitter = w.intensity * 6;
        const jx = Math.sin(frame * 0.7 + j) * jitter, jy = Math.cos(frame * 0.9 + j * 1.3) * jitter;
        const color = p.gold || (keeper && w.removal > 0.5) ? COLORS.gold : j % 2 ? COLORS.cyan : COLORS.white;
        const r = p.size * appear * lerp(1, 0.8, w.p2);
        return (
          <g key={j} opacity={alpha * 0.9}>
            <path d={`M${(tx + jx).toFixed(1)} ${(ty + jy).toFixed(1)}L${(x + jx).toFixed(1)} ${(y + jy).toFixed(1)}`} stroke={color} strokeWidth={r * 0.9} strokeLinecap="round" opacity={0.5} />
            <circle cx={x + jx} cy={y + jy} r={r} fill={color} />
          </g>
        );
      })}
    </svg>
  );
};
