---
title: "Laws of Form and Varela — Crossing, Re-entry, Self-Indication"
record_id: matheme-laws-of-form-varela
record_type: matheme
register: matheme
claim_status: "Derived (specified calculus); Argued (native comparison)"
source_relation: "Paraphrased formal constructions; Argued from native re-entry"
source_ids:
  - spencer-brown-1969-laws-form
  - varela-1975-calculus-self-reference
  - taylor-2026-core-theorems-pithy
---

# Laws of Form and Varela — Crossing, Re-entry, Self-Indication

## #0 — A boundary changes where a mark acts

Use `U` for the unmarked value and `M` for the marked value. To make the spatial notation readable in a line of text, let `C(E)` mean an enclosure around expression `E`, and let juxtaposition `EF` place two expressions in the same space. An empty space has value `U`; its enclosure has value `M`, so `C(U)=M`. `U` is a printed name for the blank value here, not an additional mark inside the source's drawings.

The two arithmetic reductions are

$$
MM=M\qquad\text{calling},
$$

$$
C(M)=U\qquad\text{crossing}.
$$

Two marks beside one another retain the marked value. An enclosure around a mark returns the unmarked value. Their arrangement determines the different effects of the two visible marks. These initials of [Spencer-Brown’s calculus](../../episteme/sources/mathematics-logic/spencer-brown/spencer-brown-1969-laws-form/spencer-brown-1969-laws-form.md) also appear in the appendix to Varela’s 1975 paper, printed p.23. `C`, `U` and `M` transliterate that spatial signature here; the selected edition’s direct excerpt question remains separate.

## #1 — Finite depth permits an innermost reduction

For closed finite expressions, juxtaposition with empty space changes nothing: `EU=UE=E`. Reduce a deepest enclosure first. If its interior reduces to `U`, the enclosure has value `M`; if its interior reduces to `M`, it has value `U`. Repeated same-space marks condense by calling. A finite expression has a deepest region, so this procedure eventually exhausts its enclosures.

For example,

$$
\begin{aligned}
C\bigl(C(MM)\,C(M)\bigr)
&=C\bigl(C(M)\,C(M)\bigr)\\
&=C(UU)\\
&=C(U)\\
&=M.
\end{aligned}
$$

Its two inner enclosures each return blankness; the outer enclosure marks that space. The final value does not retain the number of steps taken to reach it.

A Boolean interpretation makes this finite evaluation explicit: assign `U=0`, `M=1`, interpret juxtaposition as OR, and crossing as negation. Then calling is idempotence and crossing exchanges the values. This interpretation checks the reductions. It does not make the original spatial arrangement merely decorative: that arrangement determines which operations are composed.

## #2 — A loop removes the deepest region

Now let an expression re-enter its own enclosure. Its compressed equation is

$$
x=C(x).
$$

In the two-valued interpretation, neither candidate solves it: `C(U)=M` and `C(M)=U`. There is no fixed value. Expanding the equation repeatedly creates further nesting without reaching an innermost starting expression. The finite reduction procedure therefore lacks the structural condition on which it relied.

A delayed implementation asks a different question. Index states by discrete time and specify

$$
x_{t+1}=C(x_t).
$$

Starting with `U` gives `U,M,U,M,…`; starting with `M` gives the opposite phase. Each update is determinate. The state held from one update to the next and the stipulated delay make this an oscillating process. They are additional dynamical structure, not consequences of repeating a symbol in a finite expression.

The static equation has no two-valued solution; the delayed recurrence has two alternating trajectories distinguished by initial phase. A temporal account must retain that difference rather than replace it with one instantaneous value. More complicated re-entry equations require their own analysis; this one loop does not establish that every feedback system oscillates.

## #3 — Varela gives crossing a third possible value

In his [1975 extension](../../episteme/sources/process-systems-theory/varela/varela-1975-calculus-self-reference/varela-1975-calculus-self-reference.md), printed pp.7–8, Varela introduces the autonomous state and specifies its arithmetic. Write that state `A` in this transliteration. Crossing fixes it, `C(A)=A`; marked presence dominates juxtaposition; repeated autonomous indications condense. The resulting operations are:

| `E` | `C(E)` |
|---|---|
| U | M |
| A | A |
| M | U |

| Juxtaposition | U | A | M |
|---|---|---|---|
| U | U | A | M |
| A | A | A | M |
| M | M | M | M |

These tables let self-indication remain a value in the enlarged calculus. They also expose a changed identity. With two values, `E C(E)=M`; with `E=A`,

$$
A\,C(A)=AA=A\ne M.
$$

For another worked comparison,

$$
C(AM)=C(M)=U,\qquad C(A)M=AM=M.
$$

Placement remains consequential. The autonomous state is not introduced as a numerical average of the delayed oscillation, nor identified with QL zero. Varela changes the arithmetic's admissible values and laws. The primary definitions, initials and dominance rule are inspectable in the [paper scan, pp.7–8](https://homepages.math.uic.edu/~kauffman/VarelaCSR.pdf).

## #4 — The native return changes the office of mediation

The [native eight-determination traversal](../../../section-rooms/arguments/A18-Primordial-Symbolon-and-Its-Eight-Determinations.md) gives re-entry its QL relation. The parent slash differentiates into `0/1`, question/assertion, polarity, determining capacity and instance, personed presence and predication, differential horizon and `1/0` return. Through this whole field, an achieved determination enters a further account of the relation through which it arose.

The crossed-zero sequence in the [core theorem spine](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md), §IX, makes the changing mediation explicit:

The native sequence is **`0 → Ø → X → Ø/X → (0/Ø)/(1/X) → 1`, returning to `0/1`**. Here `Ø` marks occluded ground: the slash is initially fused into apparent selfhood, then becomes explicit between terms, then available as a meta-relation. It is not the empty set or the unmarked value `U` of the preceding calculus. Recognition changes the mediation's office.

Through [the determining-field limit](../../../section-rooms/arguments/A03-Immutable-Gap-Formal-Limit.md), representing the determining condition adds another determination whose occurrence still has conditions. Assigning `A` to the formal equation performs a different operation. [Individuation and recognition](../../../section-rooms/arguments/A21-Individuation-Recognition.md) carry return through the history of a life; a fixed arithmetic value alone holds no such history. Self-inclusion changes what an account must retain to work in each specific case. The mathematical, native and recognitive operations retain their respective objects and grounds.

## #5→0 — Carry the changed rule through the return

[Mark and re-entry](../../../section-rooms/04-mathematical-substrate/movements/27-s3-p2-mark-reentry-complex.md) carry three different achievements: terminating finite reduction, a declared delayed recurrence, and an extended arithmetic admitting an autonomous state. Translation among them specifies which structure is retained, so that the resulting operation keeps its actual input and law.

Through [computational process](../../../section-rooms/arguments/A14-Computational-Process-Ontology.md), a transformation inherits a condition, produces a result and changes what becomes available to the next operation. [Operational parity](../../../section-rooms/arguments/A33-Epistemic-Cultivation-Operational-Parity.md) makes implementation answerable to the actual differences: reducing a finite tree, updating a delayed loop, and evaluating a third-state expression each take a different input and produce their specific state or result. An evaluator exposes the performed operation through that distinction.

The mark returns with its rule visible. Calling preserves the value across repetition; crossing changes the value through enclosure; self-indication requires the account to specify how it has admitted its own operation. That is the formal material carried into the native relation, whose source and return remain its own.
