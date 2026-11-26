import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {CueLine} from '../components/CueDrivenText';
import {COLORS, H, STAGE, W, rgba} from '../styles/designSystem';
import {lineAt, wordAt} from '../animation/cueEngine';
import {getWorld, TL} from '../animation/world';
import {clamp, lerp, progress} from '../animation/frameMath';
import {easeInOutCubic, easeOutBack, easeOutCubic} from '../animation/easing';

const AXIS_X = 300;
const ROW_Y = [372, 545, 707];

/** EVENT 3 — "ጥርት ያለ ቅርጽ፣ ትክክለኛ ጊዜ፣ ምንም ትርፍ ነገር የለም።" Clarity → snap → timing → removal. */
export const PrecisionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const line = lineAt(3);
  const next = lineAt(4);
  if (frame < TL.m2Start - 6 || frame > next.startFrame + 40) return null;
  const w = getWorld(frame);
  const exitStart = line.endFrame + 3;
  const exitDur = clamp(next.startFrame - exitStart + 3, 8, 16);
  const unnecessary = 1 - easeInOutCubic(progress(w.removal, 0, 0.7)); // helpers fade with "nothing unnecessary"
  const guides = 1 - w.guideFade;
  const sceneOut = 1 - progress(frame, exitStart, exitStart + exitDur);

  // ጥርት (clear): the alignment axis draws
  const axis = easeOutCubic(progress(frame, wordAt(3, 0).startFrame, wordAt(3, 0).startFrame + 16));
  // ትክክለኛ (precise): ruler ticks snap into place, left → right
  const tickP = progress(frame, TL.snap, TL.snap + 20);
  const ticks: React.ReactNode[] = [];
  const nTicks = 37;
  for (let i = 0; i < nTicks; i++) {
    const tp = easeOutCubic(clamp(tickP * 1.6 - (i / nTicks) * 0.6));
    if (tp <= 0) continue;
    const x = STAGE.x0 + ((STAGE.x1 - STAGE.x0) * i) / (nTicks - 1);
    const hgt = (i % 3 === 0 ? 26 : 13) * tp;
    ticks.push(<line key={i} x1={x} y1={STAGE.y0} x2={x} y2={STAGE.y0 + hgt} stroke={rgba(COLORS.cyan, 0.8)} strokeWidth={1.4} />);
  }
  // ጊዜ (timing): a gold playhead covers the bottom guide in exactly the duration of the spoken word
  const th = clamp((frame - TL.timeStart) / Math.max(1, TL.timeEnd - TL.timeStart));
  const headX = lerp(STAGE.x0, STAGE.x1, th);
  const headOn = frame >= TL.timeStart;
  // row markers flash as each row's first word is spoken
  const rowStarts = [wordAt(3, 0).startFrame, wordAt(3, 3).startFrame, wordAt(3, 5).startFrame];

  return (
    <AbsoluteFill style={{opacity: 1}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <g opacity={unnecessary * sceneOut}>
          <line x1={AXIS_X} y1={STAGE.y0} x2={AXIS_X} y2={STAGE.y0 + (STAGE.y1 - STAGE.y0) * axis} stroke={rgba(COLORS.cyan, 0.55)} strokeWidth={1.2} />
          {ticks}
          {rowStarts.map((rs, i) => {
            const p = easeOutBack(progress(frame, rs, rs + 10));
            if (p <= 0) return null;
            const s = 9 * p;
            return <rect key={i} x={AXIS_X - s / 2} y={ROW_Y[i] - s / 2} width={s} height={s} fill={COLORS.gold} transform={`rotate(45 ${AXIS_X} ${ROW_Y[i]})`} />;
          })}
        </g>
        {headOn && (
          <g opacity={guides}>
            <line x1={STAGE.x0} y1={STAGE.y1} x2={headX} y2={STAGE.y1} stroke={COLORS.gold} strokeWidth={4} />
            <rect x={headX - 9} y={STAGE.y1 - 9} width={18} height={18} fill={COLORS.gold} transform={`rotate(45 ${headX} ${STAGE.y1})`} opacity={1 - easeOutCubic(progress(frame, TL.timeEnd, TL.timeEnd + 10))} />
          </g>
        )}
      </svg>
      <CueLine
        line={line}
        rows={[
          {words: [0, 1, 2], x: AXIS_X, y: ROW_Y[0], size: 112, align: 'left', weight: 800},
          {words: [3, 4], x: AXIS_X, y: ROW_Y[1], size: 96, align: 'left', weight: 700},
          {words: [5, 6, 7, 8], x: AXIS_X, y: ROW_Y[2], size: 80, align: 'left', weight: 500},
        ]}
        enter={(wi) => (wi <= 2 ? 'rise' : 'snap')}
        opacityFn={(wi, f) => (wi <= 4 ? lerp(1, 0.5, easeInOutCubic(progress(f, TL.removalStart, TL.removalStart + 20))) : 1)}
        exit={{start: exitStart, duration: exitDur, dy: -26, blur: 8, stagger: 1}}
      />
    </AbsoluteFill>
  );
};
