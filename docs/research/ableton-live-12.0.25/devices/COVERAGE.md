# Coverage ledger — FULL PROGRAMME (stipulated 2026-10-09)

**Scope (binding, owner directive): full reconstruction — every Live 12 Suite
device (13 instruments, 46 audio effects, 11 MIDI effects = 70 devices), full
feature parity across racks (Instrument/Audio/Drum/Effect + macros), clips
(warp engines ×6, clip envelopes, follow actions, launch semantics), the
session model (scenes, tempo, groove pool, mixer/sends), and the render
pipeline. Target: clean-room Rust (`packages/live-dynamics` + `live-shell`)
passing the same verify gate per device. Nothing is out of scope until it is
gated.**

Method per device (the campaign's standing order, now enforced):
1. **Binary leads the mechanics** — `rea` against `~/tools/live-re/ghidra-proj2/LiveRE2.gpr`
   (persistent, healthy): call topology → state-slot ledger → constants,
   glue-derivation style (`devices/glue-perblock-derivation.md` is the form).
2. **Official evidence** — the device's factory default `.adv`/preset XML:
   full parameter tree, ranges (MidiControllerRange), defaults. Free.
3. **Bulk golden renders validate** — one manifest, one queue, one lock: every
   device renders its default + parameter pins through the three test signals;
   agents then work offline from documents + decompiles and gate against the
   corpus. Live time is batched, not dribbled.

Status ledger (updated as lanes land; gate = crate passes vs golden corpus):

| device | class | param surface | behavior doc | binary derivation | crate | gate |
|---|---|---|---|---|---|---|
| Glue Compressor | FX | ✓ | ✓ (perblock §1–9) | ✓ | ✓ | ✓ PASS |
| Echo | FX | ✓ | ✓ (rounds 1–5) | partial | ✓ (mod wired) | ✓ PASS |
| Reverb | FX | ✓ | ✓ (+refinements) | comb-probe | ✓ (stereo+HF wired) | ✓ PASS |
| Operator | INST | ✓ | ✓ (A + B modulator) | partial | ✓ (B wired) | ✓ PASS |
| Wavetable | INST | ✓ | ✓ (rev 4+, N=1–8) | partial | ✓ | ✓ PASS |
| Compressor | FX | ✓ (25 params) | — | ✓ (log2 closed-form; LUT=corpus) | ✓ (skeleton, LUT pending) | — |
| Saturator | FX | ✓ (17 params) | — | ✓ (chain+curve laws, type enum decoded) | — | — |
| EQ Eight | FX | ✓ (85 params) | — | ✓ (8-band cascades, Butterworth pole-Q sets, adaptive Q) | — | — |
| Auto Filter | FX | ✓ (surface module) | — | — | — | — |
| Utility | FX | ✓ (surface module) | — | — | — | — |
| Redux | FX | ✓ (surface module) | — | — | — | — |
| Overdrive | FX | ✓ (surface module) | — | — | — | — |
| Filter Delay | FX | ✓ (surface module) | — | — | — | — |
| Auto Filter | FX | ✓ (30 params) | — | ✓ (37 callbacks, cutoff-LUT law, own detector) | — | — |
| Delay | FX | ✓ | — | ✓ (devicekit, mapping laws, crossfade curves) | — | — |
| Multiband Dynamics | FX | — | — | ✓ (1/2/3-band, octaves domain, crossover) | — | — |
| Limiter | FX | — | — | ✓ (max-pyramid lookahead, ceiling law) | — | — |
| Gate | FX | — | — | ✓ (hysteresis + dual detector) | — | — |
| Redux | FX | ✓ (10 params) | — | ✓ (steps=2^(bits-1), softness law) | — | — |
| Overdrive | FX | ✓ (7 params) | — | ✓ (closed-form shaper x−4/27x³, PreserveDynamics=compressor) | — | — |
| Erosion | FX | — | — | ✓ (LCG noise + dual delay; downsampler REFUTED) | — | — |
| Arpeggiator | MIDI | — | — | ✓ (28 setters, synced-rate table ×14 [B], Random LCG shuffle, deferred engine) | — | — |
| Chord | MIDI | — | — | ✓ (6 slots × Shift/Degrees/Velocity/Chance, strum family, dirty recompute) | — | — |
| Pitch | MIDI | — | — | ✓ (int semitone slots, StepUp/Down = Pitch±StepWidth clamp ±127) | — | — |
| Scale | MIDI | — | — | ✓ (12 user-mapping ints, InternalScale stored −1-offset, global scale-list walk) | — | — |
| Velocity | MIDI | — | — | ✓ (setters+defaults; Drive/Compand stored negated; transform open) | — | — |
| Note Length | MIDI | — | — | ✓ (length law + 5 ms floor, own synced table ×13, release-vel decay exp law) | — | — |
| Note Echo | MIDI | — | — | negative: no compiled device in 12.0.25 (bundled M4L [H]; evidence log) | — | — |
| *52 more devices* | | — | — | — | — | — |
| Warp engines ×6 | clip | ✓ (modes 0–5) | ✓ (D9 + seg90) | — | — | partial |
| FollowAction | clip | ✓ | ✓ (anchoring) | — | — | session driver open |
| Groove pool | session | ✓ (.agr format) | partial | — | — | — |
| Racks ×4 | rack | — | — | — | — | — |
| Mixer/sends | session | — | — | — | — | — |
