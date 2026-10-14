# T-TRANSPORT-BINDINGS — Factory's and Expressions' working controls as bindings of the one transport

FOUNDATION §3 F7 ("The working Factory controls (resume/stop, voice, steer, write arm) and Expressions controls (scene
play/stop, studio arm, takes) fold in as bindings before their bars are removed"). The one bar landed on 14 Oct:
`frame/transport/Transport.tsx` (28 slots, Live's places, the cut's marks) over `frame/transport/slots.ts`
(`SlotBinding`: press / step / control / lit / readout / title / refused), with each mode's bindings registered in
`shell/modeTransports.tsx` (`MODE_TRANSPORT`, hooks over `TransportReading`). Live, Central and Technē stand on it.
Factory still draws `agent/AgentShellTransport.tsx` (through `AgentShellTransportBridge` in App.tsx) and Expressions
`components/NativeTransportBar.tsx` when its native reading stands. Builder: Sonnet. 14 Oct 2026.

## Realises

Manual `docs/dlw/DLW.md` §10.5 — the Factory and Expressions columns of the table, slot by slot (Play: "Run the task, or
every queued task" / "Play the scenes"; Stop: "Pause at the next safe point; press again to cancel" / "Stop and rewind the
scene"; Record: "Speak a new task" / "Record a take of the field"; Overdub: "Steer the running turn" / "Layer a take over
the scene"; Arm: "Let agents write directly, with receipts" / "Record the studio as a take"; Tap, Tempo, Signature,
Metronome, Quantize, Key/root/scale, Follow, Position, Re-enable, Capture, Loop … as the table says). Lock §0 (owners
write, faces read).

## What to build

- `useFactoryTransport` and `useExpressionsTransport` — the `UseModeTransport` hooks for Factory and Expressions, each
  porting the working controls of its old bar onto the slots the table names: every press through the exact owner
  call the old bar makes (`harnessAgentControl`, the shell setters `shell.setSteer` / `shell.setWriteArm`, the voice
  session, the native scene transport ops …), every light from the reading the old bar lit it from, every readout the
  old bar showed. A control with no owner call stays unbound (drawn waiting).
- The old bars' non-slot chrome (browser/detail/dock toggles, view tabs, receipt lines) is NOT ported here: the frame
  header already carries the toggles and the Session/Arrangement switch; a receipt/note line the old bar showed becomes
  the slot's `title` or `refused`, or is returned as PROPOSE.

## Zone

`packages/live-shell/ui/src/shell/transports/useFactoryTransport.tsx` (new),
`packages/live-shell/ui/src/shell/transports/useExpressionsTransport.tsx` (new),
`packages/live-shell/ui/tests/transport-bindings*.test.mjs` (new). Not `shell/modeTransports.tsx`, not App.tsx, not the
old bars (the lead registers the hooks, removes the bars and `AgentShellTransportBridge`).

## Done when (lead, on screen)

Switching modes moves no control; the marks are identical; Factory Run/Stop and Expressions play/arm still work through
the one bar; no light shows without a reading.
