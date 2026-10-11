# Agentic convergence — native agency in the live shell

Standing: **design inference, 8 October 2026** — a companion to
[UI-UX-CONVERGENCE-STUDY.md](UI-UX-CONVERGENCE-STUDY.md), not an owner
ruling and not an acceptance. Sources: the convergence study's
five-region composition and three disclosure levels; the panel registry
(`Work/O-I/packages/live-shell/ui/PANELS.md`); the cradle agency module's
ontology (`desktop/cradle/src/agency/` — roster, mint, proposals,
disclosure states); the Buzz decodes of record
(`Work/reverse-engineering/2026-10-07-buzz-grok-agent-messaging-re/buzz-messaging/CONTRACT.md`
+ `AGENT-SYSTEM.md`); the Grok Bot decode
(`Work/reverse-engineering/2026-10-08-grok-bot-re/DECODE.md`); the
Ableton interface evidence (`docs/research/ableton-live-12.0.25/ui/`,
interface-only). Visual mockup: [agent-native-mockup.html](agent-native-mockup.html).

## Revision 5 (8 October 2026) — sessions tile, gateway device

Renders: `agent-shell-mockup.png`, `-thread.png`, `-gateway.png`
(plus the Revision 4 arrangement and wide-dock renders).

- **Sessions is a context tile.** The all-sessions tree has left the
  thread view and is now the dock's first default tile, in place of the
  Agents hive, which is still in the launcher. It lists every session
  nested as spawned, with filters for all, running and stalled. The
  selected session lists its tasks, and a click opens the thread.
- **Gateway device** is the first device on a session's chain:
  through → who → how → where → lands. It is grounded in the Hermes RE
  (`Control/agents/now/flows/hermes-gateway-re-20261007/specs/A1, A3,
  convergence-backlog`, and the wiki return
  `hermes-gateway-contract-2026-10-07.md`).
  - *Compact*:
    - Diagram: a link from the shell to the harness with frames in
      flight, the replay ring (events/512) and a heartbeat pulse. The
      readout shows epoch, seq, peers and heartbeat age.
    - Controls: Transport (stdio, ws, remote), default Approvals (ask,
      session, always; deny is always the human's), and Stall-after,
      which feeds the stall watcher that lights retry.
  - *Expanded*: harness and upstream revision; transport; auth (trusted
    stdio, loopback token, 30 s ticket); reach (`local-ipc` shipped, or
    Workcell remote as composed, per the owner's remote-posture ruling);
    submit policy (exclusive vs a queue of up to 32); approvals; stall
    timeout; auto-continue (≤ 15 min, 2 tries). Details are folded:
    JSON-RPC/NDJSON, 225 methods and 34 events, capabilities, epoch,
    replay, the restart guard, and the config law (reads degrade,
    writes refuse).
  - *Full*: a **frame monitor** (Live's MIDI monitor for agents). It
    shows every frame per session (`prompt.submit`, `tool.start`,
    `message.delta`, `approval.request`, `hb`, `session.interrupt`) and
    can be filtered by session. Beside it are the readiness probes,
    liveness, replay and the upstream delta watch (Hermes `20f7ef4d`).
  - Subagent sessions show the gateway folded ("via lead") because they
    ride the lead's connection.
  - **Main** carries a global **Gateways** rack. Hermes tui_gateway,
    the AIKit agency gateway, Actuation on frank, and the remote carrier
    each show their standing, never assumed. The three similarly named
    gateways are told apart there.
- A **Frames** tile puts the same stream in the dock.

## Revision 4 (8 October 2026) — threads, context dock, needles, git

Same mockup file. Renders: `agent-shell-mockup.png` (Session),
`-thread.png`, `-arrangement.png`, `-wide-dock.png`. Supersedes
Revision 3 where they differ.

- **Threads open in the main space.** Double-clicking a task clip, or its
  ↗, opens that session's thread in the centre. Every session is listed
  on the left, subagents included and nested as spawned, with stepped
  rails. Tool calls expand inline. A spawn row opens the child's thread,
  and the child links back to its parent. A stalled thread ends in a
  stall card: Retry, Hard stop, Steer, or tell the parent.
- **Context dock replaces the right sidebar.** It has two parts.
  - Tiles at the top: Agents (the hive), Terminal, Files, Web, Graph,
    Diff, Ledger, Approvals, Wiki and SDK widgets.
  - A 2×2 launcher at the bottom: the same height as the detail row,
    searchable and scrollable, and it folds away.

  The dock widens leftwards (⇤, or drag its edge) and its tiles reflow
  into columns. The same library sits in the browser under **Context**,
  where presets are curated and SDK widgets install.
- **Track controls.**
  - The stop row now has **■ hard stop** and **↻ retry**. Retry blinks
    amber when a lane inside the track has stalled.
  - An empty slot's square is a soft stop (stop after the current task).
  - The **track number is telemetry**: whether that session feeds the
    dock, the ledger stream and other agents' context. Turning it off
    leaves the session running silently, as Live's activator does.
- **Nesting.** Each depth step gets a narrower track, a thinner header
  and one more coloured rail at the left (group → session → its
  subagents). The group header has its own band style.
- **Arrangement needles.** Each thread has its own needle at its last
  activity, with a live readout. Running tasks have no drawn end, and
  queued tasks have no length. A stalled needle stops where its output
  stopped and counts up. The view follows the needles live.
- **Git device** at the end of the chain (who → how → where → lands). It
  shows the branch against main, uncommitted work, the commit policy,
  push, and a Land control (draft PR). Subagents share the lead's seat.
- **Transport changes.** Register (plain/technical) moves to a per-task
  **Output style** override in the clip view. Key/scale becomes a
  **token counter** (Σ cycles session, group, all). Tap pings every
  running agent. The heartbeat drives the needles.

## Revision 3 (8 October 2026) — fidelity to the shell; sessions, groups, racks

Mockup: [agent-shell-mockup.html](agent-shell-mockup.html) (renders
`agent-shell-mockup.png`, `agent-shell-mockup-arrangement.png`). It
supersedes Revision 2 where they differ. The frame, transport order, icon
paths and tokens are copied from the env-1 shell
(`packages/live-shell/ui/src`, 45e15ed8b).

- **Tracks are sessions (runs), and clips are atomic tasks.** A **group
  track** is a lead session together with its subagent sessions. It folds
  as in Live, and its slots show the children's tasks. Launching a group
  slot fires the row of children.
- **Track strip, rebuilt.** It shows Agent, Model (with a group-level
  Subagent model and a Parallel setting), and Watch (Live's monitor:
  stream this session's context in, auto, or off). Below that are the
  activator, solo and arm (who you are talking to), a context-fill pill,
  and an activity meter beside a budget fader. Pan and sends are removed.
- **Device chain: who → how → where.** The agent device comes first, or
  an agentset rack on a group (member chains, each with its model; macros
  for fan-out and hand-back). Then come **skillset racks**: skills are
  chains with admit lights, and macros include Thoroughness, Test depth,
  Reach and Risk. Racks fold to their title as in Live. Last is the
  **context-world device** (reads, writes and write mode). The same
  three sizes apply: compact on the chain, expanded in the browser pool
  with metadata folded under "Details", and full in the centre.
- **Clip view = the task's tool-run log**: chat and tool calls, with
  subagent calls indented. Fold shows tools only, a click expands a
  call's output, and a steer line sits at the foot. Task properties are
  collapsible sections (Task, Launch, Then = hand-off follow action,
  Overrides, Basis).
- **Arrangement = the run viewer.** The selected session or group is
  shown over time. Each session expands into **tool lanes** (Messages,
  Files, Terminal, Web, Graph), the way automation lanes open under a
  track. The agent device's ↗ opens this view.
- **Right dock (Agents & context, the existing `native.context`
  panel).** The **Agents** card is a hive of every agent as a small bee
  sprite over a miniature Expressions form of its activity (working:
  wings and particle spin; held, done and idle badges; subagents drawn
  as drones). Below it, the **Context** card shows the selected agent's
  live context form (Files, Terminal, Web, Graph), following what the
  agent is using unless a tab is pinned. Receipts are collapsed.
- **Transport, in the shell's order.** Key/scale becomes **Register**
  (the voice the agents write in). Punch in/out become a **write window**.
  Draw becomes **point at the stage**. **Earth view** takes the Key slot
  as a placeholder. The rest are kept from Revision 2.
- Skill glyphs here are original geometric stand-ins. The intended source
  is the Expressions glyph library.

## Revision 2 (8 October 2026) — the agent is one device; the Session grid is the agency

The owner's review of the first mockup: too busy, and it missed the device
model. Revision 2 replaces the five-places table below wherever they
disagree. Mockup: [agent-device-mockup.html](agent-device-mockup.html)
(renders: `agent-device-mockup.png`, `agent-device-mockup-full.png`).
The first mockup stays only as the earlier attempt.

**One agent = one device, three sizes of the same live parameters**
(the [DEVICE-PANEL-BRIEF.md](DEVICE-PANEL-BRIEF.md) law, unchanged):

- **Compact** (device chain, bottom): activator, a turn-ring diagram
  (one tick per turn in the budget, used ones filled, the current one
  pulsing; the inner ring's dash shows autonomy), four controls:
  Autonomy, Effort, Budget, Input (steer/queue).
- **Expanded** (browser pool): the whole panel. Routing summary
  (reads → agent → writes), autonomy, effort, escalation, reads, writes,
  skills, budget, runtime.
- **Full** (centre, like the Expressions Studio): the agent's thread for
  the selected act, its acts on this track, and a turn lane (the
  full-size version of the ring). Conversation is the agent device's full
  view. It is not a separate centre presentation.

**Session view is the procedural layer.** No Delegations pool is needed:

| Live | Agency |
| --- | --- |
| Track | A scope (Scene, Object). The agent is seated on its chain |
| Clip | An **act**: a prompt plus settings. The triangle runs it; the slot shows running, queued or done |
| Clip view | The act editor: scope, basis, launch mode (once / hold / loop), **follow action = hand-off** to another track's agent, overrides of the device settings (like clip envelopes), prompt text with bound refs |
| Scene row | A batch: fires every act in the row across scopes |
| Audio From / Audio To | **Reads from** (knowledge bounds) / **Writes to** (write routing) |
| Return tracks + sends | A · Review (reviewer agent seated on the return), B · Wiki; the send amount sets how much of a track's work goes through review |
| Activator / Solo / Arm | Bench the agent / only this agent may run / **who you are talking to** (voice and composer target) |
| Fader / meter | Budget share / live activity |
| Main track | Global devices in a fixed place: **Ledger** (every act, receipts, heartbeats) and **Approvals** |

**Transport, functionally**:

| Live control | Agency function |
| --- | --- |
| ▶ Play | **Run**: launch the selected or queued act(s). This is also the send key, so Enter in a composer is the same as Play |
| ■ Stop | **Interrupt**, quantized. Once: pause at the next tool and keep context. Twice: cancel the turn and roll back to its basis (as a second Stop returns Live to 1.1.1) |
| ● Record | **Voice**: records speech into a new act clip on the armed track, as recording into an empty slot makes a clip |
| + Overdub | **Steer vs queue**: on means input steers the running turn, off means it queues as the next act |
| Automation arm | **Write arm**: off means every write is a proposal, on means writes inside routing land directly with a receipt |
| Re-enable automation | **Hand back**: lights when you edit something an agent holds, and pressing it returns control |
| Capture MIDI | **Capture → skill**: turns the last run of manual actions into a skill proposal |
| Loop + length | Looped act (routine) with an iteration cap |
| Tempo / time signature | **Effort** / **Budget** (turns and wall clock) |
| Metronome | **Heartbeat** check-ins |
| Global quantize | **Interrupt quantize**: now / next tool / next turn |
| Link | Shared field with other harness sessions (Mac and Omarchy) |
| Follow | The view follows the agent's cursor. Off by default |
| Position counter | act . turn . step |
| CPU meter | Context-window fill |
| Key/MIDI map | Bind keys, pads or voice phrases to agent controls |

Teams are racks (several agents on one track with shared macros).
Skills are the agent's plug-ins, dropped on the device. Harnesses are the
plug-in format behind the face.

Still open for the owner: autonomy names (Suggest / Review / Autonomous),
whether Stop-twice may roll back writes that already have a receipt, and
whether Hold launch mode ("think while I talk") is wanted.

## The move: agency enters the device grammar

The shell's existing law — capability is met at the region where its form
belongs, at the disclosure level its moment needs. Audio devices already
live this: a compact face on the chain (perform), a settings toggle
(configure), a deep editor in the center (deep edit). **An agent is the
same shape with work instead of signal as its medium.** Not a chat app
docked at the side; a member of the work, addressable at every region.

The user-colour identity rule carries: agents render with their own
identity colour everywhere they appear (browser card, device face,
working strip, thread membership) — the presence of agency is always
legible without a second chrome system.

## Five forms of agency, met at five places

| Form | Region (existing) | Native shape |
| --- | --- | --- |
| **Discovery** | Browser above (categories/results) | Agents, Teams, Skills as browsable material with real owners (`agent-profile.roster` via kernel; skill catalogue with stewardship + compatibility, from the cradle's `SetupSuggestion` grammar). Audition = preview card; placement = **drag into a scope** (track header, Scene row, Object, master). Drag is membership, exactly as browser→track drag is instrumentation. |
| **Instrumental** | Device chain / bottom detail (third mode: **Agent**, beside Clip and Device) | The **Agent device face**: per-scope configured capability at the three disclosure levels. Compact: autonomy, knowledge-bound chips, admitted skills, budget, review gate, chosen delegated controls (macros). Configure: steering mode, model/runtime, memory injection bounds, escalation, governance refs. Deep edit: the act editor in the center. |
| **Conversational** | Center presentation: **Conversations** (beside Body / Session / Arrangement) | The Buzz member timeline bound to the current scope — humans and agents interleaved as peers, work products as native cards (diff, PR, approval, snapshot), steering in place (composer @relay, per-agent working strip, regenerate/steer affordances). The room is a projection of the work's scope, not a separate app. |
| **Procedural** | Browser below pool (new role: **Delegations**) + Status | The act lifecycle in Groove-Pool geometry: pending/steered/blocked/done rows with agent, scope, standing (basis/revision), steer/release/cancel. Status carries write standing and the act ledger (prompt-completed / interrupted / steered / rotated). |
| **Embodied / encounter** | World apertures (Journey, Palace, Places, Body) + right dock Console | An agent's `worldRef`/`character` gives it standing in the work's world presentations — agents are *encountered* where the work's world is shown, and observed live through the Console's observer stream (encrypted observer frames) and approval inbox. This is where the cradle's agents-in-a-world intent lands — see the preemption note below. |

## The act is the unit of configuration

`CONTRACT.md` gives the mechanics; the cradle gives identity; the act is
the shell-native binding of both — an addressable, revisable document
(the "clip" of agency), not a settings screen:

```
ActSpec {
  agent_ref, profile_revision          // identity + the revision it was configured against
  scope: expression | scene:<id> | object:<ref> | composition
  autonomy: suggest | act_with_review | autonomous
  knowledge_bounds: reads:[ scene | registers:<names> | explicit refs ],
                    excludes:[ … ]     // read routing — what it may know
  write_routing:  layers:[ source|layers|placement|properties|transport|none ],
                  mode: proposal | draft | direct_with_receipt
                                                // write routing — what it may touch
  skills_admitted / skills_denied               // skillsets, per act
  review_gate: { diffs: bool, approvals: bool, escalation: agent_ref | human }
  steering: steer | queue | interrupt | owner-interrupt   // CONTRACT.md §3
  budget: { turns, wall_clock, cost }
  macros: [ { name, skill_ref, scope } ]        // chosen delegated controls — the toolbelt
}
```

- **Read routing and write routing** are the agency analogue of Live's
  Audio-To/Sends: knowledge bounds and projection details are *routing*,
  visible and editable at the device face, respected by the harness.
- **Macros are chosen controls**: a delegated action pinned to the face
  the way a property is pinned to the compact rack — same Follow/Bind
  scope semantics, same DocumentStore/composition path, same
  save/reopen continuation.
- **Disclosure states are the cradle's truthful vocabulary**
  (Selected / Projected / Brokered / Observed effective / Adapter-inferred
  / Unknown / Withheld / Pending reload) — never a generic green badge.
- Save/reopen preserves the ActSpec and its transcript; a recovery draft
  is separately disclosed. Steering, withholding, ack outcomes and
  budgets follow `CONTRACT.md` verbatim (steer-first, exact framing
  strings, owner gates).

## Harness placement

The harness (buzz-acp-style ACP client, or the cradle's
`nativeAgentClient`) sits **behind** the Agent device the way a device's
DSP sits behind its face: one adapter family, discovery presets, custom
harnesses (Buzz's preset list is the existence proof: buzz-acp, grok,
goose adapters, claude-agent-acp, codex-acp, custom commands). The shell
never speaks a vendor protocol directly; the registry admits harnesses
the way it admits devices.

## Preempting agents-in-a-world

The cradle's paradigm (agents as inhabitants of curated workspace worlds,
OpenClaw-inspired, developed but unsurfaced) is answered, not discarded:
**in this shell the world is the work.** An agent does not live in a
separate agent-land you visit; it holds scopes inside the open
Expression, and its `worldRef`/`character` surfaces through the world
presentations the work already has (Journey, Palace, Places, Body) plus
the live observer stream in the Console. Meeting an agent is meeting it
*in the work* — at the region where the form of agency you need lives.
The gateway becomes an adapter behind a device; the roster is Central's
accepted agent profiles through the kernel, never a hardcoded crowd.

## Registry mapping (no frame changes)

- Browser above: `browser-section` panels for the Agents/Teams/Skills
  categories (existing slot).
- Browser below: the pool's role selector gains the **Delegations** role
  (presentation of the pool region, as the study already allows).
- Center: **Conversations** is a center *presentation* like
  Session/Arrangement — a selection of the current work's cut, not a
  panel.
- Bottom detail: third mode **Agent** beside Clip/Device; the agent face
  joins the `devices.*` panel family grammar (generic face component,
  descriptors from the owning adapter, values owned by the ActSpec
  document).
- Right dock: Console cards (Approvals, Observer, selected-act summary)
  as `right-dock` panels, available when requested.
- New PanelSlot values: none required. One-line additions only if the
  pool role selector needs a registry home.

## First vertical slice (acceptance shape)

Mirror the study's slice discipline: **select an agent in the browser →
place it on a Scene → the Agent device face appears (compact) → configure
bounds/routing/skills → delegate in Conversations → steer it mid-turn →
its diff card returns → approve through the review gate → the act lands
with a receipt and the Delegations row closes → save/reopen preserves the
ActSpec and transcript → recovery draft disclosed.** It must prove native
identity (ActSpec as document), scope (bound to the named Scene/Object,
no silent fallback), acknowledgement (truthful states), and continuation
(reopen), at both 1920×1200 and 700px densities. All of it against real
saved work through the kernel adapter — no shell-only act store, exactly
as the study demands of chosen controls.

## Open design questions (for the owner)

1. Autonomy vocabulary — is `suggest / act_with_review / autonomous` the
   right ladder, or should it inherit the respond-gate's author-facing
   terms (owner-only / allowlist / anyone)?
2. Do macros map to skills 1:1, or may a macro compose a skill chain
   (the toolbelt's composition operation)?
3. Escalation address: another agent (Buzz's owner_cache pattern) or
   always human?
4. Does the Conversations presentation host set-level and Scene-level
   rooms simultaneously (a room per scope) or one room at the selected
   scope with a scope switcher?
5. Budget units: turns are the harness's native count; wall-clock and
   cost need the harness's ledger to be admitted as truth.
