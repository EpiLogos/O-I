# Critic log — wave 3, S-PRODUCTS (83 members) — zcode:enrich-critic-w3, 2026-10-06

Subject: `production/s-products/{actuation,factory,quaternal-logic,aikit,central,workcell,ql}/*.journey.json` (83)
+ the 83 in-place-updated bindings, lane `zcode:enrich-sproducts-l3`, branch
`enrich/s-products-20261006` (checkout read-only: /Users/admin/Central/worktrees/env-2/point-cloud-demo).
Verdict: **83/83 PASS** (no rejections), with one cross-cutting binding-hygiene
finding returned to the authoring lane (below, does not block).

## 1. Objective pass — clean

- Linter over the whole s-products root (`OI_PCD_S_PRODUCTS_ROOT` → the lane
  checkout): **83/83 journeys meet the enrichment floor** (linter at f28d89d19,
  size-aware pointer/beats floors, run from the O-I seat).
- `validateJourney` re-run independently over all 83 via the engine import:
  clean.
- Identity: all 83 journey `id`s, `description`s, and every scene
  `id`/`name`/`character` byte-identical to origin/main (scripted diff). No
  scene added or dropped.
- Bindings: all 83 `scene_id` / `material_source_ref` / `s_record_sha256`
  fields unchanged vs origin/main — enrichment did not re-bind sources. All 83
  carry `enrichment {2026-10-06, zcode:enrich-sproducts-l3}` and per-member
  `material_inventory.enrichment_source_read` notes naming the pinned product
  commits and the essay record read at fc59a719 (honesty field present on
  83/83).
- Scene ids derive from bound record paths (e.g. `fd-s1-docs-01-activity` ←
  `docs/ACTIVITY.md`); the root journeys' `s<stage>-m<movement>-<term>` and the
  factory fd `<member>-whole` overview scene are the pre-existing conventions
  (unchanged from origin/main).
- Branch shape: 166 changed files = 83 journeys + 83 bindings, zero files
  outside `production/s-products/`.

## 2. Former structural-cap members (5) — pass is meaning, not defaults

`sp-actuation-ql-runtime-reviews-1` (12 scenes, 4 pointer profiles — notes now
declare "Declared floor miss: none"), `sp-actuation-ql-runtime-reviews-2`
(2 scenes), `sp-actuation-skills` (2), `sp-central-surfaces` (2),
`sp-central-projectcentral` (1). Checked explicitly:

- No scene leaves the pointer on engine defaults — every scene authors its
  profile explicitly (scripted scan across all 83; only these five have <3
  scenes, and each scene's profile is distinct where more than one scene
  exists).
- Profiles are meaning-chosen and the reasoning is in the notes: reviews-2's
  `attract/pulse .16` (settled, valid-for-human-comparison) vs `attract/pulse
  .06` (held, earlier runner revision); reviews-1's declared arc "rupture ×4 →
  gather → rupture → settle ×6" staging the INVALID/INCOMPLETE → VALID run;
  skills' `gather → settle` with operation declared "the quietest member in the
  product — the skill's own point is restraint"; central members' declared
  pointer vocabulary (guard=sources hold standing, gather=continuity gathers).
- Each binding declares its structural situation honestly ("a scene carries
  exactly one pointer profile, so at most two are expressible without adding
  bound sources. Not faked."). The size-aware floor's pass reflects the
  members' real scene counts, not faked variety.

## 3. Fidelity deep-checks (one+ member per product, records at their pins)

- **actuation — sp-actuation-ql-runtime-reviews-2** (records
  `…/2026-09-13-smoke-restraint/{review-fixed,review}.md`
  @ EpiLogos/Actuation 36bbf93b7896): glyphs Series/PASS/unmasked/human are the
  records' own title and determination terms; the review→review-fixed
  correction rests on the file pair and differing runner revisions the records
  carry; page text quotes the bound paths. No overclaim.
  Also **sp-actuation** s1-m3 (J-Space): scene body "J-Space remains a bounded
  articulation of world-for-agency" is essay S1's exact phrase (line 133);
  rationale traces to essay movement #3.
- **factory — sp-factory-fd-docs-canon-modules** (EpiLogos/Factory f59368de):
  rationales quote the records' own headings — "Decision date: 2026-08-14"
  (00-REPOSITORY-OWNERSHIP), "Four distinct layers" (01), "MEF is first-class
  as a whole" (03), "52. Deterministic core" (07). Pointer choices are the
  records' own moves (repel=ownership boundary, vortex=MEF manifold).
- **quaternal-logic — sp-ql-fd-ground** (EpiLogos/Quaternal-Logic 81d1af154):
  'wayfinder'/'maps'/'mef'/'entry'/'AGENTS' are the bound records' own kinds
  and headings; relational mode `orbital` is the product's pair grammar.
- **aikit — sp-aikit-fd-ground** (EpiLogos/ai-kit 23dea8563 + essay S2
  @fc59a719): 'aikit — the changing horizon of powers' is the essay's own
  phrasing; 'policy — the standing refusal' matches SECURITY.md's
  do-not-open-a-public-issue refusals and essay S2's "positive force of
  refusal"; CONTEXT.md rationales are its title terms.
- **central — sp-central-projectcentral** (EpiLogos/Central 36113051d748):
  rationales are the record's own opening sentence ("safely and minimally
  structures a filesystem into a shared, recursive home…") and title
  (capabilities / relations). 3D z declared as the capability's depth, staged
  as an even z-ladder −0.5…+0.5.
- **workcell — sp-workcell-projectcentral** (EpiLogos/Workcell d911bfd9597f):
  'content' rationale quotes the record verbatim ("what should this be like —
  consulted when something is made"); 'Telos — open intent' is the record's own
  title and standing.
- **ql — sp-ql** (EpiLogos/Quaternal-Logic 81d1af154 + essay S5): 'Other',
  'ground', 'containing whole' are essay S5 #0's exact terms; the s5-m3
  dia/syn glyphs ('dia cut', '(-1)/(+1)', 'syn AND/OR', '(0/1)/(1/0)') are the
  essay's formal notation, bound to the record that carries the `0/1 ↔ 1/0`
  notation. The repel/shove pointer on s5-m3 stages the recognition break
  (`1/0` breaking the materialist `1`) — meaning, not decoration.

No member among those read asserts a claim its record does not make; carried
bindings (claim status, relations, admission notes) are preserved in the
stable binding fields.

## 4. Render pass — flagships (own captures, fresh server on port 47981)

Captures: morph triplet (t≈5/16/27s of the sequence scene) + yaw pair
(±0.55 rad on the 3D scene) + 3D settled, per flagship. Raw frames:
`/tmp/critic-w3/shots/` (rig: /tmp/critic-w3/rig.mjs, not committed).
Measured pixel change (>8 levels, grayscale): morph t1→t3 1.0–3.0% across all
seven; yaw pairs 0.9–1.2% — real re-projection, not frame-count theatre.
Verified by eye on the sheets: sequence glyphs form from particles and are
legible at settled phases ("perceives combines imagines speaks"; "intention
form resistance"; "histories promises identities interpretations"; "knows
expresses reaches"; "Other ground context history"; "dia cut (-1)/(+1) …";
"wayfinder / maps"), text blocks sit off the formation mass, hierarchy
(kicker < title/italic > body) intact.

Contact sheets (campaign-evidence/renders/s-products/):
- sp-actuation-contact-sheet.png (morph s0; J-Space 3D s3 yaw pair — parallax
  visible: glyph row and disc re-project as a volume)
- sp-factory-contact-sheet.png (morph s0; material-grammar 3D s2 — elemental
  row "Aether Earth Water Air Fire …" foreshortens with yaw)
- sp-central-contact-sheet.png (morph s0; carried-world 3D s4 — Bimbā/
  Pratibimba row re-projects; continuity layers read in depth)
- sp-aikit-contact-sheet.png (morph+3D on s0 horizon — words reach across the
  frame; yaw pair separates the glyph row from the horizon mass)
- sp-workcell-contact-sheet.png (morph+3D on s0 somewhere/room — stations in
  z; yaw − collapses the room convincingly)
- sp-ql-contact-sheet.png (morph s0; s3 dia/syn recognition fold — the fold
  reads: yaw − draws the notation row into itself)
- sp-ql-fd-ground-contact-sheet.png (morph s0; ground 3D s1)

Pointer-drive evidence: the harness does not expose pointer synthesis to the
capture path, so Touch-mode frames were not captured; pointer authoring was
judged numerically from the JSON (§2) as prior waves recorded.

## 5. Rubric lines 2–6 on the flagships

- **Move carries the argument (2)**: each flagship's sequence walks the bound
  record's own heading terms as its per-scene move (examples above); camera/3D
  meanings are the products' own depth relations (continuity layers, room
  placement, recognition fold, horizon reach, J-Space world-for-agency,
  material grammar), not fake space. PASS all seven.
- **Restraint (3)** — weighed heaviest: the field is quiet by design — one
  ground disc + one glyph row per scene, no churn; deliberate quiets are
  declared in notes (sp-central-projectcentral "one record, one held scene";
  sp-actuation-skills operation). No drift-quiet found (every quiet scene
  carries its stated reason). PASS.
- **Legibility (4)**: text blocks inside the stage, off the mass at 1280×800
  captures; glyph words legible at settled phases. Minor transient noted:
  sp-workcell s0's two glyph rows cross mid-transition (settles clear); not a
  rejection. PASS.
- **Continuity (5)**: the six-movement arcs read as one arc per journey
  (movement kicker #0…#5, recurring ground disc, transforming glyph rows);
  fd members carry the same ground with record-specific rows. PASS.
- **Craft-note honesty (6)**: rationales are the sources' own terms (spot-read
  against pins, §3); 3D meanings stated and really staged; automation is
  declared per member (one breathing LFO, meaning named); every displayed
  glyph carries an exact-key rationale (linter a61a36775). PASS.

## 6. Finding for the authoring lane (non-blocking): orphan rationale keys

64 `glyph_rationales` keys across 48 members have no matching glyph in their
journey — authoring-template residue, e.g. the literal key `'unused'`
("the member's staging of the Factory whole — the S3 product field…") in 26
non-factory bindings, and `'S3 · full depth'` / `'the Factory whole'` in
sp-ql-fd-ground (a QL/S5 member). No displayed glyph lacks a rationale and no
displayed claim is false, so no member is rejected — but the mislabelled
orphan text in craft notes is below the binding-hygiene bar and should be
swept in a follow-up `[enrich:s-products]` cleanup commit (pure binding edits,
no journey changes). Full list reproducible with the checker used here.

## 7. Point-Cloud #6 candidates

- No new engine/editor defect met this pass: linter, validator and capture
  pipeline all worked against the prebuilt dist; the previously recorded
  candidates stand (npm-ci/build error transparency; the 10-formation/8-pin
  authoring ceiling vs the validator's 32 — the lane kept every scene within
  the ceiling, so nothing here exercises it further).
- Observation (authoring polish, not an engine defect): root members repeat the
  scene title verbatim as the italic line (kicker/title/italic floor); a
  distinct italic line would read better.

## Verdicts

| Product | Verdict |
|---|---|
| actuation (19) | PASS (deep-checked: sp-actuation, sp-actuation-ql-runtime-reviews-2) |
| factory (20) | PASS (deep-checked: sp-factory-fd-docs-canon-modules) |
| quaternal-logic (15) | PASS (deep-checked: sp-ql-fd-ground) |
| aikit (11) | PASS (deep-checked: sp-aikit-fd-ground) |
| central (10) | PASS (deep-checked: sp-central-projectcentral) |
| workcell (7) | PASS (deep-checked: sp-workcell-projectcentral) |
| ql (1) | PASS (deep-checked: sp-ql) |

83/83 PASS. Returned to lane: the orphan-rationale cleanup (§6).
