# O:I public site

The public O:I web surface is a React + TypeScript application with a shadcn-compatible component layout and Tailwind CSS.

The front door is no longer a one-page document. The public navigation is:

```text
O:I · Products · Shared Field · Research · Build · Explore
```

The public entries are:

```text
index.html          landing / front door
oi.html             whole-level O:I account
products.html       six native product centres
shared-field.html   projection, encounter and Objective Co-Internality
research.html       Quaternal Logic / MEF and formal-research framing
build.html          source, governing documents and development entry
explore.html        standalone Explore application
```

Explore remains a distinct application surface and is not authored by the public prose document below.

## Human-editable public content

The public words and page/section order live in one companion source:

```text
content/public-site.md
```

This is the first place to edit site copy.

The relation is deliberately small:

```text
content/public-site.md
        │
        │ headings + prose + links
        ▼
src/lib/public-content.ts
        │ validated content outline
        ▼
React page / figure components
        │
        ▼
index + O:I + Products + Shared Field + Research + Build
```

The Markdown is also the readable content specification. Stable IDs in square brackets are renderer handles, not public text:

```md
# [products] Products

## [central] Central

### [summary] Files, commands and connectors for ...

### [what] What it is

Editable prose here.
```

Keep the stable `[id]` when editing a heading; the words after it are ordinary public copy and can be changed directly. The supported authoring grammar is intentionally narrow: `#` pages, `##` sections, `###` / `####` structured content, paragraphs, emphasis, inline code, links and bullet lists.

React owns layout, figures, navigation behaviour and interactive surfaces. It should not become a second store of ordinary public prose. `src/lib/public-content.ts` validates the required pages and product fields during the TypeScript/Vite build, and `public-content.test.mjs` keeps the file/page contract explicit in CI.

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

Vite emits all seven page entries. Relative asset paths keep the output suitable for GitHub Pages or another static host.

## Front door

`index.html` is deliberately a landing page rather than the complete public essay. It keeps the parallax identity, the top-level account of the world around the model, the non-displacement statement, the minimal-to-developed possibility field, concise entrances to the six products, and apertures into Shared Field and Build.

The deeper authored material remains present but now has room on the O:I, Products, Shared Field and Research pages.

The visible hero title is **Objective : Internality**. Title/heading uses of the name follow the colon form while prose may still discuss the concept of Objective Internality normally.

## Products

The six detailed product descriptions are projected from `content/public-site.md`. `src/components/centres.tsx` owns their differentiated figures and layout only.

The product writing order is:

```text
concrete software responsibility
        ↓
why that responsibility exists
        ↓
what changes for a human or agent
        ↓
current product shape / native source
```

This keeps the native product meaning available without requiring first-contact readers to decode the internal abstraction before they know what the software does.

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
        └─ WorldPresentation renderer / authoring surface
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

The browser's portable renderer registry lives at `src/explore/presentation-components.tsx`. It is one Surface implementation of the contract, not the semantic owner of the components it renders.

## Projection authoring

Explore's direct authoring surface operates over the same WorldPresentation representation it renders. Browser-local working state is explicitly **not** a published Projection or source authority.

When a WorldPresentation is ratified, the shared-field helper `refineWorldPresentationProjection()` uses the existing Projection refinement law:

```text
source revision remains R1
Projection P1 carries WorldPresentation W1
human edits the representation
Projection P2 carries WorldPresentation W2
    source revision remains R1
    editor provenance is retained
    P2 supersedes P1
```

A connected authenticated hosted/self-hosted provider is responsible for actually publishing that revision. Browser persistence does not become canonical state merely because it is convenient.

## Design system

`src/tokens.css` owns the current site foundation/semantic token layer and remains aligned with the extracted `packages/oi-design-system` package used by the desktop programme.

The public pages and Explore preserve:

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

They are not the Explore application and are not mounted as public front-door content.
