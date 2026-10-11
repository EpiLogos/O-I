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

## Build results (queue_repair.jsonl)
- built OK: 14/14

## Pin-quality lane (2026-10-11) — audit, repair, bounded re-render

Audit: `bulk/inert_pins.md` (`harness/analyze_bulk_pins.py`) — of 273 BULK
pins, 108 were dither-identical (max|Δ| ≤ 2 LSB) to their device's
same-signal default: 43 vacuous (MIDI FX silent lineage, Impulse empty
slots) + 35 no-op values (= device default) + 30 genuine (section gates,
excitation limits, the saturator colour defect); 6 further no-op pins read
"live" on render-side variance alone. After the repairs below the corpus
stands at 168 live / 62 inert / 43 vacuous (see inert_pins.md header).

Builder repair: `build_bulk_manifest.py` `pick_pins` + `adjust_defaults`
now move no-op round-robin values off the device default in place (41 pins
regenerated; labels/params unchanged; manifest.jsonl + queues rewritten).

Bounded re-render batch (`bulk/run_repair_batch.sh`, 17 labels, all
`repair-rendered` in `run_ledger.jsonl`): 5 saturator colour pins +
3 saturator probes + 9 rebuilt no-op pins (8 now clearly live, 1
excitation-inert) + 1 variance check. New sets: `live/BULK-saturator-probe-*`
(queue `bulk/queue_color_probes.jsonl`, builder
`build_saturator_color_probes.py`).

Worklist for the next bounded pass: the remaining 20 no-op pins carry
repaired values in the manifest while their .als/render pairs hold the old
value (rebuild from `bulk/queue_repair.jsonl` pattern + manifest rows,
then render). Satrator-colour laws need a non-stored-state route (see
`bulk/inert_pins.md` Diagnosis §1). MIDI FX / Impulse vacuous lineages need
a carrier (sampler-loaded precedent above).
