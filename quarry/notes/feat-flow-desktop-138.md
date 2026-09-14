# feat/flow-desktop-138

`origin/feat/flow-desktop-138` @ 2ebb2d2 (2026-08-24) · 150 commits ahead of main ·
Class A QUARRY-DESKTOP (§3) · superset of `feat/living-wiki-desktop-135`
(= that branch + 47 commits: Flow workbench, Flow Contemplate transport,
Factory pinning, W7 conformance tail). Targets removed `desktop/{ui,core,src-tauri}`.

## What it is

The #138 Flow vertical on the pre-rebuild desktop: a Flow workbench over native
Central + AIKit owner contracts, plus the Living Wiki change-aware composition,
an explicit Flow/Living Contemplate path, and a large CI "finalizer" apparatus
pinning Factory/AIKit owner mains. The module law is stated in every header:
Central owns Flow source identity/revision/mutation; AIKit owns standing
context, praxis and contemplation; O:I "owns no Flow registry, file writer,
revision scheme or AgentSession identity". Most of the 150 commits are CI
pinning/finalizer repairs; the durable knowledge is ~20 files of core + UI +
tests encoding loop and authority semantics.

## Feature/function inventory

- **Flow document composition** — `desktop/core/src/flow.rs` (537 lines):
  `CentralFlowClient` wraps `projectcentral.flow.create/write` and
  `bind_flow_for_act`; a structural test asserts the desktop never writes
  files itself: `assert!(!source.contains("fs::write"));
  assert!(!source.contains("OpenOptions"))`. Revisions advance r1→r2 through
  the owner only; `apply_agent_intent` and `bind_for_act` separate agent
  return from human save.
- **Flow workbench UX** — `desktop/ui/src/flow-workbench.tsx` +
  `flow-workbench.test.mjs` (tests are the UX spec):
  - Flow uses the shared native document Surface, no bespoke editor:
    `assert.match(flow, /NativeDocumentEditor/); assert.doesNotMatch(flow, /<textarea/)`.
  - Contemplate is never implicit: `assert.doesNotMatch(effects, /flow_contemplate/)`
    while the UI still offers `>Preview Contemplate<` and `>Contemplate Flow<`.
  - Session binding is blocked while dirty:
    `disabled={busy !== '' || dirty}.*>Bind current AgentSession`.
  - Returned authorities stay separate: `Flow owner`, `Agent Wiki /
    WikiReading`, `Human Ground` each presented, never merged.
- **Typed Contemplate transport** — `desktop/core/src/flow_contemplate.rs` +
  `living_contemplate.rs`: reuses the *already-open* ACP AgentSession
  (`AcpFlowContemplateExecutor`); a structural test asserts
  `!source.contains("AikitAgentSurface::open")` — no second session path.
  The prompt rejects any preflight with
  `automatic_agent_or_model_invocation` or `changed_source_payloads_retrieved`.
  Returns are `flow_mutations` as **expected-revision owner intents** plus
  `living.human_source_proposals`; `living_contemplate_process.rs` proves
  `free_chat_prose_from_real_acp_process_cannot_be_promoted_to_knowledge`
  and that `SECRET_SOURCE_PAYLOAD` never crosses the wire.
- **Living Wiki reading** — `desktop/core/src/living_wiki.rs` (see the
  living-wiki-135 note for detail) + UI model
  `desktop/ui/src/living-wiki-model.ts` / `.test.mjs`: summary counts
  `{changed, affected, pending}`; selection relation is **stable-ref exact
  rather than filename inference**; FlowRef relates through its native owner
  SourceRef "without identity collapse"; freshness labels preserve
  moved-basis semantics (`'basis-changed' → 'Basis changed'`, never `Invalid`);
  **provider loss retains exact last owner reading** without promoting it to
  current (`degraded.freshness === 'last-observed'`,
  `error: 'Central observer unavailable'`); `canContemplate` requires an
  explicit stable selection.
- **Contextual Action authority** —
  `desktop/core/tests/contextual_action_authority.rs`: a contextual command
  "consumes exactly matching preissued authority";
  `contextual_command_cannot_turn_discovery_into_authority`; wrong-subject
  rejection even when discoverable; fails closed on ambiguity
  (`multiple native Action authorities`).
- **Execution containment** — `desktop/core/tests/phase4_execution_containment.rs`:
  discoverable actions have zero execution authority without a registered
  grant; finite grants are consumed before dispatch and **cannot be replayed**
  (`already consumed` / `exhausted`); subject/revision/capability/operation
  substitution fails before the use is spent; expiry and revocation fail
  closed; rendered contribution identity never confers bridge authority;
  root webview CSP denies `object-src/frame-src/base-uri`, `script-src 'self'`.
- **Contribution grammar** — `desktop/core/tests/d1_contribution.rs`:
  package envelope never replaces native contribution/Action identity;
  selection propagates only the stable subject ref; availability, capability
  grant and authority are separate (`authorize_action` fails on
  wrong/missing capability).
- **Agent surface over a real ACP process** —
  `desktop/core/tests/agent_surface_process.rs`: canonical AgentSession
  preserved end-to-end; `provider_rebind_changes_native_identity_without_renaming_agent_session`.
- **CI finalizer machinery** — `.github/workflows/*`, `suite/living-wiki-w7.json`:
  multi-repo pinning/finalizer workflows (retired later on
  `converge/oi97-post-w7-desktop`). Superseded by law 13 pin discipline.

## Map-unit mapping (map = docs/OI-DESKTOP-CRADLE-REBUILD-WAYFINDER.md)

- Flow composition + shared document surface + authorities-separated
  presentation → **U4.1 Flow as default canvas object** (§5 P4; #138 §1–3).
- `flow_mutations` as expected-revision owner intents, never-implicit
  contemplate, prose-cannot-become-knowledge → **U4.2 Return into the field**
  (§5 P4) and the §2.2 loop row; explicit preflight semantics → **W1.4
  Contemplate Flow** (§6).
- Living-wiki reading/freshness/provider-loss honesty → **U3.2 Knowledge on
  selection**, **U3.4 Wiki graph surface** inputs, and law 7 honesty (§1).
- Authority tests → §2.1 Action-seam grammar + **U0.3b** context-menu
  invocation crossing the authority seam (§5 P0), law 12.
- ACP single-session transport → **U2.1/U2.2** reference behaviour (one
  session, no desktop chat store), §2.2 encounter row.

## Quarry verdict

**KEEP-FOR-UNIT** — U4.1 + U4.2 (with W1.4/W1.5 inputs): the tests are the
executable UX spec for the loop. The CI finalizer/pinning apparatus is
**NOTHING-NEW** (law 13 supersedes). Code itself is reference, not truth (§1
law 2): the units re-derive under the cradle contract and re-prove by walk.
