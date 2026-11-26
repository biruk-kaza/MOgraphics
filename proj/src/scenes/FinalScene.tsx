import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {CueLine} from '../components/CueDrivenText';
import {LightSweep} from '../components/LightSweep';
import {ShockRing} from '../components/SceneTransitions';
import {COLORS, CX, CY, H, STAGE, W, rgba} from '../styles/designSystem';
import {lineAt, wordAt} from '../animation/cueEngine';
import {TL} from '../animation/world';
import {progress} from '../animation/frameMath';
import {easeInOutCubic, easeOutExpo} from '../animation/easing';

/** EVENT 6 — "አሁን ተዘጋጅተናል።" Everything resolves into a balanced, confident frame, then holds. */
export const FinalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const line = lineAt(6);
  if (frame < line.startFrame - 24) return null;
  const w1 = wordAt(6, 1);
  const bracket = easeOutExpo(progress(frame, line.startFrame - 6, line.startFrame + 22));
  const L = 84 * bracket;
  const corner = (x: number, y: number, sx: number, sy: number) => `M${x} ${y + sy * L}L${x} ${y}L${x + sx * L} ${y}`;
  const u = easeOutExpo(progress(frame, w1.startFrame + 6, w1.startFrame + 30));
  const plate = easeInOutCubic(progress(frame, line.startFrame - 8, line.startFrame + 10));
  const breathe = 0.5 + 0.5 * Math.sin(frame / 22);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 980px 300px at ${CX}px ${CY}px, rgba(3,5,15,${(0.6 * plate).toFixed(3)}), transparent 75%)`}} />
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <g fill="none" stroke={COLORS.gold} strokeWidth={3.4} strokeLinecap="square" opacity={bracket > 0 ? 0.9 : 0}>
          <path d={corner(STAGE.x0, STAGE.y0, 1, 1)} />
          <path d={corner(STAGE.x1, STAGE.y0, -1, 1)} />
          <path d={corner(STAGE.x0, STAGE.y1, 1, -1)} />
          <path d={corner(STAGE.x1, STAGE.y1, -1, -1)} />
        </g>
        {u > 0 && (
          <g>
            <line x1={CX - 560 * u} y1={668} x2={CX + 560 * u} y2={668} stroke={COLORS.gold} strokeWidth={3} />
            <rect x={CX - 7} y={661} width={14} height={14} fill={COLORS.gold} transform={`rotate(45 ${CX} 668)`} opacity={u} />
            <line x1={CX - 560 * u} y1={668} x2={CX + 560 * u} y2={668} stroke={rgba(COLORS.gold, 0.35 + 0.2 * breathe)} strokeWidth={9} />
          </g>
        )}
      </svg>
      <ShockRing frame={frame} start={line.startFrame} cx={CX} cy={CY} maxR={800} color={COLORS.gold} duration={36} width={2.5} />
      <LightSweep frame={frame} start={w1.startFrame + 4} duration={34} color={COLORS.gold} angle={-14} width={240} intensity={0.45} />
      <CueLine
        line={line}
        rows={[{words: [0, 1], x: CX, y: CY - 10, size: 140, weight: 900, gap: 54}]}
        enter={(wi) => (wi === 0 ? 'rise' : 'scale')}
      />
    </AbsoluteFill>
  );
};
