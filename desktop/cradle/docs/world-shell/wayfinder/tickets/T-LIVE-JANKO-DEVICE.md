# T-LIVE-JANKO-DEVICE — the keyboard is the torus unwound

**Source:** owner ruling, 13 Oct 2026 — DEVICE-SEMANTICS-LOCK §0.2 item 4;
QL-MEF #329 Wayfinder §0.4 items 4 & 6, `JANKO-QL-INSTRUMENT-FIGURE.md` §4a,
packets K and U; DLW §9.

**Depends on:** QL-MEF packet K publishing, in I1, the exact angular
placement of the twelve positions on the two arcs of the M1 torus (WT₀ the
bimba arc, WT₁ the pratibimba Klein-extension arc, across the 720° cover).
The O:I surface never lays positions out by eye.

## Target

A complete Jankó instrument device: six rows, repeated touch-points,
polyphony, velocity and pressure, and **one input path** for pointer, touch,
computer keyboard and MIDI (T-LIVE-MIDI), with a piano layout as the admitted
alternative. Each key is an excitation point on its helix of the torus: a
semitone is a cross-helix step, transposition is motion along the helix
(same fingering, same figure), a chord is a simultaneous excitation set and
the figure it draws on the surface is the chord's symbol. Explicit gesture
focus, so editing text never triggers notes; accessibility, undo and device
errors retained.

## Acceptance

- Scripted: complete Jankó invariants (fingering invariance under
  transposition; repeated-touch lifetime); every key's excitation point equals
  packet K's published placement; a chord's excitation set and its surface
  figure come from one state; pointer/touch/keyboard/MIDI reach the same path.
- Native: play a chord from the Jankó surface; the torus lights the chord's
  figure and sounds it.

## Progress

- Leg 1 (aa364d2c1): the keyboard is a device in Live's chain (after the
  torus, before the effects, mounted once a reading is published). It
  validates `ql.janko-surface/v1` exactly, proves fingering invariance and
  the one-semitone row step on the owner's real output, and offers the
  piano layout as the alternative. Pointer, touch and keyboard share one
  path; a chord is one act; editing text never plays. Each key goes
  through the `janko` stage command to the owner's own strike.
- Owner seams: nothing serves `ql music janko window --json` to the shell
  yet; it follows the kernel `ql_music.rs` pattern. Nothing produces
  `influence.played_addresses`, so the owner refuses each strike by name
  (the Studio's own Jankó keys are silent for the same reason). Packet K's
  placement is not published. MIDI is T-LIVE-MIDI.
