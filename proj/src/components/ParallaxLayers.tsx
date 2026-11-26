import React from 'react';
import {random} from 'remotion';
import {BG_GRADIENT, COLORS, rgba, W, H} from '../styles/designSystem';
import {CameraState} from '../animation/world';
import {energyAt} from '../animation/cueEngine';

const LAYERS = [
  {depth: 0.25, count: 46, speed: 0.12, size: [0.8, 1.6], alpha: 0.35},
  {depth: 0.6, count: 30, speed: 0.22, size: [1.2, 2.4], alpha: 0.5},
  {depth: 1.1, count: 16, speed: 0.38, size: [1.8, 3.4], alpha: 0.65},
];
const DUST = LAYERS.map((L, li) =>
  Array.from({length: L.count}, (_, i) => ({
    x: random(`dx-${li}-${i}`) * W,
    y: random(`dy-${li}-${i}`) * H,
    r: L.size[0] + random(`dr-${li}-${i}`) * (L.size[1] - L.size[0]),
    ph: random(`dp-${li}-${i}`) * 6.28,
    w: 0.03 + random(`dw-${li}-${i}`) * 0.05,
    c: random(`dc-${li}-${i}`),
  })),
);

export const ParallaxLayers: React.FC<{frame: number; camera: CameraState}> = ({frame, camera}) => {
  const e = energyAt(frame);
  return (
    <div style={{position: 'absolute', inset: 0, background: BG_GRADIENT, overflow: 'hidden'}}>
      {/* slow atmospheric orbs */}
      <div style={{position: 'absolute', left: 260 + Math.sin(frame / 120) * 60 - camera.x * 0.3, top: 120 + Math.cos(frame / 150) * 40, width: 900, height: 900, borderRadius: '50%', background: `radial-gradient(circle, ${rgba(COLORS.purple, 0.16 + 0.08 * e)}, transparent 65%)`}} />
      <div style={{position: 'absolute', left: 1020 + Math.cos(frame / 130) * 70 - camera.x * 0.3, top: 360 + Math.sin(frame / 110) * 50, width: 900, height: 900, borderRadius: '50%', background: `radial-gradient(circle, ${rgba(COLORS.cyan, 0.10 + 0.06 * e)}, transparent 65%)`}} />
      {LAYERS.map((L, li) => (
        <svg key={li} width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
          <g transform={`translate(${(-camera.x * L.depth).toFixed(2)} ${(-camera.y * L.depth).toFixed(2)})`}>
            {DUST[li].map((d, i) => {
              const y = (((d.y - frame * L.speed) % H) + H) % H;
              const a = L.alpha * (0.55 + 0.45 * Math.sin(frame * d.w + d.ph));
              return <circle key={i} cx={d.x} cy={y} r={d.r} fill={d.c < 0.5 ? rgba(COLORS.white, a) : d.c < 0.8 ? rgba(COLORS.cyan, a) : rgba(COLORS.purple, a)} />;
            })}
          </g>
        </svg>
      ))}
    </div>
  );
};

export const Vignette: React.FC = () => (
  <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 48%, rgba(2,3,10,0.72) 100%)'}} />
);
