# Operator — voice synthesis (oscillator A + amp envelope), Live 12.0.25

**Status:** M6 phase 1 model landed and gated (`packages/live-dynamics/src/operator.rs`,
`operator_voice_golden_gate`). Renders: render lane 5, 2026-10-08. Probes
built earlier by a prior lane (`harness/live/OP2_SUSTAIN24.als` …
`OP5_KEY60.als`, same builder as M1, `build_set_midi.py`).

## Clip model (identical to M1, `midi-instruments.md`)

4 notes at beats 0/2/4/6 (= 0/1/2/3 s at 120 BPM), key 48 (C3, f0 =
130.8128 Hz), each 1.75 beats (0.875 s sounding), velocities 127/96/64/32 —
velocity is unrouted at the default patch, so all four notes are acoustically
identical (M1). OP5: single note, key 60 (C4, 261.6256 Hz). Analyzer:
`harness/analyze_operator.py`; fit script retained in the session log.

## Probe pins (stored `Manual` values; base = default patch)

| render | pin | stored value | meaning |
|--------|-----|--------------|---------|
| M1_OPERATOR | — (default) | Sustain 1, OscA Vol 1, Globals 0.1258925349 | baseline |
| OP2_SUSTAIN24 | `Operator.0/Envelope/SustainLevel` | 0.06309572607 (−24 dB) | separates sustain from DecayLevel → exposes the decay segment |
| OP3_OSCA050 | `Operator.0/Volume` | 0.5 (−6.02 dB) | oscillator A level |
| OP4_TRIM025 | `Globals/Volume` | 0.0314731337 (= default ×0.25) | device output trim |
| OP5_KEY60 | key 60, single note | — | pitch law + level key-invariance |
| OP6_DECAY | `Envelope/DecayTime` (first `DecayTime` in document order = `Operator.0/Envelope`) | 3000 (default 1000) | DecayTime stored→τ mapping; OP2's sustain pin repeated so the decay is audible |

Render format 44.1 kHz/16-bit stereo AIFF, 256.0 s. All four landed via
`lane3_render_relaunch.sh` (the runtime-swap driver wedged on Live's
Project-enforcement Save panel — see the session log; relaunch-with-document
is the reliable path for loose sets).

## Parameter table

The panel-facing descriptor table for this device lives at
`packages/live-dynamics/src/params.rs` (`OPERATOR`, 23 rows) — built from
`evidence/devices/Operator/default.xml` (+ `preset-choir.xml`, which widens
the observed WaveForm extent to 22), with this dossier's fitted laws in the
row notes: level knobs linear amplitude, the envelope topology above,
velocity unrouted by default (routing is the `MidiCtrl/VelDst` matrix, not
the VelScale knob). Oscillator shells store as `Operator.0`..`Operator.3`
(A..D), each holding `Envelope` (Times/Levels/Slopes + `TimeVelScale`),
`Tune` (Coarse/Fine/VelCoarseScale), `Volume`, `WaveForm`, `Phase`,
`Feedback`, `VelScale`, `KeyScale`, `IsOn`; the device output level is
`Globals/Volume`. Its ids are the document paths the OP probes pin; the
table is served to panels on `/api/device-descriptors` (`PANEL_DEVICES`),
and `params.rs` tests assert the probe pins and the τ = 0.120 s / 175 dB/s
references against it.

## Envelope topology (the OP2 finding)

The default-patch family sounded by oscillator A follows this segment map,
with stored levels A-Level/D-Level/S-Level/R-Level and times Attack/Decay/
Release:

1. **Attack** (0.1 ms stored): dB-linear rise from AttackLevel (−70 dB
   floor) to **DecayLevel** (1.0). Unresolvable at the pin — the first
   10 ms window is already at full level (M1/OP2 −0.27 dB rel).
2. **Decay** (1000 ms stored): falls from DecayLevel toward **SustainLevel**
   as an exponential **in amplitude**: `a(t) = sus + (peak − sus)·e^(−t/τ)`,
   τ = 0.120 s fitted at this pin. OP2 refuted both alternative shapes:
   dB-linear decay (residuals > 3 dB mid-curve) and a "sustain = output
   level knob" flat reading (predicts −56.77 dBFS steady; render −49.81).
3. **Sustain**: flat at SustainLevel. With DecayLevel = SustainLevel (the
   default patch) the decay is sonically inert — M1's organ-like plateau.
4. **Release** (400 ms stored): dB-linear from the **level at note-off** to
   ReleaseLevel (−70 dB) across ReleaseTime. The rate is therefore
   `level_db + 70) / 0.4 s`, not a constant: from 0 dB → 175 dB/s (M1, OP5),
   from ≈−25 dB → ≈115 dB/s (OP2). A fixed-rate reading is refuted by OP2's
   release windows.

Level knobs are **linear amplitudes**: OP3's ×0.5 and OP4's ×0.25 land on
`20·log10(ratio)` to the last 0.01 dB. Pitch is A440 equal temperament;
output level is key-invariant (OP5 −32.77 dBFS = M1).

## Fitted constants (all gated against the renders)

| constant | value | evidence | residual |
|----------|-------|----------|----------|
| RESIDUAL_GAIN | 0.25825 (−11.76 dB) | M1 peak −29.76 dBFS / stored −18 dB trim; held across OP3/OP4 | ≤0.01 dB (peak law, 3 renders) |
| DECAY_TAU_S | 0.120 s (at DecayTime 1000 ms) | OP2 full 10 ms-window curve | RMS 0.11 dB, max 0.22 dB |
| τ(DecayTime) mapping | linear through origin, τ ≈ 0.121 s per 1.0 s stored | OP6_DECAY: 0.3623 s at 3000 ms vs OP2 re-fit 0.1211 s at 1000 ms (ratio 2.99) | ±0.6 % on the proportional law (two pins) |
| release law | rate = (level + 70)/0.4 dB/s | M1/OP5: 175–180 dB/s; OP2: ≈115 dB/s | windows ≤0.62 dB |
| pitch law | f = 440·2^((k−69)/12) | M1 131.0 Hz, OP5 261.5 Hz (0.5 Hz grid) | ≤0.14 % |
| level laws | linear amplitude × | OP3 −38.79 (pred −38.79), OP4 −44.81 (pred −44.81) | ≤0.01 dB |

## DecayTime mapping (OP6_DECAY, 2026-10-08, render lane 3)

OP2's sustain pin repeated with `Operator.0/Envelope/DecayTime` pinned to
3000 (the first `DecayTime` in document order — the same element family the
OP2 pin used). Analyzer: `harness/analyze_operator_decay.py` (10 ms-window
exponential fit, peak free with sustain tied to it by the stored ratio;
**validated on OP2: τ = 0.1211 s** vs the documented 0.120).

- Note-1 100 ms windows (1.0–1.8 s): −33.82 / −36.01 / −38.14 / −40.22 /
  −42.23 / −44.14 / −45.92 / −47.53 dBFS — one clean exponential.
- **τ = 0.3623 s** (10 ms fit; 100 ms integration-modeled cross-check
  0.3629 s; fit residual −34 dB rel peak). Onset aligned at 1.000 s.
- **Law: τ ∝ DecayTime.** 0.3623 / 0.120 = 3.02; against the OP2 re-fit
  (0.1211): 2.99. Linear through the origin at **τ ≈ 0.121 s per 1.0 s
  stored** (two pins, ±0.6 %). The attack-floor hypothesis constant
  (τ = DecayTime/ln(1/AttackLevel) = 0.1241 s/s) is close but rejected at
  ~2.7 % — the mapping is proportional with a measured constant, not that
  derivation.

Level anomaly (OP2 and OP6, independent renders): the fitted audible peak is
**−32.75 dBFS in both** — ≈3.0 dB below M1's plateau (−29.76) — while the
onset→sustain span stays exactly the stored −24.00 dB. Pinning SustainLevel
shifts the whole voice down ≈3 dB, not just the tail: an unmodeled
loudness-compensation stage in Operator (open item below).

## Gate residuals (operator_voice_golden_gate, 2026-10-08)

Thresholds (stated in `tests/golden.rs` before analysis): steady per-note
RMS ±0.5 dB; release 20 ms windows ±2.0 dB while above −80 dBFS; OP5
fundamental ±1 % / level ±0.5 dB; M1 h2 ≥60 dB below h1.

| render | steady Δ (4 notes) | release Δ (6 windows) |
|--------|--------------------|-----------------------|
| M1 | 0.00 / 0.00 / 0.00 / −0.00 | +0.05 … +0.62 |
| OP2 | −0.10 / −0.09 / −0.10 / −0.12 | +0.05 … +0.62 |
| OP3 | 0.00 ×4 | — |
| OP4 | 0.00 ×4 | — |
| OP5 | 0.00 (single note), 261.50 Hz | — |

M1 harmonics: h1 −29.76 dBFS, h2 −92.70 dBFS (63.0 dB below — pure sine at
key 48).

## What did not fit / open items

- **Flat-sustain envelope** (the pre-render model): refuted by OP2. Sustain
  is a *decay target*, not an output level; the gate's OP2 block records the
  revision. The decay segment's behavior when DecayLevel ≠ SustainLevel was
  previously untested — it is now measured at one pin and modeled.
- **Fixed release rate** (175 dB/s): refuted by OP2; the rate is set by the
  note-off level (time-normalized to ReleaseTime).
- **τ(DecayTime, levels) mapping**: **RESOLVED for direction and rough law
  (2026-10-08, OP6_DECAY)** — linear through the origin, τ ≈ 0.121 s per
  1.0 s stored (two pins, ±0.6 %); the attack-floor constant (0.1241 s/s) is
  near but rejected at ~2.7 %. Still open: a third pin (e.g. 500 ms) to
  test curvature, and the **DecayLevel ≠ SustainLevel decay-target case**
  (both pins hold DecayLevel = 1.0).
- **Pinned-sustain voice shift**: the OP2/OP6 renders sit ≈3.0 dB below the
  M1 plateau at all points (fitted peak −32.75 dBFS in both) with the stored
  −24.00 dB span intact — Operator compensates voice loudness when the
  envelope levels change. Mechanism open; the crate's peak law uses the M1
  constant and would read ≈3 dB hot on pinned-sustain patches.
- **Waveform beyond sine**: at key 60 (OP5) a faint h2 appears at ≈−88 dBFS
  (−58 dB below h1; at key 48 h2 sits at the −93 dBFS dither floor). Whether
  that is Operator waveshaping at higher pitch or export-dither correlation
  is open — 5 dB above the floor, inaudible, and the gate only asserts the
  key-48 floor. h3..h10 stay at/below the floor in all renders.
- **Attack shape**: stored 0.1 ms — below export resolution at any probe in
  this lane; modeled dB-linear, unverified (irrelevant at ≤1 ms pins).
- **AttackLevel's role as a start floor** is inferred from the stored value
  and the release path (release ends at the same −70 dB floor); a separate
  AttackLevel pin would confirm it.

## Confidence

- Level knobs linear (osc A Volume, Globals Volume): **high** (exact to
  0.01 dB, two independent probes + baseline).
- Pitch law + key-invariant level: **high** (two keys, ≤0.14 % with a 0.5 Hz
  scan grid).
- Envelope topology A→D→S→R with these level targets: **high** (M1/OP3/OP4
  exact; OP2 onset + steady + release all consistent with one model).
- Decay shape exp-in-amplitude, τ = 0.120 s: **high** (full-curve fit
  0.11 dB RMS at one pin; τ ∝ DecayTime confirmed at a second pin,
  ratio 2.99 vs 3.0).
- τ(DecayTime) proportionality: **medium-high** (two pins, ±0.6 %; no
  third pin, and the 0.121 constant is measured, not derived).
- Release time-normalized dB-linear: **high** (two level regimes, ≤0.62 dB).
- Sine purity at key 48: **high** (h2..h10 at dither floor); at key 60:
  **medium** (h2 ≈ −88 dBFS, cause open).

## Evidence

- Renders: `harness/renders/OP2_SUSTAIN24.aif`, `OP3_OSCA050.aif`,
  `OP4_TRIM025.aif`, `OP5_KEY60.aif`, `OP6_DECAY.aif` (+ `.asd`), baseline
  `M1_OPERATOR.aif`; sets `harness/live/OP2_SUSTAIN24.als` …
  `OP5_KEY60.als`, `OP6_DECAY.als`.
- Analyzers: `harness/analyze_operator.py`,
  `harness/analyze_operator_decay.py` (τ fit; self-validates on OP2);
  gate:
  `packages/live-dynamics/tests/golden.rs::operator_voice_golden_gate`;
  model: `packages/live-dynamics/src/operator.rs`.
- Render-lane note: OP4's export dialog was found open (a prior lane died
  mid-export); the runtime-swap driver raised Live's Project-enforcement
  Save panel and wedged the instance; all four renders completed through
  `lane3_render_relaunch.sh` (guarded osascript quit → relaunch with the
  set as launch document). No pkill; no unguarded keystroke.
