import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {CueLine} from '../components/CueDrivenText';
import {GrowthStructure} from '../components/AnimatedShapes';
import {ImpactFlash, ShockRing} from '../components/SceneTransitions';
import {LightSweep} from '../components/LightSweep';
import {COLORS} from '../styles/designSystem';
import {lineAt, wordAt, triggerFrame} from '../animation/cueEngine';
import {getStructure, TL} from '../animation/world';
import {clamp} from '../animation/frameMath';

/** EVENT 5 — "ቀላል ሀሳብ፣ ትልቅ ውጤት።" A gold seed becomes nested geometry. (Also hosts the structure through the finale.) */
export const BigResultScene: React.FC = () => {
  const frame = useCurrentFrame();
  const st = getStructure(frame);
  const line = lineAt(5);
  const next = lineAt(6);
  const exitStart = line.endFrame + 3;
  const exitDur = clamp(next.startFrame - exitStart + 3, 8, 16);
  const big = wordAt(5, 3);
  return (
    <AbsoluteFill>
      <GrowthStructure frame={frame} st={st} />
      <ShockRing frame={frame} start={triggerFrame(big)} cx={st.cx} cy={st.cy} maxR={900} color={COLORS.gold} duration={34} width={3} />
      <ImpactFlash frame={frame} start={triggerFrame(big)} cx={st.cx} cy={st.cy} intensity={0.35} color={COLORS.gold} />
      <LightSweep frame={frame} start={wordAt(5, 2).startFrame} duration={30} color={COLORS.purple} angle={-14} width={260} intensity={0.35} />
      <CueLine
        line={line}
        rows={[
          {words: [0, 1], x: 140, y: 300, size: 84, align: 'left', weight: 700},
          {words: [2], x: 140, y: 520, size: 150, align: 'left', weight: 900},
          {words: [3], x: 140, y: 710, size: 150, align: 'left', weight: 900},
        ]}
        enter={(wi) => (wi < 2 ? 'rise' : 'scale')}
        exit={{start: exitStart, duration: exitDur, dx: -70, blur: 10, stagger: 1}}
      />
    </AbsoluteFill>
  );
};
