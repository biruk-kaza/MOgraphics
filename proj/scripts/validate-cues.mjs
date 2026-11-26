#!/usr/bin/env node
// Automated validation of the cue sheet (brief §13). Use --strict in CI to require real audio analysis.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, probeAudio} from './lib/audio.mjs';

const strict = process.argv.includes('--strict');
const sheet = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/voiceover-cues.json'), 'utf8'));
const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/script.json'), 'utf8'));
const errors = [], notes = [];
const err = (m) => errors.push(m);
const isInt = Number.isInteger;

if (sheet.fps !== 30) err(`fps must be 30 (got ${sheet.fps})`);
if (!isInt(sheet.totalFrames) || sheet.totalFrames <= 0) err('totalFrames must be a positive integer');
if (sheet.language !== 'am') err('language must be "am"');
if (sheet.lines.length !== script.lines.length) err(`expected ${script.lines.length} lines, found ${sheet.lines.length}`);

const hasAudio = !!sheet.audioFile;
if (strict) {
  if (!hasAudio) err('STRICT: no audioFile in cue sheet — voiceover was not analysed');
  if (/NOT-VERIFIED/.test(sheet.timingMethod)) err(`STRICT: timingMethod is "${sheet.timingMethod}"`);
}
let audioFrames = null;
if (hasAudio) {
  const p = path.join(ROOT, 'public', sheet.audioFile);
  if (!fs.existsSync(p)) err(`audio file missing: ${sheet.audioFile}`);
  else {
    const info = probeAudio(p);
    audioFrames = Math.ceil(info.durationSeconds * sheet.fps);
    if (Math.abs(info.durationSeconds - sheet.audioDurationSeconds) > 0.01) err('audioDurationSeconds does not match the file');
    if (sheet.totalFrames < audioFrames) err(`totalFrames (${sheet.totalFrames}) shorter than audio (${audioFrames} frames) — narration would be cut`);
  }
}

let prevLineEnd = -1;
const gaps = [];
sheet.lines.forEach((line, li) => {
  const ref = script.lines[li];
  const tag = `line ${line.index}`;
  if (line.index !== li + 1) err(`${tag}: index out of order`);
  if (line.text !== ref.text) err(`${tag}: text differs from the authoritative script`);
  const expectedTokens = ref.text.trim().split(/\s+/);
  if (line.words.length !== expectedTokens.length) err(`${tag}: word count ${line.words.length} ≠ ${expectedTokens.length}`);
  if (line.words.map((w) => w.text).join(' ') !== ref.text.trim().split(/\s+/).join(' ')) err(`${tag}: words do not reproduce the script text`);
  if (!isInt(line.startFrame) || !isInt(line.endFrame) || line.startFrame >= line.endFrame) err(`${tag}: invalid start/end`);
  if (line.startFrame < prevLineEnd) err(`${tag}: overlaps previous line (${line.startFrame} < ${prevLineEnd})`);
  if (prevLineEnd >= 0) gaps.push(line.startFrame - prevLineEnd);
  if (line.endFrame > sheet.totalFrames) err(`${tag}: ends after totalFrames`);
  if (audioFrames && line.endFrame > audioFrames) err(`${tag}: ends after the audio (${audioFrames})`);
  prevLineEnd = line.endFrame;
  let prevEnd = line.startFrame;
  line.words.forEach((w, wi) => {
    const wt = `${tag} word ${wi} "${w.text}"`;
    if (!isInt(w.startFrame) || !isInt(w.endFrame) || !isInt(w.peakFrame)) err(`${wt}: non-integer frame`);
    if (w.endFrame - w.startFrame < 2) err(`${wt}: duration < 2 frames`);
    if (w.startFrame < prevEnd) err(`${wt}: overlaps previous word`);
    if (w.peakFrame < w.startFrame || w.peakFrame >= w.endFrame) err(`${wt}: peakFrame outside the word`);
    if (!w.text || /^\s*$/.test(w.text)) err(`${wt}: empty text`);
    if (w.startFrame < line.startFrame || w.endFrame > line.endFrame) err(`${wt}: outside its line`);
    if (!['verified', 'detected', 'forced-aligned', 'valley', 'snapped', 'interpolated', 'estimated', 'manual'].includes(w.confidence)) err(`${wt}: unknown confidence "${w.confidence}"`);
    prevEnd = w.endFrame;
  });
  (line.phrases || []).forEach((p, pi) => {
    if (p.startFrame >= p.endFrame) err(`${tag} phrase ${pi}: invalid`);
  });
});
if (gaps.length) notes.push(`pauses between lines (frames): ${gaps.join(', ')}`);
if (gaps.some((g) => g < 0)) err('negative gap between lines');

const conf = {};
sheet.lines.forEach((l) => l.words.forEach((w) => { conf[w.confidence] = (conf[w.confidence] || 0) + 1; }));
notes.push(`timingMethod: ${sheet.timingMethod}`, `total ${sheet.totalFrames} frames = ${(sheet.totalFrames / sheet.fps).toFixed(3)} s`, `word confidence: ${JSON.stringify(conf)}`);
(sheet.warnings || []).forEach((w) => notes.push(`warning: ${w}`));

notes.forEach((n) => console.log('  ' + n));
if (errors.length) { console.error(`\nCUE VALIDATION FAILED (${errors.length}):`); errors.forEach((e) => console.error('  ✗ ' + e)); process.exit(1); }
console.log('\n✓ cue sheet valid');
