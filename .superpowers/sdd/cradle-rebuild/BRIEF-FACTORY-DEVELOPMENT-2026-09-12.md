# BRIEF — Factory development reads, the first 6D consumer — 2026-09-12

Queue cell 3 (NEXT-SESSION-PROMPT-2026-09-12). Fresh survey of the INSTALLED
owners (published operations only, probed this session):

- `factory 0.1.0` @ `f12b36c51126`: the `development` read family is LIVE —
  `project <state> <project-ref>`, `journey <state> <journey-ref>`,
  `run <state> <run-ref>`, `workflow-units <state> [run-ref]`,
  `workflow-unit <state> <ref>`, `execution-telemetry <state> <ref>`,
  `commission-read`, plus `conformance developmental-state <output>` (the
  owner's own specimen generator, used by the walk). Contracts:
  `factory.project-reading/v1`, `factory.workflow-unit-list-reading/v1`, …
  REFUSALS that name the drift: the kernel's existing `factory build
  discover --json [--project]` route is STALE — the installed CLI now
  requires `<state> <project-ref> <run-ref>`; `FactoryDiscover`/`Snapshot`
  answer "expected <state> <project-ref> <run-ref>".
- `workcell 0.1.0` @ `e4e40a91fe7e`: placement/material reads live —
  `status --json` (health/offers/providers/state_root/workcell_ref),
  `providers --json`, `instances list --json`; the receipt-bound material
  route already consumed by `MaterialRead`.
- The old U4.3 "Journey line" resolves natively: Factory owns developmental
  Journey/Run/unit/telemetry reads (this cell); Actuation owns activity;
  Workcell owns placement (status row here).

## Change

- `desktop/cradle/kernel/src/factory.rs` — `development_read`: run one owner
  development read (`<OI_BIN> factory development …`) with contract-schema
  verification per read; the state path is CALLER-SUPPLIED (the desktop
  never invents a Factory state) and passed verbatim.
- `desktop/cradle/kernel/src/lib.rs` — `KernelOp::FactoryDevelopmentRead
  {project, state_path, read}` (project-disclosure gate) →
  `FactoryDevelopmentReading`; `KernelOp::WorkcellStatusRead` →
  `WorkcellStatusReading` (`workcell status --json`, verbatim).
- `desktop/cradle/src/kernel/types.ts` + new
  `src/contributions/factory/development.ts` — typed ops/clients.
- `desktop/cradle/src/surface/Workbench.tsx` + `registry.ts` — surface kind
  `factory`; mounts `FactoryDevelopmentSurface`.
- `desktop/cradle/src/contributions/factory/FactoryDevelopmentSurface.tsx`
  (new) — the first consumer panel: state path (operator-typed fallback —
  no owner composition discloses it on this cut), project ref, explicit
  reads (project, workflow units) rendering the owner's contracts verbatim
  (journey/unit refs, revisions, provenance digests); the stale
  build-discover route is NOT shipped; owner refusals render verbatim;
  Workcell status row beside the Factory reads (placement is Workcell's).
- `desktop/cradle/walk/scenarios/factory-development.mjs` + `walk/run.mjs`.

## Walk contract (metrics)

1. Seed a developmental state through the owner's own generator
   (`factory conformance developmental-state`) in the walk's scratch ground.
2. Open the factory surface; the project read renders
   `factory.project-reading/v1` verbatim (contract, projectRef, a
   journeyRef); the workflow-units read renders
   `factory.workflow-unit-list-reading/v1` with unit refs and source digests.
3. A nonexistent state path renders the OWNER'S refusal verbatim; nothing is
   fabricated and no read auto-runs.
4. The Workcell status row renders the owner's health/offers/providers
   verbatim (or the owner's own unavailability).
5. Full regression floor green (all suites on the final bundle).

## Standing

Branch `agent/oi-factory-development`, cut from origin/main `1402e753` (#253).
Claim: brief pushed + draft PR before the build commit.
