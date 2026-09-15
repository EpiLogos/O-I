# Native UI verification and comparative renderer receipt

Date: 2026-09-15. Scope: independent verification for the continued O:I UI convergence lane. No owner source, fixture, main checkout, or parent worktree was edited. All new harnesses/evidence live in this isolated directory. QL's ignored native Rust build cache was populated.

## Exact basis

- Factory verified accepted `origin/main`: `fb854dede9876a0ea008afd62422ef9150fe5203` (includes merged #237). Local owner main remains `2fc3590693b68426b63f329eea82b3d4fcb2742a`.
- QL native main: `3a3d7dbcf6a898ce88a9093f858b8f254fff3cfe`.
- O:I baseline archive: `5c7582e09f6d84b3e4a7372a73643177025d0e2c`.
- O:I current archive: `be172a109f2f5e307cc34a8c0f62cfdc6e5825b1` plus the parent's uncommitted runtime/design-system changes. `performance-basis.json` records every tested source hash; `oi-current.patch` retains the exact delta. Current source digest: `9d04cd9fb3e992d12ad368e998019756ffe8b52e0251e1417e3d6b89410d8c2c`.
- The parent `ExpressionStage.tsx` and `engineSurface.ts` still matched that snapshot when the measurements completed. Their SHA256 values are respectively `0c3f76e853277a94befbb2871202d1602054fb75089631596bc0ea68fc7267fc` and `aa7aa7f85cd220da5ccd30846e570de0ce737f85bf11ae2f833ff1c45399179a`.

## Factory owner verification

`factory-ui` was extracted using `git archive` from the accepted SHA. `npm install --no-audit --no-fund` then `npm run verify` passed TypeScript, 32 Vitest tests across 6 files, and the production library build. See `factory-verify.log`; the precise installed dependency versions are retained in this isolated archive's generated lockfile.

Actual component relationships retained:

- `BuildSurface`: semantic → live → trajectory depth; Project/Run/frontier, Candidates, Claims/Evidence, HumanRequests, owner Actions.
- Live depth: Agencies and Executions, preserving Actuation, AIKit, Workcell, native trajectory and session references.
- Trajectory depth: `SessionCards`, selected execution, `TraceWaterfall`, selected `SpanDetail`; standalone `ExecutionTraceExplorer` retains the same scoped root.

The accepted owner styles have no forced `oi-surface-dark`/local `color-scheme`; every style is scoped to `.fb-build-surface`. Browser verification rendered the actual built package under current O:I tokens in light and dark, all three depths. An outside-host sentinel retained its own font/color; one genuine UI action returned precisely `{actionRef, subjectRef}` to the supplied callback. At 639px the document and viewport were both 639px wide. This callback records the fixture's invocation; no live domain mutation is claimed. `factory-browser.json`, `factory-browser-verified.log` and `factory-{light,dark}-{semantic,live,trajectory}.png` / `factory-dark-639.png` hold the evidence. The light trajectory and dark narrow images were visually inspected.

Fixture corrections already merged in #237 and verified here:

- `fixtures/source-parity-expected.json` is asserted by `src/read-model.test.ts`; three derived lanes (`engineer`, `code`, `agent`) match the real shared-agency grouping. It checks native pin, span order, request zone, minimum block width, failure detail and absence of unsupported SSSF process events.
- `fixtures/dsh-trajectory.json` preserves the producer's null SessionSpace and Surface refs. `src/types.ts` declares `sessionSpaceRef?: string | null` and `surfaceRefs?: string[]` for the trajectory. Removed `sessionSpaceRevision` / `sessionSpaceLifecycle` had no producer.
- `fixtures/thin-trajectory.json` is exercised in `src/portable-only.test.tsx`: native detail stays unavailable rather than being invented.
- The obsolete unused `fixtures/sssf-session.json` is absent; `src/fixtures/sssf-parity.ts` is the canonical typed source specimen. `src/fixtures/factory-build.ts` composes the semantic maximal/thin cases.

No new Factory defect was found in this bounded owner verification. These controlled fixture views do not constitute a live commissioned Factory execution or #65 human experience acceptance.

## QL → Nara retained field

Built only `ql-mef` examples `k8_personal`, `k8_coupled`, and `m2_engine` with `cargo build -p ql-mef --example k8_personal --example k8_coupled --example m2_engine --locked` (36.71s), plus native C and the C++ field worker. All native C/C++ outputs are isolated under `native-c/` and `native-cpp/`.

The default macOS worker build first failed because the selected toolchain could not find `<array>`, then because `/usr/local` json-c is x86_64. The successful build uses the real SDK C++ include path as a system include and arm64 json-c from `/opt/homebrew`, retaining `-Wall -Wextra -Werror -pedantic` for native code. Exact compiler invocation: `ql-native-arm64-build.log`; earlier failed build logs are retained. No native source was changed to bypass these host configuration problems.

The pinned sky requirements were installed in `sky-venv/`. An unmodified copy of `scripts/test-k8-continuous.py` runs from `ql-source/`, with providers/fixtures/examples linked to the native source/build. This redirects only the script's ordinary relative output directory; its source hash is in `ql-source/source.json`.

Executed producer chain:

1. Actual calculated dated sky → native M2 → C++ persistent field: `ql-continuous.log`, `ql-source/target/k8-continuous/acceptance.json`. Stable 256 sample IDs, exact native replay, independent subjects/axes and atomic refusal passed.
2. `k8_coupled WORKER .../basis.json .../initial.json ql-coupled`: complete M1/M2/M3 current basis, atomic replacement, unchanged original sky, exact replay passed (`ql-coupled.log`).
3. `k8_personal WORKER ql-coupled/input.json ql-personal`: `ql-personal/acceptance.json` confirms seven independent receivers, one native owner, reception/replay do not advance the field, native sample advance does not rewrite the personal basis, replacement stales the old reception, explicit rereception restores currentness, M1–M5 focus retains one event, withdrawn consent refuses.
4. From the parent's Cradle directory: `QL_NARA_SNAPSHOT=/tmp/oi-ui-owner-verification-20260915/ql-personal/focused-snapshot.json node tests/nara-retained-field.mjs` passed. `nara-retained-field.log` records eight stable partitions, seven distinct GPU loci, no target replacement or reseed, atomic stale-generation and stale-lease refusal, and selective portable export.

The snapshot is genuine native example output with the example's declared controlled subject/receiver geometry. It is not a private person's lived/clinical data. This pass proves producer/renderer contracts; it does not prove physical correspondences or #65 acceptance.

## Actual-app before/after performance

Both isolated O:I archives ran `npm ci --no-audit --no-fund` and `WALK=1 npm run build`. See `oi-{baseline,current}-{install,build}.log`. The actual production WALK bundles run through Vite preview on ephemeral ports, with fresh processes of the same real native walk-bridge binary. Its SHA256 and full source/measurement conditions are in `performance.json`.

Two repetitions per revision, alternating baseline → current → current → baseline. Viewport 1280×820, headless Chromium ANGLE/SwiftShader, native kernel seam, real welcome → click → release → ordinary shell and explicit disabled preference. No substituted engine or fabricated backend. Preboot instrumentation counts RAF, canvases, successfully returned contexts, timers and observers. Chrome CDP reports renderer TaskDuration, heap and DOM counts. Other host applications/agents were active; these CPU values describe this renderer, not whole-machine or physical GPU utilization.

Each resting sample lasts 2.5 seconds. Early idle begins 1.2s after welcome removal; the final sample begins after another 4s (the first sample plus 1.5s settle).

| Observation | Baseline | Current |
|---|---:|---:|
| Settled idle RAF callbacks / 2.5s | 150, 150 | 0, 0 |
| Settled idle renderer CPU | 2.626%, 2.981% | 0.350%, 0.526% |
| Settled idle JS heap (unforced GC) | 17.726, 16.135 MB | 11.010, 11.048 MB |
| Active welcome engine WebGL2 contexts | 1 | 1 |
| Idle retained engine WebGL2 contexts | 1 | 1 |
| Disabled engine canvas / WebGL contexts | 0 / 0 | 0 / 0 |
| Shared 2D overlay contexts | 1 | 1 |

Baseline reports no presentations after release while continuing 60 RAF callbacks/second. Current reports `live=false`, `scheduled=false`, no presentations, and identical production frame counters across both idle samples (80 and 122 respectively). One early current sample includes one final window RAF; the later settled sample is zero. Median measured settled renderer CPU is about 84% lower. Heap snapshots are not a leak proof because GC was not forced.

The existing native event bridge still polls: 1 interval and 2 timeouts remain; observers remain attached for layout/theme ownership. They produce no continuing Expression simulation. Current settled DOM counts were 447 nodes/296 listeners (baseline 435–438/297); these snapshots show no duplication in this path and do not replace remount/long-duration testing.

Active welcome CPU was 1.415–2.218% baseline and 1.275–1.421% current; active RAF cadence varied, so this is not a frame-rate improvement claim. Enabled startup was also shader/cache-sensitive (baseline 0.137–4.031s; current 2.808–3.573s), preventing an overall startup speed claim.

A separate disabled-startup run isolates script loading without creating a WebGL context (`performance-disabled.json`):

| Observation, two repetitions | Baseline | Current |
|---|---:|---:|
| Script transfer bytes incl. walk channel | 823,976 | 167,392 |
| Shell/channel ready wall time | 206, 137 ms | 84, 83 ms |
| Renderer task time to that point | 132.8, 64.9 ms | 53.6, 53.4 ms |

This documents ~80% less script transfer on the disabled start path, with both measured current starts faster. No universal timing budget or unmeasured GPU benefit is asserted.

Raw evidence: `performance.json`, `performance-summary.json`, `performance-disabled.json`, runner logs, source hashes/patch, and `performance-{baseline,current}-{1,2}-{welcome,idle,disabled}.png`. Harnesses are `performance.mjs` and `performance-disabled.mjs`. Every browser and owned preview/bridge was closed after execution.

Remaining limits: no physical GPU measurement, no empirical long-duration memory claim, no new ordinary Expression authoring workflow or actual detached native-window acceptance in this bounded comparison. Parent runtime tests cover additional lifecycle cases separately. Native owner fixture/producer checks and browser observations remain distinct from #65 lived UX acceptance.
