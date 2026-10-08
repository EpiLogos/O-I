# Ableton Live 12.0.25 — instrument dynamics & session model (RE study)

**Status:** active commissioned lane (owner, 2026-10-07). Reconstruction target language: **Rust**.
**Subject:** Ableton Live 12 Suite, **12.0.25 (2024-08-27_2627c43816)**, macOS universal Mach-O, licensed copy possessed by the owner and installed on this machine.
**Provenance class:** reference study only. No Live code, samples, presets or artwork are redistributed. Behavior is documented from evidence produced on the owner's licensed copy and rebuilt **clean-room**: implementations in `packages/live-dynamics/` are written from the behavior documents in this folder, never from decompiled code.

## Source lock

| surface | pin |
| --- | --- |
| App bundle | `/Applications/Ableton Live 12 Suite.app` |
| CFBundle version | `12.0.25 (2024-08-27_2627c43816)` |
| Binary analyzed | `Live.arm64` — arm64 slice of `Contents/MacOS/Live` (fat: x86_64+arm64), 120,396,864 bytes |
| Document format | `MajorVersion="5" MinorVersion="12.0_12049"`, SchemaChangeCount 12; creator strings in factory content range 12.0.5d1–12.0.25 |
| Schema vocabulary | app bundle `App-Resources/Schema/*.txt` (356 AbletonSchema translator files) |
| Analysis engine | Ghidra 12.1.4 + native decompiler (mac_arm_64, built from owner's `~/tools/ghidra-src`, same 12.1.4) driven by `rea` |

## Method (order of attack, cheap official evidence first)

1. **Official surfaces** — the app's own Schema directory (full document-model vocabulary),
   MIDI Remote Scripts (`.pyc` component architecture), embedded `abl.live` Python
   (infrastructure only; the LOM itself is compiled into the binary).
2. **Device archives** — `.adv/.adg/.als/.alc` are gzip'd XML. Full parameter trees, ranges
   (MidiControllerRange), routing and device state read directly. Evidence under `evidence/`.
3. **Binary** — `rea analyze/decompile/function/search/trace` on the arm64 slice through
   Ghidra. Decompiled claims never stand alone (see gate below).
4. **Behavioral capture (the DSP gate)** — golden renders through the real app, diffed
   spectrally; no claim about *dynamics* without it.

## The DSP testing gate (binding for every dynamics claim)

1. **Golden renders:** fixed test input through the device at pinned parameters, rendered
   twice through Live; render determinism is itself a claim, checked by byte/spectral
   comparison of the two renders.
2. **Behavioral curves:** transfer curves, envelope shapes, filter responses extracted
   from golden renders by spectral analysis, not listening.
3. **Reconstruction proof:** the Rust rebuild fed the same input must match the golden
   reference within a stated spectral-distance threshold — the threshold is part of the claim.
4. **Cross-check:** any decompiled-code claim must agree with the behavioral curves or be
   downgraded to *unverified hypothesis* in the dossier.

## Lane map

- `devices/` — per-device dynamics dossiers (curves + parameter semantics + evidence grade).
- `session-model.md` — the session/device document model (clip/scene/arrangement/warp semantics).
- `integration-map.md` — Lane B: where instrument/audio features land in the O-I cradle.
- `reconstruction-backlog.md` — per-device verify gates for the Rust rebuild.
- `harness/` — golden-render harness: test signals, crafted sets, driving scripts, renders.
- `evidence/` — provenance-marked unpacked archives from the licensed copy (**not for
  redistribution**).

## Guardrails (binding)

- No redistribution of Live code, samples, presets or artwork.
- No license or DRM circumvention; the licensed copy is used exactly as licensed.
- Document behavior; rebuild from the documents. Decompiled material stays out of product
  source (`packages/live-dynamics/`).

## Reopen when

- Live version changes (re-pin the source lock; document formats carry MinorVersion).
- A dossier claim is contradicted by golden renders (downgrade or revise).
- The clean-room rebuild fails its stated threshold gate.
