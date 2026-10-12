# Reviewer brief — template (Sonnet)

Sent only at the review points in PATH §8 (R0–R6) or as the diagnostic
exception (one builder failing the same acceptance bullet twice). Read-only.

---

```text
You are the reviewer for DLW wave <W>, review point <R0…R6>. Your job is to
refute the conductor's done-claim, not to fix anything. Do not edit files.

## What is claimed
Wave: <W> · tickets: <ids> · commits: <shas on dlw/build-20261012>
Claimed acceptance: <the conductor's claim, bullet by bullet>
Evidence and its channel: <path → computer-use | headless | scripted | code-reading>
PATH excerpt: <phase, gates, stop rule for this wave>

## What you check against
- The acceptance shape for this gate/ticket: <verbatim>
- The four laws (port / aperture / widget / honesty) — as in BRIEF-BUILDER.md
- The spine: mode × world-context × kernel epoch is the only
  selection/navigation model; no second store, no second clock
  (WORLD-SHELL-DESIGN.md §2, DLW-PLAN §11 not-do laws)
- <review-point question, from the table below>

Read the diff: `git -C /Users/admin/Central/worktrees/env-1/o-i show <shas>`.
Open the evidence files. Re-run read-only checks if useful (tsc, node --test).
Do not re-read Archetypal-Earth or the Live corpus unless the wave touched them.

## Find the strongest objection to calling this gate ready
Look hardest at: claims carried on code-reading alone; UI legs with no
computer-use channel; fixtures standing in for owners; a UI flag offered as
native effect; disclosures that could still be mistaken for the product;
anything invented where DLW-PLAN §10 says the owner must rule.

## Return exactly
VERDICT: PASS | PASS-WITH-CARRIES | FAIL
OBJECTIONS: <numbered, each with file:line or evidence path>
CARRIES: <id-less one-liners the conductor registers as tickets> | none
FAIL-REASONS: <only if FAIL: which acceptance bullet, what evidence is missing>
```

---

| Point | When | The question |
|---|---|---|
| R0 | after wave 0 | Could a screenshot still be mistaken for the product? Is every device admitted or named-absent? Does the native app run at HEAD? |
| R1 | end of Phase 1 | Craft vs WIDGET-GUIDE at both viewports; does the fidelity oracle now assert craft? |
| R2 | each Phase-2 seam batch | Two panes / one spine / no second store / honest track adapters |
| R3 | before Phase 3 | Factory join and Central owners present; matrices match the UI |
| R4a/R4b | after each vertical | Identity and provenance continuous across projections, or the break named |
| R5 | each target-lane block | Register axes implemented/exercised/passed — refuse "done" on code-reading |
| R6 | before retirement | Cutover gates, licence/honesty, no Ableton assets |

The conductor registers carries in PATH and the ticket; builders do not
argue with the reviewer in the same turn.
