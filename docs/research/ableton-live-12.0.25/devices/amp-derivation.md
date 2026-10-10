# Amp (AmpDevice → Softube `Amplifier` bundle) binary derivation — 2026-10-09, binary lane

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816) via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only) PLUS a static census
(nm/strings/otool/plutil) of the DSP bundle Live loads for this device.
NOT FOR REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/amp-bundle-census.txt` (bundle identity,
ABI symbols, engine class census, model/rate data-set names, Live-side
registry + enum strings, XML defaults). Claims graded: **[D]
decompiled-confirmed**, **[B] byte-decoded**, **[H] unverified hypothesis**.
No behavioral renders ran in this lane; per README every [D]/[B] claim still
awaits the golden-render cross-check before it gates a rebuild.

**Headline**: the Amp device has **no processor in Live.arm64 at all**. The
full `SOnProcessorCreate` census (368 instantiations, SymProbe) contains
`OPedalProcessor` and `OTubeProcessor` but no Amp/Cabinet class, and
`nm -U Live.arm64` has no `O*Amp*`/`O*Cab*` processor symbol. Live registers
"Amp" and "Cabinet" in its device-name registry string (0x1048a4b13: `…,
ThirdPartyDevice,Amp,Cabinet,…`) and hosts their DSP from **loadable Softube
bundles** in `App-Resources/Devices/Mac/` — `Amp.bundle/Contents/MacOS/
Amplifier`, Mach-O universal (x86_64+arm64), 3.7 MB, identified as
**`CFBundleIdentifier com.softube.Amplifier`, v1.2.3, "(c) 2021 Softube"**
[B]. Internally it is Softube's **Amp Room engine** (`CSoftubeAmpRoom`,
`CSoftubeAmpRoomNative`, `CSoftubeEngineAbleton`).

## 1. What runs when (host/bundle topology)

- **Selection**: AmpType index (XML `<AmpType>`, 0..6) selects one of **7
  amp model data sets** in the bundle [B]: `AC30Clean, AC30Crunchy, Plexi,
  SilverTwin, DualRectLead, DualRectHeavy, SimmsWattsBass` — each shipped in
  **six sample-rate variants** (`…n44a, n48a, n88a, n96a, n176a, n192a` =
  44.1/48, 88.2/96, 176.4/192 kHz families). Live's UI names are
  `Clean, Blues, Crunch, Rock, Heavy, Lead, Bass` (live_strings) [B];
  the index↔model mapping is order-aligned at the ends (0=Clean→AC30Clean,
  6=Bass→SimmsWattsBass — the "Bass Roundup" preset stores AmpType=6 [B]),
  the middle pairs are **[H]**.
- **Engine API** (exported, arm64) [B]: `CreateInstanceU / DestroyInstanceU /
  SetSampleRateU / GetPlugInfoU / SetParameterA / CalcA / ResetA` plus
  `_SoftubeVSTCallback` — a VST1-style hosting ABI. Live-side param flow
  ([H] for the loader site): XML param → host parameter index →
  `CSoftubeAmp::SetParamValueBits` / PluginEvent.
- **Engine class surface** [B]: `CSoftubeAmp::SetAmpNr(int)` (the model
  switch), `SetNumChannels(int,int)`, `ProcessMulti(float**/double**, …)`
  (block process, f64 and f32 variants), `DSPAsync`, `ResetStates`,
  `GetPublicParameter`, `GetMeter`, mute/bypass, BPM. This is a **block-based**
  engine (ProcessMulti over buffers), unlike the Live-native per-sample
  processors.
- **XML parameters** [B]: `AmpType, Gain, Bass, Middle, Treble, Presence,
  Volume, DualMono, DryWet` (+ On, MidiControllerRange). The bundle's
  parameter-name strings carry the same set (`Bass, Middle, Treble, Presence,
  Gain, Volume` [B]); AmpType/DualMono/DryWet are host-side (Live) parameters
  [H]: **DualMono** runs two independent mono engine instances (one per
  channel) instead of one stereo instance, **DryWet** is Live's standard
  host crossfade.

## 2. Parameter layer (XML ↔ bundle)

| XML param | host/bundle | law |
|---|---|---|
| AmpType 0..6 | host → `SetAmpNr` + model data-set load | see §1 [B/H] |
| Gain | bundle (`Gain` param string) | drives the amp circuit's input stage [H] |
| Bass/Middle/Treble/Presence | bundle | tone stack + presence cap of the modeled amp [H] |
| Volume | bundle | output stage level [H] |
| DualMono | host | two mono instances [H] |
| DryWet | host | standard crossfade [H] |

No live-set-visible gain-reduction/meter link was probed; `GetMeter` exists
in the engine ABI [B].

## 3. The mechanism, plainly

- The amp sound is **not a curve or equation in Live**: each model is a
  **precomputed circuit/state data set** (per rate family) consumed by
  Softube's Amp Room engine. The data sets are owner-private audio-adjacent
  assets inside `Amp.bundle` — **named here, not extracted or redistributed**
  (same discipline as the Cabinet IRs).
- `CSoftubeFFT` and `FftProcessFunction(PvP19SoftubeProcessInfoTb)` exist in
  the bundle [B] — FFT machinery is part of the engine (Amp Room's
  convolution/cabinet path); the Amp-side use is not separated in this lane.
- Oversampling/quality handling is internal to the bundle (rate-variant data
  sets suggest per-rate model states rather than runtime upsampled solves)
  [H].
- **The bundle binaries were not disassembled in this lane** (the Ghidra
  project holds only Live.arm64; a bundle re-import is a separate decision).
  Everything below symbol/string level is intentionally open.

## 4. What remains open (honest residuals)

- **AmpType index ↔ model data-set mapping** (middle five) — [H]; one
  render per type pins it.
- The host loader: which Live-side generic processor hosts the bundle
  (registration string + `.bundle` suffix builder exist; the containing
  function was not traced) — [H].
- Per-param scaling/units inside the bundle (Gain in dB? 0..1?) —
  `GetPlugInfoU` decodable later if a rebuild needs exact host scaling.
- The 6-rate data-set selection law (which variant for 44.1 vs 48 etc.) —
  [H]: nearest-family pick.
- Golden-render corpus for Amp does not exist yet (COVERAGE row empty); all
  §1–§3 awaits it.

## 5. Confidence

- "Amp DSP is external, Softube Amp Room engine, 7 models × 6 rate sets,
  VST-style ABI": **high** [B] (bundle identity + symbol/string census +
  Live-side negative census all agree).
- Host wiring details and parameter-unit laws: **low** [H] — do not build on
  them without a render or a bundle-side disassembly pass.
- No behavioral claim of any grade is made.
