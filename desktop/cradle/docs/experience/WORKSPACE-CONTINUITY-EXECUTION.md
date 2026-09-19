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

## Evidence

Walk receipts land in `walk/artifacts/`; browser probes in `tests/artifacts/`.
The first integrated vertical (HTML → tab → mode → workspace → return →
restart, tree stalled) is recorded in this file's Trace section as it lands.
