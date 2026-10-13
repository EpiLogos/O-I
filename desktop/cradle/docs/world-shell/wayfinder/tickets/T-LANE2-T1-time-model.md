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

## Resolution — T3 (uncertainty presentation) + T-LANE2-CRAFT

**Landed (13 Oct 2026; builder haiku, corrected by the lead's rulings).**
A fact's verbatim uncertainty string and source ref ride the transport to
the TimelineItem; the class is `standingOf` (the authority's six classes,
never upgraded): circa → hatched soft band, disputed/mythic → badge, the
verbatim string in every title; relation edges keep the established
relation-type palette (lead ruling: an established behaviour is never
removed) and take only their dash + title from a disclosed standing. Band
fill and the axis major/minor weights styled in `timeline.css` and carried
into the scoped runtime copy `researchInstrumentStyles.css` (no generator
exists; the copy's header transform applied by hand, sha line updated);
PROVENANCE refreshed for the 18 lane-2 files (`verify-source.mjs` green for
them). Scripted: timeline suites 30/30 + 27 wider; tsc 0; build clean.
Unverified: the look (native pass).

## Resolution — T8 (periodisation bands)

**Landed (13 Oct 2026; builder haiku).** `bands.ts` derives bands from
validity facets — extent from the authority's `expandInstant` over the
disclosed earliest/latest (each end at its own precision; the bridge now
carries `temporal_from_precision` / `temporal_to_precision`, closing T1c for
bands), the source's label verbatim, standing via `standingOf` (an unsourced
labelled band reads "authored"), nesting by containment; `TimelineBands.tsx`
draws quiet full-height lanes behind the cards and a labelled stripe on the
axis edge; unlabelled or open-ended bands are listed as absent, never drawn
or invented. The archetype band layer in `TimelineSurface` is kept (an
established behaviour). Scripted: 7 new, timeline suites 37/37; verify-source
green; build clean. Unverified: the look (native pass).

**T8b (claimable — native contract):** the band label has no carrier yet —
the techne contract's facet validator rejects unknown keys
(`desktop/cradle/src/techne/contract.ts:560`) and `timeAxis.ts:44-46` pins
`label_verbatim` null; add a validated optional `label` to validity facets
in the contract (and its native producer) so labelled periods reach the
chronology; until then production lists every validity facet as "no label
disclosed".

## Resolution — T8b (the band label carrier)

**Landed (13 Oct 2026; builder haiku).** The techne contract's temporal facet
admits one new validated key, `label` (≤ 256 chars or null; every other
unknown key still refused); `timeAxis.ts` carries it as `label_verbatim`; a
native wiki declaration's period name reaches the band byte-exact through
the reader (an over-long label fails the declaration loudly, never
truncated). Scripted: period-labels 6 new, techne suites 25/25 (as CI runs
them), timeline-bands 7/7, tsc 0.

**T8c (claimable):** a label input beside "Add time range"
(`src/knowledge/ParticipationFacts.tsx:32`); a native write round-trip proving
the wiki writer keeps `label` (`kernel/src/construction.rs:75-90,140-150` and
its writer); `phasesFromFacets` (`relations.ts:409-420`) carries the label to
the phase view; an empty label reads as absent (`bands.ts:83`); stale
comments `techneBundle.ts:153-155`, `tests/techne-time-axis-native-acceptance.mjs:93`.

## Resolution — T8c

**Landed (13 Oct 2026; builder haiku).** "Period name · optional" beside
"Add time range" (`ParticipationFacts.tsx`, `periodNamed`: verbatim write,
empty removes the key); `phasesFromFacets` carries the label (blank → null);
`bands.ts` lists an empty/blank label as absent; stale comments corrected;
PROVENANCE refreshed. Scripted: techne suites 28/28 (CI form); timeline-bands
7/7; verify-source green; tsc 0 (cradle + expressions-app).

**Cross-repo (lead, same work):** the native writer is ai-kit's
`TemporalFacet` (`Work/ai-kit/crates/aikit-core/src/knowledge_facets.rs:85`,
`deny_unknown_fields`, no `label`) — a named period would be refused at save
until ai-kit admits an optional bounded `label`; done in ai-kit by the lead
(see the ai-kit PR). Pre-existing, noted: `tests/participation-facts-native.test.mjs`
imports `formatYearLabel` from ticks.ts, deleted by T1b — fix with the next
lane-2 ticket.

## Resolution — T12 + T13 (honest clusters, scale-window minimap)

**Landed (13 Oct 2026; builder haiku, with the lead's rulings).** At the
marker tier overlapping items compress into clusters whose membership is
exactly the authority's `aggregate()` bucket — "N events, <span>" when every
member is an event, "N items, <span>" otherwise; one click zooms once to the
span via the store's `setView`; never drawn as fake events; computed after
culling. A slim strip over the reading's domain highlights the camera's
VISIBLE span (lead ruling — the padded query window stops tracking at deep
zoom), drag pans, edge-drag zooms, hidden when the view already holds the
whole extent; no second view state. `participation-facts-native` repaired
(imports + plain positive years per T7). Scripted: 48/48; verify-source
green; tsc 0. Unverified: the look and drag feel (native pass); the
participation test's gated body (needs the ctrl and kernel binaries).

**T4 — deep time (landed `220ce31e6`, 13 Oct 2026; builder haiku).** The
authority (`scale.ts`) gains the eon / era / epoch / age rungs (contract
union and both precision lists, coarsest first) and positions years beyond
Date's range by exact proleptic-Gregorian day count (equal to Date wherever
Date reaches). A deep year admits year-or-coarser precision only. The canvas
`instant.ts` and `labels.ts` consume the authority with no Date arithmetic
(enforced by a test). Labels keep T7's astronomical convention (−780000 reads
"780,001 BCE"; the era is always stated). The zoom floor drops to 1e-9 px/yr.
Human scale is unchanged: a 58 KB probe digest is identical, and an 86,000-case
sweep shows 0 differences. Scripted: cradle 39/39, field-studies 43/43, tsc 0.
**T4b (dispatched):** the transport (`techneTransport.ts`) lacks the deep rungs
and truncates years to six digits. `desktop-api` returns null past six digits.
`schema/time.ts` admits four-digit bounds only. `timeline-navigation.test` has
been red since T1b removed `generateTicks`; it is to be ported to the axis API.
Lead ruling: the atlas `formatYear` (−1 and 0 both read "1 BCE") is left to
the atlas port pin, upstream in AE.

**T4b (landed `64e79508a`).** The transport, desktop-api and schema seams
carry deep years through the authority. `timeline-navigation.test` is ported
to `axisRows` and the camera, with two invariants as todo. **T4c
(dispatched):** step down when a minor row would have fewer than two marks;
floor the year in the deep branch of `calendarFields`; export the contract's
`TEMPORAL_PRECISIONS`; route the last private year regexes
(`repositories.ts`, `TimelineSurface.tsx`, `instant.ts`) through the
authority. `PsychogeographicMap.tsx:959` waits for lane 4.

**T4c (landed `9a520eff2`).**
- A minor row steps down, first within its rung and then to the finer rung,
  until it holds two marks at least 88 px apart.
- `calendarFields` finds a deep year against `yearStartMs`, which stays exact
  past 2^53 ms.
- The contract exports `TEMPORAL_PRECISIONS`, and the schema re-exports that
  same list.
- The last private year regexes now read through the authority.
- Scripted: 57/57 with no todos left. The authority's human-scale digest is
  unchanged. Every changed axis row had fewer than two marks before.

Lead ruling: 147 human-scale minor rows at 240/320 px have no 1-2-5 step
that gives two marks at 88 px. Spacing wins there and the major row carries
the time.

**T5 + T6 (dispatched):** a relative axis from a disclosed zero ref, and the
shared `techne:time-axis/v1` projection that both the chronology and Places
consume.
