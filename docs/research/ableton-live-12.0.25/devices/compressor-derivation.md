# Compressor (Compressor2) binary derivation — per-sample layer (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SearchProbe/CallTargetsProbe/BlockProbe/DataProbe scripts, no re-import).
NOT FOR REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/compressor2-decompiles.txt` (all setters,
Init/NewRate/Reset/ctor, both calc bodies, const-pool decodes, raw-asm decode
of the threshold floor). Form follows `glue-perblock-derivation.md`; claims
are graded: **[D] decompiled-confirmed** (capture cited), **[B] byte-decoded**
(objdump/const pool), **[H] unverified hypothesis** — no behavioral renders
ran in this lane; per README every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

The stock Compressor is `OCompressor2Processor` — a different architecture
from the Glue: **no solver, no Ratio LUT, no de-zipper ramps**. The whole
static curve runs in a **log2 (octave) domain** with a closed-form soft knee;
the applied gain is read from a runtime-built metering LUT. `LegacyCalc` (the
Live-8 engine, 18 template instantiations) and `InternalCalc` (the Live-12
engine, 18 instantiations) are separate per-sample callbacks selected by
model/mode state.

## 1. What runs when (call topology)

DSP state lives inline in the processor (`this+…`); setters write it directly
(they ARE the `SProcessorFunc` trampoline bodies — no dispatcher hop like the
Glue's `param_2 + 0x68` indirection).

- **Create** `OProcessorCreateManager::SOnProcessorCreate<OCompressor2Processor>`
  0x1018bc42c → wrapper 0x1018bc468 (device-kit processor shell, param block
  at shell+0x310) → **ctor** `FUN_10163d758` [D]: ring 0x70 + RMS object 0xa8
  built from the sample rate (param `*param_2` = sr Hz); `0x158 = sr·0.001`
  (sr in kHz); placeholder coeffs `0x168 = 0x170 = 0x180 = exp(−1/sr_kHz)`
  (τ = 1 ms); `0x18c ← FLT_MAX`, `0x1c8 ← 0.005` [B]; knee-LUT struct 0x198
  built by `func_0x0001019ae8c8` [D call, body open]; EQ object 0x1e8 built
  (`func_0x000101884fac(sr)`); factory defaults: Attack/Release/Ratio 1.0,
  Threshold 0.0 (linear!), Gain 1.0 (linear), sidechain trim 0.3, Knee 0 dB,
  LookAhead 1 (on), Model/LegacyModel/EnvFollowerMode 0, DryWet 1.0,
  Live8LegacyMode 0, `0x2e0 = 1.0` [D, evidence §ctor]. Registers the
  `OnCheckBeingNeutral` callback.
- **Init** `FUN_10163d764` (trampoline 0x101642f90 stores the scheduler at
  0x300, tails here) [D]: the recompute-from-params — attack/release
  coefficient laws (§2), ratio-derived slope select (`0x1c4 = −(Model==2 ?
  0x2a4 : 0x2a0)`), the shared curve tail `FUN_10163df7c` (below), DryWet
  mirrors, lookahead sizing, sidechain trim law `0x2b0` (0.3/1.0 by
  ExtInOn/GainCompensation/Live8 state; exact truth table [D] shape, per-case
  reading open), GainCompensation curve re-eval.
- **NewRate(int,int)** `FUN_10163dad0` [D]: **second int = sample rate (Hz)**
  (same convention as Glue §8); `0x2dc = 0x158 = 0x188 = sr·0.001` (kHz);
  `0x1c8 = 1 − exp(−1/(sr_ms·2.25))` (2.25 ms smoothing coeff — legacy path
  only); **lookahead ring (0x70) resized to `int(sr_ms·10 + 5)` slots**
  (≈ 10 ms + 5) via `func_0x0001016d3b30`; `0x18c = exp(−1/(sr_ms·24))`
  (24 ms coeff, consumer open); `0x178 = 0`; RMS object re-inited with sr Hz
  (`func_0x000101661b18`); EQ object re-inited (`func_0x000101885394`);
  then re-runs the Init attack/release/lookahead laws. First int unused in
  the captured body — open.
- **Reset** (trampoline 0x101642fbc) [D]: zeroes 0x160/0x178/0x190/0x1d0/
  0x1d8/0x1e0; `0x1c8 = 0.005`; ring/EQ/RMS resets (0x1016d3bd4, 0x101885454,
  0x101661afc); then `FUN_10163d764` + refreshes the meter mirrors
  0x50–0x68 from the input pointer targets `*(0x30…0x48)`.
- **Per-sample callbacks** (no sample loop in any body — one frame per call):
  `LegacyCalc<bool, NLegacy::TModel{0,1,2}, TEnvFollowerMode{0,1,2}>` and
  `InternalCalc<bool, NCompressor2::TModel{0,1,2}, TEnvFollowerMode{0,1,2}>`,
  36 `SProcessorFunc` registrations total (symbol table). The `bool` selects
  the input topology: `false` = detector reads the **sidechain inputs**
  (`*(0x40)`, `*(0x48)`), main (`*(0x30)`, `*(0x38)`) is delayed for output;
  `true` variants differ accordingly [H — only the `false` bodies captured].
  Which family runs is selected by Live8LegacyMode/model/mode state through
  crossfaded callback swaps (OnCrossfaderSmoothingTime coeff 0x150; the full
  dispatch bodies of OnModel/OnLegacyModel/OnEnvFollowerMode are truncated in
  the capture — selection logic **[H]**, the 36-entry table **[D]**).
- **`InternalCalc<false,0,0>` body `FUN_10165f290`** [D] — the Live-12 stock
  path (model 0, env mode 0):
  1. `g = s[0x1b0]` (input trim); ring slot ← (mainL·g, mainR·g); reads at
     −la and −(la+1) slots, fractionally interpolated (frac = `0x1c0 − int`).
  2. sidechain pair = (`*(0x40)·g`, `*(0x48)·g`) → stereo biquad pair
     (coeffs 0x218–0x234, states L 0x268–0x270 / R 0x274–0x27c) when
     `s[0x1e8]` (EQ on).
  3. **detector = (|L|+|R|)·0.5** (mean absolute value; no dB conversion).
  4. ballistics (doubles): stage-1 `s[0x160] += c·(in − s[0x160])` with
     `c = 0x168` (attack) rising / `0x180` (release) falling; stage-2
     `s[0x178]` follows stage-1 with the fixed `0x170` (= 6× faster attack
     coeff). The curve consumes **stage-2** through `log2f(x + 1e-28)`.
  5. soft-knee law in octaves (§3), reduction stored `0x1e0`.
  6. env mode 1 (`0x2c8 == 1`): the reduction itself is smoothed through the
     same ballistic pair (state `0x160` reused; sign flips for Model 2).
  7. GR/makeup LUT + output (§3).
- **`LegacyCalc<false,0,0>` body `FUN_10165ab84`** [D] — the Live-8 path:
  inputs hard-clamped ±10; detector feeds the same biquad pair; same MAD +
  ballistics; the curve is the **knee LUT** (0x198 pointer, 0x1a4/0x1a8/0x1ac
  domain, Catmull-Rom) evaluated at the envelope, compared against
  `0x1b8 ∓ 0x2e4` (knee top/bottom); over-branch reduction = `curve·0x1c4`
  (capped ≤ 10); applied gain smoothed by `0x1cc += 0x1c8·(target − 0x1cc)`
  (the 2.25 ms de-zipper — **internal path has no such state**); output
  `dly·(1−w) + dly·gr_smooth·makeup·w` (no `0x2e0` makeup-curve in the wet
  leg; below-knee the smoothing target is `0x2e0`).

**Shared curve tail `FUN_10163df7c`** (called by OnThreshold/OnRatio/
OnExpansionRatio/OnExtInOn/OnGainCompensation/Init) [D + B raw-asm]:

```
thr_eff = max(s[0x2a8], 10^−3.25)                 // floor 5.62e-4 = −65 dB (inert in range)
s[0x1b8] = (legacy && LegacyModel==0)
         ? kneeLUT[log2(thr_eff)]                 // Catmull-Rom, domain 0x1a4/0x1a8, cap 0x1ac−3
         : log2f(thr_eff)                          // modern path: plain octaves
s[0x1bc] = s[0x1b8] · s[0x1c4]                    // threshold × slope
s[0x2e0] = makeupCurveLUT[(s[0x1bc]·(1−s[0x2b0]) − c20)·c24]
                                                 // global table 0x1059a89b8+8, runtime-built
```

**Threshold is stored LINEAR** (not dB): ctor default 0.0 [B]; the floor
compares amplitudes; `log2f` consumes it directly. OnThreshold passes the
param through unscaled [D].

## 2. The state-slot ledger (every reader → its writer)

Writers: SET = parameter setter (trampoline body), CO = ctor const-pool [B],
INIT = `FUN_10163d764`/`FUN_10163dad0`, CALC = per-sample callback.

| slot | role | writer | value / law |
|---|---|---|---|
| 0x30/0x38, 0x40/0x48 | input ptrs: main L/R, sidechain L/R | shell [H] | `**` deref per sample |
| 0x50/0x54, 0x64 | out pair; 0 when SideListen | CALC | meter taps |
| 0x58 | GR meter (applied-gain LUT value) | CALC | = the audio gain factor |
| 0x5c/0x60 | post-EQ sidechain pair | CALC | |
| 0x70/0x78/0x80/0xa0 | lookahead ring base/write/end/capacity | INIT | cap ≈ sr_ms·10+5 slots ×2 floats |
| 0xa8…0x158 | RMS/auto-release object (sr, times, coeffs) | SET (Rms/ReleaseTime), INIT | 0xa8 = sr Hz; 0xbc/0xc0 = exp(−1/(ms·0.001·sr)) |
| 0x158/0x188/0x2dc | **sample rate in kHz** | INIT | sr·0.001 |
| 0x160 | detector stage-1 (double) | CALC | attack/release ballistics |
| 0x168 | attack coeff (double) | SET Attack, INIT | exp(−1/(ms·sr_kHz)) |
| 0x170 | stage-2 coeff (double) | SET Attack, INIT | exp(−1/(6·ms·sr_kHz)) — 6× faster |
| 0x178 | detector stage-2 (double) | CALC | drives the curve |
| 0x180 | release coeff (double) | SET Release, INIT; CALC when auto-release | exp(−1/(ms·sr_kHz)) |
| 0x18c | 24 ms coeff | INIT | exp(−1/(sr_ms·24)); consumer open |
| 0x190 | (zeroed) | RESET | |
| 0x198/0x1a4/0x1a8/0x1ac | knee-LUT ptr/domain-start/scale/size | `func_0x0001019ae8c8` (ctor) | legacy path only; contents open |
| 0x1b0 | input trim / enable fade | SET OnOn | multiplies main + sidechain |
| 0x1b4 | X bool (scheduling with OnOn) | SET OnX | semantics open |
| 0x1b8 | threshold, octaves | tail | log2(thr_linear) or kneeLUT |
| 0x1bc | threshold × slope | tail | |
| 0x1c0 | lookahead length (samples, float) | INIT | int(sr_kHz·ms) by mode law (below) |
| 0x1c4 | **slope** (negated) | SET Ratio/Expansion, INIT | −(0x2a0 or 0x2a4 by Model==2) |
| 0x1c8 | applied-gain smoothing coeff (legacy) | INIT/RESET | 1−exp(−1/(2.25 ms)); reset 0.005 |
| 0x1cc | legacy applied-gain smoother state | CALC legacy | |
| 0x1d0/0x1d8 | zeroed / post-EQ sidechain meter pair | RESET / CALC | |
| 0x1e0 | reduction (octaves) | CALC internal | GR meter source |
| 0x1e8…0x27c | EQ object: on byte, mode 0x1ec, freq 0x1f0, gain 0x1f4, Q 0x1f8, biquad coeffs 0x218–0x234, states 0x268–0x27c | SET Eq*, INIT | one parametric band, stereo pair |
| 0x298 / 0x29c | Attack / Release (ms, as stored) | SET | |
| 0x2a0 / 0x2a4 | CompressionRatio / Expansion mapped (1/v − 1) | SET | |
| 0x2a8 | **Threshold (linear)** | SET | floor 10^−3.25 at use |
| 0x2ac | makeup gain (linear) | SET Gain | 10^(dB/20) |
| 0x2b0 | sidechain trim | SET ExtInOn/GainComp, INIT | 0.3 / 1.0 law |
| 0x2b4 | Knee (dB) | SET | |
| 0x2b8 | LookAhead mode (0/1/2) | SET | ctor 1 |
| 0x2bc / 0x2c0 | LegacyModel / LegacyEnvFollowerMode | SET | |
| 0x2c4 / 0x2c8 | Model (0/1/2) / EnvFollowerMode (0/1) | SET | |
| 0x2cc/0x2d0/0x2d4 | DryWet w / 1−w / w | SET | |
| 0x2d8 | Live8LegacyMode bool | SET | selects Legacy vs Internal family [H] |
| 0x2e0 | makeup-compensation curve value | tail | runtime-built LUT |
| 0x2e4 | Knee (octaves) | SET Knee | log2(10^(dB/20)) = dB/6.0206 |
| 0x2e8 | knee edge slope | SET Knee | 1/(2·octaves) |
| 0x2ec/0x2ed/0x2ee/0x2ef | SideListen / ExtInOn / GainCompensation / AutoRelease bools | SET | |

**Lookahead law (Init/NewRate)** [D]: mode 2 → 10 ms; mode 1 → 1.5 ms if
LegacyModel 0 else 1.0 ms (legacy-mode flag swaps the pick); mode 0 → 0.

**Attack/Release are CONTINUOUS ms parameters — not menus** (contrast with
the Glue's menu→µs tables). Coefficient laws [D]: effective = stored, except
Model 1 + env mode 0 → attack ×3, release ×5/9; live8-legacy: attack ×64
(env mode 2) / ×3 (mode 1) / ×0.0625 (mode 0, LegacyModel 0 only); release
/6 (mode 2) / ×5/9 (mode 1) / raw (mode 0).

## 3. The mechanism, plainly (InternalCalc — the stock Live 12 path)

**Detector.** MAD of the (optionally EQ'd) sidechain pair, linear domain.
Two-stage ballistics: stage-1 attack/release one-pole (doubles), stage-2 a
fixed 6×-attack follower of stage-1. The curve reads stage-2 in **octaves**:
`env_oct = log2(s[0x178] + 1e-28)`.

**Static curve (closed form, decompile-transcribed).** With T = 0x1b8
(threshold, octaves), K = 0x2e4 (knee, octaves), s = 0x1c4 (slope, negative),
e = 0x2e8 = 1/(2K):

```
env ≤ T−K           → red = 0
T−K < env ≤ T+K     → t = (env−(T−K))·e
                      red = ((K + (T−K) + (env−(T−K))/2)·t + T·(1−t) − T)·s
env > T+K           → red = (env−T)·s
```

(continuous at both knee edges: 0 and K·s). The slope's UI meaning: the
stored CompressionRatio value IS the octave-domain slope of reduction vs
over-level, so **ratio_display = 1/(1−stored)** [H — from the ExpansionRatio
mapping `1/v − 1` and the −1.0 default; the param-layer scaling is shell-side,
not captured]. The stored value is used NEGATED (0x1c4) so red ≤ 0 for
compression. Model 2 swaps in the Expansion value (0x2a4), making red
positive above threshold (expansion) — its calc variant differs [H, body
not captured].

**Applied gain — meter and audio are one path.** `fVar7` = linear-interp
lookup in the runtime-built global LUT (table object at 0x1059a89b8+8, domain
constants at +0x20/+0x24, entry cap from global 0x1058efe58) indexed by
`c24·(max(−31, red) − c20)` — the GR meter value `s[0x58]` — and the output is

```
out = dly·(1−w) + dly · s[0x58] · s[0x2e0] · s[0x2ac] · w
```

— DryWet as a dry/(delayed·gain) crossfade on the single (lookahead-delayed)
audio path, exactly the Glue's "DryWet in the gain domain" shape. The makeup
chain is `s[0x2e0]` (the GainCompensation curve, re-derived from threshold ×
slope per parameter change — an automatic, reduction-shaped makeup) times the
user's `s[0x2ac]`. No per-sample de-zipper state exists in this path: the
ballistics and (mode 1) the reduction smoother are the only memory.

**Auto release (0x2ef).** When on, the per-sample MAD is passed through the
RMS object (`func_0x000101661c6c`) and the result is written into the release
coefficient slot 0x180 [D] — the release coefficient becomes
signal-dependent per sample. The function body (how RMS maps to a coefficient,
using RmsTimeShort/Long and ReleaseTimeShort/Long) is **not captured** [H on
semantics; the SlotD write is decompiled].

**Sidechain EQ.** One parametric biquad band (stereo pair), modes 0..5
selected by OnEqMode's switch (filter-type map open — the shared recompute
tail and default Q 0.98 [B: 0x3f7ae148] are captured); sits BETWEEN the
sidechain input and the detector. Compressor ≠ Glue: the Glue has no EQ and
a feedforward-solver loop; the Compressor is a direct detector → static-curve
→ LUT-gain chain.

## 4. What remains open (honest residuals)

- **Runtime-built tables.** The GR/makeup LUT object (0x1059a89b8), its
  domain constants c20/c24, and the applied-gain cap (0x1058efe58) live in
  `__DATA` beyond the file-backed range — built at startup, not statically
  decodable [B-negative, evidence header]. A behavioral render (known red →
  measured gain) pins the composition directly.
- **Stored-ratio → display-ratio scaling** (slope hypothesis above) and the
  Threshold param-layer unit (linear at the processor; dB→linear conversion
  site = shell, not captured).
- **Callback-family dispatch**: which of the 36 callbacks runs per
  Live8LegacyMode/Model/EnvMode combination, and the crossfade handoff
  (OnModel/OnLegacyModel/OnEnvFollowerMode/OnLegacyEnvFollowerMode bodies
  truncated in the capture).
- **`LegacyCalc`/`InternalCalc` `bool=true` variants** (no-sidechain
  topology) and all Model 1/2 bodies — only `<false,0,0>` of each family
  captured.
- **Knee-LUT builder** `func_0x0001019ae8c8` contents (0x1a4/0x1a8/0x1ac
  values; legacy path only).
- **EQ mode enum → filter-type map** (cases 0..5 of the shared recompute);
  the biquad coefficient layout (0x218–0x234) is captured in use, not in
  derivation.
- **0x18c (24 ms coeff) and 0xc8/0x128 consumers** (RMS-object rate fields
  read by the RmsTime/Crossfader setters but never written in the captured
  set — likely second sr copies written inside the uncaptured object init
  bodies `func_0x000101661b18`/`0x101884fac`).
- **OnOn/OnX semantics** (0x1b0 trim vs enable fade; the 0x1000 scheduled
  message) and the shell wiring of the sidechain pointers when ExtInOn=false
  ([H]: 0x40/0x48 aliased to the main inputs).
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Class/callback inventory, setter laws, Init/NewRate/Reset/ctor, the
  internal soft-knee law, ballistics topology, output/makeup composition:
  **high** as decompile readings — single-source (BlockProbe decompiles from
  the analyzed LiveRE2 project), cross-checked only against the symbol table;
  no second reading (the glue lane's disassembly-vs-decompile double entry)
  was done except the threshold-floor raw-asm decode, which agreed.
- Slope/ratio naming, auto-release semantics, dispatch selection: **low** —
  graded [H], do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Compressor does not exist yet (COVERAGE row empty).
