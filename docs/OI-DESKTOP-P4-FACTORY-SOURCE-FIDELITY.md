# O:I Desktop P4 — Factory Build Source-Fidelity Receipt

**Issue:** O:I #108  
**Host base:** O:I PR #118 head `8b58880ed99b7619877365319f3f64b12523a496`  
**Factory revision consumed:** `06579aada01a77bd719c0c010a10f91084b4326f`  
**Factory GUI predecessor pin from P0:** `02627a2373ada04369e9d2d338cfd0809f49725c`  
**SSSF visualizer source:** `disler/super-simple-software-factory@de31374882e7a4e3e5b7bb9bd09e69dc2f779356`

## 1. Why this cut exists

`docs/positions/FOUNDING-POSITIONS.md` makes the relevant constitutional distinction explicit: O:I should make the existing technological world intelligible without silently relocating canonical identity or authority into O:I. P4 therefore hosts the Software Factory as an existing native product. It does not redesign Factory around the desktop.

O:I #108 and the P1 host contract refine that position into a concrete product boundary:

```text
Factory owns Build meaning, read models, Actions and mutation semantics.
O:I owns workbench placement, shared selection and visual/application composition.
```

The reason for importing the real Build body is not historical fidelity for its own sake. The SSSF-derived body already contains the dense chronology, lane, span, tool-call and progressive-detail logic by which execution is intelligible. Replacing it with summary cards would remove information that Factory has deliberately made inspectable.

## 2. Live source determination

P0 recorded Factory GUI revision `02627a2373ada04369e9d2d338cfd0809f49725c`. At P4 execution time Factory `main` had advanced to:

```text
06579aada01a77bd719c0c010a10f91084b4326f
```

A direct compare from the P0 pin to that head showed only the unrelated structural-ground test `factory/tests/epi_holographic_structural_ground.rs`. The required GUI, read-model and Build provider files are therefore unchanged across the advance. P4 consumes the actual live head, not the stale prompt-time SHA.

## 3. Source-fidelity classification

The imported subtree at `desktop/ui/src/factory-build/` is split deliberately into owner-source files and O:I host files.

### EXACT OWNER-SOURCE MIRROR

These files are Git-blob-identical to Factory at `06579aada01a77bd719c0c010a10f91084b4326f`:

| O:I mirror | Factory source blob |
|---|---|
| `BuildSurface.tsx` | `466446b355f2a018b96cc033e48c1d43ab33652d` |
| `types.ts` | `b8d95224426b01a80709e7c9c6c4e0ae4e3b8b79` |
| `read-model.ts` | `a9ad81f0ac2be231f4474c0600d00e5179149034` |
| `components/SessionCards.tsx` | `8843228a45f69111d9661f467383d35c8d09f55c` |
| `components/TraceWaterfall.tsx` | `3bbb0adc3174e8f44eb0a9010850f51cff12a0c8` |
| `components/SpanDetail.tsx` | `ea18338042ca6bcf1802b5d338bac3748214995a` |
| `styles.css` | `465871d0885bd953fe84b94c0afc8fc9cf81a9d9` |
| `build-surface.css` | `fe521ef5afb21da236f579e65f5de225df6ade3e` |
| `THIRD_PARTY_NOTICES.md` | `1f6682ef1babe4d3cdfd70283a90bdd6f2e63bc0` |

`workbench-presentation.test.mjs` recomputes Git blob SHA-1 from these files in CI, so a later O:I-only edit cannot silently turn the mirror into a fork.

### O:I HOST ADAPTER

`FactoryBuildHost.tsx` and `factory-build-host.css` are O:I-owned composition code. They do not redefine Factory subjects or Actions. They provide only:

- an O:I provenance strip around the imported body;
- shared-ref Navigator projection for Project, Run, Candidate, Claim, Evidence, Execution and HumanRequest;
- a lower-region projection of the same Factory trajectory read model;
- O:I visual placement around the exact Factory component tree.

### O:I HOST INTEGRATION

`desktop/ui/src/main.tsx` replaces the P1 placeholder summary with `FactoryBuildCanvas`, connects Factory subjects to the existing stable-ref selection boundary, and forwards Build action emissions to the existing P1 native command.

No Factory state store, Factory mutation handler or Action catalog is introduced in the renderer.

## 4. Preserved Action path

The imported Factory `ActionButton` continues to emit exactly:

```ts
{ actionRef, subjectRef }
```

The complete live path remains:

```text
Factory BuildSurface
    │ emits canonical ActionInvocation
    ▼
O:I renderer host
    │ dispatch_contextual_factory_action
    │ { emission: { actionRef, subjectRef }, operationId }
    ▼
O:I native authority boundary
    │ resolves + consumes an already-issued bounded grant
    ▼
LocalFactoryHost::dispatch
    ▼
FactoryBuildFileProvider::execute_action
    ▼
FactoryActionExecutor
    ▼
Factory-owned persisted state
    ▼
new FactoryBuildSnapshot + native receipt
```

The renderer cannot submit `authorityRef`, Capability grants, owner facts or Factory mutation parameters. Discovery therefore remains distinct from authority, and O:I does not become the semantic handler.

## 5. Three-depth acceptance

### Semantic

The exact Factory body remains the primary Canvas orientation and exposes Project, Run, frontier, Candidates, Claims/Evidence references, HumanRequests and legal Run/Candidate Actions. The O:I Navigator projects stable refs from the same `FactoryBuildSnapshot` into shared selection; the sidecar therefore co-refers to the selected native subject rather than keeping a second Factory selection state.

### Live

The exact Factory body exposes Agency/Agent/RootScope/Metagency grant references, Actuation/Return references, Executions, Harness/effective body, AgentSession, SessionSpace, alternate Surface refs and Workcell bindings. Missing richer body or SessionSpace material is rendered as missing; it is not synthesized by O:I.

### Trajectory

The exact SSSF-derived `SessionCards`, `TraceWaterfall`, `SpanDetail` and `read-model.ts` are retained. The same trajectory can also occupy the P1 lower/deep region while Build is active. Tool arguments/results/errors/durations, model/process/native-reference material and the source-faithful waterfall geometry remain available at depth.

The pinned SSSF source itself does not emit a `process` event type. Factory correctly renders process material only when a richer native trajectory supplies it; P4 preserves that honesty.

## 6. Current owner gaps kept visible

P4 does not fill these gaps in O:I because doing so would fork owner semantics:

1. **Factory package/distribution seam.** `factory-ui` is currently a private subdirectory package, not a separately consumable published package. P4 therefore uses an exact pinned source mirror with mechanical blob-fidelity tests. A later Factory-owned package/export seam can replace the mirror without changing the host contract.
2. **Candidate artifact/preview richness.** `FactoryBuildView` carries `artifactRefs` and `previewRef`, but the current Factory `BuildSurface.tsx` does not yet render those fields as first-class Candidate controls. O:I does not add a parallel Candidate UI to compensate.
3. **Evidence detail in the semantic body.** the read model carries `EvidenceView` labels/assessments/producing execution refs, while the current Factory body foregrounds Claim-to-Evidence refs rather than an independent Evidence detail panel. The shared O:I Navigator may select the native Evidence ref, but Factory remains owner of richer Build presentation semantics.
4. **Preview activation.** P1 can host declared native Surfaces and AIKit SessionSpace bodies, but the current Factory `previewRef` is only a ref in the Build read model. P4 does not guess a browser/service activation contract from that ref.
5. **Broader Factory transport parity.** CLI/MCP/A2A/headless projection work remains native-owner work and is not a blocker for this GUI import. The existing O:I Search/Command projection remains a real representative headless/native Action route over the same Factory ActionRefs.

## 7. Acceptance evidence

CI is expected to exercise:

```text
cargo test --manifest-path desktop/core/Cargo.toml --all-targets
cargo clippy --manifest-path desktop/core/Cargo.toml --all-targets -- -D warnings
npm ci --prefix desktop/ui
npm --prefix desktop/ui run build
node --test desktop/ui/src/workbench-presentation.test.mjs
cargo check --manifest-path desktop/src-tauri/Cargo.toml --locked --target aarch64-apple-darwin
```

The P4 presentation test additionally proves:

- exact Factory source blob parity;
- preservation of semantic/live/trajectory structures;
- exact `{ actionRef, subjectRef }` emission;
- reuse of `dispatch_contextual_factory_action` with no renderer authority injection;
- absence of Factory provider/executor/state semantics from the O:I host adapter;
- shared selection over Factory-owned refs rather than an O:I Factory ontology.
