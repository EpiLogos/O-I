# Phaser-Flanger (PhaserNew) binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SearchProbe/BlockProbe scripts + `nm`, no re-import). NOT FOR REDISTRIBUTION.
Never enters product source (`packages/live-dynamics`). Companion capture:
`evidence/binary/phaser-flanger-decompiles.txt` (nm census incl. the full
Modulation/LFO surface, create chain, mode handler, DSP tail, main chain, LFO
tick). Form follows `compressor-derivation.md`; claims graded: **[D]
decompiled-confirmed** (capture cited), **[B] byte-decoded**, **[H]
unverified hypothesis** — no behavioral renders ran in this lane; per README
every [D]/[B] claim awaits the golden-render cross-check before it gates a
rebuild.

The Live 12 "Phaser-Flanger" is `OPhaserNewProcessor` /
`devices::phaser::Phaser` (device string "PhaserNew", display name
"Phaser-Flanger") over a `blocks::phaser` DSP object (state block ≥ 0x1508
bytes; the mode handler wipes bytes 0x30…0x1500 on every mode change). One
engine, three modes of `blocks::phaser::PhaserFlangerMode`: **0 = Phaser**
(variable-notch allpass chain), **1 = Flanger** (bool at obj+0x708; delay
line with 2^x-shaped depth), **2 = Doubler**. The legacy `OPhaserProcessor`
and `OFlangerProcessor` remain in the binary; this dossier covers PhaserNew.
The LFO section (`model::Modulation`) reuses the shared blocks `StereoLfo`
cluster — dual LFO (Frequency/Sync/SyncedRate and Frequency2/Sync2/SyncedRate2),
Waveform enum `blocks::StereoLfoWaveform`, Spin, DutyCycle, LfoBlend,
PhaseOffset, and an envelope follower (EnvelopeEnabled/Amount/Attack/Release).

## 1. What runs when (call topology)

- **Create** `SOnProcessorCreate<OPhaserNewProcessor>` 0x1018c2fa4 → wrapper
  0x1018c2fe0 (shell, param block shell+0x268) → construction
  `FUN_1018805d8` → `FUN_101880274` [D] — same device-kit shell family as
  Chorus (DSP object pointer at shell+0xb8; sr/tempo/transport callback
  pairs at shell+0xd8…0x1a8).
- **Init / Reset / Exit** trampolines 0x10188567c / 0x101885790 /
  0x10188578c [D, census only — bodies not captured].
- **Per-sample**: `CalcMainSingleSample` invoke 0x101885984 [D] — same gate
  bytes (0x200–0x203) and message-ring drain as Chorus, then
  `func_0x000103b8b500(inL, inR, dsp+0xf10 view)` with the DSP process
  decomposed as: LFO tick `func_0x000103b8c010(dsp+0x640)` → main chain
  `FUN_103b8bb74(dsp, &tapOut, &mod4)` → tail (env LPF bank + SVF/asin
  tracker + peak latch); status via `func_0x000103b8bb4c`, silence query
  `func_0x000103b8b7c8` (hold counter 0x830 vs threshold 0x600).
- **Setters**: continuous params via `OnRampEvent<P>` (same generic ramp
  law as Chorus §1: current/inc/target doubles; exact phaser ramp bases not
  extracted **[H]**); enums/bools via `OnAutomatableFloatEvent`. Full
  trampoline census in the capture §1, including the whole
  `model::Modulation` surface: Amount, Waveform, Frequency, Frequency2,
  Sync, Sync2, SyncedRate, SyncedRate2, PhaseOffset, Spin, SpinEnabled,
  DutyCycle, LfoBlend, EnvelopeEnabled/Amount/Attack/Release. The Waveform
  invoke (0x101890f28) stores the `StereoLfoWaveform` enum straight into
  **obj+0x678** [D]. Mode has both an automatable (0x101887758) and a ramp
  (0x101887781c? see census) entry.

## 2. The mode handler (0x1018915a0) — state reset + seeds

`Phaser::setCallbacks` mode lambda [D]:
- `obj->mode = m`; `*(byte*)(obj+0x708) = (m == 1)` — **Flanger flag**.
- Zeroes the state block (ints 0xc…0x540 = bytes 0x30…0x1500): all notch
  states, LFO, envelope, delay state.
- Seeds 4 floats `0.25 · 0.15643427 = 0.03910857` (0.15643427 = sin 9°)
  at obj+0x790…0x79c — the asin-tracker smoother states [B].
- Peak-hold counters obj+0x830/0x834 ← −1 ("no hold"); env/LFO scratch
  ints 0x1dc…0x1e3, 0x1f0…0x1f2, [499] ← 0.

## 3. The LFO (shared StereoLfo tick, `func_0x000103b8c010` at dsp+0x640)

[D] Per sample: a stereo **phase pair** (obj+0x6c8) advances by an increment
pair (obj+0x6d0) and wraps by select (`phase ≥ 1 → phase − 1`) — branchless
sawtooth phase. An **envelope follower** (state obj+0x6e0 pair) tracks
`|in|` with attack coefficients (obj+0x6f0) when rising and release
coefficients (obj+0x700) when falling. A shaper call into the shared
`StereoLfo` cluster (`func_0x0001020debdc`, args not recovered) turns phase
into the 4-float modulation vector the engine consumes; the mode scalars
4.0 and −3.0 materialize here **[shape function open]**. The Waveform enum
(Sine/Triangle/Ramp/… per the `StereoLfoWaveform` type), Spin, DutyCycle,
LfoBlend and PhaseOffset application all live behind that call — graded
**[H except the phase/wrap/envelope laws, which are D]**. The dual-LFO
parameters (Frequency2/Sync2) imply a second phase pair elsewhere in the
state block; not located **[open]**.

## 4. The mechanism, plainly

**Main chain `FUN_103b8bb74(dsp, tapOut, mod4)` [D]** — mode-dispatched:

- **Mode 0 — Phaser (allpass chain).** `n = *(long*)(obj+8)` = notch count.
  Per channel (4-wide NEON over two channel-pairs):
  1. `v = mod4 · 4.0`; blend weights `q = obj[0x1cc+i]` (ModulationBlend
     **[H on naming]**).
  2. Two **2^x exponent assemblies**: `a = 2^(v·(1−q) + 127)`,
     `b = 2^(v·q + 127)` — clamp [0,255], int part ×2^23, mantissa poly
     `((0.013487903·t + 0.0521745)t + 0.24128748)t + 0.6930501` [B].
  3. Notch frequency ratio `F_i = obj_float[0x580+4i] · b` (floor 0.01);
     coefficient `ω_i = obj_float[0x570+4i] · a · 2π / sr` — min with
     3.14096 (0x40488f2d), ×0.5, rational-tanh, ×2, ×0.5 → `k_i`; TPT-SVF
     coefficient `g1 = k/(k(F+k)+1)` — the same bounded-coefficient form as
     Chorus §4 [B constants, D structure].
  4. **Cascade, iterated backwards** (last notch first): accumulator update
     per notch over the state pairs at obj+0x40+32i; then the
     **closed-form feedback** re-entry
     `y = (fb1·fb2·acc + in) / (1 − fb1·fb2·den)` with per-channel feedback
     products `obj[0x590+4i]·obj[0x5a0+4i]` (Feedback × mod-depth trim
     **[H on the second factor]**), then the forward TPT state-update loop.
  The chain is a Chamberlain-form state-variable allpass bank: the UI's
  Notches parameter is the stage count; CenterFrequency/Spread shape the
  `obj[0x570/0x580]` base arrays (per-notch frequency bases) **[H — setter
  sites not captured]**.
- **Mode 1 — Flanger.** Delay-target pair copied obj+0x7a0 → obj+0x5f0
  region; per-channel scale `2^(mod4·(−3.0) + 127)` (0xc0400000), same
  clamp/assembly — the mod vector swings the delay by 3 octaves of 2^x
  **[B slope, H on the tap law]**.
- **Mode 2 — Doubler.** Crossfades the stored mod snapshot (obj+0x7c0
  region) with the live vector by weights obj+0x7d4, then scale
  `2^(v·0.5 + 127)`, floor 1.0.
- **Common tail:** delay = min(scale, `obj_float[0x610]` — the max-delay
  cap, FlangerDelayTime/DoublerDelayTime domain), then the backward-indexing
  ring write (`func_0x103b8c100`, 0x10-byte slots) storing
  `in + wet·fb1·fb2` per channel pair — feedback re-enters the delay input
  through the same product form as the Phaser [D].

**Tail `func_0x000103b8b500` [D]:**
1. LFO tick (§3) returns the 4-float vector; env follower state stored
   obj+0x820/0x824.
2. **Four TPT one-poles** (`g` from floats obj+0xfe0…0xfec: `w =
   min(c·2π/sr, 3.14096)·0.5` → rational-tanh → ×2, `k = g/(g+2)`) over
   states obj+0xff0…0xffc with inputs (L, R, 0, 0) — asymmetric smoothing
   (attack/release LPF pair) **[H on role — envelope shaping candidate]**.
3. **4-channel TPT SVF + asin tracker**: Butterworth √2 form from
   obj+0xf50…0xf5c, band+low states obj+0xdc0…0xe20;
   `u = clamp((band+low)·4 + 0.1)·π/2` → asin series (coeffs
   −0.00018284567 / 0.008304825 / −0.16664949 / 0.99999833, ×0.25) →
   one-pole smoothed (obj+0xe60…0xe6c) into obj+0xf90…0xf9c — same tracker
   family as Chorus §4.7 **[D structure, H semantic]**.
4. **Peak latch:** |mix estimate| vs thresholds obj+0x828, counter
   obj+0x830 (reset on over-level, else increments; −1 = disabled) [D].

## 5. What remains open (honest residuals) + confidence

**Open:**
- The StereoLfo shape function (`func_0x0001020debdc` cluster, shared with
  AutoPan/AutoFilter LFOs): waveform table, Spin (LFO2 rate offset),
  DutyCycle, LfoBlend, PhaseOffset application — the lane's "LFO shapes incl.
  fixed/special modes" question resolves only to the phase/wrap law + the
  enum storage site until that cluster is decoded [D-negative].
- Per-ramp DSP slot bases for phaser params; Notches int setter law;
  CenterFrequency/Spread → per-notch base arrays; Feedback factor names;
  Flanger tap interpolation (the ring read bodies); Init/Reset bodies.
- Which states the Doubler snapshot uses; the InvertWet application site.
- Everything above awaits the golden-render gate (COVERAGE row empty).

**Confidence:**
- Inventory (incl. the full Modulation surface), mode handler, phase/wrap +
  envelope laws, 2^x shaping constants, TPT coefficient form, closed-form
  feedback shape, asin-tracker structure: **high** as decompile readings —
  single-source (LiveRE2 captures) cross-checked against the nm census.
- Mode naming (0/1/2 = Phaser/Flanger/Doubler): mode 1 = Flanger is **D**
  (the flag + Doubler/FlangerDelayTime param pairing); the 0/2 naming is
  **H** resting on the parameter names (Notches ↔ Phaser engine; Doubler-
  DelayTime ↔ mode-2 cap).
- ModulationBlend/Feedback factor identities, LFO shape semantics, Doubler
  internals: **low** — [H], do not build on them.
- No behavioral claim of any grade is made; no golden-render corpus for
  Phaser-Flanger exists yet.
