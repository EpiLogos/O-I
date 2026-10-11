# Analog (UltraAnalog) binary derivation — topology + parameter laws (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only) PLUS raw llvm-objdump and
a custom ADRP+ADD xref scan — required because **the Analog code region is
undisassembled virgin territory in the Ghidra project: zero functions, zero
string references** (RefsProbe TOTAL=0 on every Analog string). Official
evidence: `evidence/devices/Analog/default.xml` (the factory-default
`Analog.adv` from the installed app bundle; root element `<UltraAnalog>`,
Creator "Ableton Live 12.0.5d1"). Capture: `evidence/binary/analog-decompiles.txt`.
Form follows `compressor-derivation.md`; claims graded: **[D]** decompiled/
disassembly-confirmed (capture cited), **[B]** byte/const decoded, **[H]**
unverified hypothesis. NO Live, NO renders ran in this lane; per README every
[D]/[B] claim still awaits the golden-render cross-check before it gates a
rebuild.

Analog is **not** a devicekit device: it is an old **A-framework compound**
(`AUltraAnalog` + `AUltraAnalogSignalChain{,1,2}` + `AUltraAnalogEnvelope`,
member-pointer parameter binding via `AMember<T>` /
`AAASStringConverter<AUltraAnalogRealValue>`). Consequence (the lane's
headline): **no C++ symbols and no `SProcessorFunc` instantiations exist for
its DSP** — the compressor lane's setter-dispatch census has no Analog
equivalent; dispatch count in that sense is **0** [D, nm census]. Only the
five compound factories carry symbols.

## 1. What runs when (call topology, as far as this lane sees)

- **Compound tree** [D — .adv root + class strings + registration static
  init]: `AUltraAnalog` holds `mpSignalChain1`/`mpSignalChain2` (two chains)
  and globals. Each `AUltraAnalogSignalChain` holds Oscillator, Filter,
  Amplifier, LFO, `Envelope.0` (FEG) and `Envelope.1` (AEG) compounds
  [D — chain ctor `FUN_1028c1de4`: object 0x518 bytes, member compounds
  initialized at +0x68/+0x80/+0x98/+0xb0/+0xc8/+0xe0/+0xf8/+0x110, then two
  range-set calls `func_0x0001010e243c(obj, 0xc0000000 /* −2.0f */, cb)`].
  Chain 1 adds `mpFilterToFilter2` ("F1 To F2" — series-routing flag);
  chain 2 adds `mpFilterControllee` ("F2 Slave") [D names, 0x1028c4480].
- **Registration** [D]: a static init at 0x1028cae24.. registers the five
  compound types (name string + factory `adr x4` per type): AUltraAnalog →
  `SNewCompound<AUltraAnalog>` @0x1028b1688, chains @0x1028c0510/0x1028c3d90/
  0x1028c4404, envelope @0x1028c4824.
- **Code spans** (symbol brackets; all DSP/descriptor functions inside are
  anonymous): AUltraAnalog TU 0x1028b1688..0x1028c0510 (~64KB; largest
  anonymous fns 0x1028b66ec 16.5KB, 0x1028b30b4 10.8KB — registers the
  Live-12 mod-target display list ("Osc 1 Pitch" ref 0x1028b3c34) —,
  0x1028bddf8 9.7KB, 0x1028bc614 6KB, 0x1028b8464 7.5KB — registers the
  filter-type menu + drive-shaper names); chain TU 0x1028c0510..0x1028c3d90
  (env Loop menu refs AD-R/ADR-R/ADS-AR @0x1028c2d2c..); envelope TU
  0x1028c4824..0x1028c79ac; module static init 0x1028c888c..0x1028cbf80; a
  second device-unit parameter cluster 0x102894000..0x10289e000 (no frame
  pointers at all; "Unison Voices" 0x102897bc4, "LFO SyncRate" 0x102899714,
  filter-menu builder 0x10289bec0..0x10289c070) [D anchors, §2 evidence].
  **[CORRECTION 2026-10-09, tension lane]** this cluster is NOT Analog code:
  it sits inside the AStringStudio TU (0x102893660..~0x1028a9880) and
  references Tension's member keys/display names — an ADRP+ADD scan of all
  308 Analog mp* keys over 0x102893660..0x1028a28cc returns TOTAL=0
  (devices/tension-derivation.md §1, evidence/binary/tension-astringstudio-
  captures.txt §6).
- **The per-sample callback was NOT located** — honest residual (§4). The
  four decompiled megafunctions are descriptor/serializer functions (they
  reference display names and menus, not phase accumulators or coefficients).
  The A-framework dataflow (parameters → compound members via `AMember`
  updates, GUI strings "Global/Const/Prop" value classes) replaces the
  devicekit setter layer; where the render loop enters is corpus material.

## 2. The parameter/state ledger (surface + defaults from .adv; mp* names from binary)

Full tree: `evidence/devices/Analog/default.xml` (per-param `Manual` values =
factory defaults). Member-key census (`mp*` strings 0x104905d01..0x104906d97)
matches the XML names 1:1 after the `mp` prefix and case-normalization [D].

**Global** (defaults): Polyphony 3 ("Poly Voices" display [D]); PitchBendRange
0.1667 (semitones ×? stored fraction — ±2 st?); Volume 0.7048; PerNotePitchBendRange
48; ChannelPressureTarget1/2 + Amount1/2 0.5, MpeCC74Target1/2 + Amount1/2 0.5
(MPE two-target routing); Octave 0, Transpose 0, KeyboardFineTune 0.5;
KeyboardUnisonToggle false, KeyboardUnison 0, KeyboardDetune 0,
KeyboardUnisonDelay 0, KeyboardPriority 2, KeyboardStretch 0.5, KeyboardError 0
("Unison Voices/Detune/Delay/Key Priority/Key Stretch/Key Error" displays);
VibratoToggle false, VibratoSpeed 0.5, VibratoFadeIn 0, VibratoAmount 0,
VibratoError 0, VibratoDelay 0, VibratoModWheel 0; PortamentoToggle false,
PortamentoTime 0.5, PortamentoMode 0, PortamentoLegato false ("Glide");
NoiseToggle false, NoiseColor 0.5, NoiseBalance 1, NoiseLevel 0.8062
(Noise1/Noise2 are per-chain voices — NoiseBalance crossfades them [H]).

**Per chain** (SignalChain1 = chain n=1, SignalChain2 = n=2; defaults):
- Oscillator: OscillatorToggle true, **OscillatorWaveShape 1** (menu strings
  NOT located — residual), OscillatorOct 0, OscillatorSemi 0, **OscillatorMode
  0** (Sub vs Sync — displays "Osc n Sub Level" / "Osc n Sync Ratio" [D],
  "OSC n Sub/Sync Amount" knob [D]), OscillatorEnvTime 0.5, OscillatorDetune
  0.5, OscillatorModulation1 0.5, OscillatorPulseWidth 0.5, OscillatorSubAmount
  0, OscillatorBalance 1, OscillatorEnvAmount 0 (**the per-osc pitch env:
  "PEG n Time"/"PEG n Amount"/"OSC n Env Initial" displays; GUI compound
  `AAnalogPitchEnvelopeDisplay`** [D]), OscillatorLFOModPitch 0,
  OscillatorLFOModPW 0, OscillatorLevel 0.8062. "OSC n Keytrack" display [D]
  has no XML param — internal keytrack state [H].
- Filter: FilterToggle true/…, **FilterType 1 (chain1) / 0 (chain2)**,
  FilterDrive 1, FilterKbdCutoffMod 0, FilterCutoffFrequency 1, FilterKbdQMod
  0, FilterQFactor 0, FilterLFOCutoffMod 0, **FilterEnvCutoffMod 0.7048**
  (both chains — factory patch has the FEG opening the filter), FilterLFOQMod
  0, FilterEnvQMod 0.
- Amplifier: AmplifierToggle true/false, AmplifierKbdAmpMod 0,
  AmplifierLevel 0.4743, AmplifierKbdPanMod 0, AmplifierPan 0.5,
  AmplifierLFOAmpMod 0, AmplifierLFOPanMod 0, AmplifierEnvPanMod 0.
- LFO: LFOToggle false, LFOWaveShape 0, **LFOSync 13**, LFOSyncToggle 0,
  LFOGateReset false ("Retrigger"), LFOPulseWidth 0.5, LFOSpeed 0.5, LFOPhase
  0, LFODelay 0, LFOFadeIn 0. Sync-rate menu strings 1/2d..1/32t + "Hertz"
  [D, 0x10490525e..0x1049052a7]; "LFO SyncRate" member [D].
- Envelope.0 (FEG) / Envelope.1 (AEG), `AUltraAnalogEnvelope`: ExponentialSlope
  true, Loop 0, FreeRun false, Legato false, AttackMod 0, AttackTime 0,
  DecayTime 0.6, **AmpMod 0 (FEG) / 0.5 (AEG)**, SustainLevel 0.5,
  SustainTime 1, **ReleaseTime 0.4848 (FEG) / 0.5718 (AEG)**. Member keys
  mpExponentialSlope/mpLoop/mpFreeRun/mpLegato/mpAttackMod/mpAmpMod/
  mpSustainTime + ToggleDummy [D, 0x10490681f..0x10490686f]. Loop menu:
  **AD-R / ADR-R / ADS-AR** [D names 0x1049068f1..; enum order H].
- Chain 1 only: **FilterToFilter2 = 1** (chain 1 feeds chain 2's filter —
  series routing on by default); chain 2 only: FilterControllee false.

## 3. The mechanism, plainly (what the binary pins down)

- **Filter menu law** [D — objdump 0x10289bf48..0x10289c054, both sites;
  **site CORRECTED 2026-10-09**: that objdump anchor is AStringStudio's
  (Tension) filter-menu builder, not an AUltraAnalog site — the 10-entry law
  itself stands for both devices, Analog's own registration site remains to
  be re-anchored inside 0x1028b1688..0x1028c0510]:
  a 10-entry string array is built in fixed order and registered with
  count w2=10: **0 LP12, 1 LP24, 2 BP6, 3 BP12, 4 Notch 2-pole, 5 Notch
  4-pole, 6 HP12, 7 HP24, 8 Formant 6, 9 Formant 12** (full names
  "Low-pass 12dB/oct"… "Formant 12dB/oct" at 0x10490530f..0x1049053a8;
  short forms LP12/LP24/BP12/HP12/HP24 at 0x1049052e3). The .adv defaults
  (chain1=1 LP24, chain2=0 LP12) are consistent.
- **Drive shapers** [D names]: the filter Drive knob has six curve names —
  **Sym1, Sym2, Sym3, Asym1, Asym2, Asym3** (0x1049063c6..0x1049063e1) —
  symmetric vs asymmetric shapes; enum positions and closed forms residual.
- **Four envelope generators** (FEG1/AEG1 in chain 1, FEG2/AEG2 in chain 2 —
  the display census enumerates all four "FEG n/AEG n" name sets) [D],
  all the same `AUltraAnalogEnvelope` compound: stages A→D→S(SustainTime)→R
  with three Loop shapes (AD-R, ADR-R, ADS-AR), FreeRun, Legato,
  ExponentialSlope toggle, plus two velocity inputs: **AttackMod (vel→attack
  time) and AmpMod (vel→env amount)** [D names; curves residual]. The per-osc
  PEG is separate ("PEG n Time/Amount", "Env Initial") with its own GUI
  compound [D].
- **Mod routing is fixed-wiring, not a matrix**: per chain the sources are
  Key (kbd), Velocity (via AttackMod/AmpMod), LFO n, and Env n; the targets
  are exactly the Live-12 mod-display list captured in the evidence file:
  Osc Pitch / PW / Sub Level / Sync Ratio / Level / Balance, Filter Cutoff /
  Q, Amp Volume / Pan, each with its `<X> < Key | < LFO | < Env` depth param
  in the mp* set (mpFilterKbdCutoffMod / mpFilterLFOCutoffMod /
  mpFilterEnvCutoffMod and the Q and Pan trios, mpOscillatorLFOModPitch,
  mpOscillatorLFOModPW, mpOscillatorEnvAmount) [D names + display list].
- **Voice count model** [D names, H numbers]: two independent counts —
  Polyphony (device voices; default 3) and KeyboardUnison (unison voices per
  key, 0 = off), shaped by KeyboardDetune, KeyboardUnisonDelay,
  KeyboardPriority (2 = last-note-high? [H]), KeyboardStretch, KeyboardError;
  unison pairs with per-osc Detune (OscillatorDetune). The device refuses to
  load with zero instrument voices: `sErrorLimitationNumInstrumentUltraAnalogZero`
  (ref 0x10109ac4c) [D string + anchor].
- **Routing topology**: chain 1 → F1 → (FilterToFilter2) → F2 → chain 2 amp —
  series by default [H from the flag name + default 1; parallel alternative
  implied by the flag being settable]. Noise1/Noise2 join per chain with
  NoiseBalance [H]. MPE: two mod targets (Target1/Target2) for
  ChannelPressure and MPE CC74 each, amounts 0.5 [D surface].

## 4. What remains open (honest residuals — corpus material)

- **The render loop.** No per-sample callback located. The A-framework keeps
  DSP in anonymous code; candidates beyond the descriptor megafunctions:
  ~~the no-frame-pointer unit cluster 0x102894000..0x10289e000~~ [struck
  2026-10-09 — that range is Tension's AStringStudio TU, see the §1
  correction] and unreached code
  in the AUltraAnalog TU. Next lane's move: find the audio callback via the
  device-unit vtable/GOT pointers (0x105403xxx cluster) or a render-side
  distinctive constant, then close oscillator/filter/env laws.
- **Closed-form wave/curve laws**: oscillator wave shapes (menu strings not
  found — possibly icon-only; the same 10-string menu-array pattern will
  decode it at the registration site once found), the six Drive shaper
  equations, filter coefficient laws per the 10 types (12/24 dB cascade
  forms), PEG/FEG/AEG time mapping (stored 0..1 → seconds), AttackMod/AmpMod
  curves, KeyboardDetune/Stretch laws, Vibrato rate/depth laws,
  PortamentoTime mapping.
- **Enum orders**: OscillatorMode (Sub/Sync), OscillatorWaveShape, Loop
  (AD-R/ADR-R/ADS-AR ↔ 0/1/2), PortamentoMode, KeyboardPriority.
- **Voice management**: Polyphony max (8 per UI memory [H]), voice stealing,
  unison delay behavior, the "SelectedFinger"/MPE finger model.
- Everything above awaits the golden-render corpus (no renders this lane).

## 5. Confidence

- Class architecture, compound tree, code spans, menu laws (filter types),
  member/display-name census, .adv parameter surface + defaults: **high** —
  each claim is anchored in at least one raw capture (symbol table, objdump
  excerpt, string address, or the official XML) and most in two independent
  sources (XML ↔ mp* names ↔ display names agree).
- Mod-routing interpretation, unison/priority semantics, series-routing
  reading: **medium** — names are [D], the dataflow built on them is [H].
- Any DSP behavior claim: **none made** — nothing about the render loop,
  wave shapes, coefficients, or time scalings was decodable within this
  lane's timebox; graded residuals in §4 are corpus material, not buildable
  law.
