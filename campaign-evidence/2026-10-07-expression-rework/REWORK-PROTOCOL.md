# Expression rework protocol — the craft pass, 7 October 2026

Owner's commission, verbatim in substance: the four previous passes produced
word-labels swelling into other word-labels, one background per journey, stages
drowned in citation metadata, and zero stillness. That machinery is gone. This
is the real pass. Audit of the live corpus that motivated it:
`campaign-evidence/2026-10-07-expression-audit/FINDINGS.md`.

## The law

**TEXT IS THE MINIMUM FORM.** Any image or glyph can be used — there is no
limitation. ASCII art, images (formation source `image`, embedded as data URLs,
read as luminance / edgeSobel / silhouette), geometry (disc, ring, square,
triangle, cymatic), notation marks, drawn compositions of any of these. You are
required to be genuinely creative. A scene whose formations are word-labels is
the failure this pass exists to remove. **No yantra.**

- **Draw the scene.** Every scene carries at least one non-text formation; at
  least half of a journey's formations are non-text. Formation text may be
  notation (≤3 characters) or a single sign-name — never a sentence.
- **The journey moves through colour.** ≥3 distinct backgrounds; particle
  palettes or tints travel with the story. Contrast is craft: text must be
  legible against its ground.
- **Stillness is part of the composition.** At least a third of adjacent scene
  pairs change nothing. Motion where it carries the record's move; rest does
  not need a reason.
- **The engine sizes each glyph.** `autoFitSizes` stays on (it is the default —
  never set it false). Compose within normalised glyph scale; do not hand-set
  arbitrary sizes.
- **Stage text is hospitable, not informative.** ≤120 words of visible stage
  text per journey. No metadata on the stage: no citations, no file paths, no
  station kickers (`#0 · …`), no routing words (previous / next / related).
  That information lives in the binding record and the field's connections
  panel. Text blocks sit clear of the formations at 1440×900 and 390×844.
- **Every glyph is answerable.** Each distinct glyph (formation text, or a
  non-text formation's name) has a one-line rationale in the binding's
  `glyph_rationales` — what it is a sign *of*, in the source's own terms.
- **Identity holds.** Journey `id`, `description`, scene `id`/`name`/
  `character` do not change — the field map addresses members by them. Scene
  count may change (keep 3–64). The packet is the burden: the record's claim,
  status and relations still ride (bindings keep their source_ref/relations).
- **The authoring ceiling is real.** ≤10 formations and ≤8 pins per scene.

## Where things are

| Thing | Path |
|---|---|
| The checkout (shared; you own your family dir) | `/Users/admin/Central/worktrees/env-1/o-i`, branch `enrich/expressions-craft-20261007` |
| The collection | `desktop/cradle/expressions-app/collections/return-of-zero/<family>/` |
| The gate (run it; do not argue with it) | `node site/tests/expression-richness.mjs --collection desktop/cradle/expressions-app/collections/return-of-zero/<family>` |
| Prior symbolic generation (steal from it) | `/Users/admin/Central/Work/Point-Cloud-Demo/production/return-of-zero/<family>/` — discs, rings, yantra-free notation, real composition |
| Semantic burden (read-only) | binding records beside each journey; vault record text at revision `fc59a719` via `git -C /Users/admin/Central/Work/O-I/Antykathera-Essay-Work show fc59a719:<path>` |
| Render spot-check (optional, one member) | `PHYSIS_PORT=881<lane> PHYSIS_TEST_MODE=1 PHYSIS_DATA_DIR=<mktemp -d> node server/index.mjs` in `/Users/admin/Work/Point-Cloud-Demo`, then per WAVE-PROTOCOL.md's injection recipe (`window.__JOURNEY__`, `__START_PRESENTATION__`, `__FIELD_STUDIES__.inspect()`; `setScene` takes an INDEX). Boot is 18–70s; use `domcontentloaded`. |

## Mechanics

- Work **only** inside your own family directory (journeys + bindings). The
  gate file, the manifests and other families are not yours.
- Member by member: re-craft the journey, update the binding, run the gate on
  your family until the member passes, then
  `git commit -m "[craft:<family>] <member-id>"` (journey + binding together).
- No `npm install`, no builds, no pushes. The parent builds and lands.
- These are works of authorship, not compliance: the gate is the floor of the
  floor. The question for every scene is *what does this show* — a mark, a
  movement, a colour, a held silence — that carries the record. Word-labels
  arranged in a layout is what the last four passes produced; it is what
  "fails" means here.
