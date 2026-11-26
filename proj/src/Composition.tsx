import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, cancelRender, continueRender, delayRender, staticFile, useCurrentFrame} from 'remotion';
import {COLORS, FONT} from './styles/designSystem';
import {cues} from './animation/cueEngine';
import {getCamera, getWorld} from './animation/world';
import {ParallaxLayers, Vignette} from './components/ParallaxLayers';
import {LineField} from './components/AnimatedShapes';
import {ParticleSystem} from './components/ParticleSystem';
import {MotionBlur} from './components/MotionBlur';
import {ComplexityScene} from './scenes/ComplexityScene';
import {DirectionScene} from './scenes/DirectionScene';
import {PrecisionScene} from './scenes/PrecisionScene';
import {ResponsiveScreenScene} from './scenes/ResponsiveScreenScene';
import {BigResultScene} from './scenes/BigResultScene';
import {FinalScene} from './scenes/FinalScene';

/** Blocks rendering until the locally embedded Noto Sans Ethiopic faces are loaded. */
const FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [handle] = useState(() => delayRender('Loading Noto Sans Ethiopic'));
  useEffect(() => {
    const faces = FONT.weights.map((wt) => new FontFace(FONT.family, `url(${staticFile(FONT.file(wt))}) format('woff2')`, {weight: String(wt)}));
    Promise.all(faces.map((f) => f.load()))
      .then((loaded) => {
        loaded.forEach((f) => document.fonts.add(f));
        return document.fonts.ready;
      })
      .then(() => continueRender(handle))
      .catch((e) => cancelRender(new Error(`Font load failed (run "npm run prepare:fonts"): ${e}`)));
  }, [handle]);
  return <>{children}</>;
};

export const MotionFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = getCamera(frame);
  const w = getWorld(frame);
  const morphing = (w.p1 > 0 && w.p1 < 1) || (w.p2 > 0 && w.p2 < 1);
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.midnight}}>
      <FontGate>
        {cues.audioFile ? <Audio src={staticFile(cues.audioFile)} /> : null}
        <ParallaxLayers frame={frame} camera={cam} />
        <div style={{position: 'absolute', inset: 0, transformOrigin: '50% 50%', transform: `translate(${cam.x.toFixed(2)}px, ${cam.y.toFixed(2)}px) rotate(${cam.rot.toFixed(3)}deg) scale(${cam.scale.toFixed(4)})`}}>
          <LineField frame={frame} />
          <MotionBlur active={morphing} frame={frame} render={(f) => <LineField frame={f} glow={false} />} />
          <ParticleSystem frame={frame} />
          <ComplexityScene />
          <DirectionScene />
          <PrecisionScene />
          <ResponsiveScreenScene />
          <BigResultScene />
          <FinalScene />
        </div>
        <Vignette />
      </FontGate>
    </AbsoluteFill>
  );
};
