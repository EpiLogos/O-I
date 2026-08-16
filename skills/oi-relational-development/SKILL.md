# {O:I} Relational Development Skill

## Purpose

Use this skill when the task is to improve {O:I} or one of its six products **as part of the whole field**.

Typical triggers:

- “what should O:I improve next?”
- “review this product change holistically”
- “what does this ticket imply elsewhere in the suite?”
- “use the QL map to find missing seams”
- “follow the relation from this development”
- “does this capability reveal work in another product?”
- “review the health of the whole system”

This skill treats the O:I product field as a manipulable **developmental map of self**.

It does not turn the map into an orchestration engine, a 144-integration checklist, or a substitute for native product ownership.

The working cycle is:

```text
perceive → locate → relate → inspect → improve → return → remap
```

## Sources of truth

Read these first from the current O:I line:

```text
docs/CANONICAL-PRODUCT-FIELD.md
data/ql-relational-field.csv
```

Use O:I issue `#29` as the continuing relation-map tracker.

Then inspect the **actual current native repo, issue, PR, branch, code and evidence** for the products involved. Tracking refs in the CSV are wayfinding pointers, not guaranteed current truth.

Do not reason from old SHAs or ticket prose when live state is available.

## Product positions

```text
P0  Central
P1  Actuation
P2  AIKit
P3  Software Factory
P4  Workcell
P5  Quaternal Logic

H_i = P_i
A_i = P_i′
```

`H/A` are conjugate perspectives in and on the same software. They are not Human/Agent entity classes.

The active engineering body is `P1–P4`. `P0/P5` are anchoring positions. Across both faces this is `8+4`.

The parent relation remains `0/1 → 4+2`. Do not create a P6.

## Start from a real change

Prefer a concrete developmental seed:

- an implementation;
- an issue or PR;
- a new capability;
- a changed contract;
- a failure or awkward seam;
- a new material provider;
- a new formal operator;
- a user/agent experience that does not yet join cleanly to the rest of the suite.

Identify:

```text
product position
human-facing / agent-facing / both
native object or behaviour that changed
actual evidence for the change
```

Do not begin by scanning all 144 cells unless the task is explicitly a whole-field audit.

## Expand the relation neighbourhood

For a normal development pass, inspect only the meaningful neighbourhood around the seed.

### 1. Same-position conjugate

Read the product's `D1` relation:

```text
P_i ↔ P_i′
```

Ask:

- does the same semantic capability remain legible from human and agent orientations?
- is important information available only to one face?
- does one face mutate or interpret the same object differently without a clear reason?

### 2. A / B / C harmonic neighbours

Read the direct product relations which contain the position:

```text
A  (0,1) (2,3) (4,5)
B  (1,2) (3,4) (5,0)
C  (0,5) (1,4) (2,3)
```

Ask in both directions:

```text
What does this product make possible for the other?
What does the other return, constrain, complete, or reveal here?
What becomes newly possible because the first product changed?
What relation should remain indirect rather than becoming an integration?
```

Preserve the dual readings of `23` and `50/05`.

### 3. Cross-face diagonals

Where the dyad matters, inspect the conjugate fourfold:

```text
H_X ↔ H_Y
A_X ↔ A_Y
H_X ↔ A_X
H_Y ↔ A_Y
H_X ↔ A_Y
H_Y ↔ A_X
```

Use the canonical cross-face relations:

```text
D1
D2-transform
D2-require
D2-complete
D3:A/B/C
```

Cross-face questions are often where useful agent-native improvements appear.

Examples:

```text
H3 → A4
Can human-recognised developmental intent become agent-operable material demand?

H1 → A2
Can human-understood Agency resolve into the correct operative body for the acting agent?

H4 → A1
Can material reality alter or bound Agency without changing Agent identity accidentally?
```

### 4. Triad and whole

If the change affects a wider flow, inspect its triad:

```text
1 → 2 → 3
Actuation → AIKit → Factory

4 → 5 → 0
Workcell → Quaternal Logic → Central
```

Do not force these into runtime pipelines.

For `4→5→0`, use the concrete reading:

```text
Workcell materialises / instantiates a project or world
        ↓
QL gives the material relation formal/reflexive orientation where useful
        ↓
the changed project/world remains ordinary ground in Central/Work
```

QL can remain absent from the actual execution path while still providing the formal whole-reading.

## Use Context Frames when scale changes

Use CF only when the question is about **how much of the relational whole must be held together**.

```text
CF1  ground / unresolved zero
CF2  one defining relation
CF3  triadic circulation
CF4  outer developmental whole
CF5  recursive/nested contextual whole
CF6  bridge from the nested whole outward
CF7  synthesis / closure / reopening through 5/0
```

The Context Frame does not create another map. It tells you how the existing relation field is presently configured.

Useful rule:

- stay in CF2 when one clean seam is enough;
- move to CF3/CF4 when the change cannot be understood without the next product(s);
- use CF5 when a project/world contains another meaningful developmental whole;
- use CF6 when that nested whole must return outward;
- use CF7 when the real question is synthesis, recognition, retained difference, or reopening.

Do not invent alternate CF mappings. QL-MEF owns the executable CF grammar.

## Read coverage as developmental pressure

The CSV uses:

```text
H  canonical harmonic
S  strong supporting
L  latent
W  weak / intentionally indirect
I  reflexive accounting
```

Only `H` is formal structure. `S/L/W` are current development readings.

Interpret them carefully:

- `S` can indicate a useful existing seam that deserves explicit support;
- `L` can indicate an opportunity which has not yet become important;
- `W` can indicate either a genuine gap **or correct architectural distance**;
- Central relations are often intentionally sparse because P0 is open authored ground;
- QL relations can remain optional because P5 is an anchor/formal faculty rather than a mandatory dependency.

Do not create work just to raise a coverage letter.

## Decide the smallest useful improvement

After relational inspection, choose one of these outcomes:

```text
NO CHANGE
The relation is already clean or should remain indirect.

MAP UPDATE
The software changed, but only the relation reading/tracking needs updating.

DOCUMENT / REF IMPROVEMENT
A stable identity, ownership boundary, Return, Action, Capability, ContextSource,
provider seam, projection, or read model needs clearer expression.

NATIVE TICKET UPDATE
A concrete product improvement is now visible and belongs in an existing native issue/PR.

NATIVE IMPLEMENTATION
The relation reveals a small executable seam which can be implemented and tested now.
```

Prefer the smallest change which makes the relation real and legible.

Do not create a new abstraction when an existing native object can carry the relation.

## Preserve product ownership

The relational map can reveal a co-necessity. It does not transfer ownership.

Examples:

```text
Central ↔ Actuation
Central remains authored ground; Actuation owns Agency/Return.

Actuation ↔ AIKit
Actuation owns AgenticComposition; AIKit owns HarnessComposition/ContextResolution.

AIKit ↔ Factory
AIKit owns operative possibility; Factory owns Project/Run/developmental evidence.

Factory ↔ Workcell
Factory owns developmental meaning; Workcell owns materialisation.

Actuation ↔ Workcell
Actuation owns Agency identity; Workcell owns material binding/lifecycle.

Workcell ↔ QL
Workcell owns material reality; QL owns formal/refraction semantics.
```

A relation is successful when the two products become more mutually legible **without becoming the same product**.

## Holistic audit mode

When asked to inspect O:I as a whole, do not mechanically review all 144 cells one by one.

Review in this order:

1. the six `D1` same-position conjugates;
2. the nine A/B/C family entries, preserving the 9/8/7 distinction;
3. the two triads `123` and `450`;
4. the active `1–4` body and the `0/5` anchors;
5. current `L/W` relations only where recent development makes them newly relevant;
6. current native issues/PRs for unresolved seams;
7. CF5–CF7 only where recursive whole/return structure is actually active.

The result should be a **small ranked set of developmental pressures**, not a giant generated backlog.

## Return and remap

After real work changes the architecture:

1. verify the native change in its owning repository;
2. update affected rows in `data/ql-relational-field.csv` only if the relation reading, coverage, definition, or live tracking changed;
3. update `docs/CANONICAL-PRODUCT-FIELD.md` only when the canonical whole-reading changed;
4. update O:I #29 with the meaningful movement;
5. preserve “no change required” decisions when they prevent future agents from reopening a deliberately indirect seam.

The map should become more accurate through development. Development should not become subordinate to maintaining the map.

## Output format

For a normal relational-development pass, report compactly:

```text
Seed
- product / face / concrete change

Relations inspected
- harmonic / cross-face / CF relations that materially mattered

Findings
- what became newly visible across products

Actions
- no change / map update / ticket update / implementation

Return
- what changed in the whole and whether the map now needs revision
```

Keep the language concrete. The skill exists so the system can increasingly recognise how changes in one organ alter the developmental possibilities of the whole.