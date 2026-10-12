# CE1 — Central ctrl roster-read refusal: `self_source`

Label: wayfinder:task (execution lane — Central ctrl ground)
Claimed-by: zcode:ctrl-roster-ce1 (dispatched by orchestrator zcode:world-shell-orchestrator, 9 Oct)

## Resolution — 2026-10-09 (zcode:ctrl-roster-ce1, committed by orchestrator as Work/Central `9449881`)

**The contract sat at the validator.** Nobody sends `self_source` on a roster
read (request is `{scope, project}` only — kernel `agent_definition.rs:162-179`,
`flow.rs:287`). The refusal was stored-receipt deserialization: 4 of the 9
immutable acceptance receipts on the ground
(`~/.central/agent-profile-acceptances/`) carry `self_source` + 
`relational_logos` pins written by the owner's own self-integration line
(`feat/agent-self-integration-20261007`, `93aa397`, standing at
`worktrees/env-3/central`), and ctrl's `review()`
(`agent_profile_acceptance.rs:104-109`) deserializes each receipt as
`Acceptance` under `#[serde(deny_unknown_fields)]` — so every roster loop
refused. The receipts are immutable personal evidence; the validator learns
the two legitimate fields: strictly typed `AgentSelfSourcePin {reference,
content_digest}`, `deny_unknown_fields` preserved, legacy receipts
byte-identical, regression asserts any other unknown field still refuses.
The full self-integration feature was deliberately not ported — it is the
env-3 line's standing work.

Executed: reproduced first (exit 2 against installed ctrl rev `00517952b8c8`);
regression red-before/green-after; acceptance 7/7; full crate **774 passed,
0 failed**; real roster read against the rebuilt binary **exit 0, 39
profiles**, the four pinned acceptances echoed verbatim. Evidence:
`new-shell/evidence/central-ctrl-self-source-ce1/` (contract analysis, diff,
before/after reproductions, verification log).

**Carry-forward (owner acts):** the installed `~/.local/bin/ctrl` and any
running bridge still run the pre-fix binary — the shell keeps disclosing the
refusal until the owner lands and reinstalls. Once landed, the shell lane
updates `new-shell/AGENT-SHELL-ACCEPTANCE.md` (~lines 75-77: the "roster
refusal disclosed by name" bullet is superseded by a green roster read) and
row O3 records its live evidence; the in-shell disclosure
(`AgentSessionsProvider.tsx:209`) needs no code edit — it simply stops
firing. Status: **resolved** (code landed at the native owner; binary
replacement is the owner's landing act).
Blocked-by: —

Zones: `Work/Central/ctrl/src/agent_profile_acceptance.rs` and its tests.

## Question

The agent shell's roster reads are refused by a Central ctrl bug: unknown
field `self_source` in `agent_profile_acceptance.rs`. The agent-shell lane
carried it to this owner and discloses it by name in the shell; this lane
owns the fix at the native owner.

- Read both sides first: which side holds the contract — is `self_source`
  a legitimate field the acceptance validator lacks, or a field the sender
  should not send? The fix is at whichever side the contract names; do not
  widen validation to make a test pass.
- Implement the bounded fix, add the acceptance regression, and verify the
  shell's roster reads stop refusing against the real ctrl.

## Evidence / acceptance

ctrl accepts the roster reads (regression test green at the native owner);
the shell's named carry is removed and its disclosure updated; the
ownership map reconciled. If the contract genuinely belongs to a different
owner (sender-side), the ticket returns with that finding and the precise
owner named — that is a valid resolution.
