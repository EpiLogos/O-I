# LANES.md — how the two threads cooperate

**Status:** protocol, revision 1 (2026-10-07).

## The threads

**Thread A — Reverse engineering (RE).** Question: what does Live actually
do? Method: official surfaces → document archives → binary → golden-render
behavioral capture. Lands in: dossiers (`devices/*.md`, `session-model.md`),
evidence (`evidence/`), gated crate models (`packages/live-dynamics`).

**Thread B — Shell rebuild.** Question: what will host the documented
behavior? Method: blueprint → document engine → graph → UI, gated at every
step. Lands in: `shell/SHELL-BLUEPRINT.md`, `packages/live-set`,
`packages/live-engine`, `packages/live-shell`.

## The contracts between the threads

1. **Behavior truth**: `session-model.md` + device dossiers. Thread B
   implements from these, never from Live itself, never from `evidence/`
   decompilations. If Thread A revises a dossier, Thread B's dependent
   implementation is re-gated.
2. **Code truth**: gated crates. `live-dynamics` (device DSP) and `live-set`
   (documents) are the interfaces Thread B consumes; both are accepted only
   by tests against Live-truth evidence.
3. **Acceptance truth**: golden renders + the loader loop. The harness
   drivers in `harness/` are shared infrastructure — Thread B uses them to
   validate that written documents load in the real app and that engine
   output matches Live truth.

## Coordination rules

- Both threads work the O-I register in the working seat; both return to
  the project NOW field with the working face first.
- No thread edits another thread's land (dossiers vs packages) without the
  evidence discipline the owning thread uses.
- Contention for the one Live instance: render experiments belong to Thread
  A's lanes; Thread B's loader-loop validation schedules around them (the
  drivers are serialized and guarded anyway).
- A capability "lands in the shell" only when its milestone gate passes
  (see the phase table in `shell/SHELL-BLUEPRINT.md`).

## Current state (kept current by the lanes)

- Thread A: Glue/Echo/Reverb modeled + gated; Operator/Wavetable velocity
  mapping documented, voice synthesis open; warp enum probed; D1-final and
  Wavetable routing in flight; Glue binary laws + full kernel pipeline
  captured (see glue dossier binary sections + `evidence/binary/`).
- Thread B: blueprint + this protocol written; **M0 `live-set` standing**
  (tree parser, gzip read/write, typed summary, loader-rule helpers;
  6 tests green including the real template set — its first run corrected
  session-model.md's ReturnTracks structure).
