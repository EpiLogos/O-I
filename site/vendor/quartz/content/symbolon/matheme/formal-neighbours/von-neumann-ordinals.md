---
title: "Von Neumann Ordinals — The Predecessors Retained"
record_id: matheme-von-neumann-ordinals
record_type: matheme
register: matheme
claim_status: "Derived (finite construction); Argued (QL relation)"
source_relation: "Paraphrased mathematical workbench; Argued from native QL"
source_ids:
  - kaplan-1999-nothing-that-is
  - taylor-2026-core-theorems-pithy
  - taylor-2026-mono-poly-two-ones
---

# Von Neumann Ordinals — The Predecessors Retained

## #0 — A zero that can be a member

The finite von Neumann construction begins with an exact object: the empty set, written `∅`. A set is determined by its members; the empty set has none. We represent the natural number zero by this set and define a successor operation:

$$
0:=\varnothing,\qquad S(n):=n\cup\{n\}.
$$

Braces form a set: `{n}` has the single member `n`. Union, `∪`, gathers the members of its two operands. Thus `n ∪ {n}` retains every member of `n` and adjoins `n` itself as one further member. These two operations, enclosure and union, do different work. Their composition makes each new number hold the entire preceding number alongside all its predecessors.

[Kaplan's housed mathematical workbench](../../episteme/sources/mathematics-logic/kaplan/kaplan-1999-nothing-that-is/kaplan-1999-nothing-that-is.md#reading) sources the essay's encounter with the nested construction, locating it at printed p.211 of the selected 2000 OUP printing. The explicit successor rule is worked here from its definition. Kaplan quotation and the primary historical attribution retain the source house's verification debt; no copied Kaplan wording is used.

## #1 — The first enclosure changes the count

Apply the rule to zero:

$$
S(0)=\varnothing\cup\{\varnothing\}
=\{\varnothing\}=:1.
$$

The result has one member, although that member has no members. The distinction lies between the set and what belongs to it. The emptiness of the member does not empty the containing set. Writing `|A|` for the number of members of a finite set `A`, we obtain

$$
|0|=0,\qquad |1|=1,\qquad 0\in1,\qquad 0\ne1.
$$

Membership, `∈`, is therefore already different from equality. It is also different from inclusion, `⊆`: `A ⊆ B` means every member of `A` is a member of `B`. The empty set is a subset of every set, including itself, because it has no member that could violate that condition. Yet `0 ∉ 0`, while `0 ∈ 1`. The first enclosure gives zero a new office without altering the object represented by zero.

This makes the count available to inspection. There is no hidden positive item inside the empty set. The positive count belongs to the singleton, whose one member is exactly that empty set.

## #2 — Successor keeps what enclosure alone would lose

Apply the same rule again:

$$
\begin{aligned}
2:=S(1)&=1\cup\{1\}\\
&=\{0\}\cup\{1\}\\
&=\{0,1\}=\{\varnothing,\{\varnothing\}\}.
\end{aligned}
$$

The two members are distinct: zero has no members, whereas one has zero as its member. Enclosing one by itself would instead give `{1} = {{∅}}`, a set with only one member. That repeated singleton is not the ordinal two. Successor must retain the preceding contents as well as enclose their whole.

The next steps expose the pattern:

$$
\begin{aligned}
3:=S(2)&=\{0,1\}\cup\{2\}=\{0,1,2\},\\
4:=S(3)&=\{0,1,2\}\cup\{3\}=\{0,1,2,3\}.
\end{aligned}
$$

Each result includes the preceding number in two distinct respects: `n ⊆ S(n)` because its members are retained, and `n ∈ S(n)` because the preceding whole is newly admitted as a member. This double retention is the construction's exact generative operation. Repetition neither consumes zero nor replaces all earlier numbers with an opaque container.

## #3 — The number is its ordered inheritance

At every finite stage,

$$
n=\{0,1,\ldots,n-1\},\qquad |n|=n.
$$

For zero the list is empty. If a stage contains exactly its distinct predecessors, adjoining that stage yields the list with one new entry. The induction also retains the sizes of the preceding stages. The constructed stage is not already one of its predecessors: it has `n` members, while each earlier stage has fewer. The successor therefore increases cardinality by one. This gives the induction from the empty starting case to every finite stage.

The ordering is internal to these objects. For finite ordinals `m` and `n`, `m < n` exactly when `m ∈ n`. In `3 = {0,1,2}`, the earlier numbers retain their own membership relations: zero belongs to one and two; one belongs to two. Three consequently holds its predecessors with the order already realised among them. Its displayed enumeration can be rearranged on the page without changing the set or that membership order.

This is an exact representation of the finite natural numbers. The worked construction supplies any specified finite stage. Taking the collection of all finite stages as a set requires the further set-theoretic provision for infinity; no such collection is needed for the finite claims made here.

## #4 — The numerical floor of the linking one

Taylor's [Mono–Poly manuscript](../../episteme/sources/internal-corpus/taylor/taylor-2026-mono-poly-two-ones/taylor-2026-mono-poly-two-ones.md) argues from this operation: the first positive one carries zero internally, and the next step gathers zero and one while preserving their difference. The [core theorem spine](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md), §IX's linking-one synthesis, gives the relation its native symbolic reach. A determination carries an inherited condition within the form through which it becomes countable. The singleton is the precise mathematical instance from which that comparison proceeds.

The correspondence concerns **retention through determination**. Its objects differ by register. Here zero is an entirely specified set, available as an object of proof. In [A11, The Two Ones](../../../section-rooms/arguments/A11-The-Two-Ones-0-One-1-All.md), `0` bears singular One, the non-objectifiable condition of determination; `1` bears polyvalent All. Set membership supplies neither that ontological assignment nor a proof that awareness is empty set. It supplies an exact operation with which the native assignment can be compared.

The core's compression `2 = 0/1` reads the holding-together of zero and one symbolically. Its set-theoretic floor is `2 = {0,1}`. The slash in the compression names a retained relation; ordinary division would yield `0/1 = 0`. Keeping these readings explicit preserves the author's comparison at its full Argued force. [Homology and Analogy](../../episteme/etymologies/homology-and-analogy/WHOLE-FIELD.md) qualifies the relation by requiring this common operation and these different objects to remain visible.

[A02, the Copula](../../../section-rooms/arguments/A02-Copula-Self-Identity-through-Difference.md), extends the question into counting as an act: a new occurrence must be distinguishable while the previous count remains available. [A12, Mono/Poly](../../../section-rooms/arguments/A12-Mono-Poly-One-All-Whole-Many.md), extends it into the whole's relation to its real expressions. Neither extension turns successor into a universal causal mechanism. The set construction gives them a specific relation to answer to: the earlier field persists when its whole becomes a new participant.

## #5→0 — The empty set remains exact on return

This record returns-to [§1 · #2, The Empty Set Generates One](../../../section-rooms/02-return-of-zero/movements/15-s1-p2-empty-set-generates-one.md) with the distinction between membership, inclusion and cardinality intact. That movement can carry the linking-one reading because its mathematical floor is recoverable step by step. [A10, Advent of Zero](../../../section-rooms/arguments/A10-Advent-of-Zero.md), grounds its separate place among the chapter's generative procedures: successor, the empty product, mediants and NOR each have their own law.

[§1 · #5→0, The Loan Returns](../../../section-rooms/02-return-of-zero/movements/18-s1-p5-loan-returns.md), receives the achieved exactness. Zero remains present in every positive finite ordinal without acquiring members of its own. Its successive containing sets differ; the empty set does not accumulate their contents. The authorial return follows the condition through its determinations while preserving that distinction.

[A18's eight-determination traversal](../../../section-rooms/arguments/A18-Primordial-Symbolon-and-Its-Eight-Determinations.md) extends the native relation beyond this finite construction. [A36, Integral Zero](../../../section-rooms/arguments/A36-Advent-of-Integral-Zero.md), returns its acquired symbolic force to the exact mathematical sign. The ordinal remains a set of predecessors. What the essay carries onward is the relation made explicit by constructing it: the next determination retains the field from which its count becomes possible.
