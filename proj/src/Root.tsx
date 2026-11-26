import React from 'react';
import {Composition} from 'remotion';
import {MotionFilm} from './Composition';
import {cues} from './animation/cueEngine';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="FinalVideo"
    component={MotionFilm}
    durationInFrames={cues.totalFrames}
    fps={cues.fps}
    width={1920}
    height={1080}
  />
);
