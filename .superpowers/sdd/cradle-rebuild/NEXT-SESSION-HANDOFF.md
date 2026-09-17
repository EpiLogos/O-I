> Superseded for execution on 6 September 2026 by [BUILD-O-I-NEXT.md](BUILD-O-I-NEXT.md), [the revised programme](IMPLEMENTATION-PROGRAMME-2026-09-06.md), and [bootstrap/loading contract](BOOTSTRAP-AND-LOADING.md). Retained below as historical evidence; do not execute its older start sequence.

# O-I — next UI review and implementation handoff

Standing: **review-ready, not an approved replacement execution programme**.
Prepared 6 September 2026. Do not use the older ORCHESTRATOR-PROMPT verbatim: it
names the retired branch/start units and stale installed-binary assumptions.
This packet preserves the current work and decisions still needing resolution.
It does not amend the authoritative design documents.

## What the owner asked for most recently

Build interactive UI studies before more business implementation. Keep the first
study and produce companion chat/tiling states. Root is **Central**, with one
sidebar. Each project has three small controls: chats/tasks (default), files,
wiki. Shared Field has a distinct glyph. Graph scope comes from the sidebar;
remove duplicate Graph/List and in-canvas scope tabs. Make thin desktop chrome,
context menus, tab groups, tiling and reversible full chat clearly operable.
Explore agent access as a chat tab. Explain sidebar persistence across tabs.

The owner also requested two research passes: recover the complete integration
view from current plans, capability matrices and retired/quarried work, then
independently audit that view and the execution programme for conflicts. Both
passes are complete, with their boundaries and recommendations distinguished.

## Read in this order

1. Current owner conversation/rulings, then `docs/cradle/01-DESIGN.md`, current
   `docs/OI-DESKTOP-APPLICATION-SPEC.md`, `docs/CANONICAL-PRODUCT-FIELD.md` and
   `docs/OI-DESKTOP-CRADLE-REBUILD-WAYFINDER.md` including D16–D21.
2. This packet and `progress.md` in this directory. Do not infer acceptance of
   the current live shell from historical U0/U1 receipts.
3. `integration-review-2026-09-06.md`: full native-owner/UI integration map,
   quarry recovery instructions and 166-ID appendix.
4. `ux-harmonization-audit-2026-09-06.md`: independent crosscheck, 14 decision
   items, suggested persistence contract, missing unit coverage and acceptance.
5. Current `docs/CAPABILITY-MATRIX.md`, `suite/capability-matrix.json`,
   `suite/mainline.json`; then the particular quarry/native sources cited by
   the chosen bounded unit. Historical “IMPLEMENTED” means old candidate
   evidence, not a functioning contribution in the current Cradle.

## Run and compare the studies

From `/Users/admin/Central/Work/O-I/desktop/cradle`, `npm run dev`:

- `http://localhost:1421/?study` — 01, original paper/wiki + side encounter.
- `http://localhost:1421/?study=chat` — 02, Central sidebar + canvas chat.
- `http://localhost:1421/?study=tiled` — 03, wiki, source and chat in three groups.

02/03 have top-right comparison links. They use separate browser-local state
keys, so experimenting with one does not overwrite the other or the native
Cradle. Default `/` still mounts the existing Cradle. No canonical source writes,
agent invocation or projection publication occur in a study.

Try: project files icon → chat remains; project wiki icon → wiki tab opens;
agent control beside Search → existing chat is focused; right-click tab → move
or split; drag a tab to another group; resize divider; maximize chat → Escape;
change workspace → return; reload. Open Shared Field and Central wiki separately.

Files: `src/study/Seed.tsx` (01), `src/study/WorkspaceStudy.tsx` and
`workspace-study.css` (02/03), `src/main.tsx` query selection. These are interaction
prototypes, not production component architecture. Do not wire owner Actions
into this sample model by incremental substitution: first agree the host state
contract and re-earn it through the kernel/surface architecture.

## Candidate state contract actually demonstrated

| State | Study behaviour | Implementation boundary |
|---|---|---|
| Workspace | Owns groups, layout, focused group, active tabs and maximization | Saved refs are restore requests; re-resolve owners before semantic focus |
| Sidebar mode | Stored per workspace + project; defaults to chats/tasks | Browse scope is not agent context disclosure |
| Project title | Expands/collapses browsing; does not switch workspaces | D19 project→workspace default still needs final ruling |
| Tab focus | Reveals its project while preserving that project's sidebar mode | One active interaction focus; other surfaces retain bound subjects |
| Encounter | Stable study ID; agent access deduplicates; move/maximize preserves draft | Same canonical AgentSession, never another desktop transcript/session store |
| Pane maximization | Temporarily hides other groups; Escape restores arrangement | Decide relation to canonical D17 side-panel full state |
| Shared Field | Shows a bounded sample projection neighbourhood; private nodes omitted | Common visual grammar does not imply common/public storage |

Limits: sidebar expansion is presently transient; graph selection/zoom and chat
internal plane are shared presentation state in the prototype, not the final
per-Surface contract. Vertical divider resize is demonstrated; row-divider
resize, native detach/re-dock, full keyboard menu grammar, and cross-window
restoration remain acceptance work. Simulated messages are not real transcripts.

## Decisions to settle before declaring a fresh implementation programme ready

- **UX01**: standard cold-start/default workspace versus focused Flow/rest mode.
  The current user prioritizes the desktop; several canonical rest passages
  still prescribe agency + writing with World summoned.
- **UX03**: project title expands/browses, opens its workspace, or another explicit
  rule. The studies deliberately avoid replacing tabs on a browse click.
- **UX04**: default chat-tab access versus side encounter; move a binding or allow
  synchronized presentations; exact promote/return semantics. One composer per
  encounter presentation is demonstrated, not an alternative session identity.
- **UX02/05**: formalize local/shared graph reading boundaries and restored focus
  authority. Neither source visibility nor yesterday's saved ref is permission.

Remaining UX06–14 cover typed task/session/Run rows, native window grammar,
notifications, filesystem Actions, route familiarity, capability evidence and
Journey's Factory/Actuation ownership. See the audit rather than collapsing
these into a cosmetic sidebar choice.

## Proposed programme reconciliation (not silently adopted)

1. Preserve and identify current uncommitted ownership; reconcile frame baseline.
2. Close the presentation decisions above and, when authorized, harmonize the
   conflicting authoritative passages. Do not edit design docs to match code.
3. Assign every APP-SPEC acceptance to a unit: focus/workspaces/window management,
   owner wiki/navigation, canonical session/provider continuity, safe Flow/Return,
   full System authored/effective/active readings, Factory Build/trajectory,
   lower material/terminal/provider surfaces, Shared Field admission/return,
   dynamic contributions and optional QL instruments. U1.6 already covers System;
   the old quarry warning that it has no unit is stale.
4. Join capability ID → exact native pin/operation → contribution/surface → UX
   state → programme unit → receipt. The 166-ID research appendix is a starting
   map, not 166 completed UI integrations.
5. Choose the first bounded implementation unit and its real end-to-end walk;
   then brief a fresh session. Do not restart U0.1 because an old prompt says so.

## Git, pins and verification cautions

Working repo `/Users/admin/Central/Work/O-I`, branch `cradle-p1`; another session
landed 5e6f79b during the prior work. Many live-shell edits are still uncommitted,
plus unrelated ProjectCentral/wiki changes. Do not sweep, reset, switch branch,
make a worktree, force-push, or merge another session's work. No publication was
performed by this UI round. Re-inspect current status before any git mutation.

The live-shell baseline is red: rest/synthetic-surface assumptions, navigator
walks and actual full-depth/restore errors. Historical U1.3's 172/172 receipt is
for its earlier candidate. Study acceptance cannot erase those regressions.

`node walk/run.mjs companions` exercises 29 local interaction checks, including
actual pointer drag, contextual move, resize, restart, workspace lens isolation,
chat binding continuity and private/shared graph omission. `study` covers the
original 19 interactions. Actual visible browser walks and screenshots accompany
both. Native packaging is separately checked. No screenshot proves native owner
integration or native-window detachment.

The initial baseline this round reused old pinned ctrl 832f2e5 for comparison.
Research detected current suite pin f66794a712609ea29760355d66f632d669ad7c98.
Do not certify current suite integration from the old receipts. A separate
`git archive` build of the current pin is used for the final complete-suite
rerun, without touching the active Central checkout. Consult the final receipt
below; product-native standing must be freshly proven against current pins.


### Final mock consistency corrections

The auditor's last addendum describes its inspection point. Subsequently the
mock was corrected so workspace restoration and pane focus reveal the active
project, and Research agent access reuses its named default encounter. The new
regression is included in the 29 checks. This is exact study-ID lookup, not a
canonical provider/session resolution implementation. System's illustrative
labels now distinguish Actuation's agency/execution from AIKit context/capability.

Geometry caveat: sidebar width, inspector visibility and tile ratio are stored
for the whole variant, not independently per workspace. Project graphs emphasize
the selected neighbourhood with dimmed adjacent projects; they do not yet apply
the production bounded reading/recentering contract. Graph context menus currently
show frame actions only, not owner-disclosed subject Actions. These are explicit
limits to address after the interaction model is chosen.

### Final complete-suite receipt

`/tmp/oi-companions-final.log`: final build and `node walk/run.mjs all`, with
`OI_CENTRAL_CTRL_BIN=/tmp/oi-cradle-pins/f66794a712609ea29760355d66f632d669ad7c98/target/release/ctrl`.
No concurrent frontend build during this final run. Results:

- companions 29/29; original study 19/19; native packaging 4/4 — pass.
- rest 9/13, surfaces 2/3, kernel-cas 0/1, navigator 0/0, editor 1/1 with
  scenario error, history 0/0, spatial 12/14 — scenarios fail.

Those seven live-shell failures remain an explicit repair gate; there is no
whole-suite green claim. Final study receipts/screenshots were generated against
the built preview. Native packaging passed, but visual interaction evidence for
these studies is browser evidence, not native detached-window verification.
