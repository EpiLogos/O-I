# Expression audit — the live corpus, 7 October 2026

**Scope:** every Expression the live site serves (135 members, 1,194 scenes, fetched from
`oi.epi-logos.org/essay/expressions/`, digests recorded in `live-expressions-index.json`,
bodies in `live-bodies.json`). Method: full-corpus programmatic audit (`audit-per-journey.json`)
plus render-and-look at five members in Chromium (`renders/`), plus structural comparison
against the prior generations (pre-#603 collection in git, Point-Cloud-Demo
`production/return-of-zero/`).

## What the live corpus actually is

**1. The glyphs are words, not signs.** Of 4,809 placed entities, 3,234 (67%) are
`shape:"text"` and 2,802 distinct word-glyphs vs 221 single-symbol marks. The engine's
symbolic carriers are unused: `ascii` 0, `glyph` 0, `image` 0, `yantra` 11 in the whole
corpus. 63% of all sequence steps change *only the text* (word → different word); almost
all the rest change text **and** size/tint — words that swell and recolour. "Words
morphing" is the literal description of the corpus.

**2. The enrichment did not replace the glyphs — it buried them.** Pre-#603 vs live:
`roz-matheme-computation` and `roz-mytheme-eros-psyche` preserved 100% of their entity
glyphs; what changed is the wrapper (engine churn, text blocks, pointer modes, 3D scenes).
Where enrichment *did* touch composition it degraded it: `roz-essay-reading` went from
9 discs + 7 rings + a yantra with 5 notation glyphs (Point-Cloud-Demo prior) to 23 word
labels (`S0…S5`, `What knows?`, `X`). The symbolic generation still exists in
`Work/Point-Cloud-Demo/production/return-of-zero/` — it was overwritten in the O:I
collection, not in PCD. ("The old prior set still there" — two generations coexist on
two surfaces.)

**3. Colour never moves.** 108/135 journeys carry one background across every scene;
109/135 one palette. The linter counts a colour *change* as churn credit but requires no
colour *journey* — so nobody wrote one.

**4. The stage is drowning in mandated metadata.** 1,861 placed text blocks carrying
84,835 words. 68% carry a citation/routing kicker (`#0 · Apuleius, Met. 4.28–4.35
(q001; Purser 1913 witness)`, raw file paths like `submission-package/essay/symbolon/the-slash.md`).
53% are pinned to the left edge; 34% structurally overlap a glyph's bounding box — the
linter's own non-overlap rule fails in one block of three, and the render pass let it
stand (see `renders/expr2-roz-mytheme-eros-psyche.png`: the title block is nearly
illegible against the dark field, sitting on the formation's corner).

**5. Nothing is ever still.** 1,059 of 1,059 adjacent scene pairs differ — the floor makes
stillness non-compliant, so the whole corpus churns constantly.

**6. Chrome eats the experience.** The renderer's canvas is 851×824 inside a 1440×900
viewport (59%); the right rail is a scene list plus related-node chips (the spine member:
13 scene rows + 12 "In the essay" chips + "+2 more"). The ⛶ control is a zoom-fit — there
is no fullscreen and no focus mode anywhere in `site/src/expression/ExpressionApp.tsx`
(no `requestFullscreen`). In the essay reader the Expression tab already shows its scenes
in the field's left contents rail — the standalone page duplicates that as its own rail
instead of reusing the field.

## Why the machinery keeps producing this

The 2026-10 enrichment apparatus (wave protocol → author lanes → richness linter →
critic office) measures **presence and churn**, never **symbolism and restraint**:

| Floor | What it asks | What agents gave it |
|---|---|---|
| #1 sequences change glyph AND object state | motion on ≥1/3 of scenes | words swapping words while swelling — passes |
| #2 every adjacent pair ≥3 settings across ≥2 families | permanent change | 100% churn; stillness illegal |
| #3 one 3D scene | a box to tick | 3D applied mechanically |
| #4 ≥3 pointer profiles | forced variety | ticked |
| #5 a placed text block on **every** scene | kicker + title + italic mandated | agents filled the mandatory slot with citations, paths and routing — the clutter is *compliant* |
| #6 glyph rationales | a note, not a property of the glyph | written to satisfy; words kept their jobs |
| #7 automation, #8 not-free layout | variety boxes | ticked |

The critic rubric could not hold the line because its objective pass **is** the linter and
its visual pass judges against the same floor; fidelity checks claim-conservation, not
craft. When the floor mandates the failure modes, the office passes the failure — 52/52.

Ta-Onta (alignment doc §3–§7) governs *who* produces and *what must be preserved*
(packets, identity, coverage). It is silent on visual craft; the only craft law in the
chain is the linter floor. The whole chain optimised to exactly what the floor measures.
The authoring-app ceiling (≤10 formations/≤8 pins, PCD #6) additionally caps how much
real symbolic composition a scene can even hold.

## What "good" asks for instead (proposed floor for the next pass)

1. **Text by exception.** A scene carries a text block only when the scene needs it;
   journey-level visible-text budget (≤120 words); metadata — citations, paths, routing,
   relation chips — **banned from the stage** (they live in the binding record and the
   field's connections panel).
2. **Stillness lawful, churn justified.** ≥1/3 of scenes deliberately still; adjacent-scene
   change where it *means* something, not per-pair quotas.
3. **A colour journey.** ≥3 distinct backgrounds and a moving particle palette per member;
   backgrounds and tints are part of the composition, not constants.
4. **Glyph law.** Non-verbal carriers required (`ascii`, `glyph`, `yantra`, `image`,
   geometry composed as signs); text allowed for notation marks (≤3 chars) and names that
   are themselves signs; sequences transform meaning (substitution chains), never swap labels.
5. **Composition law, render-verified.** Text clears the formation's region with margin,
   verified by screenshot box-math against the render — not self-reported JSON.
6. **The critic's visual pass is the primary gate** (named acceptance screenshots per
   member); the linter demoted to plumbing (schema, ids, digests).
7. **Restore the symbolic basis.** The PCD prior generation (discs/rings/yantras, notation
   marks) is the starting vocabulary to re-craft from, not the word-label generation.

## Reader experience (code, ready to do)

- `expression.html`: canvas-first layout; **real fullscreen** (`requestFullscreen` on the
  stage) and a **focus mode** (hide all chrome, key `F`); the scene list moves into the
  essay field's left sidebar language (same tree, same behaviour as an in-reader
  Expression tab — which already works); related nodes live in the connections panel,
  not a chip wall.
- The in-reader tab keeps its current behaviour (scenes already appear in the contents
  rail) and gains the same fullscreen/focus on its frame.
