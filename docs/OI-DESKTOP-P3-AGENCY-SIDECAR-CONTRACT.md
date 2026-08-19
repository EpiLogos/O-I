# O:I Desktop P3 — Canonical Agency Sidecar / Cradle Contract

**Issue:** #107  
**Host base:** P1 PR #118 / `agent/oi-desktop-p1-host-105` at `8b58880ed99b7619877365319f3f64b12523a496`  
**Inherited application substrate:** PR #99 / `dd862fad5bfc51532b4974039bf646612be1f494`

## Purpose

P3 makes the right sidecar the professional human presentation of the already-existing native Agency field. It does not define Agent identity, AgentSession identity, transcript storage, Context resolution, Action authority or Actuation semantics.

The composed relation is:

```text
Actuation Agent / Agency / WorldBinding
        ↓ WHAT is instantiated
AIKit ContextResolution + SessionSpace + AgentSession + harness/provider observations
        ↓ HOW the operative world is resolved/projected
AIKit Agent connection Surface (ACP where configured)
        ↓ one conversation relation
O:I P1 shared selection + P3 Agency sidecar
```

ACP is one conversation Surface. It is not Agency.

## Exact native contracts consumed

### O:I P1 / #99

- P1 host region: `.oi-p1-agent-slot` inside the canonical right Sidecar.
- stable selected semantic ref: `shell_snapshot().selection` and `select_semantic_ref`.
- AIKit SessionSpace application bridge:
  - `aikit_session_spaces`
  - `aikit_session_space_read`
  - `aikit_session_space_focus`
- exact AIKit Context snapshot projection: `aikit_context_resolution`.
- native contribution field: `contribution_catalog`.
- inherited `AgentEncounterSurface` from `desktop/ui/src/workbench.tsx`.
- inherited ACP-backed commands:
  - `agent_surface_open`
  - `agent_surface_send`
  - `agent_surface_cancel`
  - `agent_surface_close`

P3 deliberately imports and mounts `AgentEncounterSurface`; it does not add `DesktopChat`, a second conversation protocol, an O:I transcript store or a renderer-supplied provider process.

### AIKit accepted main

Current accepted main consumed by the inherited host remains `42127820d6e5bf4ea5ee248e88e305e14c5c1a7c`.

P3 reads:

- `aikit.context-resolution/v2`:
  - canonical requested Agent / Agency / Host reference resolutions;
  - Project binding, Profiles and Scopes;
  - Capability/Action/ContextSource/Model/Harness/ExecutionOffer resource readings;
  - operational availability independently of eligibility/preference;
  - retrieval-plan ContextSource refs.
- `aikit.session-space-application/v1`:
  - durable SessionSpace identity;
  - canonical AgentSession attachment intents;
  - portable focus;
  - Explain and History.
- `aikit.session-space/v1` runtime observation where supplied:
  - AgentSession → Harness / provider-native session relation;
  - runtime Surface readings retaining the same AgentSession ref;
  - connection/provider/protocol state;
  - `SessionSpaceAuthorityState` with Capability available/granted and Action authorised state.
- `aikit.connection-adapter/v1` through the inherited Agent Surface:
  - connection identity;
  - canonical AgentSession ↔ provider-native session binding;
  - negotiated create/load/resume faculties;
  - ordered ACP signals;
  - provider-native permission/tool signals retained as transport-native material.

AIKit PR #116 (`9974e7ed61a57123442b2f464a1d174081a55bac`) remains relevant to harness/body admission and activation truth. P3 does not import its ontology or claim activation merely from projected material.

## Identity and authority laws retained

```text
ACP session != Agent identity
provider-native session != AgentSession
AgentSession != Agent
Action descriptor visible != Action authorised
UI selected ref != payload disclosed into Agent Context
Surface != Action catalog
transport permission/tool signal != canonical HumanRequest/Action automatically
Actuation WHAT != AIKit HOW
```

The sidecar displays the effective Action horizon from AIKit ContextResolution plus native contribution descriptors. When a SessionSpace runtime connection observes authority for the current AgentSession, P3 correlates that exact ActionRef and displays Capability-granted / Action-authorised state. Absence of such an observation is shown as `not observed`, never as denial or approval by inference.

P3 does not dispatch a new desktop-local Action path. The existing P1 native-owner dispatch seams remain the only invocation owners exposed by the host.

## Bounded Context disclosure

P3 displays the current AIKit ContextResolution as the bounded operative **horizon**: Project, Profiles, Scopes, Agent/Agency/Host, ContextSource descriptors and retrieval-plan refs.

It does not equate that horizon with prompt payload disclosure.

`aikit.context-resolution/v2` currently has no per-selected-subject payload-materialisation/disclosure receipt. P3 therefore reports one of two truthful states:

```text
selected ref is named in retrieval plan
    → addressable/planned, but disclosure still unproven

selected ref is not named in retrieval plan
    → no disclosure proof in current ContextResolution
```

This is a real remaining AIKit/application evidence seam if exact disclosure must become inspectable.

## Conversation / ACP relation

The existing #99 `AikitAgentSurface` remains the conversation implementation. It verifies that an ACP/provider-native session binding preserves the caller-supplied canonical `agent-session/*` ref and stores no O:I transcript.

P3 exposes the resulting AgentSession as one sidecar relation alongside the larger Agency field.

The current stdio host bridge reads one whole turn while holding the Agent Surface mutex and returns the collected ordered signals only when the turn terminates. Therefore:

- P3 may display the ordered returned chunks/signals;
- it does **not** claim live renderer streaming;
- negotiated ACP cancellation does not currently imply a usable concurrent desktop interrupt while `agent_surface_send` owns that lock;
- P3 hides the inherited Interrupt presentation until the host bridge supplies a genuinely concurrent cancellation/streaming seam.

That limitation is an O:I host/bridge gap, not an ACP or Agent identity problem.

## SessionSpace and alternate Surface continuity

P3 reads all canonical AgentSession attachments in the active SessionSpace and can switch focus through AIKit's authored application mutation. It does not introduce manager/worker classes.

Where the runtime read model observes alternate Surfaces for the selected AgentSession, the sidecar renders:

```text
SurfaceRef
runtime state
same canonical AgentSessionRef
```

A provider/mux Surface therefore remains another presentation/connection relation to the same AgentSession instead of minting a second conversation identity.

## Actuation / Cradle depth

Actuation current accepted main remains `0c6a9147a780329007733df643eb07108f589ac6`.

Actuation #17 / realised-Actuation successor is `85ac3dee1eb9cc1ad0761eb8451ae51d2167c4e3`, publishing `actuation.realised/v1` with Agent, Agency, WorldBinding, realised body refs, participating loci, stream/return refs, lifecycle faculties and observed/partial/unavailable evidence state.

Actuation accepted main already publishes `actuation.agency/v1` for WorldBinding, RootScope, MetagencyGrant, Determination and Return.

The current O:I desktop contribution catalog, however, exposes only the Actuation owner descriptor (`actuation.agency.reading/root-world` / `actuation.agency/v1`) and **not a live payload instance** of those owner contracts. P3 therefore displays the owner contract/provenance and stops there. It does not reconstruct WorldBinding, RootScope, Determination, Return or realised Actuation from names, SessionSpace data or presentation state.

**Real host gap:** add a read-only O:I adapter/provider for actual `actuation.agency/v1` and `actuation.realised/v1` owner payloads (or their accepted successor application service). That is the missing step for full Cradle depth in the sidecar; the Actuation semantic contracts themselves are not missing.

## Canonical Action invocation from a situated Agent

The sidecar can now inspect the effective Action horizon and exact observed SessionSpace authority state without manufacturing authority.

A further seam is still required before P3 can truthfully claim that a provider ToolCall from the situated Agent invoked a canonical suite Action through the same owner handler used by human/CLI projections. Current provider tool-call signals remain transport-native. Promoting them by ActionRef without an explicit binding would violate the Agent-Native authority law.

This is a cross-product adapter/Action invocation gap, not permission to add an O:I Action catalog.

## Evidence

P3 adds `desktop/ui/src/agency-sidecar.test.mjs` and includes it in the desktop presentation CI. The tests assert that:

- P3 imports/reuses `AgentEncounterSurface` and the inherited ACP commands;
- native ContextResolution, SessionSpace read/focus and semantic selection seams are consumed;
- Action visibility remains separate from authority and P3 creates no dispatcher;
- Actuation depth degrades rather than being inferred;
- the unavailable concurrent interrupt affordance is not presented;
- P3 mounts only as a presentation contribution into the P1 Agency slot.

The ordinary desktop workflow continues to compile the TypeScript/Vite presentation, test/lint the Rust core, build the native shell on macOS, and run the existing Explore/workbench presentation contracts alongside the new P3 test.
