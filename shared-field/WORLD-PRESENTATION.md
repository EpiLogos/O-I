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

This allows richer components to exist through O:I package/AIKit Surface contribution machinery without giving remote page content ambient browser, desktop or session authority.

## Theme law

Worlds may remap ordinary semantic presentation roles such as surface, foreground, muted text, relation, focus, projection, human and agent roles.

The shared-system meta-relation/gold role is intentionally not remappable by WorldPresentation. It remains available to the host Surface for common provenance, active relation and deliberate projection grammar.

## Direct page authoring

`presentation-authoring.mjs` is an application operation layer over the existing WorldPresentation. It is not a second page model.

```text
READ
  ↓ enter AUTHOR
same rendered WorldPresentation
  ↓ direct selection / inline edit / insertion / movement
working representation
  ↓ PREVIEW
same page without authoring chrome
  ↓ authorised refinement
Projection Pn+1 / WorldPresentation Wn+1
```

The supported semantic mutations operate on the current regions/bindings/theme:

```text
edit binding props
insert compatible contribution
move / duplicate / remove binding
replace contribution
move / edit region
edit permitted semantic theme roles
```

Pointer or keyboard gestures are only ways to request these operations. They do not become persisted x/y coordinates, a universal canvas ontology or another layout DSL.

The browser's accepted portable renderer registry lives in `site/src/explore/presentation-components.tsx`. In AUTHOR mode compatible text is editable in place, rendered bindings/regions are directly selectable, insertion affordances appear between existing authored elements, and contextual tools act through the operations above.

The older manifest/composer Surface may remain as fallback/debugging tooling. It is not the primary authoring relation.

## Resolved contribution field

Insertion and replacement consume a supplied effective contribution field:

```text
ComponentContributionRef
ComponentRef
SurfaceRef
portable renderer compatibility
availability / degradation reason
canonical ActionRefs
provenance
```

This is intentionally downstream of AIKit composition resolution. The browser or desktop does not recreate `Contract`, `ComponentRequirement`, `Provider`, `HarnessComposition`, `ResolutionScope`, `ActivationScope` or lifetime resolution.

An already-bound native contribution retains the same Component/Contribution/Surface identity when re-used in a WorldPresentation. An unavailable contribution may remain visible with its degraded reason but cannot be silently activated by the editor.

## Canonical Actions remain canonical

`action_refs` disclosed by a native contribution remain references to owner/application Actions. The authoring inspector can disclose them, but does not install a React/Tauri handler or convert them into editor gestures.

```text
presentation binding
    ↓ discloses
canonical ActionRef
    ↓ if invoked by an authorised host
native owner/application dispatcher
```

Selection, panel resizing, inspector opening and draft-local movement remain presentation/application interactions rather than acquiring Action identity merely because they are interactive.

## Agent-native authoring disclosure

`authoringDisclosure()` exposes the same application meaning without DOM inspection:

```text
world_ref
presentation_ref + revision
projection_ref
source_ref + source_revision
selected region / binding
Component / Contribution / Surface / subject refs
binding provenance
contribution availability + degradation
canonical ActionRefs
available authoring operations
source-return owner/Actions where supplied
working-state dirty/read/author/preview status
```

Human and agent Surfaces therefore differ in presentation rather than semantic state. AIKit first-party operation/Wayfinder, Knowledge Navigation, Component/Surface authoring and verification Skills can reason over stable refs/application operations rather than an Explore-specific hidden prompt corpus.

## Projection revisions and editing

`presentation-projection.mjs` binds the representation to existing Projection revision semantics.

```text
canonical source revision R1
        ↓
Projection P1 / WorldPresentation W1
        ↓ human/agent presentation refinement
working representation (still W1)
        ↓ ratification
Projection P2 / WorldPresentation W2
        │
        ├─ source revision still R1
        ├─ editor provenance retained
        └─ supersedes P1
```

`refineWorldPresentationProjection()` delegates to the existing `refineProjection()` operation. At ratification it advances a working presentation which still carries the published revision to the next WorldPresentation revision. It rejects presentation identity changes and backwards revision movement. It cannot silently rewrite source system/revision or change the world subject.

The browser only enables this path when its provider supplies attributable Projection-authoring authority (`publisher_participant_ref` plus `human-refinement` provenance). It does not manufacture an authenticated participant merely because the user can gesture in the page.

Publication remains a provider/transport operation beyond formation of the next canonical Projection value.

## Working state is not public state

The web Surface can persist explicit working state locally so an author can leave and return to an in-progress presentation revision.

```text
working state ≠ Projection
localStorage ≠ source authority
READ = canonical projected presentation
AUTHOR/PREVIEW = current working representation when present
preview ≠ publication
```

Saved working state is keyed to the exact presentation revision. A later canonical revision does not silently inherit an older browser draft.

## Source return is a separate owner operation

Presentation editing and Projection refinement do not mutate native source.

Where a native owner supplies an explicit return path, `authoringDisclosure()` can expose that owner and its canonical ActionRefs. For example Central's current authored-source discipline is proposal/review/accepted apply; Explore does not reproduce that mutation mechanism.

```text
presentation refinement
        ≠
source-return proposal / owner Action
        ≠
accepted native source mutation
```

If no native source-return operation is disclosed, the authoring Surface reports it unavailable rather than guessing a write path.

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

READ mode lets the entered world's authored presentation dominate. LIST/TREE/GRAPH remain recoverable relation readings; they need not permanently surround every page.

## Web / desktop convergence

`desktop/ui/src/explore-presentation.mjs` consumes the same `oi.world-presentation/v1` and `oi.presentation-authoring/v1` application reading as web Explore.

The desktop adapter preserves presentation/binding/component/contribution/surface/Action refs. If no live WorldPresentation instance or renderer is bound, it reports explicit degradation rather than inventing another desktop page/plugin identity.

This proves the authoring model is Surface-neutral while leaving the richer local Central/AIKit authority horizon to the desktop provider layer.

## Current portable renderers

The current baseline renderers are deliberately declarative:

- heading;
- text;
- collection;
- wiki reading;
- external link;
- fallback for unavailable components.

They are a conformance implementation of WorldPresentation, not the final component catalogue.
