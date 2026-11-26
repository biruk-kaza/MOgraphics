#!/usr/bin/env node
// Copies Noto Sans Ethiopic (SIL OFL) from the npm package into public/fonts so the video embeds it locally.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './lib/audio.mjs';

const WEIGHTS = [300, 400, 500, 700, 900];
const srcDir = path.join(ROOT, 'node_modules/@fontsource/noto-sans-ethiopic/files');
const outDir = path.join(ROOT, 'public/fonts');
fs.mkdirSync(outDir, {recursive: true});
if (!fs.existsSync(srcDir)) { console.error('Run "npm install" first (@fontsource/noto-sans-ethiopic missing).'); process.exit(1); }
const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.woff2') && /ethiopic/.test(f) && /-normal\.woff2$/.test(f));
let missing = [];
for (const w of WEIGHTS) {
  const f = files.find((n) => new RegExp(`-ethiopic-${w}-normal\\.woff2$`).test(n)) || files.find((n) => new RegExp(`-${w}-normal\\.woff2$`).test(n));
  if (!f) { missing.push(w); continue; }
  fs.copyFileSync(path.join(srcDir, f), path.join(outDir, `NotoSansEthiopic-${w}.woff2`));
  console.log(`font ${w}: ${f}`);
}
const lic = path.join(ROOT, 'node_modules/@fontsource/noto-sans-ethiopic/LICENSE');
if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(outDir, 'OFL-LICENSE.txt'));
if (missing.length) { console.error(`Missing font weights: ${missing.join(', ')}  (files found: ${files.join(', ')})`); process.exit(1); }
console.log('✓ fonts ready in public/fonts');
