import React from 'react';
import {random, useVideoConfig, spring} from 'remotion';
import {COLORS, rgba, mixColor, W, H, STAGE, STAGE_W, STAGE_H, FOCUS} from '../styles/designSystem';
import {clamp, lerp, progress} from '../animation/frameMath';
import {easeInOutCubic, easeOutCubic, easeOutExpo, easeInCubic} from '../animation/easing';
import {getWorld, TL, StructureState} from '../animation/world';
import {energyAt, wordAt, lineAt, getEmphasisState, triggerFrame} from '../animation/cueEngine';
import {SPRINGS} from '../animation/animationPresets';
import {N_CURVES, KEEPERS, morphCurve, curveToPath, localFlow, localOrder} from './SVGMorph';

// ------------------------------------------------------------------------------------------------
// LineField — the 23 curves that go chaos → flow → grid → four guide lines
// ------------------------------------------------------------------------------------------------
const PERM = Array.from({length: N_CURVES}, (_, i) => ({i, k: random(`perm-${i}`)})).sort((a, b) => a.k - b.k).map((x) => x.i);
const RANK = Array.from({length: N_CURVES}, (_, i) => PERM.indexOf(i) / (N_CURVES - 1));
const REMOVE_ORDER = Array.from({length: N_CURVES}, (_, i) => random(`rem-${i}`));
const BASE_W = Array.from({length: N_CURVES}, (_, i) => 1.1 + random(`bw-${i}`) * 1.6);
const BASE_OP = Array.from({length: N_CURVES}, (_, i) => 0.3 + random(`bo-${i}`) * 0.5);

export const LineDefs: React.FC = () => (
  <defs>
    <linearGradient id="lgA" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2={H}>
      <stop offset="0" stopColor={COLORS.cyan} /><stop offset="1" stopColor={COLORS.purple} />
    </linearGradient>
    <linearGradient id="lgB" gradientUnits="userSpaceOnUse" x1={W} y1="0" x2="0" y2={H}>
      <stop offset="0" stopColor={COLORS.purple} /><stop offset="1" stopColor={COLORS.cyan} />
    </linearGradient>
    <linearGradient id="lgW" gradientUnits="userSpaceOnUse" x1="0" y1={H} x2={W} y2="0">
      <stop offset="0" stopColor="#9FB4FF" /><stop offset="1" stopColor={COLORS.white} />
    </linearGradient>
    <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9" /></filter>
  </defs>
);

export const LineField: React.FC<{frame: number; glow?: boolean}> = ({frame, glow = true}) => {
  const w = getWorld(frame);
  const items: {d: string; sw: number; op: number; stroke: string; off: number; gold: number; key: number}[] = [];
  for (let i = 0; i < N_CURVES; i++) {
    const t0 = 2 + (TL.l1End - 12) * (1 - Math.pow(1 - RANK[i], 1.7));
    const draw = easeOutCubic(progress(frame, t0, t0 + 18));
    if (draw <= 0.002) continue;
    const a = localFlow(i, w.p1);
    const b = localOrder(i, w.p2);
    const keeper = KEEPERS.has(i);
    const curve = morphCurve(i, frame, w.p1, w.p2, w.intensity);
    const rho = keeper ? 0 : easeInOutCubic(clamp(w.removal * 1.6 - 0.6 * REMOVE_ORDER[i]));
    let op = lerp(lerp(BASE_OP[i], 0.85, a), keeper ? 0.95 : 0.3, b);
    op *= 1 - rho;
    if (keeper) op *= 1 - w.guideFade;
    if (op <= 0.01) continue;
    const sw = lerp(lerp(BASE_W[i], 2.0, a), keeper ? 2.4 : 1.2, b);
    items.push({
      d: curveToPath(curve), sw, op,
      stroke: `url(#${['lgA', 'lgB', 'lgW'][i % 3]})`,
      off: 1 - draw - rho,
      gold: keeper ? easeInOutCubic(progress(w.removal, 0, 0.6)) : 0,
      key: i,
    });
  }
  const glowOp = easeInOutCubic(w.p1) * (1 - easeInOutCubic(w.p2)) * 0.55;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
      <LineDefs />
      {glow && glowOp > 0.02 && (
        <g filter="url(#softGlow)" opacity={glowOp}>
          {items.map((it) => <path key={it.key} d={it.d} fill="none" stroke={it.stroke} strokeWidth={it.sw * 2.4} pathLength={1} strokeDasharray="1 1" strokeDashoffset={it.off} opacity={it.op} />)}
        </g>
      )}
      {items.map((it) => (
        <g key={it.key}>
          <path d={it.d} fill="none" stroke={it.stroke} strokeWidth={it.sw} pathLength={1} strokeDasharray="1 1" strokeDashoffset={it.off} opacity={it.op * (1 - it.gold)} />
          {it.gold > 0.01 && <path d={it.d} fill="none" stroke={COLORS.gold} strokeWidth={it.sw} pathLength={1} strokeDasharray="1 1" strokeDashoffset={it.off} opacity={it.op * it.gold} />}
        </g>
      ))}
      {/* convergence glow where the beam gathers */}
      {w.p1 > 0 && (() => {
        const g = easeInOutCubic(w.p1) * (1 - easeInOutCubic(w.p2)) * 0.9;
        return g > 0.02 ? <circle cx={FOCUS.x + 120} cy={FOCUS.y} r={260} fill={rgba(COLORS.cyan, 0.16 * g)} /> : null;
      })()}
    </svg>
  );
};

// ------------------------------------------------------------------------------------------------
// ChaosShapes — small geometry that crowds the screen in Event 1 and is pulled into the beam in Event 2
// ------------------------------------------------------------------------------------------------
const SHAPES = Array.from({length: 40}, (_, i) => {
  const r = (k: string) => random(`cs-${i}-${k}`);
  return {
    type: Math.floor(r('t') * 5), x: 140 + r('x') * (W - 280), y: 100 + r('y') * (H - 200),
    size: 12 + r('s') * 34, rot: r('r') * 360, rs: (r('rs') - 0.5) * 2.2, orbit: 24 + r('o') * 110,
    ow: 0.02 + r('w') * 0.05, ph: r('p') * 6.28, rank: r('k'), color: i % 3,
  };
});

export const ChaosShapes: React.FC<{frame: number}> = ({frame}) => {
  const w = getWorld(frame);
  if (w.p1 >= 1) return null;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {SHAPES.map((s, i) => {
        const t0 = 4 + (TL.l1End - 16) * (1 - Math.pow(1 - s.rank, 1.8));
        const sc = Math.max(0, easeOutCubic(progress(frame, t0, t0 + 14)));
        if (sc <= 0.01) return null;
        const pull = easeInCubic(clamp(w.p1 * 1.4 - 0.4 * s.rank));
        const ox = s.x + Math.cos(frame * s.ow + s.ph) * s.orbit * (1 - pull) * (0.4 + w.intensity);
        const oy = s.y + Math.sin(frame * s.ow * 1.3 + s.ph) * s.orbit * 0.7 * (1 - pull) * (0.4 + w.intensity);
        const x = lerp(ox, FOCUS.x + 200, pull), y = lerp(oy, FOCUS.y, pull);
        const scale = sc * (1 - pull) * (0.7 + 0.5 * w.intensity);
        const col = [COLORS.cyan, COLORS.purple, COLORS.white][s.color];
        const rot = s.rot + frame * s.rs;
        const sz = s.size;
        let shape: React.ReactNode;
        if (s.type === 0) shape = <circle r={sz} fill="none" stroke={col} strokeWidth={1.6} />;
        else if (s.type === 1) shape = <g stroke={col} strokeWidth={1.8}><line x1={-sz} y1={0} x2={sz} y2={0} /><line x1={0} y1={-sz} x2={0} y2={sz} /></g>;
        else if (s.type === 2) shape = <polygon points={`0,${-sz} ${sz * 0.9},${sz * 0.7} ${-sz * 0.9},${sz * 0.7}`} fill="none" stroke={col} strokeWidth={1.6} />;
        else if (s.type === 3) shape = <rect x={-sz * 0.8} y={-sz * 0.8} width={sz * 1.6} height={sz * 1.6} fill="none" stroke={col} strokeWidth={1.6} />;
        else shape = <circle r={sz} fill="none" stroke={col} strokeWidth={2} strokeDasharray={`${sz * 0.9} ${sz * 0.5}`} />;
        return (
          <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${scale.toFixed(3)})`} opacity={0.55 * (1 - pull)}>
            {shape}
          </g>
        );
      })}
    </svg>
  );
};

// ------------------------------------------------------------------------------------------------
// ScreenFrame — Event 4: the stage becomes a "screen" that reacts to each spoken word
// ------------------------------------------------------------------------------------------------
const NB = 51;
const XK = [0.16, 0.38, 0.62, 0.86];
const AMP = [0.85, 0.8, 1.0, 1.15];

export const ScreenFrame: React.FC<{frame: number}> = ({frame}) => {
  const {fps} = useVideoConfig();
  const l4 = lineAt(4);
  const start = l4.startFrame - 8;
  if (frame < start || frame > TL.collapseEnd + 2) return null;
  const words = [0, 1, 2, 3].map((k) => wordAt(4, k));
  const trig = words.map(triggerFrame);
  const intro = progress(frame, start, l4.startFrame);
  const sp = STAGE_W / (NB + 1);
  const cx = STAGE_W / 2, cy = STAGE_H / 2;
  const e = energyAt(frame);

  // bars driven by word-triggered impulses (semantic), lightly modulated by real loudness
  const bars: React.ReactNode[] = [];
  for (let b = 0; b < NB; b++) {
    const x = (b + 1) * sp;
    const dc = Math.abs(x - cx);
    const introB = easeOutCubic(clamp(intro * 2.2 - (dc / STAGE_W) * 1.2));
    let h = 3 * introB;
    for (let k = 0; k < 4; k++) {
      const t = frame - trig[k];
      if (t < 0) continue;
      const d = Math.abs(x - XK[k] * STAGE_W);
      h += AMP[k] * 300 * Math.exp(-Math.pow(d / 170, 2)) * Math.exp(-t / 16) * (0.55 + 0.45 * Math.cos(t * 0.55 - d * 0.03));
    }
    h *= 1 + 0.35 * e;
    h = Math.min(h, 560);
    const hot = clamp(h / 240);
    bars.push(<rect key={b} x={x - 1.6} y={cy - h / 2} width={3.2} height={Math.max(1, h)} rx={1.6} fill={mixColor(COLORS.cyan, COLORS.purple, hot)} opacity={0.35 + 0.65 * Math.max(introB, hot)} />);
  }

  // rings on "ስትናገሩ" (you speak)
  const tr = frame - trig[1];
  const rings = [0, 7].map((delay, i) => {
    const t = tr - delay;
    if (t < 0 || t > 46) return null;
    const p = t / 46;
    return <circle key={i} cx={cx} cy={cy} r={20 + easeOutExpo(p) * 520} fill="none" stroke={rgba(COLORS.cyan, 0.7 * (1 - p))} strokeWidth={2.4 * (1 - p) + 0.6} />;
  });

  // needle on "ቃሉን" (the word)
  const tn = frame - trig[0];
  const needleH = tn >= 0 ? 560 * easeOutExpo(progress(tn, 0, 10)) : 0;
  const needleOp = tn >= 0 ? Math.exp(-tn / 26) : 0;

  // corners + panel on "ስክሪኑ" (the screen)
  const cornerP = easeOutExpo(progress(frame, TL.screenWord - 1, TL.screenWord + 12));
  const L = 70 * cornerP;
  const panelOp = easeInOutCubic(progress(frame, TL.screenWord - 1, TL.screenWord + 16));
  const corner = (x: number, y: number, sx: number, sy: number) => `M${x} ${y + sy * L}L${x} ${y}L${x + sx * L} ${y}`;

  // movement on "ይንቀሳቀሳል" (the screen moves) – spring, settles in a tilted state
  const mv = frame >= TL.moveWord ? spring({frame: frame - TL.moveWord, fps, config: SPRINGS.settle}) : 0;
  const c = easeInOutCubic(progress(frame, TL.collapseStart, TL.collapseEnd));
  const tx = lerp(62 * mv, 280, c);
  const ry = -10 * mv * (1 - c);
  const rx = 4 * mv * (1 - c);
  const rz = 45 * c;
  const sc = (1 + 0.035 * mv) * (1 - 0.965 * c);
  const op = 1 - Math.pow(c, 3);

  const emph = getEmphasisState(frame, words[2]).pulse;
  return (
    <div
      style={{
        position: 'absolute', left: STAGE.x0, top: STAGE.y0, width: STAGE_W, height: STAGE_H,
        transform: `perspective(1800px) translateX(${tx.toFixed(2)}px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${sc.toFixed(4)})`,
        transformOrigin: '50% 50%', opacity: op, pointerEvents: 'none',
      }}
    >
      <div style={{position: 'absolute', inset: 0, opacity: panelOp, background: `linear-gradient(180deg, ${rgba(COLORS.white, 0.05)}, ${rgba(COLORS.purple, 0.06)} 60%, ${rgba(COLORS.cyan, 0.04)})`, boxShadow: `inset 0 0 0 1px ${rgba(COLORS.gold, 0.35 + 0.3 * emph)}, 0 30px 80px ${rgba('#000000', 0.45)}`}} />
      <svg width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <line x1={cx - cx * easeOutCubic(intro)} y1={cy} x2={cx + cx * easeOutCubic(intro)} y2={cy} stroke={rgba(COLORS.cyan, 0.45)} strokeWidth={1.2} />
        {rings}
        {needleH > 1 && <rect x={XK[0] * STAGE_W - 1} y={cy - needleH / 2} width={2} height={needleH} fill={rgba(COLORS.gold, 0.9 * needleOp)} />}
        {bars}
        <g fill="none" stroke={COLORS.gold} strokeWidth={3.4} strokeLinecap="square" opacity={cornerP > 0 ? 1 : 0}>
          <path d={corner(0, 0, 1, 1)} />
          <path d={corner(STAGE_W, 0, -1, 1)} />
          <path d={corner(0, STAGE_H, 1, -1)} />
          <path d={corner(STAGE_W, STAGE_H, -1, -1)} />
        </g>
      </svg>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// GrowthStructure — Event 5/6: a tiny gold seed grows into nested, rotating geometry, then settles
// ------------------------------------------------------------------------------------------------
const K = 12;
const RAYS = 24;

export const GrowthStructure: React.FC<{frame: number; st: StructureState}> = ({frame, st}) => {
  if (!st.visible) return null;
  const g = st.growth;
  const pulse = getEmphasisState(frame, wordAt(5, 1), 14).pulse;
  const tilt = lerp(58, 16, g) * (1 - st.settle);
  const tilt2 = lerp(-22, -8, g) * (1 - st.settle);
  const layers: React.ReactNode[] = [];
  for (let k = 0; k < K; k++) {
    const t = (k + 1) / K;
    const lg = clamp(g * 1.9 - 0.9 * t);
    if (lg <= 0.001) continue;
    const half = st.sizeMax * t * easeOutExpo(lg);
    const dir = k % 2 ? 1 : -1;
    const rot = k * (6.5 - 3.5 * st.settle) + frame * 0.05 * dir * (1 - st.settle);
    const col = t < 0.6 ? mixColor(COLORS.cyan, COLORS.purple, t / 0.6) : mixColor(COLORS.purple, COLORS.gold, (t - 0.6) / 0.4);
    layers.push(
      <rect key={k} x={-half} y={-half} width={half * 2} height={half * 2} rx={half * 0.16} fill="none" stroke={col} strokeWidth={1.4 + 1.6 * t} opacity={0.9 * lg * (0.45 + 0.55 * t)} transform={`rotate(${rot.toFixed(2)})`} />,
    );
  }
  const rays: React.ReactNode[] = [];
  if (g > 0.02) {
    for (let i = 0; i < RAYS; i++) {
      const a = (i / RAYS) * Math.PI * 2 + (frame * 0.004) * (1 - st.settle);
      const r0 = st.sizeMax * 0.14, r1 = st.sizeMax * (0.14 + 0.95 * easeOutExpo(clamp(g * 1.3 - 0.3 * ((i % 4) / 4))));
      rays.push(<line key={i} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * r1} y2={Math.sin(a) * r1} stroke={rgba(COLORS.white, 0.22 * g)} strokeWidth={1} />);
    }
  }
  const seedSize = 17 * st.seed * (1 + 0.5 * pulse);
  const glowR = 46 + 260 * g;
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: st.opacity, transformOrigin: `${st.cx}px ${st.cy}px`, transform: `perspective(1600px) rotateX(${tilt.toFixed(2)}deg) rotateY(${tilt2.toFixed(2)}deg)`}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id="coreGlow"><stop offset="0" stopColor={COLORS.gold} stopOpacity="0.55" /><stop offset="0.45" stopColor={COLORS.purple} stopOpacity="0.16" /><stop offset="1" stopColor={COLORS.purple} stopOpacity="0" /></radialGradient>
        </defs>
        <g transform={`translate(${st.cx.toFixed(1)} ${st.cy.toFixed(1)})`}>
          <circle r={glowR} fill="url(#coreGlow)" opacity={0.5 + 0.3 * pulse + 0.15 * energyAt(frame)} />
          {rays}
          {layers}
          <rect x={-seedSize} y={-seedSize} width={seedSize * 2} height={seedSize * 2} rx={seedSize * 0.2} fill={COLORS.gold} transform="rotate(45)" />
          <rect x={-seedSize * 0.45} y={-seedSize * 0.45} width={seedSize * 0.9} height={seedSize * 0.9} rx={2} fill={COLORS.white} transform="rotate(45)" />
        </g>
      </svg>
    </div>
  );
};
