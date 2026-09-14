# feat/wiki-authored-relations

`origin/feat/wiki-authored-relations` @ 20de156 (2026-08-25) · 2 commits ·
Class A QUARRY-DESKTOP (§3) — smallest Class A branch, freshest tip.

## What it is

A tight two-commit increment: consuming the accepted AIKit authored-relations
main and composing **source-authored wiki relations** into the desktop's
Project Knowledge service — wiki edges that humans author directly in
source (Markdown) rather than only agent-derived relations. All parsing and
compilation stays in AIKit; O:I supplies the real ProjectCentral source
world and projects the composed relation field.

## Feature/function inventory

- **Authored-relation composition** — `desktop/core/src/project_knowledge.rs`
  (+145 lines): `LocalProjectKnowledge` gains `base_wiki_objects`
  (canonical/adopted Wiki objects **before** source-authored relation
  projection, retained so a current Flow can be projected transiently
  "without recompiling already-compiled edges"), `authored_sources`, and
  `authored_compilation` (`AuthoredWikiRelationCompilation` from
  `aikit_adapters::{parse_authored_wiki_source,
  compile_authored_wiki_relations, rebuild_semantic_wiki_with_authored_
  relations}`).
- **`authored_relations()`** — resolved outgoing/incoming relations come
  from AIKit's `SemanticWikiProvider`; "unresolved/ambiguous source
  addresses remain beside them as **pending authored evidence**. O:I
  performs no Markdown parsing here."
- **`flow_authored_relations()`** — projects the currently-open ordinary
  Flow body into the same accepted relation field; the Flow source is
  "treated conservatively as Observed"; the projection is "read-only,
  deterministic and never promotes Flow to a canonical Wiki object".
- **Impact closure integration** — the index now includes source-authored
  edges, so "their exact source provenance participates in the existing
  Wiki living dependency derivation. This method cannot invoke an
  Agent/model."
- **Dependency honesty** — `deps(desktop): consume accepted AIKit authored
  relations main`: the feature exists only because the owner product
  accepted its side first (law 5 pattern).

## Map-unit mapping

- Authored relations as pending evidence + provenance-carrying edges →
  **U3.4 Wiki graph surface** (§5 P3; D21: nodes are authored ground) and
  **U3.5 World crafting through the wiki** (amending relations via owner
  operations).
- Flow projected transiently into the relation field → **W1.5 Flow
  knowledge affordances** (§6: "what changed relative to this thought") —
  this branch is a working prototype of that waypoint's data path.
- Flow-as-Observed, never canonical → U4.1 Flow is an ordinary source;
  no epistemic standing manufactured from UI history.

## Quarry verdict

**KEEP-FOR-UNIT** — U3.4/U3.5 and W1.5: the exact API shape
(`authored_relations`, `flow_authored_relations`, pending-evidence
semantics) is the quarry; the desktop wrapper goes with the tree.
