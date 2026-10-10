# Spectrum ("SpectrumDevice") binary derivation — analyzer layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SymProbe/CallTargetsProbe/BlockProbe/DataProbe scripts, no re-import).
NOT FOR REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/spectrum-decompiles.txt` (symbol table,
trampoline targets, ctor, NewRate/OnLength/OnWindow/OnNumAverages, calc-swap
law, refresh-timer law, analyzer-ring init, window builder, const-pool and
memory decodes). Form follows `compressor-derivation.md`; claims graded:
**[D] decompiled-confirmed**, **[B] byte-decoded**, **[H] unverified
hypothesis** — no behavioral renders ran in this lane.

**Spectrum is an analysis-only device: it never touches the audio path.** Its
processor is `OSpectrumAnalyzerProcessor` — the same engine the EQ8 / Channel
EQ / Hybrid Reverb analyzers mount (`OnActiveViewCount`; the `A*` side is
`ASpectrumAnalyzer`, `AEq8SpectrumAnalyzer`, `AChannelEqSpectrumAnalyzer`,
`AHybridSpectrumAnalyzer`). When no viewer wants data (or the device is off),
the processor deregisters its calc entirely (`SNoCalcAudioFunc`) — the audio
graph runs it at zero cost. The display mapping (log-frequency X, dB→Y, the
−320 dB floor fill) lives at the processor's data layer; the pixel mapping is
the UI compound's (`ASpectrumAnalyzerView`), not captured here.

## 1. What runs when (call topology)

- **Create** `OProcessorCreateManager::SOnProcessorCreate<OSpectrumAnalyzerProcessor>`
  0x1018c45f0 → wrapper 0x1018c462c (param block at shell+0x1d0) → ctor
  thunk 0x1018995fc [D]: sr float at 0x10; **defaults 0x14 = 8192 (FFT
  length), 0x18 = 2 (window selector), 0x24 = 60.0f (MinRefreshTime, ms)
  [B: 0x104cde530/538, 0x42700000]**; OnEvent timer callback object at 0x78
  (the analysis heartbeat), StatusChanged callback at 0x80; calc slot 0x98;
  analyzer ring object at 0xa0 (`func_0x00010177a3d4`); input rings 0x100 /
  0x110; display buffer pointer slot 0x128 (0x8000 bytes); averages count
  0x130; nine curve arrays 0x138…0x1b8; generation counter 0x1c8.
  `FUN_101899538` (also Reset/OnX) frees the rings and re-fills the display
  buffer with −320.0f via `memset_pattern16` [D+B].
- **NewRate(int,int)** → FUN_101899610 [D]: first int = FFT length into the
  ring inits (rate as the ring's window/rate argument), allocates the two
  input rings (len floats each), and nine curve arrays of **len/2 floats**
  (0x138, 0x148, 0x158, 0x168, 0x178, 0x188, 0x198, 0x1a8, 0x1b8) each with
  a companion float slot pre-filled **−320.0f**; the second NewRate int is
  forwarded into the ring init's third argument — the window selector slot
  consumed by the window builder (below) [D dataflow]. Bumps the generation
  counter 0x1c8 and re-runs the calc-swap law.
- **OnLength(f)** 0x1018a0148 [D]: the Resolution enum, clamped to 0..3,
  indexes the **FFT length LUT {2048, 4096, 8192, 16384}** at 0x104cde5b0
  [B]; writes 0x14; then the same reallocate + calc-swap sequence.
- **OnWindow(f)** 0x1018a0198 [D]: `0x18 = (int)param` — the window
  selector (ctor default 2), passed to the analyzer ring's window builder.
- **OnNumAverages(f)** 0x1018a01b8 [D]: `0x20 = (int)param`; clears the
  averaging accumulator 0x130.
- **OnMinRefreshTime(f)** → FUN_101899dc0 [D]: the **block law**
  `block = max(1, round(sr·refresh_ms/1000)) >> 1`, clamped to ≤ FFT length;
  stored at 0xf0 (raw) / 0xf4 (clamped); the timer at 0x78 is re-armed with
  the clamped block as its interval (in samples).
- **OnOn / OnAnalyzeOn / OnActiveViewCount / OnChannelMode / OnX** [D]:
  bools 0x8 / 0x9, viewer count 0xc (0 → full reset), channel mode 0x1c —
  all funnel into the calc-swap law below.
- **CalcMain** 0x1018a041c → 0x1018a0464 [D]: 36 bytes — appends the input
  sample into the input ring at the write cursor (0x120 → ring data, phase
  0xf8) and advances the cursor. The FFT itself is NOT in this body: it runs
  from the 0x78 timer's OnEvent callback (every `block` samples), which
  batches the ring, windows it, transforms, averages, and publishes the
  curve buffers (the OnEvent/StatusChanged member bodies are registered as
  callbacks and were not captured).

**Calc-swap law (FUN_101899c58, shared)** [D]: `CalcMain` is registered only
when `On(0x8) && AnalyzeOn(0x9) && generation(0x1c8) == 0 && viewCount(0xc) ≥
1`; otherwise the slot gets null → `SNoCalcAudioFunc`. The `WithReset`-style
generation counter makes a reconfigure (rate/length change) detach the calc
until the shell re-arms it.

## 2. The state-slot ledger

| slot | role | writer | value / law |
|---|---|---|---|
| 0x8 / 0x9 | On / AnalyzeOn bools | SET | gate the calc swap |
| 0xc | ActiveViewCount (viewers sharing this engine) | SET | 0 → reset + deregister |
| 0x10 | sample rate (float Hz) | shell/ctor | block law input |
| 0x14 | FFT length (int) | OnLength | LUT 2048/4096/8192/16384, default 8192 |
| 0x18 | window selector (int, default 2) | OnWindow | 6 families (§3) |
| 0x1c | ChannelMode | OnChannelMode | mono/stereo combine [H on enum] |
| 0x20 | NumAverages | OnNumAverages | |
| 0x24 | MinRefreshTime (ms, default 60) | OnMinRefreshTime | |
| 0xa0 | analyzer ring (window + input staging) | NewRate/OnLength | `func_0x00010177a420` |
| 0xf0/0xf4/0xf8 | block raw / block clamped / write phase | refresh law, CalcMain | |
| 0x100/0x110 | input rings L/R (len floats) | NewRate | |
| 0x128 | display buffer (8192 floats = 0x8000 bytes) | ctor/Reset | filled −320.0f |
| 0x130 | averaging accumulator state | OnNumAverages | |
| 0x138…0x1b8 | nine curve arrays, len/2 floats + −320.0f "last" slot each | NewRate | shared by all mounted viewers (EQ8 bands, etc.) |
| 0x1c8 | generation counter (reconfigure marker) | NewRate/OnLength/OnWindow | ≠ 0 detaches CalcMain |

## 3. The mechanism, plainly

**FFT size law** [B]: Resolution 0..3 → {2048, 4096, 8192, 16384}; default
8192. The nine per-viewer curve arrays are half-length (len/2) — one bin per
non-redundant FFT bin, one array per visible curve (the Spectrum device
mounts one; EQ8 mounts per-band curves).

**Window law** [D+B]: the ring init calls the window builder
`func_0x0001017791d8(buf, len, selector)`; `selector < 6` — six window
families. Decoded: **case 2 = Hamming, `w[n] = 0.53836 − 0.46164·cos(2πn/(N−1))`**
(the default, selector = 2); case 0 fills from a constant 16-byte pattern
table (0x104aa6100); case 1 is a linear ramp (`n/(N·0.5)` family —
triangular); case 3 uses cosine with denominator N+1 (a Hann-class period
variant). Cases 4/5 not read. The exact family of cases 0/1/4/5 is [H] beyond
these shapes.

**Refresh/block law** [D]: `block = (sr·refresh_ms/1000)>>1`, clamped ≤ FFT
length; the timer fires OnEvent every `block` samples; CalcMain (audio
thread) only appends samples. Analysis cost is therefore one append per
sample plus one FFT per refresh interval — and zero at all when
unwatched/disabled.

**Display data layer** [B]: the published curve domain is filled with
−320.0f (the floor); every curve array carries its own "last value" float
slot initialized −320.0f — the UI reads bins that were never excited as the
floor, not as zero. The dB scaling, frequency-axis mapping and drawing live
in `ASpectrumAnalyzerView` (not captured — UI lane material).

## 4. What remains open (honest residuals)

- **OnEvent / StatusChanged member bodies** (the FFT + averaging + publish
  path) — registered callbacks, not among the SProcessorFunc entries; the
  windowing/magnitude/averaging math is inferred from the slots only.
- **Window cases 4/5**, and the family names of cases 0/1/3 beyond their
  shapes; the ChannelMode enum.
- **NewRate's second argument**: forwarded into the ring init's window
  selector position; whether the shell passes a window id or a rate-derived
  quantity there is [H].
- The averaging law (0x20/0x130): count stored, the combination formula not
  captured.
- Everything above awaits a behavioral render (a known-tone capture through
  a rebuild) before any parity claim (README gate; no renders in this lane).

## 5. Confidence

- FFT length LUT, defaults, block/refresh law, calc-gating law, window case
  2 = Hamming, −320.0f floor: **high** as decompile/byte readings —
  single-source, cross-checked against the symbol table and memory dumps.
- The OnEvent FFT pipeline description: **medium** — structure inferred from
  the timer + slot layout, body not captured.
- Window families 0/1/3/4/5 names, ChannelMode, averaging formula: **low** —
  [H], do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Spectrum does not exist yet (COVERAGE row empty).
