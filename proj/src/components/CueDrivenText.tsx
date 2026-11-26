import React from 'react';
import {useCurrentFrame} from 'remotion';
import {LineCue} from '../animation/cueEngine';
import {CueWord, EnterKind, ExitSpec} from './KineticTypography';

export interface RowSpec {
  words: number[]; // indices into line.words
  x: number;
  y: number;
  size: number;
  weight?: number;
  align?: 'left' | 'center' | 'right';
  gap?: number;
}

export interface CueLineProps {
  line: LineCue;
  rows: RowSpec[];
  enter?: EnterKind | ((wordIndex: number) => EnterKind);
  exit?: ExitSpec;
  opacityFn?: (wordIndex: number, frame: number) => number;
  ghostFn?: (wordIndex: number, frame: number) => number;
  offsetFn?: (wordIndex: number, frame: number) => [number, number];
  baseColor?: string;
}

/** Lays a cue line out in explicit rows; words are placed whole and revealed on their own cues. */
export const CueLine: React.FC<CueLineProps> = ({line, rows, enter = 'rise', exit, opacityFn, ghostFn, offsetFn, baseColor}) => {
  const frame = useCurrentFrame();
  if (frame < line.startFrame - 4) return null;
  if (exit && frame > exit.start + exit.duration + (exit.stagger ?? 0) * line.words.length + 2) return null;
  return (
    <>
      {rows.map((row, ri) => {
        const align = row.align ?? 'center';
        const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';
        return (
          <div key={ri} style={{position: 'absolute', left: row.x, top: row.y, transform: `translate(${tx}, -50%)`, display: 'flex', alignItems: 'center', gap: row.gap ?? row.size * 0.32, whiteSpace: 'nowrap'}}>
            {row.words.map((wi) => (
              <CueWord
                key={wi}
                word={line.words[wi]}
                index={wi}
                size={row.size}
                weight={row.weight ?? 800}
                enter={typeof enter === 'function' ? enter(wi) : enter}
                exit={exit}
                opacity={opacityFn ? opacityFn(wi, frame) : 1}
                ghost={ghostFn ? ghostFn(wi, frame) : 0}
                offset={offsetFn ? offsetFn(wi, frame) : undefined}
                baseColor={baseColor}
                seed={`L${line.index}W${wi}`}
              />
            ))}
          </div>
        );
      })}
    </>
  );
};
