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

## Resolution — T1b (chronology leg)

**Landed (13 Oct 2026; builder haiku, converged by the lead).** The research
canvas's chronology places every anchor on the authority's epoch-ms extent
(`expandInstant` at the anchor's own precision); the canvas's parallel tier
and year ladders are deleted; ticks are the authority's `ticksForDomain`
(civil midnight under an offset); the zoom ceiling reaches 1000 px/ms (a
one-second fact spans 1000 px). Year-precision placements at year zoom move
≤0.48 px up to 120 px/yr. Lead rulings: interval ends are inclusive (the
authority's law; T2's display convention); the drift tolerance accepted;
the env-gated density proof amended to the ms camera (lead). Scripted:
chronology-extent 11/11; timeline baseline unchanged (18 pass, 3 env-skipped);
tsc 0. Unverified: rendering at sub-second zoom (native screen pass).

**Carried:** T7 — BCE/CE display labels over the authority's ticks ("-500"
must read 501 BCE; "1850 CE"); **T1c** — the camera's year boundary
(`TimelineViewport`, `TimelineSurface`, the repository query window) moves to
epoch-ms; anchors the authority grammar rejects (e.g. "2024-05-06 12:00",
no `T`) surface as transport diagnostics rather than vanish; an interval's
end keeps its own precision (needs `desktop-api` to carry two precisions).

## Resolution — T2 + T7 (bands, two-row axis)

**Landed (13 Oct 2026; builder haiku).** A coarse fact draws as its band
(`bandExtent` = the authority's `expandInstant`, all ten precisions), labelled
at its precision verbatim ("2nd millennium", "1850", "4 Mar 1850"), inclusive
ends ("1850 – 2016"), BCE explicit ("501 BCE") in one `labels.ts` used by axis
and cards; the axis has two rows — minor = `ticksForDomain` at the window,
major = the next coarser unit the authority names (found by widening the
window, no second ladder); labels keyed by mark, tabular figures, never
reflow. Scripted: 10 new tests, timeline suites 25 pass + 1 env-skip; tsc 0.

**Carried — T-LANE2-CRAFT:** the new classes (`timeline-node-band`,
`timeline-axis-tick--major/minor`) have no rules: style the band fill and
the major row's weight in the timeline stylesheet
(`vendor/research-canvas/apps/desktop/src/layout/timeline.css` and its
generated copy `field-studies-journeys/src/researchInstrumentStyles.css` —
regenerate, never hand-edit the copy), with the craft check on screen.
