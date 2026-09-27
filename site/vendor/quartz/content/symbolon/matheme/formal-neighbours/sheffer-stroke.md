---
title: "Sheffer Stroke — One Operation, Every Boolean Function"
record_id: matheme-sheffer-stroke
record_type: matheme
register: matheme
claim_status: "Derived (Boolean constructions); Argued (QL comparison)"
source_relation: "Paraphrased formal operation; Argued from native slash"
source_ids:
  - sheffer-1913-five-postulates
  - kaplan-1999-nothing-that-is
  - taylor-2026-core-theorems-pithy
---

# Sheffer Stroke — One Operation, Every Boolean Function

## #0 — Select the connective by its four outputs

Let `p` and `q` take Boolean values `0` and `1`, meaning false and true. Negation `¬` exchanges those values; conjunction `∧` is true when both inputs are true; disjunction `∨` is true when at least one is true. This page selects the modern NAND convention for the stroke:

$$
p\mid q:=\neg(p\land q).
$$

The down-arrow denotes NOR:

$$
p\downarrow q:=\neg(p\lor q).
$$

| `p` | `q` | `p ∧ q` | `p ∨ q` | `p ∣ q` — NAND | `p ↓ q` — NOR |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 1 | 1 |
| 0 | 1 | 0 | 1 | 1 | 0 |
| 1 | 0 | 0 | 1 | 1 | 0 |
| 1 | 1 | 1 | 1 | 0 | 0 |

The mixed-input rows distinguish the operations. NAND excludes the jointly true case; NOR selects the jointly false case. Each is a function from two Boolean inputs to one Boolean output.

[Sheffer's source house](../../episteme/sources/mathematics-logic/sheffer/sheffer-1913-five-postulates/sheffer-1913-five-postulates.md) sources the single-operation Boolean reduction. The notation here is an explicitly selected contemporary signature, not a transcription of his 1913 postulates. [Kaplan's worked source surface](../../episteme/sources/mathematics-logic/kaplan/kaplan-1999-nothing-that-is/kaplan-1999-nothing-that-is.md#reading) carries a NOR route, located at printed pp.212–215, alongside a distinct modern NAND exercise. The table keeps both routes available.

## #1 — Repeating an input earns negation

Feed the same value to both inputs of NAND:

$$
p\mid p=\neg(p\land p)=\neg p.
$$

The repetition binds two input places to one variable. It does not introduce a feedback loop. Applying this construction to the output of another NAND restores conjunction:

$$
(p\mid q)\mid(p\mid q)=\neg\neg(p\land q)=p\land q.
$$

Negate the inputs separately and NAND the results:

$$
(p\mid p)\mid(q\mid q)
=\neg(\neg p\land\neg q)
=p\lor q.
$$

One connective can therefore express negation, conjunction and disjunction through finite composition. The occurrences and their arrangement do the work. A single gate still computes only its one table; the expressive result concerns networks of that gate with reusable inputs.

## #2 — The construction reaches an arbitrary finite table

Take a Boolean function of a positive finite number of variables. For each input row on which its desired output is `1`, form a conjunction containing every variable: use the variable itself when that row assigns `1`, and its negation when the row assigns `0`. This conjunction is true on exactly that row. Disjoin all the selected conjunctions. The result agrees with the desired output on every row.

Every connective in this construction can be replaced by the NAND expressions in #1. That gives a NAND-only expression for the function. Constant outputs are available too: with any input variable `p`,

$$
U:=p\mid(p\mid p)=1,\qquad U\mid U=0.
$$

These constant functions ignore the input's value. The claim does not assume that a variable-free constant symbol has appeared from an empty expression.

Exclusive OR supplies a compact worked instance. It is true on the two mixed rows and false when the inputs agree. Define

$$
t=p\mid q,\qquad u=p\mid t,\qquad v=q\mid t,
\qquad r=u\mid v.
$$

| `p q` | `t` | `u` | `v` | `r` |
|---|---|---|---|---|
| 00 | 1 | 1 | 1 | 0 |
| 01 | 1 | 1 | 0 | 1 |
| 10 | 1 | 0 | 1 | 1 |
| 11 | 0 | 1 | 1 | 0 |

The four NAND gates realise XOR without adding a new primitive connective. The general row construction proves **functional completeness**: every Boolean function of finitely many inputs can be represented, with constant functions realised using an unused-value input as above. It says nothing about the smallest or fastest representation. A mechanically obtained expression can be large while remaining exact.

## #3 — The dual route is equally complete and differently placed

NOR also generates negation by repeating its input:

$$
\neg p=p\downarrow p.
$$

The remaining basis follows with the roles reversed:

$$
p\lor q=(p\downarrow q)\downarrow(p\downarrow q),
$$

$$
p\land q=(p\downarrow p)\downarrow(q\downarrow q).
$$

The row construction therefore applies to NOR as well. Its constant false function is `p ↓ (p ↓ p)`; feeding that result twice into NOR gives constant true.

Their duality can be written exactly. If `N(p,q)=p ∣ q`, then

$$
p\downarrow q=\neg N(\neg p,\neg q).
$$

Complementing inputs and output transforms one table into the other. Exchanging the two input places does not: both NAND and NOR are commutative. Their distinction is consequently Boolean duality, not a handedness produced merely by swapping `p` and `q`. Any further temporal or chiral interpretation requires an additional operation that makes order matter.

## #4 — The native slash retains a different account

[A13, Dia/Syn](../../../section-rooms/arguments/A13-Two-Logics-of-Two-Dia-Syn.md), grounds the native slash as the relation through which distinction and gathering remain answerable to one another. Its AND/OR operation holds the two original terms and their four self-relations, giving the native `2+2²=4+2` account. The [core-theorem spine](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md) sources that derivation within the whole eight-determination traversal.

A NAND gate assigns one output to each of four input pairs. Three different pairs yield `1`, so that output alone cannot reconstruct its input pair. The gate has performed its specification correctly. Retaining the inputs, their distinction, the chosen composition and the result would require a richer record than that single output bit. This is the precise point at which the native account can compare the Boolean reduction: a primitive can generate a rich field of expressions, while each reduction still has a determinate relation to what it retains and discards.

[A08, Constitutive Exclusion](../../../section-rooms/arguments/A08-Apoha-Constitutive-Exclusion.md), extends that question to how a selected determination depends on excluded alternatives. Its semantic operation exceeds truth-functional negation; the NAND table does not derive apoha. [A02, the Copula](../../../section-rooms/arguments/A02-Copula-Self-Identity-through-Difference.md), qualifies the repeated variable: distinct occurrences can identify the same input without becoming the same inscription. [A18](../../../section-rooms/arguments/A18-Primordial-Symbolon-and-Its-Eight-Determinations.md) extends the slash through its further determinations rather than treating Boolean completeness as their origin. These are defined relations between operations, held by [Homology and Analogy](../../episteme/etymologies/homology-and-analogy/WHOLE-FIELD.md).

## #5→0 — Return a construction that can be checked

[A10, Advent of Zero](../../../section-rooms/arguments/A10-Advent-of-Zero.md), receives the one-connective construction as its own generative procedure, distinct from empty-set succession, the empty product and mediants. This record returns-to [§3 · #2, Mark, Re-entry and Complex Orientation](../../../section-rooms/04-mathematical-substrate/movements/27-s3-p2-mark-reentry-complex.md) with the precise boundary between composing a Boolean expression and introducing temporal feedback. No oscillation follows from a finite acyclic truth-functional expression alone.

[A03, Formal Limit](../../../section-rooms/arguments/A03-Immutable-Gap-Formal-Limit.md), qualifies what completeness names here: representation of Boolean functions within a fixed signature. It is a different property from a theory deciding every sentence in its language. [A33, Operational Parity](../../../section-rooms/arguments/A33-Epistemic-Cultivation-Operational-Parity.md), tests a proposed implementation by evaluating the constructed expressions on every input row. If a technical system claims also to retain provenance, exclusions or context, those records and their effects require their own checks.

The achieved result is substantial and bounded: one Boolean operation suffices because its repeated, differentiated placements reconstruct every finite truth table. The return keeps those placements visible, so the compressed stroke remains answerable to the construction it carries.
