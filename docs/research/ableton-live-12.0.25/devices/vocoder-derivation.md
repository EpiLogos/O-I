# Vocoder (OVocoderProcessor) binary derivation (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only headless probes — no
re-import). NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/vocoder-decompiles.txt` (symbol maps, create chain,
NewRate band-bank builder, CalcStereo/CalcMono/CalcStereoCarrierOnly/
CalcMonoFlattenNdm, all captured setters). Form follows
`compressor-derivation.md`; claims graded: **[D] decompiled-confirmed**,
**[B] byte-decoded**, **[H] unverified hypothesis** — no behavioral renders
ran in this lane; per README every [D]/[B] claim still awaits the
golden-render cross-check before it gates a rebuild.

The stock Vocoder is `OVocoderProcessor` — a **block-rebuilt** device:
`Init` and `Reset` trampolines are literally empty (`return`), and NewRate
rebuilds the whole analysis/synthesis bank. The processor is one flat
~0x107620-byte object; per-band state lives in SIMD-interleaved groups of
4 bands (band struct stride 0x1e0 bytes, up to 40 bands). The analysis bank
is per-channel pairs of 4th-order bandpass biquads with power-compensated
gains and an alternating-sign second section; envelopes are two-stage
(|x| one-pole attack/release feeding a 20 ms/5 ms dual peak-hold).

## 1. What runs when (call topology)

- **Create** `SOnProcessorCreate<OVocoderProcessor>` 0x1018c5304 → wrapper
  0x1018c5340 (shell 0x28 bytes; DSP object at shell+0x18; param block
  `iStack_34 + 0x107620` — processor size **0x107620**) → ctor 0x1019badcc
  (not captured [open]).
- **Init 0x1019c088c / Reset 0x1019c0890: empty bodies** [D]. All state
  derived work happens in NewRate and in the setters.
- **NewRate(int,int)** 0x1019c0894 [D]: second int = sr Hz (compressor
  convention). Stores sr `0xa4`, 1/sr `0xa8`; release coeff
  `0xb4 = exp(−4.6052/(sr_ms·100))` (ln100 → 100 ms); writes 1/sr into
  every band group's two slot positions (stride 0xf0: 0x7e0, 0x8d0, …);
  rebuilds the **modulator DC-blocker/detector biquad pair** at 0x4810 from
  the const pool `0x104cf3168` = {21991.1484, 9424.77832} [B] — corners
  `c/sr` clamped below π, i.e. **3.50 kHz and 1.50 kHz** fixed detection
  filters, RBJ lowpass Q = 1.414 form (sinh(…)/1.414 decompile shape);
  initializes the voiced oscillator object at 0x49e0
  (`func_0x0001018817d8`); then, when the two enable bytes (0x59, 0x58)
  are set, runs the **band-bank builder loop** (§2) and computes the
  carrier gain `0xac = exp10((v−1)·(v ≤ 1 ? 21 : 9)·0.05) · 0x88 ·
  8/√bandCount` (× a second exp10 factor when byte 0x60 & 1 — the Wide
  flag [H]) and stores `0xbc = 0x8c` (ModulatorAmount mirror).
- **Per-sample callbacks** — twelve `Calc*` trampolines at
  0x1019c1094–0x1019c10c0 (mono/stereo × Flatten × "Ndm" × carrier-only;
  dispatch body not captured, the twelve addresses are in the capture).
  `CalcStereo` (0x1019c10b8) captured in full [D].
- **OnBandCount** 0x1019c08a8 [D]: `bandCount = param·4 + 4` (param 0…9 →
  4…40 bands — a 4-band-per-step menu), stored 0xa0 and mirrored 0x5c;
  rebuilds the bank via `func_0x0001019b9684(0x68, 0x6c, 0x70, 0x74, 0x8c,
  0x88, &0xa0, byte 0x60, !byte 0x91)`; then rewrites the envelope
  coefficients per band group (below).
- **Setters**: every frequency-shape parameter (Low/High Frequency,
  FilterBandWidth, FormantShift, Retro, Mono/Stereo, CarrierFlatten,
  ModulatorAmount, On/OnX) ends in the same `0x1019b9684` bank rebuild
  (Mono/Stereo additionally calls `0x1019b9be4(bank, ≠2, ==0)` first — the
  bank topology rewire [D]). Envelope setters rewrite only coefficients.

## 2. The band-bank builder (NewRate inner loop)

For band i of N (`N = *(0xa0)`), centers are **geometric** between the
Low/High Frequency bounds: `log lo`, `log hi`, `step = (log hi − log lo)/(N−1)`
[D].

- **Bandwidth law**: `bw = LowFrequency · (2/3) · |step| · log2(e)`, floor
  0.005 [D]. With **FormantShift** (byte 0x91) the effective bandwidth
  tilts: `bw_eff = bw · exp((ln 1000 − log f_center)·0.4)` — low bands
  narrow, high bands widen (a formant-region emphasis) [D].
- **Filters per band**: two bandpass sections (a 4th-order pair),
  RBJ-bandwidth form `alpha = sinh(ln2/2 · bw_eff · w0/sin w0)` (0.34657 =
  ln2/2 visible in the decompile), coefficients written SIMD-interleaved:
  `b0 = ±(2·bw^0.25/√f_center)` — the **power-compensation gain**
  (∝ bw^¼, 1/√f), `b1 = 0`, `b2 = ∓b0`, then a0inv/a1/a2; the second
  section of each pair alternates the sign of the gain by band parity
  (`i & 1`) — a two-phase (polyphase-ish) arrangement [D; purpose H].
- Per-band level gains live in a separate interleaved array at processor
  offset 0x46c0 (`(band>>2)·0x10 + (band&3)·4`; OnBandLevel writes it
  directly) [D].
- **Envelope coefficients** per group (OnBandCount/EnvelopeRate/Release/
  LevelGate): attack `exp(−ln 10000/(sr_ms·EnvRate))` (9.2103 = ln 10⁴);
  release `exp(−ln 100/(sr_ms·Release))`; fixed stages
  `exp(−ln 100/(sr_ms·20))` and `exp(−ln 100/(sr_ms·5))` — 20 ms and 5 ms
  peak-decay pair; plus a release-time-scaled stage for the Uvd path [D].

## 3. The mechanism, plainly (CalcStereo)

Inputs: modulator L/R at `**(0x30)/(**0x38)`, carrier L/R at `**(0x40)/
(**0x48)` (stored to 0x49c0/0x49c4 for the metered path) [D].

1. **Modulator conditioning**: each channel runs a 2-channel biquad
   (0x4810 block, the fixed 3.5 kHz/1.5 kHz detector LPs) with a `+0.01`
   DC offset injected into the input (`(x + 0.01)` — keeps the envelope
   alive on DC-free material) [D].
2. **Envelope stage 1**: `|band_out · gain|` one-pole attack/release
   (coeffs 0x4930/0x4938, state 0x4900+) [D].
3. **Envelope stage 2**: dual **peak-hold with decay** — `fmax(env,
   state·decay20ms)` then `fmax(that, state·decay5ms)` (states
   0x4920+, decays 0x4940+) — fast attack, two-rate release [D].
4. **Carrier source switch** (`*(0x49bc)`, four cases) [D]:
   - case 0: **noise** — `func_0x0001016d8bb4` × 0.125, level-scaled by
     `0x107604 = UvdLevel · 8` (OnUvdLevel law);
   - case 1: carrier input (0x40/0x48) passthrough;
   - case 2: **modulator as carrier** (self-vocoding), × 0.25;
   - case 3: **voiced oscillator** — `func_0x000101881988` (osc at 0x49e0)
     through a one-pole (0x49c8 state, 0x49cc coeff), waveform selected by
     `*(0x49d0)`: case 0 saw-shaped `(x·(−2)+1)·0.125`, cases 1/2/3
     pulse via threshold compare at 0.1/0.25/0.48, phase wrapped at 1.0.
5. **Band-bank call** `func_0x0001019c1408(carrierL, carrierR, modL, modR,
   …, env-quad, bank=0xa0, out meters, out mix)` — the OVocoderBandBank
   calc (body not captured [open]); it writes the 40 band-envelope meters
   (×0.5) to `*(0x98)` and returns the vocoded stereo pair [D].
6. **Output**: `out = dry·(1 − DryWet) + vocoded·DryWet` (0x80) [D].

The "Ndm" variants swap the carrier-source section for the
Unvoiced-Detection path (UvdThreshold/UvdSlow coefficients
`exp(−ln100/(sr_ms·max(5, (2p)²)))` shaped laws), mixing the noise carrier
in when the detector calls the modulator unvoiced — parameter laws captured,
per-sample detection body **[H]** (in the uncaptured band-bank call).
"Flatten" variants select the CarrierFlatten mode (a bank-side carrier
spectral-flatten flag; setter captured, runtime **[open]**).

## 4. The state-slot ledger (abridged)

| slot | role |
|---|---|
| 0x58 / 0x59 | enable bytes gating all rebuilds [H: On/x] |
| 0x60 / 0x91 | Wide flag byte / FormantShift char (inverted into rebuild) |
| 0x68/0x6c/0x70/0x74 | freq-shape params (lo/hi/…, units open) |
| 0x78 / 0x7c | EnvelopeRate / EnvelopeRelease (ms) |
| 0x80 | DryWet |
| 0x88 / 0x8c | OutputGain / ModulatorAmount |
| 0xa0 / 0xa4 / 0xa8 | bandCount / sr / 1/sr |
| 0xac / 0xb4 / 0xbc | carrier gain / 100 ms release coeff / mod amount |
| 0xf0–0x158 | per-group envelope attack/release pairs |
| 0x46c0+ | per-band level array (SIMD 4-interleaved) |
| 0x4760–0x47fc | 40 band meter values |
| 0x4810–0x48ac | modulator DC/detector biquads (3.5 kHz / 1.5 kHz) |
| 0x4920–0x4998 | envelope + peak states/coeffs |
| 0x49a0 / 0x49bc | noise source obj / carrier-source selector |
| 0x49c0–0x49d0 | carrier meter pair, voiced osc one-pole, waveform menu |
| 0x49e0 | voiced oscillator object |
| 0x85fac / 0x85fd0 / 0x107604 | Uvd bound / noise obj / noise level (×8) |
| 0x10760c | sr copy |
| 0x98 | meter-out pointer (40×0.5 writes) |

## 5. What remains open (honest residuals)

- **`func_0x0001019c1408`** (the band-bank Calc: analysis → envelope →
  carrier multiply → synthesis summation) — the innermost vocoder math is
  not captured; the per-band SIMD coefficient layout above is from the
  builder side. Behavioral-gate material.
- **`func_0x0001019b9684`** (shared bank rebuild used by ten setters) and
  **`0x1019b9be4`** (mono/stereo topology) — sizes/laws open.
- **ctor 0x1019badcc** — factory defaults open (all defaults in §1 are
  NewRate-side).
- **Param-unit map** for 0x68–0x74 (Hz vs semitone-relative; FormantShift
  shows an `exp2(v/12)` semitone shape in-set) and the exact Low/High
  Frequency slot assignment [H].
- **"Ndm"** expansion (Unvoiced-Detection Mode is the reading consistent
  with the Uvd* parameter family) [H]; the detection comparator itself.
- The **Calc* dispatch** (12 variants, Mono/Stereo × Flatten × Ndm ×
  CarrierOnly) selection logic.
- Everything in §3 awaits the golden-render gate (README binding rule; no
  renders ran in this lane).

## 6. Confidence

- Block-rebuilt architecture (empty Init/Reset), band-count law, bandwidth/
  formant/gain laws, envelope coefficient laws, carrier-source switch,
  DryWet placement, and the fixed 3.5/1.5 kHz detector corners: **high** as
  decompile readings; the corners are const-pool [B] and the coefficient
  forms are internally consistent (RBJ) across builder and setters.
- SIMD band layout and per-band level array: **medium-high** (layout read
  directly from index arithmetic; no second reading).
- Ndm semantics, UI-word mapping (Enhance/Flatten/Retro), param units:
  **low** — graded [H], do not build on them.
