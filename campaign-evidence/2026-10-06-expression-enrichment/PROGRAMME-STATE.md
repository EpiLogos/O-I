# Programme state — Expression enrichment 2026-10

**Owner brief:** 2026-10-06 (committed at Point-Cloud-Demo lane site/essay-live-library-retired-20261006, and driving this programme).
**NOW clearing:** `central:now:control:root:664e4c586f97ea62f3fe955be0a277d5bb6527231108d74ba66a26e9971f4dab` (task `control:task:expression-enrichment-2026-10-06`).
**Lane branch (O-I):** `enrich/expressions-20261006` at `~/Central/worktrees/env-1/o-i` (seat env-1/o-i, lead actor `zcode:expression-enrichment-20261006`, zone site/tests; content lanes attach as co-workers with their own family regions).
**PCD:** registered as a workcell product in all three envs (2026-10-06, through the seat instrument's transaction machinery); env-2 checkout seeded at e875344 == the publication envelope's product pin. S-products lane joins `seat join env-2 point-cloud-demo` on its own branch.
**Render/capture:** PCD `npm ci` + `npm run build` done; `production/return-of-zero/tools/capture.mjs` works (see WAVE-PROTOCOL.md for the recipe and morph/3D capture guidance). Missing-deps/build prerequisite is a Point-Cloud #6 candidate defect.

## Floor + baseline

`site/tests/expression-richness.mjs` (this branch). Baseline before any edits: **0/135 pass** — `00-baseline-richness.json` + `01-baseline-summary.md` (committed). Run:
`OI_PCD_S_PRODUCTS_ROOT=~/Central/Work/Point-Cloud-Demo/production/s-products node site/tests/expression-richness.mjs`

## Wave plan (waves of 2–3 lanes; each lane finishes author→lint→render→bind→commit per member)

- **Wave 1 (dispatched 2026-10-06):** arguments+conjugates (LANE-ARGUMENTS.md), symbolon (LANE-SYMBOLON.md), matheme (LANE-MATHEME.md) — co-workers on env-1/o-i.
- **Wave 2:** essay+8 rooms (essay, rooms dirs), episteme (episteme dir — split internally, 8 journey files), mytheme (mytheme dir, whole-first law).
- **Wave 3:** S-products (83 members, PCD env-2 checkout, own branch+PR; split internally by product: actuation 19, factory 20, quaternal-logic 15, aikit 11, central 10, workcell 7, ql 1). Sources: product repos at the commits pinned in each binding's `material_source_ref`; essay product records under `submission-package/essay/symbolon/episteme/products/` at vault fc59a719.
- **Critic (Aletheia's office):** runs after each wave's members land on the branch — CRITIC-RUBRIC.md, reject with named reasons; revise-and-resubmit.

## Programme progress (2026-10-06, updated through wave-2 dispatch)

**Wave 1 authored and gate-clean: 10/10 journeys** (symbolon 2, arguments+conjugates 2, matheme 6) — all independently linted by the parent, not only by the lanes.

**Critic verdicts:** symbolon PASS×2 (contact sheets + independent pixel diffs committed). arguments: A PASS; A′ REJECT(1) — a26p attributed A26's recognition-sequence glyphs to A26′; revision dispatched to the lane (critic's smallest fix: re-attribute rationales to A26/other-face relation, keep sequence, note it). matheme critic dispatched.

**WAVE 1 COMPLETE through the office: 10/10 authored, 10/10 critic-PASS** (symbolon 2; arguments A + A′-after-revision; matheme 6 — matheme critic verified displaced-return geometry JSON-exact in x/y/z, Gödel proof-order-only confirmed in JSON and every frame, softmax at selection level with zero apoha/soteriological leakage across all six). Critic logs + contact sheets for all three families committed under renders/ and critic-log-wave1-*.md.

**Wave 2 dispatched:** essay+rooms (9 journeys), episteme (8), mytheme (25) — lanes briefed with the wave-1 fidelity bar.
**Episteme authored: 8/8 floor-clean** (independently linted). Its critic is running. Vault finding returned by the lane: lens-baudrillard.md and lens-foucault.md were deleted from the vault before fc59a719 (commit 722ae3da) — the lane re-read them at the dbf3b17 basis and recorded that in the bindings; the owner adjudicates the vault change. Commit-boundary race noted (dossiers' files inside the lenses-aphorism commit 6b088a7b6; content complete at HEAD).
**Essay+rooms authored: 9/9 floor-clean** (independently linted; withholdings script-audited by the lane; distinct room registers; the mechanism staged only at 07#2). Its critic is running with an independent withholdings re-audit. Lane incident recorded: a shared-index collision was repaired by splitting history back; per-lane content sits under its own messages at HEAD. New #6 candidate from the lane: text sequences on non-text formation shapes render striped/partial (glyph raster × shape blend).
**Wave 3 dispatched:** S-products lane (83 members, env-2 point-cloud-demo checkout, branch enrich/s-products-20261006, product-by-product with clean stops).

## Wave-1 results so far (2026-10-06)

- symbolon: author lane PASS 2/2 (`38a53e5fe`, `f030a8a83`); critic PASS both (independent pixel diffs, contact sheets in `renders/symbolon/`, log `critic-log-wave1-symbolon.md`).
- arguments + conjugates: author lane PASS 2/2 (`08beb04c5`, `3c474a444`); critic dispatched.
- matheme: in progress (4+ members authored when last checked).
- Confirmed Point-Cloud #6 candidates (hold until filed at convergence): capture tool needs `npm ci`+build with opaque timeout; `setScene` takes an index not an id (id throws misleading undefined-transition error); `openScene` does not exist; `setScene` does not stop the presentation auto-advance clock (unattended captures photograph the wrong scene); the app/validator/engine formation-ceiling mismatch (10/8 vs 32 vs 64); text layers render markdown markers literally.

## Convergence (parent)

1. Covers re-captured from each member's strongest scene (capture.mjs).
2. Curated envelope regenerated: `desktop/cradle/expressions-app/scripts/export-return-of-zero-publication.mjs` (+ candidate) so PUBLICATION-CURATED.json carries new SHA-256 digests.
3. Site pin: move `.github/workflows/site.yml` `OI_PCD_S_PRODUCTS_ROOT` checkout `ref` (line ~42, `EpiLogos/Point-Cloud-Demo` @ e875344…) to the merged PCD commit. The essay-vault pin (line ~49, @ dbf3b17…) **stays**: the enrichment does not re-bind sources, and every preserved binding records actual-bytes hashes at dbf3b17 — moving that pin is an owner decision about the source revision, not part of this pass.
4. Gates green: `python3 site/tests/expression-render.py` (needs `npm run build:public` in site/), `npm run test:essay`, `site/essay-expressions.test.mjs`.
5. Linter after-report (00/01 files gain -after companions); critic rejection log; review set ~10 members; PRs (O-I branch + PCD branch); evidence; NOW day close.

## Constraints in force

Engine/editor untouched (shared defects → Point-Cloud #6 candidates). No new worktrees; no commits in primaries. Ids stable; scene `name`/`character`/journey `description` preserved unless the source demands. Vault prose untouched; read records at fc59a719 via `git show`. Site rework (in-stage text, Touch mode) is in flight on another lane (env-2/o-i, claude:essay-live-20261006) — coordinate, don't collide: this programme edits collections + tests + evidence, not site/src.
