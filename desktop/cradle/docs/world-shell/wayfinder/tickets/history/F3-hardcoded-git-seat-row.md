# F3 — Hardcoded `Git · seat (env-1)` row in the agent-shell browser (O1 breach)

Label: wayfinder:task (fault from verdict V1, 9 Oct)
Claimed-by: — (resolved; lane zcode:shell-faults-f1-f4 died mid-edit → zcode:shell-faults-f1-f4-r2 redone)

## Resolution — 2026-10-09 (committed by orchestrator as seat `a120086e6`)

Redone (same dead-hand state as F2): Git rows derive from
**`workcell_status_read`** — the workcell family's seat reading — and carry
the reading's own `workcell_ref`; refusal names the absent source. The
`env-1` literal is dead from product source (grep-verified). Unit tests +
live battery green. Status: **resolved**; computer-use leg open
machine-wide.
Blocked-by: —

Zones: `packages/live-shell/ui/src/agent/AgentShellBrowser.tsx` (row at
:64) and its test.

## Fault (V1, code-reading)

The browser's Git category carries a hardcoded machine-bound row —
`Git · seat (env-1)` (`AgentShellBrowser.tsx:64`) — a string naming THIS
machine's seat where the workcell family's reading should stand. O1: the
workcell family's devices derive from its manifest/owner readings, not
from literals about the machine the code was written on.

## Fix shape

The Git rows derive from the workcell seat reading (the machine's
registered workcell/seat state, same source the workcell family manifest
declares). Absent a live reading, render the honest empty/refusing state
that names the absent source. Never a machine-bound literal.

## Evidence / acceptance

No machine-bound seat string remains; rows == workcell owner reading (or
named absence); unit test; scripted capture; computer-use pass confirms
once CUA is up.
