#!/usr/bin/env python3
"""
Optional word-level CTC forced alignment with Meta's MMS (supports Amharic, ISO 639-3 "amh").
Runs in CI (needs network + torch). Writes public/data/forced-alignment.json. Any failure is non-fatal:
build-cues.mjs simply falls back to its energy-valley timing.

  pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
  pip install git+https://github.com/MahmoudAshraf97/ctc-forced-aligner.git
"""
import json, re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
sheet = json.loads((root / "public/data/voiceover-cues.json").read_text(encoding="utf-8"))
script = json.loads((root / "src/data/script.json").read_text(encoding="utf-8"))
audio = root / "public" / sheet["audioFile"]
out = root / "public/data/forced-alignment.json"

try:
    import torch
    from ctc_forced_aligner import (load_audio, load_alignment_model, generate_emissions,
                                    preprocess_text, get_alignments, get_spans, postprocess_results)
    device = "cpu"
    model, tokenizer = load_alignment_model(device, dtype=torch.float32)
    wav = load_audio(str(audio), model.dtype, model.device)
    emissions, stride = generate_emissions(model, wav, batch_size=8)

    words_meta, flat = [], []
    for li, line in enumerate(script["lines"], start=1):
        for wi, tok in enumerate(line["text"].split()):
            words_meta.append((li, wi))
            flat.append(re.sub(r"[፣።፤]", "", tok))
    text = " ".join(flat)

    tokens_starred, text_starred = preprocess_text(text, romanize=True, language="amh")
    segments, scores, blank = get_alignments(emissions, tokens_starred, tokenizer)
    spans = get_spans(tokens_starred, segments, blank)
    res = postprocess_results(text_starred, spans, stride, scores)

    if len(res) != len(words_meta):
        raise RuntimeError(f"aligner returned {len(res)} words, expected {len(words_meta)}")
    payload = {"method": "mms-ctc-forced-alignment", "language": "amh",
               "words": [{"line": l, "word": w, "start": round(float(r["start"]), 3), "end": round(float(r["end"]), 3)}
                         for (l, w), r in zip(words_meta, res)]}
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"forced alignment written: {len(res)} words")
except Exception as e:  # never break the pipeline
    print(f"[align_mms] skipped: {e}", file=sys.stderr)
    if out.exists():
        out.unlink()
    sys.exit(0)
