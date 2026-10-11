# Cabinet (CabinetDevice → Softube `Cabinet` bundle) binary derivation — 2026-10-09, binary lane

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25) via the
persistent Ghidra project `~/tools/live-re/ghidra-proj2/LiveRE2` (query-only)
PLUS a static census (nm/strings/otool/plutil) of the DSP bundle. NOT FOR
REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/cabinet-bundle-census.txt`. **Per the
lane instruction the factory IRs are audio assets: this dossier names the
storage/processing MECHANISM only — no IR data is extracted, decoded or
reproduced.** Claims graded **[D]/[B]/[H]** as in the sibling dossiers; no
behavioral renders ran in this lane.

Like Amp (see `amp-derivation.md` for the negative census), Cabinet has **no
processor in Live.arm64** — its DSP is `Cabinet.bundle/Contents/MacOS/
Cabinet` (Mach-O universal, 4.4 MB, Softube, same `CreateInstanceU/
SetParameterA/CalcA/ResetA/GetPlugInfoU` + `_SoftubeVSTCallback` ABI, same
`CSoftubeAmp` host-engine class family as the Amp bundle) [B].

## 1. What runs when (selection topology)

- **CabinetType** (XML enum 0..4) [B]: UI names in Live's string pool:
  `1x12, 2x12, 4x12, 4x10, 4x10 Bass`; the bundle's data-set name strings
  are `1x12, 2x12, 4x12, 4x10, 4x10Bass` — again in **six sample-rate
  variants each** (`n44a…n192a` families), selected by rate like the Amp
  model sets.
- **MicrophoneTypeSwitch** (XML bool, default false) [B]: `Dynamic` /
  `Condenser` mic [B].
- **MicrophonePosition** (XML enum, default 0) [B]: `Near On-Axis` /
  `Near Off-Axis` [B].
- **DualMono** (XML bool): two independent mono instances vs one stereo
  instance — host-side [H], same reading as Amp's DualMono.
- **DryWet** (XML float): Live host crossfade [H].

## 2. The IR mechanism (named, not extracted)

- The speaker/mic response is a set of **factory impulse responses embedded
  in the bundle's const data** (the `__TEXT __const` / `__DATA_CONST`
  regions hold multi-megabyte data arrays; section layout captured) —
  organized per (cab type × microphone × position), with per-rate variants
  [B: name strings + section sizes; NOT dumped].
- Processing is **partitioned FFT convolution**: the bundle exports
  `FftProcessFunction(void*, SoftubeProcessInfo*, bool)` /
  `GetFftProcessFunction()` and carries a full `CSoftubeFFT`
  (Init/Input/ApplyWindow/SetSmoothSize/MakeDisplayData…) [B]. The
  SoftubeProcessInfo-driven path is the block convolution runner.
- The IR **selection** combines CabinetType × MicrophoneType ×
  MicrophonePosition into one of the embedded response sets; how many
  distinct responses exist per cab (e.g. separate per mic × position, or
  blended) is **open** — the data-set name strings recovered name only the
  cab families [B-partial].
- **No IR content is reproduced here and none may enter the repo or product
  source.** For the rebuild, the IRs are **corpus material**: renders of the
  factory presets (impulse/sweep through each CabinetType/mic/position
  combination) recover effective responses behaviorally, keeping the shipped
  assets out of the tree.

## 3. The mechanism, plainly

Stock chain: input (stereo or dual-mono) → partitioned FFT convolution
against the selected IR set → host DryWet crossfade. Mic type/position
switch the response, cab type switches the IR set; nothing in the census
suggests additional per-sample nonlinear stages (no wave-shaper symbols
beyond the shared engine) [B/H].

## 4. What remains open (honest residuals)

- IR matrix cardinality (responses per cab; mic blending) — open.
- Host loader identity (shared with Amp's open residual) — [H].
- Convolution block size / latency (partition count) — decodable from the
  bundle later; behaviorally measurable from an impulse render (group delay).
- Mono→stereo behavior when DualMono=false (mono fold or true stereo IRs) —
  [H]; one stereo impulse render resolves it.
- Golden-render corpus for Cabinet does not exist yet (COVERAGE row empty).

## 5. Confidence

- "Cabinet DSP is external Softube bundle; response = embedded per
  cab×mic×position IR sets; processing = partitioned FFT convolution;
  5 cab types × 2 mics × 2 positions; 6 rate variants": **high** [B].
- Everything below that (IR counts, block sizes, mono handling): **low** —
  [H]/open.
- No behavioral claim of any grade is made.
