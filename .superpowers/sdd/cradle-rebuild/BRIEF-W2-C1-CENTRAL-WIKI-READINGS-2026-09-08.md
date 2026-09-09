# Wave 2 · Cell 1 — Central wiki readings (owner repo: Central)

Binding: WAVE-2-HANDOFF-2026-09-08.md cell table; wayfinder U3.4; programme slice 2
(read-only wiki/search first). This brief is the whole assignment; do not absorb
other cells. One worker, this cell only.

## Goal

Give Central a canonical wiki read-model operation over its own wiki ground so
the U3.4 graph consumes owner data — never a desktop parse of wiki.json.

## Verified current ground (Central main f3559db, 2026-09-08)

- Canonical wiki sources: root `Control/agents/wiki/wiki.json`; project
  `Work/<P>/ProjectCentral/agents/wiki/wiki.json`. Consts `WIKI_SOURCE`,
  `ROOT_WIKI_SOURCE`, `WIKI_PROFILE = okf-wiki/v1`: ctrl/src/projectcentral.rs:9-19.
- World disclosure already carries distinct root/project wiki refs and
  federation (ctrl/src/world_map.rs; U1.1 navigator unit).
- No canonical wiki read-model Action exists. Desktop wiki reads currently route
  through AIKit's SemanticWiki provider, which degrades on the real ground
  (generic 4096-file scan; unresolved-child rebuild failure — progress.md F-01).
- AIKit owns semantic/relations reading (knowledge_okf.rs). Central owns the
  source ground and its structural truth. This cell adds Central's read model;
  it does not duplicate AIKit's semantic faculty.

## Deliverable

- New owner Action(s) — proposed `central.wiki.read` / `projectcentral.wiki.read`
  (confirm naming against the Action registry before implementing) — returning:
  nodes with stable U0.2 source refs, relation rows, and owner counts
  (node/edge totals), derived at read time. Explicit absent/unreadable states.
- No new Central store. No writes to wiki.json (agent-maintained via
  `aikit wiki` only — the return is the only door).
- Disclosed through the existing Action registry with truthful availability.

## Files you may touch (Central only)

ctrl/src/projectcentral.rs (const reuse, no grammar change), ctrl/src/root.rs,
ctrl/src/world_map.rs (read-only reference), one new module (e.g.
ctrl/src/wiki_read.rs) plus its Action registration and tests.

## Real tests required (isolated temp grounds; never the live ground)

- Root wiki and one project wiki: counts match hand-counted fixture content.
- Every returned ref is valid U0.2 grammar and round-trips through
  `projectcentral.source.read`.
- Missing/corrupt wiki.json → explicit unavailable state, never empty success.
- `cargo test -p ctrl` green. Record source revision + release executable sha256.

## Worker law (all wave-2 cells)

No spawning agents; no branch/worktree changes; no commit/push/reset; no live
`/Users/admin/Central` access in tests; no owner binaries selected through PATH
(explicit absolute paths only); walk-bridge is dev-only, never production.

## Receipt

`w2-c1-central-wiki-readings-receipt.md` in a review directory named in your
return: revision, sha256, test summary, exact disclosed Action names + JSON
shape, explicit gaps. Confidence is not acceptance; orchestrator reviews.
