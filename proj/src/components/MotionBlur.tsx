import React from 'react';

/**
 * Deterministic "motion blur": re-renders `render` at earlier sub-frame times and stacks the
 * results with falling opacity. Only active while something is moving fast.
 */
export const MotionBlur: React.FC<{
  active: boolean;
  frame: number;
  render: (frame: number) => React.ReactNode;
  samples?: number;
  step?: number;
  opacity?: number;
}> = ({active, frame, render, samples = 3, step = 0.9, opacity = 0.32}) => {
  if (!active) return null;
  return (
    <>
      {Array.from({length: samples}).map((_, k) => (
        <div key={k} style={{position: 'absolute', inset: 0, opacity: opacity * (1 - k / (samples + 0.5)), pointerEvents: 'none'}}>
          {render(frame - (k + 1) * step)}
        </div>
      ))}
    </>
  );
};
