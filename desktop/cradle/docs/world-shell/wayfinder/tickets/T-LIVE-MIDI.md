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
  The shell hears ports by event (`oi://midi-ports`); no command is
  granted (the unused `midi_inputs` command was removed after the R2
  review).
- Leg 2: MIDI map and Key map. The native host decodes Control Change as
  its own event (`oi://midi-cc`). The transport's MIDI map and Key map slots
  are real toggles: in map mode every owner-stated mappable parameter (the
  four determinants, cadence, sound, level, units per metre, the Scale tie)
  shows the overlay; click it, then move a control or press a key. A second
  source replaces the binding; Delete or a click in map mode removes it;
  mapped parameters keep a marker. A bound control moves its parameter only
  through the owner's write (`commitLiveInstrumentEdit`, the note-device
  setters): choices split 0–127 evenly, coalesced to one write per frame and
  none when unchanged; a refusal is named on the parameter. Keys step
  choices and never fire from text fields. Mappings are held for the session
  and say so.
- Open: recording mappings as automation and persisting them with the set
  (both wait on the arrangement's automation owner and the set document
  write); MIDI out; pitch bend, aftertouch and program change; the latency
  budget asserted at the engine boundary; the native run with a hardware
  controller and the measured input-to-sound latency.
