import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {CueLine} from '../components/CueDrivenText';
import {ChaosShapes} from '../components/AnimatedShapes';
import {lineAt} from '../animation/cueEngine';
import {getWorld, TL} from '../animation/world';
import {clamp, progress} from '../animation/frameMath';

/** EVENT 1 — "ብዙዎች ነገሮችን ማወሳሰብ ያበዛሉ።" Complexity builds to a deliberate peak. */
export const ComplexityScene: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame > TL.m1End + 30) return null;
  const line = lineAt(1);
  const next = lineAt(2);
  const exitStart = line.endFrame + 2;
  const exitDur = clamp(next.startFrame - exitStart + 4, 10, 18);
  const plate = (1 - progress(frame, exitStart, exitStart + exitDur)) * getWorld(frame).intensity;
  const inten = (f: number) => getWorld(f).intensity;
  return (
    <AbsoluteFill>
      <ChaosShapes frame={frame} />
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 1050px 400px at 960px 520px, rgba(3,5,15,${(0.6 * plate).toFixed(3)}), transparent 72%)`}} />
      <CueLine
        line={line}
        rows={[
          {words: [0, 1], x: 960, y: 445, size: 118},
          {words: [2, 3], x: 960, y: 605, size: 118},
        ]}
        enter={(wi) => (wi === 2 ? 'snap' : 'rise')}
        exit={{start: exitStart, duration: exitDur, scale: 1.5, blur: 14, stagger: 2}}
        // overlapping outline ghosts: the word "complicate" gets the heaviest tangle
        ghostFn={(wi, f) => (wi === 2 ? 18 : wi === 1 ? 6 : 3) * inten(f)}
        // controlled tension: a tiny deterministic tremor that grows with intensity
        offsetFn={(wi, f) => {
          const a = Math.pow(inten(f), 3) * 3.5;
          return [Math.sin(f * 1.7 + wi * 2.1) * a, Math.cos(f * 2.1 + wi * 1.3) * a];
        }}
      />
    </AbsoluteFill>
  );
};
