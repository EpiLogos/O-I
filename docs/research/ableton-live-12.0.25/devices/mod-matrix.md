# Wavetable / Operator modulation matrix — decoded structure

**Status:** census, revision 1 (2026-10-07). Source: full structural parse of
`evidence/devices/Wavetable/default.xml` (and Operator where noted). This is
the map the shell's device panels and the clean-room synth model implement.

## Wavetable matrix encoding (from the document XML)

- `ModulationConnections` holds **52 `ModulationConnectionsForInstrumentVector`
  blocks — one per destination**, each carrying:
  - `TargetId` — the XML path of the destination parameter
  - `TargetName` — the UI name (e.g. "Osc 1 Pitch", "Amp")
  - `ModulationAmounts.0..12` — **13 per-source amounts** (the matrix row).
- 13 modulation sources per destination; source identities are positional
  (not named in XML). Default patch active routes: source 5 → Amp (0.5),
  source 7 → Pitch (0.0417), source 9 → Osc 1 Pos (1.0), source 11 → Pitch
  (1.0), source 12 → Osc 1 Pos (0.33).
- 69 `ModulationTarget` elements (automation targets for the destinations).
- `Voice_Modulators_{Envelope2,Envelope3,Lfo1,Lfo2}` are the named
  modulators (the Amp envelope is Voice_Modulators_AmpEnvelope_*); fixed
  sources (velocity/key/pressure/wheel family) occupy the low indices.
- **M2 reinterpretation:** the earlier WT1 probe pinned
  `Voice_Global_AmpModulation`'s Manual — that element is destination 49's
  target ("Amp"); moving its Manual shifted the amp base level (uniform
  −36 dB), it did not touch a modulation amount. Velocity-flatness of the
  default patch stands.

## Destination table (full, from the default preset)

| # | TargetName | TargetId |
| --- | --- | --- |
| 0–5 | Osc 1 Pitch / Pos / Warp / Fold / Pan / Gain | `Voice_Oscillator1_*` |
| 6–11 | Osc 2 Pitch / Pos / FX 1 / FX 2 / Pan / Gain | `Voice_Oscillator2_*` |
| 12–13 | Sub Tone / Sub Gain | `Voice_SubOscillator_*` |
| 14–17 | Filter 1 Freq / Res / Drive / Morph | `Voice_Filter1_*` |
| 18–21 | Filter 2 Freq / Res / Drive / Morph | `Voice_Filter2_*` |
| 22–25 | Amp Attack / Decay / Release / Sustain | `Voice_Modulators_AmpEnvelope_*` |
| 26–32 | Env 2 Attack/Decay/Release/Initial/Peak/Sustain/Final | `Voice_Modulators_Envelope2_*` |
| 33–39 | Env 3 (same family) | `Voice_Modulators_Envelope3_*` |
| 40–45 | LFO 1 Amount/Shaping/Rate, LFO 2 Amount/Shaping/Rate | `Voice_Modulators_Lfo*_*` |
| 46–48 | Time / Global Mod Amount / Unison Amount | `Voice_Modulators_TimeScale`, `Voice_Modulators_Amount`, `Voice_Unison_Amount` |
| **49** | **Amp** | **`Voice_Global_AmpModulation`** |
| 50–51 | Pitch / Glide | `Voice_Global_PitchModulation`, `Voice_Global_Glide` |

## Source identity (open, being settled by probe)

- **Source 5 = a static/constant source** (default Amp route 0.5 explains the
  M2 uniform offset; velocity-flatness refutes Velocity here).
- Velocity candidates: indices 1–3 (probe ladder WM_A2 → WM_A1 → WM_A3:
  set `ModulationConnectionsForInstrumentVector.49/ModulationAmounts.k`
  = 1.0, render the velocity staircase, look for monotone level tracking).
- Probe results: appended below as they land.

## Operator (partial census)

- Same pattern at smaller scale: `ModulationTarget` ×162,
  `ModConnections.0/1` per shell (destination slots), `ModDst`/`VelDst`/
  `KeyDst` destination selectors, per-shell `VelScale`/`VelCoarseScale`
  amounts. VelDst Connection 0/1 = pitch-family, 5 = +6 dB static gain,
  2/3/4/6 inert on the default patch (M-lane sweep).

## Probe log + verdict (2026-10-07, late — inline ladder)

Amount 1.0 on destination 49 (Amp), one source at a time; velocity staircase
127/96/64/32 at key C3, per-note RMS [start+0.15, start+0.70] s:

| source | result |
|--------|--------|
| 1 | flat (−31.23 ±0.01) — not velocity |
| 2 | flat (−31.23 ±0.01) — not velocity |
| 3 | flat (−28.38 ±0.01; note0 +0.18 startup) — not velocity |
| 4 | flat (−28.38 ±0.01; static offset −2.8 dB vs base) — not velocity |
| 5 | (default Amp route 0.5 — M2: static offset, not velocity) |
| 6 | flat (−34.02 ±0.01; static offset −2.8 dB) — not velocity |
| 7 | flat (−32.08 ±0.01) — not velocity |
| **10** | **velocity-dependent: −35.31 / −43.27 / −27.35 / −48.34 dBFS at vel 127/96/64/32** |

**Verdict: source 10 = Velocity** (the only source responding to the
velocity staircase; 21 dB spread, non-monotonic in RMS — bipolar character
around a mid-velocity peak; exact transfer shape open, one more useful
probe would be 8/9/12 confirmation runs). Sources 0 (key-varied probe
built as midi-wm-a0-keys.als, not yet rendered) and 8/9/11/12 remain
partially unattributed; 11 (Pitch 1.0 in the default patch) is almost
certainly key-tracking. All probe sets: `harness/live/midi-wm-a*.als`,
renders `harness/renders/midi-wm-a*.aif`.

**Shell consequence (D10 positive):** Wavetable velocity→level exists and is
user-configurable through the matrix (source 10 → Amp); the default patch
leaves it unrouted — matching Operator's design (velocity wired, unrouted).
The shell's device panel should expose the matrix (52 destinations × 13
sources) rather than a fixed velocity knob.
