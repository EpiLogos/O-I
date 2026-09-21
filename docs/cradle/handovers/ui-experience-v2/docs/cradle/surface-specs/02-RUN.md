# Run — a dense tape beside the work

**Version 2.** Detailed trajectory remains inside the existing right Run tab. The actual full SSSF work view remains central in Desk. This file specifies the tape's precise control hierarchy, not another Run page. Shared control behaviour is in [the constitution](00-EXPERIENCE-CONSTITUTION.md).

## 1. Recurring job

A person notices a failure, wonders what a tool did, answers a real request or follows an agent's recent work. They need to locate the event, inspect exact evidence and return without losing their reading. They do not need a Steps/Activity/Metrics framework before they have any activity.

## 2. Composition and density

```text
Run         Agents         Context
---------------------------------------------
<actual work title> v          [expand] [ ... ]
All 23   Tools 5   Errors 4   Permission 1
<timing band, only when meaningful and supplied>
---------------------------------------------
[SYSTEM]     start -> <actual work>
[USER]       ask -> <actual subject>
[ASSISTANT]   inspect -> <actual subject>
[TOOL]     > run -> cargo test           41s
[ERROR]    > fail -> <actual check>

                 [Resume live · 3 new]
---------------------------------------------
2 turns · 5 tools · 4 errors            [info]
```

Counts, commands and time in this drawing are examples, not defaults. Use 12–13 px monospace with 28 px minimum collapsed rows. The work title uses existing UI type; no giant Run heading. Keep a 72–88 px tag column where space permits, one growing summary column, and a duration column only when data exists. The selected row has a quiet neutral fill and an edge/outline, not a green success stripe.

The top bar contains the work selector, existing expand control and overflow. **Open in Desk** is a menu entry rather than a permanently repeated Full run button; on a Run opened from a chat mark it may appear as the one useful contextual link. Do not add Inspect as another top-level tab.

Counted filters are compact toggle chips in one wrapping row. All resets the filters. Tools, Errors and Permission are offered only when that category exists in the read scope or is already selected. A selected filter remains visible at zero so the person can undo it. Counts denote that source/query coverage, never invented all-history totals. Step/Agent/attempt narrowing goes into an anchored **Filter activity** menu, not four permanent filter bars.

## 3. Row and payload interaction

**Row body** selects. **Chevron or Enter/Space on the selected row** expands the payload directly below it; repeated click on the chevron collapses. Clicking/selecting does not copy, run or grant anything. Preserve text selection inside payloads. A selected historical row pauses follow; a control must not move under the pointer when new events arrive.

Expanded payload begins with its exact useful detail. **Input / Output** are local tabs when both exist; a sole payload has no tab rail pretending there are two. `Copy payload` and **Open source** appear only where the payload/source is actual and permitted. No full raw record above the useful payload; **Raw event** is a final disclosure.

At normal width, payload unfolds within Run. At a user-expanded Run width of at least about 720 px, the selected event may use a 280 px inner inspector with remaining tape width; at smaller widths it returns to inline detail. This is within the existing panel, not a fourth app region. A close glyph closes the inspector and restores its row.

**Session facts** open from one footer info control, accessible **Session details**. Model, start time, duration, tokens and directory render only where actually disclosed for the selected session/execution. If there are no facts, the icon is absent. Missing model is not a label with a dash. Required failed verification remains in the work regardless of missing optional telemetry.

## 4. Follow, filters, facts and timing

Live follow is the resting tail behaviour only for a real active source. Inspecting an event, changing filters or scrolling upward pauses it. One pill **Resume live · {n} new** appears anchored above the footer when applicable. With no arrivals its text is **Resume live**. Activation resumes with current filters intact. `L` is scoped to tape focus and never catches typing in a search or payload field.

A snapshot source shows a quiet **Refresh activity** icon in the top bar, not a fake Live label. Hold/resume preserves its reading position across refreshes; it cannot claim a cursor subscription exists. A real stream uses the shared native observer rather than one polling loop per tab.

Tool updates coalesce by exact native correlation. Two identical commands with different call/attempt identities remain two events. Unknown kinds retain their native designation in detail. Count errors/calls/turns from actual semantic records, not render updates. Footer totals are compact text, not metric cards. Zero-only meaningless metrics disappear.

Show a model-vs-tools timing band only from comparable native timing. Overlapping parallel spans cannot be added into fake wall-clock total; preserve appropriate separate tracks or the owner's reported resource-time label. Timestamp-free journal blocks show no duration band. Timing absence creates no empty reserved space.

## 5. State and copy table

| State | Exact composition / copy |
|---|---|
| Empty | **No run yet — start one** on one line; link opens real existing start passage, not a fictitious Run |
| Real work, no events | Work title + **Waiting for activity.** |
| Loading | One local **Loading activity…**; no fake tape rows |
| Working | Coalesced actual rows; source-backed working marker |
| Needs-you | Exact request row; **Respond** opens the same existing native decision surface, no duplicate form |
| Error | Actual error event; read failure separately uses **Couldn’t load activity.** and Retry |
| Refused | Native decision remains in tape, with scope in detail; no silent rerun |
| Live held | Stable event/payload + Resume live pill |
| Filter empty | **No matching activity.** + **Clear filters**; not an empty Run |
| Partial/gap | **Activity is incomplete.** in one coverage disclosure; existing useful rows remain |
| Complete | Actual terminal state and known totals; task success is not inferred from turn completion |

Other labels: **Open in Desk**, **Filter activity**, **Refresh activity**, **Session details**, **Input**, **Output**, **Copy payload**, **Raw event**, **Load earlier** only when available. Status change never steals keyboard focus.

## 6. Subtraction list

Remove Steps/Activity/Metrics empty boxes; the repeated Execution monitor heading; a permanent Full run/Compare/Expand command row; always-visible session fact tables; timer-driven liveness; padding for absent telemetry; empty filters except active zero-result filters; fixture-specific business logic; static/transitive fixture imports. Retain all genuine SSSF depth centrally, real data identity, useful payload inspection and supported operation links.


## Retained binding inventory

The following inventory is retained from v1 as source-qualified implementation reference. It is not a rendering prescription. Reconcile it with the active local tree; this version's interaction and preservation rules govern presentation.

## Appendix A — element → binding

| Element | Current source / exact read or operation | Constraint / remaining work |
|---|---|---|
| Run selection and centre route | `FactoryCentre.tsx`, `desk/deskModel.ts`, `desk/DeskBoard.tsx`, `desk/DeskRunDetail.tsx`; existing sidebar selection/host | Preserve exact native Run key and central SSSF; do not replace the board. |
| Run tape | `RunPlane.tsx`; `factory_build_snapshot` with `state_path`, `project_ref`, `run_ref`, optional `project` | Project real `view.trajectories` even without `accompanying`. Schema/field validation stays at the current adapter. |
| Direct tape | `TrajectoryPlane.tsx`, shared `useEncounterSession`; `encounter` requests `view` / `read` | Transcript blocks are not all timestamped. Raw journal and semantic blocks must not be double-counted. |
| Event identity/payload | Native execution/span/call refs or session + block/cursor identity | No generated synthetic operation or merged same-label calls. |
| Counts and filters | Derive from validated native events within explicit coverage | Presentation computation; not a new owner fact. |
| Session facts | Native trajectory fields; `encounter_task_read` exposes actual `cwd`; connection exposes provider where present | Only join through exact refs. Provider label is not automatically a model name. |
| Permission response | `encounter` request `permission` with native request ID and actual option ID | Native provider consent; do not fabricate wider Actuation authority. |
| Cancel/retry/start | Current disclosed native action or shared start passage | Do not infer an executable Run action from `factory_build_snapshot`, a read. Owner start/retry joins remain separately verified. |
| Follow/history | Existing per-session held state, extended to native Run/execution key; current Factory live provider | Snapshot-follow now; native stream only when exposed. |
| Facts/payload inspector | Existing Run panel depth/expansion, existing trace components where useful | Same panel; no new top-level Inspect destination. |

## Acceptance — interaction and visual proof


R01 — Real selected Run without an accompanying conversation displays its actual trajectories. Direct conversation tape is labelled Direct and has no fabricated Factory ancestry.

R02 — Row selection, chevron expansion, payload Copy and Respond are distinct pointer/keyboard actions. Event text remains selectable; Escape closes the closest detail and restores focus.

R03 — Missing timestamps removes band/duration cells; missing session facts removes their empty labels and info trigger. Parallel timings never become fake wall time.

R04 — Pause on historical inspection; append/refresh; change tabs; return. Event, payload revision, viewport and selection stay held; Resume live retains filters.

R05 — A selected zero-result filter stays removable; counts use actual scope/coverage. Equal command strings in separate attempts are not coalesced.

R06 — At 320 px normal and expanded panel widths, there is one Run body and no fourth region. Long/expanded rows are measured and virtualization stays bounded.

R07 — Real native request response/refusal and handler-disconnected negatives preserve exact subject and scope. Snapshot-only source cannot pass live-stream evidence.
