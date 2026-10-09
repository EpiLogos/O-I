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
| Auto Filter | FX | ✓ (30 params) | — | ✓ (37 callbacks, cutoff-LUT law, own detector) | — | — |
| Delay | FX | ✓ | — | ✓ (devicekit, mapping laws, crossfade curves) | — | — |
| Multiband Dynamics | FX | — | — | ✓ (1/2/3-band, octaves domain, crossover) | — | — |
| Limiter | FX | — | — | ✓ (max-pyramid lookahead, ceiling law) | — | — |
| Gate | FX | — | — | ✓ (hysteresis + dual detector) | — | — |
| Redux | FX | ✓ (10 params) | — | ✓ (steps=2^(bits-1), softness law) | — | — |
| Overdrive | FX | ✓ (7 params) | — | ✓ (closed-form shaper x−4/27x³, PreserveDynamics=compressor) | — | — |
| Erosion | FX | — | — | ✓ (LCG noise + dual delay; downsampler REFUTED) | — | — |
| Chorus-Ensemble | FX | ✓ | — | ✓ (mode table decoded, cubic interp) | ✓ (surface) | — |
| Phaser-Flanger | FX | ✓ | — | ✓ (3 modes, TPT-SVF cascade closed form) | ✓ (surface) | — |
| Filter Delay | FX | ✓ (35 params) | — | ✓ (per-band, NO cross-band feedback) | ✓ (surface) | — |
| Grain Delay | FX | ✓ | — | ✓ (sin² window pairs, MINSTD, pitch walk) | ✓ (surface) | — |
| Beat Repeat | FX | ✓ | — | ✓ (FIVE processors, division tables, NR-LCG chance; transient detector REFUTED) | ✓ (surface) | — |
| Channel EQ | FX | ✓ | — | ✓ (SVF shelf algebra, gain-dependent corners) | ✓ (surface) | — |
| EQ Three | FX | ✓ | — | ✓ (Butterworth crossovers, per-band gating) | ✓ (surface) | — |
| Drum Buss | FX | ✓ | — | ✓ (drive law closed form, boom resonator laws) | ✓ (surface) | — |
| Pedal | FX | — | — | ✓ (Newton-Raphson Shockley diodes per type) | — | — |
| Dynamic Tube | FX | — | — | ✓ (bias law decoded; tube LUTs = corpus) | — | — |
| Amp | FX | — | — | ✓ (Softube bundle — mechanism only) | — | — |
| Cabinet | FX | — | — | ✓ (Softube bundle, partitioned FFT — mechanism only) | — | — |
| Arpeggiator | MIDI | — | ✓ (rate table byte-decoded, Fisher-Yates LCG) | ✓ | — | — |
| Chord / Pitch / Scale | MIDI | — | ✓ (storage model) | ✓ | — | — |
| Velocity / Note Length | MIDI | — | ✓ (length + release-vel decay laws closed) | ✓ | — | — |
| Note Echo | MIDI | — | ✓ (NEGATIVE: no compiled device — M4L) | — | — | — |
| Drift | INST | ✓ (90+ surface in decompile) | — | ✓ (devicekit, 32-voice, dispatch census) | — | — |
| Utility | FX | ✓ (14 params) | — | ✓ (9 calc bodies, BassMono TPT law; dB/pan closed forms open) | ✓ (surface) | — |
| Corpus | FX | ✓ (38 params, 26 presets) | — | ✓ (AAS A-framework; filter = 2-cascade Butterworth BP law; DSP engine = corpus material) | — | — |
| Resonators | FX | ✓ (30 params) | — | ✓ (5-slot ping-pong bank, phase-compensated delay tuning, 20-calc dispatch) | — | — |
| Hybrid Reverb | FX | ✓ (54 params) | — | ✓ (convolver+algorithmic legs, IR = sample-slot pair; tail NOT shared with Reverb) | — | — |
| *43 more devices* | | — | — | — | — | — |
| Warp engines ×6 | clip | ✓ (modes 0–5) | ✓ (D9 + seg90) | — | — | partial |
| FollowAction | clip | ✓ | ✓ (anchoring) | — | — | session driver open |
| Groove pool | session | ✓ (.agr format) | partial | — | — | — |
| Racks ×4 | rack | — | — | — | — | — |
| Mixer/sends | session | — | — | — | — | — |
