# Filter Delay (FilterDelay) binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SearchProbe/BlockProbe scripts + `nm`, no re-import). NOT FOR REDISTRIBUTION.
Never enters product source (`packages/live-dynamics`). Companion capture:
`evidence/binary/filterdelay-decompiles.txt` (nm census, lifecycle, setters,
calc bodies, verdicts). Form follows `compressor-derivation.md`; claims
graded: **[D] decompiled-confirmed**, **[B] byte-decoded**, **[H] unverified
hypothesis** — no behavioral renders ran in this lane; per README every
[D]/[B] claim awaits the golden-render cross-check before it gates a rebuild.

The stock Filter Delay is not one processor: the binary ships
`OFilterDelayProcessor` (one delay **band**: bandpass filter + feedback
loop + interpolated stereo delay line) and `OFilterDelayAddProcessor` (the
dry-path/global summing companion: OnDryVolume / OnGlobalOn / OnInXGlobal /
Calc). The device's three L/M/H columns correspond to three
`OFilterDelayProcessor` instances — UI strings "FilterDelay1", "FilterDelay2",
"FilterDelay3" over `AFilterDelayUnit` — **[H: grouping from string
evidence; the rack wiring is shell-side, not captured]**. Consequence for
the lane's framing: there is **no inter-band feedback routing matrix** in
this layer — each band's feedback loop is strictly self-contained (§4);
per-band DryWet/Pan/Volume ride per-channel gain ramps inside each instance.
This is an older-generation processor (no blocks-namespace, no ramp-object
structs — inline doubles instead), with `NewRate(int,int)`/`NewTempo(f,f,f,f)`
scheduler entries like the Glue/Compressor family.

## 1. What runs when (call topology)

State lives inline in the processor (`this+…`). Trampoline census (capture
§1) — all `SProcessorFunc` invokes: Init 0x10167b01c, Exit 0x10167b0a8,
Reset 0x10167b0cc, NewRate 0x10167b100, NewTempo 0x10167b104, OnOn
0x10167b180, OnFilterOn 0x10167b1cc, OnInputMode 0x10167b1e8, OnGlobalOn
0x10167b230, OnMidFreq 0x10167b240, OnBandWidth 0x10167b3c4, OnIsBeatSync
0x10167b544, OnDelayTimeInMs 0x10167b5c4, OnDelayTimeInNote 0x10167b638,
OnBeatDelayOffset 0x10167b6b0, OnDelayTransitionMode 0x10167b79c, OnX
0x10167b7a8; pointer-carrying setters OnFeedback 0x10167b794, OnPan
0x10167b72c, OnVolume 0x10167b760 (each receives a (value, rampSteps)
pair); calc family CalcMainAudioOff 0x10167b8ac + the 12 `CalcFilter*`
variants 0x10167b7c0…0x10167b7ec (Fade/Jump/Repitch × WithReset ×
FilterOn/Off).

- **Create** `SOnProcessorCreate<OFilterDelayProcessor>` 0x1018bda60
  [D, census; inner construction not captured].
- **Init** 0x10167b01c [D]: sr arrives via the scheduler (`lVar6+0x1c`);
  delay-time law (§3), ring sizing (`0xa8` float / `+8` int = delay in
  samples), then the calc-func swap through the scheduler entry table
  (`0x220`): selects CalcMainAudioOff when the device is off
  (bytes 0x1d8/0x1d9), else the `CalcFilter*` variant selected by
  DelayTransitionMode/FilterOn state.
- **NewRate(int,int)** 0x10167b100 [D]: **second int = sr (Hz)**
  (Glue §8 convention); `0x208 = sr·0.001` (kHz); delay ring resized to
  `pow2ceil(sr_ms · 4600)` samples (≈ 4.6 s → the 4599 ms delay cap);
  `func_0x0001016d37a8(400.0, sr, ring, 0x80)` (ring helper); `1/sr`
  stored at 0x108/0x134; then the full crossover recompute (§2) from
  MidFreq/BandWidth — same tail OnMidFreq/OnBandWidth run.
- **NewTempo(f,f,f,f)** 0x10167b104 [D]: first float = tempo (BPM) stored at
  `0x20c`; beat-time law (§3) re-runs; delay-line setter called through the
  vtable slot (`param_3+0x10`).
- **Reset** 0x10167b0cc [D]: ring clear (`func_0x0001016d3490(+0x50)`),
  zeroes the biquad states 0xf8/0x100/0x124/0x12c and the feedback memory
  0x138.
- **Setters**: OnFilterOn 0x10167b1cc [D] — bool at 0x1da, clears the filter
  states, swaps the calc func (same scheduler swap as Init). OnMidFreq
  0x10167b240 / OnBandWidth 0x10167b3c4 [D] — recompute tail below. Time
  params OnDelayTimeInMs/InNote/BeatDelayOffset/IsBeatSync [D] — all re-run
  the shared delay-time law. OnFeedback/OnPan/OnVolume [D] — the generic
  ramp in inline form: `current(+0x140) = value`, `inc(+0x148) =
  (value − current)/steps` (epsilon kill 1e-12), `steps(+0x150)`.
- **Per-sample**: the selected `CalcFilter*` body (§4).

## 2. The state-slot ledger (processor-inline)

| slot | role | writer | value / law |
|---|---|---|---|
| 0x8 (int) / 0xa8 | delay length, samples | time law | sr_ms · ms, cap 4599 ms |
| 0x40 | output pair (wet·gain) | CALC | per-channel ramps × interpolated taps |
| 0x48 / 0x4c | input trim L / R | OnInputMode **[H on values]** | band input mix |
| 0x50… | ring manager | NewRate | pow2ceil(sr_ms·4600) slots |
| 0x60/0x68/0x6c | ring base / capacity / write idx | NewRate / CALC | backward-write ring, 4-byte slots (mono) |
| 0x70 / 0x78 | tap phases L / R (int.frac 32.32) | CALC | advanced by 0x80 / 0x88 per sample |
| 0x80 / 0x88 | tap steps L / R | time law | delay-length increments |
| 0xb0 / 0xb8 / 0xd0 | sinc-read gain ramp / wet ramps | OnVolume/OnPan **[H]** | doubles advanced per sample |
| 0xe0…0xf4 | biquad #1 (HPF) coeffs | MidFreq/BandWidth tail | RBJ form, Q = 1/√2 |
| 0xf8/0xfc/0x100/0x104 | biquad #1 states | CALC | |
| 0x10c…0x120 | biquad #2 (LPF) coeffs | tail | RBJ form, Q = 1/√2 |
| 0x124/0x128/0x12c/0x130 | biquad #2 states | CALC | |
| 0x138 | feedback tap (last wet L) | CALC | |
| 0x140/0x148/0x150 | feedback ramp (double/ double/ steps) | OnFeedback | inline ramp law (§1) |
| 0x188/0x190, 0x1a0/0x1a8 | per-channel output gain ramps | OnPan/OnVolume **[H on split]** | advanced per sample |
| 0x1d8 / 0x1d9 | InputMode / On(Global) gate bytes | SET | gate CalcMainAudioOff |
| 0x1da / 0x1db | FilterOn / IsBeatSync bools | SET | |
| 0x1e0 / 0x1e4 | MidFreq (Hz) / BandWidth (0..1) | SET | |
| 0x1e8 | DelayTimeInMs (ms) | SET | |
| 0x1ec / 0x1f0 | DelayTimeInNote / BeatDelayOffset | SET | |
| 0x208 / 0x20c | sr (kHz) / tempo (BPM) | NewRate / NewTempo | |

## 3. The delay-time and crossover laws

**Time law** [D] (shared by Init/NewRate/NewTempo/time setters):
```
ms = IsBeatSync(0x1db) ? ((note(0x1ec) + note·Offset(0x1f0)) · 60000 / tempo(0x20c))
                       : DelayTimeInMs(0x1e8)
ms = min(ms, 4599)                       // ring is 4600 ms
samples = sr_kHz(0x208) · ms             // -> 0xa8 (float) / +8 (int)
```
**Crossover law** [D] (NewRate/OnMidFreq/OnBandWidth shared tail): BandWidth
goes through the **global runtime LUT** (object at 0x1059a89b8 — the same
object family the Compressor lane used for its makeup curve; domain start
+0x20, scale +0x24, table +8, linear interpolation between entries) to a
ratio `r`; then
```
HIGH = min(MidFreq · r, 18000 Hz)        // biquad #2 = LPF
LOW  = max(MidFreq / r, 50 Hz)           // biquad #1 = HPF
ω    = min(f/sr · 2π, 3.1101768)         // 0.99·π clamp
```
RBJ biquad coefficients with the 1/(cos ω/√2 + 1) normalizer — Q = 1/√2
Butterworth sections **[B constants, D form]**. The band = HPF(LOW) →
LPF(HIGH) in series — a bandpass whose center/width come from MidFreq and
the BandWidth LUT ratio.

## 4. The mechanism, plainly (CalcFilterOnFade / OnJump / OnRepitch)

`CalcFilterOnFade` [D] — one band per sample:
1. `in = inL·trimL + inR·trimR − fb · prevWetL` — **feedback re-enters
   before the filter**, single tap (0x140 ramp advanced per sample).
2. Biquad #1 (HPF) then biquad #2 (LPF), transposed direct-form II — the
   band filter sits **inside the feedback loop** (colored feedback, the
   classic Filter Delay behavior).
3. The filtered sample is written into the ring (write idx 0x6c, masked).
4. Two independent fractional read taps (phases 0x70/0x78, per-tap float
   steps 0x80/0x88 — stereo delay: independent L/R delay lengths from one
   ms value **[H on the L/R split origin]**) read the ring through a
   **256-row × 16-tap windowed-sinc table at 0x1059ad4c0** (row selected by
   `(frac >> 24) & 0xff`, ×0x40 bytes; taps idx−7…idx+8) — not Catmull-Rom:
   a 16-point sinc interpolation **[B table, D read pattern; window
   function open]**.
5. Output pair `0x40 = rampL · tapL, rampR · tapR` — the per-channel
   DryWet/Pan/Volume composition rides the two gain ramps (0x188/0x190,
   0x1a0/0x1a8) advanced per sample **[H on which setter owns which
   ramp]**.
6. Feedback ramp (0x140) and the output ramps advance; the wet value stored
   to 0x138 is next sample's feedback tap.

`CalcFilterOnJump` 0x10167b7e0 [D, 70 lines — captured]: same graph, the
delay phases jump to the new length (no smoothing ramp). `CalcFilterOnRepitch`
0x10167b7d8 [D, 148 lines — captured]: the tap steps glide (the phase
increments themselves are ramped), giving the tape-style pitch shift during
time changes. The WithReset variants (capture §1 census) add the ring-clear
on transition; the Off variants bypass the band (CalcMainAudioOff).
DelayTransitionMode selects among Fade/Jump/Repitch — the same three-way
choice as the Delay device's CompatibilityType.

## 5. What remains open (honest residuals) + confidence

**Open:**
- The rack-level wiring: how the shell instantiates the three bands
  (FilterDelay1/2/3) and the Add processor, where the L/M/H input crossover
  lives (each band's own HPF/LPF pair is the candidate — but per-band
  MidFreq/BandWidth values vs a shared crossover is shell-side) **[H]**.
- OnPan/OnVolume/OnDryVolume ramp-target mapping (which of 0xb0/0x188/0x1a0
  is drywet vs pan vs volume), and the Pan law itself (equal-power? not
  visible in the captured bodies).
- InputMode value map (0x48/0x4c trims; L/R/Stereo/… enum), OnOn/OnX/OnX
  semantics, GlobalOn (Add processor) truth table.
- The Add processor's `Calc` body and `OnInXGlobal`; the WithReset and Off
  calc variants; Exit.
- The sinc table's window (Hann? Hamming? Blackman?) — runtime/static dump
  of 0x1059ad4c0 (256×16 floats) would pin it **[B-negative]**.
- The 0x1059a89b8 BandWidth LUT contents (runtime-built, beyond the
  file-backed range — same verdict as the Compressor lane's makeup LUT).
- Everything in §4 awaits the golden-render gate (COVERAGE row empty).

**Confidence:**
- Per-band processor architecture, ramp transport, time law (incl. the
  4599 ms cap and 4600 ms ring), crossover law via the global LUT, RBJ/
  Butterworth filter forms, the feedback-before-filter topology, the
  16-tap sinc interpolation: **high** as decompile readings — single-source
  (LiveRE2 captures), cross-checked against the nm census and the adjacent
  Delay/Compressor lanes' shared conventions (sr_kHz slot, NewRate second
  int = Hz).
- Three-band grouping, ramp ownership, pan/volume/drywet split: **low** —
  [H], do not build on them.
- No behavioral claim of any grade is made; no golden-render corpus for
  Filter Delay exists yet.
