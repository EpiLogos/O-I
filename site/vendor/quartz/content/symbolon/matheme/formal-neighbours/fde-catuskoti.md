---
record_id: matheme-fde-catuskoti
title: "FDE, four-valued logic and catuṣkoṭi"
record_type: matheme
register: matheme
claim_status: Argued
formal_standing: "Derived: four-valued operations and consequence; Argued: native crossing and comparative return"
source_relation: "Paraphrased: Priest's reconstruction; Argued from: Taylor's native crossing; Paraphrased at recorded reception depth: Priest 2018 and Kapsner 2020"
source_ids: [priest-2010-logic-catuskoti, priest-2018-fifth-corner, kapsner-2020-cutting-corners, taylor-2026-core-theorems-pithy, taylor-2026-binary-explication]
---
# FDE, four-valued logic and catuṣkoṭi

## #0 — Two independent supports

A proposition can have support for its truth, support for its falsity, both, or neither. FDE makes these possibilities exact by permitting the two supports to vary independently. Write a value as a pair of bits \((a_T,a_F)\), or equivalently a subset of \(\{T,F\}\):

| Status | Set | Pair | Reading |
|---|---|---|---|
| \(t\) | \(\{T\}\) | \((1,0)\) | true only |
| \(f\) | \(\{F\}\) | \((0,1)\) | false only |
| \(b\) | \(\{T,F\}\) | \((1,1)\) | both |
| \(n\) | \(\varnothing\) | \((0,0)\) | neither |

The bits here record semantic support; they need not describe a person's beliefs. An ordinary FDE valuation assigns exactly one of these four statuses to each formula. Assigning \(b\) is therefore one status assignment containing both supports, not two competing assignments. Assigning \(n\) still assigns a value: the absence of both supports belongs inside the semantics.

[[symbolon/episteme/sources/mathematics-logic/priest/priest-2010-logic-catuskoti/priest-2010-logic-catuskoti.md#^priest-2010-logic-catuskoti-q003|Priest's formal reconstruction]] supplies this fourfold neighbour of the catuṣkoṭi. Its first gain is a precise place for contradiction and indeterminacy within one calculus. Their different consequences can now be calculated.

## #1 — The diamond has a direction

Negation exchanges the two supports. Conjunction requires both truth supports but either falsity support; disjunction requires either truth support but both falsity supports:

\[
\neg(a_T,a_F)=(a_F,a_T),
\]
\[
a\land c=(a_T\land c_T,\ a_F\lor c_F),\qquad
 a\lor c=(a_T\lor c_T,\ a_F\land c_F).
\]

The operations on the right are ordinary Boolean operations on bits. They produce these complete tables:

| \(a\) | \(\neg a\) |
|---|---|
| \(t\) | \(f\) |
| \(f\) | \(t\) |
| \(b\) | \(b\) |
| \(n\) | \(n\) |

| \(\land\) | \(t\) | \(f\) | \(b\) | \(n\) |
|---|---|---|---|---|
| \(t\) | \(t\) | \(f\) | \(b\) | \(n\) |
| \(f\) | \(f\) | \(f\) | \(f\) | \(f\) |
| \(b\) | \(b\) | \(f\) | \(b\) | \(f\) |
| \(n\) | \(n\) | \(f\) | \(f\) | \(n\) |

| \(\lor\) | \(t\) | \(f\) | \(b\) | \(n\) |
|---|---|---|---|---|
| \(t\) | \(t\) | \(t\) | \(t\) | \(t\) |
| \(f\) | \(t\) | \(f\) | \(b\) | \(n\) |
| \(b\) | \(t\) | \(b\) | \(b\) | \(t\) |
| \(n\) | \(t\) | \(n\) | \(t\) | \(n\) |

Conjunction is meet and disjunction join in the **truth order**: \(f\) is bottom, \(t\) is top, and \(b,n\) are incomparable between them. Formally, \(a\leq_t c\) means \(a_T\leq c_T\) and \(c_F\leq a_F\). Increasing truth support and decreasing falsity support move upward.

Set inclusion gives a different, information order: \(n\) is bottom, \(b\) is top, and \(t,f\) are incomparable. Confusing these diamonds changes the calculus. For example, FDE gives \(b\land n=f\) and \(b\lor n=t\); intersection and union of their support sets instead give \(n\) and \(b\). Truth combination does not simply accumulate information.

## #2 — Contradiction without arbitrary consequence

The designated values are \(D=\{t,b\}\): those containing truth support. Semantic consequence preserves designation:

\[
\Gamma\models_{\mathrm{FDE}} A
\quad\Longleftrightarrow\quad
\text{every valuation designating every member of }\Gamma\text{ designates }A.
\]

Take \(v(p)=b\) and \(v(q)=n\). Both \(p\) and \(\neg p\) are designated, while \(q\) is not. This one valuation proves

\[
p,\neg p\not\models_{\mathrm{FDE}}q.
\]

The contradiction is retained without licensing an unrelated conclusion. Conjunction elimination nevertheless survives: if \(p\land q\) has truth support, the defining first coordinate requires truth support for each conjunct. Thus \(p\land q\models p\). Nonexplosion has a determinate inferential shape, rather than suspending inference altogether.

The gap has its own consequence. At \(v(p)=n\), both negation and disjunction return \(n\), so \(p\lor\neg p\) is not valid. The failure of excluded middle and the failure of explosion arise at different assignments. Four statuses preserve that difference.

They must also be distinguished from four object-language formulas. At \(p=b\), the formulas \(p\), \(\neg p\), and \(p\land\neg p\) are all designated. Their designation does not make them exclusive corners. Exclusivity belongs to the classification of a valuation as true-only, false-only, both, or neither. This separation of a status from an assertion about it is essential to the formal reconstruction.

## #3 — What adding a fifth changes

[[symbolon/episteme/sources/mathematics-logic/priest/priest-2010-logic-catuskoti/priest-2010-logic-catuskoti.md#^priest-2010-logic-catuskoti-q004|Priest's further construction]] introduces an ineffable status \(e\), outside the four-value lattice. In the infectious extension, \(\neg e=e\), and a conjunction or disjunction with an \(e\) input yields \(e\). This is an additional semantic rule. Nothing in the preceding four-valued tables generates a fifth output or requires one.

In particular, \(e\neq n\). The value \(n\) already means neither truth nor falsity support within the specified fourfold. Introducing \(e\) changes the range of evaluation to mark another status; it does not discover an unoccupied subset of \(\{T,F\}\).

[[symbolon/episteme/sources/mathematics-logic/priest/priest-2010-logic-catuskoti/priest-2010-logic-catuskoti.md#^priest-2010-logic-catuskoti-q005|Plurivalence changes a second feature]]: evaluation becomes a relation rather than a single-valued function. A formula can stand in that relation to both \(t\) and \(e\). The collection \(\{t,e\}\) is a plurality of semantic statuses; it is not the original status \(b=\{T,F\}\). One construction enlarges the available values; the other permits multiple value assignments. A consequence relation for the enlarged construction requires its own designation and preservation conditions. The FDE nonexplosion calculation above proves exactly what it states without deciding those further conditions.

## #4 — The crossing changes the relation to judgment

The [[symbolon/episteme/sources/internal-corpus/taylor/taylor-2026-binary-explication/taylor-2026-binary-explication.md|Binary Explication]] places encounter before its Catuṣkoṭi crossing. At #0, appearing is already known before that situation becomes the proposition to be tested. IS then affirms awareness and phenomenon's inseparability; IS-NOT preserves their difference. BOTH holds identity and difference together. NEITHER exposes the limit of treating that holding as a position from which the whole can be possessed.

These are successive pressures on **0/1**. The slash carries the changes of respect through which their assertions belong to one relation. FDE supplies an exact account of simultaneous positive and negative support; the native crossing asks how the situation supporting assertion is encountered through affirmation, negation, their conjunction, and their limit. Its consequence returns to [[section-rooms/arguments/A13-Two-Logics-of-Two-Dia-Syn|A13]]: distinguishing and binding remain internally related operations. The four mathematical statuses do not by their number alone establish dia/syn.

The [[symbolon/episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md|native theorem spine]] retains the generating two within **2+2²**. FDE's four combinations give a precise comparison for the squared term. Its support bits are not thereby the native One and All, and the four-valued carrier is not a six-position QL field. [[section-rooms/arguments/A18-Primordial-Symbolon-and-Its-Eight-Determinations|A18]] supplies the whole eight-determination movement within which this local comparison bears its weight.

## #5→0 — SILENCE carries the crossing back

In the native definition, SILENCE belongs at **#5**, Real-isation. It gathers the four corners as lived texture and returns to **#0**, encounter. Calling it the fifth names this gathering after the crossing; it does not append a fifth truth value. Neither \(n\), the semantic gap, nor \(e\), the added ineffable status, performs that return merely by being assigned. The native **5→0** is an operation through which the same situation is encountered with its distinctions included. This preserves [[section-rooms/arguments/A34-Idealism-Order-of-Dependence|A34's order of dependence]]: the field of appearing is not inferred into existence from a choice of logical values. [[section-rooms/arguments/A36-Advent-of-Integral-Zero|A36]] carries the return as integral recognition, rather than a newly counted object.

That distinction leaves the historical comparison answerable to its evidence. [[symbolon/episteme/sources/mathematics-logic/kapsner/kapsner-2020-cutting-corners/kapsner-2020-cutting-corners.md#^kapsner-2020-cutting-corners-q001|Kapsner's verified abstract]] challenges the fifth value and announces an alternative; it does not establish the details of that alternative here. The [[symbolon/episteme/sources/mathematics-logic/priest/priest-2018-fifth-corner/priest-2018-fifth-corner.md|recorded reception of Priest's book]] also contains presupposition-failure readings and objections to uniform treatment across Buddhist contexts. Saying that QL #0 is not a value answers a concrete conflation; it does not settle those separate historical questions or make Priest's reconstruction a consensus.

This page therefore returns to [[section-rooms/04-mathematical-substrate/movements/28-s3-p3-projective-dimensional-reframing|§3 · #3]] a specified enlargement of logical space: two independent supports, four statuses, exact connectives, and truth-preserving consequence without explosion. It returns to [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|A03]] the distinction between altering a calculus and accounting for its ground. The lived passage through SILENCE remains the native operation established in its own register, carrying the formal work back to the circumstance in which judgment occurs.
