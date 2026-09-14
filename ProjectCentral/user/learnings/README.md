# O:I learning ledger

This directory exists because system trust depends on retaining failures as inspectable source rather than rewriting the history after a repair succeeds.

It was created at the human owner's explicit request during the repair of O:I #97, after a convergence process claimed completion while material current work remained outside `main` and the install/release/source views described different software worlds.

## Standing and provenance

The **existence and purpose of this learning aperture are human-requested**.

Individual entries may be written by a human or an Agent. Every entry must state its provenance and evidence standing. Agent-written analysis does **not** become a human-authored position merely because it lives under `ProjectCentral/user/**`; where Central's authored-ground relation ledger is available, use it to record the accepted standing explicitly.

Use these distinctions:

- **authored position** — what the human deliberately means, requires or adopts;
- **design/operational commitment** — a rule the system is meant to preserve;
- **implementation fact** — what code/history actually contains;
- **observed result** — what a run, merge, test or incident actually returned;
- **current development state** — work underway but not yet accepted;
- **inference** — an interpretation drawn from evidence and labelled as such.

## What belongs here

Record incidents where the system created avoidable uncertainty, false confidence, provenance loss, duplicate work, stale state, misleading verification, destructive cleanup risk, owner-boundary confusion, or unnecessary human context repair.

The purpose is not blame or a museum of mistakes. The purpose is to make the causal mechanism recoverable so the architecture, tests, Skills, prompts and operating practice can change.

A useful incident entry answers:

1. What did we believe had happened?
2. What had actually happened?
3. Which evidence falsified the belief?
4. Why did the existing verification fail to detect it?
5. Was the failure in specification, execution, tooling, acceptance design, or several layers?
6. What concrete repair was made?
7. What durable guard now prevents or exposes recurrence?
8. What remains unproven or physically gated?

Do not delete an incident because the defect is fixed. Add the repair and later evidence to the same causal history.
