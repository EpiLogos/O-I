# EQ Three (OFilterEQ3Processor) binary derivation — per-sample layer (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SearchProbe/CallTargetsProbe/BlockProbe/XrefProbe/DataProbe, no re-import).
NOT FOR REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/eq3-decompiles.txt` (nm trampoline table,
raw-asm trampoline decode, ctor + const-pool decode, all setters, the
crossover recompute + biquad formula family, both per-sample calcs, the
shared per-band setter bodies, smoother helpers). Form follows
`compressor-derivation.md`; claims graded: **[D] decompiled-confirmed**,
**[B] byte-decoded**, **[H] unverified hypothesis** — no behavioral renders
ran in this lane; per README every [D]/[B] claim still awaits the
golden-render cross-check before it gates a rebuild.

EQ Three is the old-style processor `OFilterEQ3Processor` (create
`SOnProcessorCreate<OFilterEQ3Processor>` 0x1018bdb34 → wrapper 0x1018bdb70
[D]) — one flat state block, no device-kit indirection. Three bands
(L/M/H) from a 3-way Butterworth crossover; per-band on/off and gain ride
linear-ramp smoothers; the whole audio path is hand-written DF1 biquads in
the two per-sample calcs.

## 1. What runs when (call topology)

- **Ctor** `FUN_101678cec` (via thunk 0x101678de0) [D]: allocates the
  processor; initializes the two crossover banks
  `func_0x00010167bf08(bank, shell)` — low bank at **+0x58**, high bank at
  **+0x24c**, each 0x1e0 bytes = {LP side: 4 section slots, HP side: 4 slots}
  (slot = 0x3c bytes) — and nine 0x18-byte **linear-ramp smoothers** at
  **+0x440…+0x518** (`FUN_1015b6380`: zero). Factory state [B, const pool
  0x104cc8b78]: **FreqLo = 200.0 Hz (0x530), FreqHi = 2400.0 Hz (0x534)**,
  Slope = 0 (0x538), FlatResponse = 1 (0x53c), On = 0 (0x53d), X = 0 (0x53e),
  last-event stamp 0x520 = −1.
- **NewRate(sr)** 0x10167bb94 [D]: stores sr at 0x240/0x434, rebuilds both
  banks for both channels (L at bank+0x0, R at bank+0xf0) via the builder
  below.
- **Reset** 0x10167babc [D]: zeroes all biquad state pairs from +0x58 through
  +0x2c0 (the x1/x2/y1/y2 quads behind every section).
- **Setters** (trampoline = `__invoke`, all bodies captured):
  - `OnFreqLo` 0x10167bd28 / `OnFreqHi` 0x10167bd70 [D]: store the float
    (0x530/0x534), then rebuild the Lo bank AND the Hi bank (both channels).
  - `OnSlope` 0x10167bdbc [D]: stores slope int (0x538; UI 24 dB/oct = 0,
    48 dB/oct = 1), rebuilds both banks, then **swaps the audio callback**:
    slope 1 → calc `FUN_10167ca6c`, slope 0 → calc `FUN_10167d2fc`; if the
    device is off (On/X false) the callback becomes NULL and the processor
    registers `OProcessor::SNoCalcAudioFunc` — the device-bypass path.
  - `OnFlatResponse` 0x10167bdc0 [D]: stores the bool (0x53c, default 1),
    rebuilds both banks (the flag selects the coefficient-formula variants,
    §3).
  - `OnOn` 0x10167be10 / `OnX` 0x10167be8c [D]: store 0x53d/0x53e and run the
    same callback swap — **audio is computed only when On AND X are both
    set**.
  - Per-band `OnGainLo/Mid/Hi` (0x10167bbf0/0x10167bc24/0x10167bc58) and
    `OnOnLo/Mid/Hi` (0x10167bc8c/0x10167bcc0/0x10167bcf4) [D]: all six take
    a `{value, rampLen}` event; the raw-asm decode shows every trampoline
    loads the smoother-array base `this+0x440` and tail-calls a per-band
    wrapper: gain → ramps **sm0** (0x440, Lo) / **sm1** (0x458, Mid) /
    **sm5** via the Hi path (0x1016793bc sets +0x78; the OnGainHi tail
    address was not individually resolved — [H] sm2, 0x470), on → ramps
    **sm3** (0x488) / **sm4** (0x4a0) / **sm5** (0x4b8). If the beat-time
    jumped since the last event (stamp at 0x520 vs scheduler+0x90), all six
    smoothers are fast-forwarded first (`FUN_1015b64e8`). Each wrapper then
    tail-calls the **shared product update** `FUN_10167d94c`, which computes
    `n = max(remaining)` over all six smoothers, advances them, and re-ramps
    **sm6 (0x4d0) = adv(sm0)·adv(sm3)** — the LOW-band product ramp — only
    (see §4 for the sm7/sm8 residual).
- **Per-sample**: exactly two calc functions, selected by slope
  (`FUN_10167d2fc` = 24 dB/oct, 181 decompiled lines; `FUN_10167ca6c` =
  48 dB/oct, 326 lines) [D]. Inputs `*(this+0x40)`/`*(this+0x48)`, outputs
  this+0x50/0x54.

## 2. The state-slot ledger (processor offsets)

| slot | role | writer | value / law |
|---|---|---|---|
| 0x58 … 0x238 | low-xover bank: LP sections 0x58/0x94 (4 slots · 0x3c), HP sections 0x148/0x184 | FUN_101679814 | L at +0x0, R at +0xf0 |
| 0x24c … 0x42c | high-xover bank: LP sections 0x24c/0x288, HP sections 0x33c/0x378 | FUN_101679814 | same layout |
| +0x14 per section | b0/b1/b2/a1/a2 (+0x58/0x5c/0x60/0x68/0x6c for section 0) | FUN_10167c770 | DF1 coefficients; states follow each block (x1 0x70, x2 0x74, y1 0x78, y2 0x7c for section 0) |
| 0x238/0x23c/0x240/0x244/0x248 | low-bank mirror {slope, freq, sr, flat, recompute} | setters, NewRate | |
| 0x42c/0x430/0x434/0x438/0x43c | high-bank mirror | setters, NewRate | |
| 0x440/0x458/0x470 | band gain ramps sm0/sm1/sm2 {cur,slope,remaining} | OnGainLo/Mid/Hi | linear ramp to event value |
| 0x488/0x4a0/0x4b8 | band on-ramps sm3/sm4/sm5 | OnOnLo/Mid/Hi | linear ramp |
| 0x4d0/0x4e8/0x500 | product ramps sm6/sm7/sm8 | FUN_10167d94c (sm6 only — §4) | sm6 = sm0·sm3 |
| 0x520/0x528/0x52c | last-event beat stamp / x-flag / recompute-flag | setters | |
| 0x530/0x534 | FreqLo / FreqHi (Hz) | OnFreqLo/Hi | defaults 200/2400 [B] |
| 0x538 | Slope int (0 = 24 dB/oct, 1 = 48) | OnSlope | |
| 0x53c | FlatResponse bool (default 1) | OnFlatResponse | formula variant select |
| 0x53d/0x53e | On / X bools | OnOn / OnX | gate the calc |
| 0x30 | band-meter float array ptr | calc | meter[i] = 1.0 when band energy² > 0.001 |

## 3. The mechanism, plainly

**Crossover laws (FreqLow/FreqHigh).** One recompute `FUN_101679814(freq,
bank, slope, ?, flat)` per bank [D]: the builder `FUN_10167c0bc(sr, freq,
ws, side, channel, count)` runs twice per bank — side 1 = the LP-side
sections, side 2 = the HP-side sections; channel 1/2 = L/R. Section counts
[D]: slope 0 → **2 stored sections** per side (4th-order), slope 1 → **4**
(8th-order); the `flat` flag selects the builder count (2/4 vs 4/8) and the
coefficient variants. HP side: Butterworth pole ladder
`θk = (2k+1+3N)·π/(2N)`, section `Q = sinθk/(1+cosθk) = tan(θk/2)` (complex-
divide helper `FUN_10167c310`), with the odd-order tail section forced to
**Q = 0.5** (first-order) [D]. LP side: precomputed Q/f table at
**0x105289c40[count−1]** [B]. Coefficients come from the 9-formula family
`FUN_10167c770(Q, gain_dB, ws, formula, idx)` [D]: `T = tan(π·min(f/sr,
0.499))`, `G = 10^(dB/20)`; e.g. formula 2 = 2nd-order HP
(`D = 1 + T/Q + T²`; b = G·{T², 2T², T²}/D; a = {2(T²−1), T²−T/Q+1}/D) and
formula 4 = 2nd-order LP (b = G·{1, −2, 1}/D); formulas 7/8 are the
Q-multiplied-convention LP/HP variants selected by FlatResponse.

**Per-sample (24 dB/oct calc `FUN_10167d2fc`)** [D]: for each channel,
`y = b0·x + b1·x1 + b2·x2 − a1·y1 − a2·y2` (DF1, transposed-update states)
through:

```
LOW  = LP(Lo)^2    : x  → sec@0x58 → sec@0x94
MID  = HP(Lo)^2 → LP(Hi)^2
       : x → 0x148 → 0x184 → 0x24c → 0x288
HIGH = HP(Lo)^2 → HP(Hi)^2
       : x → 0x148 → 0x184 → 0x33c → 0x378
```

(the 48 dB/oct calc `FUN_10167ca6c` runs 4 sections per leg, same plan).
Each band's per-channel energy is squared and summed; `(L+R)² > 0.001`
lights the band-meter cell (`**(this+0x30)+i·0x10 = 1.0`) — the UI band
activity LEDs. Output mix:

```
sm6 += sm6.slope; sm7 += sm7.slope; sm8 += sm8.slope   (per sample)
out = LOW·sm6 + MID·sm7 + HIGH·sm8
```

**Per-band on/off behavior** [D]: On/OnX gate the CALC (off →
`SNoCalcAudioFunc`, i.e. the whole device stops computing — bypass, not
mute-mid-filter [H on the passthrough detail]); per-band On events ramp
sm3/sm4/sm5 while per-band Gain events ramp sm0/sm1/(sm2 [H]) — the band
contribution is the product of the two ramps, mixed by the calc.

## 4. What remains open (honest residuals)

- **The MID/HIGH product smoothers have no writer in the captured set.**
  All six per-band setters (gain and on) tail-call ONE shared product update
  (`FUN_10167d94c`, verified at asm level for the Mid body:
  `mov x0, x19; b 0x10167d94c`), and that function recomputes only
  **sm6 = adv(sm0)·adv(sm3)** (literals +0x0/+0x48/+0x90). The calc applies
  sm7/sm8 to MID/HIGH, and the ctor zeroes all nine smoothers. Taken
  literally, MID/HIGH would be silent — which is false of the device — so a
  writer for sm7/sm8 (0x4e8/0x4f0/0x500/0x508) must exist outside the
  captured set [H: a second event-dispatch path, or folded sibling bodies
  reached with a different base]. A single behavioral render (wiggle GainMid,
  observe output) settles this instantly. Everything else about the band
  mix law is [D].
- OnGainHi's exact ramp target (sm2 vs sm5) — its wrapper tail address was
  not individually resolved [H].
- The `flat` flag's design meaning (which of formula pairs 1/2 vs 3/4 and
  LP tables 7 vs 8 is "the" 24/48 dB response) — formula-level [D],
  UI-semantic [H].
- Exact Butterworth pole/Q pairs per slope (the θ-ladder is captured; the
  resulting Q values per section are not tabulated here), and the LP-side
  table contents at 0x105289c40.
- Per README: no golden-render corpus exists for EQ Three (COVERAGE row
  empty); every claim above awaits the behavioral gate.

## 5. Confidence

- Class/trampoline inventory, ctor + defaults, NewRate/Reset, crossover
  section-count law, the DF1 biquad formula family, both calc topologies,
  the band-meter law, the smoother helpers: **high** as decompile readings —
  single-source (LiveRE2 captures), with the trampoline base-loading sequence
  independently confirmed by objdump raw asm.
- Band on/off + gain ramp wiring: **medium-high** for the ramp targets
  (asm-read), **low** for the sm6/sm7/sm8 completion story — the residual
  above is graded [H]; do not build a rebuild on the current output-mix
  gain path.
- No behavioral claim of any grade is made; the golden-render corpus for
  EQ Three does not exist yet.
