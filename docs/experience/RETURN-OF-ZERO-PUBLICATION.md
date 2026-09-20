# Return of Zero — the published reading (site-lane contract)

**Standing:** agent-authored publication preparation, 2026-09-19 (Mac Track 3), for
the O:I Web/SharedField site lane. The published set is deliberately narrow: the
essay's own publication surfaces — the sovereign essay reading and the eight
section rooms. Everything else in the corpus stays local until the owner admits
it; no Nara, personal or credential material is referenced by these outputs.

## What the site lane receives

```text
desktop/cradle/expressions-app/collections/return-of-zero/
  PUBLICATION.json            the machine-readable contract (below)
  essay.manifest.json         the sovereign essay reading (1 member)
  rooms.manifest.json         the eight section rooms (8 members)
  essay/ rooms/               member journeys (oi.journey v1) + covers, byte-exact copies
```

Regenerate after any accepted source change:
`cd desktop/cradle/expressions-app && node scripts/export-return-of-zero-publication.mjs`
— it sha-verifies every source binding at the essay revision and refuses to
publish drifted bytes.

## Refs and revisions

- **Source revision:** `EpiLogos/Antykathera-Essay-Work` @ `dbf3b17`; every scene's
  canonical source path + sha256 rides in `PUBLICATION.json` under
  `manifests[].source_bindings` (verified against actual bytes at export).
- **Corpus revision:** `EpiLogos/Point-Cloud-Demo` `production/return-of-zero`
  (E0 six-worker pass; artifacts validated by `tools/validate.mjs`).
- **Collection identity:** `oi.legacy-collections/v1` manifests with
  `oi.collection-provenance/v1` envelopes — the same law the Expressions
  application enforces at import and the cradle reads through the files seam
  (`src/expressions/collectionReadings.ts`; proven in
  `walk/artifacts/corpus-return-of-zero.json`, 46/46, 2026-09-19).

## Required assets

Nine cover PNGs (essay + eight rooms), each with its sha256 in
`PUBLICATION.json` `required_assets`. Scene material is engine-native
(authored formations, text, palette) — no external imagery, provenance clean
by construction (E0 §8).

## Supported browser operations

Open a collection member as an Expression through the application's own
`oi.journey` import; read scenes (per-scene text/material composition);
front/verso on the same Expression identity; SharedField projection of an
admitted member through the existing `Explore` seam (`walk/scenarios/explore-sf1.mjs`
proves Share → preview with omissions → Projection → hosted publish → Open in
Explore).

## Degradation states (each named, never fabricated)

1. **Manifest absent** — the ground lists the collections directory without the
   manifest; readers get a named absence, not a guess.
2. **Member unreadable** — a refused/missing member carries the owner's refusal
   verbatim beside the members that returned.
3. **Engine absent** — manifests and covers render without the live particle
   engine; no silent substitution pretends to be the field.
4. **Offline ground** — an unreachable Central degrades to the named-unavailable
   reading; cached site copies disclose their export revision.

## Boundary

Publication is a projection of the same collection identity the local Library
reads — no second public form (#366 EX3A6). The owner's Recognition remains the
gate for widening the published set beyond these nine surfaces.
