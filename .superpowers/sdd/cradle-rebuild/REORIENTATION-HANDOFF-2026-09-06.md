# O-I — owner review and fresh-session execution handoff

> **Orchestration mandate:** Read [ORCHESTRATION-CONTINUATION.md](ORCHESTRATION-CONTINUATION.md) first. The owner now explicitly authorises subagents and transfers responsibility for the full programme, with the lead owning UI fidelity and integration. This supersedes earlier non-delegation wording.

Standing: execution addendum from the owner's review on 2026-09-06. This changes
execution priorities and presentation requirements; it does not silently rewrite
canonical design documents. Implementation paused at the owner's request for
this review. Resume using this file with BUILD-O-I-NEXT.md and the programme.

## What went wrong

Native owner increments and regression coverage are useful, but the current
production shell has not attained the accepted studies' visual or interaction
structure. Passing tests of the existing layout did not establish design
fidelity. Small toolbar edits were insufficient. The shell became a constraint
on integration instead of implementing the agreed product shape. Repeated
computer-use inspection compounded the cost without closing that discrepancy.

The current UI is not the approved foundation. Preserve proven native semantics,
source safety and window mechanics; replace presentation structure where needed.
Do not restart discovery or ask whether the spatial desktop is wanted.

## Binding owner corrections

- Workspaces are saved states of the whole open app arrangement: pane tree,
  tabs/bindings, active pane, dimensions, layers and restore state. They are not
  another project hierarchy, navigation destination, or unrelated label store.
  Selection restores that arrangement; browsing projects does not replace it.
- Place app-wide Workspace and Window commands in the actual native application
  menu/titlebar integration. Remove redundant web-rendered app-menu rows and
  repeated workspace labels. Retain only contextually useful arrangement access;
  do not scatter workspace management across components.
- Central is the parent of the actual mapped Work projects. Central and projects
  expose three compact modes: Chats/tasks (default), Files, Wiki. Per-project
  mode/expansion/scroll is workspace-scoped. Focus reveals a surface's project
  without resetting its mode or inventing ProjectRefs for unadopted directories.
- Match all three interactive studies: ?study=chat, ?study=tiled, and ?study.
  Preserve their layers, pane-local tab grammar and spatial behaviour. The chat
  and tiled companions provide the main desktop reference; the original adds
  interaction evidence. Use the owner's latest corrections when studies differ.
- Restore the deliberate colour distinction between left sidebar, central canvas
  and right contextual panel. Match spacing, flex behaviour, tab density, layer
  widths and responsive collapse. No duplicated left-panel toggle in the visible
  chrome. No wasted topbar row or diagnostic ground/identity/provenance footer.
- The right panel renders the relevant active-subject plane. Do not show source
  context under a History selection for a subject with no history operation, or
  retain content from a previous subject. Chat remains a normal surface.
- Search is summoned through the configurable leader, default Cmd-K/Ctrl-K;
  preserve writing keystrokes and Escape focus restoration. AIKit owns query,
  ranking, resolution, history and successful-use familiarity.

## ACP runtime correction — foundational owner work

The real Pi acceptance uses AIKit's existing AcpStableConnectionAdapter and
AgentSessionHost with the published pi-acp bridge. It is not a desktop chat
integration. The installed verified host still defaults to 512 signals per turn;
the native proof explicitly overrides this to 16,384. That override demonstrates
connectivity, not a production fix. Do not present it as resolved.

Normal streaming turns must have effectively no total-event-count ceiling.
Implement this in AIKit: decouple turn duration/event count from in-memory
retention, use bounded queues/backpressure and appropriate durable event/history
handling through the owner, and distinguish protocol faults from a legitimate
long-running turn. Do not replace 512 with another arbitrary large acceptance
ceiling or an unbounded accumulating Vec. Explicit cancellation, process failure,
resource errors and any deliberately configured operational limit remain distinct
and observable. A UI consumer disappearing must not cancel its provider.

Pass provider-exposed thinking content and its updates through the canonical
owner event/read-model path to the encounter's thinking presentation. The current
proof reacts to agent_thought_chunk as progress; that does not prove content
preservation or display. Do not manufacture hidden reasoning or flatten exposed
thinking into an unexplained status label. Test long reasoning-heavy streams,
ordering, content, cancellation and same-session continuation via actual ACP.
Keep permissions/tools through their native AIKit/Actuation authority routes.

One canonical encounter has one transcript, draft/composer and native session
across tab, side, full and detached views. Existing durable SessionSpace CLI
operations do not themselves provide a resident ACP encounter service. Audit
current mainline for that operation before extending the owner. Never revive
the parked Pi-specific desktop endpoint. pi-acp's one-session-per-connection
behaviour is a harness-specific constraint, not a universal ACP restriction.

## Revised execution order and separation

1. Establish production presentation fidelity first. Inspect the three running
   studies once at agreed viewport sizes and capture a concise discrepancy list.
   Implement the actual native shell/component structure, app menus, regional
   colours, pane tabs, contextual layers and responsive behaviour. Keep already
   working real source/wiki routes attached. No fourth mockup or replacement demo.
2. Give presentation components explicit inputs: owner refs/read models/actions,
   availability/errors, plus workspace/surface view state. Components own rendering
   and interaction only. Native menus dispatch the same arrangement actions.
   Missing owner operations remain named integration obligations; sample chat
   rows, fake streams or invented desktop business state cannot satisfy them.
3. Develop native owner operations separately against these stable contracts.
   Prove an explicit candidate in its owner and through the consumer seam. Native
   capability gaps must not cause convenient redesigns of the agreed UI. This
   separation supports the explicitly authorised delegation in ORCHESTRATION-CONTINUATION.md.
4. Connect and accept end-to-end slices in the programme's dependency order:
   real Central safety, wiki/search, canonical ACP agency, then the remaining
   Flow/Return/System/Factory/material/Shared Field and 166-capability obligations.

Verification cadence: one reference inspection; one native visual comparison at
the coherent shell checkpoint; targeted native interaction runs for changed flows
(including detach/re-dock, focus, resize and restore); then the phase acceptance.
Use automated native-owner and browser walk checks between those checkpoints.
Reopen computer-use investigation only for a visual discrepancy or unresolved
native behaviour. Do not repeatedly inspect unchanged AX trees or run full suites
for every cosmetic adjustment. Preserve existing source CAS/authority/conflict
coverage; update obsolete presentation assertions without weakening semantics.
A functional pass and visual fidelity are separate receipt fields. Neither
substitutes for the other. No build concurrently into the preview being tested.

## Exact continuation state

- O-I: /Users/admin/Central/Work/O-I, branch cradle-p1, HEAD1565e59, pushed.
  Shared app/design-system WIP remains uncommitted. Do not reset or bulk-stage it.
  Review status and ownership before edits; no worktrees or destructive resets.
- AIKit landed and registered: 8a1d20097cb2453d86ffc1beab91767f3fd3e70b.
  Gate directory: ai-kit-8a1d20097cb2-1788706601538-48238.
- Central landed and registered: 4106b28b6fee29a489f92848d3023653d46d4828.
  Gate directory: central-4106b28b6fee-1788709485128-28202.
- Both gate directories live under /Users/admin/Library/Application Support/OI/
  receipts/dev/. Actual contributions are source/target/release/aikit,
  aikit-session-space, and ctrl respectively. Each receipt identifies source,
  locks, binary hashes and captured consumer source. Recheck current mainlines
  and process bindings; these are evidence of this run, not a development ceiling.
- Central files.list/read now own real directory and bounded text reading.
  Ordinary files are read-only; authored participating files retain native
  SourceSurface editing/CAS/history. General file write/history is unfinished.
- Last combined walk: 284/284, including13 real ordinary-files checks and native
  packaging. Log: /tmp/oi-implementation-20260906/full-filesystem-combined-walk.log.
  This proves the stated tests, not full desktop or design acceptance.
- Native visual evidence: actual /Users/admin/Central tree, Work/O-I/README.md,
  separate native file window and re-dock were seen in the conversation. Immediate
  AX after re-dock reported prior wiki keyboard focus while the file was selected:
  investigate caret parity rather than assuming that part passed.
- Running native app was launched with those explicit artifacts and WK store
  b89d6c197c3e4f0a9182578b41e9a603. Actual root is /Users/admin/Central, not temporary
  acceptance ground. Preserve existing tabs/drafts; recheck process before refresh.
- AIKit live checkout has unrelated dirty host/connection/projection files. Other
  owner checkouts also contain active work. Do not pull/reset them or overwrite
  an active provider. Use explicit candidate preparation preserving their work.
- Details and earlier failure receipts are in progress.md. Historical handoffs
  do not supersede this addendum. No spatial phase merge or complete-app claim.

## First fresh-session deliverable

A production shell matching the accepted companion shape and these native-chrome
corrections, with existing real sources/wiki retained, before adding more endpoint-
shaped UI. Record visual discrepancies closed and remaining separately from tests.
Then close the AIKit streaming/thinking contract and bind canonical chat/tasks.
Do not spend the fresh session writing another open-ended plan.

## Coordinated S / M′ routing increment — 2026-09-06

Owner's subsequent clarification: S is the `oi` CLI whole; M′ is the desktop
whole with left `0`, canvas `/`, and right `1`. See [[CANONICAL-PRODUCT-FIELD]] and
`suite/desktop-projection.json`. Presentation work remains in its active lane.
Discovered Central, Knowledge and SessionSpace clients now route through `oi`;
`OI_BIN` must identify the newly built CLI, while existing owner overrides retain
exact candidate selection. The SessionSpace companion route is
`oi aikit-session-space`. New `oi dev gate` receipts also capture and hash the
exact suite executable as `OI_BIN`, alongside the native owner artifacts.
No running preview was rebuilt or replaced by this
increment. Re-run the affected native app walk with the candidate suite before
recording app acceptance. The `oi desktop` CLI shares application readers; it
does not yet remotely control resident windows/workspaces.
