# MIDI instruments — golden-render evidence (Live 12.0.25, macOS arm64)

First instrument-dynamics captures: Operator and Wavetable (device class
`InstrumentVector` — that is Wavetable's real class name in the document
model) driven by crafted MidiClips through the same harness discipline as the
audio-FX lanes (master chain stripped, track/master Volume pinned 1.0, tempo
120, no warping). This lane needed its own set builder: the MidiClip crafting
went through five loader iterations before acceptance (see
`reconstruction-backlog.md` D7 for the full error history and the v4→v5
generator lesson).

## Clip model (both sets, structurally validated by the loader + render)

Arrangement MidiClip on one MIDI track: 4 notes at beats 0/2/4/6 (= k×1.0 s at
120 BPM), each 1.75 beats long (0.875 s sounding), key 48 (C3), velocities
127/96/64/32 (stored 1.0/0.7559/0.5039/0.2520). Render timeline confirms the
model: note blocks at 0/1/2/3 s, sound stops at 3.875 s, silence after the
release — in all three renders.

Analyzer: `harness/analyze_midi_notes.py` (per-note RMS in
[start+0.15, start+0.70], 100 ms onset windows, release windows after note-off,
1 s activity map).

## M1 — Operator, default patch (`M1_OPERATOR.aif`)

| note | start (s) | velocity | stored | L RMS dBFS | R RMS dBFS |
|------|-----------|----------|--------|------------|------------|
| 0 | 0.00 | 127 | 1.0000 | −32.77 | −32.77 |
| 1 | 1.00 | 96 | 0.7559 | −32.77 | −32.77 |
| 2 | 2.00 | 64 | 0.5039 | −32.77 | −32.77 |
| 3 | 3.00 | 32 | 0.2520 | −32.77 | −32.77 |

- **Velocity→level is FLAT — all four notes within 0.01 dB.**
- **M1 verdict: velocity is wired but unrouted by default.** Operator stores
  `VelScale=50` per oscillator, but the `VelDst` routing connections (2 slots,
  `ModConnections.0/1`) carry `Amount=0` — the velocity→level mapping cannot
  be measured from the default patch. Matches the binary's
  OnVelDst/OnVelScale callback split (coordinator-verified against the
  render). **High confidence** (flat to 0.01 dB over a 4:1 velocity range).
- Note-1 fundamental ≈130 Hz (zero-crossing estimate) — key 48 = C3 confirmed
  end-to-end; onset steady within 0.05 dB over the first 0.5 s (organ-like
  sustained envelope); release after note-off reaches the dither floor in
  ≈0.3–0.4 s.

## M1B — Operator, velocity routed (`M1B_VELROUTE.aif`; VelDst slot0/slot1 Amount=100, Connection 0/1)

| note | start (s) | velocity | L RMS dBFS |
|------|-----------|----------|------------|
| 0 | 0.00 | 127 | −80.74 |
| 1 | 1.00 | 96 | −80.75 |
| 2 | 2.00 | 64 | −80.75 |
| 3 | 3.00 | 32 | −80.74 |

- **Outcome (b): still flat** (within 0.02 dB) — **both routed destinations
  are non-level** (velocity-dependence not restored).
- The routing changed the sound drastically instead: overall level dropped
  ≈48 dB (−32.8 → −80.7 dBFS RMS) and the note-1 zero-crossing-implied pitch
  moved ≈130 Hz → ≈773 Hz. Destinations 0/1 are pitch-family parameters; which
  Connection values map to amplitude is **open** (enumerate Connection values
  in a later session).

## VD sweep — Operator VelDst Connection enum (`VD2`…`VD6.aif`; render lane 3, 2026-10-07)

One connection routed at a time: VelDst slot0 `Amount=100`, `Connection=k`
for k=2..6 (slot1 untouched at preset defaults 0/0); same 4-note velocity ramp
as M1. Analysis `analyze_vd.py`: per-note RMS + Goertzel fundamental (note 1).

| render | Connection | per-note RMS (vel 127→32) | vs M1 baseline | note-1 pitch |
|--------|-----------|---------------------------|----------------|--------------|
| M1_OPERATOR | (unrouted, Amount 0) | −32.77 ×4 flat | — | 131.0 Hz (C3) |
| VD2 | 2 | −32.77 ×4 flat | identical (≤0.12 dB all bands) | 131.0 Hz |
| VD3 | 3 | −32.77 ×4 flat | identical | 131.0 Hz |
| VD4 | 4 | −32.77 ×4 flat | identical | 131.0 Hz |
| VD5 | **5** | **−26.78 ×4 flat** | **+5.99 dB uniform, ALL bands** | 131.0 Hz |
| VD6 | 6 | −32.77 ×4 flat | identical | 131.0 Hz |

- **No velocity→level destination exists among Connections 2–6**: VD5's
  +5.99 dB is a *velocity-independent* output-gain offset (every note, every
  band, identical shift) — as a velocity modulation it does nothing here.
- **Connections 2, 3, 4, 6 are audibly inert on the default patch at
  Amount=100**: band-by-band identity with the M1 baseline to ≤0.12 dB
  (dither floor), pitch unmoved. Either no-op values or destinations whose
  target is inactive in this patch (filter-family candidates — the default
  patch's filter is near-transparent).
- Enum so far: 0/1 = pitch-family + level collapse (M1B, −48 dB + pitch
  130→773 Hz); 5 = static +6 dB output gain, velocity-flat; 2/3/4/6 = no
  audible effect (this patch). **The full 0–6 map is still not nameable from
  audio alone** — the loader accepted every value 2..6 without complaint (no
  clamp/reject observed), so the valid range includes at least 0..6.

## M2 — Wavetable (InstrumentVector), default patch (`M2_WAVETABLE.aif`)

| note | start (s) | velocity | stored | L RMS dBFS | R RMS dBFS |
|------|-----------|----------|--------|------------|------------|
| 0 | 0.00 | 127 | 1.0000 | −26.18 | −26.18 |
| 1 | 1.00 | 96 | 0.7559 | −26.06 | −26.06 |
| 2 | 2.00 | 64 | 0.5039 | −26.06 | −26.06 |
| 3 | 3.00 | 32 | 0.2520 | −26.06 | −26.06 |

- **Velocity→level is flat within 0.12 dB, and non-monotonic** (note 0 reads
  *hotter* than notes 1–3; a per-voice startup difference, not a velocity
  trend — notes 1–3 are identical to 0.01 dB across 3:1 velocity). **Verdict:
  velocity does not reach level in Wavetable's default patch either. High
  confidence on flatness; the routing topology behind it now inspected —
  see WT1/WT2 below.**
- Default patch is a decaying pluck: onset window decays −22.2 → −26.6 dBFS
  over the first 0.5 s of a note; release after note-off is gradual
  (−29.5 → −96 floor over ≈0.6 s) — much slower than Operator's ≈0.3 s.

## WT1/WT2 — Wavetable amplitude-stage probes (render lane 4, 2026-10-07)

XML finding first (`evidence/devices/Wavetable/default.xml`, read before any
pin): **no velocity-named parameter exists anywhere in the device XML** —
grep for `Vel*`/`*Velocity*`/`*Amplitude*` returns nothing. The amplitude-side
parameters that DO exist: `Volume` (Manual 0.3548134267, range 0..1 — the
device's only trim element), `Voice_Oscillator1_Gain` / `Voice_Oscillator2_Gain`
(1.0), `Voice_SubOscillator_Gain` (0.5012). The rest of the routing surface is
the mod matrix: 52 `ModulationConnectionsForInstrumentVector` rows
(TargetId = `Voice_*` param path) × 13 modulation sources
(`ModulationAmounts.0`…`.12`, plain Value attrs). The **only nonzero
amplitude-side routing in the default patch** is the "Amp" row
(`Voice_Global_AmpModulation`, Id 49) at source 5, amount 0.5 — the candidate
velocity carrier. Builder extension for this lane:
`Conn:<TargetId>#<ChildTag>=<Value>` pin form in `build_set_midi.py`
(mod-matrix cells cannot be pinned by tag alone — 52 same-tagged children).

Same 4-note velocity ramp as M2 (key 48, 127/96/64/32, beats 0/2/4/6).

| render | pin | per-note RMS L, vel 127→32 | vs M2 baseline |
|--------|-----|----------------------------|----------------|
| M2 (baseline) | default patch | −26.18 / −26.06 / −26.06 / −26.06 | — |
| WT1_AMPVEL | Amp row `ModulationAmounts.5`: 0.5 → **1.0** | −62.30 / −62.18 / −62.18 / −62.18 | **−36.12 dB, every note identically** |
| WT2_TRIM | device `Volume`: 0.3548 → **0.0887** (×0.25) | −38.22 / −38.10 / −38.10 / −38.10 | **−12.04 dB — exact** |

Verdicts:

- **WT2_TRIM (positive control): PASS.** Δ = −12.04 dB =
  20·log10(0.0887/0.3548) to the last 0.01 dB, onset shape and note structure
  identical to M2. The Volume pin reaches the voice and the per-note RMS
  pipeline is calibrated end-to-end.
- **WT1_AMPVEL: the Amp mod row is LIVE but VELOCITY-INERT.** Doubling the
  only nonzero amplitude-side routing dropped the whole patch −36.12 dB,
  identically on every note; the note-0 startup +0.12 dB quirk reproduces
  (confirming it is a per-render first-voice artifact, not velocity). Notes
  1–3 stay identical to 0.01 dB across 4:1 velocity at BOTH amounts, so
  source 5 does not carry note velocity to level on this signal. The uniform
  collapse fits an additive linear-gain reading — out gain ∝ |1 + amount·s|
  with a velocity-independent source idling near s ≈ −1 predicts −36.2 dB
  (0.50 → 0.0078) — a reading, not a measurement; mod-source identity is not
  nameable from audio alone (same lesson as the Operator VD sweep).
- **Wavetable verdict (closes the batch): no velocity→level parameter
  exists.** No Vel/Velocity/Amplitude param in the XML, and the single live
  amplitude-side mod routing is velocity-inert. Wavetable's velocity dynamics
  would require addressing a true velocity SOURCE index in the mod matrix —
  the identity of sources 0..12 is open (needs a binary callback census of
  `InstrumentVector` or a UI cross-reference). The device `Volume` is the
  measurable amplitude control; oscillator gains are the per-voice ones.

## Determinism

Protocol pairs for this lane were taken on the FX devices (G6, E1/E1b: max
|Δ| = 2 LSB16 export dither). The M renders go through the identical export
path; byte-determinism is not claimed.

## afinfo (one render)

```
File:           renders/M1_OPERATOR.aif
File type ID:   AIFF
Num Tracks:     1
Data format:     2 ch,  44100 Hz, lpcm (0x0000000E) 16-bit big-endian signed integer
estimated duration: 256.000000 sec
```

## Evidence

- Renders: `harness/renders/M1_OPERATOR.aif`, `M1B_VELROUTE.aif`,
  `M2_WAVETABLE.aif`, VD sweep: `VD2.aif` … `VD6.aif`, Wavetable probes:
  `WT1_AMPVEL.aif`, `WT2_TRIM.aif` (+ `.asd`)
- Sets: `harness/live/midi-operator.als`, `midi-operator-velroute.als`,
  `midi-instrumentvector.als` (coordinator-built via `build_set_midi.py`),
  `VD2.als` … `VD6.als` (same builder, VelDst slot0 pins), `WT1_AMPVEL.als`,
  `WT2_TRIM.als` (same builder + `Conn:` pin form)
- Analyzer: `harness/analyze_midi_notes.py`, `harness/analyze_vd.py`
  (VD sweep: per-note RMS + Goertzel fundamental)
- Class names confirmed via binary strings + document model: `Operator`,
  `InstrumentVector` (Wavetable)

## Confidence

- Clip model (timing, note length, key, tempo): **high** (three independent renders, timeline exact)
- Operator default velocity→level flat: **high** (0.01 dB over 4:1 velocity; VelDst Amount=0 explains it)
- Operator velocity unrouted by default (VelScale stored, VelDst unconnected): **high** (matches binary OnVelDst/OnVelScale split)
- M1B destinations non-level: **high** (flat + −48 dB level collapse + pitch shift)
- VD sweep: Connections 2/3/4/6 audibly inert on default patch at Amount 100; 5 = velocity-independent +6 dB gain; no velocity→level destination in 0..6: **high** (five renders, band-identity to dither floor)
- Wavetable default velocity→level flat: **high** (0.01 dB across notes 1–3, non-monotonic)
- Wavetable `Volume` = working output trim; pin mechanism reaches the voice: **high** (WT2: −12.04 dB exact at ×0.25, structure preserved)
- Wavetable Amp mod row (`Voice_Global_AmpModulation` ← source 5) live but velocity-inert: **high** (WT1: −36.12 dB uniform at amount 1.0; velocity-flat at both amounts; note-0 quirk reproduces = render artifact)
- Wavetable has NO velocity→level parameter: **high** (XML grep negative; only live amplitude-side routing velocity-inert); mod-source identity 0..12: **open** (not nameable from audio; needs binary census / UI cross-reference)
- Envelope shapes (Operator sustained/fast release; Wavetable pluck/0.6 s release): **medium** (single patch, 100 ms windows)

## Limitations / unverified

- Only the default patches captured; Operator's four oscillators, Wavetable's
  modulation matrix and envelope pages unswept.
- Velocity destinations enumerated 0..6 by render (see VD sweep); none is a
  velocity→level destination on the default patch. Connection semantics
  beyond 0..6 and per-destination names remain unverified — audio alone does
  not name them; 2/3/4/6 may act on targets inactive in this patch.
- Wavetable mod-matrix SOURCE indices 0..12 are unnamed (the 52-row matrix is
  mapped by TargetId; the 13 source columns are not). The −36.12 dB WT1
  collapse is consistent with a negative-idling source but the source's
  identity/mechanism is unverified.
- Velocity range 32–127 only (0–31 untested); single key (C3); no overlap/polyphony.
- 44.1k/16-bit export of internal float: dither floor −96 dB limits release-tail
  resolution below that.
- No cross-check against the binary beyond the VelDst/VelScale callback note.
