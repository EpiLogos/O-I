# BRIEF — "Start writing" records the clicked register synchronously — 2026-09-12

Carried product question (ledger, frozen-cut landing, 2026-09-11): "a fast
human can still misplace writing into the root register by writing mid-browse;
… scoping 'Start writing' from the browsed row (or queueing behind an
in-flight browse) is a candidate polish cell." #242's navigator rework did not
close it: `onProjectChange` (which sets the workspace project that names the
Flow's register) fired only AFTER the async `project_browse` resolved.

## Law excerpts

> "Honesty. Truthful state only." — law 7. The workspace project should mean
> what the human chose, when they chose it — not whatever the last completed
> browse happened to leave.

> "Files mapped, prompts pithy." — law 8.

## Change (one function, `desktop/cradle/src/surfaces/navigator/WorldNavigator.tsx`)

`load(project, activate)` records the human's register choice BEFORE the async
browse (`if (activate) onProjectChange?.(project)`), replacing the
post-success call. Semantics preserved: same activation set (row clicks and
mode changes; mount/refresh pass `activate=false` and are untouched), same
handler (`workspace.browse`, a synchronous store set). A failed browse renders
its own error and never un-chooses the register — writing goes through the
owner directly (`createFlow(scope)`), never through the browse state, so the
Flow lands in the project the human clicked even while the browse read is
failing.

## Walk contract

`navigator.mjs` removes the wait between the row click and "Start writing" —
the race itself becomes the proof: the Flow must open in the browsed project's
register (`central:source:project:` check, already asserted) with the click-to-
write gap at zero. The selection wait moves after the write click, where the
later row interactions still need it. Full regression floor green (16 suites).

## Standing

Branch `agent/oi-start-writing-register`, cut from origin/main `4a43142` (#243).
