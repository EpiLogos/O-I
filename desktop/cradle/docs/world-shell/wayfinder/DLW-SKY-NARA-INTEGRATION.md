# DLW sky · nara integration — the integrated M1·M2·M3 sky view and the M4 overlay

Owner question, 11 October 2026, in conversation: the development documents
stipulate that the Archetypal-Earth components come into Technē as the core
experiential foundation — the solar system for the field's expressions, the
whole ontology around Earth, the user's own planet in the shared field. The
atlas carries a full astrological system already, so mapping M1, M2 and M3
onto it "becomes a pretty trivial matter". What needs thinking through is
(a) how the Expressions application's energetic view integrates, (b) how M4
Nara overlays this scene with the chakral colours and dynamics — in the
astrology view, which should be the full integrated M1–M2–M3 system, taking
on the elemental details of the nara bioquaternion, and (c) the Paraśakti
16+2 apertures as ways into detailing over one's archetypal nature. The
premise under all of it: **every person's self is a whole solar system
interacting.**

This is a design contemplation in the wayfinder genre. It **proposes**; it
does not amend the artifact of record (`WORLD-SHELL-DESIGN.md`, into which the
former plan and pane documents are folded) and it claims no implementation. Where it synthesises, the
sources are named; where a choice belongs to the owner, it is surfaced as a
choice with the source's own alternatives, never silently answered.

---

## 1. What the documents already settle

The port stipulations are real and precise — with one important word about
"wholesale":

- **Port law** (`MAP.md`, Destination and Decisions; L5 ticket
  `wayfinder/tickets/L5-earth-graph-aion-port.md`): "**actual code copying —
  modules move verbatim first, hosts/bindings adapt after; no React rewrite;
  no Jung corpus in the port.**" The atlas is "**adopted as projection
  infrastructure** — globe/graph/state/time modules are infra; the Jung
  corpus stays canonical and separate; seam is `src/types/field.ts`."
- **Landed**: 82 modules under `packages/live-shell/ui/src/projections/atlas/`
  (L5 resolution: 28/28 corpus-neutrality amendments, zero Jung bytes). The
  ported tree includes the **whole sky subsystem** (`src/sky/` — 16 modules:
  `birth`, `card`, `chart`, `chart-overlay`, `ephemeris`, `flight`, `frames`,
  `gazetteer`, `layer`, `live`, `load`, `luminaries`, `sidecar`, `stages`,
  `ties`, `view`) and `src/aion/` (5 modules). The sky URL is already
  provider-supplied (`load.ts`, `[C2-a6]`) and the shell carries the QL
  envelope (`provider/skyProvider.ts` → `ql.sky-request/v1` →
  `ql.sky-snapshot/v1`).
- **Staleness to correct**: `WORLD-SHELL-DESIGN.md` §3.1's sentence "The
  Atlas has no ephemeris code; none is invented here" is stale at atlas HEAD
  (recorded in the retired `CONTEXT-PACK.md` §1.7; the sky modules are pinned in
`packages/live-shell/ui/src/projections/atlas/PORT-PIN.json`); the atlas now carries the sky
  subsystem and the Kerykeion/libephemeris sidecar. The *law* the sentence
  carries — no ephemeris invented, the sky arrives from its native owner —
  stands and is exactly what this document builds on.
- **The solar system is already named as the field's outward expansion**
  (§3.1): "the **M2 planetary field binds from the QL side** (the dated-sky
  provider contract — ten bodies, nine voices, seven centuries [centres],
  Earth anchor — already carries the source-defined Sun→Sahasrāra relation)."
- **Your World is a planet in a shared field** (WSD Rev 2–3): "your planet
  with agents, NOWs, recent Expressions and encounters, watched relations and
  project-world moons in near orbit; **the cosmos layers M1 torus · M2 sky ·
  M3 clock around it**." Five scales: Field · Orbit · Surface · Place ·
  Palace. Planet building is first-class (Body · Landmass · Climate · Sky ·
  Locations · Relations); "Earth is given" (controls disabled) and "Earth is
  your local root anchor, the **Mūlādhāra** relation… never the default body
  for anyone in a shared field."
- **The M4′ world instrument consumes, never recomputes** (L5 lock, M4′
  lens): "The solar/planetary depth is not a decorative feature bolted onto
  the globe. It is the wider reference-frame depth of this M4 world
  instrument, **consuming current accepted M2/M3 producers rather than
  recomputing astronomy/QL in the UI**… Where providers are absent, the
  instrument reports that depth unavailable rather than simulating it." The
  law's own scale stack: solar/planetary system ↓ Earth/shared world occasion
  ↓ geography ↓ region/place/route ↓ **Nara/current situated body**.
- **The QL scene map** (`Quaternal-Logic/docs/kernel-rebuild/m123-scene-map/`):
  "**the sky is M2-5's dated state; it is not a second M3 clock**"
  (`m2-sky.md`, `M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md` §2.2). The planet→chakra
  bijection is source-defined (`nara.md`, A1–A2): **Saturn→Mūlādhāra,
  Jupiter→Svādhiṣṭhāna, Mars→Maṇipūra, Venus→Anāhata, Mercury→Viśuddha,
  Moon→Ājñā, Sun→Sahasrāra**; Earth `#2-5-0/1-0` is the grounding anchor
  (`GROUNDS_CHAKRAL_PATHWAY`, `FEEDS_EARTH_ELEMENT` → Mūlādhāra), "never an
  eleventh planet and never an eighth chakra".
- **The cross-cut bridge** (L5 lock §13): "M4 Places/World ↔ Nara/EarthBody/
  current Expression… M4 is the **strongest situated bridge** because the
  same current world/Nara occasion can be encountered as lived Expression and
  as explicit World/Places depth." And §11a: M4′ is the general Expressions
  application body with the operative M1–M2–M3 backend.
- **The landed shell faces** (code): `atlasFamilyManifest.ts` admits
  earth/graph/aion views with the graph's own "**sky anchors**" control;
  `quaternalLogicFamilyManifest.ts` declares the QL faces **waiting**,
  including `sky` (compact face over the landed kerykeion contract) and
  `chakra` ("the ten-body/nine-voice/chakra reading of the sky contract… as
  a device face"), with the `ql-sky-earth-adapter` name reserved.
- **The Expressions application's energetic machinery** (already landed in
  `desktop/cradle/expressions-app/field-studies-journeys/`): the seven-centre
  scene binds each chakra occurrence to its native coordinate
  (`naraPersonalBody.ts`; `ASCENDS_TO`/`GROUNDS_CHAKRAL_PATHWAY`/
  `FEEDS_EARTH_ELEMENT` relations; Earth as a separate occurrence — "Earth
  must remain a separate occurrence from the seven centres"); the standing
  law `centreStanding.ts` ("centre identity ≠ cymatic station; authored
  starter ≠ live Nara"); `IdentityComposition.tsx` (elemental proportions,
  planetary contributions, centre evidence, coefficient policy);
  `NaraCurrentSky.tsx` ("Dated sky is a separate native calculation… **All
  quaternion arithmetic stays in QL**"); `NaraM3.tsx` (M3 gestures to the
  native transactional owner: forms, apertures, clock steps).

## 2. The synthesis — how the pieces join

### T1. The sky view is the M2-5 render surface; the binding is a provider swap, not new astronomy

The QL tree already fixes the coordinates; the atlas sky layer already
renders exactly their shape. The ten kerykeion bodies resolve into the QL
tree as `m2-sky.md` records:

| sky body | QL coordinate | chakra (R1 `PLANETARY_RESONANCE`) | just interval |
|---|---|---|---|
| Sun | `#2-5-0/1` | Sahasrāra `-7` | 1:1 / 2:1 |
| Moon | `#2-5-4` | Ājñā `-6` | 4:3 |
| Mercury | `#2-5-3` | Viśuddha `-5` | 5:4 |
| Venus | `#2-5-2` | Anāhata `-4` | 9:8 |
| Mars | `#2-5-7` | Maṇipūra `-3` | 15:8 |
| Jupiter | `#2-5-6` | Svādhiṣṭhāna `-2` | 5:3 |
| Saturn | `#2-5-5` | Mūlādhāra `-1` | 3:2 |
| Uranus | **none** (ledger `k6-m2:difference-planet`) | — | — |
| Neptune | `#2-5-8` | Ājñā `-6` (`HAS_CHAKRAL_ANCHOR`, source carried) | 9:5 |
| Pluto | `#2-5-9` | Sahasrāra `-7` (`HAS_CHAKRAL_ANCHOR`, source carried) | 9:4 |
| Earth | `#2-5-0/1-0` — the anchor, outside the planet array | ground of `-1`, never an eighth | Schumann 7.83 Hz |

So the mapping is indeed "trivial" in the exact sense the owner means: the
kerykeion snapshot (10 bodies, `snapshot_ref` sha256, observer scope
`shared-geocentric` vs `observer-private`) becomes **one provider** behind
the ported `load.ts` seam; the ported `ephemeris.ts` interpolator reads the
provider's grids in the same shape it already reads the baked ones (the
atlas's own `natalWindow()` already generates grids "in the sidecar's exact
`SkyGrid` shape"). The atlas's `stages.ts` distance grammar (earth 1.05–40
R⊕ → lunar 40–600 → handoff 600–3000 → system beyond) is the zoom grammar of
the M2 field; `flight.ts` (bodies sweep along the ecliptic between skies, no
jump, no cut through Earth) is the transit animation; `chart-overlay.ts`
(the natal ring at 1500 R⊕, aspect arcs, cusp spokes) is where natal and
current meet. Nothing new is computed in the shell; QL's kernel stays the
arithmetic owner.

Two accounting notes: Uranus is unbound (`U3` is an open owner choice:
R2-only, adopt the C `elem_sig` as a recorded discrepancy, or drop from
Nara); and the QL kernel currently disagrees with itself on 3/7 bodies
(`D2`: C's `elem_sig` vs the graph's `PLANETARY_RESONANCE` for Sun, Moon,
Jupiter). The graph is the current authority; the ledger entries are
proposed, not written (`m2-sky.md` §4).

### T2. M1 and M3 join at the centre the chart already draws

"The cosmos layers M1 torus · M2 sky · M3 clock around it" becomes precise at
the Orbit scale:

- **The centre is M3-5-5/0** — Axis Mundi / Central Unity Origin, the field
  centre "in which inscriptions have position, orientation, phase and mutual
  relation… In the live planetary–Nara instrument, Earth/observer/EarthBody
  and this field centre have explicit source-backed relations, not one shared
  raw ID" (`APERTURES-AND-CLOCK-CENTRE.md` §§3–4). The atlas's astrology
  view already draws exactly this centre: the "Self at the centre" diagram
  where every chart, Jung's included, meets the field, and the geocentric
  observer at the origin of the sky. The centre is one pin, worn by two
  garbs — the astronomy's observer and the clock's Axis Mundi — and the
  relations between them are the source-backed ones, not an aliasing.
- **M1 is the torus at the centre** — the oscillator source's visible body
  (the field/PCM owner's stage; `INSTRUMENT_PRESENTATION` ±25/9 m → ±333
  units, annotated presentation). In the sky view the torus is the
  innermost scale — the played body at the observer position — not a
  fourth planet.
- **M3 is the clock around the same centre** — inscription × lensing
  (`T²_Mahāmāyā = S¹_inscription × S¹_lensing`), the M3-5 device still
  **waiting** in the QL family manifest ("declared waiting… waits for the QL
  instrument owner"). The clock's two circles are the sky view's rotating
  furniture, and "the sky is M2-5's dated state; it is not a second M3
  clock" is the hard boundary keeping the two apart.

### T3. The 16+2 apertures are the chart's detail grammar — ways into one's archetypal nature

The Paraśakti aperture architecture is already counted law: **18 aperture
identities** — sixteen static lenses as eight reciprocal pairs (divisions
1°×360, 2°×180, 4°×90, 8°×45, 9°×40, 10°×36, 12°×30, 15°×24; leaves p and
15−p), the Fibonacci/Pisano ground (60 phases × 6°), and the Anuttara void
ring (16 orientations × 22.5°); three grids closing at 180° with the exact
9:8 relation (22.5/20), beside the 20°×18 elemental-vibrational fibre
(`APERTURES-AND-CLOCK-CENTRE.md` §§2.1–2.3).

Concretely over a natal chart ("one's archetypal nature"): the 360° zodiac is
the partitioned field — every static lens is a different division of the same
chart — 15°×24 reads it as 24 sectors, 1°×360 as 360 — and the reciprocal
leaf of each pair gives the complementary cut. The source's output for
"one's archetypal nature" is `#4.0-1`'s `astrologicalWeights` map
(aggregating to `archetypalWeights`), and the 16+2 apertures are the ways
into that: a selected lens is the reading frame through which the chart's
weights are disclosed, and the exploded clock (the "flower with an eye in
the middle") is the surface on which one constituent at a time can be
opened while the subject/event continues — M3-0 realised as inspecting the
fields that M2's lenses part.

One honest note on carriage: the atlas's **holographic zodiac annulus was
not ported** (there is no `zodiac.ts` in the ported tree; the zodiac appears
only as the tropical-sign statement on the chart rows). The annulus is the
natural carriage for the three grids — it is the only existing surface drawn
as a shader band where "hue = longitude only, colour here carries no
meaning", which is precisely the neutrality an aperture carriage requires —
but putting the apertures on it is **new work on the ported base**, not a
claim of existing code.

### T4. The M4 Nara overlay is the cross-cut bridge, not a new renderer

The owner's question — "how does M4 Nara overlay this scene with the chakral
colours and dynamics" — has a law-level answer already in place, and a
concrete one one step below it:

- **Law**: `§13`'s bridge — M4 Places/World ↔ Nara/EarthBody/current
  Expression — "the same current world/Nara occasion can be encountered as
  lived Expression and as explicit World/Places depth". In shell grammar the
  mechanism exists too: "the rack's cut switch crosses 4:2 ↔ 3:3 and
  **highlights the conjugate of the instrument you came from**" (WSD Rev 2).
  Crossing from the sky view (M4′ World depth) lands on its conjugate — the
  Nara instrument inside the Expressions body (3:3) — over the same
  encounter. The overlay is therefore not a layer grafted onto the sky; it
  is **the other reading of the same occasion**, and EF05's "seven
  independently constituted centres become live receiving loci over the same
  K8 world occasion" is the same statement from the Expressions side.
- **The composition is one**: `Q_identity · Q_transit · Q_activity` —
  natal baseline, current sky applied to that identity ("current sky changes
  act on that identity rather than overwriting it"), and activity as a third
  distinct contribution (`NARA-EXPRESSION-JOURNEY-V1.md`). "The chakral form
  presents the actual elemental state and planetary influence field of the
  bioquaternionic substrate" — and the bioquaternion is "a reading of the
  full personal composition at its locus" (APERTURES-AND-CLOCK-CENTRE §5). All arithmetic
  stays in QL; the shell and the app present, with "native centre
  membership, elemental associations and planetary contributions traceable
  through to each visible and sonal effect."
- **The overlay's dynamics, concretely**: the influence field is the source's
  own route set (`nara.md` §A2) — for the live sky, each body's R1 (own
  planet → its chakra) and R2 (its decan's Chaldean ruler → that planet's
  chakra; all ten bodies reachable through their longitude) are hits on the
  seven centres; R4 (Sun → all seven, virtue reception) and R5 (Earth → `-1`
  grounding) are constant; R6 is the `ASCENDS_TO` ladder `-1→…→-7` with
  `DISSOLVES_INTO → #0-0`. Per person, the natal chart produces a natal
  distribution `N_c` by the same routes on natal longitudes — "the only
  source-defined source of differentiation is the natal distribution over
  `-1..7`". Two people, same sky: identical event hits, different
  distributions, different centre responses. That is the "interacting" in
  the owner's premise, and it is computable today with the one
  coefficient-free reading ("**one hit per edge**", `U1-A`).
- **The rendering carriage exists**: `globe/arcs.ts` (ported) draws
  great-circle arcs — the route lines from planet to centre are arcs;
  `globe/presences.ts` (instanced points with density texture) carries
  centre glow; `flight.ts` animates the transits so the dynamics move with
  the sky rather than over it. The seven centres themselves keep their
  native home — the seven-centre scene in the Expressions body — with the
  sky view as the depth reading beside it, Nara's dialogue "alongside or
  over the same field".

### T5. Colour and dynamics — the honest sources, surfaced as choices

The colour question is where "trivial" becomes a decision, and the sources
are explicit that it is one:

- **No planet node carries any colour property** (0 matches across all 595
  deep nodes). Chakra colour exists at source only as `yantraForm` words for
  three of seven (`-1` "yellow square", `-2` "silver crescent", `-3` "red
  triangle"). The Shem relations carry literal `planetaryColor` on all 72
  5° arcs (90 edges); the five-element `ELEMENT_COLOURS` hex palette in
  C-Experiments is a *presentation* palette, not Bimba; and "no
  literal-to-RGB conversion exists in any owner" — `RenderPalette` is the
  one door (`m2-sky.md` §6). The owner's choice stands open: (A) Shem-arc
  literal colour, sky-driven (needs a tie rule for the 18 two-literal
  arcs); (B) yantra colours (covers 3/7); (C) the element palette through
  `RenderPalette` as an explicit presentation policy.
- The app's own `chakraSemantics.ts` `canonicalColor` set (root `#ff2255` …
  crown `#ff77ff`) is a **presentation palette too** — perfectly admissible
  under (C), but it must not be mistaken for source truth; the same file
  already models this discipline ("historical correspondence retained as
  metadata only; never drives CymaticResonator").
- The standing law guards the whole overlay: `centreStanding.ts` — centre
  identity is never silently identified with a cymatic station, and the
  authored seven-centre starter is never presented as live Nara. "No
  decorative seven-centre diagram may pretend to show protected live
  values" (NARA contract).
- The dynamics magnitudes: `U1` (per-edge magnitude — unit hits vs seed
  hierarchy vs C table), `U2` (natal × event: product / sum / aspect
  relation), `U6` (`ASCENDS_TO`: display-only / propagation / gating), and
  `U8` (centre orientation axes for `-5..-7`) are the owner's open choices,
  listed with consequences in `nara.md` §A5. This design takes no position
  except the one the source supports for free: unit hits, so the first
  rendering can be transparent, integer and coefficient-free.

### T6. Every person's self a whole solar system — the shared field, concretely

The premise lands in four already-named layers:

1. **Your World is a planet** in a solar-system-like shared field (WSD Rev
   2) — customisable through planet building (Body · Landmass · Climate ·
   Sky · Locations · Relations); **Central's own planet** is this World in
   the shared field (the docs' "your planet" / SharedField hub; the owner's
   naming for it is the Central planet). Earth is the given root anchor —
   Mūlādhāra, real geography, "never the default body for anyone in a shared
   field" — which is the Earth ontology the owner asks about: `#2-5-0/1-0`,
   `role: grounding-anchor`, `outside_planet_array: true`,
   `is_eighth_chakra: false`, "Primary earth element source feeding
   Mūlādhāra", Schumann 7.83 Hz as its one frequency.
2. **The field's expressions orbit**: "recent Expressions and encounters…
   project-world moons in near orbit" (Rev 2) — the Expressions of the field
   are bodies in the same system, which is what it means to render
   Expressions *in* the solar system rather than beside it.
3. **Interaction is typed**: between Worlds it is the relation layer (anchor
   · participate · contribution with its flow · watch · projection ·
   federate · A2A while a contact is open — Rev 3), and between skies it is
   the QL planet↔planet relations the tree already carries
   (`QUANTUM_HARMONIC_RESONANCE`, `PRIME_HARMONIC_BRIDGE`,
   `ARCHETYPAL_QUANTUM_TRIAD`, `TEMPORAL_PHASE_COUPLING`, …) plus the
   atlas's cross-chart comparison ("X had Mars in Leo too") — synastry's
   machinery, already in the walk.
4. **Each self is the full stack**: a person's system is their natal
   distribution, their current sky, their centres and their Worlds — and
   L5's M4′ scale stack (solar system ↓ shared world occasion ↓ geography ↓
   place ↓ Nara/current situated body) is the same statement inscribed as
   the instrument's own depth law. Visiting another World "lands on its
   projection" (tinted, fogged, only what it projected) — the other person's
   system discloses by projection, never by exposure.

### T7. The energetic view's place — one occasion, two readings

The Expressions application's energetic view (the seven-centre scene,
`IdentityComposition` elemental proportions and planetary contributions,
`NaraCurrentSky`, `NaraM3`, the kundalini/chakra journeys in the starter
collections) is **M4's lived body** — and it is already bound to the same
native ground the sky will bind to: centres keyed to coordinates, Earth a
separate occurrence, quaternions in QL. Its integration is therefore not a
merge of two systems but the encounter spine carrying one occasion into both
readings:

- the **sky view** (Earth projection, the 4:2 depth) shows the world-facing
  face: planets, transits, the natal ring, the routes as arcs, the apertures
  on the ring;
- the **energetic view** (Expressions projection, the 3:3 lived body) shows
  the receiving face: the seven centres, their composed colours, the
  elemental proportions, the M3 gestures;
- the **cut switch** (already designed) crosses between them and highlights
  the conjugate; the **Nara instrument** opens over either, carrying "the
  exact current person, Expression and selected centre/relation";
- **selection is one**: focusing a centre "selects that real subject; it
  never silently retunes the world" — and the same subject is the planet,
  the decan, the route, in the sky reading.

## 3. The smallest seam set (what would actually be built)

1. **Sky provider swap** — point the ported `load.ts`/`skyProvider.ts` seam
   at the QL kerykeion snapshot; keep the observer-scope law
   (`shared-geocentric` never carries a private observer).
2. **`ql-sky-earth-adapter`** (name already reserved in the QL manifest) —
   the projection adapter mapping snapshot bodies → atlas sky layer bodies →
   QL coordinates; includes the D2-corrected graph authority and the Uranus
   policy once ruled.
3. **Chakra face** (declared waiting) — the compact device face over the
   composition: seven rows, each a native centre with its composed reading,
   colours through `RenderPalette` under the chosen colour source.
4. **The route renderer** — R1/R2/R4/R5 hits drawn as arcs from planet to
   centre over the encounter; unit hits for the first pass; per-centre
   evidence rows; nothing animated that has no source (the honesty law).
5. **The aperture carriage** — the three grids on the chart ring/annulus
   (new work on the ported base); a selected aperture opens its partition
   reading of the chart and its exploded constituents.
6. **The encounter bridge** — one subject/occasion object shared by the sky
   pane and the seven-centre Expression, with the cut switch crossing and
   highlighting the conjugate.
7. **The M1 torus at the centre** — the field device face's visual body at
   the observer position (the torus presentation already exists on the
   retained stage; this is its docking, still waiting on the QL instrument
   owner).

## 4. Honesty boundaries (no claim beyond the code)

- No code in the shell today draws chakral colours, routes, or apertures on
  the sky; the atlas port's annulus is absent; the sky→Earth adapter, sky
  face and chakra face are all **waiting**, with named owners.
- The ephemeris is real and owned (Kerykeion + libephemeris/DE440 sidecar,
  local-process only, AGPL noted); the shell never computes astronomy. The
  atlas's own `astronomy-engine` natal path (browser-side) exists in the
  atlas but was **not** part of the ported tree — natal via the sidecar's
  `/chart` (or the natal input the nara instrument already takes) is the
  route that keeps one ephemeris authority (SKY-SPEC D2).
- All coefficient choices remain the owner's (`U1`–`U10`); the D2/D8-style
  kernel discrepancies must land as ledger entries before any producer
  mirrors them.
- The Jung corpus stays canonical and separate: body cards and sign
  readings arrive through the provider seam; corpus neutrality is the port's
  proven posture, not a new negotiation.
- Realtime law: sky and agent latency never become note latency; M2 reaches
  the instrument as compiled modulation plans (the twelve `ql:m2/*`
  observables), never as live sky queries in the audio callback.
- "Earth is given": the Earth ontology's constraints (never an eleventh
  planet, never an eighth chakra, landmass controls disabled) hold in every
  reading of this design.

## 5. Open questions for the owner (surfaced, not answered)

1. **Colour source** for the overlay: (A) Shem-arc literal `planetaryColor`
   — sky-driven, honest to 5°; (B) yantra words for 3/7; (C) an explicit
   element palette through `RenderPalette`. The app's current palette is
   case (C) by default; is that the ruling, or is (A) wanted for the chart
   reading?
2. **The astro walk**: the atlas's planetary ladder (Moon → … → Sun, "where
   the old ascent ended too") **is** the chakral ascent under another
   naming — Moon→Ājñā … Saturn→Mūlādhāra in reverse-meeting order, ending
   Sun→Sahasrāra. Is the walk kept as the traversal of the integrated view
   (with the chakra names disclosed on the steps), or replaced by direct
   centre selection?
3. **`U2`** — natal × event combination (product / sum / aspect relation):
   which reading is "the dynamics" the overlay shows by default?
4. **Uranus** (`U3`) — route-only via decan, adopt-C-as-recorded-
   discrepancy, or drop; it changes whether "every person's system" has
   nine or ten voices.
5. **The apertures' home** — on the annulus in the sky view, in the M3
   clock device's exploded flower, or both (the same 18 identities in two
   carriages)?
6. **Naming**: "Central planet" for the user's World — adopt into the shell's
   vocabulary, or keep the docs' "your planet" and let Central remain the
   register's name?

---

Sources: `wayfinder/MAP.md`, `packages/live-shell/ui/src/projections/atlas/PORT-PIN.json`, `Work/Quaternal-Logic/providers/sky/kerykeion_snapshot.py`,
`wayfinder/tickets/L5-earth-graph-aion-port.md`, `new-shell/WORLD-SHELL-DESIGN.md`
(Rev 2–5, §3.1, §18, and the folded plan and pane documents: §18.1, §5.6–§5.10, §4.3), `Work/Quaternal-Logic/docs/kernel-rebuild/m123-scene-map/{nara,m2-sky}.md`,
`Work/Quaternal-Logic/docs/kernel-rebuild/APERTURES-AND-CLOCK-CENTRE.md`,
`Work/Quaternal-Logic/docs/L5-TECHNE-DUAL-READING-LOCK.md` (§11a, §13),
`Work/Quaternal-Logic/docs/M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md`,
`Work/O-I/docs/contracts/NARA-EXPRESSION-JOURNEY-V1.md`,
`Work/O-I/docs/experience/EXPRESSION-FIELD.md` (EF05),
`Work/O-I/packages/live-shell/ui/src/projections/atlas/` (82 modules, file list verified 11 Oct),
`Work/O-I/packages/live-shell/ui/src/inhabitants/quaternalLogicFamilyManifest.ts`,
`Work/Archetypal-Earth/` at HEAD `59a7a27` (sky subsystem, curation, sidecar; file-level state verified 11 Oct).
