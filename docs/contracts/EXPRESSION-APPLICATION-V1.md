# Expression application v1

**Standing:** EX1 implementation contract for O:I #306. Baseline: `267a688`.
Consumes [product meaning](../cradle/EXPRESSION-FIELD.md), [human/Agent UX](../experience/EXPRESSION-FIELD.md), [execution map](../../.superpowers/sdd/cradle-rebuild/EXPRESSION-FIELD-WAYFINDER-2026-09-14.md), [Cradle architecture](../cradle/02-ARCHITECTURE.md), [composability](../OI-DESKTOP-APPLICATION-SPEC.md#12-composability-is-an-experienced-property), [Action dispatch](../../desktop/cradle/kernel/src/action.rs), and [WorldPresentation](../../shared-field/WORLD-PRESENTATION.md).

## One application meaning

`KernelOp::Expression { request }` is the shared human/Agent application seam.
The native desktop and structured local Agent transport apply requests to the
same kernel. `oi desktop expression` exposes discovery and requests. Renderer
pixels and DOM nodes are never semantic addresses. This service owns only
Expression drafts; native owners retain subjects, Agent identity, Wiki, Nara,
source, readings, relations and authority.

## Addressed document

The wire schema is `oi.expression/v1`. Rust types in
`desktop/cradle/kernel/src/expression.rs` are the executable contract.

| Field | Meaning |
|---|---|
| `expression_ref`, `revision`, `title` | Expression identity and monotonic application revision |
| `scenes[]` | Ordered scene bindings, each with `scene_ref`, `revision`, `title`, and ordered `entity_refs` |
| `entities` | Map by `entity_ref`; each has its revision, title, optional subject binding and permitted presentation parameters |
| `relations` | Presentation bindings with local binding ref, native relation ref/revision, endpoint entity refs and provenance |
| `selection` | Active scene and optional entity; selection is inspection, never native Action invocation |
| `provenance` | Attributed source/reading refs and exact revisions; no copied source body |
| `representations` | Existing live/capture/embed/projection refs with kind, revision, availability and provenance |

Refs are scoped `expression:<id>`, `<expression_ref>:scene:<id>` and
`<expression_ref>:entity:<id>`. The engine adapter uses these stable refs as its
native scene/entity IDs; it does not maintain an independent scene graph.
Reordering does not change identity. Opening preserves identity; a fork is
explicit. Local IDs never become canonical subject or relation refs.

`SubjectBinding` carries `subject_ref`, `native_owner`, `presentation_role`
(`being` or `thing`), `sources[]`, `readings[]`, and disclosed `actions[]`.
Each source/reading is `{ref, revision, availability}`; availability distinguishes
`available`, `unavailable`, `withheld`, and `stale`. These are qualified incoming
readings, never claims that the Expression independently verified native truth.
A binding is not authority. Changing role never changes native identity.

An Action disclosure contains `action_ref`, `target_ref`, and
`authority_requirement`. Invocation must match a currently disclosed Action on
the bound subject. The existing `action::invoke` dispatcher supplies the actual
result unchanged (`invoked`, `owner_refused`, `owner_unavailable`,
`unsupported_action`, `malformed_ref`, `unknown_owner`). A caller's attribution
is not an authentication credential. EX1 creates no grants or Action store.

## Requests and revisions

Read requests: `capabilities`, `list`, `inspect`.
Creation: `create` (new ref), `open` (validated document), explicit `fork`.
Draft edits: `edit { expression_ref, expected_revision, actor, changes[] }`.
The whole edit is atomic. All targets, bounds and references validate before any
change. A stale expected revision returns `revision_conflict` with the current
revision and preserves both the submitted input and existing draft.

Changes: `scene_create`, `scene_reorder`, `scene_compose`, `entity_add`,
`entity_remove`, `subject_bind`, `subject_unbind`, `relation_bind`,
`relation_remove`, `focus`, `parameter_set`, `parameter_automate`,
`parameter_manual`, `representation_bind`. Empty/no-op batches do not advance
revisions. An accepted change emits one attributed `expression_changed` receipt;
only affected scene/entity revisions advance. Continuous simulation emits no
editing receipts and does not impersonate Agent Activity.

Parameters are a bounded, declared material vocabulary. Each state contains its
base scalar and optional structured engine automation (waveform, bounds, rate).
Manual takeover explicitly removes automation. Unsupported parameters fail;
there is no arbitrary JavaScript, unvalidated property path or domain write.
Live owner state remains a session-local adapter input, outside this document.
EX2–EX4 must consume native readings through their owners and cannot serialize
protected state as parameters or Action inputs.

## Persistence and composition

`export` returns exact versioned document data, not a simulation checkpoint or a
public Projection. `open` restores configuration and explicitly reports dynamic
state as not restored. `save` uses Central's existing ordinary-file CAS operation
against a disclosed file location and expected file revision; it does not save
bound native subjects. EX1 supports an existing ordinary Expression file;
creating/adopting authored source remains a separate owner operation. Save failure
preserves the dirty draft and the owner's exact result.

Representation bindings refer to existing `live`, `image`, `video`, `html`,
`embed`, or `projection` representations. Recording a binding does not capture,
embed, publish, upload, admit executable content or grant authority. EX5 supplies
renderer admission/capture/WorldPresentation adapters; EX6 supplies audience
filtering and publication. Capability discovery must name these unsupported
operations until their owners are connected. Local export is private by default;
it must never be sent to SharedField as an audience-filtered Projection.

## Consumer boundary

EX0 owns engine intake, Studio/toolbelt and the Global Expression Stage runtime.
EX1 owns this application request/disclosure contract and shared native kernel.
EX2–EX5 consume the refs, revisions and bindings above without private stores.
A renderer adapter projects the active scene into the accepted engine, preserving
entity IDs. It discloses absence/failure instead of creating a substitute engine.
Human native operations and Agent requests are serialized on the kernel mutex;
changes are observed through the existing kernel event topic.

## Acceptance

Prove fresh structured discovery → create → bind → compose → focus → edit →
export/save → reopen, with exact identity and revisions; stale concurrent edits,
unknown targets, invalid parameter bounds and undisclosed Actions must refuse
without partial mutation. Drive the same edits in the running desktop and observe
them through the structured seam. Test an actual owner refusal and actual file
CAS conflict. Creative/sensory judgement remains human evidence under #65.

## Native entry points and current material floor

On macOS/Linux the desktop serves a mode-0600 Unix socket. Both faces share the
same kernel mutex and ordered events. By default the socket lives in the app data
directory (`~/Library/Application Support/org.epilogos.oi.cradle/expression.sock`
on macOS, `$XDG_DATA_HOME/org.epilogos.oi.cradle/expression.sock` on Linux, falling
back to `~/.local/share`). `OI_EXPRESSION_SOCKET` selects an explicit endpoint for
isolated runs. Windows native Agent transport is unavailable in this increment.
There is no network listener, generic kernel dispatch, code execution or stored
credential in this endpoint.

```sh
oi desktop expression capabilities
oi desktop expression '{"operation":"capabilities"}'
oi desktop expression '{"operation":"create","expression_ref":"expression:lesson","title":"Lesson","actor":"agent:composer"}'
oi desktop expression '{"operation":"inspect","expression_ref":"expression:lesson"}'
```

The first command discloses the implemented contract without claiming a running
resident. The other commands contact the running app; an absent socket fails
explicitly. An optional socket path before the JSON selects another app instance.
All structured calls return `{ok,outcome}` or `{ok:false,error}`. Domain refusals
and revision conflicts are typed inside `outcome.data`, not transport failures.

The initial human entry is **System → Visuals → Compose**. EX0 owns the fuller
Studio/workspace integration. This bounded material adapter exposes glyph,
x/y/z, scale and share on at most ten formations per scene. Numeric LFO automation
uses the accepted engine's own clock. The engine importer/exporter validates the
projection and preserves entity IDs and automation targets across reordering.
Document limits: 64 open Expressions, 64 scenes, 256 entity/relation bindings,
256 changes per atomic edit, 512 KiB per document. This is deliberately bounded
application state, not a query/store for an entire knowledge world.

An explicit focus edit also moves the existing global focus to the bound native
subject (or the Expression when unbound), emitting the existing FocusChanged
event only when that relation changes. It never invokes an Action. Parameter
inputs retain uncommitted human text across incoming Agent revisions; a conflict
requires an explicit choice to use the current value or apply to the new revision.
