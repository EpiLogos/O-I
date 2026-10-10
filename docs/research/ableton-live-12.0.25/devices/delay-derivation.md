# Delay (DelayDevice) binary derivation — per-sample layer (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
BlockProbe/DataProbe/SearchProbe scripts, no re-import) plus `nm -U` decodes.
NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/delay-decompiles.txt` (model-parameter census, create
chain, shell calc, DelayDevice ctor, the calc-slot selector, the crossfade
curve function, 12 parameter-event setters, const decodes). Form follows
`compressor-derivation.md`/`saturator-derivation.md`; claims graded:
**[D] decompiled-confirmed** (capture cited), **[B] byte-decoded**,
**[H] unverified hypothesis** — no behavioral renders ran in this lane; per
README every [D]/[B] claim still awaits the golden-render cross-check before
it gates a rebuild.

The stock Delay is NOT an `O<Dsp>Processor` like Compressor/Saturator/Auto
Filter: it is the **devicekit architecture** —
`ODeviceKitDeviceProcessor<ableton::devices::delay::DelayDevice>` over a
`TickableSampleRateDeviceModel<devices::delay::model::Delay>`. The whole
`ableton::dsp::blocks::delay` library is inlined (only `noop<>` stubs keep
symbols), so the per-sample DSP has no named functions; what IS fully
recoverable statically is the parameter model: every parameter's mapping
law, the message plumbing, the topology dispatch and the dry/wet curves.
The audio-thread delay-line body itself remains closed in this pass (§4).

## 1. What runs when (call topology)

- **Create** `OProcessorCreateManager::SOnProcessorCreate<ODelayProcessor>`
  0x1018c56cc → wrapper 0x1018c5708 (device-kit shell, param block at
  shell+0x268) → **DelayDevice ctor** `0x1018a46f4` [D]: builds the model
  object (`func_0x0001018e8200`, sr arg), registers the four transport
  callbacks — `OnSampleRateChanged` (+0xd8), `OnTempoChanged` (+0x108),
  `OnTransportPlayingStateChanged` (+0x138), `OnBeatTimeJump` (+0x168/+0x198)
  —, the message object at +0x208 (vtable `PTR_1050a3b28`), and a delay-line
  vector grown by `func_0x0001018d6b64(ptr, X<<4)` (32-byte elements —
  frame/block records; exact capacity law open [H]).
- **Shell calc** `CalcMainSingleSample` (trampoline 0x1018df8c4) [D] is a
  parameter-transport trampoline, not DSP: gates on On/X bytes
  (+0x200..0x203), pulls the model snapshot (`*(0xb8)` → reader objects
  0xd28/0xd20) into the audio fields 0x1e0/0x1e4, walks a tickable list
  (`*(lVar6+0xd20)` entries), posts the tick message
  (`0x228 = 1; func_0x00010154e720(scheduler, +0x208); 0x238 = 1`), and
  swaps the active calc pointer `*(+0x40) = *(+0x38)`. The DSP therefore
  runs in callbacks installed into the **calc-slot table at +0x208, stride
  0x18** — selected arithmetically, see §3.
- **Parameter events** arrive as `OnAutomatableFloatEvent<P>` /
  `OnFloatEvent<P>` / `OnRampEvent<P>` SProcessorFunc trampolines (nm table,
  0x1018e5e84–0x1018e7dc8) — these ARE the setters [D]. Each writes the raw
  value as a double into the model (current + target + zeroed delta), derives
  a model-side value, and dispatches it to subscriber lists (count at
  list+0x88) into the audio thread. Representative laws (§2/§3).
- **setCallbacks lambdas** (the `InvokeFunctionFactory` symbols) write the
  DSP-state block: SmoothingMode → int +0x1a10 (dirty byte +0x1a44 = 1);
  BeatDelayTimes L/R → `FUN_103b72644` lookup → float +0x1a20 / +0x1a24 +
  dirty; CompatibilityType → int +0x1a40 + selector `FUN_1036e5a34` + dirty;
  DryWetMode → int +0x74 and the crossfade-curve pick via `FUN_10179afd0`.
- **Ramp events** (Feedback, DryWet, Filter Frequency/Bandwidth, Modulation
  Frequency/AmountTime/AmountFilter, SmoothingMode) share the linear
  de-zipper: `target = +0x30; if n==0 state = target else inc = (target −
  state)/n; state += inc` — doubles, the Saturator `OnPreDrive` law [D].

## 2. The state-slot ledger (model + DSP state)

Model side (each parameter: raw double, target double, delta, derived value,
subscriber list) — writers: SET = event trampoline, LAMBDA = setCallbacks
invoke, CTOR.

| slot (model obj) | role | writer | law |
|---|---|---|---|
| +0x68 / +0xb8 / +0x108 / +0x5d8 | Link / PingPong / SyncL (…R) / Freeze bools | SET | `v ≥ 0.5` |
| +0x1c0 | TimeL derived (…R twin) | SET OnTimeL | `min(+0x198) + scale(+0x19c)·powf(v, exp(+0x1b0))` |
| +0x288 | SimpleDelayTimeL derived | SET | `min + scale·v` (linear) |
| +0x348 | PingPongDelayTimeL derived | SET | `min + scale·v` (linear) |
| +0x3f8 | SyncedSixteenthL as int | SET | round-to-nearest: `(int)(0.5^sign + v)` |
| +0x4a8 | OffsetL derived | SET | `min + scale·v` (linear) |
| +0x8a0 | DryWetMode int | SET OnFloatEvent | → curve pick (§3) |
| +0x20/+0x28/+0x30 | ramp state / inc / target (per ramped param group) | RAMP SET | `(target−state)/n` per sample |
| +0xf4 | compat bool mirror | CTOR-side SET | CompatibilityType != 0 |

DSP-state block (written by lambdas, read by the audio tick):

| slot | role | law |
|---|---|---|
| +0x74 / +0x80 / +0x84 | DryWetMode / wet-curve id / dry-curve id | curve = `mode==0 ? 1 : 2` |
| +0x1a10 | SmoothingMode enum | dirty +0x1a44 |
| +0x1a20 / +0x1a24 | SyncedSixteenth L/R (as float) | identity table 0x104e2b620 = enum values 1..N [B] |
| +0x1a40 | CompatibilityType | triggers calc-slot reselect |
| +0x1a44 | structural dirty byte | consumed by tick |

## 3. The mechanism, plainly

**Synced vs time.** Two parameter families per channel: free `TimeL/R`
(curved mapping `min + scale·v^exp` — the UI knob law, exponents from the
model config) and `SyncedSixteenthL/R` (enum, rounded to int, stored raw).
The synced value is NOT converted to samples at set time — the
`BeatDelayTimes → samples` lookup `FUN_103b72644` is an **identity table**
(enum → float 1..N, static const at 0x104e2b620 [B]) — so the sixteenth
→ seconds → samples conversion happens on the audio tick from the transport
(the four On* transport callbacks exist exactly for this). `SyncL/R` gates
which family is live; `Link` couples the channels [D on plumbing, H on the
tick-side conversion].

**Topology dispatch (compat + character).** `FUN_1036e5a34` recomputes the
active calc callback from a **bitfield index** [D]:

```
idx = (compat==0 ? 0 : 4 | (0x7c!=0 ? 4 : 0))
    | (~0x7c & 1)<<7 | (+0x1e0)<<6 | (+0x1e1)<<5
    | (+0x64 int)·8 | (+0x60)<<1 | (+0xb8)
active = table[+0x208 + idx·0x18]      // {ctx, fn} pairs
```

— a computed dispatch over parameter state (CompatibilityType, plus five
topology bits), replacing the static dispatch tables of the older devices.
`CompatibilityMode`/`CompatibilityType` is the "old-engine compatibility"
switch in the Live 12.1+ Delay model surface [B from symbols; the two
engines' audible difference is not captured].

**Dry/wet curves.** `FUN_10179afd0(w, curve)` — four closed forms [D]:
case 0 `1 − w` (linear complement); case 1 `0.5 − 0.5·sin(π·(w−0.5))`
(sine quarter-cycle, Taylor sin with constants −0.00018284567 / 0.008304825
/ −0.16664949); case 2 equal-power chain `g = clamp(0.5 + 0.5·sin(π·(2w−1)))
→ sin((1−g)·π/2)`; case 3 `sqrt(1 − w)`. The device selects **curve 1
(sine) for DryWetMode 0, curve 2 (equal-power) otherwise** [D; which gain of
the pair this function computes (wet vs dry leg) open [H]].

**Feedback + filters + modulation are ramps, not jumps**: Feedback, Filter
On/Frequency/Bandwidth, Filter2On (a second filter exists in the model:
`model::Filter2On`), Modulation Frequency/AmountTime/AmountFilter all arrive
through `OnRampEvent` (linear de-zipper in doubles) — the filter sits in the
model as `Filter{On, Frequency, Bandwidth}` and `Filter2On`, consistent with
the UI's two filter stages, but **the in-loop placement (pre/post feedback)
is not statically recovered in this pass** [H].

**Character/smoothing.** The mode parameter of this device is
`DelayLine::SmoothingMode` (enum, ramped, DSP state +0x1a10). No
"Repitch"/"Texture" strings belong to this device in this build: the Repitch
hits in __cstring are `ORepitchProcessor` / `devices::repitch::RepitchDevice`
(separate device) and `echo::model::Delay::Repitch` (Echo) — the task's
"Repitch/Fade/Jump/Texture?" candidate naming is NOT found on DelayDevice;
its enum names are not statically decodable in this pass [B-negative]. The
per-mode delay-change law (crossfade vs pitch-shift vs instant) lives in the
audio tick, not captured (§4).

## 4. What remains open (honest residuals)

- **The audio-thread process body.** Delay-line read/write and
  interpolation, pingpong cross-routing (PingPong bool +0xb8 exists; the
  L/R swap law is in the tick), feedback + filter loop order, Freeze hold,
  the mod oscillator (Frequency/AmountTime/AmountFilter) and the
  SmoothingMode per-mode law all live in the tick callbacks behind the
  computed +0x208 table — not captured in this pass. Pinning them needs
  either a targeted follow-up lane (walk the +0x208 table entries from a
  live instance) or golden renders.
- **Synced time conversion** (sixteenth enum → samples from tempo/beat-time
  at tick) — the transport callbacks' bodies were not decompiled.
- **Runtime state**: the +0x208 callback table contents are runtime
  pointers [B-negative]; the DryWetMode/SmoothingMode/CompatibilityType
  enum UI names; EcoProcessing semantics (bool in model, no captured
  consumer).
- **Line capacity law**: ctor tail grows the vector by `X<<4` 32-byte
  elements with `X = func_0x000101521a5c()` [H: sr-derived; exact seconds
  cap unknown].
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Architecture split (devicekit vs O-processor), the full parameter surface
  (18 DelayLine/Delay/Filter/Modulation parameters), the per-parameter
  mapping laws (bools 0.5-gate, Time pow-curve vs linear Simple/PingPong/
  Offset maps, SyncedSixteenth round-to-int), the ramp/de-zipper law, the
  dry/wet curve closed forms, the bitfield calc-slot dispatch, the
  BeatDelayTimes identity table: **high** as decompile/byte readings —
  single-source decompiles cross-checked against the `nm -U` symbol surface,
  which agrees everywhere they overlap (parameter names ↔ setter slots ↔
  lambdas).
- Which dry/wet leg the curve function computes, the in-loop filter
  placement, line capacity, and all tick-side DSP: **not established** —
  graded [H] or open; do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Delay does not exist yet (COVERAGE row empty).
