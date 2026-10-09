# Saturator binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SearchProbe/SaturatorProbe/BlockProbe/SaturatorData scripts, no re-import),
plus `nm -U` symbol decodes and the factory preset XML read from the
installed app bundle (`Core Library/Devices/Audio Effects/Saturator/*.adv`).
NOT FOR REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/saturator-decompiles.txt`. Form follows
`compressor-derivation.md`/`glue-perblock-derivation.md`; claims graded:
**[D] decompiled-confirmed** (capture cited), **[B] byte-decoded** (nm/xxd/
const pool), **[H] unverified hypothesis** — no behavioral renders ran in
this lane; per README every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

The stock Saturator is TWO processors: `OSaturatorProcessor` (the main
per-sample chain: input drive → Color biquads → waveshaper table → Color
biquads → post-clip table → dry/wet) and `OSaturatorTableProcessor` (a
curve-LUT builder that generates the Type-6 "Waveshaper" user table entry by
entry and ships it to the main processor via `OnShaperTable` messages).
There is no detector/ballistics anywhere — it is a purely feedforward
waveshaper, unlike the Compressor/Glue. The stock Type curves are NOT
computed per sample: `OnType` installs precomputed table objects from a
runtime registry, and the per-sample work for every type is the same table
lookup.

## 1. What runs when (call topology)

- **Create (main)** `OProcessorCreateManager::SOnProcessorCreate<OSaturatorProcessor>`
  0x1018c3984 → wrapper 0x1018c39c0 (device-kit shell, param block at
  shell+0x528) → **ctor** `func_0x0001019a172c` [D]: drive-gain ramp target
  1.0 (10^0) at 0x78; color/biquad state object at 0x7c (4 biquad groups,
  each carrying its own 1/sr: groups A 0x80, B 0xbc, C 0xf8, D 0x134 —
  0xa8 = A's 1/sr, 0xe4 = B's [B, from `func_0x000101883118`]); DC-blocker
  #1 (PreDc, the 0x180 group) R = 0.995/0.997 at the 44.1 kHz reference;
  DC-blocker #2 (the 0x4a0 group) R = 0.999/0.999 [B: 0x3f7eb852, 0x3f7f3b64,
  0x3f7fbe77]; **post-clip table = stock table #5 (the "Analog Clip" curve)**
  (`0x4d0 = factory(5)`) [D]; dry gain 0x4f8 = 1.0, wet 0x4fc = 0; defaults
  BaseDrive 0 dB, ColorFrequency 1000, WidthFactor 0.3, ColorDepth 0 dB
  [B: const pool 0x104cf3000]. 4x-oversampler state groups at
  0x1b8/0x230/0x2a8/0x320/0x398/0x410 (reset helper `func_0x0001018b09a4`).
  Enable gates: 0x2c (On), 0x2d (X).
- **Create (table)** `SOnProcessorCreate<OSaturatorTableProcessor>`
  0x1018c3a58 → wrapper 0x1018c3a94 (param block shell+0x98) → ctor
  `func_0x0001019a0694` [D]: three table objects at 0x38/0x40/0x48, each
  `{+8 data, +0x18 size(int), +0x1c domainMax, +0x20 domainMin, +0x24 scale}`,
  domain **[−10, +10]**, scale = size/20 [B]; curve params 0x68 Drive,
  0x6c Lin, 0x70 Curve, 0x74 Damp, 0x78 Period², 0x7c Depth²; generator
  phase 0x8c, phase increment 0x90, write index 0x80.
- **Setters are the trampoline bodies** (same as the Compressor lane).
  Table-processor setters [D]: OnDrive→0x68, OnLin→0x6c, OnCurve→0x70,
  OnDamp→0x74 raw; **OnPeriod→0x78 = v·v, OnDepth→0x7c = v·v** (squared);
  each marks dirty 0x1a and pokes the scheduler (message tag 0x1003).
  Main setters [D]: OnOn→0x2c (rising edge: resets color object, both DC
  groups, all 6 oversampler groups, meters), OnX→0x2d, OnType→0x38,
  OnDryWet→0x34 with `0x4f8 = 1−w, 0x4fc = w·0x78`, OnColorOn→0x50,
  OnPostClip→0x51, OnPreDcFilter→0x54, OnOversampling→0x58 (0/1; the
  dispatch tables have exactly two 4x slots) — every structural toggle
  re-runs the shared callback-swap tail (calc-slot registry, same shape as
  the Compressor's).
- **OnPreDrive is a message, not a float setter** `OnPreDrive(void*)` [D]:
  payload = {float drive_dB, int rampSamples}; `gain = LUT_global[0x1059a89c0][dB·0.05]`
  (runtime-built dB→linear table, same family as the Compressor's 0x1059a89b8
  struct — contents open [B-negative]); then the **de-zipper**:
  `0x70 = n; if n<1 → 0x60 = gain, 0x68 = 0; else 0x68 = (gain − 0x60)/n`
  (linear per-sample ramp, doubles), snapping when |inc| < 1e-12.
- **OnPostDrive** [D]: `g = LUT_global[f·0.05] → 0x78` (the output trim,
  linear), then rewrites the DryWet gains 0x4f8/0x4fc. PreDrive range
  −36…36 dB, PostDrive −36…0 dB, DryWet 0–1 [B: factory preset
  MidiControllerRange].
- **Color setters** (OnBaseDrive/OnColorDepth/OnColorWidth/OnColorFrequency)
  [D]: each stores its raw value (0x170/0x17c/0x178/0x174) and recomputes
  the two complementary biquad pairs (law in §3). NewRate also recomputes
  via the color object's own mirrored copies (`func_0x0001019a08d0`).
- **NewRate(int,int)** `0x1019ace98` [D]: second int = sample rate (Compressor
  convention) → 0x30; color object re-init; **DC Rs rescaled
  `R_work = R_44k^(44100/sr)` → 0x188/0x18c** (rate-invariant time constants).
- **Reset** `0x1019ace30` [D]: color reset, both DC groups zeroed, oversampler
  inline states 0x1c0–0x220 zeroed.
- **Per-sample callbacks**: 20 registered `SProcessorFunc`s [D, symbol
  table]: 16 static variants `CalcMain{NoColor|Color}{NoPostClip|PostClip}{PreDc?}{4x?}`
  (the 2×2×2×2 flag cube, baked) + `CalcMainDynamic{,4x}` and
  `CalcMainDynamicCrossfade{,4x}` (flags checked at runtime). Selection:
  stock types read static dispatch tables at 0x1059b5640/0x…5660/0x…5680/
  0x…56a0 indexed `[PreDc 0x54][entry 0x10][Oversampling 0x58]` with the
  base picked by PostClip 0x51 × ColorOn 0x50; Type 6 reads 0x1059b56c0
  (no live table yet) / 0x1059b56d0 (live table → crossfade variants,
  crossfade length `func_0x00010189dd5c() = 0x1003 = 4099` samples,
  fraction 0x49c = 1/4099) [D]; **all table contents are runtime __DATA,
  not statically decodable** [B-negative].
- **OnShaperTable(void*)** [D]: payload = two table objects → 0x40/0x48;
  if Type==6, installs into the active-table slot 0x1b0 (struct setter
  `func_0x000101884a28`), stashes the incoming object at 0x488, resets the
  crossfade counter 0x498.
- **CalcTableMain** (table processor, one entry per scheduled call) [D]:
  the Type-6 curve generator, closed form (§3).

## 2. The state-slot ledger

Writers: SET = parameter setter (trampoline body), CO = ctor, INIT =
NewRate/helpers, CALC = per-sample callback.

Main processor (`OSaturatorProcessor`):

| slot | role | writer | value / law |
|---|---|---|---|
| 0x30 | sample rate (float) | INIT NewRate | 2nd int arg |
| 0x34 | DryWet w | SET | 0..1 |
| 0x38 | Type (int 0..6) | SET OnType | 0=Analog Clip 1=Soft Sine 2=Medium Curve 3=Hard Curve 4=Sinoid Fold 5=Digital Clip 6=Waveshaper [B] |
| 0x2c / 0x2d | On / X bools | SET | gate the calc callback (else NoCalcAudio) |
| 0x40 / 0x48 | shaper table objects (current / incoming) | SET OnShaperTable | Type 6 only |
| 0x50 / 0x51 / 0x54 / 0x58 | ColorOn / PostClip / PreDcFilter / Oversampling | SET | dispatch indices |
| 0x60 / 0x68 | drive gain (double) / ramp increment (double) | SET OnPreDrive, CALC | `0x60 += 0x68` per sample |
| 0x70 | ramp length | SET OnPreDrive | |
| 0x78 | PostDrive output gain (linear) | SET OnPostDrive | LUT(dB·0.05) |
| 0x7c…0x170 | color object: 4 biquad groups A 0x80 B 0xbc C 0xf8 D 0x134 (coeffs b0,b1,b2,A1,A2,+n; states x1,x2,y1,y2; 1/sr at group+0x2c: 0xa8, 0xe4) | SET Color*, INIT | A/C = BaseDrive pair (fixed 40 Hz); B/D = Depth pair (ColorFrequency) |
| 0x170/0x174/0x178/0x17c | BaseDrive dB / ColorFrequency Hz / WidthFactor / ColorDepth dB | SET | defaults 0/1000/0.3/0 [B] |
| 0x180/0x184 | DC-block R1 0.995, R2 0.997 (44.1k ref) | CO | working 0x188/0x18c = R^(44100/sr) |
| 0x1b0 | active shaper-table struct {+8 data, +0x18 size, +0x1c max, +0x20 min, +0x24 scale} | SET OnType/OnShaperTable | lookup: `pos = (v − min)·scale`, clamp [0,size], linear interp |
| 0x1b8…0x478 | six 4x-oversampler state groups | SET OnOn/Oversampling (reset) | internals open |
| 0x488 | incoming user table object | SET OnShaperTable | |
| 0x498 / 0x49c | crossfade counter / fraction 1/4099 | SET tail | DynamicCrossfade only |
| 0x4a0… | DC-blocker #2 group (R 0.999; coeffs 0x4a8/0x4ac, states 0x4b0–0x4cc) | CO, CALC | unconditional in Dynamic bodies |
| 0x4d0 | post-clip table = factory(5) (Analog Clip curve) | CO | gated by PostClip |
| 0x4f8 / 0x4fc | dry gain 1−w / wet gain w·postGain | SET DryWet/PostDrive | |
| 0x500 / 0x508 | input ptrs L/R | shell | `**` per sample |
| 0x510 / 0x514 | output L/R | CALC | |
| 0x518 / 0x51c | saturation meter L/R | CALC | \|driven_in − wet\| [D in NoColorNoPostClip; tap identity minor-H in Color bodies] |
| 0x520 | calc-callback slot (registry) | SET tail | |

Table processor (`OSaturatorTableProcessor`):

| slot | role | writer | value |
|---|---|---|---|
| 0x38/0x40/0x48 | three table objects | CO + SET tails | domain [−10,+10], scale=size/20 |
| 0x68/0x6c/0x70/0x74 | Drive/Lin/Curve/Damp | SET raw | |
| 0x78/0x7c | Period² / Depth² | SET v·v | |
| 0x80 | table write index | CALC | ++ per entry |
| 0x84/0x88 | domain min −10 / max +10 | CO | |
| 0x8c / 0x90 | phase x / phase increment | CO(0) / open | `0x8c += 0x90` per entry |
| 0x18/0x19/0x1a | scheduling flags | SET | dirty → CalcTableMain scheduled (msg 0x1003) |

## 3. The mechanism, plainly

**Chain (stock types, per sample)** [D, from CalcMain bodies]:

```
driven = in · driveGain                      // driveGain de-zippered (0x60/0x68)
if ColorOn:   driven  = Biquad_A(driven)  →  Biquad_B(…)     // BaseDrive pair… see below
if PreDc:     x1 = (driven − x1) + R·y1 ; y1 = x1   (×2 stages, R 0.995/0.997)
wet = SHAPER[driven]                          // table 0x1b0, linear interp
if ColorOn:   wet = Biquad_C1(wet) → Biquad_C2(wet)
if PostClip:  wet = CLIP[wet]                 // table 0x4d0 = Analog Clip curve
out = in·(1−w) + wet·w·postGain               // dry path is the RAW input
```

(Exact pairing: A 0x80 + C1 0xf8 are the **BaseDrive pair**, B 0xbc + D 0x134
the **Depth pair**; pre = A+B, post = C1+D. The ColorPostClip body runs
A→B→shaper→C1→D→clip.)

**Shelf/biquad law (both pairs, one form)** [D; transfer-sign reading [H]]:
with ω, s, d per pair, `n = 1/(s/d + 1)`:

```
b0 = (d·s + 1)·n      b1 = −2·cos(ω)·n     b2 = (1 − d·s)·n
a1 = −2·cos(ω)·n      a2 = (1 − s/d)·n
y = b0·x + b1·x1 + b2·x2 − a1·y1 − a2·y2
```

- BaseDrive pair (A/C): ω = 0xa8·251.32742 = **2π·40/sr — fixed 40 Hz**;
  s = sin(ω)/0.2; d = 10^(BaseDrive_dB/40) (pre) / 10^(−BaseDrive_dB/40)
  (post) — a complementary tilt around 40 Hz.
- Depth pair (B/D): ω = ColorFrequency·2π·(1/sr), clamped ≤ 3.1101768 rad;
  s = sin(ω)/(2·WidthFactor), WidthFactor = 2 − 1.7·ColorWidth;
  d = 10^(±ColorDepth_dB/40).
- Operand note: the decompiler shows the b1/a1 `cos(ω)` lane substituted by
  an adjacent load (sincosf_stret second return); the symmetric shelf form
  and sr-independence identify it as cos(ω) [D-shape, H-operand].

**Type tables.** `OnType` maps the enum through a runtime registry
(`*(0x1058f3358)[i]`): UI 0→factory(5), 1→factory(1), 2→factory(2),
3→factory(3), 4→factory(4), 5→factory(0), 6→user table [D]. The stock
curve LUT contents are runtime-initialized __DATA and are **not statically
decodable** [B-negative] — golden-render material, as is the dB→linear LUT.

**Type-6 curve law (CalcTableMain)** [D], per entry at abscissa x = 0x8c
(advancing by 0x90; domain [−10,+10]):

```
y(x) = Drive · (1 / (1 + 64·Damp/(1 + 10⁴·x⁴)))
       · ( sin(2π·Curve·x²) + Lin·x + 0.5·Depth²·sin(π·x·(60·Period² + 1)) )
       + (1 − Drive)·x
```

(The `6.2831` and `3.1415927` literals are as compiled.) Depth²/Period² are
the squared stores of WsDepth/WsPeriod. The whole Ws* surface
(WsDrive/WsLin/WsCurve/WsDamp/WsPeriod/WsDepth) is compiled into 12.0.25's
parameter definitions and Type 6 ("Waveshaper") exists in the dispatch, but
no factory preset persists Ws* values — the user-curve editor is plumbed but
not yet exposed in this build [B-negative across all 20 presets].

**Post-clip.** Not a formula — a second pass through the Analog Clip curve
table (factory(5)) installed at construction, gated by PostClip [D].

**Oversampling.** One extra dispatch bit (0x58) selecting `4x` calc variants
plus six filter/state groups reset on On/Oversampling changes; the resampler
design is not captured (helper bodies open) [H: polyphase IIR per group
count].

## 4. What remains open (honest residuals)

- **Runtime tables**: stock-curve registry + all six factory tables, the
  20-entry calc dispatch tables (0x1059b5640–0x…56d0), and the dB→linear
  LUT (0x1059a89c0) — all runtime-initialized __DATA, not statically
  decodable [B-negative]; a behavioral render (known curve → measured
  gain) pins each directly.
- **Table processor scheduling**: who advances 0x90 (phase increment) and
  the table size; the 0x1003 message machinery behind the dirty flags;
  the third table object's role (0x38 vs 0x40 vs 0x48).
- **Dynamic-family trailing DC blocker** (0x4a0 group, R 0.999) runs
  unconditionally in CalcMainDynamic/Crossfade but is absent from the
  static bodies — dispatch-vs-collection mismatch unresolved [H].
- **b1/a1 cos operand** (sincos second-lane substitution) — [H] as noted.
- **Meter taps in the Color bodies** (Ghidra register reuse obscures which
  two stage signals feed 0x518/0x51c) [H-minor]; exact in the plain body.
- **Oversampler internals** (the six groups' filter design), and whether
  Oversampling has enum values beyond 0/1 (dispatch has exactly 2 slots).
- **Ws* defaults** (ctor of the table processor does not write 0x68–0x7c;
  defaults would arrive via unpushed parameter definitions).
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Processor split, callback inventory (20), setter laws, ctor/Init/Reset/
  NewRate, the per-sample chain, the shelf-pair laws, CalcTableMain's
  closed form, the Type enum names (nm + __cstring pointer array), the
  parameter surface/ranges (factory presets): **high** — single-source
  decompiles cross-checked against the symbol table, string tables, const
  pool and preset XML, which agree everywhere they overlap (param names
  ColorWidth/PostClip adjacent to the enum strings; 251.32742 = 2π·40;
  1/sr identification via the color-object init).
- Transfer-function sign conventions, Dynamic-variant DC blocker, table
  scheduling, meter taps: **low/medium** — graded inline, do not build on
  them alone.
- No behavioral claim of any grade is made; the golden-render corpus for
  Saturator does not exist yet (COVERAGE row).
