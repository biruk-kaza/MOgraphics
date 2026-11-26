/**
 * The "living world": every global state variable is derived from the cue sheet + the current frame.
 * Nothing here knows about wall-clock time or randomness that changes between renders.
 */
import {cues, wordAt, lineAt, bump} from './cueEngine';
import {clamp, lerp, progress} from './frameMath';
import {easeInOutCubic, easeInOutQuart, easeOutBack, easeOutExpo} from './easing';

const L = (n: number) => lineAt(n);
const Wd = (l: number, w: number) => wordAt(l, w);

// ---- Anchors taken from the cue sheet --------------------------------------------------------
const pivot = Wd(2, 1).startFrame; // "ግን" — the turn
const pivotEnd = Wd(2, 2).endFrame; // end of "አቅጣጫውን"
const m1Start = pivot - 3;
const m1End = m1Start + clamp(pivotEnd - pivot + 10, 30, 46);
const m2Start = L(3).startFrame - 4;
const m2End = Math.max(Wd(3, 2).endFrame, m2Start + 30);
const removalStart = Wd(3, 5).startFrame; // "ምንም"
const removalEnd = Math.max(Wd(3, 8).endFrame, removalStart + 40);
const screenWord = Wd(4, 2).startFrame; // "ስክሪኑ"
const moveWord = Wd(4, 3).startFrame; // "ይንቀሳቀሳል"
const collapseStart = L(4).endFrame + 2;
const collapseEnd = Math.max(collapseStart + 14, Wd(5, 0).startFrame + 4);
const growStart = Wd(5, 2).startFrame - 4; // "ትልቅ"
const growEnd = Math.max(Wd(5, 3).endFrame + 12, growStart + 40);
const finalStart = L(6).startFrame;

export const TL = {
  total: cues.totalFrames,
  l1Start: L(1).startFrame, l1End: L(1).endFrame,
  pivot, pivotEnd, m1Start, m1End, m2Start, m2End,
  snap: Wd(3, 3).startFrame, timeStart: Wd(3, 4).startFrame, timeEnd: Wd(3, 4).endFrame,
  removalStart, removalEnd,
  screenWord, moveWord, collapseStart, collapseEnd,
  seedStart: collapseEnd - 6, growStart, growEnd,
  relocStart: finalStart - 16, finalStart,
};

export interface World {
  p1: number; // chaos → flow (raw 0..1)
  p2: number; // flow → order (raw 0..1)
  removal: number; // 0..1 "nothing unnecessary"
  intensity: number; // visual tension 0..1
  guideFade: number; // keeper guide lines handing over to the screen frame
}

export function getWorld(frame: number): World {
  const p1 = progress(frame, TL.m1Start, TL.m1End);
  const p2 = progress(frame, TL.m2Start, TL.m2End);
  const removal = progress(frame, TL.removalStart, TL.removalEnd);
  const build = Math.pow(progress(frame, 0, TL.l1End), 1.4);
  const intensity = clamp((0.12 + 0.88 * build) * (1 - easeInOutCubic(p1)));
  const guideFade = easeInOutCubic(progress(frame, TL.screenWord - 2, TL.screenWord + 8));
  return {p1, p2, removal, intensity, guideFade};
}

export interface CameraState { x: number; y: number; scale: number; rot: number }

export function getCamera(frame: number): CameraState {
  const w = getWorld(frame);
  let x = Math.sin(frame / 83) * 10;
  let y = Math.cos(frame / 101) * 6;
  let scale = 1.02 + 0.012 * Math.sin(frame / 140);
  let rot = 0;
  // tension shake while complexity builds (deterministic, tiny)
  const shake = Math.pow(w.intensity, 3) * 5;
  x += Math.sin(frame * 1.9) * shake;
  y += Math.cos(frame * 2.3) * shake;
  // the turn: a directional push
  const push = bump(frame, TL.m1Start, 8, 46);
  scale += 0.05 * push;
  x -= 56 * push;
  rot -= 0.5 * push;
  // the screen moves
  const move = bump(frame, TL.moveWord, 10, 38);
  x += 64 * move;
  rot += 0.6 * move;
  // slow push-in during the growth, relax in the final
  const grow = easeInOutCubic(progress(frame, TL.seedStart, TL.growEnd));
  const relax = easeInOutCubic(progress(frame, TL.relocStart, TL.finalStart + 30));
  scale += 0.05 * grow * (1 - relax);
  x *= 1 - 0.6 * relax;
  return {x, y, scale, rot};
}

export interface StructureState {
  visible: boolean;
  cx: number; cy: number;
  seed: number; // 0..1 seed presence
  growth: number; // 0..1
  sizeMax: number;
  settle: number; // 0..1 rotational settle for the balanced final
  opacity: number;
}

export function getStructure(frame: number): StructureState {
  const seed = easeOutBack(progress(frame, TL.seedStart, TL.seedStart + 14));
  const growth = easeInOutQuart(progress(frame, TL.growStart, TL.growEnd));
  const reloc = easeInOutCubic(progress(frame, TL.relocStart, TL.relocStart + 30));
  const settle = easeInOutCubic(progress(frame, TL.relocStart, TL.relocStart + 44));
  const fade = easeInOutCubic(progress(frame, TL.finalStart - 4, TL.finalStart + 20));
  return {
    visible: frame >= TL.seedStart - 2,
    cx: lerp(1240, 960, reloc),
    cy: 540,
    seed,
    growth,
    sizeMax: lerp(300, 340, reloc),
    settle,
    opacity: lerp(1, 0.55, fade),
  };
}

export { easeOutExpo };
