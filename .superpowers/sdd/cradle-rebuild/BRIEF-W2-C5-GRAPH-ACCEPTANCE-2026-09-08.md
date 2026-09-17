# Wave 2 · Cell 5 — Independent graph acceptance (read-only; runs last)

Binding: WAVE-2-HANDOFF-2026-09-08.md ("Read-only evidence and actual native
U3.1/U3.4 walk"); wayfinder U3.1/U3.4 gate rows. Depends on reviewed cells 1–4
and one serialized coherent native integration + executable binding. This cell
has no implementation authority.

## Goal

Independent evidence that U3.1 (search/command aperture) and U3.4 (wiki graph
surface) are real against the integrated candidate. Failures stay failed;
confidence is not acceptance.

## Acceptance rows (from the wayfinder and handoff, verbatim intent)

- U3.1: one query returns the seeded real file, Flow and skill across
  providers; every result row invokes its owner Action.
- U3.4: the graph renders the real project + root wiki; node/edge counts match
  owner data (read through the cell-1/cell-2 owner operations — never the UI's
  own cache or a hand count of pixels); a node opens its real content in
  < 300 ms; traversal transitions per the accepted discipline; sparse-dot
  background from design tokens only.
- Unavailable/deferred inputs (including shared-field projection) render as
  truthful states.

## Deliverable

- Walk scenario(s) under desktop/cradle/walk/scenarios/, registered in the
  SCENARIOS map in walk/run.mjs (reuse the standard kernel bridge setup; every
  `check(condition, 'label')` lands in the receipt JSON; `shot(name)` for
  captures — see the oi-cradle-walks skill contract).
- One actual native U3.1/U3.4 walk on the serialized integrated build, with
  explicit absolute owner executable bindings recorded in the receipt.
- Evidence and receipt under desktop/cradle/walk/artifacts/ plus a bounded
  acceptance note naming each row pass / fail / blocked with its evidence path.

## Bounds

- Do not restart the stopped P1 soak and do not rerun full suites for
  cosmetics (programme rule). Test only this wave's changed behaviour and its
  missing obligations.
- Computer-use native inspection only for this changed behaviour — one bounded
  pass, actual viewport recorded.
- Isolated temp grounds and isolated AIKIT_HOME for seeded data; the live user
  ground, the running user app and the resident provider are never touched.
- Reconcile scope explicitly: if an acceptance row cannot be exercised, report
  it blocked with the reason — never silently drop or relabel it.

## Forbidden

Any edit under src/, src-tauri/, kernel/ (except adding your scenario file +
registration), owner repos; branch/commit/push; PATH-selected binaries;
accepting by inspection of code rather than observed behaviour.

## Receipt

`walk/artifacts/<scenario>.json` + screenshots + `w2-c5-graph-acceptance.md`:
bindings, counts comparison, timing evidence, row verdicts, blockers.
