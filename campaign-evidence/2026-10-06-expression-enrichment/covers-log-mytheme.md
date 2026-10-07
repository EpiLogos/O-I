# Covers pass log — mytheme (25 members) — Expression enrichment 2026-10-06

Actor `zcode:enrich-covers-mytheme`. Every mytheme member's `*.cover.png` verified/captured
against `STRONGEST-SCENES.md` through the real engine (single server per batch,
`window.__JOURNEY__` + `__START_PRESENTATION__` injection, `__FIELD_STUDIES__.setScene(<index>)`
to hold the strongest scene, ~4.5 s settle, 1280x800, authored particle count, fresh browser
context per member). All 25 fragments resolved by exact scene id against the journey JSONs.

Captured fresh: 25/25 ok, 0 failures. Installed: 23 (17 stale pre-enrichment covers from Sep 27
+ 6 continuation-B captures that showed the boot scene rather than the map scene).
Kept existing (verified against the map, current tree, real engine captures by continuation-B
beside the enriched journeys): 2 — `avatar` (m-ava-0-avatar is scene 0) and
`stained-glass` (m-gla-0-aperture is scene 0).

Notes:
- `antikythera` and `apollo-dionysus` journeys were revised after their office re-check
  (18:32); captures are from the current tree. Antikythera's m-ant-3-wreck capture shows the
  post-fix state — the gold "82" letterform is gone (gear ring, spiral fragment, crescent).
- Continuation-B's covers for maya/indra/eros-psyche/meal/valentinian/pauli had been taken at
  the boot scene (scene 0) rather than the map scene — verified by eyeball against fresh
  map-scene captures and replaced. avatar and stained-glass agree with the map and were kept.
- Incident: the playwright chromium cache was pruned mid-run by another process; batch 1
  (20 members) ran on the cached chromium, batch 2 (5 members) on Chrome stable via
  executablePath fallback. A first attempt at member 21 wedged (killed; no output shipped).

| Member | Scene chosen (id · index · name) | Old B | New B | Status |
|---|---|---|---|---|
| mytheme/roz-mytheme-ares-aphrodite-hephaestus-poseidon | m-ares-3-apparatus · [4] · What the apparatus gathers — and where it stalls | 435185 | 434679 | captured |
| mytheme/roz-mytheme-apollo-dionysus-daphne | m-apd-4-diaphaneity · [4] · The view becomes transparent to its context | 479901 | 406308 | captured (post-revision tree) |
| mytheme/roz-mytheme-the-prisoner | m-pri-3-count · [3] · The asymmetric count: Two replaces, Six is assigned, One stays withheld | 436642 | 415123 | captured |
| mytheme/roz-mytheme-antikythera-attunement | m-ant-3-wreck · [3] · The damaged instrument makes answerability unavoidable | 443289 | 373439 | captured (post-fix tree; no gold "82") |
| mytheme/roz-mytheme-mirror-that-moves-first | m-mir-3-initiated · [3] · The instrument turns first | 404630 | 374930 | captured |
| mytheme/roz-mytheme-job | m-job-3-whirlwind · [4] · The whirlwind: foundations, rain where no man is, wild creatures | 383103 | 363285 | captured |
| mytheme/roz-mytheme-mother-assumption-chiasm | m-mot-1-chiasm · [1] · The incarnation–Assumption chiasm | 407752 | 397175 | captured |
| mytheme/roz-mytheme-uroboros-trickster | m-urob-3-torus · [3] · Interposition — the toroidal winding | 492678 | 390066 | captured |
| mytheme/roz-mytheme-travelling-jigsaw-atlas | m-jig-2b-torus · [3] · The torus loop returns with its winding | 473271 | 440075 | captured |
| mytheme/roz-mytheme-neumann-images | m-neu-4b-wheel · [6] · The self-rolling wheel — continuing self-composition | 436697 | 425652 | captured |
| mytheme/roz-mytheme-goethe-permanence-change | m-goe-4-muses · [3] · Beginning and end joined; content and form | 321824 | 364849 | captured |
| mytheme/roz-mytheme-taylor-authored-images | m-tay-4-blacksun · [3] · The black sun and the radiating star | 404018 | 418223 | captured |
| mytheme/roz-mytheme-myth-attica-athena-poseidon-cecrops | m-att-2-sanctuary · [2] · The sanctuary remembers both claims | 403524 | 363028 | captured |
| mytheme/roz-mytheme-myth-hypostasis-archons-norea-sophia | m-hyp-3-eleleth · [3] · Eleleth: rescue and the rulers' own origin | 433509 | 417241 | captured |
| mytheme/roz-mytheme-narrative-fanon-language-gaze-mask-recognition | m-fan-2-mask · [2] · The mask becomes an inward criterion | 369157 | 305283 | captured |
| mytheme/roz-mytheme-narrative-jung-aion-fishes-christ-antichrist-alchemy | m-ai-1-fishes · [1] · The fishes give the age its temporal image | 401410 | 335677 | captured |
| mytheme/roz-mytheme-apollo-eros-daphne-peneus | m-ovid-3-tree · [3] · The transformation — and the wood that shrank | 518757 | 371858 | captured |
| mytheme/roz-mytheme-maya-eye-veil-frame-horizon | m-maya-5-return · [4] · Recognition returns through the veil | 387883 | 444722 | captured (continuation-B cover was boot scene 0) |
| mytheme/roz-mytheme-avatar-image-mask-idol | m-ava-0-avatar · [0] · Presence becomes addressable through a form | 350940 | 350940 | kept (continuation-B capture agrees with map) |
| mytheme/roz-mytheme-indra-net | m-indra-2-simile · [3] · The image teaches where its own likeness ends | 376663 | 476550 | captured (continuation-B cover showed m-indra-0-net) |
| mytheme/roz-mytheme-eros-psyche | m-psy-2-lamp · [2] · The lamp: truth seen, wound dealt | 320975 | 344393 | captured (continuation-B cover was boot scene 0) |
| mytheme/roz-mytheme-stained-glass-refraction | m-gla-0-aperture · [0] · Light entering a made aperture | 343626 | 343626 | kept (continuation-B capture agrees with map) |
| mytheme/roz-mytheme-meal-epistemic-metabolism | m-meal-3-table · [3] · The container; the shared table; companions are not food | 352848 | 370329 | captured (continuation-B cover was boot scene 0) |
| mytheme/roz-mytheme-valentinian-sophia-horos-achamoth | m-val-1-horos · [1] · Sophia reaches; Horos restores | 366618 | 378416 | captured (continuation-B cover was boot scene 0) |
| mytheme/roz-mytheme-pauli-egg-dream | m-pauli-2-hand · [2] · Pictures 3–4: the egg in his own hand; division that keeps wholeness | 314380 | 336418 | captured (continuation-B cover was boot scene 0) |

Raw capture journal: `/tmp/expression-enrich/covers-mytheme.jsonl`; fresh captures:
`/tmp/expression-enrich/covers-mytheme-fresh/`. Eyeballed: antikythera (post-fix confirmed),
apollo-dionysus, indra (pair), maya (pair), avatar (pair), eros-psyche (pair), stained-glass
(pair), meal (pair), valentinian (pair), pauli (pair), ares, neumann — all show their map
scene's title, text blocks and formation state.
