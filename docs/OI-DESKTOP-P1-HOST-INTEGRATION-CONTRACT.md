# O:I Desktop P1 — Stable Host / Search / Command Integration Contract

**Issue:** O:I #105  
**Status:** P1 implementation contract for parallel P2–P6 consumption  
**Branch:** `agent/oi-desktop-p1-host-105`  
**Scope:** host/region/presentation mechanics, shared stable selection/focus, native Search/Command aggregation  
**Not scope:** #106–#110 product application bodies

## 1. Returned reality consumed

P1 is implemented on the inherited desktop application substrate rather than rebuilding it.

- O:I current main at implementation start: `fcf603839d094799317a3de09e812e7eec34e212`.
- P0 / workbench substrate: PR #99 head `dd862fad5bfc51532b4974039bf646612be1f494`.
- Desktop design authority: PR #102 current head observed at implementation start `656153dd51797577eec46397729c9bc9d93f6919`.
- P0 reconciliation / Surface Ledger authority: PR #113 head `9866f353449c2960b14aad42f72ac20fae97959a`.
- AIKit accepted application/resource substrate pinned by #99: `42127820d6e5bf4ea5ee248e88e305e14c5c1a7c`.

P1 is branched directly from the #99 head because #99 owns the inherited SessionSpace application, AgentSession conversation, Knowledge application, stable semantic selection and privileged Action boundary required by this tranche. Main and #99 are presently divergent in Git ancestry even though the two current main commits contain no relevant file delta against the #99 worktree; final convergence therefore remains a merge/rebase responsibility rather than justification to reconstruct #99.

## 2. Stable host contract

The desktop host now exposes five stable regions:

```text
Navigator
Primary Canvas
Agency Sidecar / Inspector
Lower / Deep
System
```

and one persistent Status/context bar.

The Primary Canvas owns only presentation mechanics:

```text
editor group
  -> tab / Surface presentation binding
  -> active presentation

workbench
  -> one group or two split groups
  -> horizontal | vertical | single layout
```

A `SurfacePresentationBinding` contains provider-local presentation identity plus the referenced Surface/subject refs required to restore presentation. It is not canonical product state.

The host persists only:

- region collapsed/open state;
- region dimensions;
- editor-group/split arrangement;
- open/pinned/closed presentation bindings;
- focused group and host region.

It does **not** persist SessionSpace, Project, AgentSession, Knowledge, ContextResolution, Action authority, product business state or a replacement semantic resource registry.

If a persisted Surface binding can no longer be supplied, the host renders it as stale/unavailable. It does not reconstruct a missing native Surface or semantic subject from remembered presentation state.

## 3. Keyboard / mouse interaction grammar

The host exposes keyboard-complete presentation navigation:

- `Cmd/Ctrl-K` — Command.
- `Cmd/Ctrl-P` — Search.
- `Alt-1..5` — focus Navigator / Canvas / Agency Sidecar / Lower / System.
- `Ctrl-Tab` / `Ctrl-Shift-Tab` — next / previous tab.
- `Cmd/Ctrl-W` — close active presentation.
- `Cmd/Ctrl-Shift-T` — reopen most recently closed presentation.
- `Cmd/Ctrl-\\` — duplicate the active Surface into a horizontal split.
- `Cmd/Ctrl-Shift-\\` — duplicate the active Surface into a vertical split.
- `Cmd/Ctrl-B` — toggle Navigator.
- `Cmd/Ctrl-J` — toggle Lower / Deep.
- `Cmd/Ctrl-.` — toggle Agency Sidecar.

Mouse interactions use the same focus/open/activation functions as keyboard operations. Region resizing is pointer-driven presentation state only.

## 4. Shared selection and Surface focus

The host maintains two deliberately distinct relations:

```text
Surface focus
    = which host presentation currently receives user interaction

semantic selection
    = stable native subject ref selected through the privileged O:I shell boundary
```

Neither relation is Agent Context disclosure.

A selected subject remains:

```text
ref
kind
native_owner
provenance
```

and is handed back through the existing `select_semantic_ref` bridge. The host does not dereference it into a second Context store. AIKit/native application services decide what may be read and what may enter an Agent Context.

## 5. Native Search / Command binding

Search and Command are one presentation aggregator over native application descriptors.

The current P1 sources are:

```text
AIKit ContextResolution snapshot
AIKit SessionSpace application
AIKit Knowledge search
O:I hosted native contribution readings
canonical contribution ActionRefs
FactoryBuildView reading + canonical Factory Actions
```

The host does not create an O:I Action catalog. It deduplicates and ranks the current descriptors for interaction while retaining their native ref, owner, subject relation, availability/provenance and Capability requirement where present.

### ContextResolution

A native integration may supply `OI_AIKIT_CONTEXT_RESOLUTION=<path>` containing an AIKit `aikit.context-resolution/v2` payload. O:I deserialises that payload as the pinned AIKit `ContextResolution` type and rejects any other version. It does not call `compose_context_resolution` or `application_context_resolution` and therefore does not become a second resolver.

Absence of the native snapshot is represented as absence; the palette continues to consume whatever other native application providers are actually available.

### Readings

A Search result can select a native Resource/Reading by stable ref. Selection does not imply retrieval or Context disclosure.

### Actions

Command displays canonical ActionRefs and contextual subject bindings when the native descriptor proves applicability.

```text
Action discoverable
    != Action authorised
```

For the currently integrated Factory dispatcher, the palette calls `dispatch_contextual_factory_action` with only:

```text
ActionRef
subject ref
operation id
```

It cannot provide an authority handle. The native host must already contain exactly one bounded grant matching:

```text
ActionRef
native owner
subject ref
binding revision
required CapabilityRef
```

No match fails. More than one match fails. A revoked/expired/exhausted/wrong-Capability grant fails in the existing consumption path. A successful request reaches the same `LocalFactoryHost::dispatch` / Factory-owned Action executor used by the explicit-authority projection.

Thus keyboard Enter and mouse click are two presentation routes to one canonical Action/handler lineage.

## 6. Contract for #106–#110

Each parallel tranche may now depend on the following host interfaces without redefining them.

### #106 — Project / Ground / Knowledge editor field

May populate Navigator and Canvas using native refs/readings and may open/pin/split its Surfaces through `HostSurfaceDescriptor` + `SurfacePresentationBinding`. It must not replace the host selection contract or persist semantic Project/Knowledge state in the layout store.

### #107 — Root Agency / Cradle

May occupy the Agency Sidecar and open alternate AgentSession Surfaces. It consumes the existing #99 AgentSession/AIKit protocol. It must not introduce DesktopChat, transport-local Agent identity, or infer Agent Context disclosure from selection/visibility.

### #108 — Factory Build

May replace the P1 host placeholder with the source-faithful Factory GUI and contribute richer native Surface descriptors. It consumes the current FactoryBuildView / ActionRefs and the common Action dispatcher. It must not add UI-local build business handlers.

### #109 — System

May populate the System region with six-product configuration/composition/application-service bodies. It consumes native application state and current ContextResolution. It must not create a desktop configuration truth store or global Action catalog.

### #110 — Explore parity

May populate the Explore Canvas/side regions using the existing WorldPresentation / shared-field application contracts. A projected/native `SurfaceRef` remains distinct from provider-local tab binding identity and SpaceTimeDB/transport IDs.

## 7. Invariants for every parallel tranche

```text
UI selection != Agent Context disclosure
Action discoverable != authorised
Surface != Action
UI control != ActionRef
presentation binding != canonical Surface identity
layout persistence != semantic state persistence
provider/native transport identity != semantic identity
```

A product body may add a native Reading, Action or Surface descriptor. It must not move the meaning or handler into P1 merely to fit the host.

## 8. Convergence exception

P1 is intentionally based on open PR #99 rather than current `main` because the requested host contract consumes #99's not-yet-merged application substrate. PR #102 and PR #113 are also open authority lines. This is a programme-level stacked/convergence condition, not a semantic exception to P1.

Consequently:

- #106–#110 should branch from / merge the accepted P1 head (or its merged successor), not reimplement P1 against old `main`.
- final desktop convergence still reconciles #99/#102/#113/P1 through the designated integration line before mainline closure;
- no P1 code claims that #99/#102/#113 have already merged merely because their contracts are consumed.

## 9. Gate statement

Once the P1 implementation PR is green, #106, #107, #108, #109 and #110 may proceed in parallel against this contract. They should treat P1 as the stable host/region/selection/Search/Command substrate and keep their product-specific semantics in their native owners.
