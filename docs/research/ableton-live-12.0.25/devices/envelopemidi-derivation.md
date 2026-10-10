# Envelope MIDI binary derivation — negative result (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
ModLaneProbe/SearchProbe/BlockProbe-pattern scripts, no re-import).
NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/midi-mod-lane-decompiles.txt` (existence searches, browser
pool dump, registry census, on-disk bundle listing). Form follows
`compressor-derivation.md`; claims graded: **[D] decompiled-confirmed**
(capture cited), **[B] byte-decoded**, **[H] unverified hypothesis** — no
behavioral renders ran in this lane; per README every [D]/[B] claim still
awaits the golden-render cross-check before it gates a rebuild.

**Pure negative result.** The Envelope MIDI device — the brief's
"EnvelopeMIDIDevice", the drawn-envelope → MIDI mapper — **does not exist
as a compiled device in Live 12.0.25**. It ships as a bundled Max for Live
patcher (`Envelope MIDI.amxd`, 310,267 bytes, App-Resources/Builtin/Devices/
MIDI Effects/Envelope MIDI/). There is no native machinery behind it to
derive: unlike MPE Control (whose zone model is native,
`mpecontrol-derivation.md`), the drawn-envelope → MIDI mapping is entirely
patcher-internal. This doc records the evidence and the consequence.

## 1. The negative result (what the binary says)

- **No processor class**: the 367-class `SOnProcessorCreate` registry has no
  envelope-MIDI class; the MIDI-FX set is exactly the velocity lane's list
  [D].
- **No symbol/string trace**: `envelopemidi` → 0 string hits, 0 symbol hits.
  The UI name **'Envelope MIDI' exists once** (0x10490b7e4, len 14) — in the
  browser device-name pool segment whose neighbors are the other bundled M4L
  MIDI devices ('Envelope Follower', 'MPE Control', 'Note Echo', 'Expression
  Control', 'MIDI Monitor', 'Shaper MIDI') [D, evidence §2].
- **No devicekit model**: the `ableton::devices::*` namespace census (18
  namespaces) contains nothing envelope-MIDI-like [D].
- **On disk** (filesystem evidence, no Live run): `Envelope MIDI.amxd`
  under MIDI Effects, build date Aug 26 2024 = the binary's own stamp [D,
  evidence §8].

## 2. Where a drawn envelope could have lived — and why it doesn't

- The native clip/automation envelope machinery exists (AutomationTarget/
  ModulationTarget elements in every device XML; `OAudioNoteEnvelopeProcessor`
  in the registry for audio-note envelopes) — but that is the *document*
  envelope system, not a MIDI-out mapper [D registry; H on the processor's
  exact role].
- The only native paths from engine events to MIDI output are
  `OMidiOutProcessor` (+ `OnInMpe`), the inter-domain MIDI connection
  writer/reader pair, and the feedback/translation processors — none
  consumes a drawn envelope [D registry census].
- The M4L device's law — envelope drawn in its UI, how it samples that
  envelope (sync/free), what it emits (notes? CC? per which channel), its
  gate/retrigger behavior — is all inside `Envelope MIDI.amxd` [negative].

## 3. Consequence for rebuilders

No binary derivation of Envelope MIDI is possible from this target. If a
rebuild needs parity, the derivation target is the bundled .amxd (a Max
patcher decode — a different lane with different tooling, same disposition
as Note Echo in `velocity-noteecho-derivation.md` §3). The one native hook
the device necessarily uses is the Max MIDI-effect bridge
(`AMxDeviceUnit`, including its MPE flag — see
`mpecontrol-derivation.md` §3), so the *transport* of its output is
derivable natively even though its law is not.

## 4. What remains open (honest residuals)

- Everything about the device's own behavior (drawn-envelope sampling law,
  output mapping): [negative] — in the .amxd.
- `OAudioNoteEnvelopeProcessor`'s exact role: [H], unchased in this lane.
- No behavioral claim of any grade is made; the golden-render corpus for
  this device does not exist yet (COVERAGE row empty).

## 5. Confidence

- The negative result and M4L attribution: **high** — four independent
  lines (registry census, string/symbol zero-hits, browser-pool segment,
  on-disk bundle listing), all captured.
- The transport-hook observations: **medium** — registry-level facts,
  exact symbols cited; per-path semantics unchased.
- No behavioral claim of any grade is made.
