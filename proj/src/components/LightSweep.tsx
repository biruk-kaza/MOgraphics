import React from 'react';
import {W} from '../styles/designSystem';
import {COLORS, rgba} from '../styles/designSystem';
import {lerp, progress} from '../animation/frameMath';
import {easeInOutCubic} from '../animation/easing';

export const LightSweep: React.FC<{
  frame: number;
  start: number;
  duration: number;
  angle?: number;
  color?: string;
  width?: number;
  intensity?: number;
  trail?: number;
}> = ({frame, start, duration, angle = -16, color = COLORS.cyan, width = 340, intensity = 0.55, trail = 3}) => {
  const p = progress(frame, start, start + duration);
  if (p <= 0 || p >= 1) return null;
  const x = lerp(-width * 1.6, W + width * 1.6, easeInOutCubic(p));
  const fade = Math.sin(Math.PI * p);
  const band = (k: number) => {
    const w = width * (1 - k * 0.12);
    return (
      <div
        key={k}
        style={{
          position: 'absolute',
          top: -500,
          height: 2080,
          width: w,
          left: x - k * width * 0.34,
          transform: `rotate(${angle}deg)`,
          background: `linear-gradient(90deg, transparent, ${rgba(color, 0.35)}, ${rgba('#FFFFFF', 0.75)}, ${rgba(color, 0.35)}, transparent)`,
          opacity: intensity * fade * (1 - k / (trail + 1)),
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
    );
  };
  return <div style={{position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none'}}>{Array.from({length: trail + 1}).map((_, k) => band(k))}</div>;
};
