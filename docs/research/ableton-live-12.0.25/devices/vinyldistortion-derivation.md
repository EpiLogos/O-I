# Vinyl Distortion (OVinylProcessor) binary derivation (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only headless probes —
SearchProbe/SymProbe/BlockProbe/DataProbe — no re-import). NOT FOR
REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/vinyldistortion-decompiles.txt` (symbol
map, create chain, ctor, Init/Reset/NewRate, both shared recompute tails, all
six MainCalc bodies, all seventeen setters, const-pool decodes). Form follows
`compressor-derivation.md`; claims graded: **[D] decompiled-confirmed**
(capture cited), **[B] byte-decoded** (raw file/const pool), **[H]
unverified hypothesis** — no behavioral renders ran in this lane; per README
every [D]/[B] claim still awaits the golden-render cross-check before it
gates a rebuild.

The stock Vinyl Distortion is `OVinylProcessor` — a per-sample processor with
six `MainCalc*` callbacks selected by a 3-bit switch (band1 on, band2 on,
soft/hard). The signal path is mid/side: the **sum** carries a modulated
delay line (the tracing model) and the distortion **drive** is an always-positive
injection of the band-filtered magnitude (soft: |x|, hard: x²) onto one audio
sample slot; the **difference** runs through a fixed 3 ms delay. Crackle is a
two-layer random-impulse resonator bank added per channel.

## 1. What runs when (call topology)

- **Create** `OProcessorCreateManager::SOnProcessorCreate<OVinylProcessor>`
  0x1018c5230 → wrapper 0x1018c526c (shell alloc 0x28 bytes; DSP object at
  shell+0x18; param block `iStack_34 + 0x298`) → **ctor** 0x1019b5440 [D]:
  seven biquad blocks built with FLT_MAX coefficients and zero state, each
  ending in a `1/sr` slot (0xd8, 0x104, 0x130, 0x15c, 0x188, 0x1b4, 0x1e0);
  4 ms-capacity stereo ring at +0x48 (write +0x50, wrap +0x58, cap int +0x78;
  resize `func_0x0001016d3b30`), 7 ms mono ring at +0x80 (write +0x90, cap
  int +0xa8; resize `FUN_1016d3a14(int(sr_kHz·7))`); `0x208 = sr/1000`
  (kHz); `0x234 = int(sr_kHz·4)`; tracing depth `0x1e8 = 0`, its per-event
  step base `0x1f0 = 512.0/(sr/100)`; band defaults from the const pool
  `0x104cf3330/38` = freqs 20.0/20.0 Hz, Qs 1.0/1.0 [B]; drive 0x248 = 0,
  band bools 0x254/0x258 = 0, soft/hard 0x25c = 0, NormalMono slot 0x260 =
  {0.5f, 0.0f} [B], crackle density 0x268 = 0, volume 0x26c = 0; enables
  0x270/0x271 = 0; null callback at 0x278.
- **Init** trampoline 0x1019bff78 [D]: recompute tails `0x1019b56fc` +
  `0x1019b58d4` (below), `0x220 = 0x208·3.0` (3 ms), `0x218 = &0x210`
  (drive lands on the diff slot by default), `0x230 = 1.0`,
  `0x228 ← const {1.0, 0.0}` [B], `0x200 = 0x248` pair, then the calc
  dispatch (§2).
- **NewRate(int,int)** 0x1019c0084 [D]: second int = sr Hz (compressor
  convention). `0x208 = sr·0.001`; `0x234 = int(sr_kHz·4)`; both rings
  resized (4 ms / 7 ms); tracing base `0x220 = 0x1016d3adc(...)`; tracing
  depth ratio preserved across rate changes (`0x1e8 ← 0x1e8/0x1f0·new`);
  `0x1f0 = 512.0/(sr/100)` (the 512-sample dirt-table period, in seconds);
  seven `1/sr` slots; all ring/biquad state zeroed; band biquad recomputes
  (RBJ bandwidth form, §3); crackle resonator recomputes; dispatch re-run.
- **Reset** trampoline 0x1019bffd8 [D]: ring resets (`0x1016d3bd4`/+0x48,
  `FUN_1016d3ab0`/+0x80), zero sweep 0xc8–0x1d8, then the Init tail, then
  meter mirrors `0x40/0x44 ← **(0x30), **(0x38)`.
- **Per-sample callbacks** (one frame per call, registered as
  `SProcessorFunc` trampolines at 0x1019c0860–0x1019c0888): the six
  `MainCalc*` bodies, all captured [D].
- **OnEventIn** 0x1019c0088 [D]: a periodic event (scheduler-driven; caller
  not captured) advances the dirt phase `0x1e8 += 0x1ec` (wrap
  `(x − int) + (int & 0x1ff)`) and reads the 512-entry amplitude table at
  `*(0x1f8)` (global 0x1059a8a00 — runtime-initialized, not file-backed
  [B-negative]) with linear interpolation; the layer-1 impulse amplitude
  becomes `table·0.01 + 0.04` stored to `0x228`.

## 2. The calc dispatch

`switch(*(int*)0x258·2 + *(int*)0x254·4 + *(int*)0x25c)` — band2-on is the
2s bit, band1-on the 4s bit, soft/hard the 1s bit [D]:

| case | meaning | body |
|---|---|---|
| 0, 1 | no bands | MainCalcCrackleOnly (0/1 = soft/hard unused) |
| 2, 3 | band 2 only | MainCalcSecond |
| 4 / 5 | band 1 only | MainCalcFirstSoft / FirstHard |
| 6 / 7 | both bands | MainCalcBothSoft / BothHard |

Calc is registered only when `On(0x270) ≠ 0` AND (`0x271 ≠ 0` OR crackle
volume > 0); otherwise the slot gets the no-calc function [D]. 0x271 is a
second enable written by `OnX` [D]; its UI identity (device On vs a section
enable) is **[H]**. Every band/soft-hard/crackle-volume setter re-runs this
dispatch and (when starting from idle) resets both rings and all biquad
state [D].

## 3. The mechanism, plainly

**Tracing model (the band-2 path).** Per sample: sum `s = L+R` and diff
`d = L−R` are written to the stereo ring (+0x48). The diff is read back
through a **fixed 3 ms** fractional delay (`0x224 = 0x208·3.0`, two-tap
linear interp) into `0x210`. The sum runs through the second ring (+0x80,
7 ms) read at the **modulated** delay `0x220`:

```
delay_ms = clamp(band2_biquad_out · 0x204 + 3.0, 0.01, 6.0)     [Soft bodies]
delay_ms = clamp(band2_biquad_out · 0x204 + 3.0, 0.01, 7.0→6.9) [BothHard]
0x220 = sr_kHz · delay_ms
```

`0x204 = Gain2 · Drive` (setter law, below); so a loud low-band output
wobbles the sum's delay by up to ±3 ms around 3 ms — pitch/tracing wobble
driven by the band-2 filtered waveform itself. Before the band-2 biquad the
wobbled sum passes a **fixed 50 Hz lowpass** (`0x108` block: w =
`1/sr · 314.15927` = 2π·50, Butterworth Q = 1/√2, recompute tail
`0x1019b56fc`) [D]. Output: `L = (wob + 0x210)·0.5, R = (wob − 0x210)·0.5`
[D].

**Pinching EQ + drive (the band-1 path).** Band 1 is a bandpass biquad
(`0xb0` block, RBJ bandwidth form: `alpha = sinh(ln2/2 · Q · w0/sin w0)` with
w0 clamped < 2.984513 rad; freq 0x238, Q 0x240, defaults 20 Hz/1.0 [B])
running on the *delayed sum*. Its output times the drive amount `0x200 =
Gain1 · 4.0 · Drive` (setter law; the 1e-12 floor makes zero exactly zero)
is injected into the audio slot selected by `0x218` — the diff read `0x210`
by default, or the wobbled mono `0x20c` when `OnNormalMono ≠ 0` [D]:

```
Soft bodies:  *0x218 += |band1_out · 0x200|
Hard bodies:  *0x218 += (band1_out · 0x200)²
```

— an always-positive (asymmetric, DC-leaking) addition; that is the whole
distortion law. No tanh, no clipper. The injection slot doubles as the
audio sample, so successive drives accumulate into the signal itself [D].

**Crackle (two layers, both bands off included).** `FUN_100d0b76c()` draws
U(0,1) per channel per sample.

- Layer 1 — per-channel resonators (`0x134` L / `0x160` R blocks) at the
  **CrackleDensityFreq** frequency (0x264, alpha constant 0.14902665, w0
  clamp 3.1101768 rad). Impulse of amplitude `0x228` (the periodic dirt
  value, §1) enters when `rand > 0x22c`; output × CrackleVolume (0x26c)
  added to that channel.
- Layer 2 — per-channel resonators (`0x18c` L / `0x1b8` R blocks) at a
  **fixed 650 Hz** (`1/sr · 4084.0706` = 2π·650, alpha 0.1732868 = ln2/4).
  Impulse 1.0 enters when `rand > 0x230`; output × CrackleVolume × **5.0**
  added.

Density thresholds (recompute tail `0x1019b58d4`) [D + B]:

```
0x22c = 1.0 + DensityRand / (−1000.0)      // layer 1: p = DensityRand/1000 per sample
0x230 = 1.0 + DensityRand / (−100000.0)    // layer 2: p = DensityRand/100000
```

(consts at 0x104cf3160 [B]; note layer 1 fires 100× more often and is
 quieter; layer 2 is the sparse loud tick.)

**Setter laws.** BandFreq/BandQ rewrite their biquad immediately [D].
Gain1 → `0x200 = v·4.0·Drive`, Gain2 → `0x204 = Drive·v`, Drive rewrites
both; all three floor at 1e-12 → 0.0 [D]. OnNormalMono re-points `0x218`
(0x210 ↔ 0x20c) [D]. OnCrackleDensityFreq recomputes both layer-1
resonators; OnCrackleDensityRand rewrites both thresholds; OnOn/OnX/
OnCrackleVolume update the enables and re-register the calc [D].

## 4. The state-slot ledger (abridged; full reader→writer evidence in capture)

| slot | role | writer |
|---|---|---|
| 0x30/0x38, 0x40/0x44 | in L/R ptrs; meter mirrors | shell / CALC |
| 0x48–0x78 | stereo ring (sum,diff), 4 ms | NewRate, CALC |
| 0x80–0xa8 | mono ring (sum), 7 ms | NewRate, CALC |
| 0xac–0xf4 | band biquads 1L/2L coeffs+state | SET Freq/Q, tails |
| 0x108–0x12c | fixed 50 Hz LP | 0x1019b56fc |
| 0x130–0x188 | crackle layer-1 resonators L/R | SET CrackleDensityFreq |
| 0x18c–0x1dc | crackle layer-2 resonators L/R (650 Hz) | 0x1019b56fc |
| 0x1e0–0x1f8 | 1/sr, crackle phase/step/table ptr | NewRate, OnEventIn |
| 0x200 / 0x204 | drive amounts: G1·4·D / G2·D | SET Gain1/2/Drive |
| 0x208 / 0x220 / 0x224 | sr kHz / modulated delay / fixed 3 ms | NewRate, CALC |
| 0x210 / 0x20c | delayed diff / wobbled mono (drive target) | CALC |
| 0x218 | pointer: drive injection slot | OnNormalMono, Init |
| 0x22c / 0x230 | crackle thresholds L1 / L2 | OnCrackleDensityRand |
| 0x228 | layer-1 impulse amplitude | OnEventIn |
| 0x234 | int(sr_kHz·4) ring size | NewRate |
| 0x238/0x23c, 0x240/0x244 | band freqs / Qs (20 Hz, 1.0 defaults) | SET, ctor |
| 0x248/0x24c/0x250 | Gain1 / Gain2 / Drive | SET |
| 0x254 / 0x258 / 0x25c | band1on / band2on / soft-hard | SET |
| 0x260 | NormalMono flag (ctor 0.5f slot) | SET |
| 0x264 / 0x268 / 0x26c | CrackleDensityFreq / DensityRand / Volume | SET |
| 0x270 / 0x271 | On / X enables | OnOn / OnX |

## 5. What remains open (honest residuals)

- **The dirt table** (512 floats at global 0x1059a8a00, runtime-built) —
  amplitude shape of layer-1 crackle over its cycle; behavioral-gate
  material [B-negative].
- **0x1ec writer** (the dirt phase step per OnEventIn — likely
  `0x1f0 · rate`) and the OnEventIn scheduling period [H].
- **UI mapping of 0x270 vs 0x271** (two enables; which is the device On)
  and the NormalMono ctor value 0.5f sitting in a flag slot.
- **Param-layer scalings** (Hz/Q/drive units, menu encodings for
  Soft/Hard) are shell-side, not captured; the strings "Vinyl Dirt Soft" /
  "Vinyl Dirt Constant" (0x10498c7f7/0x10498c807) suggest crackle-type
  naming in the UI layer, mapping unverified [H].
- **Layer-2 fixed 650 Hz** and **50 Hz pinch LP** are hard constants — no
  parameter reaches them in the captured set [D].
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 6. Confidence

- Architecture (mid/side + tracing delay + rectified drive injection +
  two-layer crackle), all coefficient laws, the dispatch, and the setter
  laws: **high** as decompile readings — single-source (BlockProbe from the
  analyzed LiveRE2 project), const-pool values double-read from the raw
  file.
- The "tracing = band-2 delay wobble / pinch = band-1 rectified injection"
  naming against the UI's Pinch/Tracing sections: **medium** — the wiring is
  [D] but the UI-word mapping is inferred from Live's manual vocabulary,
  not from captured UI code.
- Dirt table contents, OnEventIn rate law, UI param scalings: **low** — do
  not build on them.
