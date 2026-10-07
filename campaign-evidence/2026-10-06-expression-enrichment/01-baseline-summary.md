# Expression enrichment — baseline richness report

**Date:** 2026-10-06 · **Tool:** `site/tests/expression-richness.mjs` (lane `enrich/expressions-20261006`) · **Corpus:** 135 published journeys — 52 Return-of-Zero (O-I `desktop/cradle/expressions-app/collections/return-of-zero`) + 83 S-products (Point-Cloud-Demo `production/s-products`).

**Floor result: 0/135 journeys pass.** Every check of the enrichment floor (brief §3) fails corpus-wide; per-journey detail is in `00-baseline-richness.json`.

| Measure | Value |
|---|---|
| Scenes / entities | 1194 / 4713 |
| Formation-sequence entities (total / multi-glyph) | 107 / 83 |
| Scenes with view.mode 3d | 2 |
| Entities with non-zero z | 0 |
| Scenes with automation / propertyTracks | 3 |
| Entities with force strength > 0 | 21 |
| Journeys changing any setting between scenes | 23/135 (family-classified, incl. palette; the brief's stricter count was 9) |
| Layout values | {"free": 1194} |

**Frozen physics/material params — one distinct value corpus-wide (33 of 40+):** curlDepth, densityPhase, densityScale, densityTether, depth, dominance, easing_note, edgeWeight, elongation, grain, gravityFalloff, gravitySoftening, gravityX, gravityY, gravityZ, halo, irregularity, jitter, orientation, pointerFalloff, pointerRadius, pointerStrength, quadraticDrag, sizeBias, snapRigidity, softness, speedLimit, swirlRadius, thermalJitter, timeScale, turbulenceScale, vortexRadius, zConfinement

**Frozen engine settings — identical in every scene (28):** autoOscillate, autoSweep, collisionEnabled, collisionMode, colorEnabled, colorMode, dotShape, driveShape, focusOrder, fontFamily, fontWeight, grainProfile, mediumDimension, mediumEnabled, mediumPlane, morphEnabled, pairwiseEnabled, paletteSource, pointerClick, pointerClickRadius, pointerClickStrength, pointerMode, relationalEnabled, relationalMode, resonanceEnabled, resonatorMode, sweepDirection, trajectory

Spreadiest params (distinct values corpus-wide): dispersion 11, speed 9, turbulence 6, excitation 5, contrast 4, frequency 4.

Short-glyph histogram (top): ◉×83, 1×78, /×74, 0×69, ?×50, ⚖×50, ≡×36, X×34, ∅×32, IS×26 — none carry rationales; the floor now requires one per glyph in the member's craft note.

## Method note

Effective settings = engine defaults merged over each scene's authored `engine` block (most members author none), plus `field.params`, `view`, `composition.plane/layout`, `morph`. Adjacent-scene change counts keys whose effective value differs, classified into families: physics, material, relational/medium/collision, morph, resonance, camera/3D, colour, pointer. The linter imports `validateJourney` from the engine package, so validity is checked against the real schema. Text-overlap is a documented box-height heuristic at 1440×900 and 390×844; the render pass is the visual truth.
