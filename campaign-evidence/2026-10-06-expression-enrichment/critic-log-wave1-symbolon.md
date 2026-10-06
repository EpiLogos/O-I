# Critic log — wave 1, symbolon (Aletheia's office)

Critic: `zcode:enrich-critic-w1` · seat env-1/o-i · region `campaign-evidence/2026-10-06-expression-enrichment` · 2026-10-06
Subjects: the two members authored by `zcode:enrich-symbolon-l1` (commits `38a53e5fe` spine, `f030a8a83` whole).

## Verdicts

- **roz-symbolon-spine — PASS** (all six rubric lines; objective gate clean)
- **roz-symbolon-whole — PASS** (all six rubric lines; objective gate clean; one capture gap in the author's evidence — the whole member had no sequence-scene morph triple — closed by the critic's own capture, see render pass)

## Objective pass

- Richness linter scoped to `desktop/cradle/expressions-app/collections/return-of-zero/symbolon`: **2/2 PASS** (spine, whole).
- `validateJourney` (engine `shell/model.mjs`) run directly on both journeys: **clean, zero errors**.
- Identity vs `main`: journey `id`, `description`, and every scene `id`/`name`/`character` unchanged on both members (13 and 13 scenes; no renames, no removals). `site/essay-expression-map.json` untouched; both ids addressed in it.

## Render pass (pixel evidence, not frame counts)

Author captures at `/tmp/expression-enrich/symbolon/` verified usable: journey mtimes (12:02/12:20) < capture times (12:21–12:51) < commit times (12:49/12:53); `git status` clean for symbolon since — captures reflect the committed state. The critic recomputed all diffs independently (sips→BMP raw compare, tol 24):

| pair | critic-measured diff |
|---|---|
| spine head-subject-logics t1→t2 / t2→t3 / t1→t3 | 2.32% / 2.65% / 2.73% (author claimed 2.3–2.7% — confirmed) |
| spine head-complexio-oppositorum t1→t3 | 3.07% (claimed 3.0% — confirmed) |
| spine question-assertion t1→t2 / t2→t3 / t1→t3 | 2.66% / 3.30% / 3.39% (claimed 2.7–3.4% — confirmed) |
| spine spine-index t1→t3 | 2.25% |
| spine spine-index yaw −0.6 vs +0.55 | 2.95% |
| whole whole-held yaw −0.5 vs +0.45 | 4.08% |
| spine AM-IS pointer-off vs pointer-on | 2.90% |
| whole whole-root t1→t3 (critic capture, see below) | 3.03% |

What the frames show (inspected visually, not just diffed):

- **subject-logics**: mid-traversal glyph runs `0 Ø X` / `(0/Ø)(1/X)` at t1, stations in motion at t2, transition state at t3 — the record's recognition sequence genuinely walks.
- **complexio**: t1 is a formless block; t3 resolves into the record's exact form `≠ = ( = =/≠ ≠ )` with `#0`/`#5` stations below — "the formless takes form; the form recognises the formless" staged literally.
- **question-assertion**: t1 a cross-shaped mass; t3 the inverted sign `?/!` legible at centre with the four Catuṣkoṭi corner words IS-NOT / IS / BOTH / NEITHER and SILENCE below.
- **spine-index 3D**: two settled yaws show different parallax arrangements of the mandala (ring + station glyphs at distinct z).
- **whole-held 3D**: yaw pair shows the ring with held presences at different depths (negative yaw edge-on/dim, positive yaw frontal).
- **AM-IS pointer pair**: pointer-off = `AM | IS` apart with bright slash; pointer-on = both glyphs brightened and drawn toward the pointer (attract). Pointer authoring verified in pixels, not JSON alone.

Critic re-capture: the author's evidence had **no morph triple for the whole member** (rubric render pass requires one per member). The critic captured `whole-root` t1/t2/t3 itself (injection pattern per protocol, scene auto-advance defeated by inflating durations in the injected doc only; no page errors). Verified visually: t1 shows `0/1` upright at centre with `1/0` small at the rim; t3 shows the centre sign inverted toward `1/0` (the obverse step rotated 180°) with the rim `1/0` leaning inward — the record's `0/1 = 1/0` staged as the sign's own rotation. Note for future waves: `setScene` does not stop the presentation clock; on shorter-duration scenes a naive morph capture drifts to the next scene (the critic's first attempt did; the author's four spine morphs are unaffected — all stay on-scene, title-verified).

Contact sheets (committed, this region):

- `renders/symbolon/roz-symbolon-spine-contact-sheet.png` — 21 frames: 4 morph triples (t1 shown for q-a; t1/t3 for the rest), both spine-index yaws, the AM-IS pointer pair, and the 10 remaining spine scenes.
- `renders/symbolon/roz-symbolon-whole-contact-sheet.png` — 15 frames: whole-root critic morph triple, both whole-held yaws, all six scenes settled, plus the superseded drift captures retained as the workflow note.

## Rubric findings

### roz-symbolon-spine — PASS

1. **Fidelity — pass.** Spot-read at fc59a719: `subject-logics.md` and `question-assertion.md` in full. Every staged assertion traces to the record: the Taylor sequence `0 → Ø → X → Ø/X → (0/Ø)/(1/X) → 1` returning as `0/1` is the record's own line; "computation confused for the computer" is the record's phrase for the Ø occlusion; X = "field of crossings"; pramātṛ/pramāṇa/prameya as numerator/slash/denominator is record §3; the Catuṣkoṭi proposition "0 is and/or is not equal to 1" and the four corners' determinate work are quoted within their record sense; SILENCE is the recognition, not a fifth mark — and its sequence withdraws the mark (`SILENCE → unmarked → SILENCE`), the right staging. Claim-status bands verified against **all 13** records' frontmatter: mono-poly `Argued`, all others `Derived` — the binding's band claim is exact. No binding dropped: all 13 record paths/hashes byte-identical to the PCD prior, all 13 per-scene `relations` preserved verbatim, only additive keys (`enrichment`, `glyph_rationales`, extended notes). Withholdings: `Ø`/`∅` appears in **exactly one** scene, `head-subject-logics`, with its one job (occlusion — representation crossing a zero-space it cannot fill); no other scene uses it. **No Antikythera imagery** anywhere (string-scan plus visual inspection of all frames). `0/1` earned (rationale cites §1 · #5→0; the earning scene is 0-1).
2. **Move carries the argument — pass.** (a) `head-subject-logics`: one formation walks the full crossed-zero sequence through the standing stations (dimmed to tint 0.3 — the track as record) at 0.9s crossings; vortex + shove pointer = occlusion breaks; duration 15, the longest walk — recognition takes time. The pixel triple confirms the traversal. (b) `question-assertion`: the sign leans question-side, inverts 180° (assertion carrying the question), holds whole; corners repel in grid (held apart); SILENCE withdraws. (c) `spine-index`: the centre mark's sequence walks the whole spine `−/− → 0/1 → ?/! → −/+ → X/x → AM/IS → ∞/dx → 1/0`, each step moving to its station position in 3D — the four-head traversal run as a real circuit, exactly the lane brief's assignment. Decoration nowhere: every checked move is the record's own gesture.
3. **Restraint — pass.** Quiet scenes are stated: `the-slash` (pointer 0.06 stillness, circulation 0 — "nothing turns yet, relation before named terms"), and the `whole-remnant` ring kept small and faint in every depth scene as the whole retained.
4. **Legibility — pass.** Text blocks top-left, kicker + title + italic line + ≤70-word body with returns-to and source-of-record lines; formations centre/right; no text-on-mass overlaps in any inspected frame; ≥2 text sizes across the journey. Glyphs readable at cover size in settled frames (question-assertion t3, complexio t3, spine-index yaw+0.55, AM-IS pair). Two disclosed artifacts, neither a defect of the journey: 2.5s-settle captures show formations mid-assembly (dim) while long-settle frames are the judging frames; mono-poly's eight `x` instances render X-like at weight 900 — disclosed honestly in the binding notes and acceptable as instances-of-capacity.
5. **Continuity — pass.** The whole-remnant ring recurs in every scene and transforms: bare remnant → envelope carrying the #0/#5 rim marks → full 3D mandala at spine-index. The slash-sequence motif (`/ → <head> → /`) binds the spine scenes; `1-0` mirrors `0-1` (circulation −0.8, mirrored geometry). The journey reads as one arc — relation, first orientation, question/assertion, polarity, capacity/instance, personed copula, horizon/differential, return, four heads rereading, mandala — not N copies of one scene.
6. **Craft-note honesty — pass.** `glyph_rationales` cover **every** distinct entity/sequence-step text exactly (33/33, no missing, no orphan keys — checked programmatically), each a sign-of statement in the notation's own terms (`0` non-objectifiable condition; `/` the differentiating activity; `Ø` the crossed zero with its one job; `≠` equality crossed by the slash; `#0`/`#5` stations; SILENCE the recognition). The 3D meaning is stated (z = the determination's nesting: threshold nearest z +0.5, sixfold cardinals at z 0, `−/−`/`∞/dx`/`1/0` deepening to z −0.6, envelope around all depths — verified against actual entity z values in the JSON) and is what the scene stages. Automations are tied to meaning and present in the artifact: minus-plus `field.dispersion` LFO (the dynamis breath), AM-IS `field.pointerStrength` sine 0.25–0.95 (the address breathes), distinct durations 12–16 and transitions 1.2–2.4.

### roz-symbolon-whole — PASS

1. **Fidelity — pass.** Spot-read `symbolon/README.md` at fc59a719 in full. The staged claims are the README's own: self-nesting 3+1 "holding Matheme, Mytheme, and Episteme without becoming a fourth bucket" (whole-held stages exactly this — three presences, slash active between, no fourth sibling); the register pairing parā/paśyantī/madhyamā/vaikharī is the README body's own assertion (scene kickers carry it; the pairing's figure is marked Argued in the README, the body states it directly — noted as an observation, not a failure: the held scenes reference presence-and-office only and restage no register records); the matheme's locked equation is held verbatim and decomposed only into its own terms (`4+2`, `5→0`); mytheme "images perform operations" is staged by the swept cymatic drive (an image re-forming, not decorating); episteme as instituted, checkable bounds (collision obstacle mode "records hold their edges"). Binding complete: README record path/hash preserved, `referenced_not_bound` lists the three register READMEs with hashes, only additive keys. Withholdings: no Ø, no Antikythera, presence tints declared presentation-policy-only with no colour correspondence claimed. Claim-status band on whole-root reads `DERIVED` — README frontmatter is `Derived` (verified).
2. **Move carries the argument — pass.** `whole-root`: sequence `0/1 → 1/0 → 0/1` with the obverse step rotated 180° — the one sign read from its other end, which is the record's equality; the critic's own t1/t3 frames show the inversion really happens. `held-matheme`: the sequence decomposes the locked equation into `4+2` and `5→0` and returns — the matheme traversing its own identity. `whole-held`: the slash walks through the three register positions in 3D and back — z is the one Vāk descent (matheme deepest z −0.55, episteme nearest z +0.55 — verified in JSON), parā the envelope around all depths; the containment is the argument.
3. **Restraint — pass.** Held scenes are quiet by stated policy: "register presence and office only; records referenced (E4/E6/E3), not restaged" — stated in binding relations and in the scene text itself.
4. **Legibility — pass.** whole-root is the strongest frame of the wave: `0/1` large at centre, `1/0` small at the rim, text block clear of the mass; framing scenes at text size 26, held scenes at 30 (the size hierarchy marks the whole/register distinction). Rim marks placed inside the visible extent (revision disclosed in notes).
5. **Continuity — pass.** The envelope ring persists through all six scenes; whole-return mirrors whole-root (circulation −0.5, sequence `1/0 → 0/1 → 1/0`); the arc is whole → registers held → return, and it hands on to the spine member explicitly.
6. **Craft-note honesty — pass.** Rationales 6/6 exact (including the locked equation rationale quoting the README's own identity). 3D meaning stated (z = depth of the one descent of speech; parā holds without becoming a fourth sibling) and verified as what is staged. Automation tied to meaning: `return-pulse` on `field.speed` (the return breathes); mytheme cymatic `autoSweep` (the image re-forms under a swept drive).

## Point-Cloud #6 candidates met

1. **Native engine formation ceiling (new, from the author's notes, confirmed plausible):** the author reports spine-index originally staged 13 formations and the **native engine refused to boot** — the native field supports 10 formations/scene while the authoring validator allows 32. The committed scene carries 9 formations with the four heads declared in text/binding. Validator/engine limit mismatch — record for Point-Cloud-Demo #6.
2. **Capture tool defect (known):** Point-Cloud-Demo required `npm ci` + `npm run build` with no error pointing at it (protocol's standing candidate).
3. **Presentation clock vs `setScene` (new, critic's own finding):** `setScene()` switches the scene but does not stop the presentation auto-advance clock, so unattended captures can silently photograph the wrong scene on shorter-duration journeys. Captures must defeat auto-advance (inflate durations in the injected doc) — worth a note in the capture tool.
4. **Text layers render markdown literally (worked around):** `**`/`*` markers in text bodies render as characters; the author stripped them from all text bodies. Engine/editor observation for the same #6 ledger.

## Evidence inventory

- Contact sheets (committed): `renders/symbolon/roz-symbolon-spine-contact-sheet.png`, `renders/symbolon/roz-symbolon-whole-contact-sheet.png`
- Author captures (reused, `/tmp/expression-enrich/symbolon/`): 37 files — 13 spine scene frames, 4 morph triples (subject-logics, complexio, question-assertion, spine-index), spine-index yaw pair, AM-IS pointer pair, 6 whole scene frames, whole-held yaw pair
- Critic captures (new, same dir): `roz-symbolon-whole.whole-root.critic-morph.t{1,2,3}.png` (valid), `roz-symbolon-whole.whole-root.morph.t{1,2,3}.png` (superseded drift captures, retained as the workflow note)
- Records read at fc59a719: `submission-package/essay/symbolon/subject-logics.md`, `question-assertion.md`, `README.md` (full); claim_status frontmatter of all 13 spine records
- Bindings compared: PCD `production/return-of-zero/bindings/roz-symbolon-{spine,whole}.binding.json` vs committed `bindings/` — nothing dropped, nothing re-hashed
