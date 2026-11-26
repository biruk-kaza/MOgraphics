import {random} from 'remotion';

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** 0..1 progress of `frame` between integer frames a and b (clamped). */
export const progress = (frame: number, a: number, b: number) => clamp((frame - a) / Math.max(1e-6, b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const hash01 = (seed: string) => random(seed); // deterministic
export const hashRange = (seed: string, lo: number, hi: number) => lo + (hi - lo) * random(seed);
export const sign = (seed: string) => (random(seed) < 0.5 ? -1 : 1);
export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const secondsToFrame = (s: number, fps = 30) => Math.round(s * fps);
