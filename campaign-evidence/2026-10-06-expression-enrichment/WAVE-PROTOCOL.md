# Wave protocol — Expression enrichment 2026-10

You are one content lane of the enrichment programme (owner brief 2026-10-06,
NOW clearing `central:now:control:root:664e4c586f97ea62f3fe955be0a277d5bb6527231108d74ba66a26e9971f4dab`,
lane branch `enrich/expressions-20261006` in the O-I repo). You re-author the
journeys of your family so they meet the enrichment floor, without changing
what they carry semantically.

## Ground to read first (in order)

1. This file and your lane brief (same directory).
2. `Antykathera-Essay-Work/docs/EXPRESSION-CORPUS-PRODUCTION-ALIGNMENT.md` §3–§7 — Ta-Onta used properly; six content workers; whole-first law.
3. `desktop/cradle/expressions-app/field-studies-journeys/docs/EXPRESSION-PRODUCTION-SANDBOX.md` §5–§6 — no new personas; shared-code boundary.
4. `site/tests/expression-richness.mjs` header — the floor you must meet (it is the gate; run it, do not argue with it).
5. `Antykathera-Essay-Work/return-of-zero-orienting-principles.md` §I–III — the argument and attitude locks your expressions serve.

## Where things live

| Thing | Path |
|---|---|
| Your checkout (the seat) | `/Users/admin/Central/worktrees/env-1/o-i` (branch `enrich/expressions-20261006`) |
| Return-of-Zero collection | `desktop/cradle/expressions-app/collections/return-of-zero/<your-family>/` |
| Prior binding records (read-only source to copy from) | `/Users/admin/Central/Work/Point-Cloud-Demo/production/return-of-zero/bindings/<name>.binding.json` |
| Essay vault (source records; canonical revision **fc59a719**) | `/Users/admin/Central/Work/O-I/Antykathera-Essay-Work` — read record text with `git -C <vault> show fc59a719:<path>` (the working tree sits on another lane; never read it for content) |
| E0 family packets (family grammar) | `<vault> working/expression-corpus/packets/E*.md` at fc59a719 |
| Engine ground truth | `packages/oi-design-system/expressions-engine/shell/model.mjs` (validateJourney, DEFAULT_PARAMS, DEFAULT_ENGINE_SETTINGS), `shell/nativeParameters.mjs` |
| Richness linter | `node site/tests/expression-richness.mjs --collection <your family dir>` |
| Render/capture tool | `/Users/admin/Work/Point-Cloud-Demo` deps and `dist/` are already built (2026-10-06). Single-scene cover: `node /Users/admin/Central/Work/Point-Cloud-Demo/production/return-of-zero/tools/capture.mjs <file.journey.json> --out /tmp/expression-enrich/<family> --count 8000` (add `--scene-id <id>`, `--all-scenes`). For morph evidence (t=0/mid/end of a sequence) and 3D yaw pairs, copy the tool's injection pattern into a small script under `/tmp` (do not commit it) and use the corrected API, verified by two lanes 2026-10-06: start the server yourself (`PHYSIS_PORT=<port> PHYSIS_TEST_MODE=1 PHYSIS_DATA_DIR=<tmp> node server/index.mjs`) — the app boots in 18–70s under load; `goto(url, {waitUntil:'domcontentloaded'})` (the `load` event is unreliable); inject `window.__JOURNEY__` + `window.__START_PRESENTATION__ = true`; wait for `window.__FIELD_STUDIES__.inspect()`; switch scenes with `__FIELD_STUDIES.setScene(<index>)` — an INDEX, not an id (`openScene` does not exist; passing an id throws a misleading undefined-transition error). |
| Known defect (Point-Cloud #6 candidate) | the capture tool required `npm ci` + `npm run build` in Point-Cloud-Demo with no error pointing at it — record this in your report if it costs you time |

## The law of this pass

- **Preserve identity**: journey `id`, member `description`, scene `id`/`name`/`character` stay unless the source demands otherwise. Never rename members or scenes (`site/essay-expression-map.json` addresses them by id). Scene count may grow (max 64/journey; ≤32 entities, ≤16 text blocks per scene).
- **The packet is the burden, not art direction**: every scene continues to carry the record's claim, status, and relations (they ride in the text blocks and bindings). Enrichment re-expresses the same burden with the format's full means — it adds no claims the source does not make.
- **The per-scene move is the craft**: for every scene decide what *changes* through it and why that gesture carries the record's move (Logos: the argument's step; Nous: the concept's determination; Eros: relation/field; Mythos: story-beat; Psyche: symbolon/lived matter; Sophia: integration). Express that as sequences, parameter moves, camera, pointer — never as persona dialogue.
- **Engine and editor are untouched.** A shared defect goes to your report as a Point-Cloud #6 candidate; do not fix it here.
- **Do not touch the essay vault, the primary checkout, other families' dirs, or any file outside your declared region.** Commit with prefix `[enrich:<family>]`. Do not push (the parent pushes after review).

## Hard craft rule: the authoring-app ceiling

The PCD authoring/capture app refuses scenes over **10 formations / 8 pins** (`field-studies-journeys/src/app.ts` `ensureCapacity`) while the validator admits 32 entities and the site engine supports 64 — three surfaces, three ceilings (Point-Cloud #6 candidate, verified 2026-10-06 by the symbolon critic: a 13-formation scene refuses to boot in the capture app). Until the ceiling is raised, **keep every scene ≤10 formations and ≤8 pins** so members render through both the authoring shell and the site. Sequences morph ONE formation through steps — depth of meaning does not need crowds of formations.

## The floor (linter-enforced; details in the linter header)

1. Formation sequences on ≥1/3 of scenes; ≥1 sequence changing glyph AND object state (position/size/tint). Single-glyph holds don't count.
2. Every adjacent scene pair: ≥3 changed settings across ≥2 families (physics, material, relational/medium/collision, morph, resonance, camera/3D, colour, pointer). Palette-only fails.
3. ≥1 scene in 3D: `view.mode:"3d"`, entities distributed in z, a depth/volume engine setting authored, and the craft note states what the third dimension *means* there.
4. ≥3 distinct pointer profiles per journey — chosen for meaning: guard/boundary→repel, gathering/return→attract or implode click, turning/spiral→vortex, rupture→shove, stillness→very low strength.
5. Every scene: a placed text block (kicker + title + one italic line; body ≤70 words only where the scene needs it) that doesn't sit on the formation's mass and doesn't overlap its neighbours at 1440×900 or 390×844. Size hierarchy (≥2 text sizes across the journey).
6. Every distinct glyph/word carries a one-line rationale in the binding's `glyph_rationales` — what it is a sign *of*, in the source's own terms. No placeholder glyphs. Recurring signs transform across scenes and the transformations mean something.
7. ≥1 automation lane or property track per journey, tied to meaning (breathing, drift, pulse); ≥2 distinct durations or transitions across the journey (beats differ).
8. Not `free` layout in every scene; use `composition.layout`/`focus` where content is serial or parallel.

## Binding record (the craft note)

Copy your member's binding from the PCD path above to
`desktop/cradle/expressions-app/collections/return-of-zero/<your-family>/bindings/<name>.binding.json`
and update it:
- `source_revision.commit` → `fc59a719` (note the old dbf3b17 lineage in a new `enrichment.basis_commit` field);
- add `enrichment: { date: "2026-10-06", actor: "<your actor>", lane: "<your lane>" }`;
- add `glyph_rationales: { "<glyph or word>": "one line — what it is a sign of, in the source's own terms" }` covering **every** distinct entity text and sequence-step text;
- extend `notes` with the per-scene moves: what changes between scenes and why; what the 3D means; why the pointer profile; why the automation.
- keep every existing source binding (record ids, paths, hashes) — enrichment does not re-bind sources.

## Verification loop (finish a member before starting the next)

1. Re-read the record at fc59a719; decide the moves; author the journey JSON.
2. `node site/tests/expression-richness.mjs --collection <family dir>` — zero failures for your members.
3. Render truth: capture the strongest scene at t=0, mid-sequence, end (see the morph); the 3D scene at two yaw angles; a pointer-affected frame if your capture tool supports driving the pointer — else state how you verified pointer settings numerically. Keep captures under `/tmp/expression-enrich/<family>/` and list them in your report (the parent curates keepers into campaign-evidence).
4. Compare pixels across time — a frame count proves nothing about morphing.
5. Update the binding; commit.

## Report back (final message)

- per member: floor before → after (the failing checks that now pass), the moves you authored (one line each), the 3D meaning, the strongest scene for its cover;
- anything you could NOT meet, with the criterion and the reason — leave the member as it was rather than faking compliance;
- engine/editor defects met (Point-Cloud #6 candidates);
- capture file paths.
