# Expression enrichment — after report (2026-10-06)

**All 135 journeys meet the enrichment floor** (`02-after-richness.json`, full-corpus run; S-products read from the lane checkout `worktrees/env-2/point-cloud-demo` at branch `enrich/s-products-20261006`, commit fc15b17). Before: 0/135 (`00-baseline-richness.json`).

| Measure | Before | After |
|---|---|---|
| Formation-sequence entities (multi-glyph) | 107 (83) | 854 (540) |
| Scenes in 3d | 2 | 140 |
| Entities with non-zero z | 0 | 535 |
| Scenes with automation / tracks | 3 | 284 |
| Entities with force strength > 0 | 21 | 189 |
| Journeys changing between scenes (family-classified) | 23/135 | 134/135 |
| Physics/material params frozen at one value | 33 | 16 |
| Engine settings frozen corpus-wide | 28 | 17 |
| Layout `free` scenes | 1194 | 199 |

Layout variety after: line 736, free 199, Single formation 91, ring 67, column 46, grid 37, Kundalini 8, laminate 5, spiral 3, Chakra Body 1, Cymatic plate 1.

The single journey with no adjacent-scene change is a one-scene member (no adjacent pair exists); every multi-scene journey now changes at least three settings across two families per step.
