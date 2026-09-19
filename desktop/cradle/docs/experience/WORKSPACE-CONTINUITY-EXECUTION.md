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

### Verification (executed)

- Node suites, 39/39: `resource-coherence` 10 (C06 single-flight join, C12
  stale race, C10 last-reading, epoch partition, receipt semantics) ·
  `material-html-lifecycle` 9 (C25 retired-generation guards, view
  persistence, static no-`about:blank`/no-suspension-mutation) ·
  `workspace-recovery-granular` 9 (C19 sibling recovery, C20
  last-known-good, C18 draft bound) · `workspace-continuity` 7 ·
  `mode-workspaces` 4 (updated to the owner's Epi-Logos refinement).
- Walk receipts: `files` 23/23 · `material` 8/8 · `shell-recovery` 35/35 ·
  `workspace-continuity` 9/10 · `html-continuity` 4/4 checks run before the
  mode-step collision (tab tier + C05 stall law proven; mode/workspace legs
  as above). `tsc --noEmit` clean throughout.

### Remaining (honest)

- Mode/workspace identity acceptance: blocked on the owner's in-flight
  mode-stage rework settling; the mechanism (warm shelves) is in.
- Installed Tauri acceptance (real `oi-material://` frames, native process
  spawn vs attach counters, physical restart rather than renderer reload),
  Omarchy-side runs, and the human campaign legs under #65 — none claimed.
- C22/C23 (terminal process continuity, Run-behind-hidden-view) are
  unverified this pass; the queue-congestion fix removes one measured
  cause of delayed UI catch-up but no native claim is made.
- Restored pending bindings after a restart have no completion path yet
  (they render as permanently opening); a restore-time re-acquire should
  complete or retire them (next pass, openFile's completion reused).
