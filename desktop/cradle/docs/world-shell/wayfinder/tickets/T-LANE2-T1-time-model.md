# T-LANE2-T1 — One time model across both halves of M2′ (bridge leg) · T1b (chronology leg)

Label: wayfinder:task (Phase 4 · lane 2)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-2-timeline/TARGET-SET.md` T1 (register `lane-2:T1`).

## Resolution — bridge leg

**Landed (13 Oct 2026).** The research canvas schema's `temporalPrecisionSchema`
widens to the authority's ladder (millennium … subsecond, additive); the
techne bridge maps each facet's precision verbatim from the one schema list
and carries the instant (with its offset) verbatim — no sub-day coarsening.
Lead accepted: the bridge does no ladder arithmetic, so it imports no
expansion function (expansion is the chronology's, T1b). Scripted: 4/4 —
all ten rungs and declared offsets survive; tsc 0 over 117 vendor files;
field-studies timeline baseline unchanged (14 pass, 3 env-skipped).
Absent precision still maps to "day" (pinned by test, deliberate until the
anchor precision may be null).

## T1b — the chronology leg (claimable)

`vendor/research-canvas/packages/canvas/src/timeline/{instant.ts,
projection.ts, scale.ts, ticks.ts}` and their consumers (`frames.ts`,
`walk.ts`, `timelineStore.ts`, `TimelineLens.tsx`, `viewport.ts`) retire the
fractional-year float and the canvas's parallel year ladder onto the
authority (`desktop/cradle/src/techne/m0m5/timeline/scale.ts`:
`expandInstant`, `ticksForDomain`): anchors place at their true extent at
every zoom down to subsecond; an interval keeps both ends' precisions.
Acceptance: the T1 target's — a second-precision facet renders at
sub-second zoom with its true extent (screen pass), the expansion math is
the authority's (pure test), existing tests green.
