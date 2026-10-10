# Electric (ElectricDevice / ALoungeLizard) binary derivation — topology + parameter laws (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only) PLUS raw llvm-objdump and
the Analog lane's custom ADRP+ADD xref scan — required because **the Electric
code region is undisassembled virgin territory: zero functions, zero string
references** (FuncListProbe 0x1027ef000..0x102810000 TOTAL=0). Official
evidence: `App-Resources/Core Library/Defaults/Instruments/Electric.adv`
(gzip XML, root element `<LoungeLizard>`, Creator "Ableton Live 12.0.5d1").
Capture: `evidence/binary/electric-loungelizard-captures.txt`. Form follows
`analog-derivation.md` (this device is the Analog lane's A-framework compound
pattern, second instance); claims graded: **[D]** decompiled/disassembly-
confirmed (capture cited), **[B]** byte/const decoded, **[H]** unverified
hypothesis. NO Live, NO renders ran in this lane; per README every [D]/[B]
claim still awaits the golden-render cross-check before it gates a rebuild.

Electric is **not** a devicekit device: it is an old **A-framework compound**,
the AAS Lounge Lizard E-piano engine, internal class `ALoungeLizard` (LOM name
"Electric" — display string at 0x10490116b, device-key `KDeviceLoungeLizard`,
limitation string `sErrorLimitationNumInstrumentLoungeLizardZero`). Unlike
Analog (device + chains + envelope compounds), Electric registers exactly
**two** compounds: `ALoungeLizard` (factory 0x1028095ec, body 0x102809654) and
the GUI `ALoungeLizardView` (0x102e04144) — the DSP-bearing device is **one
flat compound with 32 direct members, no sub-compounds** [D, registration
block + .adv root].

## 1. What runs when (call topology, as far as this lane sees)

- **Registration** [D]: static module init at 0x102813ff8.. (one
  `CallStaticFunc` registration per compound; x1 = name string, x4 = factory
  body = `SNewCompound<T>+0x68`, the Analog lane's idiom): … ACorpus →
  **ALoungeLizard** (name 0x104901187, factory 0x102809654) …
- **Code spans** (symbol brackets; every function inside is anonymous):
  ALoungeLizard TU **0x1028095ec..0x10280d654** (~16.3 KB) [D]. Two walks
  inside it: the **member registration** 0x1028096a8..0x10280a720 (mp* key
  refs at a fixed stride of 0x78: mpKeyboardTranspose 0x10280988c …
  mpShowModToggle 0x10280a6a4, mpDummyPerNotePitchBendRange 0x10280a71c) and
  the **display/serializer walk** 0x10280ab24.. (device label "Electric"
  0x10490116b @0x10280ab24, "Voices" @0x10280abd8, "Pickup Model"
  @0x10280ac30, "Semitone"/"Detune"/"Keyboard Stretch"/"KB Stretch", then the
  full long+short display-name list 0x10280b280..0x10280baf0) [D].
- **View callbacks** [D symbols]: `ALoungeLizardView::OnFingerChanged` (0x102e0a708) and
  `OnZoneClicked(int)` (0x102e0a748), plus member `mpSelectedFinger` — the
  key-zone/finger selection model (same "SelectedFinger" MPE finger state the
  Analog lane reported), GUI-side.
- **The per-sample callback was NOT located** — honest residual (§4). The
  descriptor megafunctions are serializers (they reference display names and
  ranges, not phase accumulators). Where the render loop enters is corpus
  material (same open point as the Analog lane).

## 2. The parameter/state ledger (surface + defaults from Electric.adv; member keys from binary)

Full .adv surface: capture §8. Member-key census (32 mp* strings
0x104901195..0x1049013d6) matches the XML element names 1:1 after the `mp`
prefix [D]. Display names (long/short pairs) from the descriptor walk [D].

**Global** (defaults): On true; **Polyphony 30** ("Voices"; the binary
registration passes 0x1e=30 at 0x10280abf4 [B]); PitchBendRange 1 (stored
0..1 — unit open, cf. Analog's 0.1667 [H]); PerNotePitchBendRange 0 (0..48);
Volume 0.7047892213.
**Keyboard**: KeyboardTranspose 12 (0..24 semitones; binary constants at its
registration: max 24.0, default 12.0, `fmov s1/s2` @0x10280ad08..0x10280ad0c
[B]; display "Semitone"), KeyboardFineTune 0.5 ("Detune"), KeyboardStretch
0.5 ("Keyboard Stretch"/"KB Stretch").
**Mallet** (the exciter; display "Mallet Stiffness"/"M Stiffness" etc.):
MalletStiffness 0.5, MalletStiffnessKeyboard 0.5 (" < Key"),
MalletStiffnessVelocity 0.5 (" < Vel"); MalletForceStrength 0.5,
MalletForceKeyboard 0.5, MalletForceVelocity 0.5 ("Mallet Force"); Mallet
Noise: MalletNoisePitch 0.5, MalletNoiseDecay 0.5, MalletNoiseAmount 0.5,
MalletNoiseKeyboardScaling 0.5 (displays "Mallet Noise Pitch/Decay/Amount",
" < Key").
**Fork** (the resonating assembly; display "Fork …"/"F …"): ForkReleaseTime
0.5 ("F Release"), ForkTineDecay 0.5 ("F Tine Decay"), ForkTineVolume 0.5
("F Tine Vol"), ForkTineKeyboardScaling 0.5 (" < Key"), ForkTineColor 0.5
("F Tine Color"), ForkToneBarDecay 0.5 ("F Tone Decay"), ForkToneBarVolume
0.5 ("F Tone Vol").
**Pickup**: PickupSymmetry 0.5 ("P Symmetry"), PickupDistance 0.5
("P Distance"), **PickupModel 0 (enum — menu entry strings not found in the
string pool; icon-only menu, same residual as Analog's oscillator shapes)**,
PickupAmpIn 0.42, PickupAmpOut 0.42 ("P Amp In/Out"), PickupAmpKeyboardScaling
0.5 ("Pickup Amp < Key").
**Damper**: DamperTone 0.5 ("Damp Tone"), DamperAmount 0.5 ("Damp Amount"),
DamperBalance 0.5 ("Damp Balance").
**Internal, not automatable**: mpSelectedFinger, mpShowModToggle,
mpDummyPerNotePitchBendRange [D keys].
Names that look Electric but are NOT (Tension's cluster, do not conflate):
mpDamperMass/Damping/Stiffness/Gated/Toggle, mpGeoDamper* [D — different
string cluster].

## 3. The mechanism, plainly (what the binary pins down)

- **Model structure** [D names, H physics]: the flat member list reads as the
  Lounge Lizard physical E-piano in exciter → resonator → pickup order. The
  **mallet** (hammer) carries stiffness and force, each with independent
  key-scale and velocity trims, plus a separate noise component with its own
  pitch, decay, amount and key-scaling (the hammer thump). The **fork** is
  two coupled resonators — the **tine** (decay, volume, color, key-scaling)
  and the **tone bar** (decay, volume) — with one shared ForkReleaseTime for
  note-off release. The **pickup** is the readout model: position
  (Symmetry/Distance) and a Model enum, then an amp stage (AmpIn/AmpOut with
  key-tracking). The **damper** adds tone/amount/balance. Whether the mallet
  mechanics are ODE-solved or table-driven is NOT decodable here: no lookup
  tables are statically decodable anywhere in the span (all runtime/anon) —
  the compressor lane's "runtime-built LUT" caveat applies [D-negative].
- **No mod matrix** [D-negative]: unlike Analog/Collision there are no
  `< Key`-style depth members beyond the per-section key/velocity trims, and
  no LFO members; Electric's only external control surface is the MPE pair
  (PitchBendRange/PerNotePitchBendRange) and the two `On…`-style toggles the
  .adv carries.
- **Enum finds**: none new — PickupModel's menu is unresolved (above); all
  other Electric params are floats/ints. The shared AAS LFO sync-rate list
  (4d/4t/…/1/32t at 0x10490524c..0x1049052a7, "Hertz" appended) is registered
  by sibling devices (Tension/Collision), not by Electric — Electric has no
  LFO [D-negative].

## 4. What remains open (honest residuals — corpus material)

- **The render loop**: no per-sample callback located; candidates are the
  same as the Analog lane's — the device-unit parameter cluster around
  0x1028939f0/0x102897a38/0x102897dec (no-frame-pointer unit code that
  re-references mpKeyboardFineTune/"Semitone"/"Keyboard Stretch") and
  unreached code in the TU. Next lane's move: device-unit vtable/GOT hunt
  from the 0x105403xxx cluster or a render-side constant, then close the
  mallet/fork/pickup laws.
- **Closed-form laws**: all time/decay scalings (stored 0..1 → ms), tine
  color law, mallet stiffness/force response curves, noise pitch/decay maps,
  pickup position/symmetry geometry, damper law, KeyboardStretch/FineTune
  mapping, PitchBendRange unit (stored 0..1).
- **PickupModel enum** entries (menu registered without string-pool hits —
  icon-only?); **SelectedFinger** semantics (MPE finger state vs GUI zone
  selection).
- Everything above awaits the golden-render corpus (no renders this lane;
  COVERAGE row empty for Electric).

## 5. Confidence

- Class identity (ALoungeLizard = Electric), compound count, TU span,
  registration site, 32-member ledger, .adv surface + defaults, display-name
  census, Polyphony=30 / Transpose=12 (max 24) binary constants: **high** —
  each claim anchored in at least one raw capture (nm, objdump, ADRP+ADD hit,
  string address, or the official XML) and most in two independent sources
  (XML ↔ mp* keys ↔ display names agree).
- Section readings (mallet/fork/pickup/damper as exciter/resonator/readout),
  PitchBendRange unit, SelectedFinger semantics: **medium** — names are [D],
  the physical interpretation built on them is [H].
- Any DSP behavior claim: **none made** — nothing about the render loop, the
  mallet mechanics (ODE vs tables), or any scalar law was decodable within
  this lane's timebox; graded residuals in §4 are corpus material, not
  buildable law.
