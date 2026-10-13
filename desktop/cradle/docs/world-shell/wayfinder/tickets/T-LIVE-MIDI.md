# T-LIVE-MIDI — MIDI in and out, mapping, and the low-latency playing path

**Source:** owner ruling, 13 Oct 2026 — DEVICE-SEMANTICS-LOCK §0.2 item 6;
QL-MEF #329 Wayfinder §0.4 item 6 (and §2.5, packet A — the low-latency
path); DLW §9.

## Target

MIDI in and out through the native audio owner; key mapping and MIDI mapping
(the transport's Key map / MIDI map slots) binding any instrument or device
parameter; the low-latency live playing path from any input (pointer, touch,
computer keyboard, MIDI — one path, T-LIVE-JANKO-DEVICE) to the torus's
excitation, with measured latency.

## Acceptance

- Scripted: a MIDI note on reaches the same excitation path as a pointer
  press; a mapped control moves its parameter and records as automation;
  mappings persist with the set; latency budget asserted at the engine
  boundary.
- Native: play the torus from a hardware MIDI controller; measured
  input-to-sound latency within packet A's budget.

## Progress

- Leg 1: MIDI input reaches the Jankó keyboard's one input path. The
  native host (`src-tauri/src/midi.rs`, midir on CoreMIDI) opens every
  input port, follows ports coming and going, and emits note-on/off to the
  main window as `oi://midi-note` (a batch per drain, so a chord that
  arrives together is one act); velocity 0 is a release. The shell
  (`native/liveMidi.ts`) hands each note to `createJankoInput` as
  `source: 'midi'` (velocity/127 is the strike), so it reaches the same
  `janko` stage command as a pointer press. The device names the ports it
  hears, "no MIDI input connected", or the absence outside the native host.
  `midi_inputs` is granted to the main window and classified
  `input-device` in the authority register.
- Open: key/MIDI mapping of parameters and recording them as automation;
  mappings persisted with the set; MIDI out; the latency budget asserted at
  the engine boundary; the native run with a hardware controller and the
  measured input-to-sound latency.
