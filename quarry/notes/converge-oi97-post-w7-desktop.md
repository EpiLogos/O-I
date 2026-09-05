# converge/oi97-post-w7-desktop

`origin/converge/oi97-post-w7-desktop` @ 328ccc8 (2026-08-25) · 5 commits ·
Class E SUPERSEDED-CANDIDATE (§3).

## What it is

The retired #97 "materializer": a workflow that pinned the W7 desktop cut
to live AIKit/Factory owner mains, republished the tested product cut,
and wrote durable six-product source snapshots — then retired itself
("[OI97] Retire post-W7 desktop materializer"). Its commit sequence is
the machine that produced the cross-repo pinned cuts the older desktop
branches consumed.

## Feature/function inventory

- **Mainline snapshot** — `suite/mainline.json` (schema
  `oi.mainline-snapshot/v1`): per-product pinned revisions with state and
  notes (e.g. central @ 31d54eb "accepted-main" with a capability note);
  explicit scope law: "O:I #97 live-main convergence applies to its
  explicitly named primary repository set; Quaternal Logic remains … not
  a #97 dependency gate"; `coordinator_rule`: O:I's own accepted commit
  lives in the owning PR/issue receipt, "rather than self-referentially
  inside this file".
- **Surface catalog** — `surfaces.json`: per-product public surface list
  (id, public_name, function, repository, docs_ref, docs_path,
  skill_paths) — a machine-readable §13-style surface accounting across
  the six products.
- **Materializer mechanics** — `.github/workflows/living-wiki-w7.yml` +
  `suite/living-wiki-w7.json` updates: refresh Flow/Living desktop
  against live owner mains, "publish tested product cut without workflow
  mutation", then retire.

## Map-unit mapping

- Pinned-cut discipline → §1 law 13 (sync before each unit; briefs pin
  product repos at exact commits): the materializer is the manual
  predecessor of the gate law, which supersedes it.
- `surfaces.json` cross-product catalog → §2.1/APP-SPEC §13 surface
  accounting shape (useful reference for the audit rows, not a merge).
- Self-reference avoidance rule (`coordinator_rule`) → law 13 receipts
  discipline.

## Quarry verdict

**NOTHING-NEW** — the rebuild's contract (law 13 gate loop + briefs that
pin) supersedes the materializer entirely; its own final commit says so.
The two JSON catalogs are noted here as reference shapes; recommend
QUARRY-DELETE without further ceremony.
