#!/usr/bin/env node
// Bundles once and renders QC stills at every line/word-critical frame -> output/stills/*.png
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ROOT} from './lib/audio.mjs';
const require = createRequire(import.meta.url);
const {bundle} = require('@remotion/bundler');
const {renderStill, selectComposition} = require('@remotion/renderer');

const sheet = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/voiceover-cues.json'), 'utf8'));
const frames = new Map();
const add = (f, label) => { f = Math.max(0, Math.min(sheet.totalFrames - 1, Math.round(f))); if (!frames.has(f)) frames.set(f, label); };
add(0, 'first');
sheet.lines.forEach((l) => {
  add(l.startFrame + 4, `L${l.index}-start`);
  add((l.startFrame + l.endFrame) / 2, `L${l.index}-mid`);
  add(l.endFrame - 1, `L${l.index}-end`);
  l.words.forEach((w, i) => { if (w.emphasis === 'major') add(w.peakFrame + 3, `L${l.index}-w${i}-peak`); });
});
add(sheet.totalFrames - 1, 'last');

const outDir = path.join(ROOT, 'output/stills');
fs.mkdirSync(outDir, {recursive: true});
console.log('Bundling…');
const serveUrl = await bundle({entryPoint: path.join(ROOT, 'src/index.ts')});
const composition = await selectComposition({serveUrl, id: 'FinalVideo'});
let n = 0;
for (const [frame, label] of [...frames.entries()].sort((a, b) => a[0] - b[0])) {
  const output = path.join(outDir, `f${String(frame).padStart(4, '0')}-${label}.png`);
  await renderStill({composition, serveUrl, output, frame, imageFormat: 'png'});
  n++;
}
console.log(`✓ ${n} stills in output/stills`);
