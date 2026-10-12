# F4 — Parameter-address table holds 28 rows against the claimed 29

Label: wayfinder:task (fault from verdict V1, 9 Oct)
Claimed-by: — (resolved; lane zcode:shell-faults-f1-f4 → zcode:shell-faults-f1-f4-r2 completed)

## Resolution — 2026-10-09 (committed by orchestrator as seat `a120086e6`)

**Miscount, not a missing control.** Scripted enumeration
(`r2-f4-enumeration-receipt.txt`): the pool renders exactly the §14 table's
rows; every parameter-bearing compact-rack control maps to a row; the admit
lights are the rack's readings mechanism, not parameters. The claim in
AGENT-DEVICE-OWNERSHIP.md is corrected 29→28 with the reason recorded (the
register ground is not a git repo — the correction stands as authored
ground). The table was never padded; a new unit test asserts the count from
the table itself (28 = 7+7+4+5+5). Status: **resolved**.
Blocked-by: —

Zones: `packages/live-shell/ui/src/agent/agentParamAddresses.ts` (:67-105)
and the claim site `new-shell/AGENT-DEVICE-OWNERSHIP.md` (:78); its test.

## Fault (V1, code-reading)

The ontology claim (accepted record, ownership map) says **29 controls on
§14 typed parameter addresses**; the shipped table holds **28**
(`agentParamAddresses.ts:67-105` vs `AGENT-DEVICE-OWNERSHIP.md:78`). Either
a control is missing from the table or the claim overcounts — both are
fidelity faults: the record and the shipped surface must agree.

## Fix shape

Reconcile at the source of truth: enumerate the controls the agent-shell
device/rack actually renders, derive the row per §14's grammar
`{family, device-instance, key, type, range/unit, write-path}`, and make
table and claim say the same number for the same set. If the 29th was a
miscount, correct AGENT-DEVICE-OWNERSHIP.md with the reason recorded; if a
control is missing, add its row with its owner — never pad the table to
meet the claim.

## Evidence / acceptance

Table rows enumerated and matched one-to-one against rendered controls
(scripted); claim site corrected or table completed with the diff named;
unit test asserting the count from the table itself.
