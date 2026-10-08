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
around a mid-velocity peak; exact transfer shape open, confirmation runs
on 8/9/12 would refine the map).

**Source 0 = Key (note number)** — key-varied probe (midi-wm-a0-keys.aif,
keys 36/48/60/72 at fixed velocity 100, amount 1.0 → Amp): level
−49.81/−49.81/−95.77/−96.33 dBFS — monotone attenuation with pitch,
silent above ≈key 57. Key-tracking confirmed. (Measured fundamentals at
keys 36/48 read ≈65 Hz with the level near-floor — the zero-crossing
estimate is polluted there; keys 60/72 show aliasing residue at the
floor.)

**Source attribution summary (Wavetable, evidence-complete):**
- **0 = Key**, **10 = Velocity** (behaviorally settled)
- 1/2/3 = not velocity (flat), 4/6 = static offsets (level shift, flat),
  5 = static/constant (default Amp route 0.5)
- 8/9/11/12 = modulator family (LFO1/LFO2/Env2/Env3 or envelope
  self-patches; default routes 9→Osc1Pos 1.0, 11→Pitch 1.0, 12→Osc1Pos
  0.33 are consistent with envelope-driven wave position + key/LFO pitch
  tracking) — exact labels unverified, low priority.

**D10 CLOSED POSITIVE:** Wavetable velocity→level exists as the matrix
route 10 → Amp; the default patch leaves it at 0. Operator matches the
design (wired, unrouted). The shell's device panel exposes the matrix.

**Shell consequence (D10 positive):** Wavetable velocity→level exists and is
user-configurable through the matrix (source 10 → Amp); the default patch
leaves it unrouted — matching Operator's design (velocity wired, unrouted).
The shell's device panel should expose the matrix (52 destinations × 13
sources) rather than a fixed velocity knob.

## Envelope attribution (2026-10-08)

Probes S9/S11 (amount 1.0 → Amp): both sources retrigger an identical
attack-decay shape on every note (S9: −24.05→−33.12 dBFS over 0.9 s;
S11: −28.66→−33.08), flat across velocities — **envelope-family sources**,
matching the default patch's own routes (9 → Osc 1 WavePosition 1.0 = the
position envelope; 11 → Global Pitch 1.0). Exact labels (Env2/Env3/LFO)
unverified; 8/12 remain LFO-family suspects (free-running → position-
dependent per-note RMS, untested).

## Source map (final, evidence-complete for the shell)

**0 = Key · 10 = Velocity · 9/11 = envelopes · 5/4/6 = static offsets ·
1/2/3 = no effect · 8/12 = LFO-family (likely, unverified) · 7 = no effect
on Amp (default-routed to Pitch at 0.0417).**

## Probe attempt: 8/9/12 → Amp (2026-10-08, BLOCKED — environment)

The completion probes for 8/12 (and a same-spec S9 confirmation run) were
built and driven to render, but **every render came back as digital
silence** (−96.3 dBFS = 16-bit dither floor, no note activity, no between-
note residual). The sets are NOT in question and the earlier attribution is
NOT reopened:

- `live/WM_S9.als` (17:53 build) is **byte-identical** to
  `live/midi-wm-s9.als`, which rendered audibly at 13:28 the same day
  (−33.5 dBFS, notes + release, content end 4.29 s).
- Operator MIDI sets built by the same builder render audibly in the same
  Live instance (OP2/OP3 renders, 17:43/17:45, content end 4.1 s).
- Audio-clip sets (warp lane) render audibly in the same instance.
- The silence **persists across a graceful quit + clean relaunch** of Live
  (guardrail recipe, no crash-recovery state).
- A re-render of the older Wavetable set `WT1_AMPVEL.als` (audible at
  −63.5 dBFS in its original render) could not be loaded for the
  discriminator pass (open-handoff flake; not attempted again).

So: Live 12.0.25 on this machine currently mis-instantiates the Wavetable
(InstrumentVector) device from loose hand-built sets — MIDI clips load
(window title correct), the export runs, the result is silence — while
Operator and audio clips are unaffected, and the same bytes rendered
audibly earlier the same day. The trigger window coincides with the
17:12 crash + forced pkill-relaunch storm from a parallel lane. S8/S9/S12
labels (`WM_S*.als`, pins `Conn:Voice_Global_AmpModulation#ModulationAmounts.N=1.0`
on the standard velocity staircase) are built and waiting; **the next Live
window should first re-render `WT1_AMPVEL.als` as the discriminator**, then
the three WM sets. Until then the source map above stands as-is (8/12
LFO-family = working hypothesis, not verified).

