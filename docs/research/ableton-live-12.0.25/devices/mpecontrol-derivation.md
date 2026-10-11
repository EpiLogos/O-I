# MPE Control binary derivation — negative result + the native MPE machinery (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
ModLaneProbe/SearchProbe/BlockProbe-pattern scripts, no re-import).
NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/midi-mod-lane-decompiles.txt` (existence searches, MPE
symbol/string census, full OnMidi decompiles of the MPE processors,
AMpeSettings ctor, dialog callbacks, on-disk bundle listing). Form follows
`compressor-derivation.md`; claims graded: **[D] decompiled-confirmed**
(capture cited), **[B] byte-decoded**, **[H] unverified hypothesis** — no
behavioral renders ran in this lane; per README every [D]/[B] claim still
awaits the golden-render cross-check before it gates a rebuild.

**Negative result first.** The MPE Control device — the brief's
"MPEControlDevice" — is **not a compiled device in Live 12.0.25**: it ships
as a bundled Max for Live patcher (`MPE Control.amxd`, 508,119 bytes,
App-Resources/Builtin/Devices/MIDI Effects/MPE Control/). Its UI/patcher law
is out of this lane. But the M4L device only *drives* MPE state that lives
natively — and that state machine IS in the binary and is fully derived
below: the **`AMpeSettings` zone model** (what the device writes), the
**MpeSettingsDialog** (the same zone config's native editor), and the four
engine processors that give the config its note-stream meaning
(**MpeDecoder / MpeEncoder / MpeFilter / TuningSystemToMpe**).

## 1. The negative result (what the binary says)

- **No processor class**: the 367-class registry has no MPE-control device
  class [D]. The MPE-named processors that DO exist are infrastructure:
  `OMpeDecoderProcessor`, `OMpeEncoderProcessor`, `OMpeFilterProcessor`,
  `OTuningSystemToMpeProcessor` [D].
- **No MPEControl symbol/string**: `mpecontrol` → 0 hits; the UI name **'MPE
  Control' exists once** (0x10490b7f2), in the browser device-name pool
  segment carrying the bundled M4L device names [D].
- **On disk**: `MPE Control.amxd` under MIDI Effects (filesystem evidence,
  no Live run) [D].

## 2. `AMpeSettings` — the zone config the device writes

The document model persists under the XML path **`/MpeSettings`** (element
name 'MpeSettings'; dialog 'Dialogs/MpeSettingsDialog'; menu 'MPE
Settings…') [D strings]. The compound (`SNewCompound<AMpeSettings>`
0x101d8c00c → alloc **0xa0 bytes** → ctor `FUN_101d8c308` [D]):

| offset | field | ctor default |
|---|---|---|
| +0x30 | zone-type enum property | **0** |
| +0x48 | first-note-channel property | **1** |
| +0x60 | last-note-channel property | **15** |
| +0x40/+0x58 | channel-list objects (picker sources) | init empty |
| +0x78 | undo-flank notifier, wired to `AMpeSettings::OnUndoFlankChanged` | registered |
| +0x88/0x90/0x98 | undo/state slots | 0 |

**Zone semantics** (from `AMpeSettingsDialog::OnZoneTypeEnumChanged`
0x102c877c4 [D]): zone-type **0** → first-note-channel picker forced to 1
and the pickers' enabled states swapped; zone-type **1** → last-note-channel
picker forced to 14 (index). The strings **'MPE Lower Zone'** /
**'MPE Upper Zone'** (0x1049243dc/0x1049243eb) are the two enum labels.
Cross-clamps: `OnFirstNoteChannelEnumChanged` raises first to last when
first < last… inverted-guard (`if first_val < last_val` → set first :=
last) and `OnLastNoteChannelEnumChanged` mirrors it [D code; the channel
index base (0- vs 1-based, i.e. whether "15" means MIDI channel 15 or 16)
[H — the ctor's first=1/last=15 pair and the dialog's 14 both appear; the
upper/lower polarity of enum 0/1 is likewise [H]].

This model is what the M4L MPE Control device manipulates through the Live
Object Model; its undo hook (`sManeuverTextChangeMpeSettings`) makes the
device's writes undoable steps [D strings, H on LOM call path].

## 3. The note-stream machinery (what the zone config does)

- **`OMpeDecoderProcessor`** (create 0x1018c1b20; `OnMidi` body 869 lines,
  captured in full [D]) — inbound MPE → internal note+dimension events.
  State: a **16-channel × 128-slot last-received-timestamp table** at
  +0x28 (stride 0x400 per channel, one qword per (channel, data byte)) [D];
  a per-channel note-on counter at +0x60e8+ch·4; per-voice dimension blocks
  (stride 0x20c from +0x4028, float-pair slots at 0x4068…0x4230 holding
  bend/press/timbre values with **FLT_MAX as the unset sentinel**) [D].
  Note-on: if the (channel,key) already holds a voice, the old voice is
  re-emitted (retrigger of stolen voice) before the timestamp is overwritten
  and the new note is either forwarded raw (flag +0x8 clear) or processed
  through the per-voice dimension interpolation/soft-takeover path [D
  topology; per-dimension mapping formulas not transcribed — the largest
  single body in the capture]. **`BeforeDisconnectMidi`** (0x1016d6470 [D]):
  walks all 16 channels × 128 keys and emits a synthetic note-off with
  velocity **0x42800000 = 64.0 f** for every live voice — the all-notes-off
  guard when a MIDI route drops.
- **`OMpeEncoderProcessor`** (create 0x1018c1bf8; `OnMidi` 330 lines [D]) —
  internal notes → outbound MPE stream. State: **16 member-channel slots**
  (+0x8·ch·0x10, each with a voice count), a pending-note vector at +0x108
  (**5 qwords per note**, count at +0x1508), a 16×32-bit channel-state
  table (+0x3138, 0x200 bytes) holding per-channel bend/pressure state with
  `0x8000000000000000` sentinels, and a mode int at +0x3358. Note-off:
  match by note id in the vector, pop-swap-remove, decrement the channel
  count, re-channel the event via `func_0x0001015f1758(event, channel)`, and
  stamp the clock sample time (`FUN_101551390(clock)+0x90`) [D]. **Mode
  select**: when +0x3358 == 1, every forwarded event is re-channned to
  **channel 15 (0xf)** — the force-one-channel fallback for non-MPE
  destinations [D code; exact UI meaning H]. Stop (case 6) clears all 16
  sentinels, the note vector, and the 0x200 channel table [D].
- **`OMpeFilterProcessor`** (create 0x1018c1cd0; `OnMidi` 0x1016e4134 [D]) —
  dedup/duplicate-suppression: a **128-bit "key already on" bitset array ×
  16 channels** (+0x408 region, plus a 16×128 presence table at +8, stride
  8) — a note already seen on a channel is swallowed until note-off clears
  the bit; `OnResetBang` memsets the bitsets to 0xff (all-clear) and the
  presence table to −1 [D]. Strings 'RecorderMpeFilter'/'CaptureMpeFilter'/
  'AuxMpeFilter' name its insertion points [D strings].
- **`OTuningSystemToMpeProcessor`** (create 0x101609b04 [D]) — retuning →
  MPE: per-note pitch-bend emission with the bend range stored as
  **`value/48.0`** (`OnPitchBendRange`, offsets clamped to a ±limit pair
  computed from a guard-initialized static) and per-voice records of stride
  **0x468** carrying a `TDelayedNote`/`TForwardedNote` variant (delayed
  notes wait for their bend to be deliverable) [D shape; the delay law is
  inside a jumptable-guarded body — open].
- **Who else touches the config**: `IsMpeEnabled`/`SetMpeEnabled`/
  `GetMpeEnabled` + `AMxDeviceUnit::OnMpeEnabledChanged` — **Max for Live
  devices carry an MPE-enabled flag**, the mechanism by which a Max MIDI
  effect (MPE Control included) participates in the MPE path; plugin side:
  `AuPlugin.GetSupportsMpe`, `OPlugin.NotifyPluginMpeEnabled`,
  `AThirdPartyMpeInstrumentUnit`/`AGenericThirdPartyMpeInstrumentUnit`
  [D symbols]. Instrument-side consumption: `MpePitchBend`/`MpeSlide`/
  `MpePitchBendRange`/`mpMpeCC74Target1/2`/`mpMpeCC74Amount1/2` (CC74 =
  the timbre dimension) on the sampler/operator families [D strings].

## 4. What remains open (honest residuals)

- The M4L device itself: its parameter set, how it maps UI to `AMpeSettings`
  writes, and its note-stream taps are patcher-internal [negative].
- Zone-enum polarity and the channel-index base (§2 [H] marks); the LOM call
  path from the device into the model.
- MpeDecoder's per-dimension interpolation/soft-takeover formulas (the 869-
  line body is captured; only topology transcribed), the
  TuningSystemToMpe delay law, MpeEncoder's channel-allocation policy (how
  the next member channel is chosen — the allocation function is called, its
  body not captured).
- Everything awaits the golden-render gate (README binding rule; no renders
  ran in this lane).

## 5. Confidence

- The negative result + M4L attribution: **high** (registry, strings,
  on-disk listing).
- `AMpeSettings` layout/defaults, the dialog zone/clamp behavior, the four
  MPE processors' state topologies and the documented laws (all-notes-off
  64.0 f, channel-15 force mode, filter bitsets, bend-range /48): **high**
  as decompile readings — single-source, exact bodies in the capture.
- Zone enum polarity, channel base, decoder dimension formulas, encoder
  allocation policy: **low-to-medium**, marked [H]/open above; do not gate
  a rebuild on them.
- No behavioral claim of any grade is made; the golden-render corpus for MPE
  does not exist yet (COVERAGE row empty).
