# Workspace Continuity Wayfinder — 19 September 2026

Status: proposed execution packet. No work package is marked implemented or verified by publication of this document.

Contract: [Workspace continuity](../../../docs/experience/WORKSPACE-CONTINUITY.md).

Extend O:I #375 and the existing #289/#292 and #65 tracks. Preserve the accepted current UI and actual v2/per-mode implementation in the owner's checkout. Use one integrator and at most three bounded subagents in the existing coherent working tree. Do not proliferate worktrees, duplicate dependencies/build artifacts or reset unpublished work. Omarchy remains the preferred development/build location; actual Mac/native acceptance remains separately recorded under the existing gates.

## 1. Finish line and authority

The owner can leave an HTML/document surface, switch tabs, arrangements or workspaces, return to it and recover its supported working state without rebuilding the file tree first. A restart reconstructs open work from durable checkpoints. Releasing every disposable view does not lose the person's writing, context or workspace arrangement. Fast warm return, safe release and successful restart are three separate proofs.

Read the actual local instructions and current successors of #375, the relevant experience/cradle docs and the linked continuity contract. The source audit in the contract is pinned to remote main `fe92e1d027c806f99144ebf832a536307c0fe581`, not the owner's live v2 checkout. Reconcile first; repair only what remains deficient.

The native owner remains authoritative for identity, reads, source admission, revisions, saves, process/session continuity and capabilities. Presentation caches and a pending tab are never proof that an owner operation succeeded. Existing SourceOpen/SurfaceOpen and Central CAS/history behavior remain intact.

## 2. Wayfinder: where the work lands

Paths below are relative to `desktop/cradle/`. Inspected means code was read in the pinned research cut; follow locally means a known adjacent seam still needs implementation-time reading.

| Existing anchor | Standing | Responsibility in this track |
|---|---|---|
| `src/CradleFrame.tsx` — `openFile`, `mountSurface`, reconciliation, focus, detach | Inspected, lines 1–435 | Immediate pending binding; origin-scoped async completion; share admission readings; distinguish logical open membership from visible/native-admitted runtime; protect focus. |
| `src/surface/Workbench.tsx` — `GroupPane`, `SurfaceBody` | Inspected | Consume stable runtime slots; meaningful chunk-loading fallback; preserve same view across tab/layout transitions. |
| `src/surface/types.ts` | Inspected | Extend existing bindings and serializable checkpoints without mixing owner identity, placement and runtime handles. |
| `src/surface/engine.ts`, `persist.ts`, `layout-codec.mjs` | Paths observed; read locally | Preserve tab/split/close/reopen semantics, v2 migration and layout decoding; add progressive diagnostics rather than destructive fallback. |
| `src/workspace/store.ts` | Inspected v1; actual local v2 must be reconciled | Sole canonical workspace book interface; per-mode membership/restoration; coalesced durable writer; origin-scoped updates; per-workspace recovery. |
| `src/workspace/recovery.ts`, `drafts.ts` | Paths/call sites observed; read locally | Existing raw recovery and draft persistence; extend rather than build a parallel recovery system. |
| `src/files/client.ts` | Inspected | Existing `file_read`, `file_bytes`, `files_list` and CAS operations; preserve contracts behind shared acquisition. |
| `src/files/FileTree.tsx` | Inspected | Render shared listings; persist expansion independently; aggregate loading; retain last reading on refresh error; bounded visible rows. |
| `src/files/FileSurface.tsx` | Inspected | Consume shared working model/cache first, preserve durable drafts and CAS basis, separate save/read/refresh states, restore view after readiness. |
| `src/material/MaterialSurface.tsx` | Inspected, lines 1–245 | Replace destructive suspension; share acquired revision; retain frame through refresh; readiness/lifecycle adapter and selected view persistence. |
| `src/kernel/KernelProvider.tsx`, `bridge.ts` | Inspected portions noted in contract | Preserve read-model authority and event ordering; attach broker invalidation above hidden views; trace serialized apply versus direct read paths. |
| `src/shared/Loading.tsx` | Inspected | Local accessible operation feedback with bounded/deduplicated stage cues; no global spinner storm. |
| `src/terminal/TerminalSurface.tsx` | Inspected | Adapt existing attach/lease/checkpoint behavior; distinguish emulator attach from process spawn; pause only presentation work. |
| `src/workspace/DesktopShell.tsx`, `DetachedFrame.tsx`; `src/shared/Expression.tsx`; `src/browser/BrowserSurface.tsx` | Existing references; follow locally | Native-window placement/lease joins, retained UI slots, one-stage-per-window and actual browser lifecycle capabilities. |
| `src/surface/SourceSurface.tsx`; `src/personal/PageExpression.tsx`; `src/context/PageContext.tsx` and page bridge | Existing references/call sites; follow locally | Source-backed HTML route, Day/Flow and Expression coordination, revision/span-based context and page lifecycle negotiation. |
| Native `kernel_op`, material protocol and terminal handlers | Resolve by actual checkout search | Measure admission/locking/bytes/watcher behavior; make narrow owner-contract additions only where a demonstrated requirement needs them. |

Proposed module locations, not claims that these files already exist: `src/files/resources.ts` for resource projection/broker; `src/surface/runtime.ts` for residency/adapter coordination; `src/workspace/checkpoints.ts` for durable presentation checkpoints; `src/material/lifecycle.ts` for controlled-document lifecycle. Reuse equivalent local modules instead of creating duplicates. Keep these responsibilities bounded and avoid a generic enterprise state framework.

## 3. Work packages and dependency order

### WF0 — Reconcile the real cut and establish the contract

Record checkout path, branch, HEAD, relevant dirty files, build reference, React version, native transport, machine, running provider/kernel versions and the actual book schema. Read current local retention changes and map every proposed requirement to already satisfied / partial / missing. Do not reimplement a completed three-tier mechanism merely to use these proposed names.

Trace one plain file, one ordinary HTML file, one source-backed HTML/Day document and a representative expanded tree. Capture click-to-tab, owner reads/admission, iframe navigation/readiness, tree calls, state writes and tab/mode/workspace/restart transitions. Use both clean and dirty document cases. Record actual top blocking spans rather than declaring one universal root cause.

Freeze interfaces for resource keys, working-model ownership, residency transitions, checkpoint acknowledgements, request generations and lifecycle capabilities. Choose explicit workload-specific memory/count limits and cold/reconstruction timing budgets based on the baseline. Keep source inspection, local changes and measured findings separately labelled.

Exit: pinned source/run receipt; source reconciliation table; test fixtures; initial timings/counters; agreed adapter/broker/checkpoint contracts. Do not let this grow into another whole-system census.

### WF1 — Secure recoverable state before destructive release

Depends on WF0. Move ordinary file working state out of the disposable FileSurface lifetime using existing draft semantics; preserve kernel-owned source models. Implement or complete per-workspace and per-binding recovery, original-byte quarantine, versioned checkpoint publication and last-known-good fallback behind the actual book interface. Separate high-frequency view checkpoints from bulk content and book serialization.

Introduce acknowledgement and error handling for draft durability. Protect dirty state when checkpointing fails. Coalesce state writes off hot paths without relying on process-exit handlers alone. Resolve multiwindow checkpoint races at the existing persistence boundary.

Exit: forced renderer destruction and restart preserve acknowledged drafts, binding identity and independent view state; corrupt one checkpoint without losing siblings; storage failure cannot erase good data. This safety work begins early, not after visual retention has hidden the problem.

### WF2 — Direct-open resource path and coherent shared acquisition

Depends on WF0; can proceed alongside WF1 against frozen interfaces. Add/reuse the broker around existing file readers. Capture the originating intent, commit a pending presentation destination immediately and acquire the required owner reading once per equivalent in-flight request. Hand the reading to admission and renderer consumers. Bind results to source/access epoch and revision; retain native admission/CAS checks.

Warm reopening finds the existing binding/model first. Cached reconstruction can present an allowed last reading while owner validation runs. Revalidation does not blanket-disable local drafting. Fresh restart performs necessary admission directly for demanded subjects rather than browsing the tree to rediscover them.

Trace native HTML material delivery and eliminate avoidable repeated body acquisition without confusing text decoding, binary transport and authority. Ensure inspected content revision agrees with rendered content revision. Preserve ordering of mutations and resolve any measured queue head-of-line issue narrowly.

Exit: test a ten-second directory stall; file open/return remains independent. Equivalent concurrent reads join; stale completions and access-epoch changes cannot cross-contaminate entries; source-backed and ordinary-file HTML both use their correct owner paths.

### WF3 — HTML/material lifecycle and honest load states

Depends on WF0 interface agreement; final wiring uses WF1/WF2. Add the lifecycle adapter to MaterialSurface and controlled document hosts. A retained frame keeps its actual document, source and generation. Concealment no longer navigates to blank. Revalidation keeps last content rendered; only a committed replacement changes its generation.

Support and test pause/resume/checkpoint/ready messages for controlled Day/Flow pages through the existing secured bridge. Explicitly declare unsupported capabilities for arbitrary HTML/browser pages. Preserve sandbox restrictions and validate source/window/token/revision/generation. Restore selected Source/Rendered view and recoverable scroll/local document state.

Replace null chunk fallbacks with the shared local feedback. Separate read, refresh, save, render and interactive observations. A stale or late iframe load cannot make the current document ready. Optional Expression effects do not gate document readability.

Exit: a managed HTML fixture's document-instance token survives retained transitions, its hidden work actually pauses, and ordinary cached refresh produces no blank. Arbitrary-page policy and reconstruction limits are documented and exercised, not silently treated as managed documents.

### WF4 — Stable surface runtime and bounded residency

Primary integrator owns this shared shell work. Depends on WF0; destructive release rollout requires WF1, broker wiring WF2 and material adapter WF3.

Place runtime ownership above the replaceable mode/workspace/pane subtrees. Bind existing Surface IDs to stable runtime handles and slots. Integrate active/retained/released with focus and accessibility, without creating a second layout owner. Prove the chosen DOM/portal/slot implementation across split/move/maximize transitions rather than assuming a stable key is sufficient.

Use explicit per-kind retention and checkpoint policies. Bound warm sets by count and estimated/native-observed cost. Release clean reconstructible views first; protect unrecoverable dirty state. Separate UI suspension from native execution and necessary invalidation subscriptions. Do not eagerly mount every saved tab as the definition of restore.

Exit: repeat warm transitions with no attributable file body acquisition, iframe navigation, new editor model or native process spawn; show bounded retained resources and safe eviction. Reveal/release must work without QL or the Expression stage being available.

### WF5 — Whole workspace, arrangement and native-window continuity

Depends on WF4 and durable recovery. Extend the actual v2 mode tree model, not the inspected older v1 shape.

Compute logical open membership across all workspace arrangements and detached placements. Separately track native-admitted IDs and resident/visible IDs. The union prevents accidental close when leaving an arrangement; it is not an instruction to owner-read and admit every inactive saved tab at startup. Only the explicit last logical membership removal invokes the relevant close semantics. View release uses view/lease semantics, not a semantic close disguised as cleanup.

Mode/workspace switching selects presentation and transfers contextual focus. It does not clone the current conversation, reset sidebar drafts/context, lose a pinned subject, cancel a task or create a new owner session. Preserve per-view state for cheap side panels even when their DOM releases. Fast return to the previous workspace uses the bounded warm set instead of a mandatory full cache flush.

Detach/redock checkpoint and transfer native leases through existing handlers; reconstruct the renderer in the receiving window where required. Rapid switches are last-intent-wins, while in-flight document operations land safely in their originating scope without stealing current focus.

Exit: the full user journey passes across modes, workspaces and windows, including a native terminal whose process identity survives supported viewer transitions. Restart uses saved bindings and independent navigator restoration.

### WF6 — Navigator continuity and coherent refresh

Depends on WF2; can run alongside WF3/WF4. Replace per-Directory listing ownership with broker subscriptions; keep per-workspace navigation checkpoints from WF1. Collapse can dispose row components without disposing their reading. Use cached expansion and bounded visible row rendering; preserve keyboard navigation and scroll without re-enumerating an already-read subtree.

Aggregate actual pending work into one unobtrusive navigator indicator, with a small local placeholder for an uncached expanded folder. Refresh errors retain the allowed last listing. Wire exact owner change receipts and bounded reconciliation for external edits, reconnect and watcher gaps; do not blanket-refresh all directories on unrelated activity.

Exit: collapse/re-expand is a cache operation; an unrelated changed file causes no whole-tree reread; a remote/unavailable project does not block local-file reading; a large tree has bounded DOM and correct focus/scroll.

### WF7 — Adversarial replay, performance and evidence handoff

Depends on the integrated WF1–WF6 result. Execute the matrix below and publish raw counters/traces, timing samples, faults injected, selected workload budgets and unresolved limitations. Run current repository build and relevant tests rather than declaring success from static assertions. Test the actual Tauri/material path separately from the development bridge. Record actual installed/native and human evidence under the current campaign gates; do not simulate it with fixtures or close #65/#375 by implication.

The first integrated vertical proof is HTML -> another tab -> another mode -> another workspace -> return -> process restart, with the tree stalled. Establish this before broadening all surface kinds. Then generalize using the declared adapters and the matrix.

## 4. Verification matrix

These test IDs are proposed coverage, not claims of existing tests or passing results.

| ID | Scenario | Required observation |
|---|---|---|
| C01 | Switch away from and back to unchanged warm HTML 100 times | Same document-instance identity; zero visibility-caused navigation/body reads; p95 warm reveal target <=50 ms. |
| C02 | Tab move, split/merge, maximize/restore | Stable subject/view; no accidental iframe reload; exact caret/scroll or supported checkpoint restoration. |
| C03 | Change arrangement repeatedly | Same open bindings; last requested mode wins; no native close/open churn caused only by concealment; <=100 ms p95 retained return target. |
| C04 | Workspace A -> B -> A within budget | A's views/models survive appropriately; B never receives A's late open or focus completion. |
| C05 | Delay every directory-list response by ten seconds | Warm file return and independent direct file acquisition are not waiting for the tree; pending destination appears promptly. |
| C06 | Cold file with three simultaneous equivalent consumers | One coherent acquisition shared; owner admission remains real; errors reach each correct consumer. |
| C07 | Native HTML versus bridge HTML | Declared revision equals served/rendered basis; count owner acquisitions and transport deliveries separately. |
| C08 | Source-backed HTML/Day versus ordinary HTML | Correct existing owner route, draft basis and material lifecycle in both cases. |
| C09 | Cached collapse/re-expand; large visible tree | No unnecessary readdir; <=50 ms p95 cached expansion target; DOM proportional to visible rows, not all visited nodes. |
| C10 | Refresh fails after successful file/directory read | Allowed last content remains readable; error and retry local; empty and unavailable not conflated. |
| C11 | External file edit with dirty local draft | New canonical revision is observed; draft preserved; no silent overwrite; CAS conflict remains enforced. |
| C12 | Older slow read completes after newer read/receipt | Older value rejected or kept only as its own historical reading; current revision never rolls backward. |
| C13 | Rename/delete while hidden; path later reused | No identity confusion with replacement file; source availability and recovery choices truthful. |
| C14 | Owner/transport change, receipt gap or watcher overflow | Relevant entries revalidate; authorization partition respected; no silent eternal freshness. |
| C15 | Access revoked or different user/World uses same path | No cached authority reuse or prohibited disclosure; owner retention policy applied. |
| C16 | Force-release all disposable views | Working models, drafts, selections and logical open membership survive; no keep-mounted-only success. |
| C17 | Close/relaunch application | Workspace/per-mode layouts, demanded tabs and supported checkpoints recover independently of tree traversal. |
| C18 | Crash after acknowledged draft checkpoint | Acknowledged content survives; any unacknowledged loss bounded by the declared policy and reported honestly. |
| C19 | Corrupt one workspace, one binding, one view checkpoint | Valid siblings recover; originals quarantined; fallback never overwrites the only copy. |
| C20 | Truncated whole book, future schema, storage full | Last committed state/raw bytes protected; visible recovery/save failure; no silent downgrade or empty replacement. |
| C21 | Concurrent main and detached window writes | No lost tabs/drafts from whole-book last-writer-wins; checkpoint versions/origin fields correct. |
| C22 | Native terminal hidden, released, detached, redocked | Separate emulator attach and native spawn counters; intended owner process continuity; unsupported restart truthful. |
| C23 | Agent Run continues behind hidden view | Native work continues; hidden presentation polling/render work bounded; returning view catches up from owner state. |
| C24 | Managed HTML suspension; arbitrary HTML comparison | Managed adapter acknowledges pause and removes its background work; unsupported page never falsely reports suspended. |
| C25 | Late load/ready message from retired iframe generation | Ignored; cannot clear the new surface's loading/error state or claim wrong revision ready. |
| C26 | Sidebar hide/remount and conversation relocation | Same conversation/session, drafts, pinned context and selection refs; no duplicate subscriptions or modal. |
| C27 | Cache budget exhaustion and failed checkpoint | Predictable eviction of safe candidates; dirty uncheckpointed work protected; bounded steady-state warm resources. |
| C28 | Restore focus after user already navigated/typed | Restoration does not steal focus, caret or selection from newer user intent. |
| C29 | No QL/GPU, reduced motion, keyboard-only operation | Ordinary files/loading/retention remain usable and accessible; hidden views are not focusable. |
| C30 | Repeated mixed-workload loop and idle sampling | No cumulative timers/listeners/iframes/leases; no unrelated tree refresh storm or hot-path full-book serialization. |

Warm timing targets apply to resident/cached test classes with no invalidation requiring replacement. Report 100 warm iterations, raw samples and p50/p95, with the same build/device/workload before and after. For slower cached reconstruction, cold start and process restart, WF0 records fixed fixture sizes, asset availability and budgets; do not move them retrospectively to disguise regression. A faster spinner or pre-painted screenshot does not count as interactive content.

Suggested new tests, only after checking local equivalents: `tests/workspace-continuity.test.mjs`, `tests/workspace-continuity-browser.mjs`, `tests/resource-coherence.test.mjs` and managed HTML lifecycle fixtures. Browser tests must instrument actual mounts/document identity and actual operations, not simply assert that an enum or CSS class exists.

The inspected package already declares `npm run build`, `npm run test:personal-web`, configuration tests and `npm run walk`. Read their current implementations and local instructions before selecting exact commands or extending them. Do not claim a test command exists merely because it is proposed here. Native/provider tests and physical Mac checks are separate evidence from a browser bridge run.

## 5. Cooperation, integration and delivery

The primary integrator owns shared contracts and writes to CradleFrame, Workbench, actual workspace/store, runtime host wiring, mode/native-window joins and final integration. Preserve one shared working tree for this feature and register file ownership before concurrent changes.

Subagent A owns broker/client/directory work and coherence tests. Subagent B owns FileSurface/MaterialSurface, managed HTML adapters and readiness tests. Subagent C owns recovery/checkpoint helper work and corruption/crash tests, handing integration patches for shared workspace/store to the primary rather than concurrently rewriting it. Any existing local ownership overrides these suggested boundaries until explicitly reconciled. Native changes are assigned narrowly after a measured contract gap, not by default.

Each work package returns implementation paths, contract decisions, exact revision, tests executed, actual result, trace/artifact paths and remaining uncertainty. The integrator updates the existing experience/wayfinder index and references this track from #375/#65 or their successors; do not invent completed issue IDs or replace those programmes. Runtime work uses its own reviewable implementation changes, distinct from this documentation-only planning change.

## 6. Copy-ready local-agent commission

> Work in the existing coherent O:I checkout for the current accepted UI. Read `docs/experience/WORKSPACE-CONTINUITY.md` and this wayfinder in full, plus current local instructions and the current #375/#289/#65 scope. Reconcile the actual local v2/per-mode and tripartite-retention work before editing. The remote research pin is evidence, not a request to reset or downgrade the checkout.
>
> Implement workspace continuity as three cooperating mechanisms: retained live views, shared revision-aware resource/working models, and durable restart recovery. Preserve native ownership, source admission, CAS, session/process identity, the current UI and one Expression stage per window.
>
> Establish WF0, then execute the bounded work packages. The primary is sole writer for shared shell/book/runtime integration; use at most three disjoint subagents as specified. Share the existing working tree; do not create a worktree per subagent or duplicate dependency/build trees.
>
> First prove one end-to-end HTML journey through tab, mode, workspace and process restart while the tree is delayed. Remove redundant read paths and `about:blank` suspension where still present. A cache-first display does not grant current authority; retain the native read/admission checks. A pending open belongs to its originating workspace and cannot steal focus after later intent.
>
> Persist dirty working state independently of component lifetime before enabling destructive eviction. Recover good workspaces/bindings around damaged records while preserving originals. Share and invalidate file/listing entries by real owner scope/ref/revision/epoch, with single-flight requests and stale-result protection. Keep tree restoration out of the known-file dependency chain.
>
> Retain stable view instances under bounded budgets and use explicit per-kind suspension capabilities. Cache directory data rather than all collapsed DOM. Keep native Runs/processes alive according to their owner lifecycle and suspend only disposable presentation work. Verify managed HTML pause/readiness through the secured bridge; do not pretend arbitrary pages can be generically frozen or checkpointed.
>
> Execute the verification matrix with real operation/mount/navigation/spawn counters, injected latency/failure and before/after traces. Include forced release, dirty drafts, external edits, receipt gaps, restart/crash, corruption, multiwindow writes and cache exhaustion. Do not stop at a three-value enum, hidden divs, static source tests, screenshots or a faster loader.
>
> Deliver exact commits, source/build identity, coverage and failures, performance samples and remaining native/physical/human acceptance. Update existing planning and evidence surfaces without claiming unperformed installed-app proof or closing broader programmes by implication.
