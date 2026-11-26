import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {CueLine} from '../components/CueDrivenText';
import {LightSweep} from '../components/LightSweep';
import {ImpactFlash, ShockRing} from '../components/SceneTransitions';
import {COLORS, FOCUS, H, W, rgba} from '../styles/designSystem';
import {lineAt} from '../animation/cueEngine';
import {TL} from '../animation/world';
import {clamp, lerp, progress} from '../animation/frameMath';
import {easeInCubic, easeOutCubic} from '../animation/easing';

const STREAKS = Array.from({length: 18}, (_, i) => ({
  y: 80 + random(`st-y-${i}`) * (H - 160),
  len: 220 + random(`st-l-${i}`) * 520,
  delay: random(`st-d-${i}`) * 16,
  w: 1 + random(`st-w-${i}`) * 2.2,
}));

/** EVENT 2 — "እኛ ግን አቅጣጫውን እንቀይራለን።" The pivot word "ግን" re-routes the whole structure. */
export const DirectionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const line = lineAt(2);
  const next = lineAt(3);
  if (frame < TL.m1Start - 8 || frame > next.startFrame + 4) return null;
  const exitStart = line.endFrame + 2;
  const exitDur = clamp(next.startFrame - exitStart + 3, 8, 16);
  const presence = progress(frame, line.startFrame - 2, line.startFrame + 10) * (1 - progress(frame, exitStart, exitStart + exitDur));
  const chev = progress(frame, TL.m1Start, TL.m1End + 36);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, background: `linear-gradient(90deg, rgba(3,5,15,${(0.72 * presence).toFixed(3)}) 0%, rgba(3,5,15,${(0.4 * presence).toFixed(3)}) 55%, transparent 82%)`}} />
      {/* directional speed streaks sweep with the pivot */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {STREAKS.map((s, i) => {
          const p = progress(frame, TL.m1Start + s.delay, TL.m1Start + s.delay + 30);
          if (p <= 0 || p >= 1) return null;
          const x = lerp(-s.len, W + 100, easeInCubic(p) * 0.6 + p * 0.4);
          return <line key={i} x1={x} y1={s.y} x2={x + s.len} y2={s.y} stroke={rgba(i % 3 ? COLORS.cyan : COLORS.white, 0.7 * Math.sin(Math.PI * p))} strokeWidth={s.w} strokeLinecap="round" />;
        })}
        {chev > 0 && chev < 1 && [0, 1, 2].map((k) => {
          const q = clamp(chev * 1.3 - k * 0.12);
          const x = FOCUS.x + 330 + easeOutCubic(q) * 160 + k * 46;
          return <polyline key={k} points={`${x - 30},${FOCUS.y - 58} ${x},${FOCUS.y} ${x - 30},${FOCUS.y + 58}`} fill="none" stroke={rgba(COLORS.gold, 0.8 * Math.sin(Math.PI * q))} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />;
        })}
      </svg>
      <LightSweep frame={frame} start={TL.m1Start} duration={26} angle={-16} />
      <ImpactFlash frame={frame} start={TL.m1Start + 1} cx={FOCUS.x} cy={FOCUS.y} intensity={0.4} />
      <ShockRing frame={frame} start={TL.m1Start + 3} cx={FOCUS.x + 120} cy={FOCUS.y} maxR={1000} />
      <CueLine
        line={line}
        rows={[
          {words: [0, 1], x: 150, y: 450, size: 124, align: 'left'},
          {words: [2, 3], x: 150, y: 610, size: 98, align: 'left', weight: 700},
        ]}
        enter={(wi) => (['slide', 'scale', 'rise', 'rise'] as const)[wi]}
        exit={{start: exitStart, duration: exitDur, dx: 140, blur: 10, stagger: 1}}
      />
    </AbsoluteFill>
  );
};
