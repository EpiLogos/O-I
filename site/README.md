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
products.html       six native products + current architecture views
shared-field.html   World, Projection, SharedField and Objective Co-Internality
research.html       agentic-engineering research field + protocol + collective extension + QL entry
build.html          installation, source, SDK/extension direction and development entry
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

### [summary] Your personal and project world ...

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

## Public-language rule

The public site begins by naming the thing positively and concretely. Distinction-preserving constitutional language still belongs in the source documents, but first contact should not make the reader decode a chain of negations before they know what the product is.

Use the specific technical noun when it matters: underlying model capacity, Agent, Agency, harness/runtime, World, Project, Action, Workcell, Projection. Avoid using `a model` as a generic stand-in for all of them.

Programme statements should also preserve research status. O:I is building an open platform in which proposed agency structures can be tested; public copy should not present development propositions as already-proven behavioural conclusions.

`docs/positions/FOUNDING-POSITIONS.md` is the upstream authored source for this public framing. The site tests now check several load-bearing public claims against that file directly.

## Front door

`index.html` is deliberately a landing page rather than the complete public essay. It keeps the parallax identity, a plain account of an agent acting through a technological world, the existing-world entry, the minimal-to-developed possibility field, concise entrances to our six products, and apertures into Shared Field and Build.

The deeper authored material remains present but has room on the O:I, Products, Shared Field and Research pages.

The visible hero title is **Objective : Internality**. Title/heading uses of the name follow the colon form while prose may still discuss the concept of Objective Internality normally.

## Products

The six detailed product descriptions are projected from `content/public-site.md`. `src/components/centres.tsx` owns their architecture figures and page composition.

The dedicated Products page is an inspectable architecture layer rather than six large marketing cards. It begins with the accepted O:I/native ownership seam and then shows each product through current native technical nouns:

```text
Central           Control · Work · ctrl · Actions · connectors
Actuation         Agent · Agency · WorldBinding · Actuation · Return
AIKit             models · Skills · Actions · ContextSources · HarnessComposition · Surfaces
Software Factory  Project · Commission · Run / RunMap · Candidate · Evidence · Recognition · Return
Workcell          Demand · Plan · provider · BindingGraph · material resources · lifecycle
Quaternal Logic   QL refs/operators · MEF registry · refraction · readings · experiment · Return
```

The architecture drawings are React-owned because they are visual composition. Their product meaning should remain traceable to the native architecture/documentation corpus rather than becoming a site-only ontology.

The extension framing is equally important. The product abstraction is the durable root; a native SDK, provider, connector, Component or other public contract is an accommodation surface through which a real technology can participate in that relation. Reference implementations demonstrate known paths. The public site may describe this as programme intent even where a particular native SDK is still in development, but present-tense implementation claims must remain grounded in the owning product repository.

## Research

Research is the O:I agentic-engineering programme, not a synonym for Quaternal Logic.

The public page begins from the research object — the technological world around available model capacity — and the capacity / provisioning / potentiation distinction. It then exposes the canonical research cycle:

```text
Discover
  → Source-lock
  → Study
  → Interpret
  → Abstract
  → Compare
  → Operationalise
  → Experiment
  → Find / revise / reject
  → Return
```

The page then opens the research surfaces distributed across personal/project worlds, agency and authority, capability/knowledge fields, harnesses and runtime bodies, developmental systems, material worlds, shared agency, epistemic cultivation and community extension.

Community extension is part of the research method, not generic plugin language. The public account should preserve this relation:

```text
stable abstraction
      ↓
native SDK / public contract
      ↓
local accommodation to a real technology
      ↓
fixture + verification + observed use
      ↓
shared contribution
      ↓
reproduction / adaptation / comparison
      ↓
Return to product and research
```

The point is that the research object is heterogeneous technological agency itself. Different people inhabit different Worlds. Their providers, connectors, Components, fixtures, reproductions and corrections can therefore widen the empirical field and return pressure on the abstractions, SDKs and implementations.

Quaternal Logic remains a substantial deeper entry into the Epi-Logos formal research programme, with operational parity as its discipline; it does not stand in for the whole O:I research protocol.

## Build / distribution / extension

Keep two package relations distinct.

The ordinary `oi` command distribution and the O:I extension/package envelope solve different problems:

```text
@epilogos/oi
  ordinary distribution of the native oi executable

             !=

oi.package/v1
  suite extension/contribution composition envelope
```

The public Build page must follow accepted implementation truth. Until the public distribution package lands, `docs/INSTALL.md` and `docs/CLI.md` remain the authority for installing and using `oi`. Do not publish a future npm command merely because distribution work is underway.

When that distribution PR is accepted, update `content/public-site.md` first and make the public install line the simplest truthful first encounter.

The extension/package SDK programme is a separate product-development line. It can be linked as current development while native product SDKs and contracts retain semantic ownership of the contributions they accept. O:I owns the whole-level composition/provenance relation rather than becoming a universal runtime plugin ontology.

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

The default static provider is `public/data/explore-public.json`. If no public worlds are supplied, Explore renders an empty field rather than substituting arbitrary demo content. A live hosted/federated provider can replace that seed through the same browser read-model seam.

`explore-read-model.mjs` is tested against the canonical shared-field Explore fixture, but that fixture is test material rather than the public product experience.

## World presentation and native composition

Rich world presentation is a Projection representation rather than a new profile/site ontology.

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

Page colour is compositional rather than a forced alternating stripe. Adjacent sections may remain in one field where the reader is still inside the same conceptual or technical movement.

A projected world may remap its permitted semantic presentation tokens without removing the common provenance/navigation grammar.

## Existing fixture proofs

The older Self/Other and object-centred fixture components remain test/support material for their original front-door contract history:

```text
self-other-read-model.mjs
field-proof-read-model.mjs
projection-renderer.mjs
```

They are not the Explore application and are not mounted as public front-door content.