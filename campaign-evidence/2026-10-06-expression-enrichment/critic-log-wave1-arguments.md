# Critic log — wave 1, arguments + conjugates (Aletheia's office)

Critic worker: `zcode:enrich-critic-w1b` · seat env-1/o-i · branch `enrich/expressions-20261006`
Subjects: `roz-a-arguments` (36 scenes, a01–a36) and `roz-a-prime-conjugates` (36 scenes, a01p–a36p),
re-authored by lane `zcode:enrich-arguments-l1` (commits 08beb04c5, 3c474a444).
Source records read at vault revision **fc59a719** under
`submission-package/essay/section-rooms/arguments/` (+ `/conjugate/`), per the move the
author recorded in `enrichment.note` (bound `source_path` values keep their dbf3b17 homes).

## Objective pass

| Check | roz-a-arguments | roz-a-prime-conjugates |
|---|---|---|
| Richness linter (`expression-richness.mjs --collection <family>`) | PASS | PASS |
| validateJourney (run inside linter, `expression-richness.mjs:129`) | clean | clean |
| Journey id / description / name vs main | unchanged | unchanged |
| Scene ids / names / characters vs main | 36/36 unchanged, none added, none missing | 36/36 unchanged, none added, none missing |
| Records addressed | a01…a36 intact | a01p…a36p intact |
| Claim-status kickers (`<id> · <STATUS>`) | 36/36 byte-identical to main; statuses ARGUED/DERIVED | 36/36 byte-identical to main (main's own bound form is `A01p`, not `A01′` — author preserved it exactly) |

Kicker note: main's conjugates kickers read `A01p · ARGUED`; the prime-sign form would be a
rename. The author was right not to "fix" it. Not a defect.

## Render pass (pixel evidence, not frame counts)

Contact sheets: `campaign-evidence/2026-10-06-expression-enrichment/renders/arguments/roz-a-arguments-contact-sheet.png`
and `.../roz-a-prime-conjugates-contact-sheet.png` (author frames from `/tmp/expression-enrich/{arguments,conjugates}/`,
critic re-captures from `/tmp/expression-enrich/critic-w1b/`).

Mean pixel-abs-diff between frames (PIL, threshold >12 counted as changed):

| Pair | meanAbsDiff | changed |
|---|---|---|
| a13 t0→t7 / t7→t14 / t0→t14 | 2.07 / 2.08 / 2.84 | 3.5% / 3.7% / 4.0% |
| a18 t0→t6 / t6→t12 / t0→t12 | 2.87 / 2.09 / 2.97 | 4.7% / 3.0% / 4.9% |
| a06 yaw0.55→yaw1.8 | 1.02 | 0.9% |
| a14p t0→t7 / t7→t14 | 2.61 / 3.40 | 4.6% / 5.7% |
| a17p yaw−0.5→yaw1.6 | 1.43 | 2.4% |
| critic re-capture a14p t0→t6.5 / t6.5→t10 (fresh server, committed JSON) | 10.33 / 15.26 | 13.5% / 18.8% |
| critic re-capture a36p t0→t3 (fresh server, committed JSON) | 5.34 | 6.5% |

What the pixels show (read, not assumed):

- **a13 the collapse** — t0: two pole masses held apart; t7: poles slid together into a
  crossed mass; t14: re-divided as two upright poles with the relation's blocks between.
  Matches the JSON move: poles at x=±0.42 → ±0.06 → ±0.42 while the text source walks the
  record's five mathemes `/ = −/−` → `(−1)/(+1)` → `(−1)+(+1)=0` → `(−1)−(+1)=−2` →
  `(0/1)/(1/0)`.
- **a18 the eight turns** — t12 clearly forms `0/1` from the particle mass inside the ring
  (t0/t6 are mid-traversal states). JSON carries all eight turns in the record's own order
  and wording: `−/−, 0/1, ?/!, −/+, X/x, AM/IS, ∞/dx, 1/0`, with size 0.8→1.15 and
  tintWeight 0.70→0.91 deepening step to step. Note: the author's t6/t12 wall-clock frames do
  not land on the `−/+`→`0/1` pair the wave brief sketched (the sequence clock runs from scene
  entry, so stills land where they land); the morph itself and the record's own order are what
  the pixels and JSON both confirm.
- **a06 Vāk depth** — the yaw pair is genuine parallax, not recolour: the dense head at yaw
  0.55 collapses edge-on at yaw 1.8 and the descent column's vertical striations separate.
  JSON: `Parā Vāk → Paśyantī → Madhyamā → Vaikharī` descending z 0.45→−0.6;
  depthPerspective+occlusion+tint authored; craft note states z = depth of articulation.
- **a14p ℝ²/ℤ²→torus→0/1 on the cymatic plate** — author frames t0 (collapsed class plate),
  t7 (the torus as a ring on the plate), t14 (looped back to `ℝ²/ℤ²` glyphs formed from
  particles — legible). The `0/1` step itself was not in the author's frames (the t14 sample
  wrapped the loop); the step exists in JSON (`the torus` ring → `0/1`) and my independent
  re-captures against the committed JSON show large ongoing state change (13.5–18.8%), so the
  sequence runs as authored. Cymatic plate layout + `resonanceEnabled` confirmed in JSON.
- **a36p AGI→AHI** — cover forms `0/1` large; critic re-capture t0/t3 shows the `AGI → AHI`
  row formation changing state (gathered disc → displaced band). JSON: sign cycle
  `0/1 → 1/0 → 0/1` (grown, darkened) beside row steps `AGI` (x=−0.3) → `AHI` (x=+0.3) —
  the record's own FROM→TO pair.
- **a17p 3D** — yaw pair shows real parallax; traveller disc `descriptive → predictive →
  speculative` (the record's §5.2 modalities) with saw/sine lift automation; craft note: z is
  the lift onto the covering path.

Pointer authoring (no pointer-driving in the capture harness; judged from JSON + linter):
A carries repel×10 / attract×21 / vortex×5 with clicks pulse×21 / implode×8 / vortex×5 /
shove×2; A′ carries repel×11 / attract×20 / vortex×5 with pulse×29 / shove×2 / vortex×5.
Distinct profiles per journey ≥3 (linter-enforced). Boundary/withholding scenes carry
repel; gathering scenes attract/implode; traversal scenes vortex — consistent with the
floor's meaning map.

## Rubric

### Member: roz-a-arguments — PASS

1. **Fidelity** — spot-read at fc59a719: A13 (`section-rooms/arguments/A13-…Dia-Syn.md`),
   A18 (`…/A18-…Eight-Determinations.md`), A26, A03, A34, A36. The a13 sequence is the
   record's own five mathemes in its own order (A13 §#0–#2); a18's eight turns are verbatim
   the record's chain `/=-/- ⟶ … ⟶ 1/0` (A18 §#0); a26's `0 → Ø → X → Ø/X → (0/Ø)/(1/X) →
   1 ↺ 0/1` is stated verbatim in A26:56; a34 stages the record's own bolded order
   `Subject / Consciousness → constituted means → determinate object` (A34:24 — an
   improvement on main's paraphrase); a36's `0/1↔1/0` cycle is the record's advent pair.
   Withholdings hold: `0/1` appears only at a11/a13/a18/a26/a36, each of whose records uses
   it; `Ø` only at a03 and a26, whose records carry Ø (6 and 3 uses respectively).
   Kickers, relations blocks and per-scene body compressions assert no new claims.
2. **The move carries the argument** — a13: pole slide = the record's collapse/appropriation
   distinction (argued move, not decoration); a18: the traversal IS the record's eight-turn
   passage; a06: the descent in z IS the record's speech descent. All three express the
   records' own moves.
3. **Restraint** — all 36 scenes have per-scene move notes in the binding
   (`Enrichment moves 2026-10-06`, 36/36 ids present); quiet scenes are stated as quiet
   (word-carrying scenes A06/A14/A34 run quieter fields so letterforms hold — craft note).
4. **Legibility** — text blocks sit in a dedicated left column off the formation's mass in
   all inspected frames; sizes 15/19/28 (≥2 hierarchy); glyphs (`0/1`, `ℝ²/ℤ²`, eight-turn
   signs) read at cover size in the frames checked.
5. **Continuity** — recurring signs transform with meaning across the arc: the slash family
   (a10–a13 → a18's eight turns → a36's grown return sign), Ø chain at a03/a26, descent terms
   at a06, order-of-dependence at a34; tint/size deepen step-to-step in a18; the journey reads
   as one argued arc in essay order, not 36 copies of one scene.
6. **Craft-note honesty** — glyph_rationales cover 92/92 distinct entity+step texts, zero
   missing, zero empty; samples are sign-of statements citing the owning record (e.g. "the
   crossed zero (A03, A26)…"), and the A attribution of the recognition sequence to **A26**
   is correct per the record text. 3D meaning stated for both 3D scenes (a06, a17) and true
   to what the scenes stage; automation targets (frame scale breathing, traveller orbit,
   anchor drift, self/other breathing, down/up scales) are tied to the records' moves in the
   note.

### Member: roz-a-prime-conjugates — REJECT(1): a26p stages notation its record does not make

Everything objective passes (see table) and six of seven deep-checked scenes are faithful
(a13p `(0/1)/(1/0)` ✓ record; a14p quotient chain ✓ record; a17p modalities ✓ record §5.2;
a18p eight turns ✓ record; a36p `AGI → AHI` ✓ record; a11p `0/1`,`1/0` ✓ record). One scene
breaks the fidelity line:

- **The defect** — scene `a26p` ("The Essay Inside the Film") runs the sequence
  `0 → Ø → X → Ø/X → (0/Ø)/(1/X) → 1 ↺ 0/1`, and the binding's `glyph_rationales` attribute
  these glyphs to **A26′** ("the crossed zero (A26′)…", "mediated crossing (A26′)…",
  "field-availability (A26′)…", "recognition's return (A26′)…", "the identified instrument
  (A26′)…"). The A26′ record at fc59a719 contains **no Ø and no such chain** — its only
  formal notation is `1/0` ("This is the essay's 1/0 turn", §#5→0); the same holds at basis
  commit dbf3b17 (0 occurrences). The chain is A26's recognition sequence, stated verbatim in
  the *other face* record (`section-rooms/arguments/A26-Objective-Internality-Mind-as-Worldhood.md`
  line 56 at fc59a719). The scene body text does honestly name it ("the recognition sequence
  makes the means reflexively available") and the relations block declares other face A26 —
  but the staged notation rides in the A26′ scene as if it were this record's own development,
  and the craft note asserts A26′ as its source five times. The sibling A member stages the
  same sequence on a26 **with correct attribution to A26** — which is exactly what shows the
  A′ attribution to be an error, not a policy.
- **Why REJECT and not note-and-pass** — rubric line 1: overclaiming rejects; lane brief:
  "the record's own load-bearing notation appears as text sources only where the record
  states it". A26′ does not state it, at either revision.
- **Smallest sufficient fix for the author** — either (a) keep the sequence but re-attribute
  the five rationales to A26/the recognition sequence of the declared other face, and say in
  the a26p note that the scene stages the other face's sequence through the declared A26
  relation (the body text already frames it this way); or (b) drop the Ø chain from a26p and
  keep the record's own `1/0` turn as the scene's notation. Either way, no re-bind and no
  scene-count change; the revised member re-enters at the objective pass.

Lines 2–6 for A′ on the evidence above: the moves carry their records (a14p, a17p, a36p
verified against record text); per-scene notes cover 36/36; legibility holds in the
print/cool frames (ℝ²/ℤ² glyphs legible at cover size); continuity holds (the eight turns,
the quotient chain, AGI→AHI); rationales cover 112/112 with zero missing. The rejection is
scoped to the line-1 defect on a26p; the a03p scene never stages Ø (which A03′ does use) —
under-expression, not overclaim, noted for the author's convenience, not a rejection ground.

## A vs A′ distinctness (craft caution)

Distinct in means, not just palette: A = ink `#f4f2eb`, sine/triangle automation only
(breathing), layouts Single formation + Kundalini, 3D at a06 (descent) and a17 (lifts), clicks
include implode×8; A′ = print `#e9ece7`, square/saw/steps automation (technological tick),
adds Cymatic plate + Chakra Body layouts, 3D at a17p only, no implode. The two journeys do
not converge.

## Point-Cloud #6 candidates (shared tooling, met during verification)

1. (Already returned by the authoring lane, reconfirmed) `tools/capture.mjs --all-scenes`
   calls `__FIELD_STUDIES__.openScene(...)`, which no longer exists — `setScene(index)` is
   the current API; passing an id throws a misleading undefined-transition error.
2. New: the authoring lanes' scratch driver `/tmp/expression-enrich/*/snap.mjs` documents
   `[--port N]` in its header but never parses it — the token falls through to the positional
   file argument (`open('47971')`); I patched a critic copy. Trivial, /tmp-only, recorded so
   the next lane does not trust the flag.
3. (Cost note, per protocol) Point-Cloud-Demo required `npm ci && npm run build` with no
   error pointing at it before any capture worked — the capture path still has no
   actionable failure mode for a stale build.

## Verdicts

- `roz-a-arguments` — **PASS**
- `roz-a-prime-conjugates` — **REJECT(rubric line 1 — fidelity)**: a26p stages A26's
  recognition sequence and the binding attributes it to A26′, whose record (fc59a719 and
  dbf3b17) never states it. Return to `zcode:enrich-arguments-l1` for attribution fix or
  removal; re-enters at the objective pass.

---

## Re-check 2026-10-06 — roz-a-prime-conjugates after fix 85dd944e4 (a26p only)

Scope: the authoring lane applied smallest-fix option (a) from the rejection above —
commit `85dd944e4`, binding only (1 file, 6 insertions / 6 deletions; the journey JSON is
untouched, so the render evidence and all objective checks from the first pass stand).

What I verified against the record text at fc59a719
(`section-rooms/arguments/A26-Objective-Internality-Mind-as-Worldhood.md`, its conjugate
root `conjugate/AC.md`, and `conjugate/A21-prime-Individuation-with-Recognition.md`):

- **a26p craft note** now states the staging plainly: the scene stages *the other face's*
  recognition sequence, "which belongs to A26 (stated verbatim in the A26 record citing the
  shared A/C root, conjugate/AC.md; A26′ itself carries only 1/0 as formal notation)" and
  reaches a26p "through the declared A26↔A26′ other-face relation, not as A26′s own
  notation." Unambiguous, and true per the records: the chain is in A26 (line 56) and in
  AC.md (:79 Ø, :83 Ø/X, :85 (0/Ø)/(1/X)); A26′ carries only `1/0` (verified again in the
  first pass at both revisions).
- **Rationales re-attributed**: `Ø` now cites "A26, the declared other face, whose
  recognition sequence a26p stages"; the `Ø/X`, `(0/Ø)/(1/X)` and `1 ↺ 0/1` rationales
  locate the sequence "in the A26 record and the shared A/C root it cites". The attribution
  chain now traces to records that state the sequence. The sign-of content is unchanged and
  was never the defect.
- **The shared `X` key** now carries both senses in their owners' terms: A21′ ("the
  pre-individual capacity the achieved x opens toward" — faithful to A21′:31,37, where
  "The QL crossing becomes exact as X/x" and "x → X → x") and A26's recognition sequence
  ("the instrument identified as such"). This also repairs a latent second defect the
  re-check surfaced: the old `X` entry attributed to A26′ while serving a21p, whose record
  is A21′'s — the lane's fix note is accurate.
- **Objective gate re-run**: linter PASS 1/1 for the conjugates collection; glyph coverage
  still 112/112 with zero missing; journey identity untouched.

One nit recorded, not blocking: the three re-attributed rationales spell the possessive
`A26′s` (A26 + U+2032 PRIME + s). Since the prime is this vault's conjugate-id marker
(`A26′` is the *other* record), the string can be misparsed as A26′'s possessive on first
read; the intended possessive of A26 would be `A26's`. The clause that follows ("stated in
the A26 record and the shared A/C root it cites") and the a26p note two fields away make the
actual attribution impossible to misread in context, so this is a clarity suggestion for the
author's next binding touch, not a fidelity failure.

## Re-check verdict

- `roz-a-prime-conjugates` — **PASS** (a26p re-check after 85dd944e4). The staged sequence
  is now honestly declared as the other face's, the rationales trace to A26/AC, and the
  shared `X` key serves both records in their own terms.

Critic capture artefacts: `/tmp/expression-enrich/critic-w1b/` (a14p t0/t6.5/t10, a36p t0/t3,
patched `snap-critic.mjs`); committed sheets under `renders/arguments/`.
