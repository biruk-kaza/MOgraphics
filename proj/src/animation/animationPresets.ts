import {SpringConfig} from 'remotion';

export const SPRINGS: Record<string, Partial<SpringConfig>> = {
  settle: {damping: 18, stiffness: 140, mass: 0.9},
  snap: {damping: 26, stiffness: 260, mass: 0.7},
  heavy: {damping: 22, stiffness: 90, mass: 1.4},
  bouncy: {damping: 11, stiffness: 160, mass: 0.8},
};

export const DURATIONS = {
  wordEnter: 12,
  lineExit: 14,
  snap: 9,
};
