# Chorus-Ensemble (Chorus2) binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SearchProbe/BlockProbe/DataProbe/RefsProbe scripts + `nm`, no re-import).
NOT FOR REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/chorus-ensemble-decompiles.txt` (nm census,
create chain, DSP init, mode table, const-pool decodes, calc + voice bank,
side stages, ramp setters). Form follows `compressor-derivation.md`; claims
are graded: **[D] decompiled-confirmed** (capture cited), **[B] byte-decoded**
(const pool / NEON immediates), **[H] unverified hypothesis** — no behavioral
renders ran in this lane; per README every [D]/[B] claim still awaits the
golden-render cross-check before it gates a rebuild.

The stock Live 12 "Chorus-Ensemble" is `OChorus2Processor` /
`devices::chorus::ChorusDevice` over a `blocks::chorus` DSP object (0xb50
bytes, device state at +0x918). It is a bank of 1–3 **per-voice modulated
delay lines** (one shared stereo ring, per-voice fractional taps), mode-shaped
by a per-mode parameter record (`ChorusModeParameters`) that carries the voice
count, per-voice LFO phase offsets, and a per-voice delay-time provider
lambda. The pre-12 `OChorusProcessor` (`AChorus`, "Chorus") also remains in
the binary; this dossier covers Chorus2 only. All continuous parameters ride
generic **ramp objects** (double current/inc/target) — the same transport the
Phaser and (in pair form) Filter Delay use.

## 1. What runs when (call topology)

- **Create** `SOnProcessorCreate<OChorus2Processor>` 0x1018bc348 → wrapper
  0x1018bc384 (device-kit shell, param block at shell+0x268) → construction
  `FUN_1018a4344` [D]: builds the shell callback pairs (OnSampleRateChanged /
  OnTempoChanged / OnTransportPlayingStateChanged / OnBeatTimeJump at
  shell+0xd8…0x1a8), then allocates and constructs the DSP object via
  `FUN_1018db2d0` (0xb50 bytes): 13 delay-line read pointers at +0x10…+0x490
  seeded to the sample buffer at +0x4d0; device state sub-object at +0x918
  built by `FUN_1018db3a8` (twelve parameter ramp objects at +0x50/+0xb0/
  +0x118/+0x178/+0x1d8/+0x228/+0x288/+0x2d8/+0x340/+0x3a0/+0x408/+0x470) +
  `FUN_1036e2a5c(sr, obj)` (state init, below); `obj[0xb48] = 1`.
- **Init** (trampoline 0x1018d6f68) [D]: device-kit bookkeeping only — links
  five ramp-event lists into the shell event registry; the DSP-side law is
  the ctor + `FUN_1036e2a5c`.
- **Sample-rate / tempo / transport callbacks** registered at construction;
  `OnSampleRateChanged` invoke 0x1018dee94 [D, census]. No NewRate/NewTempo
  trampoline exists — sr reaches the DSP object directly (stored at
  obj+0x9e0 = state+0x1e0 by the init; refreshed by the sr callback body,
  not captured).
- **Reset / Exit** (0x1018d707c / 0x1018d7078) [D, census only].
- **Per-sample**: `CalcMainSingleSample` invoke 0x1018d71f4 [D] — gates on
  shell bytes 0x200 (device on) / 0x201–0x203 (ramp + pending-reset flags),
  drains the message ring at shell+0xa8, then calls the DSP process
  `func_0x000103b72408` → `FUN_1036e32a8(dspObj, inPair)` and reads the
  status byte from `func_0x000103b7242c`.
- **Setters** — all continuous params are `OnRampEvent<P>` trampolines
  (census §1 of the capture): Rate 0x1018daa00, Amount 0x1018daa18, Feedback
  0x1018daa30, Shaping 0x1018da8a8, Width 0x1018daea4, Warmth 0x1018daebc,
  DryWet 0x1018daeec, VibratoOffset 0x1018dac78, HighpassFrequency
  0x1018dae8c, OutputGain 0x1018daed4, Mode 0x1018da774; InvertFeedback /
  HighpassEnabled / Mode(automatable) via `OnAutomatableFloatEvent`
  0x1018da6b4/0x1018dabbc/0x1018dadd0. **Ramp law** [D]: `target(+0x40) =
  value; if steps≠0: inc(+0x38) = (value − current(+0x30))/steps; else
  current(+0x30) = value` — event token appended into the list at obj+0x440
  (cap 0x88 slots). Ramp-object bases confirmed by body: Shaping +0x50, Rate
  +0xb0, Amount +0x118, Feedback +0x178, Width +0x340, Warmth +0x3a0, DryWet
  +0x470; the remaining bases (+0x1d8/+0x228/+0x288/+0x2d8/+0x408) map to
  VibratoOffset/HighpassFrequency/Mode/OutputGain **[H — 5 bases, 4 params;
  Mode crossfade likely owns one]**.

## 2. The state-slot ledger (DSP object, device state base = obj+0x918)

Writers: CTOR = `FUN_1036e2a5c`, MODE = the mode lambda (§3), RAMP = setter,
CALC = `FUN_1036e32a8`/`FUN_1036e385c`.

| slot (state) | role | writer | value / law |
|---|---|---|---|
| +0x00 | enabled byte | CTOR | 1 |
| +0x08…+0x28 | delay-ring manager | CTOR | capacity `sr·0.05 s` → **50 ms** max delay [D] |
| +0x30/+0x78/+0xc0 | three 0x48-byte voice slots (stride 0x48) | CTOR/MODE | template from `func_0x0001036e3ec4` (body open) |
| +0x108 | 1e-6f pair | CTOR | denominator guard [B] |
| +0x118…+0x168 | mode-parameter record | MODE | see §3 |
| +0x148/+0x150/+0x158 | **Amount ramp** (current/inc/target pairs) | RAMP Amount / MODE | Classic defaults (0.5,0.5)/(0.5,0.5)/0; Ensemble target (0.5,0.5) [B] |
| +0x16c | mode flags word (low dword of +0x168) | MODE | 0x00010100 Classic / 0x00010101 Ensemble / 0 Vibrato; byte 0 = per-channel modulator, byte≠0 = shared mono modulator (per CALC) |
| +0x170/+0x178 | mode provider invoke/closure | MODE | the per-voice delay-time lambda (§3) |
| +0x188…+0x198 | per-voice delayed-pair array (≤3×8 B) | CALC | written by the voice bank |
| +0x1a8…+0x1b4 | filter coefficient pair | CTOR | `c = min((31.4139, 42411.7)/sr, (π̃,π̃))·0.5`, rational-tanh, ×2 — stored L,L,R,R [B] |
| +0x1b8…+0x1c8 | post-filter state | CALC | |
| +0x1c8 | 0.03901f pair | CTOR | asin-smoother state init [B] |
| +0x1e0 | sample rate (Hz, float) | CTOR | |
| +0x1e8 | Width side gain | RAMP Width | used in the M/S stage |
| +0x1ec | Vibrato depth scale | RAMP VibratoOffset **[H]** | multiplies both channel delays in Vibrato (MODE tail) |
| +0x1f0 | vibrato provider capture | MODE | passed to the provider call |
| +0x1f8/+0x1fc | dry gain / wet trim | RAMP DryWet **[H]** | mix law: `dry·g_dry + wet·g_wet·1.0` |
| +0x1d8/+0x1dc | wet gain pair | RAMP OutputGain **[H]** | |
| +0x220 | mode int | MODE | 0 Classic, 1 Ensemble, 2 Vibrato |
| obj+0x200…0x203 | shell gate bytes | shell CALC | on / ramp / crossfade / pending-reset |

## 3. The mode table (Ensemble mode laws)

`ChorusDevice::connectToModel` mode lambda 0x1018dece4 [D], const pool [B]:

| mode | voices | provider lambda | flags word × float | voice phase pairs (L,R) |
|---|---|---|---|---|
| 0 Classic | 2 | `getClassicModeParameters` | 0x00010100 × 4.0f | v0 (0.25, 0.0); v1 (0.0, 0.25) @0x104e245f8/0x104e24600 |
| 1 Ensemble | 3 | `getEnsembleModeParameters` | 0x00010101 × 4.0f | v0 (0.0, 0.0) @0x104e24628; v1/v2 @0x104e24630/38 (pool not separately dumped) |
| 2 Vibrato | 1 | `getVibratoModeParameters` | 0x00000000 × **100.0f** | v0 @0x104e24670/78 |

Mode switch rewrites the parameter record, re-seeds the voice slots
(`func_0x0001036e3f14(flags, voice)`, `…4064`, `…3ffc(voice, &phasePair)` at
stride 0x48), and, for **Vibrato only**, replaces the delay-scale pair with
`scale · *(float*)(state+0x1ec)` before the voice bank — the Vibrato
depth scalar enters as a straight multiplier [D]. The mode-parameter pair
slots +0x130/+0x138 are the same shared pool pair (0x104e24640/48) in all
modes [B].

## 4. The mechanism, plainly (per sample)

`FUN_1036e32a8` [D]:
1. Optional one-pole smoothing of the input pair (`k = g/(g+2)`; state
   +0x200 region) — the amp/stereo stage front end.
2. `mid = (L+R)·0.5`; **Ensemble** (flags byte ≠ 0) substitutes `mid` for
   both modulator inputs — the Ensemble mode is driven mono [D].
3. Voice-weight dot product: `Σ voice_delayed[i] · weight(+0x130+8i)` over
   the voice count (the stereo-spread sum; weights and the +0x188 array
   interplay graded [H]).
4. Voice bank `FUN_1036e385c` [D]: per voice — advance LFO
   (`func_0x0001036e406c`), call the mode's delay-time provider
   `(*(*(obj+0x170)))(obj+0x1f0, obj+0x178, &phase, voice)` → per-channel
   delay (ms), scale by sr, clamp to `[1, cap−2]` samples, then a
   **4-point cubic (Catmull-Rom form)** read from the backward-writing
   stereo ring — taps int−1…int+2, derivative weights 0.5, fractional
   weights from pool 0x104e245e0/e8 (0.5/0.25). Per-voice delayed pair
   stored at +0x188+8i; serial accumulate
   `acc += delayedL · *(float*)(+0x148+8i)` — voices feed the sum serially
   (voice 1 reads voice 0's accumulated input as its own input driver
   **[H — accumulation order D, semantic H]**).
5. Pre-bank gain stage `FUN_1036e3668` (when byte +0x04): per channel
   `a = 127 − |x·0.5287 + 0.0025|·2.88539` → clamp [0,255] → two chained
   2^x exponent assemblies (mantissa poly 0.013487903 / 0.0521745 /
   0.24128748 / 0.6930501, `(1−y)/(1+y)` reflection) — a dB↔linear gain
   shaping built from the 2.5 ms pool constant's singleton **[B constants,
   H semantic]**.
6. Width: M/S with side gain `*(float*)(+0x1e8)` when byte +0x02 — the
   Width knob is a side-channel gain in the mid/side domain [D].
7. Post filter `FUN_1036e3af4` (when byte +0x03): TPT/SVF-form lowpass
   (`g = c/(c(c+√2)+1)`, c from +0x1a8) on mid & side, then
   `u = clamp((band+low)·4 + 0.1)·π/2` through an **asin series**
   (coeffs −0.00018284567 / 0.008304825 / −0.16664949 / 0.99999833, ×0.25),
   one-pole smoothed — candidate pitch/level tracker feeding Warmth/Shaping
   **[D structure, H semantic]**.
8. Mix: wet-only mode multiplies by the wet pair (+0x1d8/+0x1dc); mixed mode
   `out = dry·(+0x1f8) + wet·(+0x1d8|dc)·(+0x1fc)`; meter tail latches the
   per-channel peak against thresholds +0x108/+0x10c with a hold counter at
   +0x110 [D].

## 5. What remains open (honest residuals) + confidence

**Open:**
- The mode provider lambda math bodies are NEON stubs in the decompiler
  (`NEON_fmov(0x3f800000,4)` shapes) — the per-voice delay-time laws
  (Classic/Ensemble/Vibrato ms formulas) need a raw-asm decode [D-negative].
- Voice template `func_0x0001036e3ec4`, LFO advance `func_0x0001036e406c`
  (shape/rate application — where Rate Hz and VibratoOffset land), and the
  HighpassEnabled/HighpassFrequency filter site (the model has the params;
  the calc's +0x03 branch is a candidate, not a proof) [open].
- Exact roles of the +0x130 vs +0x148 weight arrays; OutputGain/DryWet
  application beyond the mix law; Reset/Exit bodies; meter-tail semantics.
- Ensemble v1/v2 phase pairs (0x104e24630/38) not dumped [B-negative].
- The four unassigned ramp bases (§1); LFO wave-shape (this device exposes
  no Waveform param — the LFOs are fixed-shape per mode **[H]**).
- Everything in §4 awaits the golden-render gate (COVERAGE row empty).

**Confidence:**
- Class/inventory, ramp transport, mode table + const pool, ring/interpol-
  ation structure, mix/width laws: **high** as decompile readings —
  single-source (LiveRE2 BlockProbe captures), cross-checked only against
  the nm census; no second reading was done.
- Voice-accumulation semantics, asin-stage purpose, pre-bank gain stage:
  **low** — graded [H], do not build on them.
- No behavioral claim of any grade is made; no golden-render corpus for
  Chorus-Ensemble exists yet.
