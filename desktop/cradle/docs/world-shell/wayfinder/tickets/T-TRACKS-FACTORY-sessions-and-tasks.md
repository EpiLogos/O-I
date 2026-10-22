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

## State of record (moved from PATH sec 7, 22 Oct 2026)

Moved verbatim from the retired `PATH.md` (history: PATH.md at `41557a9ed`). Hashes, run labels (r1, r23 ...) and cross-references inside are as PATH wrote them; "PATH sec N" and "FOUNDATION sec N" in this text name the retired files, whose content is now in `MAP.md` (State of the streams, The foundation's route), `EXECUTE.md` and the tickets.

### Row (PATH sec 7 table): FT, Factory's task and track settings on their owner

| Ticket | Who | Zone | Since |
|---|---|---|---|
| FT — Factory's task and track settings on their owner | **code landed** `db242cdc6`, `7837368bd`, `4ec50b811`; AIKit EpiLogos/ai-kit#518 (`dec711ae`, `c268b569`). AIKit's `encounter-session-settings` keeps a session's Telemetry and Solo and its bound task's name, colour, activator, style, Launch, Then, Hand off to, Quantize and Effort/Autonomy envelopes under a revision with history; the kernel carries it (`encounter_session_settings`, `encounter_session_settings_list`); Clip view, the Tasks device and the mixer row read and write it; a track's Stop cancels that session's running turn. The executor, **code landed** 19 Oct (`e71e9a09`, `75413b47`): AIKit EpiLogos/ai-kit#532 (merged `ea786b86`, installed) adds `encounter_task_executor.rs`, a background worker beside the encounter — never inside the kernel, which is a stateless pass-through for every op this needs and holds no task/turn state of its own. It wakes every 2s and, for each resident session with a bound task, plays Effort/Autonomy through `ModelSelect`/`ModeSelect` at the envelope's value for elapsed task time; on a turn's end (`HostEvent::TurnEnded`) resubmits the task's own name under Launch hold/loop, or runs Then (handoff resubmits to `handoff_to`, stop no-ops, next is an honest no-op — one bound task, never a queue); Quantize's `now` settles on the instant, the other three words wait one sweep; Telemetry off mutes `Read`'s own answer; Solo gates both its own launches and a human's `Prompt`, scoped to the session's SessionSpace. 11 unit tests on the pure decision core; the full aikit-cli suite (582) stays green. The O-I-scoped `encounter-serve` resident was idle (`owner-occupancy`: no residents, no queued work) and was shut down through the owner's own `shutdown-idle` (its socket, by hand — no CLI wraps it yet) so its next spawn carries the installed code; nothing here needed a kernel or shell change. **Settling seen** (19 Oct, by raw CAW CLI against a real bound task in an isolated AIKit home, not yet on the candidate's own shell): the full CAW task-dispatch ceremony reached `encounter-task-configure`'s `ready:true` (real Central NOW allocation, a real Workcell write boundary) and opened a real native Pi encounter; with Launch=loop and Quantize=now, one human Prompt was followed, unprompted, by two further turns the executor itself drafted and submitted on each `TurnEnded` (its own text the task's purpose, exactly as documented) — three `user-message` events from one human action; `active` set to `false` then produced zero further turns over the next 35s. Getting there needed fixing ai-kit#534 (open PR): `encounter-agency-mint`'s `world_ref` was the bare `ProjectRef` (e.g. `"O-I"`) where Central's native `scope_ref` is always `project:<id>`, so `encounter-task-configure` refused every task on a minted Agency outright — masked until now because every test fixture's fake project id was already prefixed. Also found and restored: the owner's hand-authored per-project Agency template (`Work/O-I/.aikit/sf6-agency/agency-request.json`) was missing from the working tree, preserved only in an orphaned commit (`6f6d177d4`) not an ancestor of `main` — the mint cannot run at all without it. **Not yet seen**: Effort/Autonomy actually moving a resident — the installed `pi` (pi-rpc) provider discloses `reasoning_effort_selection:false` and `mode_selection:false` ("Pi RPC publishes no in-session permission modes") for every model tried, so `play_effort`/`play_autonomy` have nothing to apply; `hermes-acp` refused to open on an unrelated local file-permission error. Owed: the same walk through the Factory UI in a native candidate; a native provider that actually exposes a reasoning-effort or permission-mode selector, to prove Effort/Autonomy. Launch and retry of one task stays open too (the owner op it names is Actuation's, not AIKit's). Attempts as takes, **code landed** 19 Oct (`84ce20e06`, `6b6cadfc2`): AIKit EpiLogos/ai-kit#531 (merged `5f08539c`) says which Factory attempts a session's bound task serves (`encounter-task-attempts`, `aikit.encounter-task-attempts/v1`); Factory EpiLogos/Factory#286 (merged `4e22ffa0`) records each attempt it dispatches there and discloses the desktop caller and the grant it expects (`factory attempt admission`); the kernel reads them (`encounter_task_attempts_list`) and chooses one (`factory_owner` `attempt-receiving`: the attempt's Return proposed to Central's receiving field in the Flow its Run is associated with, the grant resolved from the host's token against the owner's contract, which already lists `central.receiving.submit` for `project:Factory`, so no contract edit); the Factory adapter lays each attempt as a take lane under its session's track and the comp chooses (Factory receives a whole attempt, so the stretch is ignored). **Seen** over the real kernel and the installed owners (`evidence/ft-takes-20261019/`, a private stack with an AIKit-home copy and a fixture Factory state of two attempts): two take lanes under the session's track, take 1 standing and shown on the main lane, take 2 not yet chosen; a stretch dragged on take 2 and Return runs `attempt-receiving`, and the pane shows the owner's refusal "associated with no Central Flow" (the grant gate passes against the real contract first). **Seen in the sealed native candidate** (r27, full-suite, source `86832d711`; `evidence/ft-takes-20261019/native-*.jpg`): the same walk in Factory mode, Session · Arrangement, on the bundle's own owners with the same AIKit-home copy: Takes 2, take 1 and take 2 under the session's track, a stretch on take 2 and Return, and the owner's refusal in red ("Comp take 2 … This Run is associated with no Central Flow, so its Return has no…", cut at the pane's width; the span's title holds the whole sentence); `Control/user/flows` and both wikis hash the same after, and the candidate and the AIKit-home copy were removed. **Found on that pass**: the answer sat at the end of the lane list, behind 26 session lanes, so a person saw nothing happen (the stack pass read it from the DOM); the ruler's foot (the answer above the note) is now sticky (`tl-foot`), seen headless in `foot-before.png` / `foot-after.png`, **not in r27**. **Found**: a second attempt on a task was refused for want of a revision (the dispatcher writes without reading): ai-kit#533, merged `bbfd6c4d` 19 Oct and installed (`oi update --apply --channel mainline ai-kit`); on the installed binary, over a copy of the AIKit home, a second attempt appends with no revision named, a replay is a no-op, and a stale `--expected-revision` still conflicts. The resident ai-kit gateway still runs `4e3b877a` (the owner restarts it: `aikit gateway upgrade apply --wait`). Owed: a Run associated with a Central Flow, to see a choice reach Central; the sticky foot in the next native candidate | lead | 19 Oct |
