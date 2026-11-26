#!/usr/bin/env node
/**
 * Build the cue sheet from the REAL voiceover.
 *
 *   node scripts/build-cues.mjs              analyse public/audio/* and write cues (fails if no audio)
 *   node scripts/build-cues.mjs --estimate   no audio: write an UNVERIFIED draft from the brief's estimates
 *
 * Honest method (no Amharic forced aligner is assumed to exist):
 *   1. Decode audio, compute a 10 ms RMS envelope, detect speech region and silences.
 *   2. Pick the 5 silences that best separate the six script lines (syllable-count prior + silence length).
 *   3. Pick comma pauses inside lines (፣) the same way -> phrase boundaries.
 *   4. Words inside a phrase are interpolated by Fidel-syllable count and snapped to the nearest
 *      energy dip. They are labelled "snapped"/"interpolated", never "verified".
 *   5. src/data/cue-overrides.json lets you pin any boundary by hand ("manual").
 */
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, run, probeAudio, decodeMono, envelopeDb, findVoiceover, HOP_MS} from './lib/audio.mjs';

const FPS = 30;
const FINAL_HOLD_FRAMES = 60;
const estimateMode = process.argv.includes('--estimate');
const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/script.json'), 'utf8'));
const overridesPath = path.join(ROOT, 'src/data/cue-overrides.json');
const forcedPath = path.join(ROOT, 'public/data/forced-alignment.json');
const forced = fs.existsSync(forcedPath) && !estimateMode ? JSON.parse(fs.readFileSync(forcedPath, 'utf8')) : null;
const forcedStats = {used: 0, rejected: 0};
const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};

const sylWeight = (tok) => Math.max(1, (tok.match(/[\u1200-\u135A]/g) || []).length);
const isPhraseEnd = (tok) => /[፣።፤]$/.test(tok);
const toFrame = (sec) => Math.round(sec * FPS);
const warnings = [];
const nucleiDiag = [];

// ---------- structure of the script ----------
const lineModels = script.lines.map((l) => {
  const tokens = l.text.trim().split(/\s+/);
  const phrases = [];
  let cur = [];
  tokens.forEach((t, i) => {
    cur.push(i);
    if (isPhraseEnd(t) || i === tokens.length - 1) { phrases.push(cur); cur = []; }
  });
  return {index: l.index, text: l.text, tokens, phrases, emphasis: l.emphasis || {}, weight: tokens.reduce((s, t) => s + sylWeight(t), 0)};
});

// ---------- valley alignment (dynamic programming) ----------
// Word boundaries inside a phrase = actual energy valleys (local minima, prominence >= 3 dB) chosen jointly so
// that they (a) are deep and (b) stay close to the syllable-proportional expectation. Fast Amharic merges
// syllables, so counting nuclei is NOT reliable; valleys + a proportional prior is the defensible compromise.
function valleyCandidates(env, ps, pe) {
  const {db, hopSeconds} = env;
  const i0 = Math.round(ps / hopSeconds), i1 = Math.round(pe / hopSeconds);
  const seg = db.slice(0, db.length);
  const sm = new Float32Array(db.length);
  for (let i = 0; i < db.length; i++) sm[i] = (db[Math.max(0, i - 1)] + db[i] + db[Math.min(db.length - 1, i + 1)]) / 3;
  const R = 12; // 120 ms prominence window
  const out = [];
  for (let i = i0 + 6; i < i1 - 6; i++) {
    if (!(sm[i] <= sm[i - 1] && sm[i] < sm[i + 1])) continue;
    let lmax = -Infinity, rmax = -Infinity;
    for (let j = Math.max(0, i - R); j < i; j++) lmax = Math.max(lmax, sm[j]);
    for (let j = i + 1; j <= Math.min(db.length - 1, i + R); j++) rmax = Math.max(rmax, sm[j]);
    const prom = Math.min(lmax, rmax) - sm[i];
    if (prom >= 3) out.push({t: i * hopSeconds, prom});
  }
  return out;
}

function valleyBoundaries(env, ps, pe, weights, diag) {
  const k = weights.length - 1;
  if (k < 1) return {bounds: [], used: 0};
  const total = weights.reduce((a, b) => a + b, 0);
  const exp = []; let acc = 0;
  for (let j = 0; j < k; j++) { acc += weights[j]; exp.push(ps + ((pe - ps) * acc) / total); }
  const cands = valleyCandidates(env, ps, pe);
  const SIGMA = 0.17, MU = 1.6, MAXDEV = 0.3;
  // dp[j][c] = best cost placing boundary j on candidate c (c = -1 means "expected position, no valley")
  const opts = (j) => [{t: exp[j], prom: 0, none: true}, ...cands.filter((c) => Math.abs(c.t - exp[j]) <= MAXDEV)];
  const cost = (o, j) => (o.none ? 1.2 : ((o.t - exp[j]) / SIGMA) ** 2 - MU * Math.min(o.prom, 25) / 25);
  let prev = opts(0).map((o) => ({o, c: cost(o, 0), back: null}));
  const layers = [prev];
  for (let j = 1; j < k; j++) {
    const cur = opts(j).map((o) => {
      let best = null;
      for (const p of prev) {
        if (o.t - p.o.t < 0.09) continue; // min 90 ms word
        const c = p.c + cost(o, j);
        if (!best || c < best.c) best = {o, c, back: p};
      }
      return best || {o, c: Infinity, back: null};
    });
    layers.push(cur); prev = cur;
  }
  let end = prev.reduce((a, b) => (b.c < a.c ? b : a));
  const picked = [];
  for (let n = end; n; n = n.back) picked.unshift(n.o);
  const lastOk = (pe - picked[picked.length - 1].t) >= 0.09;
  if (!lastOk || picked.length !== k) return {bounds: exp.map((t) => ({t, c: 'interpolated'})), used: 0};
  diag.push({k, valleys: picked.filter((p) => !p.none).length});
  return {bounds: picked.map((p) => ({t: p.t, c: p.none ? 'interpolated' : 'valley'})), used: picked.filter((p) => !p.none).length};
}

// ---------- cue-sheet assembly helpers ----------
function wordsForPhrase(model, phraseIdx, ps, pe, startConf, endConf, env) {
  const idxs = model.phrases[phraseIdx];
  const w = idxs.map((i) => sylWeight(model.tokens[i]));
  const total = w.reduce((a, b) => a + b, 0);
  const bounds = [ps];
  const conf = [startConf];
  // 1) CTC forced alignment, if it ran AND agrees with the audio-derived phrase span
  let fb = null;
  if (forced && idxs.length > 1) {
    const fw = idxs.map((wi) => forced.words.find((x) => x.line === model.index && x.word === wi));
    const ok = fw.every(Boolean) && fw.every((x, j) => x.end > x.start && (j === 0 || x.start >= fw[j - 1].start))
      && fw[0].start > ps - 0.25 && fw[fw.length - 1].end < pe + 0.25;
    if (ok) fb = fw.slice(0, -1).map((x, j) => (x.end + fw[j + 1].start) / 2);
    if (ok) forcedStats.used++; else forcedStats.rejected++;
  }
  if (fb) {
    fb.forEach((t) => { bounds.push(Math.min(pe - 0.09, Math.max(ps + 0.09, t))); conf.push('forced-aligned'); });
  } else if (env) {
    const vb = valleyBoundaries(env, ps, pe, w, nucleiDiag);
    vb.bounds.forEach((b) => { bounds.push(b.t); conf.push(b.c); });
  } else {
    let acc = 0;
    for (let j = 0; j < idxs.length - 1; j++) { acc += w[j]; bounds.push(ps + ((pe - ps) * acc) / total); conf.push('interpolated'); }
  }
  bounds.push(pe);
  conf.push(endConf);
  // enforce min word length of 80 ms
  for (let j = 1; j < bounds.length; j++) if (bounds[j] - bounds[j - 1] < 0.08) bounds[j] = bounds[j - 1] + 0.08;
  const rank = {detected: 5, 'forced-aligned': 5, manual: 5, valley: 3, snapped: 2, interpolated: 1};
  return idxs.map((wordIdx, j) => ({
    wordIdx,
    s: bounds[j],
    e: bounds[j + 1],
    confidence: rank[conf[j]] <= rank[conf[j + 1]] ? conf[j] : conf[j + 1],
  }));
}

function snapToDip(env, t, radius) {
  const {db, hopSeconds} = env;
  const c = Math.round(t / hopSeconds);
  const r = Math.max(1, Math.round(radius / hopSeconds));
  let best = -1, bestV = Infinity, sum = 0, n = 0;
  for (let i = Math.max(0, c - r); i <= Math.min(db.length - 1, c + r); i++) {
    sum += db[i]; n++;
    if (db[i] < bestV - 1e-6 || (Math.abs(db[i] - bestV) < 1e-6 && Math.abs(i - c) < Math.abs(best - c))) { bestV = db[i]; best = i; }
  }
  if (best < 0 || sum / n - bestV < 4) return null; // no distinct dip -> keep interpolated position
  return best * hopSeconds;
}

function peakIn(env, s, e) {
  if (!env) return null;
  const {db, hopSeconds} = env;
  let best = Math.round(s / hopSeconds), v = -Infinity;
  for (let i = Math.round(s / hopSeconds); i < Math.round(e / hopSeconds) && i < db.length; i++) if (db[i] > v) { v = db[i]; best = i; }
  return best * hopSeconds;
}

/** choose k silences from candidates (sorted by start) that best split [spanStart, spanEnd] with weights. */
function chooseBoundaries(cands, k, spanStart, spanEnd, weights) {
  if (k === 0) return [];
  if (cands.length < k) return null;
  let pool = cands;
  if (pool.length > 40) pool = [...pool].sort((a, b) => b.len - a.len).slice(0, 40).sort((a, b) => a.start - b.start);
  const W = weights.reduce((a, b) => a + b, 0);
  let best = null, bestCost = Infinity;
  const pick = [];
  const evalCost = () => {
    let prevEnd = spanStart, cost = 0;
    const d = [];
    for (const s of pick) { d.push(s.start - prevEnd); prevEnd = s.end; }
    d.push(spanEnd - prevEnd);
    const speech = d.reduce((a, b) => a + b, 0);
    if (d.some((x) => x < 0.15)) return Infinity;
    d.forEach((x, i) => { const e = (speech * weights[i]) / W; cost += ((x - e) / (e + 0.2)) ** 2; });
    pick.forEach((s) => { cost -= 0.8 * Math.min(s.len, 0.6); });
    return cost;
  };
  const rec = (from) => {
    if (pick.length === k) {
      const c = evalCost();
      if (c < bestCost) { bestCost = c; best = [...pick]; }
      return;
    }
    for (let i = from; i <= pool.length - (k - pick.length); i++) {
      if (pick.length && pool[i].start < pick[pick.length - 1].end) continue;
      pick.push(pool[i]); rec(i + 1); pick.pop();
    }
  };
  rec(0);
  return best;
}

function detectSilences(db, hopSeconds, threshold, minSilence) {
  const n = db.length;
  const loud = new Uint8Array(n);
  for (let i = 0; i < n; i++) loud[i] = db[i] > threshold ? 1 : 0;
  // drop loud blips shorter than 40 ms (clicks)
  for (let i = 0; i < n;) {
    if (!loud[i]) { i++; continue; }
    let j = i; while (j < n && loud[j]) j++;
    if (j - i < 4) for (let k = i; k < j; k++) loud[k] = 0;
    i = j;
  }
  let first = loud.indexOf(1);
  let last = loud.lastIndexOf(1);
  if (first < 0) return null;
  const silences = [];
  for (let i = first; i <= last;) {
    if (loud[i]) { i++; continue; }
    let j = i; while (j <= last && !loud[j]) j++;
    const len = (j - i) * hopSeconds;
    if (len >= minSilence) silences.push({start: i * hopSeconds, end: j * hopSeconds, len});
    i = j;
  }
  return {speechStart: first * hopSeconds, speechEnd: (last + 1) * hopSeconds, silences, threshold};
}

// ---------- main ----------
let audioInfo = null, env = null, audioFileRel = null, audioAbs = null;
let timingMethod, lineSpans; // lineSpans: [{s,e,startConf,endConf}] in seconds
let analysis = {};

if (estimateMode) {
  timingMethod = 'estimated-from-brief-NOT-VERIFIED';
  warnings.push('No audio analysed: timings are the brief\'s rough estimates. Add public/audio/voiceover.* and re-run.');
  lineSpans = script.estimatedFramesFromBrief.map(([a, b], i, arr) => ({
    s: a / FPS,
    e: (i === arr.length - 1 ? b : b - 6) / FPS,
    startConf: 'estimated', endConf: 'estimated',
  }));
} else {
  console.log('Locating voiceover…');
  audioAbs = findVoiceover();
  if (!audioAbs) {
    console.error('\nERROR: no voiceover found. Put the narration at public/audio/voiceover.wav (or .mp3/.m4a) and commit it.\n' +
      '       (Use "node scripts/build-cues.mjs --estimate" only to create an unverified draft for UI work.)');
    process.exit(2);
  }
  // make sure it lives under public/ so Remotion's staticFile() can serve it
  const pub = path.join(ROOT, 'public');
  if (!audioAbs.startsWith(pub + path.sep)) {
    const dest = path.join(pub, 'audio', path.basename(audioAbs));
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    fs.copyFileSync(audioAbs, dest);
    audioAbs = dest;
  }
  // Decode once to lossless PCM WAV (no resampling, no trimming beyond the decoder's own gapless handling).
  // MP3/AAC encoder padding makes browser vs ffmpeg decoders disagree by tens of ms; WAV removes that ambiguity,
  // so analysis, Studio preview and the final render all see identical sample positions. The original is untouched.
  {
    const ext = path.extname(audioAbs);
    const syncedWav = path.join(pub, 'audio', path.basename(audioAbs, ext) + '.synced.wav');
    if (!/\.synced\.wav$/i.test(audioAbs)) {
      run('ffmpeg', ['-v', 'error', '-y', '-i', audioAbs, '-c:a', 'pcm_s16le', syncedWav]);
      console.log(`Converted ${path.basename(audioAbs)} -> ${path.basename(syncedWav)} (lossless PCM, same timing)`);
      audioAbs = syncedWav;
    }
  }
  audioFileRel = path.relative(pub, audioAbs).split(path.sep).join('/');
  audioInfo = probeAudio(audioAbs);
  console.log(`Using ${audioFileRel}: ${audioInfo.durationSeconds.toFixed(3)} s, ${audioInfo.sampleRate} Hz, ${audioInfo.channels} ch, ${audioInfo.codec}`);

  const samples = decodeMono(audioAbs);
  env = envelopeDb(samples);
  const {db, hopSeconds} = env;
  const sorted = [...db].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const floor = pct(0.1), peak = pct(0.95);
  const attempts = [
    {thr: Math.max(floor + 12, peak - 30), minSil: 0.09},
    {thr: Math.max(floor + 12, peak - 24), minSil: 0.07},
    {thr: Math.max(floor + 12, peak - 18), minSil: 0.05},
  ];
  let det = null;
  for (const a of attempts) {
    const d = detectSilences(db, hopSeconds, a.thr, a.minSil);
    if (d && d.silences.length >= lineModels.length - 1) { det = d; break; }
    det = det || d;
  }
  if (!det) throw new Error('No speech detected in the audio (it may be silent).');
  analysis = {noiseFloorDb: +floor.toFixed(1), peakDb: +peak.toFixed(1), thresholdDb: +det.threshold.toFixed(1),
    speechStartSeconds: +det.speechStart.toFixed(3), speechEndSeconds: +det.speechEnd.toFixed(3),
    leadingSilenceSeconds: +det.speechStart.toFixed(3), trailingSilenceSeconds: +(audioInfo.durationSeconds - det.speechEnd).toFixed(3),
    silences: det.silences.map((s) => ({start: +s.start.toFixed(3), end: +s.end.toFixed(3), len: +s.len.toFixed(3)}))};
  console.log(`Speech ${det.speechStart.toFixed(2)}s → ${det.speechEnd.toFixed(2)}s, ${det.silences.length} inner silences`);

  const weights = lineModels.map((m) => m.weight);
  const chosen = chooseBoundaries(det.silences, lineModels.length - 1, det.speechStart, det.speechEnd, weights);
  if (chosen) {
    timingMethod = 'audio-envelope-segmentation';
    lineSpans = lineModels.map((_, i) => ({
      s: i === 0 ? det.speechStart : chosen[i - 1].end,
      e: i === lineModels.length - 1 ? det.speechEnd : chosen[i].start,
      startConf: 'detected', endConf: 'detected',
    }));
    chosen.forEach((c, i) => { if (c.len < 0.15) warnings.push(`Weak pause between line ${i + 1} and ${i + 2} (${c.len.toFixed(2)} s) — check by ear.`); });
  } else {
    timingMethod = 'proportional-fallback-NOT-VERIFIED';
    warnings.push(`Only ${det.silences.length} inner silences found; the six lines could not be separated reliably. Falling back to syllable-proportional spans.`);
    const total = weights.reduce((a, b) => a + b, 0);
    let t = det.speechStart;
    lineSpans = lineModels.map((m, i) => {
      const dur = ((det.speechEnd - det.speechStart) * m.weight) / total;
      const s = t; t += dur;
      return {s, e: i === lineModels.length - 1 ? det.speechEnd : t - 0.12, startConf: 'interpolated', endConf: 'interpolated'};
    });
  }
  analysis._allSilences = det.silences;
}

// ---------- lines, phrases, words ----------
const lines = lineModels.map((m, li) => {
  const span = lineSpans[li];
  // phrase boundaries from comma pauses
  let phraseSpans;
  const k = m.phrases.length - 1;
  const innerSil = (analysis._allSilences || []).filter((s) => s.start > span.s + 0.1 && s.end < span.e - 0.1 && s.len >= 0.05);
  const pw = m.phrases.map((p) => p.reduce((a, i) => a + sylWeight(m.tokens[i]), 0));
  const picked = env && k > 0 ? chooseBoundaries(innerSil, k, span.s, span.e, pw) : null;
  if (picked) {
    phraseSpans = m.phrases.map((_, pi) => ({
      s: pi === 0 ? span.s : picked[pi - 1].end, e: pi === k ? span.e : picked[pi].start,
      sc: pi === 0 ? span.startConf : 'detected', ec: pi === k ? span.endConf : 'detected',
    }));
  } else {
    if (k > 0 && env) warnings.push(`Line ${m.index}: comma pauses not found in audio; phrase boundaries interpolated.`);
    const tot = pw.reduce((a, b) => a + b, 0);
    let t = span.s;
    phraseSpans = m.phrases.map((_, pi) => {
      const dur = ((span.e - span.s) * pw[pi]) / tot; const s = t; t += dur;
      return {s, e: pi === k ? span.e : t, sc: pi === 0 ? span.startConf : 'interpolated', ec: pi === k ? span.endConf : 'interpolated'};
    });
  }
  const words = [];
  phraseSpans.forEach((ps, pi) => {
    const ws = wordsForPhrase(m, pi, ps.s, ps.e, ps.sc, ps.ec, env);
    ws.forEach((w) => {
      const pk = peakIn(env, w.s, w.e);
      const startFrame = toFrame(w.s);
      const endFrame = Math.max(startFrame + 3, toFrame(w.e));
      words[w.wordIdx] = {
        text: m.tokens[w.wordIdx], startFrame, endFrame,
        peakFrame: pk == null ? Math.round((startFrame + endFrame) / 2) : Math.min(endFrame - 1, Math.max(startFrame, toFrame(pk))),
        emphasis: m.emphasis[String(w.wordIdx)] || 'none',
        confidence: w.confidence,
      };
    });
  });
  const phrases = m.phrases.map((p, pi) => ({
    startWord: p[0], endWord: p[p.length - 1],
    startFrame: words[p[0]].startFrame, endFrame: words[p[p.length - 1]].endFrame,
  }));
  return {index: m.index, text: m.text, startFrame: words[0].startFrame, endFrame: words[words.length - 1].endFrame, phrases, words};
});

// ---------- manual overrides ----------
// { "words": { "3.2": {"startFrame": 250, "endFrame": 262} }, "lines": { "3": {"startFrame": 200} } }   (line is 1-based, word 0-based)
for (const [key, v] of Object.entries(overrides.words || {})) {
  const [li, wi] = key.split('.').map(Number);
  const w = lines[li - 1]?.words[wi];
  if (!w) { warnings.push(`Override "${key}" matches no word`); continue; }
  if (v.startFrame != null) w.startFrame = v.startFrame;
  if (v.endFrame != null) w.endFrame = v.endFrame;
  if (v.peakFrame != null) w.peakFrame = v.peakFrame;
  w.peakFrame = Math.min(w.endFrame - 1, Math.max(w.startFrame, w.peakFrame));
  w.confidence = 'manual';
}
for (const l of lines) {
  l.startFrame = l.words[0].startFrame;
  l.endFrame = l.words[l.words.length - 1].endFrame;
  l.phrases.forEach((p) => { p.startFrame = l.words[p.startWord].startFrame; p.endFrame = l.words[p.endWord].endFrame; });
}

const lastEnd = lines[lines.length - 1].endFrame;
const audioFrames = audioInfo ? Math.ceil(audioInfo.durationSeconds * FPS) : 510;
const totalFrames = Math.max(audioFrames + 15, lastEnd + FINAL_HOLD_FRAMES);

const sheet = {
  fps: FPS,
  audioFile: audioFileRel,
  audioDurationSeconds: audioInfo ? +audioInfo.durationSeconds.toFixed(3) : null,
  audioSampleRate: audioInfo?.sampleRate ?? null,
  audioChannels: audioInfo?.channels ?? null,
  totalFrames,
  finalHoldFrames: totalFrames - lastEnd,
  language: 'am',
  timingMethod,
  intervals: 'half-open [startFrame, endFrame)',
  confidenceLegend: {
    detected: 'boundary found in the audio (silence detection) — reliable to ~1-2 frames',
    'forced-aligned': 'word boundary from CTC forced alignment (MMS, Amharic) — best available',
    valley: 'interior word boundary placed on a real energy valley (>=3 dB prominence) near the syllable-proportional expectation — plausible, NOT forced-aligned',
    interpolated: 'proportional to Fidel-syllable count — estimate',
    estimated: 'from the brief, no audio analysed',
    manual: 'pinned by hand in src/data/cue-overrides.json',
  },
  warnings,
  lines,
};

// per-frame normalised energy (0..1) – used only as a gentle secondary modulation
const envFrames = [];
if (env) {
  const {db, hopSeconds} = env;
  const peakDb = [...db].sort((a, b) => a - b)[Math.floor(db.length * 0.98)];
  for (let f = 0; f < totalFrames; f++) {
    const a = Math.floor((f / FPS) / hopSeconds), b = Math.min(db.length, Math.ceil(((f + 1) / FPS) / hopSeconds));
    let m = -120; for (let i = a; i < b; i++) m = Math.max(m, db[i]);
    envFrames.push(+Math.max(0, Math.min(1, (m - (peakDb - 40)) / 40)).toFixed(3));
  }
} else for (let f = 0; f < totalFrames; f++) envFrames.push(0);

const writeJson = (rel, obj) => { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), {recursive: true}); fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); };
writeJson('src/data/voiceover-cues.json', sheet);
writeJson('public/data/voiceover-cues.json', sheet);
writeJson('src/data/envelope.json', {fps: FPS, values: envFrames});
if (audioInfo) {
  const {_allSilences, ...rest} = analysis;
  writeJson('public/data/audio-analysis.json', {audioFile: audioFileRel, ...audioInfo, hopMs: HOP_MS, ...rest});
}

console.log(`\nCue sheet written: ${timingMethod}, ${totalFrames} frames (${(totalFrames / FPS).toFixed(2)} s @ ${FPS} fps)`);
lines.forEach((l) => console.log(`  line ${l.index}: ${l.startFrame}–${l.endFrame}  [${l.words.map((w) => `${w.startFrame}`).join(' ')}]`));
if (forced) console.log(`  forced alignment: ${forcedStats.used} phrases used, ${forcedStats.rejected} rejected (disagreed with audio)`);
console.log('  valleys used per phrase (boundaries/valleys):', nucleiDiag.map((d) => `${d.k}/${d.valleys}`).join('  '));
warnings.forEach((w) => console.log(`  WARNING: ${w}`));
