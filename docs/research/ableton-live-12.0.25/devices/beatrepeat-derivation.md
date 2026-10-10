# Beat Repeat (BeatRepeatDevice) binary derivation — five-processor engine (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SymProbe/CallTargetsProbe/BlockProbe/DataProbe/DoubleDump scripts, no
re-import). NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/beatrepeat-decompiles.txt` (all five create chains, every
registered member body, the grid/interval/offset/gate division tables,
const decodes). Form follows `compressor-derivation.md`; claims graded:
**[D] decompiled-confirmed**, **[B] byte-decoded** (static `__DATA`),
**[H] unverified hypothesis** — no behavioral renders ran in this lane; per
README every [D]/[B] claim still awaits the golden-render cross-check before
it gates a rebuild.

Beat Repeat is **not one processor** — it registers five
(`OProcessorCreateManager::SOnProcessorCreate`, addresses in the capture
header): **Control** (the grid/interval/offset/gate/chance/damp law — no
audio), **RingBuffer** (a plain variable stereo delay line), **Player** (a
voice over the shared sample-playback engine — plays a segment with rate and
volume, fades), **Freeze** (a one-way capture voice), and **Mix** (dry/wet
modes + the wet band-pass). The DSP core is trivial per processor; the
device's behavior lives in the Control layer's event scheduling against the
transport.

## 1. What runs when (call topology)

- **Control `OBeatRepeatControlProcessor`** (create 0x1018bb5a4): NewRate
  stores `0x88 = sr`; every grid parameter setter stores its enum index and,
  if the scheduler is live (byte +0x35 of the event object), re-anchors a
  quantized beat-time event: it reads the transport position double
  (`FUN_101551390(...)+0x70`), snaps through the rational quantizer
  (`FUN_100d09aa8` with 0x3f30… = 1e-4 tick quantum; sentinel comparisons
  against 0x104aa4c90/c98/ca0/ca8; denominator 3843840.0), converts with
  `FUN_100d099e0`, and reschedules (`FUN_101757950`) [D]. Members: Init,
  Exit, NewRate, OnOn, OnX, OnInterval, OnOffset, OnGrid, OnGate,
  OnChanceForRepetition, OnDampVolume, OnDampPitch, OnBasePitch,
  OnInstantRepeat, OnBlockTripplets, OnGridChance, OnGridChanceType.
- **RingBuffer `OBeatRepeatRingBufferProcessor`** (create 0x1018bb74c):
  NewRate allocates **two float arrays of `int(sr·4.01 + 0.5)` samples**
  (≈ 4.01 s stereo ring), zeroes them, resets write/read indices [D].
- **Player `OBeatRepeatPlayerProcessor`** (create 0x101aa0a7c): a thin
  wrapper over the shared sample-playback engine (`func_0x101a4bc04`
  factory — the same engine family as the sampler voices [H on identity]):
  OnSample stores a sample-wrapper pointer (+refcount); OnStart(start=0,
  end=frames−1, fade=param, **increment = slot 0x2a0**, engine, buffers,
  OnEndOfPlaying-callback, volume = slot 0x2b0); OnStop triggers the
  engine's fade-out with an OnFadeOutComplete callback (byte 0x290 guards
  re-entry) [D].
- **Freeze `OBeatRepeatFreezeProcessor`** (create 0x101aa0b50): OnStart
  toggles a run byte and swaps CalcMain in/out of the scheduler slot;
  CalcMain copies input frames into two arrays at a running index — a
  one-way capture [D]. Role in the device wiring [H] (§4).
- **Mix `OBeatRepeatMixProcessor`** (create 0x1018bb678): per-sample calc
  families selected by a shared dispatch (OnOn/OnDryX/OnWetX/OnMixType all
  funnel into it) [D]:
  - On==0, or (WetX==0 and DryX==0) → **CalcBypass** (dry passthrough).
  - WetX==0, DryX==1 → **CalcMainDry** (dry only).
  - WetX==1, (DryX==0 or MixType==2) → **CalcMainWet / CalcMainWetFilter**
    (filter variant when the filter-on byte +0x38 is set).
  - WetX==1, DryX==1, MixType==0 → **CalcMainMix / CalcMainMixFilter**
    (dry + level·wet). MixType==1 keeps the current Wet-family calc
    (hysteresis guard `0x10 == 1`).
  Mode changes ramp through the **Fade** variants: per-channel fade states
  (`+0x28 += +0x2c`, `+0x30 += +0x34`) crossfade dry and wet legs — the
  click-protect on Repeat/Ins/Gap and dry/wet-X switches [D].

## 2. The state-slot ledger (Control processor, every reader → its writer)

| slot | role | writer | value / law |
|---|---|---|---|
| 0x10 | Interval division (double, beats) | OnInterval | table 0x10528c848 |
| 0x18 / 0x1c | Grid index (int, mirrored) | OnGrid, OnBlockTripplets | |
| 0x20 | chance-grid index (int) | OnGridChance/OnGridChanceType | §3 law |
| 0x24 | GridChance amount (int) | OnGridChance | |
| 0x28 | GridChanceType (int) | OnGridChanceType | 0 = off |
| 0x30 | Gate (double, beats) | OnGate | table 0x10528cbf0 |
| 0x38 / 0x3c | DampVolume / DampPitch | setters | |
| 0x40 | −BasePitch (semitones, negated) | OnBasePitch | |
| 0x48 | current grid division (double, beats) | OnGrid/OnBlockTripplets | grid table |
| 0x50 | InstantRepeat bool | OnInstantRepeat | |
| 0x54 | ChanceForRepetition | OnChanceForRepetition | pure store |
| 0x58 | chance RNG state (uint) | OnGridChance/Type | LCG §3 |
| 0x5c | control-active flag | OnOn/OnX [H] | gates chance machinery |
| 0x44 | BlockTripplets bool | OnBlockTripplets | selects grid-table +8 view |
| 0x70 | volume-damp accumulator (double) | damp law / trigger path | repeat count domain |
| 0x7c | pitch-damp counter (int) | damp law / trigger path | repeat count |
| 0x80 / 0x98 / 0xa0 / 0xa8 / 0xb8 | scheduler/event objects | Init, setters | plumbing |

Mix processor: 0x14 MixType, 0x10 calc-id, 0x18 wet level, 0x1c sr, 0x20/0x21/0x22
On/DryX/WetX, 0x38 filter-on, 0x3c/0x40 MidFreq/BandWidth stored, 0x44–0x94
biquad coeffs/states (two cascaded sections per channel), 0xc0/0xc8 dry-in
ptrs, 0xd0/0xd8 wet-in ptrs, 0xe0/0xe4 out pair. Player: 0x2a0 increment,
0x2a8 sample wrapper, 0x2b0 volume, 0x290 fade-active byte.

## 3. The mechanism, plainly

**The grid law (Interval/Offset/Gate/Grid)** [D tables, B values]. All four
divisions are const tables in **beats** (capture header):

- **Interval** (0x10528c848, 8 entries): `{1/8, 1/4, 1/2, 1, 2, 4, 8, 16}` —
  how often a repeat can trigger.
- **Grid** (0x10528c9c8, 16 entries, 32-byte stride, double at +0 with the
  BlockTripplets view at +8): straight `{1/64, 1/32, 1/24, 1/16, 1/12, 1/8,
  1/6, 1/4, 1/3, 1/2, 3/4, 1, 1.5, 2, 3, 4}`; +8 view `{1/64, 1/32, 1/24,
  1/16, 1/8, 1/8, 1/4, 1/4, 1/2, 1/2, 1, 1, 2, 2, 4, 4}`. Menu-row naming
  per index [H].
- **Offset** (0x10528c8c8, 16 entries): `{0, 0.25, …, 3.75}` — the trigger
  grid shifted in quarter-beats.
- **Gate** (0x10528cbf0, 19 entries): `{0.25, 0.5, …, 4}` step 0.25, then
  `{8, 12, 16}` — the repeat duration in beats. (UI unit naming [H].)

OnGrid/OnBlockTripplets additionally **halve the division while
`division/bps > 0.06666667 s`** — no grid division may exceed 1/15 s
[D — the constant 0.06666667014360428 is in every re-anchor path]. The
parameter setters never schedule audio directly: they re-anchor quantized
events; the actual repeat trigger fires from the scheduler tick path (the
`0x1d0` virtual dispatch with 1.0f — the grid-tick handler), whose body is
outside this capture [H on the tick→Player call chain].

**The chance/probability gate** [D]. GridChance/GridChanceType implement a
*chance grid* — a subdivision of the main grid on which repetition is
probabilistic:

- The chance grid index is randomized per re-anchor:
  `idx = GridIndex − GridChance/2 + round(GridChance·U)`, clamped to
  `[0, 15]`, where `U ∈ [0,2)` is drawn from a **per-instance LCG**:
  `x' = x·1664525 + 1013904223 (mod 2³²)` (Numerical-Recipes constants
  0x19660d/0x3c6ef35f), state at Control+0x58, float drawn from the low 23
  mantissa bits.
- GridChanceType picks the chance-grid period (switch, cases visible in
  capture): `1 → 1.0`, `2 → 0.5`, `3 → 0.25` beats, `4 → the current Grid
  division (halved-loop gated to the 1/15 s floor)`; 0 disables the
  machinery.
- ChanceForRepetition (pure store, slot 0x54) is the probability consumed
  at the roll site (trigger path, not captured [H]).
- **RNG provenance: NOT Erosion's.** Erosion/Grain Delay share the global
  MINSTD Lehmer LCG (state 0x10588bf28, a=48271, m=2³¹−1); Beat Repeat's
  Control uses its own Numerical-Recipes LCG with private per-instance
  state — the two streams are independent by construction [D].

**The damp laws (Live 12's per-repeat decay/detune)** [D]:

```
repeat volume      gain_n = exp(−10·DampVolume² · acc)     // floor e^−27.631 ≈ −120 dB
repeat playback    incr  = 2^(−BasePitch/12) · (1 − DampPitch/10)^count
                                                            // floor 0.001
```

where `acc` (0x70, double) and `count` (0x7c, int) are the repeat counters
advanced by the trigger path (not captured). OnDampVolume/OnDampPitch/
OnBasePitch push the derived value straight to the Player via virtual
dispatches (the OnVolume/OnIncrement trampolines) — the Player's
increment/volume slots (0x2a0/0x2b0) ARE the repeat rate/gain. So each
successive repeat is quieter by `exp(−10·dv²)` and detuned by the factor
`(1−dv_p/10)` compounding per repeat, on top of a base transposition of
`−BasePitch` semitones (positive UI pitch = faster = higher [D from the
negated store]).

**The repeat buffer mechanics** [D per processor; wiring H]:

- RingBuffer: write index `0x14`, read index `0x18`, capacity `0x1c`;
  `OnDelayInSamples(d)`: `read = write − d (mod capacity)`, recomputed only
  on change; CalcMain per sample: `ring[write±] = in`, `out = ring[read]`
  with both indices wrapping — a fixed integer-sample delay up to ~4 s.
  This is the capture/monitor delay the device plays against [H on how the
  Player's segments are cut from it — the Player consumes a sample-wrapper,
  not the ring arrays directly].
- Player: OnStart(begin=0, end=frames−1, fade, increment, volume) through
  the shared playback engine; OnStop → engine fade-out → OnFadeOutComplete
  clears the guard byte. Repeats are therefore buffer plays with fades, not
  looped reads — the repeat count/Inf behavior must live in the Control
  trigger re-arming (tick path) [H].
- Mix wet filter (MidFreq/BandWidth) [D formulas, H naming]: each setter
  recomputes a **stereo cascade of two biquad sections** (states/coeffs
  0x44–0x94) from the stored pair: a spread multiplier
  `m = LUTinterp((param·0.5 − T0)·S)` from the global LUT registry
  `*(0x1059a89b8)` (corpus [B-negative]) — the high section centers at
  `min(MidFreq·m, 18000 Hz)`, the low at `max(MidFreq/m, 50 Hz)` — a
  geometric band split around MidFreq. Coefficient law per section
  (`k = *(slot)`; `a = 1/(sin(ω)/√2 + 1)`, `ω = 2πf/sr` capped at
  3.1101768): section A `b0=b2=(1−k)a/2, b1=(1−k)a, a1=−2k·a,
  a2=(1−sin(ω)/√2)a`; section B `b0=b2=(k+1)a/2, b1=−(k+1)a, a1=−2k'·a, …`
  — one LP-shaped, one HP-shaped numerator (band-pass by cascade). The
  k-slots (0x6c/0xa8) are ctor-set (not written by either setter) — exact
  resonance/damping constants open (§4).

**No transient detector exists in these processors.** The lane's
"Mild/Med/Hard transient-detection grid masking" has no counterpart in any
captured body: there is no envelope follower, peak detector or
transient-classification code in any of the five processors — the chance
grid masks by subdivision index only (§3) [D-negative]. If a UI exposes
Mild/Med/Hard wording, it maps onto GridChanceType or Interval indices at
the shell layer, not onto a detector [H].

## 4. What remains open (honest residuals)

- **The trigger state machine.** The scheduler tick handler that rolls
  ChanceForRepetition, advances the repeat counters (0x70/0x7c), and calls
  Player OnStart/OnStop per repeat (including the Repeat-count/Inf
  semantics) is not in the captured set — the biggest single gap; the damp
  laws' counters are read but never written in these bodies.
- **Inter-processor wiring**: what the shell feeds Mix's dry (0xc0) and wet
  (0xd0) pointers (hypothesis: dry = device input, wet = Player output),
  where RingBuffer's output lands, and what consumes Freeze's capture —
  all [H].
- **UI naming**: menu-row names for Grid/Interval/Offset/Gate indices, the
  Repeat/Ins/Gap ↔ MixType 0/1/2 mapping (dispatch law is [D]; the naming
  is the manual's), DampVolume/DampPitch/BasePitch UI names (Live 12 added
  per-repeat decay/detune — names unverified), and the Mild/Med/Hard
  wording (§3).
- **Mix filter constants** (k-slots 0x6c/0xa8 ctor values) and the ctor
  param-registrar bodies for all five wrappers (defaults/ranges) — not
  captured.
- **Control OnOn/OnX, OnOffset/OnGate tails, OnInstantRepeat trigger arm**,
  RingBuffer OnX/OnTurnOffEvent, Freeze OnStop/OnConnectSampleWrapper,
  Player NewRate/Init/Reset — captured in the evidence file, not yet read
  line-by-line.
- The rational quantizer (`FUN_100d09aa8`/`FUN_100d099e0`) and the sentinel
  doubles (0x104aa4c90..a8) — [D shape] (position-snapping with tick
  denominator 3843840), exact rational semantics open.
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Five-processor inventory, member symbol table, Mix dispatch/calc laws,
  RingBuffer mechanics, Player engine-call shape, Freeze capture, all four
  division tables, the chance-grid LCG and its separation from the global
  MINSTD, the damp laws, the absence of any transient detector: **high** as
  decompile readings — single source (BlockProbe/DataProbe/DoubleDump from
  the analyzed LiveRE2 project), cross-checked against the symbol table and
  thunk listings (CallTargetsProbe agreed on every resolved target).
- Trigger state machine, wiring, UI naming, MixType↔mode map, filter
  constants: **low** — graded [H], do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Beat Repeat does not exist yet (COVERAGE row empty).
