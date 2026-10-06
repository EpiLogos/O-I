# Gates at the convergence tip (2026-10-06, branch enrich/expressions-convergence)

- `python3 site/tests/expression-render.py`: **72/72 PASS** (site built with `npm run build:public`, OI_PCD_S_PRODUCTS_ROOT at the enrichment branch of Point-Cloud-Demo; evidence `site/evidence/expression/`) — includes the 135-member smoke loop: every member's bytes match its digest, validateJourney accepts, scene ids match the index; and the in-stage text checks.
- `npm run test:essay`: **20/20 PASS**.
- `node --test essay-expressions.test.mjs`: **4/4 PASS**.
- Richness floor: **135/135** (`02-after-richness.json`).

## Do NOT re-run export-return-of-zero-publication.mjs

The exporter re-copies essay/rooms members byte-exact from Point-Cloud-Demo
`production/return-of-zero` (the E0 originals). The collection's journeys are
now the ENRICHED ones enriched in place; running the exporter would regress
them to E0. The manifests/envelope metadata were refreshed directly
(enrichment provenance, 2026-10-06); per-byte digests need no regeneration
(the site hashes current bytes at build).
