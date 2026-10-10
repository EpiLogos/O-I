# Chord + Pitch + Scale binary derivation (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SymProbe/BlockProbe/DataProbe, no re-import). NOT FOR REDISTRIBUTION. Never
enters product source (`packages/live-dynamics`). Companion capture:
`evidence/binary/chord-pitch-scale-decompiles.txt` (symbol tables, ctors,
all setter bodies, const-pool decodes, NoteLength table for cross-reference).
Form follows `compressor-derivation.md`; claims graded: **[D]
decompiled-confirmed**, **[B] byte-decoded**, **[H] unverified hypothesis** —
no behavioral renders ran in this lane; per README every [D]/[B] claim still
awaits the golden-render cross-check before it gates a rebuild.

One doc, three devices — they are siblings in the classic MIDI-FX family and
share the shell:

- Chord = `OMidiChordProcessor` (UI "Chord"; view classes `AMidiChordUnit`,
  `AMidiChordModule`, learn flow `AMidiChordModule.LearnChord`)
- Pitch = `OMidiPitcherProcessor` (UI "Pitch"; internal name "Pitcher")
- Scale = `OMidiScaleProcessor` (UI "Scale")

All three register through `OProcessorCreateManager::SOnProcessorCreate<…>`
→ a per-device builder → a ctor that builds ONE flat state object and
returns it [D]. **None of the three has an `OnMidiEvent` thunk**: their
`SProcessorFunc` tables contain only parameter setters + `Exit` +
`ScaleAndTuning` [D, symbol tables in evidence §1]. MIDI enters through the
shared `OMidiFxShellProcessor::OnMidi` (0x1016cd5b0), which switches on the
event kind and forwards through a stored callback pair (shell+0xc38/0xc40)
that is `kNullCallback` at ctor time — installed later by the device attach
path [D for the null init; the install site and the per-device transform
functions are **not symbolized** and were not located in this lane — §4].

## 1. Chord (`OMidiChordProcessor`)

**Parameters (setter inventory, evidence §1)**: On, Shift1–6,
ShiftScaleDegrees1–6, Velocity1–6, Chance1–6, Strum, StrumTension,
StrumCrescendo, PlayDuplicateNotesWhenStrumming,
SendPerNoteEventsToGeneratedNotes, Learning, UseScales, ScaleAndTuning,
Exit. The flip/push property names match (`ShiftScaleDegrees1`, `Chance1`…
strings at 0x1048c7e35 ff [B]).

**Ctor** `FUN_1016c5c04` (builder 0x1018c0834, create 0x1018c07f8) [D]:
zeroes the state region (+0x30…0xc38), builds a sub-object at +0x30
(`func_0x0001016cf3d4`), sets **+0xce8 = 7** (read as chord-slot count incl.
the original note [H]), allocates 28 B (7 × int — per-slot note ids [H]),
allocates 0x2000 B and zeroes +0x1a4…0x227b4 (0x21010 B — the per-key
learned-chord store [H on layout]), then defaults: Shift1–6 all **1**
(`memset_pattern16` from const 0x104d0e070, six int32 = 1 [B — small-int
interpretation open]); Velocity1–6 all **1.0 f**; Chance1–6 all **1.0 f**
(NEON `fmov 0x3f800000` [D]).

**Setter laws (exact, [D])**:

| slot | writer law |
|---|---|
| +0xc60 | On (bool) |
| +0xc64 + 4·k (k=0..5) | Shift(k+1) ← `(int)v` (semitones, int-truncated) |
| +0xc7c + 4·k | ShiftScaleDegrees(k+1) ← `(int)v` (scale degrees, int) |
| +0xc94 + 4·k | Velocity(k+1) ← raw float |
| +0xcac + 4·k | Chance(k+1) ← raw float |
| +0xcc4 | Strum ← raw float |
| +0xcc8 | StrumTension ← `v / 100.0` (UI % stored as fraction) |
| +0xccc | StrumCrescendo ← `v / 100.0` |
| +0xcd0 | PlayDuplicateNotesWhenStrumming (bool) |
| +0xcd1 | SendPerNoteEventsToGeneratedNotes (bool) |
| +0xcd2 | Learning (bool) |
| +0xce4 | UseScales (bool) |
| +0xcd8 / +0xce0 / +0xcd3 | ScaleAndTuning: scale-object ptr / root-note int / has-scale bool |

**Dirty flag**: every definition-affecting setter (Shift×6,
ShiftScaleDegrees×6, PlayDuplicate…, UseScales) and Strum-on-sign-change
sets the recompute byte **+0xd00** [D] — the chord definition is rebuilt
lazily, not per-setter.

**Shift/transpose arithmetic**: the stored shifts are plain ints; the
chromatic-vs-scale-degree selection is the UseScales flag + which slot pair
is consumed. The add-to-note arithmetic itself lives in the unsymbolized
note transform (not captured — §4). The ScaleAndTuning pair is the same
walk used by Arp/Scale: the global scale list (entries stride 0x50, scale
object ptr at entry+0x18) is searched for the incoming scale object [D].

## 2. Pitch (`OMidiPitcherProcessor`)

**Parameters**: On, Pitch, PitchScaleDegrees, Lowest, Range, RangeMode,
StepWidth, StepWidthScaleDegrees, StepUp, StepDown, UseSongScale,
ScaleAndTuning, Exit.

**Ctor** `FUN_1016cbd64` (builder 0x1018c115c, create 0x1018c1120) [D]:
defaults from const pool [B]: **Pitch(+0xc50) = 0**, **Lowest(+0xc58) = 0**,
**Range(+0xc5c) = 127**, **RangeMode(+0xc60) = 0**, **StepWidth(+0xc64) =
12**; UseSongScale/has-scale +0xc6c = 1.

**Setter laws (exact, [D])**: Pitch +0xc50, PitchScaleDegrees +0xc54,
Lowest +0xc58, Range +0xc5c, RangeMode +0xc60, StepWidth +0xc64,
StepWidthScaleDegrees +0xc68 — all `(int)v` raw; UseSongScale +0xc6c bool;
ScaleAndTuning +0xc70/+0xc78/+0xc6c (ptr/root/has, same as Chord);
StepUp toggle +0xc7c bool; On +0xc7d bool.

**The one captured piece of transpose arithmetic** — the manual Step
buttons (thunks 0x1016cd874 / 0x1016cd878, exact [D]):

```
StepUp:   if (!StepUpToggle(+0xc7c)) newPitch = clamp(Pitch + StepWidth,  -127?..127)
StepDown: if (!StepUpToggle(+0xc7c)) newPitch = clamp(Pitch - StepWidth,  -127?..127)
```

— chromatic semitone add/sub of the **int** slots, clamped to ±0x7f (clamp
branch bodies truncated in the capture; bound reading ±127 [H]). The
scale-degree variants (PitchScaleDegrees/StepWidthScaleDegrees) are
consumed only when UseSongScale is active — selection not captured [H].

## 3. Scale (`OMidiScaleProcessor`)

**Parameters**: On, Base, InternalScale, UseSongScale, Transpose, Range,
Lowest, Fold, UserMapping0–11, ScaleAndTuning, Exit.

**Ctor** `FUN_1016d1b70` (builder 0x1018c14b8, create 0x1018c147c) [D]:
InternalScale(+0xc54) written via its setter's +1 offset (below); has-scale
+0xc5c = 0; **default scale object pointer +0xc60 = 0x1058f00e0** (a static
global — the built-in default scale table object [D; contents not decoded]);
twelve float-callback slots +0x196…+0x1c0 region (per-key feedback
callbacks [H]); `memset_pattern16(+0xc7c, const, 0x30)` — six 16-byte
vectors over the UserMapping region.

**Setter laws (exact, [D])**:

| slot | writer law |
|---|---|
| +0xc50 | Base ← `(int)v` (root note) |
| +0xc54 | InternalScale ← `(int)v − 1` — **stored offset by one**; enum 0 = "no internal scale" → −1; also sets/clears dirty byte +0xc58 |
| +0xc5d | UseSongScale (bool) |
| +0xc6c | Transpose ← `(int)v` |
| +0xc78 | On (bool) |
| +0xc70 / +0xc74 | Lowest / Range ← `(int)v` |
| +0xcac | Fold (bool) |
| +0xc7c + 4·k (k=0..11) | UserMapping0–11 ← `(int)v` — **the 12 user slots are int per-semitone mappings** |
| +0xc5c/+0xc60/+0xc68 | ScaleAndTuning: has-scale / scale-object ptr / root int |

**Scale table storage — the lane's question.** Three layers, all evidenced:

1. **User slots**: 12 ints in the device state (+0xc7c…+0xca8), written by
   UserMapping0–11 [D]. This IS the user-scale storage at the processor
   level; the song-level user scales (edited in the Scale UI) travel
   through ScaleAndTuning [D for the transport; song-side persistence is
   flip-model, not decoded here].
2. **Factory scales**: NOT stored in the device. The InternalScale param is
   an index; the actual note tables come from the global scale system — the
   same list walked by ScaleAndTuning in all three devices: entries stride
   0x50, object ptr at entry+0x18, list end at `listBase + 0xaf0` (so at
   most 0xaf0/0x50 = 35 entries [D on the walk; the factory table contents
   live behind `func_0x000103b51cb4`'s global — not decoded this lane]).
   The shared global processor `OScaleAndTuningTableProcessor` exists in
   the create registry [D, symbol table] — the natural owner of the
   song-wide scale+tuning tables.
3. **Scale selection feedback**: when the incoming scale is found at list
   index i, the device reports `−i` (float, −1.0 if absent) through a
   stored callback, and the root note through another [D — same code in
   Arp `OnScaleAndTuning`; exact remoteable target open].

## 4. What remains open (honest residuals)

- **The note-transform bodies** for all three devices (how Shift/Velocity/
  Chance gates are applied per note-on; Pitch's clamp bounds and
  scale-degree conversion; Scale's Lowest/Range/Fold fold loop). They are
  unsymbolized and were not located in this lane: the shell dispatch
  (0x1016cd5b0) forwards to a callback pair installed outside the captured
  bodies. Next-lane move: xref the state-slot writes (e.g. Chord +0xc94
  reads) to find the consuming functions, or catch the transform via the
  shell's vtable at 0x10528b7f8/0x10528b848.
- **Factory scale table contents** (the ≤35-entry global list behind
  `func_0x000103b51cb4`; default object 0x1058f00e0).
- **Chance semantics** (probability gate vs random drop) — state and
  defaults captured, mechanism not.
- **Strum timing** (StrumTension fraction consumer; the ms-per-note law).
- Chord's 0x21010-byte learned store and the 28 B id array.
- `*(param_1+0xce8) = 7` and the dirty-byte recompute path (who reads
  +0xd00).
- Everything above awaits the golden-render gate (README binding rule; no
  renders ran in this lane).

## 5. Confidence

- Parameter inventories, every setter law in §1–§3 (all exact one-line
  bodies), ctor defaults, the ScaleAndTuning walk, the −index feedback:
  **high** as decompile readings — single-source (LiveRE2), const pools
  byte-decoded.
- Slot naming vs UI meaning (e.g. Chance as probability, Strum units):
  **medium** — names come from the mangled setters themselves [D], units
  where marked [H].
- The unsymbolized transform layer: **not claimed** — explicitly open;
  do not build on any reconstruction of it from this lane.
- No behavioral claim of any grade is made; the golden-render corpus for
  these devices does not exist yet (COVERAGE rows empty).
