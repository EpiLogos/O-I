# {O:I} Canonical Product Field

**Status:** canonical architectural framing  
**Scope:** the six-product field, its conjugate human/agent faces, harmonic relations, Context Frames, and the living 12×12 development map  
**Tracking:** O:I #29  
**Data:** [`../data/ql-relational-field.csv`](../data/ql-relational-field.csv)

## 1. Purpose

{O:I} is a field of six product centres which together provision and potentiate technological agency around available model capacity.

The six centres are:

| Position | Product | Function in the field |
|---|---|---|
| **0** | **Central** | open persistent personal and operative ground: human-authored Control, ordinary Work, machine intent, and durable local orientation |
| **1** | **Actuation** | situated Agency, actuation, metagency, determination, AgenticComposition, and Return |
| **2** | **AIKit** | capability, Context, resource, body, HarnessComposition, session, and Surface resolution |
| **3** | **Software Factory** | developmental form across Projects, Runs, evidence, candidates, decisions, and recognition |
| **4** | **Workcell** | materialisation, execution, placement, services, bindings, connectivity, and lifecycle |
| **5** | **Quaternal Logic** | formal relation, refraction, synthesis, recursion, and executable QL/MEF |

These assignments form the **O:I product QL Form**. They apply the QL positional and harmonic structure to this technological field. They do not redefine the underlying QL positions.

The form is primarily a **development map**. It lets any change in one product be read through the relations by which that product becomes more fully defined qua the others. QL therefore exposes possible co-necessities across the field: useful seams, missing returns, latent interoperability, and relations which are already clean precisely because they remain indirect.

This is relational co-conditioning, not dependency inflation. A canonical relation does not imply a required API, runtime hop, package dependency, or verification gate.

> **QL generates questions across the O:I field; it does not generate obligations merely because a relation exists.**

---

## 2. One field, two conjugate faces

Each product position has two first-class faces:

```text
H_i = P_i
A_i = P_i′
```

`H` is the **human-facing** position: the product presented to human intention, recognition, authorship, inspection, choice, and action.

`A` is the **agent-facing conjugate** position: the same product available to agent cognition, discovery, judgement, invocation, action, and Return.

The prime mark does not create another product or another entity type. It names the conjugate orientation of the same product position.

```text
H0  Central             A0  Central′
H1  Actuation           A1  Actuation′
H2  AIKit               A2  AIKit′
H3  Software Factory    A3  Software Factory′
H4  Workcell            A4  Workcell′
H5  Quaternal Logic     A5  Quaternal Logic′
```

A human-facing Actuation surface can display Agents. An agent-facing Central surface can disclose human-authored Control. `H/A` describes **perspective in and on the software**, not the ontological class of the thing represented.

### 2.1 Product-face readings

| Position | Human-facing `P` | Agent-facing `P′` |
|---|---|---|
| **0 — Central** | Author, inspect, edit, and recognise durable Control and ordinary Work. | Discover permitted durable ground, Work, Actions, machine state, and places where returned difference may be proposed. |
| **1 — Actuation** | Commission, inspect, bound, and understand Agency and AgenticComposition. | Inhabit Agency, exercise bounded autonomy/metagency, relate loci, and return attributable difference. |
| **2 — AIKit** | Search, navigate, compose, and explain the effective agentic environment. | Resolve Context, capabilities, information horizon, body, session, models, and Surfaces. |
| **3 — Software Factory** | See developmental intent, Runs, candidates, claims/evidence, decisions, and recognition. | Inhabit developmental topology, act on the frontier, produce evidence/artifacts, and return developmental difference. |
| **4 — Workcell** | Inspect and operate material plans, worlds, providers, services, endpoints, lifecycle, and recovery. | Discover, plan, prepare, observe, expose, collect, release, and reconcile material execution. |
| **5 — Quaternal Logic** | Inspect relations, refractions, formal structure, and recursive readings. | Locate, relate, refract, synthesise, and use executable QL/MEF operations when enabled. |

---

## 3. The complete 12×12 relation field

The twelve situated product faces define a `12 × 12` ordered field:

```text
H → H    6 × 6 = 36
A → A    6 × 6 = 36
H → A    6 × 6 = 36
A → H    6 × 6 = 36

complete field = 144 directed relations
```

The canonical manipulable representation is [`data/ql-relational-field.csv`](../data/ql-relational-field.csv).

The matrix does **not** assert 144 integrations. It makes 144 directed questions addressable. Each row records:

- source and destination product faces in the relation `id`;
- canonical QL family tags where they apply;
- a lightweight development-coverage reading;
- a concise product-seam interpretation;
- a Context-Frame view where a clean one is useful;
- the canonical document and live issue/PR pointers currently expressing the seam.

The coverage codes are deliberately non-constitutional:

```text
H  canonical harmonic relation
S  strong supporting relation in the present architecture
L  latent relation worth keeping visible
W  weak / intentionally indirect present expression
I  reflexive accounting cell
```

Current accounting is:

```text
68 H
40 S
16 L
 8 W
12 I
---
144
```

### 3.1 Human-readable coverage matrix

Rows are source positions and columns are destination positions. The CSV carries the detailed QL family, seam, Context Frame, definition, and tracking pointers for each cell.

```text
      H0 H1 H2 H3 H4 H5 | A0 A1 A2 A3 A4 A5
H0     I  H  L  L  W  H |  H  H  L  L  W  H
H1     H  I  H  S  H  S |  H  H  H  S  H  S
H2     L  H  I  H  S  S |  L  H  H  H  S  S
H3     L  S  H  I  H  S |  L  S  H  H  H  S
H4     W  H  S  H  I  H |  W  H  S  H  H  H
H5     H  S  S  S  H  I |  H  S  S  S  H  H
------------------------------------------------
A0     H  H  L  L  W  H |  I  H  L  L  W  H
A1     H  H  H  S  H  S |  H  I  H  S  H  S
A2     L  H  H  H  S  S |  L  H  I  H  S  S
A3     L  S  H  H  H  S |  L  S  H  I  H  S
A4     W  H  S  H  H  H |  W  H  S  H  I  H
A5     H  S  S  S  H  H |  H  S  S  S  H  I
```

The `S/L/W` judgements are editable development readings. They are not QL canon and should change when the software changes.

Central is intentionally sparse in this map. As P0 it is chiefly open authored ground and ordinary Work. Its strongest explicit harmonic relations are `01` and the `05/50` whole/return relation. A weak or mediated Central seam is often correct architecture rather than unfinished integration.

---

## 4. Canonical QL pairing grammar

The product form uses the raw QL relation families rather than software-local shorthand.

### 4.1 A — natural dyads

```text
A1  (0,1)  Central ↔ Actuation
A2  (2,3)  AIKit ↔ Software Factory
A3  (4,5)  Workcell ↔ Quaternal Logic
```

### 4.2 B — offset transitions

```text
B1  (1,2)  Actuation ↔ AIKit
B2  (3,4)  Software Factory ↔ Workcell
B3  (5,0)  Quaternal Logic ↔ Central
```

### 4.3 C — converse mirrors / complements

```text
C1  (0,5)  Central ↔ Quaternal Logic
C2  (1,4)  Actuation ↔ Workcell
C3  (2,3)  AIKit ↔ Software Factory
```

`23` is intentionally present in both A and C. It is simultaneously natural harmonic adjacency and the central whole-relative mirror.

`50` and `05` use the same product vertices but must not be flattened. B3 reads their transition/return relation; C1 reads their whole-relative complement/anchor relation.

### 4.4 Cross-face grammar

The conjugate relations are:

```text
D1
(n, n′)

D2-transform
(n, (n+1)′)

D2-require
(n, (n-1)′)

D2-complete
(n, (5-n)′)

D3
A / B / C applied on the conjugate P′ face
```

For example:

```text
H1 → A2   D2-transform
H3 → A2   D2-require + D2-complete
H1 → A4   D2-complete
A3 → A4   D3:B2
H4 → A4   D1
```

The CSV uses `.inverse` for the opposite directed traversal of a canonical cross-face relation. This is an O:I directional data label, not a seventh QL family.

---

## 5. Dyad → conjugate fourfold

Every important product dyad lifts to:

```text
(X,Y) → (H_X, H_Y, A_X, A_Y)
```

Its six pairwise relation types are:

```text
H_X ↔ H_Y     direct-face product relation
A_X ↔ A_Y     D3 conjugate-face invariance
H_X ↔ A_X     D1
H_Y ↔ A_Y     D1
H_X ↔ A_Y     D2 cross-face diagonal
H_Y ↔ A_X     D2 cross-face diagonal
```

The cross-face diagonals are therefore native QL relations. They are not software glue invented after the fact.

### 5.1 The 3×3 harmonic square

| Family | 1 | 2 | 3 |
|---|---|---|---|
| **A** | `01` Central / Actuation | `23` AIKit / Factory | `45` Workcell / QL |
| **B** | `12` Actuation / AIKit | `34` Factory / Workcell | `50` QL / Central |
| **C** | `05` Central / QL | `14` Actuation / Workcell | `23` AIKit / Factory |

Keep three different counts clear:

```text
9 family entries
8 distinct oriented fourfold structures
7 unordered product tetrads
```

`A23` and `C23` coincide as an oriented fourfold. `B50` and `C05` use the same unordered tetrad but retain different family/orientation meaning.

---

## 6. Main harmonic seam readings

### A1 — 01 · Central / Actuation · grounded agency

Central is the authored/open world in which Agency can be situated. Actuation gives that world a first-class account of Agency, determination, bounds, composition, and Return.

Useful questions:

- what authored ground should an Agency be able to discover without Central becoming an orchestration store?
- what returned difference should become visible or proposable without silently becoming authored Control?

### A2 / C3 — 23 · AIKit / Factory · possibility and developmental determination

This is the central dual-family hinge.

AIKit resolves the operative field: Context, powers, information, models, bodies, sessions, and Surfaces. Factory gives that possibility a developmental reason, frontier, evidence structure, and recognition relation.

Useful questions:

- does the Factory need expose enough intent for AIKit to resolve the right operative body?
- can Factory inspect what AIKit actually made available without duplicating Context?

### A3 — 45 · Workcell / QL · actuality and formal intelligence

Workcell provides material actuality. QL can make that actuality a subject of formal relation, refraction, comparison, or synthesis.

This relation can remain experimental. QL is not required in order for Workcell to execute.

### B1 — 12 · Actuation / AIKit · agency and operative body

Actuation owns semantic Agency and plurality. AIKit resolves the concrete operative body/world through which a locus acts.

The central law is:

```text
AgenticComposition ≠ HarnessComposition
```

A change of model, harness, session, or Surface should not silently change Agent/Agency identity.

### B2 — 34 · Factory / Workcell · development and materialisation

Factory expresses developmental need. Workcell materialises it as an executable world and returns observations, artifacts, services, and material constraints.

Workcell does not become the owner of Project, Run, Candidate, Claim, or Evidence meaning.

### B3 — 50 · QL / Central · return and renewed ground

This is the return-oriented reading: synthesis or retained difference can re-enter the open conditions of later operation.

A formal result does not automatically mutate Central. Human recognition, native Action/proposal discipline, or another owning mechanism still governs durable authored change.

### C1 — 05 · Central / QL · ground and whole-form anchor

This uses the same vertices as B3 but reads them as a complement across the whole: open ground gives formal inquiry a situated subject; formal intelligence gives ground an available whole-relative/reflexive reading.

### C2 — 14 · Actuation / Workcell · agency and embodiment

Agency can persist while its material Workcell changes. Workcell conditions can also force Agency to revise, refuse, fail, or reconstitute its act.

This seam is one of the clearest places to preserve Agent/Agency identity across rematerialisation.

---

## 7. The 3:3 triads

The positional field admits the two canonical tendencies:

```text
1 → 2 → 3
Actuation → AIKit → Software Factory

4 → 5 → 0
Workcell → Quaternal Logic → Central
```

The first reads situated agency becoming operationally equipped and developmentally determinate.

The second should be read concretely in this product form as **material contextualisation returning to ground**:

1. Workcell materialises/instantiates the project, repository, service, or world in which the work becomes actual;
2. QL supplies its native formal/reflexive orientation where that reading is useful;
3. the changed project/world appears again as ordinary durable ground in Central/Work.

This is not a mandatory runtime pipeline. Workcell can materialise a project with no QL service call, and ordinary development can return to Central through its owning product paths. The harmonic tells us what the whole relation means when read together.

---

## 8. The seven Context Frames

The seven Context Frames are the contextual-configuration grammar of the field:

```text
CF1  (00/00)          Fourfold-Zero / undifferentiated ground
CF2  (0/1)            Non-Dual Anchor
CF3  (0/1/2)          Dual-Non-Dual / triadic circulation
CF4  (0/1/2/3)        Trinitarian / tetradic prehensive closure
CF5  (4.0/1–4.4/5)    Fractal-Doubling Executive / nested contextual whole
CF6  (4.5/0)          .5 Bridge
CF7  (5/0)            Total Synthesis / cyclic closure and reopening
```

QL-MEF Q6 PR #19 is the current executable formalisation line for the seven-frame registry, progression, canonical cut, and MEF rotation relation.

### 8.1 What CF adds to the matrix

The 12×12 field answers:

> what is the directed relation between these two situated product faces?

The Context Frame answers:

> in what relational configuration is this material presently being held together?

CF therefore **modulates the relation field; it does not multiply it into another matrix**.

CF1–CF4 progressively gather an outer field. In the CSV, `cf_view=CF1..CF4` records the smallest linear frame which cleanly contains the outer product positions involved.

CF5–CF7 need more care:

- **CF5** opens recursive contextualisation at #4. In O:I this is especially suggestive of Workcell materialising a local project/world which itself contains a sixfold of relations. CSV labels such as `CF5-field` are O:I development hints, not a claim that CF5 is identical with P4.
- **CF6** is the bridge by which the nested contextual whole relates outward. `CF5/CF6-field` marks seams where the Workcell/material whole and its return boundary are particularly relevant.
- **CF7** is the `5/0` synthesis/reopening relation and therefore directly illuminates the QL/Central return seam.

The source grammar retains conjugate-form structure inside the contextual configuration. O:I therefore does not create separate human-CF and agent-CF ontologies, nor does it invent alternate CF face-selection rules beyond the canonical QL-MEF cut. A CF is one contextual whole; H/A orientation tells us how the product positions are being encountered within the O:I application.

### 8.2 CF is not MEF lens

Keep distinct:

```text
MEF lens          epistemic refraction: which knowing-mode reads the subject?
Context Frame     contextual configuration: how is the relational whole held together?
product face      conjugate orientation: from which situated face is it encountered?
```

QL-MEF composes Context Frames with MEF rotation. O:I uses that formal capacity to read development without redefining product identities.

---

## 9. The 4+2 and 8+4 whole

The product field has the same `4 + 2` structural cut:

```text
P1  Actuation
P2  AIKit
P3  Software Factory
P4  Workcell
    = active / explicate engineering body

P0  Central
P5  Quaternal Logic
    = anchoring / implicate positions
```

Across both conjugate faces:

```text
8 active positions + 4 anchors
```

The anchors are structurally important without being mandatory runtime dependencies. Central can remain open/passive ground. QL can remain latent or optional in an ordinary operation.

The parent relation is **not another product position**. The deeper derivation remains:

```text
0/1 → 4+2
```

---

## 10. Using the relational field for development

The matrix is most useful when read in both directions.

### Start from QL

Ask what a canonical relation reveals:

```text
34
What has to pass cleanly between developmental form and materialisation?

14
What remains invariant when Agency is materially remade somewhere else?

H3 → A4
What human-recognised developmental intent must become agent-operable material demand?

50 / 05
What is return, and what is whole-relative anchoring, across the same products?
```

### Start from a development

When a ticket changes one product:

1. locate the affected product position and directed face;
2. inspect its harmonic neighbours and relevant fourfold diagonals;
3. ask whether the change reveals a useful seam in an adjacent/complementary product;
4. inspect the relevant Context Frame if the change is really about how a wider whole is being held together;
5. make only the concrete interoperability change that improves the products;
6. update the matrix row and ticket pointers if the architecture materially changed.

Possible outcomes include a small Action, Capability, ContextSource, Ref, Return relation, read model, provider boundary, projection, or simply a clarified ownership seam.

“No change required” is also a valid result.

---

## 11. Data contract

`data/ql-relational-field.csv` is intentionally simple and diffable.

| Column | Meaning |
|---|---|
| `id` | directed situated relation ID such as `H3->A4`; this encodes both source and destination product faces |
| `src_product`, `dst_product` | readable product names |
| `ql` | canonical family tags; `|` separates multiple simultaneous relations |
| `coverage` | `H/S/L/W/I` development reading |
| `cf_view` | minimum/especially relevant CF view where useful; field-level CF5/6 labels are explicitly O:I interpretive hints |
| `seam` | compact seam key such as `34:development-materialisation` |
| `defined_in` | canonical definition/formalisation pointers |
| `tracked_by` | current O:I/native issue/PR pointers |

Rows are stable enough to query from scripts, SQLite import, DuckDB, spreadsheets, agents, or a future O:I/Explore relation view. CSV remains the source object because it is readable without tooling.

If a query database becomes useful later it should be generated from the CSV rather than becoming a second hand-maintained truth.

---

## 12. Ownership and sources

- O:I owns this product-field application, the 12×12 development map, and its whole-level tracking.
- QL-MEF owns executable QL/MEF formalisation. Its current Q6 PR #19 carries A/B/C, canonical D1/D2/D3, 9/8/7 square accounting, MEF rotation, and the seven Context Frames.
- each native product remains the source of truth for its own objects, Actions, runtime behaviour, and implementation tickets.
- O:I #29 is the lightweight continuing tracker for this map.

The relational map does not replace native architecture. Its purpose is to keep the six products **mutually legible as one open field of relational co-necessities** while allowing every centre to remain itself.
