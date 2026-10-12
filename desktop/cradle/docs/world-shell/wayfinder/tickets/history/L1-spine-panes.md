# L1 — Spine and panes (seams 1-3)

Label: wayfinder:task (execution lane)
Claimed-by: — (resolved; lane zcode:spine-panes-l1, committed by orchestrator as seat `0d69d5b2c`)

## Resolution — 2026-10-09 (zcode:spine-panes-l1; committed `0d69d5b2c`, 13 files +787/−12)

All three seams landed: (1) projection pane kinds in the surface engine
(instance identity kind+subject — two panes, two projections of one
subject; frame grammar, Workbench arm, layout codec admit the kinds;
hidden retention untouched; modeLayouts compose); (2) the ProjectionModule
contract (`surface/projectionModules.ts`, one-module-per-kind admission
door that refuses replacement) + React host (`projectionPane.tsx`,
per-pane encounter view, concealed-retained visibility, epoch remount) +
a labelled reference implementation admitted nowhere; (3) the encounter
bridge (`encounterBridge.ts`: mode × WorldContext × accessEpoch,
epoch-guarded, transitions through `book.setContext` as the one owner;
Atlas five-state mapping on the contract;
PROJECTION-MODULE-CONTRACT.md gives the atlas port's `mount.ts` its
adoption shape). The recorded App.tsx fault fixed: Session/Arrangement are
presentations of ONE Timeline projection; a presentation is not a mode
switch.

Verified: cradle suites 31/31; ui suites green (incl. native-composition-
views 29/29 parsing App.tsx's AST); **package tsc exit 0** (orchestrator
re-ran); the scripted seam walk captured (two panes/encounter/conceal-
reveal/epoch retirement); and the integrated live battery — **18
observations, 0 faults against the patched kernel bridge** — closing K1's
deferred needle verification on the same run. Named at baseline, not this
lane's: 15 pre-existing cradle TS2550s; hosted-contributions baseline
drift. Open successors: the main area is still resident-composed — the
final pane-tree promotion is designed, seam-ready, not landed; projection
pane detach not admitted; live native acceptance stays with the owners.
Status: **resolved**.
Blocked-by: —

Zones: `packages/live-shell/ui/src/App.tsx`, `continuity/`, `native/Workbench.tsx`,
cradle surface engine additions. No other lane edits these regions.

## Question

Execute design seams 1-3 (`WORLD-SHELL-DESIGN.md` §10):

- Projection pane kinds in the surface engine; the pane engine composes the
  main area per mode (`modeLayouts`).
- The encounter bridge — mode × WorldContext × kernel epoch — as the only
  selection spine; no second navigation model.
- Hidden-inhabitant retention preserved (projections keep mounting while
  hidden; return restores camera/selection/time).
- Session and Arrangement become presentations of one Timeline projection —
  resolving the recorded audio-mode coupling fault.

## Evidence / acceptance

Typecheck + build pass; existing native tests pass; a computer-use walk shows
two panes holding two projections of one subject with encounter continuity;
crosswalk accounting updated for touched targets.
