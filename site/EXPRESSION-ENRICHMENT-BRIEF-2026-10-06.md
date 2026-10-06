# Expression enrichment — brief for a multi-agent session

*2026-10-06. Written for a fresh session that will run several subagents. Paste the whole file as the opening prompt, or point the session at it.*

## 0. What you are doing, in one paragraph

The 135 published Expressions (the Return-of-Zero corpus and the S0–S5 product field) are technically valid and visually thin. They use a fraction of what the Expression format and engine can say. Your job is a **complete enrichment pass**: re-author every member so that its glyphs are symbolically apt, its scenes *transform* the glyphs (formation sequences, morphing) and the physics (not one colour swatch), its text blocks sit inside the stage with intent, at least one scene per journey uses real 3D, and every scene authors its own pointer interaction. Quality is gated by an objective linter you build first, then judged by a critic pass, then reviewed by the owner on a sample.

Do this with the Ta-Onta architecture the owner already ratified, not around it (section 4). The owner's own words: *if Ta-Onta were used properly as it should be, this poor quality wouldn't be possible.*

## 1. What is wrong — measured, not impressions

Measured on the 135 published journeys (1,194 scenes, 4,713 entities), 2026-10-06:

| Capacity | Used |
|---|---|
| Every scene's engine settings (`pointerMode`, `pointerClick`, `medium`, `collision`, `pairwise`, `relational`, `morph`, `trajectory`, `dotShape`, `colorMode`) | **identical in every scene** (`repel`/`pulse`, all physics families off, `toroidalHopf`, `circle`, `linearGradient`) |
| Distinct values of `field.params` across all 1,194 scenes | `speed` 9, `dispersion` 11, `turbulence` 6; every other parameter (size, count, roundness, softness, circulation, curlDepth, gravity\*, quadraticDrag, thermalJitter, zConfinement, swirlRadius, halo, grain, …) has **one** value; most scenes carry the defaults |
| Journeys whose parameters or engine settings change between scenes | **9 of 135** |
| Entity formation sequences (`sequence.enabled`) | 107 of 4,713 entities (2.3%); 87 with more than one distinct glyph; the rest hold one glyph |
| Entities with a non-zero `z`; scenes with `view.mode: "3d"`; volume/depth settings | **0 entities**, **2 scenes**, **0** (volume and depth are absent) |
| Scenes with `automation` / recorded `propertyTracks` | 3 scenes / 0 |
| Entity `force` | kinds: 4,084 `attract`, 622 none, 6 repel, 1 vortex — but only **21 entities** in the whole corpus have a force strength above 0 |
| Layout | `free` in 1,194 of 1,194 scenes |
| Glyph choice | 2,739 text entities are words/phrases; the one-character glyphs are placeholder-like (`◉` ×18, `1`, `/`, `x`, `0`, `?`, `∅`) with no stated rationale |
| Pointer interaction authored | none (the player ignored it; it is now a "Touch" mode, section 6) |

Two corrections to keep honest: (a) the corpus *does* carry per-scene text blocks (`scene.text[]`: kicker, title, italic, body, `x`, `y`, `width`, `size`, `align`) in 1,194 scenes, but the site rendered them in a side column. As of this brief the Expression page draws them **inside the stage** at their authored position, in the scene's ink, as the authoring shell does. They are now visible and therefore judgeable; many will need re-layout. (b) The journeys *can* carry sequences, so the gap is mostly authorship, not engine capacity.

## 2. What the format and engine afford (use these, by name)

Ground truth is the code, not this list: `packages/oi-design-system/expressions-engine/shell/model.mjs` (`validateJourney`, `DEFAULT_PARAMS`, `DEFAULT_ENGINE_SETTINGS`, sequence/step/text/automation validation), `shell/nativeParameters.mjs` (the bindings), `shell/nativeBridge.mjs`, `shell/camera.mjs`, `engine/*`. The authoring shell is `desktop/cradle/expressions-app/field-studies-journeys` (and Point-Cloud-Demo, the isolated authoring copy of the same engine). A journey is `oi.journey` v1: `scenes[{id,name,character,duration,transition,view,engine,field,entities,text,composition,morph,automation,propertyTracks}]`.

- **Entities**: `kind` formation|pin; `shape` text|ring|disc|square|triangle|yantra|cymatic; `text` (≤120 chars; a glyph, a word, a phrase); `position{x,y,z}`; `size`, `rotation`, `share`; `tint`/`tintWeight`; `force{kind: attract|repel|vortex|…, strength, radius, spin}`; `station`; layers; up to 32 entities per scene.
- **Formation sequences** (`entity.sequence`: `enabled`, `clock`, `order` loop|…, `easing`, `steps[{id,text,shape,hold,transition,position,objectState{size,rotation,tint,tintWeight,force}}]`): the glyphs themselves morph — letter→letter, word→word, glyph→ring→disc, with each step moving, resizing, re-tinting and re-forcing the formation.
- **Scene-level physics and material** (`field.params`, 40-odd keys): `count, size, sizeBias, opacity, roundness, softness, irregularity, elongation, orientation, contrast, densityScale/Phase, edgeWeight, halo, speed, circulation, turbulence, turbulenceScale, recovery, dispersion, pointerStrength/Radius/Falloff, depth, grain, snapRigidity, densityTether, curlDepth, vortexRadius, gravityX/Y/Z, quadraticDrag, thermalJitter, speedLimit, zConfinement, timeScale, gravitySoftening/Falloff, swirlRadius, frequency, dominance, excitation, jitter`, plus `field.background`, `field.palette`, `field.material`.
- **Engine families** (`scene.engine`): `pointerMode`, `pointerClick` (pulse|implode|vortex|shove), `pointerClickStrength/Radius`; `mediumEnabled/mediumDimension/mediumPlane`; `collisionEnabled/collisionMode`; `pairwiseEnabled`; `relationalEnabled/relationalMode` (orbital…); `morphEnabled`, `trajectory`, `driveShape`, `autoOscillate` (toroidal morph: oscillation speed, poloidal rate, phases, hold ratio); `resonanceEnabled`, `resonatorMode`, cymatics (`frequencyHz`, `dominance`, `driveStrength`, plate geometry, sweep); `volumeEnabled`, `volumeProfile`; `depthPerspective`, `depthOcclusion`, `depthTintColor`; `vortex3d`, `dispersion3d`; `colorMode`, `inkMode`, `dotShape`, `fontFamily`, `fontWeight`.
- **Camera / 3D**: `scene.view{mode: "2d"|"3d", yaw, pitch, zoom, panX, panY}`; z-distributed entities; glyph volume; perspective + occlusion.
- **Composition**: `layout` (not only `free`), `focus` (parallel/serial), `focusDuration`, `carryTint`, `carryStation`, `frequencyDriver`; `morph{thetaRate, phiRate, law, depth, dwell}`.
- **Time**: scene `duration`, `transition`, per-property `automation` (LFO/ramp, `blend`), recorded `propertyTracks`.
- **Text blocks**: up to 16 per scene, positioned (`x`,`y` as fractions of the stage), `width`, `size`, `align`; the player and shell lay them out as an overlay with kicker, title, italic line and body.
- **Pointer**: per-scene `pointerMode` and click effect; the engine's `setHostPointer` and `pointer-effect` command (pulse/implode/vortex/shove with strength 0–20 and radius). Pointer interaction is part of the format; author it.

Do not edit the engine or the editor to suit a lane (`EXPRESSION-PRODUCTION-SANDBOX.md` §6). A shared defect goes back to Point-Cloud-Demo #6 as a receipt.

## 3. The quality floor (what "enriched" means, checkable)

Build the linter first (`site/tests/expression-richness.mjs`, node, no browser; a stats pass over `x/*.journey.json` or the collection manifests is the model — the numbers in section 1 came from exactly such a pass). It reports, per journey and in total, and **fails** below the floor. Initial floor, to be raised after the first full run if everything clears it trivially:

1. **Sequences/morphing**: every journey has formation sequences on at least a third of its scenes, and at least one sequence whose steps change glyph *and* object state (position or size or tint), not only text. Single-glyph holds don't count.
2. **Scene change is multi-family**: between every pair of adjacent scenes at least **three** settings change across at least **two** different families (physics, particle material, relational/medium/collision, resonance, camera/3D, colour, pointer). A palette-only change does not count.
3. **3D**: at least one scene per journey (all of them for S-products where the content is spatial) with `view.mode: "3d"`, entities distributed in z, and volume or depth settings authored; never 3D as decoration — state in the craft note what the third dimension *means* there.
4. **Pointer interaction authored per scene**: `pointerMode`, `pointerClick`, strength and radius chosen for the scene's meaning (guard/boundary → repel; gathering/return → attract/implode; turning/spiral → vortex; rupture → shove; stillness → very low strength), and at least three distinct pointer profiles per journey.
5. **Text blocks inside the stage**: every scene has a deliberately placed text block (kicker, title and one italic line; a body only where the scene needs it), a position that does not sit on the formation's mass, a size hierarchy, ≤ ~70 words in body, no text overlapping its neighbours at 1440×900 and at 390×844 (the page moves long bodies below the field on narrow stages; the title/italic must still fit).
6. **Apt glyphs**: no placeholder glyphs. Each formation's glyph/word/phrase has a one-line rationale in the craft note (what it is a sign *of*, in the source's own terms); symbols that recur across scenes of one journey carry the continuity (the same sign transforming) and the transformations mean something.
7. **Automation/time**: at least one slow LFO or property take per journey tied to meaning (breathing, drift, pulse), authored transitions (`transition`, `duration`) that differ by the narrative beat, and a sequence-level arc across the journey (not N copies of one scene).
8. **Layout**: not `free` in every scene; use the composition/focus structures where the content is serial or parallel.

Also required, not machine-checkable, judged by the critic pass: fidelity to the source packet (no claim the source does not make), restraint (quiet scenes are allowed — *deliberately* quiet counts as authored), legibility, and that morphs and parameter moves *carry the argument* rather than decorate it.

## 4. Method — Ta-Onta used properly

Read first, in this order: `Antykathera-Essay-Work/docs/EXPRESSION-CORPUS-PRODUCTION-ALIGNMENT.md`; `desktop/cradle/expressions-app/field-studies-journeys/docs/EXPRESSION-PRODUCTION-SANDBOX.md`; the root wiki return `Control/agents/wiki/returns/ta-onta-and-the-thought-stream-2026-09-16.md`; QL-MEF `docs/integrations/epi-logos/TA-ONTA-FULL-FIELD-LOCK.md`; `return-of-zero-orienting-principles.md` and `PROSE-STANDARD.md` in the essay vault. Use the registered praxis and skills through the AIKit/Central surfaces (`aikit praxis`, `ctrl control.search`, the `central-*` methodologies, the `wayfinder` method for the programme map). Do **not** invent a content-production persona roster; the six content workers below are development workers, as the alignment doc says, and the runtime Ta-Onta reading is applied *through* them:

- **Source packet first** (parent session, "E0"): for every member, one bounded packet from the current vault census at a named revision — the claims it carries, the section/movement/argument relations, incoming/outgoing links, the media it may use, the existing Expression and its scenes. The packet is the semantic burden to preserve, not an art direction.
- **Read each family through the constitutional agent it belongs to** (Anima's field: Nous, Logos, Eros, Mythos, Psyche, Sophia): arguments and conjugates → Logos; concepts and episteme → Nous; relation/field/synthesis forms → Eros; whole Mythemes → Mythos (whole-first law: the ending must be able to qualify the beginning, so these need real multi-scene sequences with the same signs transforming); lived-matter and symbolon material → Psyche; integration of room/essay → Sophia. Express that reading as the per-scene *move* (what changes, and why that gesture) — not as persona dialogue.
- **Aletheia as witness/critic, not an eighth peer**: a separate critic pass per member against section 3's rubric and the packet; it may reject, with a named reason; revise-and-resubmit until it passes. Observations about craft (what density/colour/motion/camera/sequence worked) return through the existing Aletheia/Epii learning path (T/T′ fixtures, `central.now.learnings.*`), not as new rules.
- **Content-arising forms** (alignment doc §4): find/make/adapt each glyph, image, ASCII or diagram *from the content need*, verify rights where external, use it in the Expression, keep or reject, index the occurrence.

## 5. Lanes (subagents) and ownership

Parent (E0, you): census, packets, the linter, artifact inventory, continuity, final coverage, integration, publication handoff. Then exactly these workers, on disjoint artifact paths (shared checkout is fine for disjoint files; follow the seat rules in section 8):

1. Essay + the eight section-rooms (`collections/return-of-zero/essay`, `rooms`).
2. A + A′ (`arguments`, `conjugates`).
3. Concepts and remaining Episteme (`episteme`), split internally by packet.
4. Matheme (`matheme`) — formal/diagrammatic forms; the vault now carries 8 authored matheme diagrams (`submission-package/essay/matheme/diagrams/*.svg`) that can inform sequences.
5. Symbolon (`symbolon`).
6. Whole Mythemes (`mytheme`) — whole-first; then derivative occurrences.
7. The S0–S5 product field (83 members) lives in **Point-Cloud-Demo `production/s-products`** (a separate repo; the site pins it via `OI_PCD_S_PRODUCTS_ROOT`, `.github/workflows/site.yml`). Work there on its own branch and PR.
8. A **critic/verifier** worker (Aletheia's office): runs the linter, renders the screenshot contact sheets (section 7), applies the rubric, returns rejections.

Rate-limit yourself: waves of two or three lanes at a time, each lane finishing a family end-to-end (author → lint → render → critic) before the next starts.

## 6. How to author and verify

- **Authoring**: use the existing editor/engine (Point-Cloud-Demo's editor, or the O-I cradle expressions-app) for parameter discovery and visual feedback; direct JSON edits are fine when checked with `validateJourney`. Keep ids stable — the essay's page→Expression map (`site/essay-expression-map.json`) addresses members by id; do not rename members or scenes. Preserve each member's `description`/scene `name`/`character` unless the source packet demands a change.
- **Render truth**: the site's Expression page (`site/expression.html`, source `site/src/expression/`) is the public renderer and uses the same `ProductionAdapter` as the cradle. It now: draws scene text blocks in the stage; has a **Touch** mode (the scene's own pointer settings apply: move for the pointer field, press for the click effect, Space/Enter pulses from the last position) and an **Orbit** mode for the camera. Verify each scene there, headless, across time: take screenshots at t=0, mid-transition and end of a scene's sequence to *see* the morph; in 3D, at two yaw angles; in Touch mode after a pointer move and a click. `site/tests/expression-render.py` shows the harness (software WebGL: `--enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader`). A frame count alone proves nothing about morphing — compare pixels across time.
- **Do not measure frame timing in the in-app Browser pane** (it reports `document.hidden`); use headless Playwright.

## 7. Output, evidence, publication

- Edited journeys land in `desktop/cradle/expressions-app/collections/return-of-zero/**` (O-I repo; branch + PR; main is protected) and in Point-Cloud-Demo `production/s-products` (own PR). Also update each member's cover (`*.cover.png`) from a real capture of its strongest scene.
- Regenerate the curated envelope with the existing exporter (`desktop/cradle/expressions-app/scripts/export-return-of-zero-*.mjs`) so `PUBLICATION-CURATED.json` carries the new SHA-256 digests; the site verifies each journey's bytes against that digest before rendering and refuses mismatches. Move the Point-Cloud-Demo pin in `.github/workflows/site.yml` (`OI_PCD_S_PRODUCTS_ROOT` checkout `ref`) to the merged product commit.
- Evidence the parent returns: linter report before/after (the section 1 table recomputed); a contact sheet per journey (scenes × times, plus one 3D view and one Touch/pointer frame); the critic's rejection log; a list of defects returned to Point-Cloud #6; a **review set** of ~10 members (two per lane, the best and the most contested) for the owner to open at `oi.epi-logos.org/essay/` → Library view and the Expression tabs.
- Keep the repository's own gates green: `python3 site/tests/expression-render.py` (61+ checks), the essay tests (`npm run test:essay`), `site/essay-expressions.test.mjs`.

## 8. Standing constraints

- Work through the seat instrument (`seat join env-N o-i --actor <you> --branch <name>`), commit often (a seat sweep can move uncommitted work to a `recover/*` branch), push, open PRs, `seat release` when landed. No new git worktrees; no commits in the primary checkout. Never edit the wiki directly; knowledge returns through the return door. Do not alter canonical essay prose to make an Expression easier to compose.
- Deterministic and honest reporting: if a family cannot meet the floor, say which criterion and why, and leave the member as it was rather than faking compliance.
- Stop and ask the owner only for a *meaning* question the source packet cannot answer (a claim's standing, an ambiguous symbol). Everything else is yours to decide.
