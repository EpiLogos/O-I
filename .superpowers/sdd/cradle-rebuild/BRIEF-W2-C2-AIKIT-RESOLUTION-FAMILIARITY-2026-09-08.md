# Wave 2 · Cell 2 — AIKit search / resolution / familiarity (owner repo: ai-kit)

Binding: WAVE-2-HANDOFF-2026-09-08.md; wayfinder U3.1 ("every result row is a
ref carrying owner, provenance and available canonical Actions; invoking one
forwards the ActionRef to its native owner"); programme ruling: AIKit owns
ranking and successful-use familiarity; Central owns the searchable source
ground. One worker, this cell only.

## Goal

Owner side of the U3.1 aperture: real file, Flow and skill resolution with
available Actions per row, and successful-use familiarity — all through AIKit
owner operations. No desktop index, ever.

## Verified current ground (ai-kit main 7d29dbb, 2026-09-08)

- Knowledge ops exist: search/read/relations/route/frame/sources/explain/
  history/status/forget — crates/aikit-cli/src/app/knowledge.rs, dispatch at
  crates/aikit-cli/src/main.rs (`cmd_knowledge`, ~line 1502).
- Familiarity/frecency exist: crates/aikit-core/src/familiarity.rs, frecency.rs;
  tests crates/aikit-core/tests/familiarity_v2.rs, resource_search_familiarity_v2.rs,
  search.rs.
- Resolver exists: crates/aikit-core/src/resolve/mod.rs; skill/project
  resolution in aikit-cli (skill_sources.rs, projects.rs).
- Cradle currently routes only `knowledge search` for the aperture (O:I
  desktop/cradle/kernel/src/knowledge.rs, Request::Search) — do not edit it here.
- Store-schema caution: a newer store advanced past some built binaries
  ("schema 6 vs 5"). Pin AIKIT_HOME isolation in tests; record the schema
  assumption explicitly.

## Deliverable

- One canonical owner resolution operation (extend the existing surface; do not
  fork a parallel command family) whose rows cover the real provider set:
  Central sources/files, Flows, skills, knowledge subjects. Each row: ref +
  owner + provenance + its available canonical Actions.
- Successful-use familiarity: an explicit open records use through the existing
  owner operation; query/display/refresh/failed routes record nothing.
- Unavailable/excluded providers surface as explicit states, not omissions.

## Files you may touch (ai-kit only)
aikit-core resolve/familiarity/knowledge modules; aikit-cli app/knowledge.rs
and the resolution command surface; their tests.

## Real tests required (isolated AIKIT_HOME + temp Central ground)

- One query returns a real seeded file, a real Flow and a real skill.
- Each row lists its real available Actions.
- Open records exactly one use; query/display/refresh record none.
- Full workspace tests green. Record revisions + executable sha256s.

## Worker law
No spawning agents; no branch/worktree changes; no commit/push/reset; no live
user stores; no PATH binaries; no O:I/Central/desktop files.

## Receipt

`w2-c2-aikit-resolution-familiarity-receipt.md`: revisions, sha256s (aikit and
aikit-session-space if rebuilt), test summary, exact operation JSON shape,
explicit gaps.
