import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {CueLine} from '../components/CueDrivenText';
import {ScreenFrame} from '../components/AnimatedShapes';
import {ImpactFlash, ShockRing} from '../components/SceneTransitions';
import {COLORS, CX, CY} from '../styles/designSystem';
import {lineAt, wordAt, triggerFrame} from '../animation/cueEngine';
import {TL} from '../animation/world';
import {clamp} from '../animation/frameMath';

/** EVENT 4 — "ቃሉን ስትናገሩ ስክሪኑ ይንቀሳቀሳል።" Every spoken word triggers its own reaction in the screen. */
export const ResponsiveScreenScene: React.FC = () => {
  const frame = useCurrentFrame();
  const line = lineAt(4);
  const next = lineAt(5);
  if (frame < line.startFrame - 10 || frame > TL.collapseEnd + 4) return null;
  const exitStart = line.endFrame + 2;
  const exitDur = clamp(next.startFrame - exitStart + 3, 8, 16);
  return (
    <AbsoluteFill>
      <ScreenFrame frame={frame} />
      <ShockRing frame={frame} start={triggerFrame(wordAt(4, 1))} cx={CX} cy={CY} maxR={620} color={COLORS.cyan} duration={26} width={2} />
      <ImpactFlash frame={frame} start={TL.screenWord} cx={CX} cy={CY} intensity={0.22} color={COLORS.gold} />
      <CueLine
        line={line}
        rows={[
          {words: [0, 1], x: CX, y: 150, size: 84, weight: 800},
          {words: [2, 3], x: CX, y: 930, size: 84, weight: 800},
        ]}
        enter={(wi) => (['rise', 'rise', 'scale', 'slide'] as const)[wi]}
        exit={{start: exitStart, duration: exitDur, scale: 0.92, blur: 10, stagger: 1}}
      />
    </AbsoluteFill>
  );
};
