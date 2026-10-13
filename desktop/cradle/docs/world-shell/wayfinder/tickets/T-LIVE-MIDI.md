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
