# O:I public site

The public O:I web surface is a React + TypeScript application with a shadcn-compatible component layout and Tailwind CSS.

Its stable public navigation grammar is:

```text
Understand · Explore · Build
```

`index.html` is the front door. `explore.html` is the standalone Explore application surface; Explore is no longer represented by a fixture/demo section inside the front door.

## Development

```bash
cd site
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Vite builds both page entries. Relative asset paths keep the output suitable for GitHub Pages or another static host.

## Front door

The first substantive content after the parallax identity is the canonical six-product field: Central, Actuation, AIKit, Software Factory, Workcell, and Quaternal Logic.

The front door explains O:I and provides a quiet aperture into Explore. It does not carry synthetic Explore worlds or fixture content as product meaning.

## Explore

Explore consumes the repository-level shared-field application/read-model contracts rather than defining browser-only search, identity or relation semantics.

```text
explicit Projection / source-owned object
        ↓
shared-field Explore application seam
        ↓
site/explore-read-model.mjs
        ↓
Explore React Surface
        ├─ search / kind filter
        ├─ semantic-ref selection
        ├─ bounded local whole
        ├─ LIST / TREE / GRAPH presentations
        ├─ provenance inspector
        └─ WorldPresentation renderer / composer
```

The default static provider is `public/data/explore-public.json`. It is intentionally honest: if no public worlds are supplied, Explore renders an empty field rather than substituting demo personalities or arbitrary content. A live hosted/federated provider can replace that seed through the same browser read-model seam.

`explore-read-model.mjs` is tested against the canonical shared-field Explore fixture, but that fixture is test material rather than the public product experience.

## World presentation and native composition

Rich world presentation is a Projection representation, not a new profile/site ontology.

The portable contract lives in:

```text
../shared-field/presentation.mjs
../shared-field/presentation-projection.mjs
../shared-field/presentation-schema-v1.json
```

The governing relation is:

```text
native source object / world
        ↓ explicit Projection
WorldPresentation representation
        ↓ references
Component / ComponentContribution / Surface identities
        ↓ client-local accepted renderer
web Explore | O:I desktop | another Surface
```

A presentation manifest contains layout regions, bindings to native component/contribution/surface refs, declarative props/fallbacks, world-remappable semantic tokens and provenance. It cannot carry executable module URLs. A client resolves only renderers already present in its local accepted registry and falls back when a richer component is unavailable.

The shared-system meta-relation/gold grammar is not world-overridable.

The browser's first portable renderer registry lives at `src/explore/presentation-components.tsx`. It is one Surface implementation of the contract, not the semantic owner of the components it renders.

## Projection authoring

Explore includes a local WorldPresentation composer so a human can develop an initial presentation before a publication provider is connected. Browser-local drafts are explicitly **not** Explore entries, published Projections or source authority.

When a WorldPresentation is published or edited, the shared-field helper `refineWorldPresentationProjection()` uses the existing Projection refinement law:

```text
source revision remains R1
Projection P1 carries WorldPresentation W1
human edits the representation
Projection P2 carries WorldPresentation W2
    source revision remains R1
    editor provenance is retained
    P2 supersedes P1
```

A connected authenticated hosted/self-hosted provider is responsible for actually publishing that revision. The static page does not pretend localStorage is canonical persistence.

## Design system

`src/tokens.css` owns the current site foundation/semantic token layer and remains aligned with the extracted `packages/oi-design-system` package used by the desktop programme.

Explore preserves:

- O:I light/dark foundation and typography/rhythm;
- relation/focus/projection semantic roles;
- scarce gold for shared-system meta-relation rather than ordinary decoration;
- keyboard and visible-focus behaviour;
- responsive and reduced-motion behaviour.

A projected world may remap its permitted semantic presentation tokens without removing the common provenance/navigation grammar.

## Existing fixture proofs

The older Self/Other and object-centred fixture components remain test/support material for their original front-door contract history:

```text
self-other-read-model.mjs
field-proof-read-model.mjs
projection-renderer.mjs
```

They are not the Explore application and are no longer mounted as Explore product content.
