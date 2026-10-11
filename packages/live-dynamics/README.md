# live-dynamics

Clean-room Rust rebuilds of selected Ableton Live 12 device dynamics, with a
behavioral verify gate against golden renders.

## The clean-room rule (binding)

This crate is written **only** from the behavior documents in
`docs/research/ableton-live-12.0.25/` (curves, parameter semantics, measured
constants, stated hypotheses). No decompiled output, no vendor presets, no
binary-derived tables enter this crate. Constants carry a provenance comment
naming the document and measurement they come from. A device module that
cannot cite its behavior doc does not belong here.

## Layout

- `src/audio.rs` — minimal readers: float32 WAV (tag 3) and 16-bit AIFF (Live's
  export format). No dependencies by design.
- `src/spectrum.rs` — radix-2 FFT, log-magnitude band profile, spectral
  distance metrics used by the gate.
- `src/taps.rs` — impulse tap extraction (peak in expected window) and the
  tap gate for delay/rebuild verification.
- `src/glue.rs` — Glue Compressor rebuild. `MEASURED_ANCHORS_R30_T12` encodes
  the canonical measured transfer (valid at the matrix pins — the detector is
  ballistics-aware: Attack/Release shift steady state, see D6); envelope
  measurement for the steps-long family.
- `src/echo.rs` — Echo tap-structure laws: hop = min(tL,tR), feedback applied
  once per hop from tap 3, taps 1–2 first-pass (measured exactly).
- `src/reverb.rs` — Reverb rebuild: mono render-equivalent IR of the pinned
  default chain — measured direct/pre-delay/early taps plus a seeded
  band-decayed noise tail whose per-band RT60 scales with stored `DecayTime`
  (RT60_b = k_b · decay_ms). Deterministic (xorshift64*, fixed seed).
- `src/verify.rs` — the gate: static ≤0.5 dB/step, spectral mean ≤1.0 dB
  (max band ≤3.0 dB), tail MAE ≤1.0 dB; reverb additions — floor-aware
  per-band RT60 fits (±10% at the default pin, ±20% at the scaling pins,
  spectral ≤1.5 dB mean per the reverb row). Thresholds from
  `reconstruction-backlog.md`.
- `tests/golden.rs` — `#[ignore]`-gated golden tests; they activate when
  `docs/research/ableton-live-12.0.25/harness/renders/` is present next to this
  repository. Run with `cargo test -- --ignored`.

## Semantics nailed down (2026-10-07 matrix)

Glue: threshold-referenced curve; `Range` = soft GR ceiling (dB);
`Ratio` = active separate slope parameter; makeup exactly additive (MU5);
MU10 deviations are the output soft-clipper + 16-bit render ceiling, not
detector topology. Echo: `Delay_Time` stored in seconds; pingpong hop =
min(tL,tR); feedback −6.02 dB/hop at 0.5. Reverb: RT60 ∝ stored DecayTime ms
(per-band coefficient k = 0.89/0.94/0.87/0.80 low→high at the gate bands);
double slope resolved as diffuse build-up (τ ≈ 75 ms) + single-slope tail.
Binary cross-check (structure level, `devices/glue-compressor.md`): separate
`OnRange`/`OnRatio` DSP callbacks — consistent; ballistics-aware dithered
detector kernel — consistent with D6.

## Status

Glue: static curve + envelope measurement gated green against golden renders.
Echo: tap laws encoded and unit-tested. Reverb: stochastic model gated green
against R1/R3/R4 (taps exact; per-band RT60 within 0.5–5.8% at the default
pin, 0.5–18.7% at the scaling pins; spectral mean 1.00 dB, worst band
2.89 dB — residuals and limits in `devices/reverb.md`, "Rebuild model").
Operator/Wavetable: measured via the MIDI harness; see `devices/` dossiers.
