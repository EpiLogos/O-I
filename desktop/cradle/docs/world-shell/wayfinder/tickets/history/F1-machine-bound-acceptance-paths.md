# F1 — Machine-bound absolute defaults in the agent-shell acceptance gates

Label: wayfinder:task (fault from verdict V1, 9 Oct)
Claimed-by: — (resolved; lane zcode:shell-faults-f1-f4 died mid-flight → zcode:shell-faults-f1-f4-r2 completed)

## Resolution — 2026-10-09 (committed by orchestrator as seat `a120086e6`)

The dead hand's derivation was sound and complete — kept and verified, not
redone: defaults derive from the module's own location (programme-tree
walk-up, else Central-ground lane scan), env overrides stay, a missing
oracle refuses by name. Zero machine-bound strings remain in the four
files; gates 12/12 green from the seat AND from a foreign cwd
(`r2-f1-foreign-cwd-run.txt`), plus a copied-checkout probe. Status:
**resolved**; computer-use leg open machine-wide (not waived).
Blocked-by: —

Zones: `packages/live-shell/ui/tests/agent-shell-tokens.test.mjs`,
`tests/agent-shell-status-info.test.mjs`,
`tests/agent-shell-transport-ids.test.mjs`,
`tests/support/agentShellHarness.mjs`.

## Fault (V1, code-reading + scripted-suite)

The acceptance gates default to machine-bound absolute paths
(`tests/agent-shell-tokens.test.mjs:6`, `-status-info:7`, `-transport-ids:9`,
`tests/support/agentShellHarness.mjs:30-32`). The suite is green only in
THIS seat: on any other checkout the gates resolve evidence against a
hardcoded machine root — the L3 row ("suite + typechecks green in the seat")
silently weakens to "green on this Mac".

## Fix shape

Derive every default from the module's own location
(`import.meta.url` / `process.cwd()` of the package), never an absolute
machine path; the environment override stays, the default travels. Verify:
run the gates from a different working directory and (if cheap) a copied
checkout; existing green runs stay green in this seat.

## Evidence / acceptance

Gates green with no machine-bound string remaining in the four files; a run
from a foreign cwd recorded in the lane's evidence; one bounded commit by
the orchestrator.
