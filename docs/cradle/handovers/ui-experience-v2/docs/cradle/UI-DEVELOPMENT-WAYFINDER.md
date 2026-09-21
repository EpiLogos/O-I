# Cradle UI development wayfinder — v2 interaction handover

**21 September 2026 · ready for local implementation, not implemented-app proof.** Target: the owner's current `/Users/admin/Central/Work/O-I`, including held dirty work. No commits or pushes. This edition replaces the v1 experience layouts, not unseen local code or the native binding inventories.

Read [the constitution](surface-specs/00-EXPERIENCE-CONSTITUTION.md), [Desk](surface-specs/07-DESK.md), the affected surfaces, and [source standing](UI-SOURCE-RECEIPT.md). The paste-ready lead commission is [UI-LOCAL-EXECUTION.md](UI-LOCAL-EXECUTION.md). Bounded subagent prompts are supplied under [handover/prompts](../../handover/prompts/) in this GitHub handover; they are input to the lead, not independent permission to edit shared files. Acquire this directory from the pinned publication commit without switching, merging or replacing the owner's active tree; see [START-HERE](../../START-HERE.md). Earlier missing-seam statements are historical limits: preserve newer local first-Send provisioning and actual catalogue/roster paths.

## 1. Non-negotiable experience result

The existing left **Desk / Tasks** pair remains. Desk is the actual SSSF workbench plus ordinary opened agents/teams/skills for project work; Tasks is the shared, readable agent conversation. The right **Run / Agents / Context** stays. The tape lives in Run. Agents has one `+` creation menu and shared identity-first object details. The current Context canvas insertion for file/terminal/browser material is protected. Settings v2 remains. One left Inbox holds reviewable delivery.

This pass is not finished by wiring handlers or matching text. Every changed control has a defined resting, hover/focus, selected, pending, error/refused and dismissal state. The lead compares actual changed screenshots and walks the gestures.

## 2. Preflight once, then build

The lead reads current Founding Positions, the local Factory UI integration handoff, UI function landing, Factory Agency, Settings/UX-state/Personal-Web/SharedField documents, and the current relevant #289/#375/#155/#166 source when needed. Existing local code establishes implementation fact; this latest owner correction establishes presentation direction. Do not spend the whole session doing a new suite census or substitute remote main for the local UI.

Visually inspect all 24 images under `desktop/inspo-screenshot/`: rejected September-20 states and chosen Slack/flight-recorder benchmarks. Record exact filenames and the useful hierarchy/control/spacing lessons. Inspect the live accepted Expressions surface and actual current Desk/Tasks/Context. Capture before images at the current viewport, then 1440×900, 900×760 and a 320 px panel as supported.

**Context preservation gate:** capture the existing file, terminal and browser insert flow as `context-canvas-current`, identify its actual component and test paths, and freeze those paths against redesign. Do not mount the old remote ContextPlane over it. The new agents/skills work uses the existing context pathway rather than making another attachment system.

Record HEAD/branch, dirty/untracked filenames and before hashes/bytes for the lane's exact files. Do not stash, reset, clean, checkout files from main, switch branch, globally format, commit or push. Before every write reconcile a changed hash; do not overwrite another worker's concurrent change. Lane-only diffs are against these before-images, not an indiscriminate diff against HEAD that includes the owner's work.

```sh
cd /Users/admin/Central/Work/O-I
pwd
git branch --show-current
git rev-parse HEAD
git status --short
git diff --stat
git diff --cached --stat
find desktop/inspo-screenshot -maxdepth 1 -type f -print
find docs/cradle/surface-specs -maxdepth 1 -type f -print
```

Inspect `package.json`, `walk/run.mjs`, current scripts and existing live processes before running builds. Do not terminate the owner's Tauri/Vite/agent/native services or reuse occupied ports. Prebuild can regenerate built-in personal documents: before-image them and protect held edits. If required, test an exact-content disposable copy including dirty state, never a clean-main stand-in or a new machine workspace.

## 3. Shared contract and concurrency

The lead publishes one compact local handoff containing: actual selected project scope; Run key; inspected event; selected colleague/team/skill; current Tasks conversation/recipient; permitted open-in-Desk and open-activity callbacks; existing Context insertion path; actual native plan/apply/start interfaces. These are references to existing identities, not new stores or a speculative universal type hierarchy.

One writer per file. The lead owns shared `CradleFrame.tsx`, `DesktopShell.tsx`, `mode.ts`, `modeBodies.tsx`, `AgentLayer.tsx`, `FactoryCentre.tsx`, `deskModel.ts`, `sidebarModel.ts`, shared fixture/config-source gates, shared CSS/tokens, Vite/package files and the walk registry. The lead also owns the Run tape integration unless explicitly transfers individual files. Other workers propose shared changes as a small patch note, never edit them concurrently.

| Worker | Owns after lead confirms actual local paths | Does not own |
|---|---|---|
| A · Desk | `desk/DeskBoard.tsx`, `DeskRunDetail.tsx`, scoped `desk.css`, new Desk object presentations | Shared FactoryCentre/deskModel/shell; roster/skill pipeline; Context |
| B · Tasks | Existing `agent/chat/` message/composer presentation files, excluding frozen context insert files | Session/native transport, shared AgentLayer, Context semantics |
| C · Colleagues | `sidebar/AgentsPlane.tsx`, bounded `agency/` presenters, `agent/desk/SkillsToolsPlane.tsx`, new shared colleague/team/skill UI | Shared sidebarModel, native mint protocol, approved Context body |
| D · Settings | Current `configuration/v2/` presentation/section files and scoped styles | Config engine/contracts/sourceHost, credentials, package files |
| E · Navigation/Explore | `WorldNavigator`, `FactoryNavigator`, `ProjectBranch`, sole `ReturnsTray` body, actual launcher, Explore presentation | Shared shell/layout, new inbox store, Context |
| Q · Independent verifier | New uniquely named v2 test/probe files and evidence under agreed test location | Production code, broad original assertion deletion, paid/live effects |

Prompt files name these allocations. The lead narrows them to exact files, removes overlaps, and records them before dispatch. A directory name is not blanket permission over held code. Existing test files and shared imports are lead-owned unless explicitly handed off.

Run at most three implementation subagents concurrently unless the local harness is already configured for more. Suggested batches: A/B/C, then D/E while lead integrates Run and Q verifies. Q may read throughout but writes no application code. Subagents return actual changed files, lane-only diffs, tests, screenshots, known failures and shared-join requests; not just recommendations. Lack of subagent support is a concrete report followed by sequential execution, not a reason to stop.

## 4. Sequence with visible acceptance

### Phase 0 — subtract, protect and quarantine

**Lead plus scoped workers.** Freeze Context and established Desk/Tasks first. Remove duplicate delivery boxes, capability scaffold rows, observer-age prose, hardcoded Guardian/model/project lists, repeated empty states and static fixture imports. One `+` replaces paired creation buttons. Root navigation and review functions remain reachable.

**Files:** actual navigator/document footer mounts; Run/Agents presenters; v2 delta renderer; `configuration/sourceHost.ts`; dev scenario boundaries in `sidebarModel`, ScenarioBar, study Seed and chat previews. Lead owns shared boundaries.

Split fixture data/mutators out of production modules. Reuse the compile-time dev/walk gate with a nested explicit `?fixtures=1` check; production must eliminate the import/chunk entirely. Ordinary dev without the query uses real/unbound state. Source mode changes cannot reuse stale fixture singleton state. Detached specimen views retain TEST SPECIMEN.

**Accept:** C01–C06, N02–N03, S03, CTX01–CTX04 baseline. One empty line per selected surface; no optional zero containers. Exact Context baseline unchanged. Native-disconnected negative must not become successful fixture fallback.

**Walk set:** `rest agent-panel configuration navigator document-entry`, plus current Context baseline/probes. Plain shipping audit after walks.

### Phase 1 — Run tape and Desk's real whole

**Lead owns Run; A owns Desk.** Run gets compact title/menu, counted filters, dense tag rows, expandable input/output, real facts in a disclosed inspector, pause-on-inspect and Resume live. It reads real selected Run trajectories without requiring a chat. Snapshot is not advertised as streaming.

Desk preserves the full SSSF board/detail and adds ordinary opened Agent/Team/Skill working objects through existing material tabs. `+ → object picker → Open in Desk` is presentation. Project membership, repertoire apply and Start run remain separately reviewed native effects. Team and skill bodies are reused from C, not cloned; A builds the frame/integration until C returns them.

**Files:** `RunPlane`, `TrajectoryPlane`, scoped tape styles; DeskBoard/DeskRunDetail/DeskRunView as needed; lead-only FactoryCentre/deskModel joins. Do not replace SSSF with a generic graph or list.

**Accept:** R01–R07 and D01–D08, including exact step → activity/conversation → back, no fabricated progress/timing and unchanged context.

**Walk set:** `factory-development agency-planes encounter permission`; verify local standalone `desk-probe.mjs`, `desk-run-view-probe.mjs`, filter/dark probes before invocation.

### Phase 2 — Tasks message-room refinement

**B with lead joins.** Identity-first grouped messages, comfortable prose, fixed-in-pane composer, existing inserts, inline To:/@, one workmark with compact expansion/Open activity, one exact permission card. Message action icons reveal on hover/focus. Completion notices are brief; genuine long answers remain intact.

**Files:** existing shared AgentChat/message/composer presenters; lead-only AgentLayer and FactoryCentre joins. No second session or transport.

**Accept:** T01–T07, CTX01–CTX04; draft/caret/recipient/inserts survive mode changes. Picker Enter never sends. Context is not redesigned.

**Walk set:** `encounter select-send send-group-reconnect permission context-draft canvas-context workspace-continuity` and actual browser/page/terminal context probes discovered locally.

### Phase 3 — colleagues, teams and working Skills

**C.** One `+` menu; stable colleague cards; conditional Start/Message; drawer with one dismissal and Skills/Setup/Activity; actual Guardians segment. New Agent/Team share the existing intent/proposal form. Membership and repertoire selection feed explicit native review. The shared bodies also open in Desk.

**Files:** AgentsPlane, Agency/Mint/Guardian/Skill presenters, SkillsToolsPlane. ContextPlane is **not** assigned for replacement. Remove an independently verified duplicate inbox/empty line only after lead confirms its exact mount.

**Accept:** A01–A05, D03–D04 and CTX01–CTX04. Missing mint/membership/apply yields one exact owner obligation inside the requested flow; no fake colleague or globally mis-scoped profile write.

**Walk set:** `agent-panel agency-planes context-draft canvas-context configuration`; configuration live/composition tests; existing local skill pipeline walks. Test native handler/readback disconnection.

### Phase 4 — Settings destinations and actual choices

**D.** Add Harness/Models/Skills/Gateway to existing v2 owner rail/search. Use compact real choices, readonly references where appropriate, local staged review only when there is a change. Credentials remain presence-never-value. Preserve v2 axes, source/scope and receipts.

**Files:** actual local v2 presenters and section components; sourceHost shared gate is lead-owned.

**Accept:** S01–S07, especially zero deltas, no invented catalogue, scope-change invalidation and no secret material.

**Walk set:** `system system-settings configuration`; `test:configuration-live`, `test:configuration-composition`, existing Visuals/adoption regressions.

### Phase 5 — finish the one inbox

**E.** One queue in the left navigator, sparse badge elsewhere. Items open real materials; controls beside the selected proposal preserve distinct review/include/recover. No embedded Desk/Context/editor queue or generic receiving footer. Paged counts remain truthful.

**Files:** sole navigator inbox body and its existing native review material routes; bounded removed mounts only. No native receiving-store rewrite.

**Accept:** N03–N04/N06; same item seen through two scopes stays one; arrival does not steal focus; stale/uncertain includes reconcile correctly.

**Walk set:** `receive-include receive-recover day-edit document-entry leave-reenter now-relations`; actual personal-web tests and protected generated-file boundary.

### Phase 6 — navigation, Explore and visual coherence

**E plus lead/Q.** Polish kind/time/title rows, dismissing tooltips, hover/focus actions and marked launcher cards; retain Desk/Tasks and file tree. Explore unbound is one sentence/action/details; live material owns the field with restrained presence and actual travel.

**Files:** bounded navigator/launcher/Explore; lead-only shared shell joins. No new dashboard/roster/graph store.

**Accept:** N01–N06, E01–E05 and all C/T/D/A/R/S/CTX cases. Compare before/after for each rejected screenshot class, along with protected good Context/Desk screenshots.

**Walk set:** `navigator modes mode-workspaces workspace-continuity explore-sf1 explore-sf2 rendering-quality`; current mode-sweep/footer/retention/tab/Expression geometry probes as actually present. End with a plain production build/audit.

## 5. Commands and proof discipline

From the actual app directory, inspect scripts first. These commands/scenario names are grounded in the prior retrieved runner; use actual successors if locally renamed and record the mapping. Do not invent `npm test` or silently remove a failed case.

```sh
cd /Users/admin/Central/Work/O-I/desktop/cradle
npm run build
npm run test:configuration-live
npm run test:configuration-composition
# Use the relevant phase scenario set after checking its real effects:
node walk/run.mjs rest agent-panel configuration navigator document-entry
```

Review native walk effects, isolated test ground, owner binaries and port availability. Use real existing runner `WALK_PREVIEW_PORT` / `WALK_BRIDGE_PORT` settings with unoccupied ports. Do not point tests at the owner's active app by habit. Do not start paid providers, mutate personal sources or attach to unrelated sessions to improve a score. Preserve the runner's same-checkout engine provenance; never borrow another tree's node_modules.

Fixture walks explicitly request `?fixtures=1`; ordinary dev/native walks do not. Keep original scenario obligations but amend obsolete furniture assertions into the actual retained human job. Record a pre-existing failure separately and do not label the whole suite passing.

The runner's WALK build is not the shipping build. After all walks:

```sh
env -u WALK -u SKIP_BUILD -u WALK_URL npm run build
```

## 6. Production audit: three separate proofs

**Strings.** Scan every emitted asset/chunk, not just entry JS. Fail on missing output or grep errors. Add current local distinctive fixture strings to the seed inventory; do not ban a legitimate model/provider name alone. Catch emitted escaping/normalisation as well as literals.

```sh
set -eu
[ -f dist/index.html ] || { echo 'Missing production build'; exit 1; }
assert_absent() {
  if grep "$@"; then
    echo 'FAIL: prohibited shipping content' >&2; return 1
  else
    code=$?; [ "$code" -eq 1 ] || return "$code"
  fi
}
assert_absent -RInaE \
  'Re-read canonical|Bind a conversation to pick|Roster read not exposed at the desktop seam yet[.]|vendored into the repo|Observed[[:space:]]+[0-9]+[[:space:]]*(ms|s|m|h|seconds?|minutes?|hours?)[[:space:]]+ago' dist
: "${FIXTURE_SENTINELS:?Path to locally completed fixture-sentinel inventory}"
[ -s "$FIXTURE_SENTINELS" ]
assert_absent -RInaF -f "$FIXTURE_SENTINELS" dist
```

**Module graph.** The lead/Q adds test-side verification against the current Vite build that inspects every emitted chunk's actual module identities/transitive imports. Fail if Factory/sidebar scenarios, study Seed, settings fixtureSource, chat preview or their new extracted equivalents ship, even as never-requested lazy chunks. Test-only source outside the shipping graph is legitimate. No broad suppression of the rule to pass an old test.

**Runtime.** Ordinary production with and without `?fixtures=1` shows no specimen or fixture-loaded network module. Dev/walk without query is real/unbound; dev/walk with query is labelled and isolated from native effects. Repeat in detached views and after source-mode changes to catch stale caches.

DOM copy checks distinguish owned chrome from user-authored document text/native raw payload. Scan both visible and hidden-mounted chrome; product-owned plural returns only in the sole inbox. Do not alter native identifiers or censor source text to satisfy grep. Check the new creation button geometry/count and absence of duplicated Context insertion forms as well.

## 7. Acceptance handback and finish lines

Q independently walks one joined scenario: preserve file/terminal/browser inserts → open Desk Run → inspect step → open exact Tasks conversation → address real colleague → open a skill/team in Desk → review real supported scoped change → inspect Run event → receive/review material → return to unchanged draft/context. Include meaningful refused/unavailable paths and exact native handler-disconnection negatives. A fixture interaction cannot certify native effect.

Return lane-only modified/new paths, resolved shared joins, per-surface subtraction ledger, protected Context comparison, before/after images, exact build/walk/audit command receipts, pre-existing failures, unresolved native obligations and a short manual walk. Do not call untouched native gaps “finished”; do not let a missing owner operation block independent UI refinement.

**Handover ready:** this package and prompts are prepared. **UI implemented:** local source changes plus tested interaction/screenshot evidence. **Native integrated:** real owner/readback evidence. **Human accepted:** actual owner visual/use judgement. None substitutes for another. No commits/pushes until the owner explicitly authorizes them in that local session.
