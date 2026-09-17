# Glyph coverage: provisional O:I compatibility intake

Implementation evidence, 2026-09-15.

- Exact starting owner revision: `9443f58fa8599f903d6affa61bc6fbed7109f640`.
- Compatibility branch: `agent/glyph-coverage-oi-compat`.
- Current-main owner repair: [Point-Cloud-Demo #5](https://github.com/EpiLogos/Point-Cloud-Demo/pull/5),
  production commit `333eb55c62a94fcb3ff8b50fa151e363eddf7700`, with cross-font
  regression follow-up `ae32714ec1f24ee894bd54bc2c32ed185d90ad5c`, on main base
  `22c02d543dfee2c6eb30ded1f4a0a62225200eeb`.

This is a provisional native source commit for O:I's existing engine intake.
It carries only the sampling correction, applicable native regression, test
harness exports and this evidence. The later native semantic/schema changes
remain outside this branch. Neither this branch nor the current-main PR is a
merge or acceptance claim.

## Reproduction and repair

The actual Canvas2D `GlyphSampler` emits a row-ordered candidate pool. The actual
`EntityRuntime` previously used its prefix for ordinary and explicitly
unnormalized formations, cropping low-share allocations to the top of a glyph.
The repair uses its existing full-pool low-discrepancy stride for all formations
and removes the unused normalization argument from that private method.

The new test was executed against the unmodified starting engine and failed for
the cropped allocations before the repair. It then passed against the corrected
engine. Both A/B targets, two partitions, vertical/horizontal planes,
absent/false/true normalized extents and total counts 1,024/8,192 are covered:
48 real sampler/runtime allocation cases. No sampler or engine is mocked.

| Ordinary glyph | Allocated particles | Height before | Height after | Quadrants before → after |
| --- | ---: | ---: | ---: | --- |
| O (15,446 candidates) | 512 | 4.42% | 100% | 2 → 4 |
| O (15,446 candidates) | 4,096 | 23.20% | 100% | 2 → 4 |
| ● (8,304 candidates) | 512 | 10.78% | 100% | 2 → 4 |
| ● (8,304 candidates) | 4,096 | 49.02% | 100% | 2 → 4 |

All repaired cases retain full-height coverage and all four quadrants. The
regression also compares every sampled source point between normalized and
ordinary formations, within Float32 precision. Linux's sparse O allocation
covers 96.97% of the extreme-column width even in the pre-existing normalized
path; source-point identity checks horizontal coverage without a font-specific
width cutoff. The height and quadrant assertions remain.

Repeated zero-time updates do not rebake; reallocating the same count
retains identical A/B shape targets. Counts above are same-machine font/raster
observations, not fixed test expectations.

## Executed checks

- `npm run lint`: passed
- `npm test`: 92 passed
- `npm run build`: passed; existing large-bundle warning remains
- `npm run test:journeys`: 48 passed
- `npm run test:gpu`: 6 passed, including the 48-case coverage regression
- `npm run test:browser`: 25 passed
- `npm run test:workspace`: 25 passed
- `python field-studies-journeys/tests/module_browser.py`: native default route,
  62,000-particle field and portable module export passed; no external requests
- `git diff --check`: passed

Browser tests used installed Chrome and the existing software-WebGL harness on
macOS. Reports and captures are in `field-studies-journeys/evidence-native/`.
There were no browser errors. Existing editor suites declare their origin-storage
test doubles; the new regression directly exercises the real rasterizer and
engine target textures.

## Consumption

O:I should consume this exact clean native commit through
`node scripts/vendor-expressions-engine.mjs --source <this-native-worktree>` and
record the returned native SHA in provenance. Do not copy-edit O:I's generated
engine files. The independently accepted current-main engine refresh should
eventually supersede this compatibility source while retaining the repair.
