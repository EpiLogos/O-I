# T-TRACKS-FACTORY — Factory's sessions and tasks on the shared Session and Arrangement

FOUNDATION §4 (mode adapters after F3), §3 F3 ("fold in the semantics of Factory's AgentSessionGrid and
AgentArrangementView, which are the most complete"); lock §9.1 Factory row. Builder: Sonnet. 14 Oct 2026.

## Realises

- Manual `docs/dlw/DLW.md` §6: "Each agent works a track, and its tasks are the clips. … Fire a task and it runs; fire a
  row and a batch starts across every session at once. How a task is drawn tells you how it stands. A running task has no
  end … a queued one has no length at all. A stalled task is striped and frozen where its output stopped, and its track
  lights a retry. Groups of agents fold under one header, and each agent's helpers step in beneath it, a coloured rail for
  every level." "In Arrangement view the work moves. Every thread runs along one ruler with a needle that jumps each time
  its agent checks in, and a needle that stops moving is a stall."
- Lock §9.1: Factory — track = a session; clip = a task; stop = a launched batch; takes = attempts.
- Craft floor: `agent-shell-mockup.html` session and run views; `world-shell-mockup.html` `.sg/.trk.sub/.rail`. The
  existing `agent/AgentSessionGrid.tsx` and `agent/AgentArrangementView.tsx` are the semantics to port (read them in full).

## Contract

`UseModeTracks` in `packages/live-shell/ui/src/frame/tracks/modeTracks.ts` (a hook over the published reading, which
carries `transport`). `WorldTrackSet` with `status` (queued → waiting, running → running, done → stopped, stalled →
stalled), `depth`/`parentId` (groups and helpers), `needle`, `at` on a ruler of time, `takes` (attempts), and an
`actions` port: `launch` / `launchStop` / `stopTrack` only through the owner paths the agent shell already uses
(`agent/harnessAgentControl.ts`, the grid's `onHardStop` / `onRetry` wiring in `agent/AgentShellRoot.tsx`), each naming
its op. No path, no action. The lead wires `factory: useFactoryTracks` on converging.

## Work

1. `timeline/factoryTrackAdapter.ts`: pure, from `AgentSessionTrack[]` (`agent/agentRunModel.ts`) to the set. Track ids
   are `trackKey(track)` (the ref THE selection uses for a session, `kind: 'agent-session'`); task clips are ids the
   task log can open.
2. `frame/tracks/useFactoryTracks.ts`: reads sessions with `useAgencySessions(reading.transport)` (no second store) and
   returns the set with its actions.
3. Tests: groups and depth; stalled striping status; needles; the batch rows; no action without its owner path.

## Zone

`packages/live-shell/ui/src/timeline/factoryTrackAdapter.ts`, `packages/live-shell/ui/src/frame/tracks/useFactoryTracks.ts`,
`packages/live-shell/ui/tests/factory-tracks*.test.mjs`. Not `modeTracks.ts`, not the shared views (propose changes to
them in your return).

## Done when

On screen (lead): Factory's Session pane shows the sessions as tracks with helpers railed beneath their lead, tasks as
clips drawn by state (a stalled one striped); Tab shows the threads on one ruler with needles.
