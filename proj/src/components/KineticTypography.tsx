import React, {CSSProperties} from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS, FONT, mixColor, rgba} from '../styles/designSystem';
import {clamp, progress, hashRange} from '../animation/frameMath';
import {easeInCubic, easeOutCubic, easeOutExpo} from '../animation/easing';
import {WordCue, getEmphasisState} from '../animation/cueEngine';
import {DURATIONS} from '../animation/animationPresets';

export type EnterKind = 'rise' | 'snap' | 'scale' | 'slide';
export interface ExitSpec {
  start: number;
  duration: number;
  dx?: number;
  dy?: number;
  scale?: number;
  blur?: number;
  stagger?: number;
}

export interface CueWordProps {
  word: WordCue;
  index: number;
  size: number;
  weight: number;
  enter: EnterKind;
  exit?: ExitSpec;
  opacity?: number;
  ghost?: number;
  offset?: [number, number];
  baseColor?: string;
  seed: string;
}

/**
 * One whole word (never split into Fidel characters). Reveal + highlight are driven only by the
 * word's own startFrame/endFrame/peakFrame from the cue sheet.
 */
export const CueWord: React.FC<CueWordProps> = ({word, index, size, weight, enter, exit, opacity = 1, ghost = 0, offset, baseColor = COLORS.white, seed}) => {
  const frame = useCurrentFrame();
  const lead = 1;
  const t0 = word.startFrame - lead;
  const a = easeOutCubic(progress(frame, t0, t0 + DURATIONS.wordEnter));
  const s = easeOutExpo(progress(frame, t0, t0 + DURATIONS.snap));
  const major = word.emphasis === 'major';
  const em = getEmphasisState(frame, word);

  const inAct = progress(frame, word.startFrame, word.startFrame + 3);
  const outAct = frame < word.endFrame ? 1 : 1 - progress(frame, word.endFrame, word.endFrame + 10);
  const act = inAct * outAct;
  const accent = major ? COLORS.gold : COLORS.cyan;
  const settled = major ? mixColor(baseColor, COLORS.gold, 0.28) : baseColor;
  const color = mixColor(settled, accent, act * 0.85);
  const glow = act * 16 + em.pulse * 28;

  let ex = 0;
  if (exit) {
    const st = exit.start + index * (exit.stagger ?? 0);
    ex = easeInCubic(progress(frame, st, st + exit.duration));
  }
  if (ex >= 0.999) return <span style={{display: 'inline-block', opacity: 0}} />;

  let entryTransform = '';
  let entryOpacity = 1;
  if (enter === 'rise') entryTransform = `translateY(${((1 - a) * 112).toFixed(2)}%)`;
  else if (enter === 'slide') { entryTransform = `translateX(${(-(1 - a) * 90).toFixed(2)}px)`; entryOpacity = clamp(a * 2.5); }
  else if (enter === 'scale') { entryTransform = `scale(${(1.45 - 0.45 * a).toFixed(3)})`; entryOpacity = clamp(a * 2.5); }
  else {
    const ox = hashRange(`${seed}-ox`, -70, 70), oy = hashRange(`${seed}-oy`, -50, 50), rot = hashRange(`${seed}-r`, -7, 7);
    entryTransform = `translate(${(ox * (1 - s)).toFixed(2)}px, ${(oy * (1 - s)).toFixed(2)}px) rotate(${(rot * (1 - s)).toFixed(2)}deg)`;
    entryOpacity = clamp(s * 3);
  }
  if (frame < t0) entryOpacity = 0;

  const [offX, offY] = offset ?? [0, 0];
  const wrapT = `translate(${((exit?.dx ?? 0) * ex + offX).toFixed(2)}px, ${((exit?.dy ?? 0) * ex + offY).toFixed(2)}px) scale(${(1 + em.pulse * (major ? 0.07 : 0.03) + ((exit?.scale ?? 1) - 1) * ex).toFixed(4)})`;

  const textStyle: CSSProperties = {
    display: 'inline-block', position: 'relative', whiteSpace: 'nowrap',
    fontFamily: `'${FONT.family}', sans-serif`, fontWeight: weight, fontSize: size, color,
    transform: entryTransform, opacity: entryOpacity,
    textShadow: `0 0 ${glow.toFixed(1)}px ${rgba(accent, 0.7)}, 0 4px 28px ${rgba('#03050F', 0.75)}`,
  };

  const ghosts: React.ReactNode[] = [];
  if (ghost > 0.5 && a > 0.2) {
    const cols = [COLORS.cyan, COLORS.purple, COLORS.gold];
    for (let k = 0; k < 3; k++) {
      const ph = hashRange(`${seed}-g${k}`, 0, 6.28);
      ghosts.push(
        <span key={k} aria-hidden style={{position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', color: 'transparent', WebkitTextStroke: `1.5px ${rgba(cols[k], 0.7)}`, textShadow: 'none',
          transform: `translate(${(Math.cos(frame * 0.21 + k * 2.1 + ph) * ghost * (1 + k * 0.5)).toFixed(1)}px, ${(Math.sin(frame * 0.17 + k * 1.7 + ph) * ghost * 0.7).toFixed(1)}px)`}}>
          {word.text}
        </span>,
      );
    }
  }

  return (
    <span style={{display: 'inline-block', position: 'relative', opacity: opacity * (1 - ex), transform: wrapT, transformOrigin: '50% 60%', filter: exit?.blur && ex > 0.01 ? `blur(${(exit.blur * ex).toFixed(1)}px)` : undefined}}>
      <span style={{display: 'inline-block', overflow: enter === 'rise' && a < 0.999 ? 'hidden' : 'visible', padding: '0.1em 0.06em 0.22em', margin: '-0.1em -0.06em -0.22em', lineHeight: 1.25}}>
        <span style={textStyle}>
          {ghosts}
          {word.text}
        </span>
      </span>
    </span>
  );
};
