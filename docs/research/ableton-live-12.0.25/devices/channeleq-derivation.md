# Channel EQ (ODeviceKitDeviceProcessor<ChannelEqDevice>) binary derivation — per-sample layer (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SearchProbe/CallTargetsProbe/BlockProbe/XrefProbe/DataProbe, no re-import).
NOT FOR REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/channeleq-decompiles.txt`. Form follows
`compressor-derivation.md`; claims graded: **[D] decompiled-confirmed**
(capture cited), **[B] byte-decoded** (nm/objdump/const pool), **[H]
unverified hypothesis** — no behavioral renders ran in this lane; per README
every [D]/[B] claim still awaits the golden-render cross-check before it
gates a rebuild.

The stock Channel EQ is NOT an `O*Processor` of the Compressor/Glue family:
its processor is the device-kit shell
`ODeviceKitDeviceProcessor<ableton::devices::channel_eq::ChannelEqDevice>`
(create `OProcessorCreateManager::SOnProcessorCreate<OChannelEqProcessor>`
0x1018bc0fc → wrapper 0x1018bc138 → shell ctor `FUN_1018a3e0c` [D]), and the
DSP is a 0x8a0-byte `ChannelEqDevice` object at shell+0xb8, built by
`FUN_1018d4238(sr)` [D]. Parameters arrive as device-kit model events
(`TickableSampleRateDeviceModel<model::ChannelEq>`), not `SProcessorFunc`
float setters: the model layer names the six parameters in the device
definition strings — **HighpassOn** (bool) and **LowShelfGain, MidGain,
MidFrequency, HighShelfGain, Gain** (floats) [B: mangled-string census].
The "4-band" UI maps to low shelf + mid bell + high shelf, an on/off
high-pass, and an output Gain stage.

## 1. What runs when (call topology)

- **Create** 0x1018bc0fc → wrapper 0x1018bc138 [D]: device-kit shell (param
  block at shell+0x268); allocates the 0x8a0 `ChannelEqDevice` and registers
  the transport callbacks (`OnSampleRateChanged`, `OnTempoChanged`,
  `OnTransportPlayingStateChanged`, `OnBeatTimeJump` — device-kit
  `CallMemberFunc` thunks [B]). A sub-object (`func_0x0001018d4504`) holds
  six 0x60-stride records at +0x10/+0x70/+0xd0/+0x130/+0x190/+0x1f0, all
  pointing at +0x230 — the six **tickable components** [D].
- **Init** `SProcessorFunc<Init>` 0x1018d1888 [D]: links the scheduler lists,
  registers the component chain; **Reset** 0x1018d1c24 [D]: zeroes the filter
  state pairs at device+0x6b0…0x878 (the per-section state quads).
- **Per-sample** `CalcMainSingleSample` 0x1018d1dd0 [D]: gated by the device
  bools at shell+0x200 (X) / +0x201 (On) / +0x202 (active) / +0x203
  (ramp-active). When running it (a) polls the HighpassOn ramp
  (`func_0x000103b720f0(device+0x680)`), (b) ticks the component chain —
  `component->vt[+0x18]()` over the `device+0x230` array, count at
  `device+0x670` [D], (c) calls `func_0x000103b71ff0(device+0x680, &io)` —
  the ramp-model tick that advances the parameter ramps and refreshes
  metering. The component tick bodies are virtual dispatches and were NOT
  captured (§4).
- **Parameter events**: floats arrive as ramp events —
  `OnRampEvent<LowShelfGain>` 0x1018d3c58 [D] (and template siblings for
  MidGain 0x1018d3c70, MidFrequency 0x1018d3c88, HighShelfGain 0x1018d3ca0,
  Gain 0x1018d3cb8) write a linear ramp {current +0x80, slope +0x88, target
  +0x90} (per-channel doubled) into the device, then enqueue the record in
  the worklist at `sub+0x440` (capacity 0x88). The ramp converts dB → linear
  per sample with the exp2-fast bit trick: `e = dev[0x58] + dev[0x5c]·dB +
  127`, clamped ≤ 255; linear = `2^frac-poly · 2^int` assembled as
  `((int)e << 23) | poly-mantissa` [D; the dev+0x58/0x5c scale/offset values
  not decoded — §4].
- **Coefficient rebuilds** (the "setters"): the five float lambdas of
  `ChannelEqDevice::setCallbacks` — `InvokeFunctionFactory<...UlfE>`
  0x1018d629c, `UlfE0` 0x1018d63d4, `UlfE1` 0x1018d64a0, `UlfE2` 0x1018d6568,
  `UlfE3` 0x1018d66e4 — plus the bool lambda 0x1018d6278
  (`*(byte*)(dev+0x20) = value` [D]). HighpassOn as automatable float event
  (`OnAutomatableFloatEvent<HighpassOn>` 0x1018d39f8) writes dev+0x18
  (ramp flag), +0x20/+0x30 (value, L/R) and the bool `(0.5 <= v)` [D].

## 2. The state-slot ledger (device object, byte offsets)

| slot | role | writer | value / law |
|---|---|---|---|
| +0x680 | sample rate (float) | ctor, OnSampleRateChanged | sr Hz |
| +0x690…0x6a0 | 1.0 quad | ctor | output-gain init |
| +0x6c0…0x6e8 | fixed one-pole LP coeff pairs {1/(1+g), −(1−g)/(1+g)} | ctor | g = tan law below; corner C = 502.65485 → **160.0 Hz** |
| +0x6f0…0x708, +0x760…0x778, +0x7f0…0x808, +0x860…0x878 | section state quads | Reset/CALC | zeroed |
| +0x710…0x758 | SVF section A: g quad @0x710, k = 1.649378 @0x720, 1.0 @0x730, k @0x740 | ctor | C = 1167.8611 → **371.73 Hz**, Q = 1/k = 0.6063 |
| +0x780…0x7c8 | SVF section B: g @0x780, k = 2.0 (Q = 0.5) | ctor | C = 9424.778 → **3000 Hz** |
| +0x7d8…0x7e0 | 1500.0 quad | ctor | default MidFrequency value [H] |
| +0x810…0x84c | SVF section C: g @0x810, k = 1.649378 @0x820 | ctor + UlfE2 | C = 18221.238 → **5800 Hz** — the high-shelf corner |
| +0x850…0x858 | 1.0 quad | ctor | section C gain init |
| +0x880…0x88c | SVF section D: g only | ctor | C = 138230.08 → **44000 Hz** — clamps to w = π (no-op at any sr) |
| +0x890 | bool = 1 | ctor | init-done flag [H] |
| +0x50…0x230 | five parameter ramp records (0x60 stride: LowShelfGain, MidGain, MidFrequency, HighShelfGain, Gain) | OnRampEvent, lambdas | {+0x38 value quad, +0x40 target, +0x50/0x58 section coefficient slots} |
| +0x18…0x38 | HighpassOn record {+0x18 bool, +0x20 value quad, +0x30 L/R} | bool lambda, float event | on = (0.5 ≤ v) |
| +0x80/+0x88/+0x90 | active ramp {current, slope, target} (doubles) | OnRampEvent | per-sample linear interpolation |
| +0x670/+0x230 | component count / component array | Init | tick = vt+0x18 |

**The g law (every section, every rebuild)** [D]: `w = min(C/sr, π)`,
`t = w/2`, and the tan approximation

```
g2 = 2 · t·(0.99999946 − 0.09652461·t²) / (1 + (−0.42986727 + 0.009981878·t²)·t²)
```

is stored as the section's g quad (four float lanes = L/R × 2). This is the
Zavalishin/TPT zero-delay-feedback SVF parameter `g = tan(π·fc/sr)` with a
rational tan approximation inlined.

## 3. The mechanism, plainly

**Structure.** The device owns five fixed-or-parameterized SVF sections plus
one fixed one-pole LP, all precomputed at ctor and rebuilt by the lambdas on
parameter events. Band roles, by lambda fingerprint [D formulas, H role
binding]:

- **LowShelfGain** (`UlfE` 0x1018d629c): gain stored LINEAR, clamped ≤ 5.6
  (the ±15 dB window 0.1778…5.623 [B: 10^(±15/20)]); corner frequency
  depends on gain: `norm = (v − 0.18)/5.42`,
  `fc = 101·norm + 201·(1−norm)` Hz — the corner sweeps **201 → 101 Hz** as
  the boost rises. Shelf mapping: `g' = g/v^0.25`, `k' = 1.6492962·√v`, and
  v itself stored beside the section — the SVF high-shelf algebra applied to
  the low band (gain-inverted variant).
- **MidGain / MidFrequency** (`UlfE0` 0x1018d63d4 / `UlfE1` 0x1018d64a0) share
  one record: freq quad at +0x54 (written by UlfE1 from
  `w = min(2π·v/sr, π)`, `g = 2·tan-approx(w/2)`), gain quad at +0x58
  (written by UlfE0); each rebuild applies the other's stored value:
  `k-pair = 2/√G`, `2√G` — the SVF bell/shelf gain pairing. Which lambda is
  Gain vs Frequency is a naming inference [H]; the two-law coupling is [D].
- **HighShelfGain** (`UlfE2` 0x1018d6568): rebuilds section C (5800 Hz fixed
  corner) with the same shelf law as the low shelf (`g/v^0.25`,
  `k = 1.6492962·√v`), plus a second fixed section at
  `norm = (clamp01(v) − 0.18)/0.82`, `fc = 22000·norm + 8730·(1−norm)` Hz —
  an **air band whose corner rides the shelf gain (8730 → 22000 Hz)**.
- **Gain** (`UlfE3` 0x1018d66e4): plain linear copy into the output-gain quad
  (+0x10…+0x19 of its record) — no filtering.
- **HighpassOn**: bool at dev+0x20; ramped via the float-event path. The
  fixed 371.73 Hz SVF section A (Q = 0.6063) is the only section in the right
  range to be the HP corner [H — the HP↔section binding is not directly
  decompiled; the component tick bodies that would show it are virtual].

**Analog-mode curve difference** (the lane question): the Analog-mode of
Channel EQ is realized as *different fixed sections and shelf constants*, not
a separate curve set: the ctor's sections (160 Hz LP, 371.7 Hz SVF, 3000 Hz,
5800 Hz shelf, 44 kHz no-op) and the shelf constants k = 1.6492962 / Q = 0.5
/ the 8730–22000 Hz air band ARE the Analog character — a fixed analog-style
SVF cascade rather than the parametric-curve approach of EQ Eight. A mode
switch was not found in the model census (no "Analog"/"Mode" parameter
string in `model::ChannelEq` [B-negative]) — in 12.0.25 the character is
hardwired [D-negative on a mode parameter; H on the marketing mapping].

**Smoothing.** All float parameters are linear ramps in the dB (shelf/HP
value) domain, converted to linear per sample by the exp2-fast bit trick
(§1), then the section coefficients are rebuilt per ramp step by the lambdas
— i.e. coefficient updates ride the ramp, not the audio callback.

## 4. What remains open (honest residuals)

- **The component tick bodies** — the actual per-sample filter recursion for
  each band — are virtual calls (`vt+0x18`) on the six objects at
  `sub+0x230`; not captured. Section→band binding (which g quad feeds which
  recursion, and the exact HP corner) is therefore [H] above.
- **Ramp dB-scale constants** dev+0x58/0x5c (the dB→exponent scale/offset)
  and the exp2-poly tail of `OnRampEvent` after the mantissa assembly.
- **The lambda→parameter binding** rests on fingerprints (corner ranges,
  shelf algebra, storage layout), not on the `setCallbacks` registration body
  (which binds model properties to lambdas — not captured).
- The 160 Hz one-pole LP and 3000 Hz SVF consumers (sidechain/meter/analyzer
  feed vs audio path) — open.
- Per README: no golden-render corpus exists for Channel EQ (COVERAGE row
  empty); every claim above awaits the behavioral gate.

## 5. Confidence

- Create/shell/ctor/init/reset topology, the g law, the fixed section table,
  the ramp law and its exp2 conversion, the five lambda laws: **high** as
  decompile readings — single-source (LiveRE2 BlockProbe captures), cross-
  checked only against the nm census; the shelf-algebra reading agrees with
  the published SVF shelf identities (corpus material, not independent
  evidence).
- Band-role binding, HP corner, Analog-mode interpretation: **low** — graded
  [H], do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Channel EQ does not exist yet.
