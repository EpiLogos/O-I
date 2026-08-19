# O:I Desktop P5 — Six-Product System Workbench Evidence

**Issue:** O:I #109  
**Branch:** `agent/oi-desktop-p5-system-109`  
**Implementation base:** O:I P1 host head `8b58880ed99b7619877365319f3f64b12523a496`  
**Live-state audit:** 2026-08-19

## 1. Meaning and authority

The governing authored position is `docs/positions/FOUNDING-POSITIONS.md`: O:I begins from an already heterogeneous technological world and composes it without silently moving canonical identity, source ownership, or authority into itself. The P0 surface ledger (#104 / PR #113) and P1 host contract (#105 / PR #118) make that concrete for Desktop: System is a presentation/composition surface over owner-native state.

P5 therefore does **not** add an O:I settings database, Action authority, credential store, provider identity registry, Agent identity registry, or Run identity registry.

The workbench keeps seven state classes separate:

```text
AUTHORED
EFFECTIVE
ACTIVE
STAGED
EXPECTED EFFECT
OBSERVED
PROVENANCE
```

In particular:

```text
authored != effective != active
effective != observed
staged != applied
expected effect != observed result
Action discovered != Action authorised != Action invoked
selected != retrieved != disclosed into Agent Context
```

## 2. Actual owner state consumed for this cut

This table is a live repository observation, not a constitutional claim.

| Owner | Accepted `main` observed | Relevant current development | P5 treatment |
|---|---|---|---|
| Central | `a332b26eb08b95581533fc5053a2d16a22cf1f69` | PR #75 `ab354c1278396b0d50620bf8a43c40eedc26b907` adds ProjectCentral NOW/DAY and native temporal Actions, still draft | Existing Central Personal/root Action contribution is presented; authored source remains Central-owned. NOW/DAY is not promoted into accepted runtime state. |
| Actuation | `0c6a9147a780329007733df643eb07108f589ac6` | PR #17 `85ac3dee1eb9cc1ad0761eb8451ae51d2167c4e3` adds `actuation.realised/v1`, still draft | Existing Agency reading is presented. Realised Actuation is shown as not disclosed until owner-native evidence is bound. |
| AIKit | `5308405e447b4a48e57fa2cfb2c5e6ef276ae343` | PR #115 is merged; later adapter work remains separate | Native `aikit.context-resolution/v2` is the EFFECTIVE input. Resource/provider availability is OBSERVED separately. Effective resolution is never promoted to ACTIVE. |
| Software Factory | `06579aada01a77bd719c0c010a10f91084b4326f` | Factory development continues independently | The existing Factory-owned `factory.build-view-provider/v1` reading supplies effective/observed Run state only when a live provider is bound. Fallback remains degraded. |
| Workcell | `8a744b1ddbdc694ad71b7aea72064f7def6620d2` | PR #41 `5274a5be892ed9e3f326323b78e12e47a98d48d8` adds `workcell.control/v1`, persistent hosting, public SDK and deterministic Fabric conformance; physical receipts remain open | A six-product slot records the current-development seam as `pending_native_adapter`. No provider/binding/process/service/storage/material state is fabricated. |
| Quaternal Logic | `3e9fb929f0c34e8b4474eef59ce512b53082fba1` | QL/Epi programme continues independently | Current `QlService` capability family (`Capabilities`, `Locate`, `Refract`, `Relate`, `Synthesise`) is recognised as an optional provider seam. No O:I QL provider instance is fabricated, and ordinary operation remains unblocked. |

The distinction between accepted `main` and current development is intentional. P5 can describe an open owner contract as current development without treating it as accepted owner state or local runtime evidence.

## 3. Implementation

### Inputs

P5 composes only existing native host/read seams:

- `shell_snapshot` — O:I suite/surface disclosure;
- `contribution_catalog` — owner-native contribution contracts and Action descriptors;
- `aikit_context_resolution` — the exact AIKit-supplied ContextResolution; O:I does not run a second resolver;
- `factory_build_snapshot` — live Factory-owned Build read model when its provider is configured.

No P5 Tauri mutation command was added.

### Presentation model

`desktop/ui/src/system-workbench-model.mjs` builds `oi.system-workbench/v1` as a transient presentation model with exactly six product rows and the seven state axes above. The model is deliberately lossy only in presentation density, not in state semantics:

- Central contribution availability is not treated as authored-source content or machine activation;
- Actuation contract availability is not treated as realised Agency;
- AIKit ContextResolution is EFFECTIVE; its source/provider availability observations remain OBSERVED; a target-owned SessionSpace observation is required before ACTIVE can strengthen;
- Factory execution statuses are reported only from a live Factory Build snapshot;
- Workcell and QL provider gaps remain explicit and non-blocking.

`desktop/ui/src/system-workbench.tsx` renders:

- a six-owner selector;
- a seven-axis state matrix;
- selected-owner state detail;
- native Resource/read-model inventory;
- native Action inventory with owner and required Capability reference;
- explicit deferred/provider gaps and ownership invariants.

The P1 System rail hosts a compact version of the same model. Opening the System Canvas renders the full workbench.

## 4. Action and resource authority

P5 exposes Action/resource identities for inspection but does not create a generic System executor.

Factory Action invocation remains behind the existing native authority bridge. Central Actions remain Central Actions. AIKit Action Resources remain resolved resources whose downstream authority may belong elsewhere. Workcell and QL do not gain synthetic Actions merely because their provider seams are visible.

Credentials remain refs/state owned by AIKit/provider integrations. P5 renders no credential secret value and adds no credential persistence.

## 5. Truthful absence and degradation

The following are real deferred/provider gaps after this tranche:

- no Central whole-System effective/active configuration read model is currently bound to O:I P5;
- Actuation `actuation.realised/v1` is current draft development and is not bound as an accepted live reading;
- AIKit staged composition preview/apply receipts are not currently supplied to the P5 host, so STAGED and EXPECTED EFFECT remain empty rather than inferred;
- Factory live state still requires a configured Factory-owned local provider;
- Workcell has no O:I native control/read adapter in this branch; PR #41 remains current development and physical remote/Fabric/hardware acceptance remains separate evidence;
- QL-MEF has no O:I native provider binding in this branch; formal integration is optional for ordinary System operation.

These gaps do not make the six-product workbench unusable. Partial composition is a first-class state.

## 6. Tests and evidence

P5 adds pure presentation-contract tests for:

1. exactly six product owners and seven distinct state axes;
2. AIKit EFFECTIVE resolution never being promoted to ACTIVE/materialised state;
3. Central Action discovery retaining Central authority and not creating staged source mutation;
4. Factory observed execution state remaining separate from staged preview;
5. Workcell/QL provider gaps remaining truthful and non-blocking.

The Rust fixture acceptance is extended to require truthful six-product slots and to prove Workcell/QL remain `pending_native_adapter` with no fabricated read model or Action.

The Desktop workflow runs the new Node contract test in addition to the existing Rust core/clippy, TypeScript/Vite build, presentation tests, and macOS native-shell check.
