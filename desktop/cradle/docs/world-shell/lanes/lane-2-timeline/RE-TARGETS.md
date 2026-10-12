# Lane 2 RE targets — candidates, possession, choice

Campaign: 2026-10-07-techne-instrument-re · lane 2 (timeline / historiography).
Method: possession verified before any study; scratch (clones, captures, the
manual PDF) lives in `/tmp/techne-lane2-scratch/` and is cited here only by
commit hash and sha256; nothing moved into any product tree. Web observation
was capture-only (screenshots through the loopback CDP provider, `rea
capture-web-screenshot` grammar), no JS evaluation of page internals, no DRM
circumvention.

## Candidates surveyed

| Candidate | Class | Possession status | Evidence of possession |
|---|---|---|---|
| **Aeon Timeline 3/2** (paid historiography/writing timeline) | installed-app target | **NOT INSTALLED — app target blocked.** Freely published official manual adopted as documentation target instead (limitation recorded) | `/Applications` and `~/Applications` contain no Aeon; manual: `Aeon-Timeline-2-User-Manual.pdf`, 111 pp., sha256 `02962fa4…6150ba`, downloaded from Aeon's own older-versions page (`aeon-timeline-3-release-notes.s3.us-east-2.amazonaws.com/v2/`), linked from `aeontimeline.com/older-versions` |
| **TimelineJS3** (Knight Lab) | open-source | **POSSESSED — cloned** | `/tmp/techne-lane2-scratch/TimelineJS3` @ `12a80199b967394a020f8faa7b001162a71e2494` (2026-09-22), MIT |
| **vis-timeline** (visjs) | open-source | **POSSESSED — cloned** | `/tmp/techne-lane2-scratch/vis-timeline` @ `67b24bb2b80bf5fef510476b2897e0a3e32f3f63` (2026-08-22), MIT/Apache-2.0 |
| **PeriodO** (period definitions dataset + model) | open data / open-source | **POSSESSED — cloned** | `/tmp/techne-lane2-scratch/periodo-data` @ `51fe03a205ac049b818c83bafe852bec2dc2b6e9`, CC0; `data-model.md` read in full |
| **Histography** (histography.io) | web-observable | **OBSERVED — captured** | 2 viewport captures 2026-10-07 via CDP screenshot: welcome (756×469) and main view (1440×900); artifacts sha256 recorded in the evidence JSON (`captures/histography-shot.json`, `captures/histography-main.png`) |
| **Chronas** (chronas.org) | web-observable | **OBSERVED — captured** | 1 viewport capture 2026-10-07: globe + polity colour layer + era-banded time scrubber (`captures/chronas-main.png`) |
| **TimeMapper** (okfn) | open-source | **POSSESSED — cloned** (prior lane run) | `/tmp/techne-lane2-scratch/timemapper` @ `deccec9706a5c97b17f4670ab603250ef2198b1c`; surveyed lightly — a spreadsheet→timeline/map publisher; no feature family the cradle lacks; not chosen |
| Video-editor timelines (Ableton, Premiere-class) | out of lane | **Out of scope by commission** | Lane 3's subject (PROGRAMME.md lane table); interface point only, not duplicated |

Aeon Timeline 3's interactive surface remains **unverified** (no possession,
no trial exercised); everything Aeon-sourced below pins to the version-2
manual and is marked as such.

## What each possessed target actually teaches (read evidence)

### Aeon Timeline 2 manual (documentation target)

- **Event precision model** (manual pp. 39-41): precision = the coarsest of
  what you entered; an imprecise event is still *positioned* by documented
  defaults (unspecified time → 00:00:00; unspecified day → beginning of
  month; unspecified month → beginning of year) and end dates mirror with
  end-of-period defaults. Exactly the cradle's `scale.ts` honesty law, with a
  cleaner statement of the positioning defaults.
- **Inclusive end dates** (pp. 40-41): "2015 – 2016 … 31 December 2016
  24:00:00" — the end is inclusive and rendered `24:00:00`, resolving the
  natural-language vs mathematical ambiguity. The cradle's
  `expandInstant` widens bounds but has no inclusive-display convention.
- **Relative timeline styles** (pp. 41-42): Regular / Weekly / Daily / Time
  counting from a configurable **zero date** — relative time for undated
  (e.g. archetypal, phase) material instead of fake dates.
- **Custom/fantasy calendars** (pp. 43-46): month/week/era structure is
  template data, not code.
- **Dependencies** (pp. 46-48): Event B's date = Event A's start/end +
  offset; move A and B follows; multiple predecessors → latest wins;
  Make Dependent / Make Consecutive / chain creation. This is the
  interactional reference for cause/temporal-chains on an axis.
- **Nested events** (pp. 49-53): parent range computed *entirely from
  children*; zoom out ⇒ expanded parents auto-collapse; multi-level
  (War → Battle → events); "Start of X"/"End of X" child events preserve a
  top-down-authored parent's original range. This is structural zoom with
  content-granularity change.
- **Relationship View** (pp. 16-23): events as rows, entities as columns,
  role icons at intersections; date range under each row; **offset between
  successive events on the left margin**; group-by-type; column
  choose/order.
- **Entity birth/death** (pp. 67, 1720-1725): entities carry lifespans;
  person age computed; birth can be an offset from an event.
- **Templates** (pp. 68+): date style, entity types, roles, properties and
  colours are per-timeline template data; parent values (percent, cost,
  completion) can be computed from children.

### TimelineJS3 (code target)

- `src/js/date/TLDate.js:14-77` — the human `SCALES` ladder
  (millisecond→millennium) with per-scale flooring functions.
- `src/js/date/TLDate.js:474-489` — `BIG_DATE_SCALES`: cosmological ladder
  year→**eon** (age = 10⁶ y, epoch = 10⁷, era = 10⁸, eon = 10⁹) over
  `BigYear` plain integers, with `HUMAN_SCALE_MIN_YEAR = -99999` and a JS-Date
  ceiling — one axis spanning deep time without fabricating month/day for a
  3-billion-year event.
- `src/js/timenav/TimeEra.js:9-14` — **eras as bands** "marked along the edge
  of the time slider" (start, end, headline).
- `src/js/timenav/TimeScale.js:33-47` — pixel scale over
  earliest/latest with a default-span rule when all events coincide;
  `_computePositionInfo(slides, max_rows)` — lane rows with a max.
- `display_date` (`src/js/core/ConfigFactory.js:81`,
  `src/js/slider/Slide.js:220-221`) — an author-supplied display string that
  overrides the computed date rendering: the uncertainty-presentation escape
  hatch ("circa", regnal strings) without corrupting the data.
- Groups (`group` field) as timenav rows; eras sorted by date
  (`TimelineConfig.js:104-115`).

### vis-timeline (code target)

- `lib/timeline/TimeStep.js:26-64, 404-470` — a **two-row minor/major axis**
  with an auto-scale ladder millisecond→year×1000/500/100/50/10/5/2/1 and
  manual `setScale({scale, step})`; labels customisable per scale
  (`TimeStep.FORMAT`, l.909+; custom label functions l.741-745, 777-781).
- `hiddenDates` (l.56-62; `DateUtil.stepOverHiddenDates`) — skip calendar
  gaps (nights, weekends) on continuous axes.
- **Groups / nested groups / subgroups** (`component/Group.js:25-56`;
  examples `groups/nestedGroups.html`, `subgroups.html`) — the lane model:
  ordering, nested collapsible groups, per-subgroup stacking.
- **Item types** `box | point | range | background | cluster`
  (`lib/timeline/component/item/`) — background items render as
  full-height/period bands (periodisation!), ranges as spans, points as
  instants.
- **ClusterGenerator** (`component/ClusterGenerator.js`) — zoom-level
  clustering of crowded items into count-clusters with
  `maxItems/clusterCriteria/showStipes`; the analogue of the cradle's unused
  `aggregate()`.
- **Stack** (`Stack.js`) — collision-aware vertical stacking (subgroups too).
- **Editing contract** (`optionsTimeline.js:100-300`): `onAdd/onUpdate/
  onMoving/onMove/onRemove/snap` — drag-editing with a snap-to-scale
  callback; `editable` per item/group.
- Rolling mode + current-time marker (`Core.js:47-81`), custom time markers
  (`component/CustomTime.js`).

### PeriodO (data-model target)

`data-model.md` (read in full):
- A period is a `skos:Concept` and a `time:ProperInterval`; "we assume that
  these (instantaneous) beginning and end points can never be precisely
  identified" (l.38).
- Each bound is described **two ways, both required**: the verbatim textual
  description from the source ("end of the first century BC" — *authoritative*,
  l.48, 62) AND a structured `earliestYear/latestYear` range used only for
  ordering and visualisation (l.50-58). This is precisely the cradle's
  verbatim-carrier + honest-derived-split law, already proven in
  historiography practice.
- `skos:note` (source-stated) is kept distinct from `skos:editorialNote`
  (curator-added) (l.18-20); per-definition `dcterms:source` with locators
  (l.26-34); spatial coverage text + gazetteer links (l.68-72).
- `xsd:gYear`: any number of digits; year 0000 = 1 BCE (l.58-62).

### Histography (observational target)

Captures show: every dot = one Wikipedia event; category rails with counts
(LITERATURE 1575, MUSIC 971, WARS 961, …); a density histogram whose peaks
surface representative events as photo-circles with title+year labels; the
**bottom bar is a resizable window onto the whole 14-billion-year scale**
(welcome text: "RESIZE THE BOTTOM BAR TO VIEW ANY TIME PERIOD OR ERA") —
continuous zoom from cosmological to decade scale over one dataset.
Limitation: single-page app; behaviour beyond the two captured viewports is
unobserved; no interaction depth (data loading, category filtering) was
captured.

### Chronas (observational target)

Capture shows: historical polities as a colour layer on a globe at a chosen
year; a bottom **time scrubber with era bands** (ANCIENT … EARLY MEDIEVAL,
HIGH MEDIEVAL/LATE MEDIEVAL …) over 500 BCE–2000+, century tick labels, and
the current-year indicator; attribution line (Natural Earth / OpenFreeMap /
OpenStreetMap). The direct precedent for the lane-2 ↔ lane-4 interface: time
scrubbing drives a spatial layer. Limitation: single viewport; the
 polity-detail and filter interactions were not captured.

## Chosen targets and reasoning

**T1 — TimelineJS3 + vis-timeline (open-source, primary code targets).**
Reasoning per feature family:
- *Time-scale model*: TimelineJS3's dual human/cosmological ladder + vis's
  two-row auto-scale axis together cover the cradle gap G1 (sub-day
  precision) and the historiography depth (deep time) without inventing
  precision.
- *Lanes/groups*: vis's nested groups/subgroups + stack refine the existing
  lane model (cradle `lanes.ts` is flat).
- *Periodisation bands*: vis background items + TimelineJS3 eras + PeriodO
  semantics = the period-band target set (gap G4).
- *Crowding*: vis ClusterGenerator vs the cradle's unused `aggregate()` —
  pick the honest-count approach the cradle already owns, with vis's
  interaction as reference (gap G8).
- *Editing*: vis's onMoving/snap callbacks are the reference for a future
  in-timeline editing contract (native-owner writes only).

**T2 — PeriodO (data-model target for periodisation + uncertainty).**
Reasoning: it is the only surveyed artefact that already solves
*verbatim-historical-bound + machine-usable-range as one required pair*,
which is exactly the cradle's law; adopting its shape for bands and for
`uncertainty` closes gaps G2/G4 with a scholarly-grade precedent (CC0, no
licence risk).

**T3 — Aeon Timeline 2 manual (documentation target; app unpossessed).**
Reasoning: the owner named "historiography tool" as the bar; Aeon is the
shipped consumer/professional product for exactly that. Its manual supplies
the interaction contracts (precision defaults, inclusive ends, relative
styles, dependencies, nested-event structural zoom, relationship matrix,
lifespans) at documentation strength. **Limitation (named):** all Aeon-derived
claims pin to the v2 manual text; no behaviour of the app itself was
observed, and Aeon 3 features (e.g. its newer UI) are unverified.

**T4 — Histography + Chronas (observational targets).** Reasoning: they are
the public historiography web genre the owner pointed at ("timeline or
historiography tool"); they evidence density-histogram aggregation, the
scale-window minimap, and time-scrubbed spatial layers (the lane-4
interface). Timebox respected: three captures total.

**Explicitly not chosen:** TimeMapper (no missing feature family);
D3-based custom axes (no possession need — vis/TimelineJS3 cover the same
ground with licences held); Simile Timeline (unmaintained); any paid app
without possession (Aeon 3 app remains blocked-with-reason).
