# {O:I} Visual Product Understanding

**Status:** canonical product-understanding surface  
**Architecture status:** describes accepted `main`; open PRs are named only as developmental sources  
**Authored source:** `docs/positions/FOUNDING-POSITIONS.md` on draft PR #71, read together with `CANONICAL-PRODUCT-FIELD.md`, `ARCHITECTURE.md`, `OBJECTIVE-CO-INTERNALITY.md`, and accepted first-suite implementation.

This document gives three visual depths different jobs. Experience shows what changes for a person or agent. Product relation shows what O:I makes possible without absorbing native ownership. Architecture shows the accepted software seams which currently realise those relations.

## 1. Experience — one field can remain minimal or develop outward

The minimum is not an incomplete six-stage pipeline. A useful O:I world can begin with durable authored ground and model capacity that can be actuated. Everything else develops the possibilities of that same field when it is wanted.

```mermaid
flowchart TB
    M["Minimal operative field<br/>authored or persistent ground<br/>+ actuated model capacity"]

    P["Projects and developmental worlds"]
    K["Knowledge and navigable sources"]
    C["Skills, tools, Actions and capabilities"]
    A["Multiple Agents and Agencies"]
    D["Runs, evidence, candidates and developmental structure"]
    B["Material bodies, services and Workcells"]
    Q["QL and MEF experimentation"]
    S["Selective shared fields and other grounded worlds"]

    M -->|"can develop into"| P
    M -->|"can develop into"| K
    M -->|"can develop into"| C
    M -->|"can develop into"| A
    M -->|"can develop into"| D
    M -->|"can develop into"| B
    M -->|"can develop into"| Q
    M -->|"can develop into"| S
```

The arrows mean **optional development of available possibility**, not installation order, ontological dependence, or a claim that every O:I world needs every product surface.

### Existing worlds are the starting fact

```mermaid
flowchart LR
    N["Existing native arrangement<br/>repos · files · tools · agents · services"]
    R["O:I-readable relations<br/>identity · entry points · provenance · availability"]
    U["The same native world<br/>still owned and usable natively"]

    N -->|"make explicit without migrating"| R
    R -->|"disclose and compose"| U
    N -->|"native use continues"| U
```

O:I is successful here when explicit composition adds intelligibility without requiring the person to abandon the heterogeneous world they already have.

## 2. Product / conceptual relation — projection without world capture

```mermaid
flowchart LR
    subgraph L["Local world — source authority stays here"]
      LO["Native object or contribution"]
      LP["Local identity + revision + provenance"]
      LO -->|"is identified by"| LP
    end

    PX["Selective Projection<br/>audience + purpose + source revision"]
    SF["SharedField<br/>relational environment, not owner"]

    subgraph O["Other independently grounded world"]
      OE["Encounter"]
      OO["Other's own context and authority"]
      OE -->|"may affect later action"| OO
    end

    LO -->|"explicitly externalised as"| PX
    LP -->|"provenance remains attached"| PX
    PX -->|"becomes available within"| SF
    SF -->|"mediates presentation to"| OE
    OO -. "does not transfer ownership back" .-> SF
```

The essential relation is not “upload into a global world”. It is **one grounded world making a selected difference available to another while the SharedField preserves alterity, provenance, and local authority**.

## 3. Architecture — accepted current seams

This diagram describes the accepted repository shape on `main`, not the separate Explore implementation on draft PR #72.

```mermaid
flowchart TB
    subgraph Native["Native product ownership"]
      NP["Central · Actuation · AIKit · Factory · Workcell · Quaternal Logic"]
      NO["Native CLIs, contracts, Actions, Skills and release artifacts"]
      NP -->|"publish their own surfaces"| NO
    end

    subgraph OI["O:I whole-level code"]
      SU["suite/<br/>release and composition metadata"]
      SK["skills/<br/>whole-field operating guidance"]
      CLI["cli/<br/>common namespace and inspection"]
      DESK["desktop/<br/>native whole-field host"]
      SH["shared-field/<br/>Projection · Participant · SharedField · Contribution · Encounter"]
      SITE["site/<br/>browser projection of whole-level relations"]
    end

    NO -->|"registered and pinned without semantic takeover"| SU
    SU -->|"makes native entry points discoverable"| CLI
    SU -->|"makes product availability inspectable"| DESK
    SK -->|"explains ownership and routing"| CLI

    NO -->|"selected native objects may enter"| SH
    SH -->|"read models and mediated relations"| SITE
    SH -->|"source refs and revisions return to"| NP
```

Current implementation therefore has two thin operative faces: **local suite composition/disclosure** and **whole-level shared-field relation**. Neither is a seventh implementation of the native products.

## 4. Diagram audit

| Existing visual | Class | Disposition |
|---|---|---|
| `CANONICAL-PRODUCT-FIELD.md` twelve-face and harmonic relation maps | specialist conceptual/formal | **Preserve.** They explain the QL reading of the six-product field, not ordinary first-contact product meaning. |
| `ARCHITECTURE.md` native world → O:I → SharedField → Other | conceptual | **Superseded for first explanation** by the provenance-bearing projection diagram above; keep the deeper prose and specialist shared-field relations. |
| `ARCHITECTURE.md` Objective Co-Internality ASCII circuits | specialist conceptual | **Preserve.** They develop Self/Other implications beyond the minimum product diagram. |
| `OBJECTIVE-CO-INTERNALITY.md` relation diagrams | specialist conceptual/research | **Preserve.** Do not promote them into implementation architecture. |
| suite/security diagrams and receipts | architectural/evidence | **Preserve where local.** They prove specific mechanisms rather than explain the product as a whole. |

One known drift is corrected with this visual pass: `ARCHITECTURE.md` must name **Actuation**, not the older `Agent Runtime`, as the current product centre.

## 5. Verification

**Semantic:** none of the diagrams requires the reader to know the six internal product nouns before understanding why O:I exists. Important arrows name development, explication, projection, mediation, provenance, or native continuation.

**Implementation:** the architecture diagram names only accepted repository seams present on `main`. Draft PR #71 is used as authored-position provenance; draft PR #72 is not presented as current architecture.

**Cross-product:** the diagrams deliberately do not turn the six native products into one pipeline. O:I composes and discloses the field while the products retain their own semantic centres.

## 6. Public-site projection

The later public-site session should **reinterpret**, not duplicate, the first two diagrams:

- project the minimal→maximal field as a spatial opening of optional possibility rather than a product carousel;
- project existing-world→O:I-readable-world as the reason heterogeneous native arrangements can enter without migration;
- use the local-world→Projection→SharedField→Other relation as the conceptual basis for Explore.

The architecture diagram belongs in technical documentation and an inspectable “how it works” layer, not on the first public encounter.