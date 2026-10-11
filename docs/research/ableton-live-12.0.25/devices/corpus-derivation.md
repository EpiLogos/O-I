# Corpus (ACorpus) binary derivation — topology + resonator interface laws (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only) PLUS raw llvm-objdump —
the ACorpus TU is undisassembled virgin territory (FuncListProbe
0x102802958..0x1028095ec TOTAL=0), so the span was disassembled and two
functions decompiled in a **scratch copy** of the project
(`~/tools/live-re/ghidra-lane-scratch/LaneScratch`, byte copy made for this
lane; the canonical project was never mutated). Official evidence: the 26
factory presets `Core Library/Devices/Audio Effects/Corpus/*.adv` (gzip XML,
read only). Capture: `evidence/binary/corpus-captures.txt`. Form follows
`analog-derivation.md` (same A-framework family); claims graded: **[D]**
decompiled/disassembly-confirmed, **[B]** byte/const decoded, **[H]**
unverified hypothesis. NO Live, NO renders ran in this lane; per README every
[D]/[B] claim still awaits the golden-render cross-check before it gates a
rebuild.

Corpus is an **AAS-family A-framework compound**, not a devicekit device:
one flat compound `ACorpus` (factory 0x102802958, object 0x610 bytes) +
device-unit `ACorpusUnit` (0x1028afc10), with the AAS value-converter
`AAASStringConverter<ACorpusRealValue>` and an `ACorpus::InitLfo` lambda in
the symbol table [D, nm]. Like Analog/Collision there is **no
`OProcessorCreateManager` processor and no `SProcessorFunc` instantiations**
— the devicekit setter-dispatch census has no Corpus equivalent; the
per-sample DSP is A-framework internal dataflow and is **corpus material**
(§4). What the binary does pin: the complete parameter surface, the compound
construction, the MIDI-note observer wiring, and the one DSP-facing contract
that crosses the compound boundary — the **2-cascade biquad filter getter**
(the Corpus "Filter" section) with its full coefficient law [D].

## 1. What runs when (call topology, as far as this lane sees)

- **Factory** `SNewCompound<ACorpus>` 0x102802958 [D]: allocates 0x610 bytes,
  calls the real ctor `FUN_1028040f4`, registers with `ACompound`.
- **Ctor `FUN_1028040f4`** (body 1284) [D]: vtable install (`&UNK_1053ed678`
  + 3 secondary vtables); member compounds default-constructed at +0x1d0..
  +0x590 (string/value/enum/bool member ctors `func_0x0001022c3dd8/3d40/3e70/
  func_0x00010023c5a8`); display name "Corpus"; `+0x178 = 0x100000001`,
  `+0x180 = 1`; three param-builder calls (`0x1028049f8`, `0x102805998`,
  `0x102806c60` — 8.4 KB / bodies open, table-driven descriptors from
  `__DATA`, e.g. 0x10595dba0); then the auditable registrations:
  **Gain = 0.5**, **Width = 1.0**, **"Dry Wet" = 0.5** [B floats, D names];
  `OnMidiNoteRelevantChange` (vtable slot +0x5a8) subscribed to five
  observables (this+0x298/0x2c8/0x280/0x358/0x2f8) [D]; tail
  `func_0x0001028070b0` (mod-target/visualisation wiring, body open).
- **Callback exports** (the only DSP-facing surface, thunks 0x10280e134-44)
  [D]:
  - `FilterCascadeCountGetterCallback()` = `mov w0, #2; ret` — **exactly 2
    biquad cascades** [B literal].
  - `FilterCoeffGetterCallback(int cascade, TBiquadCoeffTemplate<float>&)`
    → `FUN_1028084c0` (§3).
  - `OnMidiNoteRelevantChange(TUpdate)` — void, vtable-dispatched.
- **Compound tree**: flat — no ACorpus-prefixed sub-compounds exist in nm
  (contrast Collision's Mallet/Noise/Resonator children). The exciter, LFO,
  filter and resonator sections are member ranges of the single compound [D,
  name-table §2].
- **The per-sample callback was NOT located** — honest residual (§4), same
  verdict as the Analog lane for its instruments.

## 2. The parameter/state ledger (surface + defaults from the .adv family; mp* keys from the name table)

Member-key census (`ACorpus` name table 0x104900e07..0x104901173) matches the
preset XML element names 1:1 after the `mp` prefix and case-normalization
[e.g. "Pipe Resonator.adv", root `<Corpus>`] [D]. Defaults below from the
"Pipe Resonator" preset (ResonanceType 5); other presets span the surfaces.

- **Resonator**: `mpResonanceType` ("Resonance Type", enum 0..6 — 7 values
  used across the factory presets [B, preset table in capture]; the UI names
  String/Pipe/Membrane/Manual/Tube/Plate/Hum are NOT string-pinned in this
  TU — mapping graded [H], preset anchors: "Pipe Resonator"→5, "Tubular
  Pan"→6, tabla/kick/snare membrane family→3); `mpResonatorQuality`
  ("Resonator Quality", presets use 0..3 — the modal-bank resolution);
  `mpFrequency` + Transpose/FineTranspose (`mpDetune`) + `mpFreqDamping`
  ("Decay"/"Note Off Decay"/"Off Decay" display strings; decay family);
  geometry/material knobs per type: Radius (`mpRadius` group), Inharmonics,
  TubeOpening ("Opening"), Ratio, AmpFreq, `mpExcitationX` ("Hit" — the
  excitation position), `mpListeningXL/XR` ("Listening L/R" — listening
  positions), Bleed [D names; per-type visibility map = param-builder
  bodies, open].
- **Excitation**: Corpus is an audio effect — the incoming (or sidechain)
  signal IS the mallet; `mpExcitationX` places the strike point on the
  material geometry [H on the acoustic semantics; the member/display names
  are [D]]. `mpSideChain` + the XML `<SideChain>` routing = alternate
  exciter source.
- **Filter** (the pinned law, §3): `mpFilterOn`, `mpFilterMidFreq` ("Mid
  Freq"), `mpFilterBandWidth` ("Filter Width").
- **LFO** (11 members): On/Type/Sync/Rate/SyncRate/
  SyncRateRelativePosition/StereoMode/Spin/Phase/Offset/Amount — built by
  `ACorpus::InitLfo` [D symbol].
- **MIDI**: `mpMidiPitch` ("MIDI Frequency"), `mpMidiMode` ("MIDI Mode",
  Last/Note Off displays), `mpMidiGate`, PitchBendRange, `mpMidiNoteString`
  / `mpCentString` (display caches).
- **Global**: `mpDrive`, `mpStereoWidth` ("Width" 1.0), Gain 0.5, "Dry Wet"
  0.5 [B].

## 3. The mechanism, plainly (what the binary pins down)

**The Filter section = a 2-cascade Butterworth band-pass.**
`FilterCoeffGetterCallback` `FUN_1028084c0` [D, scratch decompile]:

```
mid  = FilterMidFreq (mapped getter, this+0x520)
w    = bandwidth param (mapped getter, this+0x538)
2^w via polyfill: ((((f·0.013487903 + 0.0521745)·f + 0.24128748)·f
                  + 0.6930501)·f + 1.0) · floatbits((int)x << 23)
     // x = clamp(w·0.5 + 127, 0, 255); Taylor of e^(f·ln2) for the fraction,
     // (int)x<<23 reinterpreted as float = 2^(int x − 127)
cascade 1 (LP edge): fc = min(mid · 2^w, 18000 Hz), tag 1
cascade 0 (HP edge): fc = max(mid / 2^w,    50 Hz),  tag 2
cascade ≥ 2: zeroed coeffs, return false
w0 = fc·2π; Q = 0.70710677 (1/√2, Butterworth, both cascades)
RBJ-style coefficient build (helper 0x1022d46c8), 6 normalized coefficients
written to TBiquadCoeffTemplate<float>; return cascade < 2
```

So the band-pass is HP(50 Hz floor) ∘ LP(18 kHz ceiling) at mid ×/÷ 2^width,
and the getter interface (count 2 + per-cascade coefficient pull) is how the
A-framework DSP consumes the filter [D]. The exp2 polyfill (no hardware exp2
on this path) and the 50 Hz/18 kHz guards are exact [B].

**Modal material handling — what the binary shows.** The resonator's modal
data is internal to the A-framework engine: no material-file parser, no
material-name strings, and no material LUTs are reachable from the ACorpus TU
( searched: type-name strings, `sInfoText*` corpus family, `__DATA`
descriptor tables — none pin a material format) [D-negative]. The factory
materials are assets by the lane's standing rule: **mechanism only, never
extract**. What is pinned: the material's macro-controls are the per-type
parameter set (§2: Radius/Inharmonics/Opening/Ratio/AmpFreq/Damping), the
quality selector (`mpResonatorQuality`, 0..3) selects the modal-bank
resolution [H on the resolution semantics], and the excitation/listening
geometry (ExcitationX, ListeningXL/R) parameterizes the same model [D
names]. The runtime frequency table used by the coefficient path lives in
`__DATA` beyond the file-backed range (startup-built, corpus material).

## 4. What remains open (honest residuals — corpus material)

- **The per-sample DSP**: resonator synthesis (modal bank vs. physical
  solve), the drive stage, LFO engine internals, output matrix. No
  `SProcessorFunc`, no located calc loop — same class of residual as the
  Analog lane's instruments. A behavioral render (impulse → modal
  decomposition per type/quality) is the only route to the engine.
- **ResonanceType value→name mapping** (0..6 to String/Pipe/Membrane/
  Manual/Tube/Plate/Hum) — preset anchors bracket it (membrane=3, pipe=5,
  tube=6) but the menu item list is not string-pinned; [H], do not build
  on it without the menu builder (`param builder 0x1028049f8/0x102805998/
  0x102806c60`, 8+ KB bodies, table-driven — open).
- **Per-type parameter visibility map** (which knobs show for which type)
  and per-type default laws — inside the param builders, open.
- **Material-file mechanism**: if factory materials are files anywhere,
  this lane did not find the loader; treated as embedded assets (corpus
  material). The lane rule stands: factory material data is never extracted.
- **Decay family** (Decay / Note Off Decay / Off Decay ↔ mpFreqDamping
  grouping) — display strings [D], parameter mapping [H].
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Compound topology, absence of a devicekit processor, name-table ↔ XML 1:1
  parameter surface, ctor composition, cascade-count literal, and the filter
  coefficient law: **high** as decompile/byte readings — single-source
  (scratch-project decompile of an otherwise virgin TU), cross-checked
  against nm and the official preset XMLs; the scratch copy is a byte copy
  of the analyzed canonical project.
- ResonanceType naming, excitation/listening semantics, quality semantics,
  decay-family mapping: **low** — graded [H], do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Corpus does not exist yet (COVERAGE row empty).
