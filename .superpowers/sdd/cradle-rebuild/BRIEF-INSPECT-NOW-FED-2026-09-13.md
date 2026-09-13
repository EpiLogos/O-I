# BRIEF — The Inspect plane's NOW section, fed for real — 2026-09-13

Queue cell C (NEXT-SESSION-PROMPT-2026-09-12-2). The section shipped
honest-empty in #251; this cell feeds it from the session's actual task record
through #253's owner-read route and renders the owner's NOW relations in
place.

## Owner contract (probed live, evidence recorded)

- The desktop's task read is the owner's `encounter-task-read`
  (`aikit.encounter-task/v1`, #253). Its schema carries
  `allocation.allocation.now_ref` — the allocated NOW — when the owner's
  record holds one.
- MACHINE FACT (read from the owner's own `encounter_task.rs`): the record is
  PUBLISHED with `allocation: None` before the chain allocates, and the
  allocated record is published only AFTER the Workcell boundary succeeds.
  On this macOS cut the boundary always refuses (Linux-Landlock only), so a
  task-bound session's record here carries NO allocation — while the
  allocation itself DOES exist in Central (#253: read through
  `central.now.read` before the refusal). A ready, allocation-bearing record
  requires a boundary-capable host — the same owner-lane condition the #253
  echoed accepted dispatch waits on.
- The relations render through the owner: `central.now.read` via the #251
  kernel route (`NowRelations`), refusal verbatim, nothing inferred.

## Change

- `desktop/cradle/src/encounter/EncounterSurface.tsx` — the Inspect feed gains
  its second real source: when the session's task record (already read for
  the composer) carries an allocation, its `now_ref` joins the feed with the
  record's own register; refs already named by dispatch receipts stay
  first; no ref is invented when the record carries none.
- `desktop/cradle/src/encounter/EncounterView.tsx` — the section renders the
  owner's NOW relations IN PLACE (`NowRelations`: task, purpose, lifecycle,
  participants, sources, continuations) beside the bare ref/register line,
  instead of the ref alone; and it gains a truthful intermediate state: a
  task basis present but the owner's record carrying no allocated NOW renders
  that exact fact (preparation uncertain), distinct from the generic
  no-NOW empty state.
- `desktop/cradle/walk/scenarios/task-basis.mjs` — extended: the Inspect
  plane on the real task-bound session shows the truthful intermediate state
  (a real task basis, no fabricated ref, no fabricated owner read); the plain
  session keeps the generic honest empty state; the desktop issues no NOW
  kernel read for a ref it does not hold.

## Walk contract (metrics)

1. The task-bound session's Inspect plane discloses that a task basis reached
   it and that the owner's record carries no allocated NOW yet — the honest
   intermediate state, never a synthetic ref.
2. The plain session's Inspect plane keeps the generic honest empty state.
3. No `central.now.read`/`central.now.list` kernel op fires for the session
   that holds no NOW ref — absence issues no owner reads.
4. Full regression floor green (all 20 suites on the final bundle).

## Standing

Branch `agent/oi-inspect-now-fed`, cut from origin/main `564dab38` (#263).
Claim: brief pushed + draft PR before the build commit. The named open from
the 6C survey narrows to its irreducible remainder: on a boundary-capable
host the record carries the allocation and this section renders the real
relations — that final proof waits on the same owner lane as #253's echoed
accepted dispatch.
