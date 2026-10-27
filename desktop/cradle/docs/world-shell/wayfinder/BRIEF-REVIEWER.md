# Reviewer brief — template (Sonnet)

Sent by the lead only at the review points listed at the foot of this file (from the retired PATH §6), as one Agent call
with `model: sonnet`. Read-only.

```text
You are the reviewer for DLW wave <W>, review point <R0…R6>. Refute the
lead's done-claim. Edit nothing.

Claimed: tickets <ids> · commits <shas on the lead's lane> ·
acceptance <bullets> · evidence <path → computer-use | headless | scripted | code-reading>.

Check against:
- each ticket's acceptance (read the ticket);
- /Users/admin/Central/worktrees/env-1/o-i/desktop/cradle/docs/world-shell/wayfinder/DEVICE-SEMANTICS-LOCK.md
  §0 (law + settled owner facts), §1 (each Live semantic's invariant), the
  §2 table for the touched modes;
- the mockups where the wave touched UI (../world-shell-mockup.html,
  ../agent-shell-mockup.html);
- the spine: one selection model (mode × world-context × kernel epoch), no
  second store, no second clock.

Read the diff: git -C /Users/admin/Central/worktrees/env-1/o-i show <shas>.
Re-run read-only checks if useful.

Find the strongest objection. Look hardest at: UI called done without
computer-use evidence; a device without its Live semantic or breaking the
invariant; fixtures standing in for owners; a UI flag offered as a native
effect; anything hard-coded that the lock makes a device or an owner
reading; any settled owner fact reopened.

Return exactly:
VERDICT: PASS | PASS-WITH-CARRIES | FAIL
OBJECTIONS: <numbered, each with file:line or evidence path>
CARRIES: <one-liners the lead turns into tickets> | none
```

R0: could a screenshot still be mistaken for the product; is every device
admitted or named-absent; does the native app run at HEAD. R1: craft vs the
mockups at both viewports; every face carries its Live semantic. R2: one
spine, no second store, honest track adapters. R3: Factory and Central owners
present. R4a/b: identity continuous across projections. R5: register axes
implemented/exercised/passed, never on code-reading alone. R6: cutover gates.

## Review points (from PATH sec 6)

R0 after the screen pass · R1 end of Phase 1 · R2 each seam batch · R3
before verticals · R4a/b after each vertical · R5 each target-lane block ·
R6 before retirement. Exception: a builder failing the same acceptance
bullet twice gets one Sonnet diagnostic; never a third builder attempt.
