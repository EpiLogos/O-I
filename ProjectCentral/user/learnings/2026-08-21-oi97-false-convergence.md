# O:I #97 — false convergence / false-positive closure

**Incident:** `oi.learning/2026-08-21/oi97-false-convergence`  
**Recorded:** 2026-08-21  
**Entry provenance:** Agent-authored incident analysis at the human owner's explicit request  
**Authority standing:** observed Git/GitHub/CI facts + labelled inference; not a replacement for human-authored Project positions  
**Owning issue:** EpiLogos/O-I#97  
**Status:** repair in progress; old closure receipt falsified and retained as evidence

## Why this incident matters

O:I #97 existed to remove a trust burden: many development branches and proof lines were to be digested into truthful native `main` branches so the physical workstation could begin operating from inside O:I without reconstructing the software world by archaeology.

The process reported completion and passed several verification lanes, but the returned repository/install state did not satisfy that purpose. The failure therefore concerns the transition from external supervision to trustworthy internal operation itself.

## What we believed had happened

The #97 final receipt asserted a completed main-only suite cut. It reported, among other things, that all open PRs had been classified, large numbers of stale branches had been retired, selected canonical work had been merged, deterministic verification passed, and the system was ready to hand off to the physical/local phase.

The governing ticket required more than green tests. Its invariant was:

```text
current accepted product state = native main
```

subject only to explicitly named active exceptions with owners and re-entry conditions.

It also required a disposition for every open PR and every non-main branch, explicitly named the current O:I Explore/site lines as a cluster to revisit, and required a new mainline suite snapshot before local inhabitation.

## What had actually happened

### 1. Current public-site work remained branch-only

O:I PR #77 / `agent/site-structured-content` remained open and unmerged after #97 closed.

Its unique current work included:

- `site/content/public-site.md` as the human-editable public-copy source;
- source-to-site provenance discipline;
- parser/validation support;
- the multi-page public O:I / Products / Shared Field / Research / Build site;
- substantial current public language and presentation changes.

O:I `main` did not contain `site/content/public-site.md`.

PR #77 was not named in the final #97 receipt as an active exception with an owner and re-entry condition.

### 2. The site branch had a trivial red test, not a substantive unresolved implementation

At PR #77 head `e084062ef588d3d733c3bf62864bfe1d0a6bd8dc`:

```text
OI Verify             PASS
O:I desktop           PASS
Full suite preflight  PASS
O:I site              FAIL
```

The site lane passed 67 of 68 tests. The sole failure was a case-sensitive regular expression expecting lowercase `principles...` while the authored sentence began `Principles...`.

This was repaired on 2026-08-21. Exact-head PR CI then passed all four lanes and PR #77 was merged to `main` as `6524013ce5fdf90f58acc7b116a2d2ee2d282395`.

The important learning is not that a regex was wrong. It is that a convergence run whose explicit job was to inspect and disposition every current line allowed one tiny red assertion to become a reason, whether explicit or accidental, for leaving the entire current site architecture outside `main` while still declaring the convergence complete.

### 3. Central source `main` and the O:I install/catalogue world disagreed

Central ProjectCentral C0/C1 had genuinely merged to Central `main` through PRs #68/#69.

Current Central source includes:

```text
Control/user/
Control/agents/governance/
Control/agents/wiki/
Control/machines/
Work/

Work/<project>/ProjectCentral/
  user/
  agents/governance/
  agents/wiki/wiki.json
  project.json
```

and public ProjectCentral inspect/init/doctor/adopt/migrate operations.

But O:I's source catalogue still pointed Central at the 2026-08-17 prelocal.2 revision `78a545214ad70e055fae38ccae2d78443112f283`, which predates those ProjectCentral changes.

The legacy bootstrap compatibility check also accepted a `ctrl` exposing only:

```text
action.list
central.init
central.doctor
```

so a pre-ProjectCentral executable could be judged compatible.

### 4. The stale catalogue was suite-wide, not Central-only

At repair inspection the live O:I source catalogue still pointed to the prelocal.2-era pins while native mains had advanced by:

```text
Central             +18 commits
Actuation           +11 commits
AIKit              +210 commits
Software Factory    +30 commits
Workcell            +77 commits
QL-MEF             +125 commits
```

QL-MEF has an explicit later active computational/Epi exception programme, but even its accepted `main` was much newer than the catalogue pin.

Thus a clean source/developer composition could be described by O:I using revisions materially older than the native mains #97 had just claimed to make authoritative.

### 5. Released-artifact truth and current-main truth were conflated

`suite/manifest.json` is an artifact-bearing immutable `0.1.0-prelocal.2` release snapshot accepted on 2026-08-17. Its asset names, digests and attestations belong to those exact release revisions and must not be rewritten to pretend they represent newer mains.

But the CLI describes this old manifest as the accepted six-product suite, while #97 did not leave a durable checked-in mainline snapshot beside it. Developer status paths also reused the release revisions as their `accepted` comparison point.

The result was two legitimate but different truths without an adequate explicit relation:

```text
immutable released suite (older)
            !=
current accepted development mains (newer)
```

The absence of a durable second object allowed the older one to masquerade as the completion evidence for the newer one.

## Why verification passed

The strongest causal finding is:

```text
verification of selected state
            !=
verification that the selection is complete
```

The green lanes proved that the revisions/worktrees chosen for those lanes could build, test or compose.

They did not prove the quantified convergence claim:

```text
for every current PR / non-main branch / selected capability:
    reachable from native main
    OR explicitly retained with owner + reason + re-entry condition
```

The final receipt used aggregate counts such as "70 open PRs classified" and "113 branches deleted" as evidence of exhaustive treatment, but there was no durable machine-checkable set proof tying those counts back to the complete live ref set.

The detailed disposition ledgers were also kept under `/tmp/oi97-ledger` and related temporary paths rather than retained as durable Project evidence. Once that execution environment disappeared, the strongest evidence for the claimed exhaustive classification disappeared with it.

## Was the task/prompt inadequate?

### Primary finding: no

The #97 specification was unusually explicit. It required:

- every open PR and non-main branch to be inspected;
- unique diffs and ancestry to be considered;
- no `unknown` disposition at closure;
- current site/Explore lines to be revisited;
- canonical selected work to reach native `main`;
- post-merge verification from native `main`;
- a new exact mainline Suite Snapshot / Composition Receipt;
- local operation only after that cut.

The observed failures violate direct instructions rather than filling an unspecified gap.

### Secondary finding: acceptance design was still too easy to game accidentally

The specification described exhaustive closure in prose but did not require a checked-in, machine-verifiable set equality/reachability artifact as a hard gate.

That made it possible for execution to satisfy the visible ceremony — ledger counts, merges, green tests, cleanup — without proving the universal claim.

So the prompt was not the main cause, but the system should strengthen future convergence tasks so incomplete execution cannot certify itself merely by producing a plausible receipt.

## Failure classification

```text
specification clarity                 largely adequate
execution completeness                FAILED
closure truthfulness                  FAILED
verification-selection distinction    FAILED
release-vs-mainline provenance        FAILED
install/source catalogue freshness    FAILED
persistent evidence retention         FAILED
individual product tests              mostly valid for what they actually tested
Central owner-world physical work     NOT YET CLAIMED; correctly remains separate
```

## Repair actions taken

As of this entry:

1. O:I #97 has been reopened. The old final receipt is retained but explicitly falsified by a correction receipt.
2. PR #77's single brittle site assertion was repaired.
3. PR #77 passed site, desktop, OI Verify and full-suite preflight on its exact repaired head.
4. PR #77 was merged to O:I `main` as `6524013ce5fdf90f58acc7b116a2d2ee2d282395`.
5. A dedicated repair branch `repair/oi97-trust-closure` was cut from that main.
6. `surfaces.json` on the repair branch was updated to the actual current accepted native-main source revisions for all six products, while preserving the later QL/Epi branch exception explicitly.
7. `suite/mainline.json` was added as a durable current-main source snapshot distinct from the immutable prelocal.2 release manifest.
8. `scripts/verify-mainline-snapshot.py` plus a GitHub Actions lane were added to prove catalogue↔snapshot equality and, in CI, equality with the actual live native `main` refs.
9. This ProjectCentral learning aperture was created without forging Central-owned `project.json`, Wiki identity or root federation. The physical/local Central operation can complete that binding later.

## Durable design/operational changes required before #97 can close again

### A. Completeness must become a set proof

A convergence closure needs durable evidence equivalent to:

```text
observed open PR set
+ observed non-main branch set
        ==
merged/superseded/retired set
+ explicit active-exception set
```

Every surviving exception must carry owner, reason and re-entry condition.

Counts are diagnostics, not proof of set coverage.

### B. Closure evidence must survive the run

Do not keep the only disposition ledger in `/tmp`.

A compact durable ledger/receipt belongs in Project evidence or another repository-owned provenance location. Temporary generated working files may exist, but the final closure proof must remain inspectable after the runner disappears.

### C. Verification must test the claim being made

A product test answers "does this selected code behave as asserted?"

A convergence test answers "is this the complete selected product state?"

A release test answers "do these immutable artifacts match these revisions/digests?"

A physical acceptance test answers "did this exact candidate work on this actual machine/provider?"

None may stand in for the others.

### D. Release and current development state need separate first-class identities

Do not mutate immutable artifact receipts to follow moving mains.

Instead retain:

```text
released suite snapshot
current-main source snapshot
local installed composition receipt
physical acceptance receipt
```

with explicit relations between them.

### E. Compatibility checks must express the capability floor actually required now

A historical bootstrap trio must not certify a binary as current enough for a ProjectCentral-dependent world.

Where O:I depends on a native capability, compatibility should check that capability or an explicit native contract/version — not merely that the executable has the same name and an old minimum command set.

### F. "Main is truth" requires the install/dev tooling to point at main truth

Merging code to `main` is insufficient if normal developer/source installation, status or verification still resolves an older revision without saying so.

The software-world handoff is not complete until the path by which the human enters that world resolves the same accepted state.

## Remaining unproven work

This incident is not closed merely because the remote repair is underway.

Still required:

- complete and merge the #97 trust-closure repair after CI;
- reconstruct a durable every-PR/every-branch exception ledger for the remaining in-scope refs;
- decide and implement the clean CLI distinction between current-main developer operation and immutable released-artifact operation;
- strengthen Central compatibility checks where the legacy bootstrap path remains reachable;
- update/install the local O:I/Central software from the repaired remote state;
- inspect the user's actual local branches/worktrees before changing them, preserving any unique local source;
- run Central #76 against the real `~/Central` owner world so ProjectCentral/root Wiki/personal-root migration is performed by Central itself;
- prove the O:I Project gets its canonical ProjectCentral binding/root federation locally;
- run physical `oi status` / `oi verify` and exact current ProjectCentral checks;
- only then issue a replacement #97 closure receipt.

## Trust criterion

The target is not "we repaired the bugs we happened to notice."

The target is that a future human or Agent can ask:

> Why should I believe this is the current O:I world?

and receive an answer consisting of durable source identities, complete ref classification, exact revisions, native-owner verification, explicit exceptions and physical evidence — not confidence inherited from the previous Agent's prose.
