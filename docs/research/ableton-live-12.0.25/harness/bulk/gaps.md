# Bulk lane gaps

Max* stub folders (no .adv, no device XML) — skipped, noted here only:
- Instruments/Max Instrument (Max for Live stub)
- Audio Effects/Max Audio Effect (Max for Live stub)
- MIDI Effects/Max MIDI Effect (Max for Live stub)

Devices with no factory default state found — no manifest entries, flagged for a later lane:
- Instruments/External Instrument: no .adv in Defaults or device folder (recursive)
- Audio Effects/External Audio Effect: no .adv in Defaults or device folder (recursive)
- Audio Effects/Tuner: no .adv in Defaults or device folder (recursive)

Adaptations (documented, not invented):
- Instruments and MIDI FX use the M1 4-note velocity clip for pin renders (an impulse WAV cannot excite them).
- MIDI FX default/pin renders will be silent audio unless an instrument sits downstream; their .als still carries the device state for offline diffing. Audible pairing flagged for a later lane.
- 'Legacy' folder expanded to its 5 real sub-devices (Chorus, Flanger, Frequency Shifter, Phaser, Redux Legacy), each on its first preset .adv.
- Pins skip params with no numeric MidiControllerRange and discrete-choice params (Type/Mode/Shape/...).

## Build results (queue_slice1.jsonl, queue_rest.jsonl)
- built OK: 435/435

## Sample-player defaults render SILENCE — correct, and now supplemented (2026-10-11)

The BULK default sets for Sampler and Simpler reference **no sample** (their
`.adv` defaults carry an empty `<SampleParts/>`), so `BULK-{sampler,simpler}-default-m1-velocity`
render digital silence (−96.33 dBFS) — the correct output of an empty sample
player, not a driver failure (the repeated NO-EXPORT-PANEL ledger lines were
the driver retrying a set that legitimately produces silence; the render
was restored from the driver stash as the honest default-state artifact).

**Fix — loaded probes built**: `harness/build_sampler_loaded.py` copies the
`MultiSamplePart` STRUCTURE from a factory preset (names/ranges only — no
factory audio copied) and loads OUR OWN test signal
`signals/steps-1k.wav` (clean-room, redistribution-safe) at RootKey 48
(the M1 clip's key). Renders:
- `BULK-sampler-loaded-steps.aif` — RMS **−46.78 dBFS** (audible)
- `BULK-simpler-loaded-steps.aif` — RMS **−56.51 dBFS** (audible)

These are the DSP-gating entries for Sampler/Simpler (filter/env/warp
behavior); the default-state entries remain in the corpus as the
empty-slot truth.
