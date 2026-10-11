# Utility (OStereoGainProcessor) binary derivation — per-sample layer (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
BlockProbe/DataProbe/SearchProbe scripts, no re-import) plus `nm -U` decodes.
NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/utility-decompiles.txt` (nm census, create chain,
Init/NewRate/Reset/CalcMain, all 9 `CalcLegacy*` bodies, all 18 setters, the
modern per-sample calc, the ramp-object helpers, the mode-name table dump).
Form follows `compressor-derivation.md`/`delay-derivation.md`; claims graded:
**[D] decompiled-confirmed** (capture cited), **[B] byte-decoded**,
**[H] unverified hypothesis** — no behavioral renders ran in this lane; per
README every [D]/[B] claim still awaits the golden-render cross-check before
it gates a rebuild.

Utility is `OStereoGainProcessor` — an `O<Dsp>Processor` (Compressor
architecture, not devicekit), carrying **two complete engines**: the modern
Live 11+ engine (Gain/Balance/Width/Mid-Side Balance/Bass Mono/Audition, a
per-sample TPT/SVF-context calc at `this+0x48`) and the full legacy engine
(the pre-11 Utility: Gain + ChannelMode + Phase L/R + DC, four double
de-zipper ramps + 9 `CalcLegacy*` callbacks), selected per parameter change
by `LegacyMode`. The device is small enough that this pass closes the whole
dispatcher and both engines' audio paths statically; the one law not
recovered is the gain/balance transfer closed form itself (§4).

## 1. What runs when (call topology)

- **Create** `OProcessorCreateManager::SOnProcessorCreate<OStereoGainProcessor>`
  0x1018c4ae8 → wrapper 0x1018c4b24 (param block at shell+0x268) [D].
- **Init** (trampoline 0x1019ad68c) and **OnOn/OnX/OnMute/OnDcFilter/
  OnChannelMode** share the same tail — the **calc-slot selector** [D]:
  ```
  if (!On(0x148) || !X(0x149))            calc = NULL        // device off
  else if (LegacyMode(0x162) == 0)        calc = CalcMain    // (+ ctx reset func_0x103b4b98c or ramp reset 0x101663f64 on the off→on edge)
  else if (Mute(0x161))                   calc = CalcLegacyMute
  else switch (ChannelMode(0x158)):       0 → CalcLegacyMonoL   (Dc variant if DcFilter 0x160)
                                          1 → CalcLegacyStereo  (…Dc)
                                          2 → CalcLegacyMonoR   (…Dc)
                                          3 → CalcLegacySwap    (…Dc)
  ```
  The selector writes the fn pointer into the shell's calc table
  (`*(0x260)` snapshot → entry stride 0x18) and maintains the processor's
  active-audio-calc refcount (`+0x34`), posting `SNoCalcAudioFunc` when
  clearing [D — same shape as the Compressor's trampoline tail].
- **Per-sample** `CalcMain` trampoline 0x1019ae164 [D]: loads the input pair
  `**(0x30)`, `**(0x38)`, calls the modern engine
  `FUN_103b4bfcc(this+0x48, pair)` (returns the float2 out pair), stores it
  at `0x40/0x44`. No block loop — one frame per call, like the Compressor.
- **NewRate(int,int)** 0x1019ad6ac [D]: **second int = sample rate (Hz)**
  (Compressor convention); modern ctx rate set `func_0x103b4b6b0(sr,
  this+0x48)`; then `f = 44100/sr`; `0x120 = powf(0x118, f)`,
  `0x124 = powf(0x11c, f)` — the legacy DC-blocker pole pair is stored as
  44.1 kHz-referenced constants and rescaled by pow (base constants set in
  the ctor, not captured [B-negative]).
- **Reset** 0x1019ad690 [D — 20-line body, zeroes the state bytes].
- **Setters** are the `SProcessorFunc` trampoline bodies themselves (nm
  table 0x1019ad6e8–0x1019adc5c): On/OnX, OnMute, OnDcFilter,
  OnChannelMode (raw int → 0x158; modern also mirrors → 0x110), OnPhase
  InvertL/R (bools 0x14a/0x14b; modern writes ±1.0f into ctx+0/ctx+4
  directly; legacy pushes into the 0x168 engine), OnStereoWidth (raw 0x150),
  OnMidSideBalanceOn (bool 0x14c), OnMidSideBalance (raw 0x154),
  OnBalance (raw bits 0x15c), OnGain, OnLegacyGain, OnLegacyMode (bool
  0x162 — the engine swap, §3), OnMono (modern ctx flag), OnBassMono (0x114),
  OnBassMonoAudition (0x115), OnBassMonoFrequency (coefficient law §3).

## 2. The state-slot ledger (every reader → its writer)

Writers: SET = parameter setter trampoline, INIT = Init/NewRate, CALC =
per-sample callback, CO = create-time.

| slot | role | writer | law |
|---|---|---|---|
| 0x30/0x38 | input ptrs L/R | shell | `**` deref per sample |
| 0x40/0x44 | out pair (L/R) | CALC | ±1e12 clamped [B: 0x5368d4a5/0xd368d4a5] |
| 0x48/0x4c | modern ctx: phaseL/phaseR (±1.0f) | SET PhaseInvertL/R | `v!=0 → −1 : +1` |
| 0x50… | modern ctx: mono flag, M/S-balance state, width state (sub-objects at +0x50/+0x98) | SET Mono/MSB* | via `func_0x103b4bb64/ba04` |
| 0x98… | ramp object: fn ptr + two interleaved value/inc/len slots + projected out pair | SET Gain/Balance | endpoint-converted linear ramp (§3) |
| 0xd8/0xdc | BassMono frequency / `2·tan(π·f/sr)` coeff | SET BassMonoFrequency | rational approx, clamped (§3) |
| 0xe0…0xf8 | BassMono SVF states (24 B, zeroed on engage) | SET BassMono/Audition, CALC | |
| 0xfc…0x108 | modern DC-blocker states (zeroed on engage) | SET DcFilter, CALC | |
| 0x10c | sample rate (Hz, float) | NewRate | |
| 0x110 | ChannelMode mirror (modern) | SET ChannelMode | raw int |
| 0x114/0x115 | BassMono / Audition bools | SET | |
| 0x116/0x117 | modern DcFilter / Mute mirrors | SET | |
| 0x118/0x11c | DC pole constants @44.1 kHz | CO | pow-rescaled into 0x120/0x124 |
| 0x120/0x124 | DC poles this-rate | NewRate | `powf(base, 44100/sr)` |
| 0x128–0x140 | legacy DC states: stage1 y/x, stage2 y/x (float pairs) | CALC Dc variants | |
| 0x148/0x149 | On / X bools | SET | both must be 1 for any calc |
| 0x14a/0x14b | PhaseInvertL/R bools | SET | |
| 0x14c | MidSideBalanceOn bool | SET | |
| 0x150 | StereoWidth raw | SET | |
| 0x154 | MidSideBalance raw | SET | |
| 0x158 | ChannelMode enum | SET | 0..3 (§3) |
| 0x15c | Balance raw bits | SET | |
| 0x160/0x161/0x162 | DcFilter / Mute / LegacyMode bools | SET | |
| 0x168… | legacy width/gain engine object | SET (legacy paths) | helpers 0x1019aa280/3a4/ae394/ae444/ae4f4 |
| 0x1e0/0x1e8, 0x1f8/0x200 | legacy gain ramps L/R (state/inc doubles) | legacy engine | `state += inc` per sample |
| 0x210/0x218, 0x228/0x230 | legacy out-gain ramps L/R (state/inc doubles) | legacy engine | `state += inc` per sample |

## 3. The mechanism, plainly

**Gain and Balance are one ramp object with a transfer function.** The
modern engine keeps a ramp object at `this+0x98` with function pointer at
slot 0; `OnGain` (`func_0x103b4be98`) and `OnBalance` (`func_0x103b4bd70`)
drive two interleaved value/inc/remaining slots of it (gain and balance).
The ramp law [D]:

```
on set(target, n):  if pending ramp, fold it (cur += inc·remaining)
                    if n == 0: cur = target; out = f(cur, aux); out_delta = 0
                    else:      inc = (target − cur)/n
                              out_delta = (f(cur + inc·m, aux_end) − out) / m,
                                  m = min(n, remaining) − 1
per sample:         out += out_delta
```

— the audio gain moves **linearly between the transfer-converted endpoints**
(the devicekit "endpoint-converted ramp"; f is applied at set-time to the
projected end value, never per sample). The same pattern serves the width
pair (`func_0x103b4ba04`, 2-element input {width, balance}). The closed
form of `f` (dB→linear for gain; balance→L/R pair for the pan) is behind
the function pointer and **not captured** [open; the standard candidates
are 10^(dB/20) and a constant-power/sine pair — do not build on either
until pinned].

**Bass Mono is a mid/side lowpass with an audition solo.** The per-sample
modern calc `FUN_103b4bfcc` [D]:

1. Mute flag (`ctx+0xcf`) → both outputs 0.
2. Channel-mode select on `ctx[0x32]` (= `this+0x110`): case 0 skips the
   width/matrix block entirely (direct to output ramps); case 1 forces both
   outputs from input pair element 1; case 2 falls into the width-matrix
   block with both elements = input element 0; values ≥ 3 → silence [D;
   the mode→name mapping is only partially decoded — §4].
3. **Width matrix** with de-zipper ramp pair (state `ctx+0x38`, inc
   `ctx+0x40`, doubles-as-float-pairs): `A = in1·g1 + in0·g2; B = in1·g2 +
   in0·g1` — the symmetric [[g1,g2],[g2,g1]] cross-coupled pair, same shape
   as the legacy calcs.
4. **Bass mono** (flag `ctx+0xcd`): M = (A+B)/2, S = (A−B)/2; M and S each
   run through an identical TPT/SVF lowpass (k = `ctx[0x25]`, state triples
   `ctx[0x26..0x28]` / `ctx[0x29..0x2b]`, cutoff = the BassMono frequency);
   reconstruct `A' = LP(M) + LP(S)`, `B' = LP(M) − LP(S)`. With Audition
   (`ctx+0x33`) the S leg is zeroed → both channels carry LP(M) only: you
   hear exactly the band that will be forced mono [D — semantics read off
   the calc; the audition-with-bass-off branch is a one-leg variant, body
   in the capture].
5. Output gain ramps (state `ctx+0x1e`, inc `ctx+0x20`) multiply both
   channels; DC blocker (flag `ctx+0xce`) then runs a stereo one-pole pair
   in the ctx tail; returns the float2 out pair.

**BassMono frequency coefficient law** (`OnBassMonoFrequency`) [D]:

```
w = f·2π/sr;  w = min(w, 3.1337388);  w *= 0.5          // π·f/sr ≤ 1.5668694
g = w²
c = w·(1 − 0.09652461·g) / (1 − 0.42986727·g + 0.009981878·g²)   // rational tan(w) approx
0xd8 = f;  0xdc = 2·c                                    // 2·tan(π·f/sr) — SVF coefficient ×2
```

**Legacy engine.** The 9 `CalcLegacy*` bodies [D] share one skeleton: four
linear de-zipper ramps (gain L/R at 0x1e0/0x1f8, out-gain L/R at
0x210/0x228; `state += inc` doubles), then per mode:

```
MonoL:  out = inL · g · outG            (single input, both outputs)
MonoR:  out = inR · g · outG
Stereo: outL = inL·gA + inR·gB (×outG_L);  outR = inL·gB + inR·gA (×outG_R)
Swap:   the Stereo matrix with inL/inR exchanged
Mute:   out pair = 0
```

— the Stereo/Swap matrix is the width engine (gA = mid-weight gain, gB =
side-weight gain; at width 1, gB = 0 and the matrix collapses to diagonal
[H on the naming; the ramp targets are written by the legacy 0x168 engine
helpers, whose bodies are captured in evidence and still need the
gA/gB-from-(gain,balance,width) reading]). The ramps are re-read between
the L and R sample (a mid-sample parameter change lands between the two
channels — one-sample skew by design). All nine variants end in the ±1e12
clamp. The `Dc` variants insert, after the matrix, two cascaded one-pole
highpasses per channel [D]:

```
y1 = (x − x₁) + c1·y1                    // c1 = 0x120, state 0x128/0x130
out = (y1 − y1₂) + c2·y2                 // c2 = 0x124, state 0x138/0x140
```

with the poles pow-rescaled from 44.1 kHz in NewRate (§2).

**LegacyMode switch (`OnLegacyMode`, bool 0x162)** [D]: on any flip the
setter re-pushes the whole parameter set into the other engine — phase
L/R, mute, dc, balance, then width/balance composed as: if
MidSideBalanceOn, `width = min(2 − MSB, 1)` and the balance slot = `MSB`
if MSB ≤ 1 else `1.0`; if off, `width = 1.0` and the balance slot = raw
StereoWidth (0x150). So **M/S Balance b ∈ [0,2] implies width =
min(b, 2−b)**, and with M/S off the legacy Width knob fills the same slot
[D].

## 4. What remains open (honest residuals)

- **The gain/balance/width transfer closed forms** — the function pointers
  in the ramp objects (`this+0x98`, ctx+0x50) are runtime-bound; neither
  dB→linear nor the pan/width→gL/gR law is captured. One targeted hop
  (decompile the two fn-ptr targets from a live ctx layout) or a
  golden-render pair (known dB in, sample out; known balance, L/R ratio)
  pins them.
- **Channel-mode enum identity**: `LStereoGain::SChannelModeName` reads a
  4-entry table at 0x1053dad40; the dump recovered slot 0 = "Left" and
  slot 2 = "Right" ("…1f89 → `Left\0Right\0`), slots 1/3 point outside the
  captured window. The modern calc's case-0-skips-everything routing does
  not yet match any candidate ordering — the mode byte `ctx[0x32]` ↔
  `UtilityChannelMode` correspondence needs either the remaining name
  slots or a render.
- **Ctor constants**: DC pole bases (0x118/0x11c) and factory defaults
  (the create wrapper 0x1018c4b24 was captured only as a 20-line
  allocation chain — the ctor body with the constant pool is not
  decompiled).
- **Legacy 0x168 engine helpers** (0x1019ae4f4 width+gain compose → the
  four ramps; 0x1019ae394/ae444; 0x1019aa280/3a4 phase) are captured
  verbatim in evidence but not yet read into a derivation — they carry the
  legacy width gain law.
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- The dispatcher truth table, all 18 setter slot writes, NewRate/Reset
  laws, the 9 legacy calc bodies (incl. the DC-blocker topology and the
  ±1e12 clamp), the legacy Mode flip's width = min(MSB, 2−MSB) law, the
  BassMono SVF + audition semantics and its exact coefficient law, and the
  endpoint-converted ramp pattern: **high** as decompile readings —
  single-source (BlockProbe decompiles from the analyzed LiveRE2 project),
  cross-checked against the `nm -U` SProcessorFunc surface, which agrees
  everywhere they overlap.
- The gain/pan/width closed forms and the modern mode routing: **not
  established** — graded open/[H]; do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Utility does not exist yet (COVERAGE row empty).
