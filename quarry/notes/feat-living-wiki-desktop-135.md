# feat/living-wiki-desktop-135

`origin/feat/living-wiki-desktop-135` @ 41828e0 (2026-08-24) · 103 commits ·
Class A QUARRY-DESKTOP (§3) · base of both `feat/flow-desktop-138` and
`agent/oi-desktop-p2-project-field-106` (each = this branch + commits).

## What it is

The #135 Living Wiki desktop line: a change-aware wiki/knowledge workbench
composed strictly over Central (source-change authority) and AIKit
(impact/freshness/integrative-reading/Contemplate authority). O:I adapts
Central's public Action result (the Source Change Horizon) into AIKit's
provider-neutral horizon and presents owner readings; it "owns no dependency
graph, watcher, Wiki, Agent runtime or background invocation path". The
commit tail is the native-shell registration + CI publication machinery
(`ci: atomically publish proven Living native bytes`, `ci: retire Living
native finalizer after committed proof`).

## Feature/function inventory

- **Central Source Change Horizon contract** —
  `desktop/core/src/living_wiki.rs`: `parse_central_horizon` validates schema
  `central.source-change-horizon/v1` and **rejects the horizon itself** if
  `source_payloads_exposed` or `automatic_agent_or_model_invocation` is set —
  the zero-payload / zero-background-Agent law enforced at the parse seam.
- **Transitive impact derivation** — same file: `living_wiki_reading()`
  calls AIKit's `wiki_living_dependencies` +
  `deterministic_transitive_knowledge_impact`; the reading names its owners
  explicitly (`source_authority_owner: "central"`, `impact_owner:
  "ai-kit"`, `contemplate_owner: "ai-kit"`). Test invariant:
  a modified source affects its node directly, places the integrative
  whole-reading in `pending_integration`, and produces an impact **path**
  (`path.steps.len() == 2`) — change-awareness without touching payloads.
- **Privacy survives change-awareness** — test:
  `privacy_survives_change_awareness_without_payload_disclosure` —
  `agent_retrieval_allowed: false` flows through changed-source metadata;
  `!result.source_payloads_exposed`.
- **Bounded Contemplate preflight** — `living_wiki_preflight()` → AIKit
  `bounded_contemplate_preflight` with `DEFAULT_CONTEMPLATE_OBJECT_BUDGET`
  and `DEFAULT_CONTEMPLATE_RELATION_DEPTH` — explicit, budgeted, never
  automatic.
- **Return projection without copying Wiki objects** —
  `desktop/core/src/living_return.rs`: `project_agent_wiki_plan` projects
  only `{resource_ref, revision, object_kind}` identity facts of
  `AgentWikiMaintenancePlan` next-objects plus `human_source_proposals`
  (source/reason/evidence) — "it does not serialise, copy or persist a second
  Wiki object representation". `living_focus.rs` (13 lines): renderer may
  pass stable refs only; AIKit owns `ResourceRef` validity.
- **QL depth + retained-owner presentation** (tip commits): "derive QL depth
  and retained-owner Living presentation", "present retained owner truth, QL
  depth and returned integration detail", covered by "test: cover QL depth
  and degraded owner observation" — QL refraction appears as optional depth
  while ordinary Wiki correctness stays independent (mirrors
  `suite/living-wiki-w7.json` owners quaternal-logic role:
  "optional WikiFrame/refraction/Context Frame depth; ordinary Wiki
  correctness remains independent").

## Map-unit mapping

- Living-wiki reading, pending-integration semantics, human_source_proposals
  → **U3.2 Knowledge on selection** and **U4.2** return-projection shape
  (§5 P3/P4).
- Freshness/impact presentation as owner readings → **U3.4 Wiki graph
  surface** (§5; D21: nodes are authored ground; this branch keeps wiki
  state authority in owners).
- QL-depth-optional-ordinary-correctness-independent → fog row **S→S5 QL
  refraction** (§2.4): first concrete desktop evidence of how refraction
  degrades without breaking ordinary wiki.
- Zero-background-Agent structural law → §1 law 10 (no capability theatre)
  and §2.3 classical/inference boundary.

## Quarry verdict

**KEEP-FOR-UNIT** — U3.2/U3.4 (and feeds W1.5 Flow knowledge affordances
via the impact-path semantics). The horizon parse/reject laws and the
"project identity facts, never copy objects" rule are the contract the
rebuild's knowledge aperture must re-derive and re-prove by walk.
