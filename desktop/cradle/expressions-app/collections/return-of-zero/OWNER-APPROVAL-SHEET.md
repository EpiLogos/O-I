# Return of Zero — publication tuple: OWNER APPROVAL SHEET

**Standing:** candidate for approval. **Nothing is published.** Nothing has been
deployed to any public host. On approval, publishing = running the existing
#448 site producer against `PUBLICATION-CANDIDATE.json`; deployment is a
separate act and a separate decision.

Receiver tuple being satisfied (O:I #417, comment 5749361807): *admitted native
subject + collection membership + complete body + Expression/Projection
revision + source-return + approved assets.*

## What would go public — 92 subjects, already public in this repository

The committed corpus (#452, 0b18c11b) plus the #448 nine-member published slice,
extended to the whole committed set. Default posture: **all admitted; strike any.**

| Family | Members |
|---|---|
| Arguments | 1 |
| Conjugates A′ | 1 |
| Episteme | 8 |
| Matheme | 6 |
| Symbolon | 2 |
| Mytheme wholes | 25 |
| Sovereign essay reading | 1 |
| Section rooms | 8 |
| Legacy featured | 3 |
| Legacy starters — Material | 8 |
| Legacy starters — Composition | 5 |
| Legacy starters — Native | 19 |
| Legacy starters — Source studies | 5 |
| **Total** | **92** |

## The tuple, per member (recorded, not rebuilt)

- **Admitted subject + membership:** every member is a featured entry of one of
  four committed manifests (`corpus.manifest.json` 43, `essay.manifest.json` 1,
  `rooms.manifest.json` 8, `legacy-collections/manifest.json` 40); slot and
  manifest are recorded per member in the candidate.
- **Complete body:** the committed `oi.journey` document itself (sha256 recorded
  per member as the body revision — no member carries a native `expression:`
  ref, so none is invented). Essay/rooms members additionally carry the pinned
  essay-prose sources; corpus members carry their scene prose.
- **Expression/Projection revision:** derived at publish time by the existing
  #448 producer from the journey formations (deterministic, published_at pinned
  to the envelope export) — the same code path already landed, no second pipeline.
- **Source-return:** every member and every bound asset carries exact canonical
  path + bytes sha256, verified during assembly:
  - corpus members → Point-Cloud-Demo `production/return-of-zero` @ 66c767c binding records, whose census records verify byte-exact at Antykathera-Essay-Work @ dbf3b17, and whose committed O-I bytes equal the production bytes;
  - essay/rooms members → the landed envelope's pinned sources at dbf3b17, re-verified here;
  - legacy members → the committed journey documents (the native member bytes).

## Asset inventory (the sheet's backbone)

- **52 cover PNGs — YES.** Pipeline-generated: captured by
  `tools/capture.mjs` through the real engine ("covers are captured, not
  drawn"); each verified byte-exact against the Point-Cloud-Demo production copy.
- **103 inline authored assets — YES.** Glyph/diagram/ascii entity
  text inside corpus journeys, recorded `authored` in the production bindings;
  no binary files.
- **4 embedded image asset(s) — FLAGGED.** See below.

### Flagged assets — the owner questions

- **desktop/cradle/expressions-app/field-studies-journeys/sources/face-mono.png** (sha256 `2110b6553e4b9e4c…`) — embedded inside: source-mask-mono.
  Question: This image rides inside source-mask-mono as an embedded data URL. Admit it into the public edition, strike the dependent members, or hold the members until the producer is recorded?
- **desktop/cradle/expressions-app/field-studies-journeys/sources/face-colour.jpg** (sha256 `293245ef76f900ff…`) — embedded inside: source-mask-neon, source-mask-cutout.
  Question: This image rides inside source-mask-neon, source-mask-cutout as an embedded data URL. Admit it into the public edition, strike the dependent members, or hold the members until the producer is recorded?
- **desktop/cradle/expressions-app/field-studies-journeys/sources/faces/face-01.jpg** (sha256 `5e73da4e3b045496…`) — embedded inside: source-laminate-head.
  Question: This image rides inside source-laminate-head as an embedded data URL. Admit it into the public edition, strike the dependent members, or hold the members until the producer is recorded?
- **desktop/cradle/expressions-app/field-studies-journeys/sources/faces/face-09.jpg** (sha256 `0eeb438f48ce33cf…`) — embedded inside: source-laminate-head.
  Question: This image rides inside source-laminate-head as an embedded data URL. Admit it into the public edition, strike the dependent members, or hold the members until the producer is recorded?

### Disclosed absences (not silent gaps)

- The 40 legacy members have **no cover captures** (formation-only readings).
  Admitting them cover-less is the default; commissioning a capture pass is an option.
- `roz-mytheme-taylor-authored-images` publishes **text describing** 23 authored
  works (14 admitted image units). No image bytes exist in the corpus, the essay
  repository, or this collection — nothing image-based is published by this edition.

## Verification evidence (executed at assembly)

- 761 hash/presence checks executed at assembly; 0 failures.
- Every corpus census record re-verified at the pinned essay commit; every cover
  re-verified against its production capture; every member document id-checked.
- The committed corpus is untouched by this lane; the collection tests
  (`collection-source-identity` + `collection-consumers`) are run in the PR
  and prove the committed members byte-unchanged.

## Decisions requested of the owner

1. **Admit all 92 / strike any** (by family or by id).
2. **The flagged face imagery** (4 files, 4 dependent "Source studies" members): admit,
   strike the members, or hold until the producer is recorded.
3. **Legacy covers:** proceed cover-less or commission a capture pass.
4. On approval: run the existing producer (publishing act) and decide deployment
   separately. Nothing runs until then.
