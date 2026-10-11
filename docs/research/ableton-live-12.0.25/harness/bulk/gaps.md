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
