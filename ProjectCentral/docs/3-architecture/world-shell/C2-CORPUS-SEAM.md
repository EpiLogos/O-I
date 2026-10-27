# C2 — The corpus-neutral seam for the atlas port

Label: wayfinder:research (AFK) · resolves ticket C2 · prepares L5 (Earth/Graph/Aion port)
Claimed-by: `zcode:corpus-seam-c2` (dispatched by orchestrator `zcode:world-shell-orchestrator`), 2026-10-09.
Subject ground: `Work/Archetypal-Earth`, branch `main`. **Note:** the map's Lanes
table records `main @ 932b360`; actual HEAD at read time is `fbdb9e9` (932b360
verified as an ancestor, 19 commits ahead; working tree dirty with curation/data
work, preserved untouched). Every file:line below cites HEAD `fbdb9e9` as read.

Method: static reading only. The atlas was **not built, run or exercised**; no
code changed anywhere; the Archetypal-Earth tree was read read-only. Confidence
and limitations are stated per section.

---

## 0. What the atlas actually is today (corrections to the design doc)

`WORLD-SHELL-DESIGN.md` §3.1 describes the seam as `src/types/field.ts` over a
vault. True at the revision the design read; the atlas has since grown. At HEAD
there are **four published data contracts** plus two external data services,
each with its own `src/types/*.ts`:

| Contract | Types | Published data | Generator |
|---|---|---|---|
| Field (occurrences/families/archetypes/cultures) | `src/types/field.ts` (159 lines) | `public/data/field.json`, `images.json` | `scripts/ingest.mjs` (599), `scripts/images.mjs` (360) |
| Aion history | `src/types/history.ts` (91) | `public/data/history.json` | `scripts/aion.mjs` (238) + `curation/aion/` |
| Corpus passage index (citation deep links) | `src/types/corpus.ts` (55) | `public/data/corpus/{index.json,<work>}.json` | `scripts/lib/corpus.mjs` from the vault's read-only `corpus/` |
| Book of Symbols overlay | `src/types/symbols.ts` (29) | `public/data/symbols.json` | `scripts/symbols.mjs` (157) + `curation/symbols/` |
| Sky (bodies, ties, gazetteer, grids) | `src/types/sky.ts` (287) | `public/data/sky.json`, `sky.ties.json` | `scripts/sky.mjs` (524) — authority is the **ephemeris sidecar** (Kerykeion/libephemeris, JPL DE440), not the vault |

Two facts matter for the port and were not in the design doc:

1. **The atlas already contains one working non-corpus provider.** The sky
   layer's data comes from an astronomical sidecar (`scripts/sky.mjs:5-10`
   names the sidecar the sole authority; `src/app/controller.ts:65` binds its
   address, env-overridable via `VITE_EPHEMERIS_URL`). The multi-provider
   pattern C2 must formalise is already in the repo, in working code.
2. **The atlas has grown real ephemeris code** (`src/sky/ephemeris.ts`,
   `src/aion/precession.ts` — interpolation of the sidecar's generated grids,
   not a second authority). §3.1's "the Atlas has no ephemeris code" no longer
   holds literally; what still holds is that no authority is invented — the
   grids are generated (`--check` reproducible) and labelled.

Corpus scale today (`public/data/field.stats.json`): 13 archetypes, 338
families, 2,745 occurrences, 64 cultures, 431 images; year range −10000…1959;
geo precision 1,548 place / 983 region / 200 culture / 14 none. History holds
one reading (`jung-aion`: 7 epochs, 28 events, 4 threads). The real vault path,
verified from code not the doc: `scripts/lib/vault.mjs:5`
`DEFAULT_VAULT = '/Users/admin/Documents/books/jung-archetypal-field'`
(env `VAULT` overrides), matching the design doc.

The port carries **none of this data**. The seam is the contract layer; the
providers supply the bytes.

---

## 1. Deliverable 1 — the binding contract proposal

### 1.1 The seam, stated

`src/types/field.ts:1-2` says it itself: *"The data contract between the ingest
layer (scripts/ → public/data/field.json) and the experience layer (src/). Both
sides code against this file only."* That one-sentence law generalises: **every
published dataset gets a type file; the atlas code imports types and fetches
paths, never vault paths and never corpus content.** A corpus provider is
anything that can publish the bundle below.

### 1.2 Provider bundle — what a corpus provider must supply

```ts
interface CorpusProvider {
  id: string;            // slug, stable in deep links (today's routes are #/a/…, #/f/…, #/o/…, #/t/…)
  name: string;          // display, e.g. "Jung archetypal field" — the only place the corpus is named
  field: Field;          // REQUIRED — the amended field.ts (§1.3)
  images: ImageBundle;   // REQUIRED — images.json + the referenced assets (ImageRef.src/thumb)
  history?: History;     // OPTIONAL — Aion readings (src/types/history.ts:74-91)
  corpus?: CorpusIndex;  // OPTIONAL — citation deep links (src/types/corpus.ts:51-55)
  symbols?: Symbols;     // OPTIONAL — editorial overlay keyed by FamilyId (src/types/symbols.ts:17-29)
  ties?: TiesIndex;      // OPTIONAL — body↔field ties (src/sky/ties.ts:8-13); sky grids come from their own provider
}
```

Graph nodes and edges are **derived, not supplied**: `src/graph/build.ts:70-160`
builds the node/edge graph from the field's relations. The provider supplies the
*relations*; the atlas derives the graph. The relations the graph consumes are
exactly five, and the contract must carry them all:

1. `occurrence → family` (instance): `Occurrence.familyId` (field.ts:122)
2. `occurrence → family` (co-manifest): `Occurrence.coFamilyIds` (field.ts:123)
3. `occurrence ↔ occurrence` (parallel): `Occurrence.parallelIds` (field.ts:140)
4. `family → archetype` (tie, with basis): `Family.archetypes: {id, basis}[]` (field.ts:99)
5. `body → family|archetype` (sky tie, with basis): `TiesIndex.ties` (ties.ts:11)

### 1.3 The amended Field — generalising `Occurrence` (field.ts:118-142)

Current `Occurrence` fields, cited (field.ts line numbers), with their
disposition in the corpus-neutral contract:

| Current field (field.ts) | Atlas reads it at | Contract |
|---|---|---|
| `id: OccurrenceId` (:119) | model.ts:76 occIndex; search.ts:90; router.ts:113-135; controller.ts:352-373 | **kept** — the corpus-local ref. Add `subject_ref?: string` — the *native* identity the shell's encounter spine addresses (design §10.6). Absent ⇒ `id` stands in. This is the one additive field; nothing else is invented. |
| `title` (:120) | search.ts:90 (secondary), deep.ts:167, reveal alt (deep.ts:170) | kept |
| `label` (≤48 chars, :121) | hover (controller.ts:240), search.ts:90-92, strip, deep.ts:137, reveal.ts:54, graph/build.ts:108-110 | kept |
| `familyId` (:122) | model.ts:98-100, controller.ts:251-254, graph/build.ts:128-129 | kept — the occurrence's primary *kind* link |
| `coFamilyIds` (:123) | graph/build.ts:130-133 (`co` edges) | kept |
| `locusType` (:124) | **unread in src/** (ingest + validator only; grep over `src/` excluding `dev/` returns nothing) | carried, optional; atlas ignores |
| `subject: 'jung'\|'patient-anon'\|'n/a'` (:125) | **unread in src/** (ingest geocoding only, ingest.mjs:269, 290-294) | **dropped from the contract** — corpus-specific vocabulary; moves into the Jung provider's ingest |
| `cultureIds` (:126) | model.ts:101-104, search.ts:88, format.ts:26-28 | kept |
| `place` (prose, :127) | model.ts:105 (`shortPlace`), format.ts:36-44, search.ts:91 | kept |
| `lat`, `lon` (:128-129) | model.ts:95 `dirFromLatLon`; presences.ts:43-44; controller.ts:1194-1196, 1322-1323; aion/view.ts:208 | kept, with today's **convention stated as law**: lat/lon are always present (0,0 when unplaced); `geoPrecision: 'none'` decides `located` (model.ts:97). Providers must follow it. |
| `geoPrecision: 'place'\|'region'\|'culture'\|'none'` (:130) | model.ts:97; presences.ts:9,47,229 (precision rings, pick reach); controller.ts:1194, 1322 (fly-to distance) | kept — the honesty grammar of the globe (crosswalk lane-4:T10) |
| `year` (:131) | model.ts:69-71,96 (time scale), 114-118 (sorts); thread.ts:43; aion/model.ts:17 | kept — negative = BCE |
| `yearDisplay` (:132) | graph/build.ts:110,1355; hover (controller.ts:240); search.ts:92; deep/reveal/format.ts | kept — human truth, never regenerated from `year` |
| `yearRange?` (:133) | **unread in src/** (grep empty) | kept, optional — reserved for the Timeline projection (lane-2:T14 participant spans); providers may omit |
| `jung: Cite[]` (:135-136) | deep.ts:145-156, 175-179; reveal.ts:60-63; PassageSheet deep links (passage.ts:46-55) | **renamed `cites: Cite[]`** — the field *name* is corpus-named; the shape `{work, workTitle, year, locator}` (field.ts:48-57) is already generic. One rename at the seam; ingest re-emits. |
| `quote?` (:137) | deep.ts:173, reveal.ts:56-59 | kept |
| `body: string[]` (:138-139) | deep.ts:174, reveal.ts:58-59 | kept |
| `parallelIds` (:140) | thread.ts:36-40; controller.ts:1189; deep.ts:187-195; reveal.ts:68-80; graph/build.ts:134-141 | kept |
| `image?: ImageRef` (:141) | model.ts:171-173; controller.ts:1125; aion/view.ts:211-213; graph hasImage (build.ts:108) | kept — `ImageRef` (field.ts:33-46) already carries the licence gate: `credit`, `license`, `sourceUrl` are required strings. Providers inherit that obligation. |

`Archetype` (field.ts:77-91), `Family` (93-108), `Culture` (110-116) carry over
whole; the atlas reads `id/name/oneLine/prime/spectrum/palette/definition?/
body/image/familyIds` and `id/name/aliases/oneLine/archetypes[{id,basis}]/
spectrum/palette/body/image` respectively (verified per field in §1.4).
Declared-but-unread in src (provider may omit; ingest keeps them for its own
stats): `Archetype.occurrenceCount` (:90), `Family.subtype` (:97),
`Family.occurrenceIds` (:105), `Family.synthesised` (:107), `Culture.
occurrenceCount` (:115).

`FieldMeta` (field.ts:144-151) is amended: `vaultPath`/`vaultLedgerLine` become
the provider descriptor — `provider: { id, name, home? }` plus an optional
`freshness` line. The only code read of them is `deep.ts:209`'s footer text
(amended in §2) and nothing else (verified).

### 1.4 Coverage check — the contract against every real consumption site

Each site below was read in full; the check is: does §1.2-1.3 supply everything
the site reads? **Every read is covered.** The sites and the decisive reads:

- **`src/data/model.ts`** (177 lines) — `buildModel` (:67-130) reads occurrence
  `lat/lon/year/geoPrecision/familyId/coFamilyIds(no—cultureIds/place)/image`
  and derives dir/u/located/colour/famOcc/cultureOcc/places (:93-118);
  archetype membership two-hop from `familyIds` × `families.archetypes`
  (:120-127); symbols filtered by `famById.has(e.familyId)` (:129). Covered.
- **`src/data/load.ts`** (31) — fetches one path, validates `occurrences.length`
  (:24). Covered; the path becomes the provider's (§2-a1).
- **`src/data/search.ts`** (266) — archetypes/families(+aliases)/cultures/
  places/occurrences/periods (:58-110). All contract fields. Covered.
- **`src/data/thread.ts`** (55) — `famOcc/archOcc/parallelIds`, image-preference
  thinning (:44). Covered.
- **`src/data/time.ts`** (111) — consumes `meta.yearMin/yearMax` + `year` only
  (model.ts:69-71). Knots (time.ts:21-27) are atlas constants that *drop out*
  when outside the provider's range (time.ts:33) — any-corpus safe. Covered.
- **`src/data/corpus.ts`** (135) — corpus index/work JSON (:11-32), locator
  parsing (:41-48). Covered by the optional `corpus` bundle; degrades to "no
  link" (:103-108) when absent — a provider may omit it.
- **`src/data/symbols.ts`** (12) — symbols.json fetch + shape check. Covered by
  the optional `symbols` bundle; `main.ts:33-37` already catches absence.
- **`src/state/store.ts`** (167) — the five-state machine; `ThreadTarget` names
  the tiers `family | archetype | parallels` (:7-9). Tier names are the atlas's
  own vocabulary, not Jung content — the contract keeps them as the kind names
  (decision recorded §2-c6). Covered.
- **`src/state/router.ts`** (147) — hash routes keyed `a/f/c/p/o/t` + `#/aion`,
  `#/sky`, validated through `Resolver` against the model (:5-15, :63-147).
  Covered — the resolver reads only model membership.
- **`src/state/timeModel.ts`** (156) — pure window machinery over u-space.
  Consumes no field data. Covered (vacuously).
- **`src/graph/build.ts`** (328) — nodes per tier with rank formulas (:84-111),
  edges per the five relations (:114-142), liveness from `members` + time
  (:299-315), sky anchors (:162-218). All inputs contract fields. Covered.
- **`src/graph/view.ts`** (1402) — layout constants keyed on `basis === 'jung'`
  (:159, 288, 624-625, 633-635), STYLE table (:107-118), prime-node 'heart'
  force (:657-664) and centre-framing (:828). Reads only contract fields, but
  the *basis literals* need the §2-b amendments; the prime assumption already
  degrades when no node is prime (self undefined ⇒ no force, no centre bias).
  Covered after amendments.
- **`src/graph/tools.ts`** (137) — tie-basis filter buttons labelled
  `['jung','Jung'],['inferred','Inferred'],['site','Site']` (:60-64), default
  `ties: ['jung','inferred','site']` (:51). Amendment §2-b5 (labels from meta).
- **`src/globe/presences.ts`** (246) — occurrence `lon/lat/dir/colour/u/
  geoPrecision/familyId(glow)/image(implicit via rel)` (:39-53, 198-237).
  Covered.
- **`src/globe/engine.ts`, `earth.ts`, `tiles.ts`, `tilemath.ts`, `arcs.ts`,
  `controls.ts`, `zoom.ts`, `shared.ts`, `shaders.ts`** — engine layer; grep for
  corpus tokens returns only comments (shaders.ts:244 "field of archetypal
  intensity", :341 spirit/instinct comment). The only external data seam is
  `tilemath.ts:9-10` (NASA GIBS constants) and `earth.ts:63,77` (prepared
  textures). Provider-shaped already. Covered.
- **`src/aion/model.ts`** (34) — history.json + validation (:25-34);
  `eventOccurrences` joins `event.occurrenceIds/familyIds` into the model
  (:10-18). Covered by the optional `history` bundle.
- **`src/aion/view.ts`** (317) — readings/epochs/events/threads + links into
  the field via `archetypeIds/familyIds/occurrenceIds` (:193-228). All contract.
  Title strings amended (§2-b8). Covered.
- **`src/aion/skyclock.ts`, `skyclock-view.ts`, `precession.ts`** — read the
  reading's own boundaries plus named conventions; `skyclock.ts:17-22`
  `JUNG_AQUARIAN` hardcodes two event ids + a cw09ii locator (amendment §2-b9).
  Covered after amendment.
- **`src/app/controller.ts`** (1396) — the hub. Reads the model throughout;
  corpus-literal sites: deep fallback `id: 'self'` (:947, amendment §2-b3),
  hardcoded planet list in the `hasBody` resolver (:286, amendment §2-b4 —
  duplicate of `BODY_KEYS`, sky.ts:12-15), titles (:979, 1036, 1046, 1202,
  1253, §2-b8), sidecar address (:65). All other reads contract fields. Covered
  after amendments.
- **`src/main.ts`** (67) — the composition root: loadField + loadHistory +
  loadSymbols + loadCorpusIndex, each `.catch`-degraded (:32-38). This is where
  the provider registry replaces four fixed fetches. Covered by §2-a1.
- **`src/ui/deep.ts`** (212), **`reveal.ts`** (152), **`format.ts`** (44),
  **`symbol-reading.ts`** (24), **`passage.ts`** (100) — read `o.jung`,
  basis labels, CW/¶/pdf regexes, vault footer (§2-b6/7 amendments); all other
  reads contract fields. Covered after amendments.
- **`src/ui/floats.ts`, `strip.ts`, `time-control.ts`, `search.ts`,
  `hover-label.ts`, `focus-label.ts`, `dom.ts`** — consume Model/ImageRef/
  Palette generically (grep: only an aria-label string, search.ts:18, and a doc
  comment). Covered.
- **`src/sky/ties.ts`** (53) — ties index keyed `family|archetype` + `TieBasis`.
  Covered by the optional `ties` bundle.
- **`src/dev/fixture.ts`** (291) — a synthetic Field builder (not wired into
  `load.ts`, used by tests). **It proves the Field shape is populable without
  the vault** and is the seed of L5's non-Jung acceptance corpus; its Jung-
  named fixture content (`self`, `serpent`…) should be re-skinned to neutral
  names when promoted to that corpus.

**Fields the code reads that the contract does not cover: none** — after the
§2 amendments. The gap that remains without amendments is exactly the seven
basis-literal/key sites, the `self` slug, the `o.jung` field name, and the
Jung-labelled UI strings.

### 1.5 Liveness, epochs, images — the ticket's named items

- **Liveness** is *derived*, never supplied: occurrence liveness is
  `timeVisibility(u, window)` (time.ts:97-103), mirrored in GLSL
  (presences.ts:87-91, shared uniforms); tier liveness dims by the fraction of
  live members (build.ts:299-315); Aion reveal dims the field by epoch window
  (aion/view.ts:259-269). The provider supplies `year` (and, for epochs,
  `from/to`); the atlas computes presence. No liveness field enters the
  contract.
- **Aion epochs** are a reading's own claim (history.ts:26-44): id, name,
  nested `parentId`, from/to, polarity, spectrum, palette, oneLine, body,
  `passages[]` (verbatim, always traceable — history.ts:12-21), optional
  `archetypeIds`. A second reading `extends` the first without rewriting it
  (history.ts:4-6) — the multi-provider shape already present in the Aion
  contract itself.
- **Image refs**: `ImageRef` (field.ts:33-46) with required `credit/license/
  sourceUrl` is the licence gate made structural. The atlas never invents an
  image; `plate()` degrades to no figure (ui/dom.ts). Providers publish their
  own `images.json` + assets (the Jung provider's are Wikimedia-derived,
  `scripts/images.mjs`, staying corpus-side).

**Confidence (§1):** high for every site listed — each was read in full at
HEAD. Static only: no runtime execution, no build. The "unread in src/"
claims are grep-verified over `src/` excluding `dev/fixture.ts` (patterns:
`locusType`, `\.subject`, `yearRange`, `occurrenceCount`, `subtype`,
`synthesised`); a dynamic consumer (tests aside) could exist that greps missed,
but tests are not product consumers.

---

## 2. Deliverable 2 — the amendment list (L5's work order)

L5 moves modules verbatim first, then applies exactly these amendments. Nothing
here is a rewrite; the largest single change is one field rename at the seam.
Severity: **(a)** pure data-load seams — already provider-shaped, minimal
plumbing; **(b)** hardcoded corpus constants/paths; **(c)** logic assuming
corpus-specific structure.

### (a) Data-load seams — already provider-shaped (7 entries)

| # | Site | What it is | Minimal change |
|---|---|---|---|
| a1 | `src/main.ts:32-38` | Four fixed fetches compose the boot bundle | Introduce a `CorpusProvider` registry: `loadProvider(id)` returns the bundle; `main.ts` consumes `providers.default`. Everything downstream unchanged. |
| a2 | `src/data/load.ts:16-31` | `loadField()` fetches fixed `/data/field.json` | Take a base-URL/registry argument; validation unchanged |
| a3 | `src/data/corpus.ts:11-32` | Fixed `/data/corpus/…` paths | Prefix paths from the provider descriptor; the degrade-to-null law stays |
| a4 | `src/data/symbols.ts:4-12` | Fixed `/data/symbols.json` | Same prefixing |
| a5 | `src/aion/model.ts:25-34` | Fixed `/data/history.json` | Same prefixing; absence already degrades (main.ts:34) |
| a6 | `src/sky/load.ts:7-16`, `src/sky/ties.ts:39-48` | Fixed `/data/sky.json`, `/data/sky.ties.json` | Sky becomes its own provider slot (in the shell it binds from QL kerykeion per design §3.1; the atlas's own sky generator stays corpus-side with the vault provider) |
| a7 | `src/globe/tilemath.ts:9-10`, `src/globe/earth.ts:63,77` | NASA GIBS endpoint + prepared texture paths as constants | **Keep the constants**; record the NASA data terms next to them (licence gate, L5 acceptance names this). Optionally hoist into one `basemap` descriptor. No functional change. |

### (b) Hardcoded corpus constants/paths (14 entries)

| # | Site | Hardcode | Minimal change |
|---|---|---|---|
| b1 | `src/types/field.ts:4-9` | Header comment: "Source: the Jung archetypal-field vault" | Rewrite header to the provider law (§1.1); no type change |
| b2 | `src/types/field.ts:17` | `TieBasis = 'jung' \| 'inferred' \| 'site'` | Keep three strength tiers; make values provider-declared: `meta.ties.bases: [{id,label}]`, strongest first, defaulting to the Jung triple. Data keeps its ids. |
| b3 | `src/app/controller.ts:947` | Deep fallback `{type:'archetype', id:'self'}` | Derive from the field: first `prime` archetype (same rule the graph already uses, build.ts:89); refuse quietly when none |
| b4 | `src/app/controller.ts:286` | Hardcoded 11-body list in the `hasBody` resolver | Use `BODY_KEYS` (types/sky.ts:12-15) / the loaded sky provider's bodies |
| b5 | `src/graph/tools.ts:51,60-64` | Default ties `['jung','inferred','site']` + labels `'Jung'/'Inferred'/'Site'` | Default from `meta.ties.bases`; labels from the same declaration |
| b6 | `src/graph/view.ts:107-118, 159, 288, 624-625, 633-635` | STYLE keys `tie-jung`…, basis literals in spawn rank and layout distance/strength | Key styling/layout on the basis *tier index* (`bases[0]` = strongest) instead of the literal `'jung'`; the numeric tables stay verbatim |
| b7 | `src/types/field.ts:135` + `src/ui/deep.ts:145,175,178`, `src/ui/reveal.ts:60-61` | Occurrence field *named* `jung` | Rename to `cites` at the seam; ingest re-emits; the two UI sites read `o.cites` |
| b8 | `src/ui/deep.ts:112, 151, 176, 209`; `src/ui/format.ts:9-23`; `src/ui/symbol-reading.ts:9-10,22`; `src/app/controller.ts:979,1036,1046,1202,1253`; `src/aion/view.ts:103,146`; `src/ui/search.ts:18` | Jung-labelled strings: "(Jung's tie)", "Jung's texts", "Where Jung meets it", "Drawn from the Jung archetypal-field vault", `jungLine`'s literal prefix, CW/¶/pdf locator prettifiers, "The Book of Symbols", five `document.title`s | Read provider `name` from meta for the vault footer and titles; basis label from `meta.ties.bases`; `shortWork/shortLocator/jungLine` become generic cite formatters (¶/pdf parsing stays — it is what the corpus index anchors); symbol source label from `symbols.source.title`. Keep the words *as the Jung provider's own* by making them data, not code. |
| b9 | `src/aion/skyclock.ts:17-22` | `JUNG_AQUARIAN` event ids + cw09ii locator hardcoded | Move into the reading's data (an optional `reading.marks[]`), resolved by id; module keeps only the display logic |
| b10 | `src/aion/precession.ts:224-251` | `JUNG_MONTH_YEARS`, `'jung-equal'` convention | **Keep** — a named astronomical convention among four, honestly disclosed; add the reading-declared default so the convention travels with the reading, not the code |
| b11 | `scripts/validate.mjs:4-9` | SUBJECT/BASIS/PREC/SUBTYPE vocabularies mirrored | Stays corpus-side with the ingest (not ported); tracks the amended contract when the vault provider re-emits |
| b12 | `scripts/ingest.mjs:29-30, 269, 290-294, 422` | BASIS_RANK/WEIGHT on `'jung'`; `subject==='jung'/'patient-anon'` (Zurich jitter); `archById.self?.palette` fallback | Stays corpus-side (the vault provider's ingest); re-emits the amended field (`cites`, provider meta, tie ids unchanged) |
| b13 | `src/app/controller.ts:65` | Sidecar address `http://127.0.0.1:5187` | Already env-overridable; hoist into the sky provider descriptor in the shell host |
| b14 | `src/data/model.ts:59-61`, `src/data/text.ts:12-14` | Comments naming the vault | Comment-only; rewrite while touching the file for a1 |

### (c) Corpus-structure logic — keep, with named degradations (7 entries)

| # | Site | Assumption | Disposition |
|---|---|---|---|
| c1 | `src/data/model.ts:57-63` (`shortPlace`), `:105-118` (places) | Place prose is vault-shaped (digit/keyword rejection) | Keep verbatim — degrades safely on other corpora (worst case: fewer derived places) |
| c2 | `src/data/model.ts:120-127` | Archetype membership = families' tie lists (two-hop) | Keep — the tie relation is contract-level, not Jung-specific |
| c3 | `src/graph/build.ts:81-111` (rank), `src/graph/view.ts:94-99, 643-648, 1090-1095` (radius/charge/font per tier) | Three fixed tiers with fixed roles | Keep — tiers are the atlas's kind vocabulary; a provider maps its entities onto as-such/image/instance; empty tiers already degrade (max-of-empty guarded `Math.max(1, …)`, build.ts:81-82) |
| c4 | `src/graph/view.ts:657-664` ('heart'), `:828` (centre) | One `prime` node holds the centre | Keep — already null-safe when no prime exists; §1.4 verified both paths |
| c5 | `src/data/search.ts:195-196` | Empty query invites with archetypes | Keep; one guard: fall back to all kinds when the archetype tier is empty (one line) |
| c6 | `src/state/store.ts:7-9, 20-24`; `src/state/router.ts:49,57-58` | State machine names the tiers | Keep — these names are the atlas's own grammar (World·Focus·Manifestation·Thread·Deep maps to the shell spine, design §2); renaming would be a remake, violating port law |
| c7 | `src/app/controller.ts:1194-1197, 1322-1323` | Unplaced occurrences fly to lat/lon 0,0 with marker hidden | One guard: skip the fly-to when `geoPrecision === 'none'` (existing honesty law; today it dives on the Gulf of Guinea for unplaced records) |

**Amendment count: 7 (a) + 14 (b) + 7 (c) = 28 entries.** Of these, 6 change
data written by the corpus side (b2's meta addition, b7's rename, b8/b9/b11/b12),
17 are in `src/` code lines, and 5 are comment/plumbing-only.

**Confidence (§2):** high — every entry cites code read at HEAD; the numeric
layout tables in b6 were read in full (view.ts:620-640). Static only: the
amendments are not prototyped; L5 should land them as its first bounded commit
after the verbatim move and run `npm run typecheck && npm test` (the repo's own
gate, package.json:12) plus one e2e walk (`tests/ui/e2e/world.mjs`) against a
non-Jung fixture corpus.

---

## 3. Deliverable 3 — the vault slot-back

### 3.1 The provider adapter shape

The Jung vault re-attaches as **one provider among others** — the first, and
the reference implementation of `CorpusProvider`:

```
providers/jung/                    # corpus-side; NOT part of the ported atlas src/
  publish.ts                       # runs the existing ingest set against the amended contract
  out/                             # the published bundle (what the atlas fetches)
    field.json  images.json  img/  history.json  corpus/  symbols.json  sky.ties.json
```

- `publish` = today's `npm run data` + `aion` + `symbols` (package.json:8-19)
  amended per §2-b11/b12, emitting into the provider bundle instead of
  `public/data/`. The ingest set and curation set move **with the provider**,
  not with the atlas port: `scripts/ingest.mjs` + `scripts/lib/{vault,text,
  geo,ocr,corpus}.mjs`, `scripts/{aion,symbols,images}.mjs`,
  `curation/{archetypes,families,family-ties,cultures,gazetteer,
  year-overrides,ocr-exceptions,image-queries,aion/,symbols/}.json`.
- **The atlas port carries zero vault bytes.** The bundle is published output;
  the vault stays canonical and separate (map, Lanes: "vault re-attaches as one
  provider"). Regeneration always re-reads the vault
  (`scripts/lib/vault.mjs:5`), never the bundle.
- **What the adapter reads from the vault** (all verified in the scripts):
  `wiki/archetypes` → Archetype tier (ingest.mjs:94, 148-175); `wiki/images` →
  Family tier (ingest.mjs:95, 189-209, synthesised families :359-377);
  `wiki/instances` → Occurrence tier (ingest.mjs:96, 251-350); `_raw/manifest`
  for work titles (:97-98); `data/mentions.jsonl` for verbatim definitions
  (:100-104, 163-170); `data/lexicon.json` for aliases (:105-106, 184-188);
  `LEDGER.md` for freshness (:108-114); read-only `corpus/` +
  `data/paragraphs.jsonl` for the passage index (ingest.mjs:576-591,
  lib/corpus.mjs:1-13). All read-only; the vault is never written.
- **The sky is not the vault provider's concern.** `sky.json`'s authority is
  the ephemeris sidecar (scripts/sky.mjs:3-10); in the shell it binds from the
  QL kerykeion contract (design §3.1). The atlas's `sky.ties.json` (body↔field
  links, resolved against the *Jung* field) stays with the Jung provider as its
  optional `ties` bundle; QL's own field material would carry its own ties.

### 3.2 What the ingest/curation set contributes

The curation set is the provider's *editorial law*, and it is what makes the
bundle contract-shaped rather than a vault dump: `gazetteer.json` +
`cultures.json` turn prose into the contract's lat/lon/precision grammar
(ingest.mjs:63-64, 280-311 — place → region → culture-centroid → none, each
jittered deterministically by id); `archetypes.json` sets spectrum + palette
(:58, 148-175); `family-ties.json` sets the tie basis of every family→archetype
edge (:62, 389-423); `year-overrides.json` repairs years (:65, 261-262);
`ocr-exceptions.json` + the OCR normaliser warrant every human-readable string
(:68-90, 495-519 — target: zero residual suspects); `image-queries.json`
carries provenance for every plate (images.mjs; images-verify checks
licence/credit/sourceUrl against disk against field — the licence gate,
executed). A second provider must supply equivalents *or ship a simpler
bundle*: the contract's optional parts (history, corpus, symbols, ties) and the
degrade paths (§1.4) are exactly what lets a thin corpus run the atlas.

### 3.3 The shell binding

Per the design (§10.6, §12): the amended `Occurrence` is the Earth projection's
binding contract; `subject_ref` joins occurrences to the encounter spine;
providers register through the family manifest's `projections` adapters. The
port consumes providers; it never imports their data into a second store — the
bundle stays behind the fetch seams (§2-a), liveness stays derived (§1.5), and
attribution stays with the provider's own `ImageRef` credits and cite
locators. Aperture law holds: reading a provider is a read of published output;
nothing writes back to the vault.

**Confidence (§3):** high on shapes and paths (all cited from code read);
medium on the single point that matters most and is not yet exercised — no
provider other than the sky's sidecar-generated data has ever been loaded by
this atlas at runtime. L5's acceptance (a non-Jung test corpus rendering
globe+graph, then the vault re-attaching) is the executable proof C2 can only
prepare.

---

## 4. What this lane did not verify

- **No execution.** The atlas was not built or run; every claim is static
  reading at HEAD `fbdb9e9`. Layout constants, degradations and fallbacks are
  reasoned from code, not observed.
- **Greps are greps.** The "declared-but-unread" field list is as good as the
  pattern search; a consumer behind indirection could have been missed.
- **The design doc's HEAD has moved.** §0 records the delta (19 commits,
  including the whole sky layer's growth and the depictable-families image
  wave); L5 should re-diff `932b360..HEAD` before the verbatim move.
- **Provider counts are a moving floor.** The corpus scale quoted is the
  working tree's current data; the vault keeps growing (dirty tree).
- **The sidecar was not probed** (no processes started, per lane boundedness);
  the sky provider claims rest on `scripts/sky.mjs` and the controller wiring.
