# O:I WorldPresentation

`WorldPresentation` is the portable composition representation used when an explicitly projected O:I world owns more than a sparse title/list view.

It belongs to the Explore/Projection programme in #18. It does **not** create a new profile/site ontology and does not replace AIKit's `Component`, `ComponentContribution` or `Surface` semantics.

## Governing relation

```text
native source world / objects
        ↓ explicit oi.projection/v1
WorldPresentation representation
        ↓ composition bindings
ComponentRef / ComponentContributionRef / SurfaceRef
        ↓ accepted local renderer
web Explore | O:I desktop | another Surface
```

The Projection remains the public/shared representation envelope. The native source retains canonical ownership.

## Contract

The executable contract is `presentation.mjs`; the language-neutral compatibility surface is `presentation-schema-v1.json`.

```text
WorldPresentation {
    presentation_ref
    world_ref
    revision
    title
    summary?
    theme {
        semantic token remapping
    }
    regions[] {
        region_ref
        role
        label?
        bindings[] {
            binding_ref
            component_ref
            contribution_ref?
            surface_ref?
            projection_ref?
            subject_ref?
            portable_renderer?
            props
            fallback
            provenance
        }
    }
    provenance
}
```

A binding points at the native compositional identities that make the presentation possible. `binding_ref` is only the identity of that placement/binding inside this presentation; it is not the Component identity.

`portable_renderer` is a declarative compatibility hint. It is not a remote module URL or executable authority.

## Safe component rule

A WorldPresentation never instructs a client to execute arbitrary code.

The manifest may say:

```text
component_ref = component:owner:project-map
portable_renderer = oi.presentation/collection/v1
```

A client then decides whether it has an accepted renderer for that key. If it does not, it renders the supplied fallback or another safe representation.

```text
manifest names possibility
client owns executable renderer availability
security/policy owns admission
```

This allows richer components to exist through O:I package/AIKit Surface contribution machinery later without giving remote page content ambient browser, desktop or session authority.

## Theme law

Worlds may remap ordinary semantic presentation roles such as surface, foreground, muted text, relation, focus, projection, human and agent roles.

The shared-system meta-relation/gold role is intentionally not remappable by WorldPresentation. It remains available to the host Surface for common provenance, active relation and deliberate projection grammar.

## Projection revisions and editing

`presentation-projection.mjs` binds the representation to existing Projection revision semantics.

```text
canonical source revision R1
        ↓
Projection P1 / WorldPresentation W1
        ↓ human representation refinement
Projection P2 / WorldPresentation W2
        │
        ├─ source revision still R1
        ├─ editor provenance retained
        └─ supersedes P1
```

`refineWorldPresentationProjection()` delegates to the existing `refineProjection()` operation. It cannot silently rewrite source system/revision or change the world subject.

This is the contract the web editor, O:I desktop and agent-facing authoring Surfaces should share.

## Relation to Explore

Explore continues to use the existing search-leaf → bounded-local-whole application seam. WorldPresentation is an authored presentation of a world/object field, not a replacement for Explore's relation state.

```text
SEARCH
  ↓
addressable leaf
  ↓ OPEN / RECENTER
bounded typed local whole
  ↓ optionally
WorldPresentation / LIST / TREE / GRAPH / other Surface projection
```

Rendering several relation kinds together does not transfer their ownership. `WikiEdge`, O:I Projection relations, Contributions and learned KnowledgeRoutes remain semantically distinct.

## First web implementation

The browser's accepted portable renderer registry lives in `site/src/explore/presentation-components.tsx`.

The current baseline renderers are deliberately declarative:

- heading;
- text;
- collection;
- wiki reading;
- external link;
- fallback for unavailable components.

They are a conformance implementation of WorldPresentation, not the final component catalogue.

## Authoring draft

The standalone Explore page includes a local composition draft Surface. Browser-local persistence exists only to support creative iteration before a publisher is connected.

```text
local draft ≠ Projection
localStorage ≠ source authority
preview ≠ publication
```

Publishing must pass through an authenticated Projection provider and produce the canonical revision/provenance relation above.
