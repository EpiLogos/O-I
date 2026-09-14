---
name: capability-matrix
description: "METHOD: Reconcile and update the inter-S0–S5 capability matrix — recover claims, verify against the actual trees with cited static evidence, stamp conservative standing, apply the corpus's receipt laws, and regenerate the matrix artifacts."
---

# Capability matrix steward

Use this Skill when work adds, changes, or audits a capability claim in the ONE inter-S0–S5 matrix — recovering intent from tickets/PRs/receipts, reconciling it against what the trees actually carry, and keeping the matrix honest about gaps.

## Where things live

```text
O-I docs/CAPABILITY-MATRIX.md          — the human-readable matrix (O:I holds the top-end matrix)
O-I suite/capability-matrix.json       — machine-readable envelope (epilogos-recovery/capability-matrix/v1)
Work/github-recovery-mirror/ledger/    — the recovery ledger the matrix is assembled from:
  capability-entries/  claims (capability-entry/v1 records)
  reconciliation/      verdicts vs the trees (per source, cited evidence)
  receipts/            the corpus's correction laws (retraction map, dated assertions)
  capability-matrix/   assemble.py + render_md.py — regenerate both artifacts
index/issue-pr-graph.json             — citation graph (claims → issues → PRs → SHAs)
```

## Verdict vocabulary (use exactly these)

```text
landed          the tree demonstrably carries it (cite file path + symbol/test)
partial         some landed, some missing (cite which parts)
claimed-only    argued in tickets/PRs; no tree carries it
historical      existed once; removed or superseded (cite the removal commit if findable)
uncertain       could not determine statically; say exactly what would settle it
```

Aggregate rule — **conservative**: the weakest non-historical source verdict governs a merged record; historical annotates; per-source verdicts stay visible in the JSON. A claim you cannot back with a cited path/commit is `uncertain`, never a guess.

## Receipt laws (apply to every record)

1. **Timestamp-bound closures.** "Closed as complete on \<date\>" survives; "is complete" does not. Closures must cite their date.
2. **Implementation language is part of acceptance** (asd#116). The Central/Workcell JavaScript programmes and Factory's Python spike are voided programmes; claims sourced only from them are non-authoritative.
3. **Physical acceptance is no parking reason** (O-I#97, 2026-08-23). "Needs physical acceptance" does not justify parking otherwise-complete implementation off main.
4. **Aggregate counts are not set-completeness** (O-I#97, 2026-8-21). Verification lanes test the selected candidate state, not selection completeness.
5. **S-only scope.** S and S0–S5 only; S′/M/M′ material is out of scope and stays excluded at extraction.

## Procedure

1. **Ground.** Read the current matrix + the receipt laws above before touching any record.
2. **Recover claims.** New intent enters as capability-entry records from frame-layer extracts, §21 tickets, or receipt assertions — with `why_this_exists` and evidence refs, before any verification.
3. **Reconcile statically.** Static evidence only: ls/rg/git-log against the trees. No builds or tests in repos with live actors; recommend test runs instead of running them there.
4. **Stamp and aggregate.** Verdict + cited evidence per source; conservative aggregate; historical annotates.
5. **Regenerate.** `python3 assemble.py && python3 render_md.py` in `ledger/capability-matrix/`; land refreshed artifacts in O-I `docs/` + `suite/` (pathspec commit, main — never a branch).
6. **Promote honestly.** No generated text promotes itself: a standing change is an acceptance event for the matrix owner. Record it with its date and source.

## Ownership

O:I holds the top-end matrix; Central owns the readable tree/map of it (follow-on wiring into `Control/relations/source-relations.json`); AIKit registers this Skill like any other native source. This Skill makes the ledger workflow legible; it does not move verification into O:I — evidence stays in the trees.
