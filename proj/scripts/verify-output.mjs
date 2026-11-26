#!/usr/bin/env node
// Verifies the rendered MP4 (brief §16): streams, resolution, fps, duration, ONE audio track,
// and that the audio is the original narration, correlated against the source with a lag search.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, run, decodeMono, envelopeDb} from './lib/audio.mjs';

const out = path.join(ROOT, 'output/final-amharic-motion-graphics.mp4');
const sheet = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/voiceover-cues.json'), 'utf8'));
const errors = [], report = [];
if (!fs.existsSync(out)) { console.error('✗ output MP4 not found'); process.exit(1); }

const j = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', out]).stdout.toString());
const v = j.streams.filter((s) => s.codec_type === 'video');
const a = j.streams.filter((s) => s.codec_type === 'audio');
const other = j.streams.filter((s) => !['video', 'audio'].includes(s.codec_type));
report.push(`file: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB, container duration ${Number(j.format.duration).toFixed(3)} s`);
if (v.length !== 1) errors.push(`expected 1 video stream, found ${v.length}`);
if (a.length !== 1) errors.push(`expected exactly 1 audio stream, found ${a.length}`);
if (other.length) errors.push(`unexpected extra streams: ${other.map((s) => s.codec_type).join(',')}`);
if (v[0]) {
  const [n, d] = v[0].r_frame_rate.split('/').map(Number);
  report.push(`video: ${v[0].codec_name} ${v[0].width}x${v[0].height} @ ${(n / d).toFixed(3)} fps, ${v[0].pix_fmt}, frames=${v[0].nb_read_frames}`);
  if (v[0].codec_name !== 'h264') errors.push('video codec is not h264');
  if (v[0].width !== 1920 || v[0].height !== 1080) errors.push('resolution is not 1920x1080');
  if (Math.abs(n / d - 30) > 0.001) errors.push('frame rate is not 30');
  if (Number(v[0].nb_read_frames) !== sheet.totalFrames) errors.push(`decoded frames ${v[0].nb_read_frames} ≠ expected ${sheet.totalFrames}`);
}
if (a[0]) report.push(`audio: ${a[0].codec_name} ${a[0].sample_rate} Hz ch=${a[0].channels}`);
const expectedDur = sheet.totalFrames / sheet.fps;
if (Math.abs(Number(j.format.duration) - expectedDur) > 0.12) errors.push(`duration ${j.format.duration} ≠ expected ${expectedDur.toFixed(3)}`);

if (sheet.audioFile && a.length === 1) {
  const src = path.join(ROOT, 'public', sheet.audioFile);
  const e1 = envelopeDb(decodeMono(src)).db;
  const e2 = envelopeDb(decodeMono(out)).db;
  const clip = (x) => Math.max(-60, x);
  const n = Math.min(e1.length, e2.length) - 100;
  let best = {lag: 0, r: -2};
  for (let lag = -30; lag <= 30; lag++) {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, c = 0;
    for (let i = 40; i < n; i++) {
      const x = clip(e1[i]), y = clip(e2[i + lag]);
      sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; c++;
    }
    const r = (sab - (sa * sb) / c) / Math.sqrt((saa - (sa * sa) / c) * (sbb - (sb * sb) / c));
    if (r > best.r) best = {lag, r};
  }
  report.push(`audio vs original: correlation ${best.r.toFixed(4)} at lag ${best.lag * 10} ms`);
  if (best.r < 0.95) errors.push(`audio does not match the original narration (r=${best.r.toFixed(3)})`);
  if (Math.abs(best.lag) > 5) errors.push(`audio offset ${best.lag * 10} ms exceeds 50 ms`);
}
report.forEach((r) => console.log('  ' + r));
if (errors.length) { console.error('\nVERIFICATION FAILED:'); errors.forEach((e) => console.error('  ✗ ' + e)); process.exit(1); }
console.log('\n✓ output verified');
