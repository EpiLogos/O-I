---
title: "Gödel Incompleteness — The Proof Relation Turned Inward"
record_id: matheme-godel-incompleteness
record_type: matheme
register: matheme
claim_status: "Derived (scoped formal theorems); Argued (formal-limit relation)"
source_relation: "Paraphrased formal results; Argued cross-register relation"
source_ids:
  - godel-1931-undecidable-propositions
  - raatikainen-2026-godel-incompleteness-sep
  - taylor-2026-core-theorems-pithy
---

# Gödel Incompleteness — The Proof Relation Turned Inward

## #0 — Fix the theory before asking what it can settle

Let `T` be a classical first-order theory extending Peano arithmetic, PA, with effectively enumerable axioms and effective inference rules. This is a sufficient arithmetic setting for both theorems developed here. The first theorem also holds for consistent effectively axiomatized extensions of the weaker Robinson arithmetic `Q`; the second requires control of the internal provability predicate in addition to arithmetic expressiveness.

Write `T ⊢ A` when there is a finite derivation of sentence `A` from `T`. **Consistency** means `T` does not derive a contradiction. **Completeness** means that for every sentence `A` in its language, `T ⊢ A` or `T ⊢ ¬A`. **Soundness for the natural numbers** means every arithmetic theorem of `T` is true in the standard natural-number structure, `ℕ`. Soundness implies consistency; consistency alone does not assert that every theorem is true in `ℕ`.

Effective enumeration lets axioms, and hence proofs, be generated mechanically. It does not provide a terminating decision procedure for whether an arbitrary sentence has a proof. For enumerable axioms, finite proof certificates can include the computation witnessing an axiom's appearance in the enumeration. Each such certificate can then be checked in finite time. The distinction between checking a supplied proof and deciding whether any proof exists drives the construction.

## #1 — Arithmetic acquires a statement about its proofs

Assign natural-number codes to symbols, formulas and finite proof certificates. The notation `⌜A⌝` denotes the code of `A`, represented inside arithmetic by its numeral. Let `Prf_T(p,a)` express that `p` codes a valid `T`-proof of the sentence coded by `a`. Define

$$
\operatorname{Prov}_T(a):=\exists p\,\operatorname{Prf}_T(p,a).
$$

This is an arithmetic formula about numbers. Its intended interpretation concerns proofs because the coding and checking operations have been specified. A sentence and its code remain different objects.

The diagonal lemma supplies a sentence `G_T` whose fixed-point equivalence is already provable in the arithmetic base, and hence in `T`:

$$
\mathrm{PA}\vdash G_T\leftrightarrow
\neg\operatorname{Prov}_T(\ulcorner G_T\urcorner).
$$

The fixed point is earned by the arithmetically representable operation of substituting a formula’s own code into its free variable. Its informal reading is that this sentence has no `T`-proof. The displayed equivalence is the formal premise used below. [Gödel’s 1931 result](../../episteme/sources/mathematics-logic/godel/godel-1931-undecidable-propositions/godel-1931-undecidable-propositions.md) retains its original historical formulation; this construction uses contemporary notation with its stated hypotheses.

## #2 — One consistency assumption does not do both jobs

Suppose `T ⊢ G_T`. The finite proof has a code, and the arithmetic representation of proof checking yields

$$
T\vdash\operatorname{Prov}_T(\ulcorner G_T\urcorner).
$$

The fixed-point equivalence also yields its negation. Therefore, if `T` is consistent, `T ⊬ G_T`. Under the standard coding, there is consequently no natural number coding such a proof; `G_T` is true in `ℕ`. This particular truth conclusion does not make all of `T` sound.

To exclude `T ⊢ ¬G_T` by Gödel's original route requires more. That negation would give `T ⊢ ∃p Prf_T(p,⌜G_T⌝)`. Yet consistency already excludes any actual proof of `G_T`, and arithmetic verifies, for each particular natural number `n`, that `n` does not code one. **ω-consistency** forbids precisely this combination: proving an existential claim while proving its failure for every standard numeral. Gödel's 1931 two-sided result uses that stronger hypothesis. For this argument, soundness for existential arithmetic sentences with decidable witnesses, usually called **Σ₁-soundness** or **1-consistency** in this setting, suffices.

Rosser changes the fixed point so that it compares codes of proofs of a sentence and its negation. His refinement obtains an undecidable sentence from ordinary consistency alone. The modern result is therefore:

$$
T\text{ consistent and effectively axiomatized},\quad T\supseteq Q
\quad\Longrightarrow\quad
\exists R\;(T\nvdash R\ \text{and}\ T\nvdash\neg R).
$$

The changed sentence earns the weakened hypothesis. The [modern distinction among the versions](../../episteme/sources/mathematics-logic/raatikainen/raatikainen-2026-godel-incompleteness-sep/raatikainen-2026-godel-incompleteness-sep.md), §§2.1–2.5, separates Gödel’s original route from Rosser’s refinement. Their different proof conditions remain explicit in the conclusion.

## #3 — Consistency becomes an internal sentence

Return to the PA-strength setting and the standard provability predicate. Abbreviate `Prov_T(⌜A⌝)` by `□A`; let `⊥` stand for `0 = 1`. The internal consistency statement is

$$
\operatorname{Con}(T):=\neg\Box\bot.
$$

The proof requires these derivability conditions:

$$
\begin{aligned}
T\vdash A&\ \Longrightarrow\ T\vdash\Box A,\\
T&\vdash\Box(A\to B)\to(\Box A\to\Box B),\\
T&\vdash\Box A\to\Box\Box A.
\end{aligned}
$$

They express that theoremhood can be represented, that the represented proofs compose by modus ponens, and that the theory can represent that representation again. An arbitrary predicate labelled “provable” does not receive these properties by naming.

Here is the decisive internal calculation. From `G_T → ¬□G_T`, the first two conditions give `□G_T → □¬□G_T`. The third gives `□G_T → □□G_T`. Thus a proof of `G_T` would produce represented proofs of both `□G_T` and its negation. By the encoded proof-combination operations,

$$
T\vdash\Box G_T\to\Box\bot.
$$

Taking the contrapositive and using the fixed point yields

$$
T\vdash\operatorname{Con}(T)\to\neg\Box G_T
\to G_T.
$$

If consistent `T` proved `Con(T)`, it would prove `G_T`, contradicting #2. Hence `T ⊬ Con(T)`. [David Marker's *Metamathematics*, §11, Theorems 11.10–11.11](https://homepages.math.uic.edu/~marker/math502-F15/mm.pdf), gives the derivability conditions and this PA-based second-theorem argument. The choice of formal consistency statement is part of the result.

## #4 — Enlargement changes the question's address

An undecidable sentence is undecidable **in `T`**. Adjoining it as an axiom produces a new theory in which it is provable. If `T` is consistent and decides neither `R` nor `¬R`, both `T+R` and `T+¬R` are consistent: a contradiction from either added axiom would, by the deduction theorem, make `T` prove its negation. Consistency of the two extensions does not make their contrary assertions both true in `ℕ`.

An effective consistent extension still containing arithmetic has its own incompleteness. The new fixed point refers to the enlarged proof relation. [Formal-limit recurrence](../../../section-rooms/arguments/concepts/C04-Formal-Limit.md) compares this specified relocation with the determining-field argument: successful inclusion changes the present theory while leaving a new operation of determination to be accounted for.

In the [native determining-field relation](../../../section-rooms/arguments/A03-Immutable-Gap-Formal-Limit.md), a representation of the determining condition is another determination occurring through conditions. Its object is the relation between determining and determined; Gödel’s object is derivability in a specified arithmetic theory. The [native eight determinations](../../../section-rooms/arguments/A18-Primordial-Symbolon-and-Its-Eight-Determinations.md) carry the former through the slash, `0/1`, question/assertion, polarity, `X/x`, `AM/IS`, `∞/dx` and return. These offices have no supplied translation identifying them with `Prf_T`. [Homology and analogy](../../episteme/etymologies/homology-and-analogy/WHOLE-FIELD-homology-and-analogy.md) retain the stated operational comparison and its specific limits.

## #5→0 — Return the theorem with its conditions

The [formal-limit genealogy](../../../section-rooms/00-integral-threshold/movements/04-s01-p3-formal-limit-genealogy.md) receives the proof relation turned inward: effective checking allows arithmetic to encode its proofs; the fixed point obstructs completeness and, under the internal derivability conditions, a proof of its own consistency. Enlarging the theory changes the proof relation to which the next question is addressed.

[Committed reliance](../../../section-rooms/arguments/A23-Trust-Faith-and-the-Formal-Limit.md) carries the further practical relation. The theorem specifies what the chosen internal certificate cannot establish; choosing and justifying a stronger framework remains mathematical and practical work. An act of entrusting gives that further relation its own ground rather than deriving it from `T ⊬ Con(T)`.

[Operational parity](../../../section-rooms/arguments/A33-Epistemic-Cultivation-Operational-Parity.md) makes a technical use answerable through its actual theory, encoding, proof predicate and claimed certificate. A timeout or failed proof search supplies none of the two-sided unprovability established above. [Faithful definition](../../../section-rooms/arguments/A01-Subject-God-and-Faithful-Definition.md) carries the distinction between an exact assertion and the claim to exhaust its conditions. Through [Integral recognition](../../../section-rooms/arguments/A36-Advent-of-Integral-Zero.md), that achieved exactness returns into the wider Symbolon. The theorem keeps its force wherever its conditions accompany its use.