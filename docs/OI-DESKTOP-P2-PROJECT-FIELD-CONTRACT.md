# O:I Desktop P2 — Project Field Contract

**Issue:** #106
**Host dependency:** #105 / `agent/oi-desktop-p1-host-105`
**Purpose:** compose Projects, native source, human-authored Ground, Agent Wiki / Knowledge, ProjectMap reflection, and useful NOW/DAY material inside the stable O:I Navigator + Canvas without creating a desktop-owned Project or knowledge system.

## 1. Owner references consumed

### O:I

- #104 / PR #113 — accepted owner/acceptance/practical ledger.
- #105 current host branch — five-region host, stable semantic selection, `HostSurfaceDescriptor` / `SurfacePresentationBinding`, Canvas contract.
- PR #99/current successor — native SessionSpace / AgentSession / Knowledge workbench; `ProjectCentral -> SemanticWikiIndex -> KnowledgeApplication`; Search, LIST, TREE, GRAPH, Reading, Explain, History.

### Central

- accepted main: `a332b26eb08b95581533fc5053a2d16a22cf1f69`.
  - accepted Work Project Actions include `work.list`, `work.search`, `work.open`, `work.reveal`.
  - structured owner invocation remains `ctrl --json action run <ActionRef> <JSON>`.
- Ground owner draft #73: `7865ddba7d4eb91a276f8a248f4e7a93d5c7282f`.
  - explicit source provenance / truth standing / recognition.
  - path and filename are not authorship evidence.
  - native sources remain in place.
  - Ground application is a human-authority boundary.
- NOW/DAY owner draft #75: `ab354c1278396b0d50620bf8a43c40eedc26b907`.
  - NOW is current temporal material; DAY is dated derived closure.
  - neither is human Ground nor Agent Wiki canon merely by existing.
- governance owner draft #80: `9068b1452a270124a75039a9328a8e1e664d0e25`.
  - governance source is human-authored/adopted source.
  - AIKit, not Central or O:I presentation, owns operational composition/precedence.

Draft owner lines are consumed as contracts and surfaced only when the configured native Central build advertises the corresponding Actions. O:I does not silently promote draft actions into an accepted Central main.

### AIKit

- accepted main / merged #115: `5308405e447b4a48e57fa2cfb2c5e6ef276ae343`.
- `ProjectCentralFilesystemBinding` — reads Central project/source relations and keeps Project identity in the owner system.
- `ContextSourceIndex` — descriptor-only horizon/search, explicit provider retrieval, explicit disclosure state.
- `SemanticWikiIndex` + `KnowledgeApplication` — native Wiki/Knowledge search, relation views, readings, explanations and history.
- `ProjectMap` / `project_reflection` — bounded meaning/code/verification reflection over the accepted multi-lens ProjectMap without creating a second graph.
- `discover_local_sources` — bounded discovery/classification of existing native source; filenames/content hints can nominate candidates but cannot establish authorship/authority.

## 2. Composition

### Navigator

The #105 Navigator hosts one P2 Project field with these distinct groups:

1. current canonical Project reference from AIKit/Central binding;
2. Central Work Projects from the native `work.list` Action when the configured Central owner is available;
3. explicitly recognised human Ground sources;
4. Agent Wiki sources;
5. other Project source/context-source descriptors;
6. NOW/DAY availability as a temporal owner reading.

Selection always emits the #105 stable semantic subject shape. P2 never mints a desktop Project identity or substitutes a presentation/tab identity for the selected `ResourceRef`.

### Canvas

The Canvas provides related views rather than separate stores:

- **Source** — descriptor search/filter, source provenance/standing, explicit read/explain.
- **Ground** — explicitly recognised human-authored/adopted source relations and Central Ground owner availability.
- **Knowledge** — orientation into the already-native AIKit Knowledge workbench below it.
- **ProjectMap** — bounded AIKit `project_reflection` for a selected native source/resource when an AIKit ProjectMap artifact has been explicitly bound.
- **NOW / DAY** — Central temporal owner reading when available.

The inherited #105/PR #99 Workbench body is preserved as the native SessionSpace/Knowledge implementation. P2 composes around it rather than cloning it.

## 3. Source and editing authority

The P2 desktop surface is deliberately read/inspect-first.

- Project/source identity and Ground relations are Central/AIKit-owned.
- Agent Wiki state is AIKit/SemanticWiki-owner state, not O:I state.
- O:I does not write files through ambient Tauri filesystem calls.
- Central `work.open` / `work.reveal` remain the owner-native open/reveal Actions; P2 does not replace them with path-based desktop logic.
- Ground mutation is not proxied by P2. A `human-accepted` Ground operation must cross the Central owner boundary rather than being inferred from a desktop click.
- Agent Wiki edit/mutation remains whatever native AIKit/SemanticWiki owner service is accepted; P2 does not introduce a second Wiki mutation path.

## 4. Knowledge and graph integration

There is no `DesktopWiki` and no desktop graph database.

AIKit remains the Knowledge application owner:

```text
ProjectCentral
    -> SemanticWikiIndex
    -> KnowledgeApplication
    -> LIST / TREE / GRAPH / Reading / Explain / History
```

For a selected ContextSource, P2 extends the same native Knowledge bridge:

- `knowledge_read` dispatches to AIKit ContextSource provider retrieval with `RetrievalTarget::Human`;
- `knowledge_explain` dispatches to AIKit ContextSource explanation;
- `knowledge_relations` dispatches to accepted AIKit `project_reflection` when the selected ref is a Project ContextSource, otherwise it remains the existing SemanticWiki relation view.

An AIKit ProjectMap is consumed as an explicitly bound owner artifact (`OI_AIKIT_PROJECT_MAP`). O:I does not rebuild, copy or persist its graph.

## 5. Disclosure law

The UI and core preserve four separate states:

```text
known to exist
!= selected
!= retrieved
!= disclosed into Agent Context
```

More exactly:

- AIKit `ContextSourceIndex` search/horizon is descriptor-only.
- #105 semantic selection changes O:I host selection only.
- explicit `Read source` invokes provider retrieval with Human target and may mark AIKit's ContextSource entry retrieved.
- no P2 selection or Human read mutates AIKit `ContextResolution`, creates a Projection, or injects payload into an Agent Context.

This distinction is architectural rather than cosmetic: a broad Project information horizon is useful precisely because addressability does not imply indiscriminate prompt disclosure.

## 6. Current native owner gaps

These are kept as absences rather than reimplemented in O:I:

1. Central Ground #73, NOW/DAY #75 and governance #80 are still draft owner lines relative to accepted Central main. Their richer readings appear only when the configured `ctrl` build advertises them.
2. Central's current Ground Action contract can require `acceptance=human-accepted`, but the current owner action layer itself does not provide cryptographic proof that an arbitrary caller is human. P2 therefore does not proxy the mutation boundary.
3. The accepted AIKit ProjectMap/reflection implementation is present, but no already-accepted O:I host-facing ProjectMap materialisation service was found. P2 therefore consumes an explicitly supplied AIKit ProjectMap artifact rather than inventing a graph loader/store.
4. Native edit/open/reveal operations remain owner Actions. A future generic owner-Action projection through #105 Search/Command may expose them uniformly; P2 does not create an ad-hoc filesystem/action bypass to close that ergonomic gap.

## 7. Acceptance evidence

- desktop core `cargo test --all-targets` and `cargo clippy --all-targets -D warnings`;
- native shell `cargo check --locked`;
- existing P1 workbench presentation acceptance retained against the preserved native body;
- P2 presentation tests assert source-class separation, selection/retrieval/disclosure separation, absence of desktop mutation authority, bounded ProjectMap reflection, and Navigator/Canvas composition.
