# P0-V2 — Design-document and widget-guide deltas from the vision

Label: wayfinder:task (Phase 0, conductor, docs only)
Claimed-by: —
Blocked-by: P0-V1 (the documents point at a landed DLW-VISION)
Source: DLW-VISION.md §5.2 items 17–23 (DLW-VISION.md:1269-1297).
**Inferred:** §5.2 lists these rewrites without a ticket id, and §5.3's
ticket mechanics (DLW-VISION.md:1303-1307) give every §5 change a ticket file;
this ticket carries them so they are not lost. The id is the conductor's
bookkeeping, not a name from the vision.

Zones: `desktop/cradle/docs/world-shell/wayfinder/WIDGET-GUIDE.md` (§4.1,
§4.3, §4.6, §4.12, §4.14, §9), `desktop/cradle/docs/world-shell/WORLD-SHELL-DESIGN.md`
(:26, :32, :802-803), `desktop/cradle/docs/world-shell/UX-SPINE-ALIGNMENT.md`
(§2.1, :139-150), and a re-pin note at each stale cite item 23 names. No
product code.

## Question

The widget guide and the design are the floor every builder works from
(BRIEF-BUILDER.md law 3). Where they still carry pre-ruling wording or
stale facts, a builder who follows them faithfully builds against the vision.
Which lines change:

- **WG §4.6 dock and §4.14 companion (item 17).** A companion never renders a
  verdict on synthesis (PRAX:497-500). The companion body reads its bound
  presence, not only a name and a note (DOCK:62-68). "Nara · oracle" stays:
  the oracle is M4's own designation, "Oracle Interface Between Personal and
  Universal Domains" (live Bimba map, cited at DLW-VISION.md:523-530). The
  guide carries why: the meditation is "a dialogical encounter", not a pause
  (CONT:98); Nara midwifes recognition, it does not hand down answers
  (DLW-VISION.md:500-504).
- **WG §4.3 (item 18).** The aperture slot reuses the groove pool's place, with
  no groove function.
- **WG §4.1 (item 19).** The Central punch row carries a source tag for
  08:30/21:00 and L5. The close control is drawn declared and never fired
  (UI/inhabitants/centralDayNowModel.ts:55-105). Closing a day is
  `central.day.lifecycle`, the owner's act.
- **WG §4.12 (item 20).** "The Palace returns attributable proposals; it is not
  performed."
- **WG §9 (item 21).** Six rules: a lens is not a device; every relocated Live
  control names its function or is labelled reuse of the slot's place; plain
  instrument names, the M′ address as provenance; no coined names; Live-corpus
  M-labels are not Bimba coordinates (Inferred, L-0); "base" names Live mode,
  while the stored book mode `base` serves both Live and Central. Record the
  L21 tension (Epii vs Aletheia as the Technē companion label) beside them.
- **WSD (item 22).** "Four strata" introduces five (WSD:802-803). "Base ·
  Central" at WSD:26,32 becomes "Central". UXS §2.1 (UXS:139-150), the one
  place in the design that names the figure, points to DLW-VISION.
- **Re-pin stale documents (item 23):** LIVE/integration-map.md:164-181 (panels
  are registered); DLW-PANES-ONTOLOGY.md:461-462 (T9); DLW-PANES-PER-MODE.md:76-77
  (GRAM line cites); EXPRESSIONS-ENCOUNTER-SPINE.md lines 17 and 74;
  SF:489-493 ("planned" hosted field); APPA's unmerged-lane rows; MAP:130's
  duplicated row (MAP is the conductor's, PATH:14; de-duplicated in the seat, 12 Oct).

## Sources

- DLW-VISION.md §5.2 (:1269-1297), L-7 (:493-538), §2.1 naming defect
  (:749-764), L21 (:1168), L5 (:1152).
- WIDGET-GUIDE.md at the sections named; WORLD-SHELL-DESIGN.md; UX-SPINE-ALIGNMENT.md.

## Acceptance

Exercised: the guide and design as a builder reads them. Channels: `scripted`
(grep checks below, kept in the Resolution) and `code-reading`.

1. `grep -n "Four strata" WORLD-SHELL-DESIGN.md` returns nothing; the heading
   counts five.
2. `grep -n "Base · Central"` across WORLD-SHELL-DESIGN.md and WIDGET-GUIDE.md
   returns nothing, or only lines that quote the code defect and name T-LABELS.
3. WG §9 holds the six rules and the L21 tension, each with its source cite.
4. WG §4.6/§4.14 state the no-verdict rule and the bound-presence body with
   their cites; no wording draws Nara as a pause or as an answer device.
5. Each item-23 document carries a dated re-pin note at the stale line or is
   corrected; the Resolution lists them.
6. No guide rule invents a §4 PARTLY/OWNER answer (L5 hours stay design text
   with a source tag; L7's primary presentation stays the owner's).

## Open — waiting on the owner

L5 (day hours and who fires the close) and L21 (the Technē companion label)
stay recorded tensions in the guide, owners named. The guide does not settle
them.

## Resolution

Partly resolved 12 Oct 2026, conductor. Items 17–21 applied to
WIDGET-GUIDE.md (§4.1 :272-293, §4.3 :322-325, §4.6 :354-358, §4.12 :436-438,
§4.14 :461-467, §9 :591-624) in wf_933ec42e-7ba, landing with P0-V1. Item 22
applied by the conductor: WORLD-SHELL-DESIGN.md "Five strata" (§15) and the
Rev 5 "Base · Central" lines annotated with the ruling and T-LABELS
(acceptance 1–2 grep checks pass). Acceptance 3, 4, 6 hold by code-reading.

**Remaining — acceptance 5 (item 23 re-pins):** LIVE/integration-map.md:164-181,
DLW-PANES-ONTOLOGY.md:461-462, DLW-PANES-PER-MODE.md:76-77,
EXPRESSIONS-ENCOUNTER-SPINE.md:17,74, SF:489-493, APPA's unmerged-lane rows.
MAP:130's duplicated row is done. Claimable as a docs builder ticket.
