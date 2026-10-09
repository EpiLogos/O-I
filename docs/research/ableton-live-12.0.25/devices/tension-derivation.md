# Tension (AStringStudio) binary derivation — topology + parameter laws (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only) PLUS raw llvm-objdump and
the analog lane's ADRP+ADD xref scan (`/tmp/adrp_scan.py`, reused; TEXT base
0x100000000 = file offset 0). Official evidence:
`evidence/devices/Tension/default.xml` (factory `Tension.adv`, gzip XML, root
element `<StringStudio>`, Creator "Ableton Live 12.0.5d1"). Capture:
`evidence/binary/tension-astringstudio-captures.txt`. Form follows
`analog-derivation.md` (third instance of the AAS A-framework family).
Claims graded: **[D]** decompiled/disassembly-confirmed (capture cited),
**[B]** byte/const decoded, **[H]** unverified hypothesis. NO Live, NO renders
ran in this lane; per README every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

Tension is **not** a devicekit device: it is the A-framework compound
**`AStringStudio`** — the AAS String Studio VS string-physics engine (LOM name
"Tension", display string 0x104901174; device-type registry pair
"StringStudio"/"Tension" built at 0x100d80b24/0x100d80b44). The brief's guess
"ATension?" is wrong: `AStrum*` symbols (`AStrumAlgorithm`,
`OnStrumTension`) are the MIDI-tools strum engine, a different feature. The
string model reads plainly from the member ledger: exciter (bow / hammer /
plectrum), geometry (excitator + damper positions), string (damping, decay,
inharmonicity), termination (finger + fret), pickup, body (corpus), plus
LFO/filter/FEG — with every physical parameter carrying `KbdMod`/`VelMod`/
`LFOMod`/`EnvMod` depth twins.

**Owned gap found on arrival:** the region `analog-derivation.md` §1 calls "a
second device-unit parameter cluster 0x102894000..0x10289e000" and the
filter-menu objdump its §3 cites (0x10289bf48..0x10289c054) are **inside this
device's TU and reference Tension strings** — an ADRP+ADD scan of all 308
Analog member keys (0x104905d01..0x104906d97) over 0x102893660..0x1028a28cc
returns **TOTAL=0** [D]. The 10-entry filter-menu law in that doc still stands
(both AAS filter menus share the same list), but its objdump anchor is
Tension's site; corrected in place there.

## 1. What runs when (call topology, as far as this lane sees)

- **One flat compound, no sub-compounds** [D — registration + .adv root]:
  `AStringStudio` registers once (CallStaticFunc: x1 = "AStringStudio"
  0x104904370, x4 = `SNewCompound<AStringStudio>`+0x68 = 0x1028936c8, static
  init at 0x1028a97e8..0x1028a9820). Unlike Analog (device + chains +
  envelope compounds) and like Electric, the DSP-bearing surface is one flat
  member set; the GUI compounds are separate (`ATensionFilterXyControl`
  0x102d4d898 — the filter XY control, `ATensionAdsrEnvelopeDisplay`
  0x102d4ce38). A `FilterBiquadParam(int, TBiquadParameter)` callback is
  registered on the device class [D, 0x1028a2dc8] — the filter is biquad-
  cascade based [H on the cascade shape].
- **Code spans** (symbol brackets; every function inside is anonymous):
  AStringStudio TU **0x102893660..~0x1028a9880** (~92 KB) [D]. Walks inside
  it: the **member registration walk** 0x102893810 (mpOctave) ..
  0x1028969bc (mpSlideRange2), ~0x78 stride [D]; the **display walk**
  0x102897b80 ("Keyboard Fine Tune") .. 0x10289a4c4 ("Body Mix") [D]; the
  **menu builder block** 0x10289b600..0x10289c240 [D, §2]; the **mod-target
  list** 0x10289c308..0x10289c45c [D]; secondary "Exciter …" display walks at
  0x10289acac..0x10289ae8c and 0x10289dcec..0x10289de44 [D — second naming
  pass, likely the device-unit/serializer pair]. Large anonymous blocks
  follow (call targets land up to 0x1028a78a4+) — the only DSP-candidate
  region this lane saw.
- **The per-sample callback was NOT located** — honest residual (§4), same
  shape as the Analog/Electric lanes: the megafunctions in the span are
  descriptor/serializer/menu code; where the render loop enters is corpus
  material.

## 2. Menu laws (all [D] — objdump, adder 0x100fc0898, registrar
0x100234db8(x0, x1, w2); evidence capture §4)

- **ExcitatorType, w2=4**: 0 Bow, 1 Hammer, 2 Hammer (bouncing), 3
  Plectrum. Built 0x10289b604..0x10289b65c; registered to descriptor global
  0x10595e868; **conditional** on global 0x10595e700 (cbz skips the menu).
- **LFOWaveShape, w2=5**: 0 Sine, 1 Tri, 2 Rect, 3 Random 1, 4 Random 2
  (0x10289b6d0..0x10289b754).
- **LFOSync, w2=24** (0x10289b8c4..0x10289bb34): the 24-entry AAS sync list —
  dotted/plain/triplet triplets per division: `4d 4 4t | 2d 2 2t | 1d ""(=1)
  1t | 1/2d 1/2 1/2t | 1/4d 1/4 1/4t | 1/8d 1/8 1/8t | 1/16d 1/16 1/16t |
  1/32d 1/32 1/32t`. Eight entries come from a shared AAS string pool, eight
  dotted/plain forms from Tension's own cluster. Index 13 ("1/4") is the
  .adv default.
- **LFO Speed unit, w2=2**: Hertz, Beat (0x10289bcac..0x10289bcdc) — the
  unsynced-rate unit pair.
- **FilterType, w2=10** (short names 0x10289bdb0..0x10289be9c, registered
  w2=10 at 0x10289beb4; long names 0x10289bf4c..0x10289c038): 0 LP12, 1 LP24,
  2 BP6, 3 BP12, 4 Notch 2-pole, 5 Notch 4-pole, 6 HP12, 7 HP24, 8 Formant 6,
  9 Formant 12 — the same 10-entry law the analog lane decoded; see the
  attribution correction above.
- **BodyType, w2=4**: 0 Piano, 1 Guitar, 2 Violin, 3 Generic
  (0x10289c0e8..0x10289c150).
- **BodySize, w2=5**: 0 XS, 1 S, 2 M, 3 L, 4 XL (0x10289c1b8..0x10289c23c).
- One more 5-entry **int-valued menu** (entries 0, 2, 1, 4, 5, built via a
  value→string helper 0x1027d9598; w2=5 at 0x10289b858; conditional on global
  0x10595e710) — binding unresolved, residual.
- **Mod-target display list, w2=13** (0x10289c308..0x10289c45c, attached to
  0x10595e958): 0 None, 1 Voice Volume, 2 Vibrato Amount, 3 Vibrato Speed,
  4 Unison Detune, 5 String Inharmon., 6 LFO Rate, 7 F. Cutoff,
  8 F. Cut. LFO Depth, 9 F. Cut. Env Depth, 10 F. Q, 11 F. Q LFO Depth,
  12 F. Q Env Depth. This is the Live-12 mod-indicator target set; the XML
  MPE routing (below) stores targets as indices into it [H — index↔target
  mapping not independently decoded].

## 3. The parameter/state ledger (surface + defaults from Tension.adv; mp* names from binary)

Full tree: `evidence/devices/Tension/default.xml`. Member-key census
(0x10490437e..0x104904af4, plus mpPortamentoTime at 0x104928f69) matches the
XML names 1:1 after the `mp` prefix; all 322 wanted strings reffed inside the
TU, 0 misses [D].

**Global/keyboard** (defaults): Polyphony 4; PitchBendRange 2; Octave 0;
Transpose 0; KeyboardFineTune 0.5; KeyboardPriority 0; KeyboardUnisonToggle
false; KeyboardUnison 0; KeyboardDetune 0; KeyboardUnisonDelay 0.5;
KeyboardStretch 0.5; KeyboardError 0 ("Unison Voices/Detune/Delay/Key
Priority/Key Stretch/Error" displays [D]).
**Vibrato**: Toggle false, Speed 0.5, FadeIn 0.5, Amount 0.5, Error 0.5,
Delay 0.5, ModWheel 0.5 ("Vibrato < ModWheel").
**Portamento**: Toggle false, Time 0.5, Proportional false (Tension-only
flag among the AAS four), Legato false.
**Geometry** (`mpGeo*` — the string's physical layout): ExcitatorPosition
0.5 + Absolute false + KbdMod 0 + VelMod 0; DamperPosition 0.5 + Absolute
false + KbdMod 0 + VelMod 0 ("Excitator/Damper Position", "… Absolute",
"< Key", "< Vel").
**Excitator** (the energy input): Toggle true, **Type 3 (Plectrum)**,
ParameterX 0.5 (+Kbd/Vel 0), Stiffness 0.5 (+Kbd/Vel), Velocity 0.5
(+Kbd/Vel), Damping 0.5 — 4-type menu above; ParameterX is the per-type
extra control (bow pressure / hammer mass …) [H reading].
**Pickup**: Toggle false, Position 0.5.
**Damper**: Toggle false, Mass 0.5 (+Kbd), Stiffness 0.5 (+Kbd), Velocity
0.5 (+Kbd), Damping 0.5, **Gated** false (damper acts only on note-off [H]).
**String**: Damping 0.5 (+Kbd), **Decay 1**, DecayKbdMod 0, DecayRatio 0.5,
Inharmonicity 0.5.
**Termination**: Toggle false, FingerStiffness 0.5, FingerForce 0.5
(+Kbd/Vel), FretStiffness 0.5.
**LFO**: Toggle false, WaveShape 0 (Sine), **Sync 13**, SyncToggle 0, Delay
0.5, Speed 0.5, FadeIn 0.5.
**Filter**: Toggle true, **Type 1 (LP24)**, CutoffFrequency 1, QFactor 0,
each with Kbd/LFO/Env depth members (Cutoff + Q × Kbd/LFO/Env — six depth
twins) [D names].
**FilterEnvelope (FEG)**: Toggle false, Attack 0, Decay 0.5, Sustain 0.5,
Release 0.5, **AttackMod 0** (vel→attack), **AmpMod 0** (vel→amount) — the
same two velocity-input shape the Analog FEG/AEG carry [D names].
**Body** (the corpus resonator): Toggle false, Type 0 (Piano), Size 2 (M),
Decay 0, LowCut 0, HighCut 0, **Level 0.7049999833**, Mix 0.5.
**MPE**: PerNotePitchBendRange 48; ChannelPressureTarget1 **5**, Range1 0.25;
ChannelPressureTarget2 0 (None), Range2 0.5; SlideTarget1/2 0, Ranges 0.5 —
factory patch routes channel pressure to mod-target 5 ("String Inharmon."
under the §2 list reading [H]).
Display-name note: the pool carries TWO naming passes ("Excitator …" and
"Exciter …"; "Exc Protrusion" vs "Excitator Force") — an older AAS surface
and the Live UI surface coexist in the strings [D strings, H why].

## 4. What remains open (honest residuals — corpus material)

- **The render loop**: no per-sample callback located. Candidates: the large
  anonymous blocks in the TU tail (0x1028a2dc8..0x1028a9880, call targets to
  0x1028a78a4+), and the device-unit vtable/GOT hunt the Analog lane sketched.
- **Closed-form laws**: string damping/decay/inharmonicity maps (stored 0..1
  → physical units), excitator per-type ParameterX semantics, damper mass/
  stiffness/damping response, termination finger/fret stiffness, body corpus
  response (Type×Size → IR/filter set — runtime data, not statically
  decodable), filter cutoff/Q scalings, FEG time mapping, Vibrato/
  Portamento(Proportional) laws, KeyboardStretch/Detune/UnisonDelay laws.
- **Enum orders [H]**: ExcitatorType (menu order = enum order assumed),
  BodyType/BodySize, LFOWaveShape; the 5-entry int menu (0,2,1,4,5) binding.
- **MPE target-id ↔ mod-target-list mapping** (Target1=5 reading above).
- **Global 0x10595e700/0x10595e710** menu conditionals (feature flags?).
- Everything above awaits the golden-render corpus (no renders this lane).

## 5. Confidence

- Class identity (AStringStudio = Tension), flat-compound architecture,
  registration site, TU span, member/display walks, all seven menu laws
  (counts + entries + addresses), mod-target list, member-key ↔ XML 1:1
  census, .adv surface + defaults: **high** — each claim anchored in at least
  one raw capture (nm, objdump, ADRP+ADD hit, string address, or the official
  XML) and most in two independent sources (XML ↔ mp* keys ↔ display names
  agree).
- The analog-derivation attribution correction: **high** — 308-key scan
  TOTAL=0 over the region, plus positive Tension refs at the same addresses.
- Physical readings (exciter/geo/string/termination/pickup/body as the AAS
  String Studio chain), ParameterX and DamperGated semantics, MPE target
  reading: **medium** — names are [D], the physics built on them is [H].
- Any DSP behavior claim: **none made** — nothing about the render loop or
  any scalar law was decodable within this lane's timebox; graded residuals
  in §4 are corpus material, not buildable law.
