# Envelope Follower binary derivation — negative result + native name-collisions (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
ModLaneProbe/SearchProbe/BlockProbe-pattern scripts, no re-import).
NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/midi-mod-lane-decompiles.txt` (existence searches, browser
pool dump, registry census, compound xrefs). Form follows
`compressor-derivation.md`; claims graded: **[D] decompiled-confirmed**
(capture cited), **[B] byte-decoded**, **[H] unverified hypothesis** — no
behavioral renders ran in this lane; per README every [D]/[B] claim still
awaits the golden-render cross-check before it gates a rebuild.

**Negative result.** The Envelope Follower device — the brief's
"EnvelopeFollowerDevice", the audio-envelope → modulation/MIDI mapper — is
**not a compiled device in Live 12.0.25**. It ships as a bundled Max for
Live patcher (`Envelope Follower.amxd`, 295,929 bytes, App-Resources/
Builtin/Devices/Audio Effects/Envelope Follower/). Its detector law and
mapping are patcher-internal and out of this lane. What the binary DOES
hold are three unrelated things that share the name — this doc pins them so
no rebuilder chases the wrong object.

## 1. The negative result (what the binary says)

- **No processor class**: the 367-class `SOnProcessorCreate` registry has no
  envelope-follower device class; the MIDI-FX set is exactly the velocity
  lane's list [D].
- **No EnvelopeFollowerDevice symbol**: 0 symbol hits for the class name [D].
- The UI name **'Envelope Follower' exists once** (0x10490b7d2) — in the
  browser device-name pool segment whose neighbors are the other bundled M4L
  devices ('Envelope MIDI', 'MPE Control', 'Note Echo', 'Expression
  Control', 'MIDI Monitor', 'Shaper MIDI') [D].
- **On disk** (filesystem evidence, no Live run): `Envelope Follower.amxd`
  under Audio Effects, build date Aug 26 2024 = the binary's own stamp [D].

## 2. The three native name-collisions (what NOT to confuse it with)

- **`ableton::devices::shifter::model::EnvelopeFollower`** — the **Shifter
  audio effect's built-in env-follower modulation section**. Model surface:
  `On, Attack, Release, AmountHz, AmountPitch` (property singletons:
  `SValueConverterForProperty`/`SStringConverterForProperty` instantiations
  at 0x1057e6f88…0x1057e7010 [D]). It maps the detected envelope to a pitch
  or Hz offset **inside Shifter** — there is no MIDI output and no parameter
  routing. Its runtime DSP law sits inside Shifter's uncaptured block
  renderer and is already logged as an open residual there
  (`shifter-derivation.md` §3/§4). This is the ONLY compiled
  envelope-follower DSP surface in the binary [D for the surface; law open].
- **`AEnvelopeFollower` / `AEnvelopeFollowerView`** — app-domain compound +
  view registered in the compound factory table (`SNewCompound<…>` symbols
  0x10222b304/0x102d7a21c; their only xrefs are DATA entries in the factory
  table — no code calls them [D]). Document/UI scaffolding for the Shifter
  section's panel [H on role], not a detector.
- **Envelope-adjacent registry classes** that are *not* followers:
  `OAudioNoteEnvelopeProcessor` (clip/audio-note envelopes),
  `OAdsrEventProcessor`/`OAdsrFilterProcessor` (Operator-family ADSRs),
  `OSignalAnalyzerProcessor` (analysis). None maps an audio envelope to MIDI
  [D registry, H on the analyzer's role].

## 3. What a native detector law looks like here (rebuilder's pointer)

No native audio→**MIDI** envelope mapping exists anywhere in the binary:
the only MIDI-out event paths in the create registry are
`OMidiOutProcessor` (with an `OnInMpe` input), the inter-domain MIDI
connection writers, and the feedback/translation processors — none consumes
an audio detector [D registry census]. The corpus's exemplar **detector
law** (envelope from audio) is the Compressor's: MAD of the sidechain pair
into a two-stage attack/release follower (`compressor-derivation.md` §3) —
that shape (not any Envelope-Follower-specific code) is the closest
in-binary reference for rebuilding the M4L device's detector. The M4L
device's actual law — its detector mode, mapping curve, MIDI CC/note target
wiring — lives in `Envelope Follower.amxd` and needs a patcher-decode lane.

## 4. What remains open (honest residuals)

- The M4L device's detector law and its modulation/MIDI mapping: out of
  binary scope, untouched [negative].
- Shifter's EnvelopeFollower runtime law (how Attack/Release shape the
  follower, how AmountHz/AmountPitch scale the offset): owned by the Shifter
  lane's residual list, not re-derived here.
- `AEnvelopeFollower`'s exact role and the `OSignalAnalyzerProcessor`'s
  consumer: [H], unchased.
- Everything awaits the golden-render gate (README binding rule; no renders
  ran in this lane).

## 5. Confidence

- The negative result and the M4L attribution: **high** — registry census,
  string/symbol searches, browser-pool segment, on-disk bundle listing; all
  captured.
- The name-collision inventory (Shifter model surface, converter singletons,
  compound factory registration): **high** as readings, exact addresses
  cited.
- Role attributions marked [H]: **low**, do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  this device does not exist yet (COVERAGE row empty).
