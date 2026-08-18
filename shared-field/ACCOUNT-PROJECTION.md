# O:I Account Projection

**Status:** implementation note for the #18 Explore / Projection programme

## 1. Purpose

O:I can present a rich authored reading of a person, Project, Wiki space, research corpus, or another coherent world without becoming the canonical owner of that world.

The human word **account** names the coherent reading. It does not introduce an `Account` entity or a universal account ontology.

The durable relation is:

```text
native authored source
        ↓ selective reading / composition
WorldPresentation
        ↓ ratified as representation
Projection revision
        ├─ Explore / O:I desktop
        ├─ standalone HTML renderer
        └─ structured agent reading
```

The native source remains authoritative for its own meaning. Projection makes selected aspects present elsewhere.

## 2. Personal world

Central is the person's durable local authored world. O:I must not create another profile record that merely describes Central.

```text
Central
├─ Control/user
├─ Control/agents
├─ Control/machines
└─ Work
     └─ Projects
        │
        │ local selection + authored/ratified presentation
        ▼
WorldPresentation
        │
        ▼
Projection revision
        │
        └─ the person's presented O:I world / “profile”
```

A personal WorldPresentation may cite selected material from several Central roots. The presence of one selected file never implies that its whole root is public.

A public refinement changes the Projection representation. It does not mutate Control.

If a public refinement teaches the person something that should return to durable source, the return path is explicit:

```text
Projection difference
        ↓ proposal
Central human review
        ↓ accepted mutation
Control source revision
```

Central owns that acceptance boundary.

## 3. Projects

`Work/<project>` remains ordinary Project material. Rich account work is not an adoption gate and does not require a Central-specific Project format.

A Project can have little documentation or a deep canon containing positions, vision, design, diagrams, architecture, source, Wiki material, Runs, decisions, Claims, Evidence, and current implementation state.

A Project account is a reading over those native materials:

```text
Project source / canon / current reality
        ↓ authored or generated reading
WorldPresentation
        ↓ ratified Projection
Explore / desktop / HTML / agent reading
```

Several readings can legitimately coexist over the same Project. A public overview, developer account, research account, design account and release account can all cite the same native source without becoming new Project identities.

## 4. Presentation modules

WorldPresentation already composes native `ComponentRef`, `ComponentContributionRef` and `SurfaceRef` identities through declarative portable renderer hints. Rich account craft extends that rendering vocabulary; it does not create a page-builder ontology.

Current account-oriented renderer keys include:

- `oi.presentation/lede/v1`
- `oi.presentation/prose/v1`
- `oi.presentation/distinction/v1`
- `oi.presentation/diagram/v1`
- `oi.presentation/source/v1`
- `oi.presentation/claim-evidence/v1`
- `oi.presentation/timeline/v1`
- `oi.presentation/comparison/v1`
- `oi.presentation/code-schema/v1`
- `oi.presentation/image/v1`
- `oi.presentation/mockup/v1`
- `oi.presentation/wiki-excerpt/v1`
- `oi.presentation/reference-card/v1`
- `oi.presentation/run-history/v1`
- `oi.presentation/action/v1`

A client can implement only the renderers it accepts. Unknown renderers retain safe fallback behaviour. The manifest still cannot name remote executable modules.

These renderer keys describe presentation capabilities. Native Claims, Evidence, WikiNodes, Projects, Agents, Runs and Actions keep their existing semantic owners.

## 5. Canonical HTML renderer

The canonical portable HTML account format is a supported renderer for the same structured reading.

Its source contract is the QL HTML Account skill and `full-account-template.html`. The format provides one-file portability, routed sections, generated navigation, prose, figures, sources, provenance, local notes, responsive layout, dark/light handling, accessibility, reduced motion and machine-readable metadata.

HTML is not source truth.

```text
Markdown / Control / Wiki / code / diagrams / evidence
        ↓
WorldPresentation reading
        ↓
standalone HTML
```

The HTML renderer may use QL internally to test compositional wholeness. Visible headings remain native to the represented material. A personal world, software Project and scientific corpus are not required to display six QL-labelled sections.

## 6. Human and agent parity

An Agent must not scrape rendered HTML to understand a Projection.

`structuredProjectionReading()` exposes the same Projection and WorldPresentation revision as structured data:

```text
projection_ref
projection_revision
source { system, ref, revision }
subject
presentation_ref
presentation_revision
world_ref
modules[] {
    region
    binding_ref
    component_ref
    portable renderer / account module
    subject and nested Projection refs
    props
    fallback
    provenance[]
}
```

The shape is a read model. It is not persisted as another world object.

Human and Agent surfaces therefore share identity:

```text
Projection P7
    ├─ Explore renderer → human reading
    ├─ HTML renderer    → portable human reading
    └─ structured read  → agent reading
```

## 7. Provenance discipline

A presentation binding retains source provenance. A rich account can therefore keep these standings distinct instead of flattening them into one narrative voice:

- authored human position;
- product or constitutional intent;
- design commitment;
- architecture contract;
- implementation fact;
- Run or test evidence;
- current development state;
- inference or interpretation.

Vision can explain what a Project means. It does not prove current behaviour. Current code can prove what exists now. It does not retroactively author why the Project exists.

## 8. Local and public readings

Local O:I may resolve material that is not present in a public Projection.

For Central, local reading can include private authored material, machine state, current Projects, Agents, proposals and operations. A public personal-world Projection includes only the explicitly ratified selection.

For a Project, local reading can include source, private design, unpublished research, current Runs and working state. A public Project Projection includes only the selected account revision.

Visibility therefore changes the reading, not the semantic identity of the person or Project.

## 9. Explore

This extension does not replace Explore's navigation grammar:

```text
SEARCH
  ↓
OPEN
  ↓
bounded local whole
  ↓
READ / RELATIONS / SOURCES / EXPLAIN
```

It changes what a selected world can meaningfully present.

A person's root result can open a projected Central world and lead to selected Projects, Agents, WikiSpaces, writing, research, SharedFields and Contributions.

A Project can open its projected account and lead to WikiNodes, Agents, Runs, Artifacts, Claims, Evidence, other Projects, source provenance and SharedFields.

Explore is therefore a field of projected worlds and their addressable relations rather than a feed of arbitrary cards.

## 10. Authoring ownership

The intended capability split is:

```text
Central
    owns personal authored source and accepted return mutation

AIKit
    owns reusable procedural Skills for understanding and authoring readings

O:I
    owns Projection, WorldPresentation, Explore and presentation revision semantics

Software Factory
    owns richer Project development semantics where Project/Run/Claim/Evidence
    already exist
```

Skill availability does not imply automatic execution. A simple code fix should not generate a product account. Opening `Control/user` should not rewrite it into HTML.

Deep account work is appropriate when the human is authoring or clarifying a whole, product understanding matters, documentation/design is requested, a Projection is being prepared, a major change requires renewed vision, or a human explicitly requests an account.

## 11. Conformance

`account-projection.test.mjs` proves three distinct cases using the same Projection/WorldPresentation machinery.

### Central personal world

The fixture selects material from `Control/user`, `Control/agents` and `Work`. It verifies that no unselected machine/private source appears in the agent reading and that the source revision remains Central-owned.

### Deep O:I Project

The fixture presents authored position, design commitment, architecture contract and implementation evidence as distinguishable modules with distinct provenance.

### Ordinary non-QL Project

The fixture presents a small field-notes Project with natural headings such as “Why I keep these notes” and “From a walk to a useful record”. It contains no QL coordinate dependency or forced six-section structure.

These are deterministic conformance fixtures. They are not synthetic public Explore personalities or public seed content.
