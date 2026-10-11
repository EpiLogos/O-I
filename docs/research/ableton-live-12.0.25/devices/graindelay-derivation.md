# Grain Delay (GrainDelayDevice) binary derivation — granular engine (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SymProbe/CallTargetsProbe/BlockProbe/DataProbe/DoubleDump scripts, no
re-import). NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/graindelay-decompiles.txt` (create chain, Init/Reset/
NewRate/NewTempo, all twelve setters, the shared sync-recompute tail, the
OnOn/OnX callback-swap tail, both per-sample calc bodies, helper bodies,
const-pool decodes). Form follows `compressor-derivation.md`; claims graded:
**[D] decompiled-confirmed** (capture cited), **[B] byte-decoded** (static
`__DATA`), **[H] unverified hypothesis** — no behavioral renders ran in this
lane; per README every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

The stock Grain Delay is `OGrainDelayProcessor` — a **single-processor,
per-sample granulator**: two delay rings (one per channel), four grain voices
(two per channel) re-scheduled from a phase accumulator, windowed by
complementary raised-cosine pairs. There is no solver, no per-grain resampler
and no scheduler object: the whole engine is arithmetic in `CalcMain`
(FUN_10168a45c, 217 decompiled lines). Delay time follows Time/Sync mode
through one shared recompute tail (`FUN_101689e8c`).

## 1. What runs when (call topology)

DSP state inline in the processor; setters ARE the `SProcessorFunc` trampoline
bodies (Compressor §1 pattern). Create:
`OProcessorCreateManager::SOnProcessorCreate<OGrainDelayProcessor>`
0x1018be528 → device-kit wrapper 0x1018be564 (32-byte shell, allocator
0x28 bytes, param block via registrar `FUN_101689a14` — registrar body not
captured, defaults therefore open §4). Registered members (symbol table
[D]): Init, Reset, NewRate(ii), NewTempo(ffff), OnFreq, OnSpray, OnSyncMode,
OnMsDelay, OnBarDelay, OnBarDelayOffset, OnRandomPitch, OnPitch, OnFeedback,
OnDryWet, OnOn, OnX, CalcMain, CalcMainWithReset.

- **Init** (trampoline 0x10168fe68) [D]: reads tempo object
  (`FUN_101551390(scheduler)` → `*(obj+0x1c)` = tempo BPM), stores
  `0x160 = 60000/bpm` (**beat length in ms**); copies a global object pointer
  into `0x60` (the grain-stagger table, runtime-initialized — corpus §3);
  zeroes voices (0xc8 counter, 0xcc–0xe0 phases/envelopes, 0xf0–0x108
  spray/drift slots); `0xe4 = {1.0, 1.0}`; restores defaults 0x110–0x120 from
  const `0x104cc97f0..ff` [B: {0.0, 150.0, 1.0, 0.0}]; re-mirrors
  `0x110 = 0x134`, `0x48 = 0x134·4·0x50`; if X (0x15d) is clear, recomputes
  the sample-count `0x12c` (law below) and calls `FUN_101666998` (store
  `0x8 = round(0x12c)` + virtual notify through `*(this+0x10)`); runs the
  sync recompute; builds the DryWet mirrors `0x11c/0x120` (denormal-flushed
  cos²/sin² pairs, same law as OnDryWet); seeds per-voice drift `0xe8` and
  spray offsets `0xf0/f4/f8/fc` from the **global random source** (below).
- **NewRate(int,int)** `FUN_101689ce0` [D]: **second int = sample rate Hz**
  (Compressor §8 convention). `0xec = sr·0.001` (**sr in kHz**);
  `0x12c = int(sr_kHz·6100 + 1)` (**default delay capacity = 6100 ms**);
  ring objects at 0x68 (L) and 0x98 (R) (re)initialized
  (`FUN_1016d3a14`, second arg = capacity samples); `0x50 = 512/sr`
  (**512-sample quantum in seconds** — the block CalcMain is driven at);
  re-mirror `0x110/0x48`; recompute `0x12c` (X-gated) and notify.
- **NewTempo(f f f f)** (trampoline 0x10168ff58) [D]: `0x160 = 60000/arg2`
  (BPM), then tails into the sync recompute — sync delay follows tempo live.
- **Reset** (0x10168fee0) [D]: ring resets (`FUN_1016d3ab0`), zeroes all
  voice/envelope/drift state, restores the const defaults, calls re-init
  `FUN_101689b34` (body captured; mirrors Init's recompute block), copies
  current inputs to out slots 0x40/0x44.
- **Setters** (all [D]): OnFreq → `0x134`, mirror `0x110`,
  `0x48 = f·4·0x50`, recompute; OnSpray → `0x138`, recompute; OnSyncMode →
  `0x13c = (int)v`, recompute; OnMsDelay → `0x140`, recompute; OnBarDelay →
  `0x144`, recompute; OnBarDelayOffset → `0x148`, recompute;
  OnRandomPitch → `0x14c` (pure store); OnPitch → resample ratio LUT (§3);
  OnFeedback → `0x154` (pure); OnDryWet → `0x158` + mirrors (§3);
  OnOn → `0x15c = (v≠0)`, OnX → `0x15d = (v≠0)`, both tail into the
  callback swap `FUN_10168a2d4`.
- **Callback swap `FUN_10168a2d4`** [D]: `On==0 || X==0` → register NULL
  (NoCalcAudioFunc — device silent); `On==1 && X==1` → if no calc currently
  registered: reset both rings and register **CalcMainWithReset**
  (FUN_10168a974); if `0x130 ≠ 0` and the current calc is already
  CalcMainWithReset, keep; otherwise register **CalcMain** (FUN_10168a45c).
  (X keeps parameter changes from re-triggering the reset-variant — exact UI
  meaning of the X slot [H], as in Compressor.)
- **Per-sample callbacks** [D]: `CalcMain` (FUN_10168a45c) and
  `CalcMainWithReset` (FUN_10168a974, 285 lines — CalcMain plus a reset
  sweep; same voice math). One input frame per call, one output frame into
  out slots `0x40/0x44`.

**Shared sync recompute `FUN_101689e8c`** (called by OnSyncMode/OnMsDelay/
OnBarDelay/OnBarDelayOffset/NewTempo/Init) [D]:

```
if SyncMode(0x13c) == 1:   // Sync
    div  = divisionLUT[(int)0x144]        // FUN_101547e3c, bounds < 7, default 4.0
    base = (div + div·BarDelayOffset(0x148)) · beat_ms(0x160)
    if base ≥ 4600.0: base = 4599.0     // cap 4599 ms
else:                       // Time (ms)
    base = MsDelay(0x140)
0xe4 = base
if 0x110 ≠ 0x134: 0x48 = 0x134·4·0x50       // freq→grains/block mirror
if !X: 0x12c = (int)(sr_kHz·( (RandomPitch + (1−g)·1000)/freq + Spray + base ))
0x8  = round(0x12c)   [+ virtual notify]
```

**Division LUT** `0x104cbea6c` [B]: `{0.5, 0.25, 1.0, 0.75, 1.5, 1.25}`
(beats; index ≥ 7 → 4.0). Value order as stored; menu-order naming [H].
**0x12c is the delay in samples including spray and the pitch-dependent
extra term** `(RandomPitch + (1−g)·1000)/freq` — with g =
`*(float*)0x1058efff8` (global, runtime-built [B-negative]); the count is a
metering value (0x8 notify), the per-sample engine does not read it.

## 2. The state-slot ledger (every reader → its writer)

| slot | role | writer | value / law |
|---|---|---|---|
| 0x8 | delay, samples (meter) | recompute tails | `round(0x12c)` |
| 0x30/0x38 | input ptrs L/R | shell [H] | per-sample deref |
| 0x40/0x44 | out pair | CalcMain | `dry·cos²+wet·sin²` mix |
| 0x48 | grains per 512-block | OnFreq/INIT/recompute | `freq·4·(512/sr)` |
| 0x4c | window phase accumulator | CalcMain | += 0x48 per call |
| 0x50 | 512 samples in seconds | NewRate | `512/sr` |
| 0x60 | stagger table ptr | INIT | global 0x1059a8ef0 |
| 0x68/0x70/0x78/0x90 | L ring base/cap-ptr/write/capacity | NewRate/CALC | capacity = 0x12c·4 B |
| 0x98/0xa0/0xa8/0xc0 | R ring base/cap-ptr/write/capacity | NewRate/CALC | |
| 0xc8 | voice rotate counter (0..3) | CALC | `(c+1)&3` on phase wrap |
| 0xcc/0xd0 | L voice window phases | CALC | `t`, `t+0.5` |
| 0xd4/0xd8 | R voice window phases | CALC | `t+0.25`, `t+0.75` |
| 0xdc/0xe0 | L/R envelope weights | CALC | `0.5−0.5·cos(2π(x+0.5))` = sin²(πx) |
| 0xe4 | delay base, ms | recompute | sync law (§1) / 1.0 pre-Init |
| 0xe8 | per-grain drift step, ms | INIT/CALC | §3 law |
| 0xec | sr in kHz | NewRate | `sr·0.001` |
| 0xf0/f4 | L voice spray offsets, ms | CALC (per wrap) | `0xe4 + Spray·U` |
| 0xf8/fc | R voice spray offsets, ms | CALC | same |
| 0x100/104/108/10c | per-voice drift copies | CALC | voice k ← 0xe8 on its wrap |
| 0x110 | freq mirror | OnFreq/INIT/recompute | = 0x134 |
| 0x114/0x118 | L/R granular outputs | CALC | feedback taps |
| 0x11c/0x120 | dry/wet gains | OnDryWet/INIT | §3 law |
| 0x12c | delay count (int, samples) | NewRate/recompute | `int(sr_kHz·(…))` |
| 0x130 | "already reset" flag | callback swap | guards CalcMainWithReset re-select |
| 0x134 | **Grain freq (Hz as passed)** | OnFreq | |
| 0x138 | Spray, ms | OnSpray | |
| 0x13c | SyncMode (int) | OnSyncMode | 1 = sync |
| 0x140 / 0x144 / 0x148 | MsDelay / BarDelay idx / BarDelayOffset | setters | |
| 0x14c | RandomPitch | OnRandomPitch | |
| 0x150 | resample ratio | OnPitch | LUT 2^(st/12) |
| 0x154 | Feedback | OnFeedback | |
| 0x158 | DryWet | OnDryWet | |
| 0x15c / 0x15d | On / X bools | OnOn / OnX | |

## 3. The mechanism, plainly (CalcMain — one 512-sample block per call)

**Voices and windows.** The accumulator `0x4c += 0x48` each call, where
`0x48 = freq·4·(512/sr)` — the grain rate scaled to the block. The integer
part indexes a **512-entry runtime table** (`*(0x60)`, global
0x1059a8ef0 — corpus material, contents runtime-initialized [B-negative])
by `int & 511` with linear interpolation; the table value `t` is the shared
window phase. When the integer part crosses 511 the voice counter rotates
(`(c+1) & 3`), the wrapped voice gets a fresh spray offset
`0xe4 + Spray·U` and drift copy `0xe8`, and the accumulator folds back
(`frac + (int & 511)`).

All four voice phases are re-derived **every call** from `t`:
`L = {t, t+0.5}`, `R = {t+0.25, t+0.75}` [D — consts 0x104cc9810/18 [B]].
Each voice's envelope is `env = 0.5 − 0.5·cos(2π·(phase+0.5))` — a raised
cosine = sin²(π·phase) — so the L pair is complementary (sin²(πt) +
sin²(π(t+0.5)) = 1) and likewise R: **two grains per channel crossfaded by
one sin² weight, four grains staggered at quarter-phase over the sweep**.

**Read position (per voice, per sample).** With `phase` that voice's window
phase and `drift` its drift copy:

```
pos_ms   = spray_voice + phase · drift          // ms
pos      = max(0, pos_ms) · sr_kHz              // samples
tap      = ring[(write − ⌊pos⌋) mod capacity]   // 2-tap linear interp on frac
```

**Drift law** (Init + per-wrap reseed) [D]:

```
drift_ms = (RandomPitch·(U−0.5+U−0.5) + (1−ratio)·1000) · (1/freq)
```

— the pitch term is ±RandomPitch·(grain period) of per-grain jitter (two
uniform draws), and the ratio term is the classic granular pitch drift: a
grain sweeping its window reads `(1−ratio)` grain-periods of source, so the
read pointer's net rate vs. the write head is `ratio` [D for the formula;
the audible-ratio mapping H — see below].

**Pitch law (OnPitch)** [D]: `ratio = LUTinterp((semitones/12 − T0)·S)`
against the runtime LUT object at `*(0x1059a89b8)` (+0x20 domain start,
+0x24 domain scale, +8 table base — the same global LUT registry the
Compressor makeup table and the Beat Repeat filter multiplier use). The LUT
is corpus material [B-negative]; its intended content is 2^(x/12)-shaped
[H], pinned by the corpus gate.

**Feedback** [D]: cross-channel ping-pong into the rings —
`L_ring[write] = in_L + Feedback·prev_out_R(0x118)` and
`R_ring[write] = in_R + Feedback·curr_out_L` (the L leg reads last block's
R output, the R leg the current L output — half-block asymmetry as
decompiled).

**Mix** [D]: `out_L = in_L·dry + out_L_grain·wet`,
`out_R = in_R·dry + out_R_grain·wet`, with the equal-power pair
`dry = (1+cos(wπ))/2 = cos²(wπ/2)`, `wet = (1−cos(wπ))/2 = sin²(wπ/2)`
(denormal-flushed at |x| < 1e-12 by `FUN_101547e80` — the helper is a
flush-to-zero guard, not sqrt).

**Random source** [D]: the global **MINSTD Lehmer LCG**
`FUN_100d0b76c`: state `0x10588bf28`, `x = 48271·x mod (2³¹−1)` via the
subtract-and-clamp form, output `x/2147483647 ∈ [0,1]`; lazily seeded
(`FUN_100d0b574`). Five draws in Init (drift + four sprays), then per-wrap
draws in CalcMain. This is a different generator from Beat Repeat's
per-instance LCG (companion dossier §3).

**Window length.** Per call the phase advances `freq·4·(512/sr)` of the
0..512 sweep, so one sweep (= one grain generation, all four voices) spans
`1/(4·freq)` seconds. With the UI Grain knob driving `freq` in Hz
(manual: the Grain knob is a frequency 5–100 Hz [H on range]), the grain
generation period is 1/(4f) and each voice regenerates every 1/f seconds.
**Effective pitch-transfer:** the read-position law as written advances the
tap by `drift·(4f/sr)` samples/sample, i.e. `4·(1−ratio)` — a literal
reading implies effective playback rate `4·ratio−3`; the standard granular
identity (read sweeps (1−ratio) periods per window) implies the ×4 belongs
to the window/regeneration schedule, not the drift. The decompile is [D];
the mapping is **[H]** — resolve by the golden-render corpus (one render at
+12 st with spray 0 decides it).

## 4. What remains open (honest residuals)

- **Param-block registrar `FUN_101689a14`** (defaults, ranges, which UI knob
  maps to OnFreq vs. OnMsDelay etc.) not captured — wrapper is a 17-line
  delegate; the ctor-side defaults (0x134/0x138 initial values) are open.
- **The 512-entry stagger table** (`*(0x60)`), the **pitch LUT** contents
  (`*(0x1059a89b8)` member) and the global float `g` (0x1058efff8) are
  runtime-initialized — corpus material, [B-negative].
- **Effective pitch ratio mapping** (§3 ×4 question) and the UI unit of the
  Grain knob (Hz vs ms→Hz) — [H], corpus-gated.
- **CalcMainWithReset's extra sweep** (FUN_10168a974) captured but not yet
  read line-by-line; the 0x130 flag's full lifecycle is open.
- **Sync division menu naming** (LUT order {0.5, 0.25, 1.0, 0.75, 1.5, 1.25}
  → UI rows) [H]; index 6 of the LUT reads 2705.5625 — adjacent data, not a
  division (bounds allow it but the UI never sends it) [H].
- **X-slot UI meaning** (callback-swap behavior is [D]; what the X toggle
  exposes as) [H].
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Call topology, all twelve setter laws, NewRate/NewTempo/Init/Reset, the
  sync recompute, division LUT, drift/spray/envelope/feedback/mix laws,
  MINSTD RNG, OnPitch LUT shape: **high** as decompile readings — single
  source (BlockProbe/DataProbe/DoubleDump from the analyzed LiveRE2
  project), cross-checked against the symbol table and raw-asm thunk
  listings (CallTargetsProbe agreed on every tail target).
- Effective pitch mapping, UI knob units, menu naming, X semantics:
  **low** — graded [H], do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Grain Delay does not exist yet (COVERAGE row empty).
