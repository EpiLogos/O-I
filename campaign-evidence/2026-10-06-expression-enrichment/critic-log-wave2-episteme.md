# Critic log — wave 2, episteme (Aletheia's office)

Critic: `zcode:enrich-critic-w2a` · seat env-1/o-i (attached to standing lane `enrich/expressions-20261006`) · region `campaign-evidence/2026-10-06-expression-enrichment` · 2026-10-06
Subjects: the eight members authored by `zcode:enrich-episteme-l2` — commits `48430dca7` (c-concepts-1), `afd486017` (c-concepts-2), `0fae62c7f` (ac-root), `c910b8070` (histories), `7b5366138` (etymologies), `6b088a7b6` (lenses-aphorism **and** dossiers — the disclosed commit-boundary race), `822f1b033` (s-products).

## Verdicts

- **roz-c-concepts-1 — PASS** (all six rubric lines)
- **roz-c-concepts-2 — REJECT(6)** — two standing glyphs without rationales; everything else verifies
- **roz-ac-root — PASS** (all six rubric lines)
- **roz-histories — PASS** (all six rubric lines)
- **roz-dossiers — PASS** (all six rubric lines; commit-boundary race disclosed, content complete at HEAD)
- **roz-etymologies — REJECT(6)** — the arbitration craft note claims a carriage the artifact does not have
- **roz-lenses-aphorism — PASS** (all six rubric lines)
- **roz-s-products — PASS** (all six rubric lines)

## Objective pass

- Richness linter scoped to `desktop/cradle/expressions-app/collections/return-of-zero/episteme`: **8/8 PASS** (includes validateJourney and the 10-formation/8-pin renderable ceiling).
- Identity vs `main`: journey `id`, `description`, and every scene `id`/`name`/`character` unchanged on all eight members (32/32/5/10/7/6/3/7 scenes; no renames, no removals). `site/essay-expression-map.json` untouched by the lane.
- **Commit-boundary race (lane-disclosed, confirmed):** `git show 6b088a7b6 --stat` carries both the lenses-aphorism and the dossiers files; no separate dossiers commit exists. Content completeness at HEAD verified regardless: dossiers journey has its 7 scenes with ids matching the binding's 7 records, binding re-based to fc59a719 with the enrichment block, 21 rationales, per-scene notes present. A message/boundary blemish for the integrator, not a content defect.
- Kicker discipline: **91/91** scenes carrying a claim-status token match their bound record's status at fc59a719 (checked programmatically; e.g. `C49 · DERIVED` — the only Derived concept checked — and compound riders like formal-limit's "Argued; specified formal consequences Derived under their stated assumptions" carried verbatim). The 11 riders correctly absent are the ten histories (`· HISTORY` — their records declare no `claim_status`) and `etymology-symbol-account-and-trust` (frontmatter has none, scene binding `claim_status: null`). Nothing invented, nothing dropped.

## Render pass (pixel evidence, not frame counts)

Author captures at `/tmp/expression-enrich/episteme/captures/` verified usable: every capture mtime precedes the last commit touching its journey file (e.g. ac-close 14:14:38 < 14:14:54; s0 14:40:53 < 14:41:30) and `git status` is clean for the family — captures reflect the committed state. The critic recomputed diffs independently (sips→BMP raw compare, tol 24; first pass had a wrong bpp assumption, corrected to the 24bpp top-down layout sips actually emits — the numbers below are the corrected ones):

| pair | critic-measured diff |
|---|---|
| c05 t0→t6 / t0→t13 / t0→t21 | 3.66% / 4.17% / 3.04% |
| c47 t0→t4 / t0→t9 / t0→t13 (critic capture) | 2.02% / 1.51% / 2.03% |

What the frames show (inspected visually, all eight yaw pairs viewed at full size):

- **c05 morph**: t0 a diffused cloud plus a compressed right edge; t6 the soft square formed; t13 both edges settled — the two edges with a gap held throughout, title `C05` on every frame (no presentation-clock drift; the t21 frame is a later cycle of the same scene, the sequence runs `order: "loop"`).
- **c11 yaw 0.55 vs 1.9**: plate near face-on (ring, yantra mass, two cardinal knots) vs edge-on lens with the diameter walker dense at centre — genuine parallax.
- **c42 morph (t0/t5/t11/t18)**: the co-internality orbital visibly walks — the strongest concepts-2 sequence evidence.
- **c49 yaw 0.5 vs 1.85**: two discs oblique with the slash mass between vs strata nearly edge-on with the walker resolved between them — the z −0.45/+0.3 strata are real in pixels.
- **C47 restraint (critic's own capture, t0/t4/t9/t13)**: triangle + disc geometry stable in every frame; no z (scene is 2d, all entities z=0 in JSON), no size growth (step `objectState.size` constant 0.34); the triangle — the sequence carrier — darkens across the walk while changed-pixel share stays at 1.5–2.0%. The record's own line "No depth is intrinsically better" is honoured in JSON and in pixels.
- **ac-close yaw 0.5 vs 1.75**: superimposed compound vs two separated rings at distinct depths with the `(0/1)/(1/0)` reading between — the numerator/denominator strata are visible.
- **history-mathematics yaw 0.6 vs 1.8**: oblique stream vs five stations strung in depth with the plane edge-on — "stations in z" verified.
- **trust yaw 0.55 vs 1.8**: six word-stations face-on with fides at centre vs the same stations strung along the ring seen edge-on; t7/t14 show the chain walking.
- **dossier-bohm yaw 0.55 vs 1.8**: plate with cells + unfolded finding vs plate collapsed edge-on (the enfolded whole) with findings standing at distinct depths.
- **aphorism yaw 0.5 vs 1.75**: two limit-edges standing in depth with the investigation ring and faith core vs the edges nearly edge-on; the complete four-line aphorism is legible in the body of every frame.
- **s yaw 0.55 vs 1.8**: six product stations on the face-on envelope ring vs the ring edge-on with stations strung in depth.

Pointer authoring judged from JSON alone (the harness does not drive the pointer): profiles are meaning-chosen per scene (e.g. c47 implode = deference lets the source change the model; c44 weak repel 0.7 = what arrived was not wholly made; ac-crossed-zero vortex/vortex = the recognition turning), and the family varies repel/attract/vortex × pulse/shove/vortex/implode across every member.

Contact sheets (committed, this region), one per member under `renders/episteme/`:
`roz-c-concepts-1-contact-sheet.png` (C05 t0/t6/t13/t21 + c11 yaws), `roz-c-concepts-2-contact-sheet.png` (c42 morph, c49 yaws, the four C47 restraint frames), `roz-ac-root-contact-sheet.png` (ladder morph + ac-close yaws), `roz-histories-contact-sheet.png` (myth morph + mathematics yaws), `roz-dossiers-contact-sheet.png` (formal-limit morph + bohm yaws), `roz-etymologies-contact-sheet.png` (trust yaws + walk), `roz-lenses-aphorism-contact-sheet.png` (aphorism morph + second yaw), `roz-s-products-contact-sheet.png` (s0 morph + s yaws).

## The author's specific claims, checked

- **C05 crossed-zero chain verbatim** — VERIFIED. Record §3: `0 → Ø → X → Ø/X → (0/Ø)/(1/X) → 1`, returning to `0/1`; the c05 sequence is exactly these seven steps in order. Scene body is the record's §0 definition (its one paraphrase — "It does not mean that descriptions, instruments or lives remain unchanged" — carries the record's own closing caveat).
- **C14 tattva-gnomon five-by-five→six-by-six** — VERIFIED. Record §3: `36−25 = 6²−5² = (6−5)(6+5) = 11 = 5+1+5`, "two non-overlapping five-unit strips and one new corner to a five-by-five square, completing a six-by-six square"; the c14 sequence walks `five-by-five → 36−25 → 6²−5² → (6−5)(6+5) → 11 = 5+1+5 → six-by-six` — the record's own arithmetic in order. Kicker ARGUED, consumers A09 A15 A19 A24 A26, sources — all match frontmatter.
- **C18 apoha chain** — VERIFIED. Record §1: "a word excludes other referents" (Pind, PSV V:11d); "the not-non-pot account … reaches a pot through excluding non-pots". Sequence: `a word → excludes other referents → not-non-pot → pot`.
- **C47 five sites as tint-only** — VERIFIED and HONEST. Record §3 names the chain verbatim (`answer → task interpretation → world-model → evaluator/gauge → terms of commission`) and denies "depth is intrinsically better"; the scene has no z anywhere, no depth engine keys, constant step size, tint/tintWeight-only steps, and the binding note states the restraint and its reason.
- **C49 Two Ones z-strata** — VERIFIED. Source-unity at z −0.45, manifest-unity at z +0.3, the slash walking between (steps `/ = −/− → source-unity → manifest-unity → / = −/−`); the binding note's stated meaning ("the ground/manifestation relation read vertically, the slash the between") is what is staged. Kicker `DERIVED` matches the record's frontmatter.
- **ac-close numerator-over-denominator** — VERIFIED. Record §5→0 displays `(0/1)/(1/0)` as one fraction; the scene holds the A-face ring at z +0.5 (numerator), C-face ring at z −0.5 (denominator), the `(0/1)/(1/0)` text at z 0 between them.
- **ac-root ethic carried by reference, never restated** — VERIFIED with the precise reading: the ethic's content (name, six movement headings, ground sentence) rides only where `main` already carried it — the ac-a-face body, byte-comparable, plus the new italic naming the carriage itself ("frozen ethic, carried by reference · facticity → dignity → love", the record's §1 movement). The other four scenes' text blocks are identical to main; the enrichment added no ethic restatement anywhere. The six movements in the body are the record's §1 headings verbatim.
- **histories' trunk sequences walk the records' OWN section headers** — VERIFIED for all ten journeys programmatically: every sequence step text is a `##` header of its record at fc59a719, all in record order (three records also read in full: mathematics, myth, ancient-philosophy).
- **etymologies' word chains** — VERIFIED: `Fides → Topos → Logos → Nomos → Natio → Credere` is the trust record's own title and section order; `Homologia ↔ Analogia` the homology record's two members; the symbol-account-trust four operations match the record's four; arbitration's centre walks `hybris → regard → anamnesis`, the record's own naming order (register-3 flowerings, with the scene binding carrying the records' four-register evidence discipline — no philological descent claimed). But see the REJECT below for the six discs.
- **roz-s-products stays §5 staging** — VERIFIED: 7 scenes (no growth into the 83-member field); the S envelope sequences the six names verbatim (`Central → Actuation → AIKit → Software Factory → Workcell → Quaternal Logic`, the record's six children, "not a seventh product" carried in the body); every product scene carries both lens bodies (`lens1`/`lens2`) whose titles are the two movements the centre sequence walks; the pairs block lists all six assignments completely.
- **lens records deleted before fc59a719** — VERIFIED: `lenses/baudrillard.md` and `lenses/foucault.md` exist at dbf3b17, are in 722ae3da's deletion list, absent at fc59a719; the binding's enrichment note discloses the dbf3b17 re-read and names the deleting commit, and its "the underlying source files remain at fc59a719" is accurate (the Baudrillard/Foucault source houses are live). Lens scene sequences are the lens records' own sentences verbatim (baudrillard §0's profile loop; foucault §0's three authorised-speech sites).
- **dossiers** — the governing plates sequence their records' own section findings verbatim (5 of 7 carry sequences; bohm's checked against its headers). Note: the trunk walk is selective — formal-limit's and bohm's `#4` sections are not walked (the plate body carries `#0`). Recorded as an observation: the note claims "the record's OWN section findings", not all of them, and no binding element (path/hash/relations/rider) is dropped.

## Rubric findings

### roz-c-concepts-1 — PASS

1. **Fidelity — pass.** Four records spot-read in full at fc59a719 (C05, C11, C14, C18 — three of them the lane's sequenced scenes, C11 its 3D scene). Every staged chain is the record's own notation; kickers/consumers/sources match frontmatter; 43/43 distinct texts have exact-key rationales, zero orphans. The un-sequenced spot-read (c44, prompt thrownness) carries its record's move in physics/material/pointer — speed 0.18 and dispersion 0.02 against the journey's typical 0.3+/0.04–0.14, weak repel 0.7 — thrownness staged as near-stillness, not churn; body is the record's §0 verbatim.
2. **Move carries the argument — pass.** C05: the walker crosses between the two standing edges (portrait/seeing) — the gap never closes; C14: cymatic shape for the vibration source, the gnomon arithmetic walked stepwise with size/tint weight rising to the six-by-six; C18: repel against the ring of non-application while the word excludes and returns positive.
3. **Restraint — pass.** Quiet scenes stated (c44's note: "near-still inherited horizon; weak pointer").
4. **Legibility — pass.** Text blocks top-left, formations centre/right; no text-on-mass in any inspected frame; kicker/title/italic/body hierarchy with ≥2 sizes; C05's chain glyphs and the c11 cardinals readable at cover size.
5. **Continuity — pass.** The two-edge motif of c05 returns as the diameter crossing of c11; rust/ink accents recur with meaning (failure modes per the note); the register split from concepts-2 is real (cooler papers here, warmer there — verified in the backgrounds).
6. **Craft-note honesty — pass.** 3D meaning stated for c11 (the ordering crossing the diameter at the middle — the record's own line) and verified against the staged z values; automation present (e.g. c05's gap-drift/pole-drift LFOs — the gap breathes but does not close), distinct durations 12–16 and transitions 1.6–2.6 across the member.

### roz-c-concepts-2 — REJECT(6): two standing glyphs have no rationales

1–5 verified: **Fidelity** — C47/C49 records read in full; chains verbatim; c42's record cited for the orbital; kickers 32/32 correct. **Move** — the c44-style quiet carries; engine-forward scenes (relational orbital on c42, autoSweep ascent on c43, morphEnabled on c36/c52) are the relational concepts' own determinations. **Restraint** — C47's tint-only is stated and real (see render pass). **Legibility** — C49's strata frame and C47's chain italic clean at cover size. **Continuity** — the two registers genuinely split (8/8 claimed round-material scenes verified round; warmer papers verified).

6. **Craft-note honesty — FAILS on two glyphs.** `glyph_rationales` has no entry for c48's standing entity text `0/1` (Trust/Faith under Formal Limit's single text-formation) nor for c49's standing entity text `/` — the primordial slash itself, on the member's THE-3D-scene. The sibling binding carries `0/1` ("the return that recognises the relation active throughout") and this binding carries `/ = −/−`, so the sign-of statements are one key away — but the floor's letter and the wave-1 exact-key line require the entries. The linter passed them only because its check is substring-based (`noteText.includes(g)`), which any note containing "0/1" or a slash satisfies — see the Point-Cloud #6 note below. Fix is two one-line entries; the member re-enters at the objective pass.

### roz-ac-root — PASS

1. **Fidelity — pass.** AC.md read in full at fc59a719 (real path `section-rooms/arguments/conjugate/AC.md`; the binding honestly discloses the move in its enrichment note). Ladder verbatim with the `↺` return (record §2's display form); the C-face sequence is the record's local movement (`identity → form → potency → transformation → embodiment → return`); the close is the record's own fraction. The ethic rides exactly as `main` carried it — see the claims check above.
2. **Move — pass.** The walker descends the hexagonal ladder station to station (vortex/vortex: the recognition turning); ac-close's implode click gathers both faces into the compound.
3. **Restraint — pass.** Five scenes only; the ethic scene's stillness is the frozen-ethic point itself.
4. **Legibility — pass.** Station glyphs (`(0/Ø)/(1/X)` longest) legible; text off the mass in all five scenes.
5. **Continuity — pass.** One arc: root → A face → the recognition → C face → the close reading `1/0` back into `(0/1)/(1/0)`.
6. **Craft-note honesty — pass.** 20 rationale keys for 14 used texts — over-covered, including both the record's full office names (`identity / centre` …) and the staged short forms; no missing keys. 3D meaning stated (numerator over denominator) and staged.

### roz-histories — PASS

1. **Fidelity — pass.** All ten sequences = their records' own `##` headers, verbatim, in order (programmatic check over all ten + three records read). Era-true sources carried in bodies (myth's frame citations, mathematics' Kaplan spine in the body/italic).
2. **Move — pass.** Each history's trunk walk is its record's own periodisation; the mathematics 3D stations order absence-furthest to machine-nearest — the record's own arc staged as depth.
3. **Restraint — pass.** The unsequenced remainder of each record stays in the body/binding rather than being padded into extra scenes.
4. **Legibility — pass.** Dated-scene kickers and title blocks clear; myth's five stations legible at cover size in t18.
5. **Continuity — pass.** Ten distinct periodisations, one register treatment (HISTORY kicker, shared grammar); no template duplication — sequence lengths differ 3–6 per record as the records do.
6. **Craft-note honesty — pass.** 50/50 rationales exact; the "HISTORY" kicker convention matches records that declare no claim_status (nothing invented); the 3D meaning (trunk stations in z) is stated and staged.

### roz-dossiers — PASS

1. **Fidelity — pass.** bohm + formal-limit read at fc59a719; sequences verbatim record findings; compound claim_status riders byte-identical in the scene bindings; record paths/hashes kept per protocol (see the provenance finding below for the tension this creates).
2. **Move — pass.** The evidential-plate grammar: the governing plate sequences the findings while tints walk weight toward §5→0; bohm's plate-beneath/unfolded-above enfoldment is the dossier's own move (the whole enfolded, the account unfolded).
3. **Restraint — pass.** Two of seven quiet by stated reason; the note names which plates walk and why.
4. **Legibility — pass.** Plate cells read as cells; text blocks clear.
5. **Continuity — pass.** One plate grammar across seven dossiers with per-dossier differences (bohm 3D); the arc runs formal-limit → … → O:I technical responsibility.
6. **Craft-note honesty — pass.** 21/21 rationales exact; the note's "5 of 7 carry sequences" is exact; the §5→0 tint walk stated.

### roz-etymologies — REJECT(6): the arbitration note claims carriage the artifact does not have

1–5 verified: **Fidelity** — the word chains are the records' own (title/section order for trust; two members for homology; four operations for symbol-account-trust; register discipline carried on the arbitration scene binding). **Move** — centres walk the word's own stages; vortex/vortex on arbitration (arbitration turning) is its record's gesture. **Restraint** — long transitions where qualification develops (homology) are stated. **Legibility** — trust's six stations legible face-on and in depth. **Continuity** — one whole-field grammar, six different word-histories.

6. **Craft-note honesty — FAILS on one scene.** The binding note says "the six discs now carry the record's six generated relations verbatim (### headers #0–#5→0 map one-to-one)", and the commit message repeats it — but the six generated relations (`Continuity-in-Indeterminacy`, `Criterion-through-Distinction`, `Delineation-through-Difference`, `Arbitration-in-Crisis`, `Con-text-through-Diaphaneity`, `Resolution-in-Reconciliation`) appear **nowhere in the journey JSON** (entity text empty, no step text carries them; string-search over the whole artifact is negative). Their six "rationales" are position indices ("generated relation #3"), not sign-of statements — the record's own section describes what each relation *is*, so truthful one-liners were available. This is the wave-1 rejection class: content attributed to a carrier that does not contain it. Fix: either stage the six names on the discs (≤10 formations is respected) with real sign-of rationales, or rewrite the note to say the relations are held in the binding only and drop the "verbatim on the discs" claim. The member re-enters at the objective pass.

### roz-lenses-aphorism — PASS

1. **Fidelity — pass.** Lens records read at dbf3b17 (their only revision — deletion verified and honestly disclosed); both scene sequences are the records' own sentences; the aphorism's four ratified lines verbatim in body and sequence; kicker ARGUED matches.
2. **Move — pass.** The simulation loop walks (profile → access → conduct → confirmation) — the record's own loop; the aphorism's lines alternate approachable/absolute depth (z +0.3 / −0.4 / +0.15 / −0.55), which is the aphorism's own distinction staged.
3. **Restraint — pass.** Three scenes only; the near-still contemplation field is stated.
4. **Legibility — pass.** The complete aphorism legible in the body of every captured frame; the rust faith disc reads against the two limit-edges.
5. **Continuity — pass.** Two lenses' loops feed the aphorism that ratifies both limits; one arc.
6. **Craft-note honesty — pass.** 10/10 rationales exact; the note discloses the rust disc as the family Offered-accent reused as presentation, not a status claim on an Argued record; 3D meaning stated and staged.

### roz-s-products — PASS

1. **Fidelity — pass.** Six names verbatim (AC.md §3's six children); "S is the whole, not a seventh product" is the record's own caveat and the journey's own body text; both lens bodies per product, their titles the movements the centre walks; the pairs block complete and regular.
2. **Move — pass.** The envelope sequence walks the six over the 3D field — the whole holding its six; each product's centre walking its lens pair's two movements verbatim is the product teaching itself.
3. **Restraint — pass.** Stays the essay's §5 staging — seven scenes, no growth into the 83-member field (the lane boundary held).
4. **Legibility — pass.** S0's four text blocks (editorial, body, two lenses) placed clear of the formation; the s scene's pairs block sits in the margin column.
5. **Continuity — pass.** S → S0–S5 with M37–M42 kickers; the sixfold returns to the whole.
6. **Craft-note honesty — pass.** 19/19 rationales exact; lens plates noted as fixed for 390×844; the s 3D meaning (the envelope is the whole) stated and staged.

## Point-Cloud #6 candidates met

1. **Linter rationale check is substring-based** (new, this wave): `expression-richness.mjs` accepts a glyph when `noteText.includes(g)` — any occurrence anywhere in the notes text passes, so `0/1` and `/` pass without `glyph_rationales` entries, and single-character glyphs can effectively never fail once any note contains that character. Exact-key checking (or word-boundary at minimum) would have caught the concepts-2 gap mechanically. Engine/test observation for the same ledger as the ceiling mismatch.
2. **Binding provenance contradiction (programme-level, inherited)**: the protocol's "keep every existing source binding (record ids, paths, hashes) — enrichment does not re-bind sources" freezes dbf3b17-era `path`+`sha256`+`hash_note` triples inside `source_revision.records[]` while `source_revision.commit` now reads fc59a719. For every record that moved in 722ae3da (all 64 concepts → `section-rooms/arguments/concepts/`; histories → `HISTORY-<name>.md`; lens records deleted) the recorded path does not resolve at the recorded revision, and at least one `hash_note` ("matches current bytes", formal-limit.md) is false at fc59a719 — true only at dbf3b17, the file having changed in 722ae3da. The lane disclosed every real fc59a719 location in the bindings' enrichment notes, so no content claim is false; but the schema now carries triples that never co-existed. Worth a dedicated re-bind pass (or a `resolved_path`/`resolved_at` field) before the next wave relies on machine resolution of `source_revision`.
3. **Commit-boundary race (process, disclosed)**: concurrent member commits interleaved two members' files into `6b088a7b6`. Content complete at HEAD; noted for the integrator's landing discipline.
4. **Capture tool defect (standing)**: Point-Cloud-Demo required `npm ci` + `npm run build` with no error pointing at it — cost this wave nothing (dist/ already built by the author lane), recorded per protocol.

## Re-check — 2026-10-06, revision `586dcfade` (both rejects accepted)

Re-check of the two members revised in `586dcfade`, against the records at fc59a719. Original findings above stand unmodified; this section supersedes the two REJECT verdicts.

- **roz-c-concepts-2 — PASS (revised).** Tightened linter (exact `glyph_rationales` keys or glyph-initial note lines, `a61a36775`): 8/8. Exact-key coverage now 37/37 used texts, zero orphans. The c48 `0/1` rationale — "the mark of reliance itself — the All depends on the One for being and determining reality, the One becomes manifest and knowable through the All (C48: dependency before belief)" — traces to **C48's own §0 sentence**, verified at fc59a719 (`C48-Trust-Faith-under-Formal-Limit.md` line 15: "…the dependency of `0/1`, before trust becomes a belief about a neutral world. The All depends on the One for being and determining reality; the One becomes manifest and knowable through the All."): attribution exact, not borrowed without warrant from C49's parallel phrasing. The c49 `/` rationale traces to C49 §0 ("The primordial `/ = −/−` precedes assignment of the terms; the terms become legible through that relation") and honestly scopes itself to the strata scene. Both are sign-of statements in the sources' own terms.
- **roz-etymologies — PASS (revised).** The lane took the staging option, and the carrier now matches the claim: the centre sequences the six generated relations verbatim in the record's own ### order (`Continuity-in-Indeterminacy → Criterion-through-Distinction → Delineation-through-Difference → Arbitration-in-Crisis → Con-text-through-Diaphaneity → Resolution-in-Reconciliation`), tints deepening 0.6 → 0.95 toward the reconciliation; the envelope ring walks `hybris → regard → anamnesis`. All six relation rationales re-read against the record's ### sections at fc59a719 — each is a sign-of statement in the section's own words (e.g. #0's "continuity exceeds repetition" = the record's "Continuity therefore exceeds the repetition of a previous result"; #3's "an objection must reach the conditions governing the judgment" = the section's own line; #5→0's "reconciliation preserves the differences through which the history occurred" verbatim). The binding move-note is restated to say exactly what is staged (centre sequences, ring walks the title words). Journey identity vs `main` still clean (ids/names/characters/description untouched); exact coverage 28/28, no orphans. Fresh capture verified: `/tmp/expression-enrich/episteme/captures/roz-etymologies.etymology-arbitration-hybris-regard-anamnesis.t20.png` (15:26, before the 15:27:23 commit) — centre among six operation discs under vortex, and the record's four-register non-descent rider now legible in the scene body, the right guard against reading the walk as philological descent. Rejected from evidence: the position-index rationales are gone; no other scene changed.

Original verdict lines above (REJECT for these two members) are superseded by this section; the six PASS members are unaffected by `586dcfade`.

## Evidence inventory

- Contact sheets (committed): `renders/episteme/roz-{c-concepts-1,c-concepts-2,ac-root,histories,dossiers,etymologies,lenses-aphorism,s-products}-contact-sheet.png`
- Author captures reused: `/tmp/expression-enrich/episteme/captures/` (43 frames — C05/c42/ac-crossed-zero/history-myth/dossier-formal-limit/s0 morphs, the eight 3D yaw pairs)
- Critic captures (new): `/tmp/expression-enrich/episteme/critic-c47/roz-c-concepts-2.c47.t{0,4,9,13}.png`
- Records read at fc59a719: `section-rooms/arguments/concepts/C05-Immutable-Gap.md`, `C11-Quaternal-Logic.md`, `C14-Maya-Operative-Measure.md`, `C18-Apoha.md`, `C44-Prompt-Thrownness.md`, `C47-Deferential-Intelligence.md`, `C49-The-Two-Ones-0-One-1-All.md`; `section-rooms/arguments/conjugate/AC.md`; `symbolon/episteme/histories/…/HISTORY-{mathematics,myth,ancient-philosophy}.md` (headers); `symbolon/episteme/dossiers/{bohm,formal-limit}.md` (headers + bohm §4); `symbolon/episteme/etymologies/{trust-place-logos-nomos-natio-credere, homology-and-analogy, arbitration-hybris-regard-anamnesis}/WHOLE-FIELD-*.md`; `symbolon/episteme/aphorisms/investigation-and-faith.md`. Lens records read at dbf3b17: `symbolon/episteme/lenses/{baudrillard,foucault}.md` (deletion in 722ae3da verified).
