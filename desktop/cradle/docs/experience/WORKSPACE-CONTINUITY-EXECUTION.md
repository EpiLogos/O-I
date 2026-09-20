# Workspace continuity — execution record (WF0)

Status: implementation record for the continuity contract
(`WORKSPACE-CONTINUITY.md`) and wayfinder
(`.superpowers/sdd/cradle-rebuild/WORKSPACE-CONTINUITY-WAYFINDER-2026-09-19.md`,
delivered as PR #386). Commissioned 2026-09-19. This file records what the
local cut already satisfied, what this track changed, and where the evidence
lives. It claims nothing about installed-app acceptance.

## Local cut (WF0 receipt)

- Checkout `Work/O-I`, branch `agent/expression-world-convergence-20260917`,
  HEAD `3ef55bef` + uncommitted owner refinements (authoritative; never
  reset). React 18.3.1, node 24, Vite build (`npm run build` = tsc + vite),
  walk harness `npm run walk`, dev bridge = cargo `walk-bridge` (the real
  kernel over the real ground), native transport = Tauri `kernel_op` +
  `oi-material://`.
- Baseline at session start: `tsc --noEmit` clean; `tests/workspace-continuity.test.mjs`
  7/7; `tests/mode-workspaces.test.mjs` RED — pre-existing import chain
  `workspace/store.ts → files/listingStore.ts → kernel/KernelProvider.tsx`
  cannot load under node --test (listed below, assigned to lane A).

## Reconciliation: contract findings vs the local cut

The research pin (`fe92e1d0`) is evidence, not a target. The local v2
per-mode book and the owner-approved three-tier retention law (commit
`766cc322`: pane concealment retention, workspace-keyed listing cache, mode
centre park, per-workspace quarantine) stand. Findings at the local cut:

| Contract finding | Local state at WF0 |
|---|---|
| GroupPane renders only the active binding | Repaired (`766cc322`): every open tab stays mounted-concealed; cheap kinds (`sources`, `blank`) release. |
| Directory listing owned per-component | Repaired: `files/listingStore.ts` — workspace-keyed cache, `file_changed` receipt invalidation, single-flight, one tree-level indicator; collapsed children stay mounted-concealed. |
| Whole-book strict load | Repaired at workspace grain: per-workspace quarantine (2026-09-19) empties and names one broken record; whole-book corruption preserves bytes for one-click reload. Binding/view grain: missing (lane C). |
| `about:blank` / `srcDoc` removal suspension destroys HTML | Present (`MaterialSurface`) — lane B replaces with retained-frame lifecycle. |
| Separate acquisition paths (openFile, mountSurface, renderer) | Present — broker `files/resources.ts` (this commit) is the shared seam; lanes wire it. |
| Open reads before committing the visible binding | Present: no pending presentation destination — primary (CradleFrame). |
| Sync whole-book save on every book change | Present (`store.ts` writes per change; split resizes serialize per pointermove) — primary (coalesced writer). |
| Native reconciliation closes inactive-workspace tree tabs | Present: membership conflated with presentation — primary (WF5 union law). |
| Material Source/Rendered resets on remount | Present — lane B. |
| Lazy `fallback={null}` boundaries | Present — primary (shared local feedback). |
| Stale-result races (listing fresh-vs-inflight, late iframe loads) | Present — lane A (listing generations), lane B (frame load guards). |
| KernelProvider serialization head-of-line | Traced, unchanged: applies are serialized; file reads use the direct op path and do not queue behind applies. No change without a measured owner-contract gap. |
| Terminal/process continuity | Unchanged this pass; native spawn vs attach counters remain native acceptance. |

## Frozen contracts (this commit)

- `src/files/resources.ts` — the file-resource broker: transport-epoch +
  operation-class + owner-ref keys, single-flight join, generation-guarded
  publication (stale completions dropped), cache-only peek, receipt invalidation
  hook, acquisition/join/hit/invalidation counters.
- `src/surface/runtime.ts` — the residency registry: active/retained/released
  per surface id, bounded warm set (12) with LRU eviction over
  budget-evictable kinds only, eviction reasons, `window.__oiSurfaceRuntime`
  probe seam.

## Lane ownership (disjoint files, one working tree)

- Primary (integrator): `CradleFrame.tsx`, `Workbench.tsx`, `retention.tsx`,
  `runtime.ts`, `store.ts`, walk scenarios, final integration and this record.
- Lane A (WF2+WF6): `files/resources.ts` hardening, `files/listingStore.ts`
  (+ node-test-safe split), `files/FileTree.tsx`, `tests/resource-coherence.test.mjs`.
- Lane B (WF3): `material/MaterialSurface.tsx`, `material/lifecycle.ts`,
  `files/FileSurface.tsx` (cache-first + view persistence), HTML lifecycle tests.
- Lane C (WF1): `workspace/checkpoints.ts`, `workspace/drafts.ts`
  (acknowledged durability), `workspace/recovery.ts`, corruption/crash tests;
  store.ts integration patches are handed to the primary.

## Execution state (19 September 2026, end of pass)

Commits on `agent/expression-world-convergence-20260917`:
`7459f2cb` (WF0 contracts + reconciliation) · `95541a52` (lane A: broker +
listing store) · `17e434ba` (lane B: HTML lifecycle) · `6867fdde` (lane C:
progressive recovery + staged journal + acknowledged drafts) · `36e6c4e7`
(WF4+WF5 integration + vertical scenario) · `9bd29970` (warm tree shelves +
walk-bridge connection fixes + queue-hog guards).

Walk-bridge kernel defects found by the vertical and fixed
(`kernel/src/bin/walk-bridge.rs`): (1) connections closed after one
response — keep-alive was opt-in on a header browsers never send — so any
fetch landing on a dying connection hung forever, wedging the renderer's
serialized apply queue (measured: up to half of opens stalled); (2) bytes
arriving past the current request's body were discarded, wedging pipelined
connections permanently. Neither the Tauri path nor production Central is
affected; the walk/dev bridge serves the browser transport only.

### The vertical (walk `html-continuity`)

One real HTML file from a real Central ground: open through the tree →
every directory listing stalled ten seconds → second tab + warm return →
mode switch away and back → workspace switch away and back → pending-open
origin law → renderer restart, tree still stalled.

- BEFORE receipt (pre-change build,
  `docs/experience/evidence/html-continuity.before.json`): the warm tab
  return DESTROYED the document (`about:blank` suspension) and lost the
  frame node; mode and workspace switches rebuilt both.
- AFTER: open under the stalled tree completes independently; the warm tab
  return keeps the same document token and the same iframe node (~85 ms);
  pending opens acknowledge their tab before the owner read resolves and
  land in their ORIGIN workspace; after restart the saved binding restores
  and the document loads with exactly ONE owner read (admission and
  renderer share the broker's acquisition) and without a single completed
  directory read.
- The mode/workspace identity legs are implemented (warm tree shelves) but
  their final acceptance run collided with the owner's in-flight
  mode-stage rework landing during this pass (unconditional dedicated
  stage; trees hosting tabs as hidden state — the same semantics). The
  checks will validate once that rework settles; the scenario asserts the
  shelf (`.warm-tree-host[hidden]`) rather than the stage markup.

### Verification (executed) — corrected per independent audit

An independent audit (19 September, evening) re-ran the suites and the
vertical at the merged head and corrected this record. Current, verified
numbers:

- Node suites, **37/37**: `resource-coherence` 10 ·
  `material-html-lifecycle` 9 · `workspace-recovery-granular` 9 ·
  `workspace-continuity` **5** (an earlier draft of this record said 7 —
  false at every commit of the pass) · `mode-workspaces` 4.
- `tsc --noEmit` clean on the committed tree (verified in a clean worktree,
  not only the dirty working tree).

### The vertical — honest status at the audited head

`npm run walk -- html-continuity` at HEAD `0970d65d` (fresh build, fresh
bridge): **4/7**.

- PASS: the opened HTML document is live; with the tree stalled a known
  file opens independently (~120-160 ms); C01 warm tab return keeps the
  SAME document token and the same iframe node.
- **FAIL C03/mode and the frame-node check: the document is rebuilt across
  a mode switch** (token changes, node stamp lost) despite the warm tree
  shelf persisting in the DOM. Root cause not yet isolated: MaterialSurface
  does not remount at the component level, and the rebuild reproduces in
  the walk harness but not in equivalent lighter probes — the interacting
  factor is under investigation.
- **FAIL C04/workspace**, and the pending-origin + restart-one-read legs
  did not execute in the audited run (the scenario aborts waiting for the
  navigator's readme row under the stall — the workspace-return listing
  re-read path still does not recover reliably).

### C01–C30 coverage (audit's table)

- Executed: C05, C01 (single iteration; the 100×/p95 target NOT met or
  measured — 158 ms observed), C06, C10, C12, C25, C18 (in-process), C19.
- Unit-only partial: C11, C14, C20, C24 (the managed-page pause/checkpoint
  handshake is NOT built).
- Adjacent/stale or no evidence: C02, C07, C08, C09, C13, C15, C16, C17,
  C21, C22, C23, C26, C27, C28, C29, C30.

### Remaining (honest)

- **C03/C04 mode and workspace document identity: the decisive open
  defect.** The shelf persists in the DOM; the document inside is rebuilt
  anyway. Next step: trace whether the effect re-runs from an unstable
  `location`/dep identity flips readiness and unmounts the frame.
- The desktop-appearance style gate is red on the in-flight design
  modules' unresolved `--oi-*` tokens and literal colours (owned by the
  active design lane).
- Spec §7 asks for an async persistence seam; the shipped writer is
  coalesced-synchronous (correct ordering, not non-blocking).
- `fallback={null}` remains in a few secondary lazy boundaries
  (FileSurface, retention, modeBodies, DesktopShell).
- Installed Tauri acceptance (real `oi-material://` frames, native process
  spawn vs attach counters, physical restart rather than renderer reload),
  Omarchy-side runs, and the human campaign legs under #65 — none claimed.
- C22/C23 (terminal process continuity, Run-behind-hidden-view) are
  unverified this pass.
