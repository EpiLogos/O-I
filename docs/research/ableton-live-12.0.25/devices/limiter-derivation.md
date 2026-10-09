# Limiter (OLimiterProcessorBase / OLimiterBufferProcessor / OLimiterSampleProcessor) binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
nm/CallTargetsProbe/BlockProbe headless runs, `-process Live.arm64
-noanalysis`, no re-import), plus `objdump` const-pool decodes and the
factory preset XML (`Core Library/Devices/Audio Effects/Limiter/
Lookahead.adv`). NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/limiter-decompiles.txt` (create/ctors, all setters, the
four per-sample calc bodies, BufferProcessor CalcMain head/tail, ring
helper, const-pool decodes). Form follows `compressor-derivation.md`;
claims graded: **[D] decompiled-confirmed** (capture cited), **[B]
byte-decoded** (nm/const pool/preset XML), **[H] unverified hypothesis** —
no behavioral renders ran in this lane; per README every [D]/[B] claim
still awaits the golden-render cross-check before it gates a rebuild.

The stock Limiter is TWO processors over one shared base
(`OLimiterProcessorBase`): `OLimiterSampleProcessor` (four registered
per-sample callbacks: CalcLinked / CalcSeperate / CalcLinkedAuto /
CalcSeperateAuto — LinkChannels × AutoRelease) and
`OLimiterBufferProcessor` (one block callback `CalcMain(int)`, 2,443
decompile lines — the same law vectorized over the block with NEON max
pyramids). Architecture: **feedforward peak limiter with a look-ahead
max-pyramid ring, instantaneous attack, one-pole release, double
moving-average gain smoothing over the look-ahead window, and a final
hard clamp at ±ceiling** — no threshold parameter at all: the CEILING is
the threshold (gain = ceiling / window-peak, unity below it).

## 1. What runs when (call topology)

- **Create** `SOnProcessorCreate<OLimiterBufferProcessor>` 0x1018bfaa8 →
  wrapper 0x1018bfae4 (param block at shell+0x31a0) → ctor thunk
  0x1016b2fc0 → `func_0x0001016b2e0c`; `SOnProcessorCreate<
  OLimiterSampleProcessor>` 0x1018bfb80 → wrapper 0x1018bfbbc
  (shell+0x3190) → ctor thunk 0x1016b1af4 → `func_0x0001016b19e0` [D].
  Shared ctor work [D]: sr Hz → 0x3164 (float) and 0x6c; sr_ms = sr·0.001;
  release coeff 0xc = `expf(−1/(sr_ms·*(float*)0x64))` — **computed from
  the not-yet-initialized Release slot** (0.0 at ctor time → coeff 0 =
  instant release until OnRelease/NewRate) [D]; fixed coeffs 0xe =
  `expf(−1/(sr_ms·5))` (5 ms) and 0x74 = `expf(−1/(sr_ms·250))`
  (250 ms) — the auto-release pair [D]; base object gets vtable
  0x10528a808 and `func_0x0001016afffc(sr, base+0x30)` (ring setup);
  derived vtables 0x10528a898 (buffer) / 0x10528a850 (sample) [B].
  Defaults arrive through the shell param block (setters below).
- **Setters** (trampolines; ProcessorBase) [D]: OnGain and OnCeiling are
  **virtual dispatch jumps** (`(**(code**)(*this + 0x20/+0x28))()` — the
  decompiler lost the jumptable; the derived implementations were not
  individually captured [D-thunk, body open]). OnAutoRelease → bool 0x2f +
  virtual +0x30 call. OnOn → bool 0x2c + virtual +0x30. OnX (sample
  processor only) → bool 0x2d + virtual. **OnRelease** [D]: stores ms at
  0x64; release coeff **0x60** = `expf(−1/(sr·0.001·Release_ms))` (e-fold
  law — Compressor-style, not MBD's −ln 100). **OnLookahead** [D]: enum
  0/1/2 → base samples from the const-pool LUT **{64, 128, 256}** [B:
  0x104ccaa24], ×1 (sr ≤ 80 kHz) / ×2 (>80k) / ×4 (>160k), capped at
  **512**; ring resized via `func_0x0001016b0c6c(this+0x30, n)`; latency
  `n·1000/sr` ms reported to the host through the device-kit latency
  object (the tail's machinery mirrors the Compressor's meter/notify
  tail) [D-shape]. **OnLinkChannels** [D]: bool 0x2e; on unlink (linked →
  separate) copies the L detector/gain state into the R slots (the big
  0x80…0x1080 pair-copy loop, plus gain-table indices 0x24b4→0x28d4 and
  0x2cf4→0x3114 families) so the two channels start from identical state.
- **NewRate(int,int)** [D]: second int = sr Hz → 0x3164 and 0x6c; sr_ms →
  coeffs 0xc (Release), 0xe (5 ms), 0x74 (250 ms) as in the ctor; the
  lookahead size re-derived exactly as in OnLookahead; latency re-report.
- **Reset** (both processors) = virtual +0x18 call (body open) [D-thunk].
- **Per-sample callbacks** (sample processor) [D, full captures]:
  - `CalcLinked` (§3 law), `CalcSeperate` (same law per channel with
    duplicated detector rings/pyramids/moving-averages: L at 0x24a8/
    0x20a0 + 0x2ce8/0x28e0, R at 0x28c8/0x2490 + 0x3108/0x2cd0) [D],
  - `CalcLinkedAuto` / `CalcSeperateAuto`: identical except the release
    clamp uses the interpolated auto coefficient (§3).

## 2. The state-slot ledger (every reader → its writer)

Writers: SET = parameter setter, CO = ctor, INIT = NewRate, CALC =
callback. Offsets are ProcessorBase unless noted; the sample processor
reads its own copies where listed.

| slot | role | writer | value / law |
|---|---|---|---|
| 0x2c / 0x2d / 0x2e / 0x2f | On / X / LinkChannels / AutoRelease bools | SET | dispatch flags |
| 0x30… | look-ahead ring object (resized by SET Lookahead / INIT) | SET/INIT | cap ≤ 512 |
| 0x64 / 0x60 | Release ms / release coeff (sample-processor read) | SET OnRelease | `expf(−1/(sr_ms·ms))` |
| 0x6c | sr (float, Hz) | INIT | |
| 0x70 / 0x74 | auto-release fast / slow coeffs (sample-processor read) | CO writes 0xe/0x74; **0x70's writer not in the captured set** [H: OnAutoRelease's virtual body] | slow = 250 ms fixed |
| 0x78 | smoothed gain state (per channel in Seperate) | CALC | one-pole toward 1 |
| 0x80 / 0x1080 / 0x1084 / 0x1088 | peak ring base / write idx (bit-packed) / pyramid stride mask / pyramid height | CALC | max-pyramid over window |
| 0x24a8/0x24b0/0x24b4/0x24b8 (+0x20a0 table) | gain moving-average #1 (acc, 1/N, idx, N) | CALC | box filter over window |
| 0x2ce8/0x2cf0/0x2cf4/0x2cf8 (+0x28e0 table) | gain moving-average #2 (cascade) | CALC | triangular result |
| 0x3120/0x3128/0x3130/0x3150 | audio delay ring base/write/end/stride | CALC | length = 0x68 samples |
| 0x3164 | sr float | INIT | |
| 0x3168/0x3170 | input ptrs L/R | shell | `**` per sample |
| 0x3178 / 0x3180 | GR meter pair / gain meter | CALC | clamped-out comparison value |
| 0x68 (float) | look-ahead length in samples | SET OnLookahead (derived) | read pointer = write − 2·0x68, lerped |
| 0xc / 0xe | release coeff copy / 5 ms coeff | CO, INIT | buffer-processor read |

## 3. The mechanism, plainly (CalcLinked — the stock law) [D]

```
inL, inR   = input · dezippered_input_gain          // 0x30 += 0x38 (double)
peak       = max(|inL|, |inR|)                      // linked detector
ring[wr++] = peak                                   // 4-wide write packing
window_max = pyramid_max(last L samples)            // look-ahead max, O(log)
c          = ceiling_ramp                           // 0x48 += 0x50 (double)
target     = c / max(window_max, c)                 // unity when under
rel_c      = 0x60                                   // exp(−1/(sr_ms·Release))
gain       = min(target, (1−rel_c) + rel_c·prev)    // prev = 0x78; 0x78 = gain
gain_ma    = box2(gain)                             // two cascaded moving
                                                    // averages, 1/N scaled,
                                                    // over the same window
dly        = lerp(ring_audio[−la −1, −la])          // audio delayed by la
out        = clamp(dly · gain_ma, ±c)               // HARD clamp at ±ceiling
meter      = the min/max ladder of out vs ±c        // GR tap
```

- **Attack is instantaneous** (the min() only limits the gain's RISE:
  `(1−c)+c·prev` is a one-pole toward 1.0 with coeff rel_c; falls are
  untouched) — no attack parameter exists on the device.
- **Release** is that one-pole; e-fold coefficient from the ms parameter.
- **AutoRelease** replaces rel_c with
  `rel_c = 0x70·(1−t) + 0x74·t`, `t = clamp01((prev_gain − 0.85)·14.285716)`
  — gain ≤ 0.85 (≈ −1.4 dB GR) uses the fast coeff, gain → 1.0 uses the
  250 ms slow coeff [D; perceptual naming via golden render].
- **Look-ahead**: decisions come from the window max (future peaks); the
  audio is delayed by the same window (0x68) and the applied gain is the
  double moving-average over that window — the transient-free
  "look-ahead smoothing" the device is known for [D mechanics].
- **The ceiling is enforced twice**: by the gain law AND a final sample
  clamp to ±ceiling_ramp — the ceiling de-zippers as a double ramp
  (0x48/0x50) so parameter moves are click-free [D].
- Gain (input trim, ±24 dB [B preset]) precedes everything; the meter taps
  are the clamp comparison and the applied gain [D].

## 4. What remains open (honest residuals)

- **OnGain/OnCeiling/OnAutoRelease/OnOn/Reset virtual bodies** (the
  +0x18/+0x20/+0x28/+0x30 vtable entries) — thunks captured, targets not
  resolved in this lane [D-thunk, bodies open].
- **0x70 (auto-release fast coeff) writer** — not in the captured set
  (presumably OnAutoRelease's virtual) [H].
- **BufferProcessor CalcMain** — head/tail captured (evidence); the middle
  (the vectorized pyramid + block loops) truncated in this capture;
  re-decompilable at 0x1016c0798 [D-partial].
- **Seperate-mode gain state** (per-channel 0x78 twins and their Link
  copy-back) — read from the copy loop, not walked end-to-end [H-minor].
- **Meter scaling/GR tap polarity** for the UI (−0.5 dBFS conventions of
  the Glue lane do NOT transfer; nothing in the capture pins the displayed
  GR mapping) [H].
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane). The
  golden-render corpus for Limiter does not exist yet (COVERAGE row empty).

## 5. Confidence

- Processor split (buffer/sample), callback inventory (4 + block), ctor
  defaults, lookahead LUT {64,128,256} + sr multipliers + 512 cap, the
  release/auto-release laws, the moving-average cascade, the final ±ceiling
  clamp, preset ranges: **high** as decompile/byte readings — single-source
  decompiles cross-checked against nm symbols, const pool and preset XML,
  which agree everywhere they overlap (Ceiling default −0.3 = the clamp
  value family; Release 0.01–3000 ms vs the e-fold law; AutoRelease
  default true ↔ the Auto calc pair).
- Auto-release perceptual mapping, meter conventions, virtual bodies,
  Seperate bookkeeping: **low/medium** — graded inline; do not build on
  them alone.
- No behavioral claim of any grade is made; the golden-render corpus for
  Limiter does not exist yet (COVERAGE row empty).
