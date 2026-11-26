# Audio-directed Amharic motion graphics (Remotion + GitHub Actions)

The voiceover is the master timeline. Every visual event is driven by `src/data/voiceover-cues.json`,
which is **generated from the actual recording**, never from the brief's guessed timestamps.

## Produce the video on GitHub (no local rendering)

1. Put the narration at `public/audio/voiceover.mp3` (or `.wav/.m4a`; one narration file only).
2. `git add . && git commit -m "render" && git push` to `main`.
3. Open the repo → **Actions → Render Amharic motion graphics**. When it finishes (≈15–40 min) download:
   - **final-video** → `final-amharic-motion-graphics.mp4`
   - **timing-and-qc** → cue sheet, audio analysis, `sync-editor.html`, QC stills
4. Tag `v1` and push the tag to also attach the MP4 to a GitHub Release.

The workflow: installs deps → embeds Noto Sans Ethiopic locally → analyses audio → (optional) MMS forced alignment →
builds + strictly validates the cue sheet → renders QC stills → renders 1920×1080 / 30 fps / H.264 → **verifies the MP4**
(1 video + exactly 1 audio stream, resolution, fps, frame count, duration, and audio cross-correlated against the original with a lag search).

## What the real audio revealed

The recording is **14.46 s**, not the brief's 17 s; lines run 0.47 s → 14.27 s. The pipeline therefore sets length from the audio:
488 frames (16.27 s = speech + a 2 s final hold). The brief's six-line frame table is ignored once audio exists.

## How timing is derived (and how reliable each part is)

| Level | Method | Confidence label |
|---|---|---|
| Speech start/end, line boundaries, comma pauses | 10 ms RMS envelope + silence detection, best 5 silences chosen by syllable prior | `detected` |
| Word boundaries inside a phrase (default) | real energy valleys (≥3 dB) near the syllable-proportional expectation, joint DP | `valley` |
| Word boundaries (if the CI model ran and agrees with the audio) | MMS CTC forced alignment (Amharic) | `forced-aligned` |
| Anything you pin by hand | `src/data/cue-overrides.json` | `manual` |

No Amharic forced aligner was available when this was built, so word boundaries are **not claimed as verified**. Lines/phrases are solid; word boundaries are best-effort until you check them by ear:

## Make sync perfect (2 minutes)

1. Open `tools/sync-editor.html` in a browser; load `public/audio/voiceover.synced.wav` and `public/data/voiceover-cues.json` (both are in the *timing-and-qc* artifact).
2. Click a word, press **L** to loop it. Nudge start (**A/D**) and end (**Q/E**) by a frame, or drag the handles. Changed words get a dashed outline.
3. **Export** → save as `src/data/cue-overrides.json` → commit → push. CI re-renders with your corrections.

Why a WAV? MP3 encoder padding makes browsers and ffmpeg disagree by ~30 ms. The pipeline decodes your MP3 once to lossless PCM
(`voiceover.synced.wav`) and uses it for analysis, preview and render. The original MP3 is untouched and is still the source of truth.

## Local use

```bash
npm install && npm run prepare:assets   # fonts + cues from the audio
npm run studio                          # live preview with the audio
npm run build:all                       # everything CI does
```

## Visual concept

One continuous world of 23 curves + particles that physically transform, with the narration as director:
chaos (tension builds to a peak) → **"ግን" triggers a directional re-route** (curves bend into a converging beam, light sweep, shock ring, camera push) →
clarity (beam snaps into a 120 px grid; precision ticks; a playhead crosses the stage in exactly the duration of "ጊዜ"; "ምንም ትርፍ ነገር የለም" removes everything but four guide lines) →
those guides become a **screen** that reacts word-by-word (needle, ripples, bars, corner snap, 3D move) →
the screen condenses into a gold seed that grows into nested geometry ("ቀላል ሀሳብ፣ ትልቅ ውጤት።") →
resolves into a balanced final frame with "አሁን ተዘጋጅተናል።". No music, SFX, logo, name or extra text.

## Layout

`src/animation` cue engine + world timeline · `src/components` shapes, typography, particles, sweeps · `src/scenes` six events ·
`scripts` audio analysis, validation, stills, verification · `tools/sync-editor.html` · `.github/workflows/render.yml`

## Known limits

* The Remotion composition was written without being able to run a render in the authoring sandbox (no network/npm). Audio analysis, cue validation, output verification, the sync editor and the timeline math were executed against your real recording; the first CI run is the first real render. Check the QC stills artifact first if something looks off.
* Word boundaries are `valley`-grade until you review them (see above).
