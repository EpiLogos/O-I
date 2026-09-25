---
record_id: matheme-kauffman-iterants
title: Kauffman iterants
record_type: matheme
register: matheme
claim_status: Argued
formal_standing: "Derived: real two-place shift algebra, complex subalgebra and explicit representation example; Argued: native phase comparison"
source_relation: "Extracted and Argued from: Kauffman arXiv v2; Argued from: native theorem spine and Binary Explication"
source_ids: [kauffman-2014-iterants-fermions-dirac-arxiv, taylor-2026-core-theorems-pithy, taylor-2026-binary-explication]
---
# Kauffman iterants

## #0 — An alternation has two views

The periodic sequence

\[
\ldots,a,b,a,b,a,b,\ldots
\]

can be read from either phase, as \([a,b]\) or \([b,a]\). The sequence supplies the relation between those views; a view specifies which entry comes first. [[symbolon/episteme/sources/mathematics-logic/kauffman/kauffman-2014-iterants-fermions-dirac-arxiv/kauffman-2014-iterants-fermions-dirac-arxiv.md#^kauffman-2014-iterants-fermions-dirac-arxiv-q001|Kauffman's selected iterant construction]] makes the passage between them algebraic. A sign pattern alone has square \([1,1]\). A sign pattern composed with its phase shift will have square \([-1,-1]\). The shift is therefore part of the element whose square is calculated.

Work over the real numbers. Add and multiply unshifted pairs componentwise:

\[
[a,b]+[c,d]=[a+c,b+d],\qquad [a,b][c,d]=[ac,bd].
\]

Identify a scalar \(r\) with \([r,r]\). These operations distinguish the entries while giving them a common scalar algebra. To carry alternation through multiplication, another rule is needed.

## #1 — The shift changes the multiplication

Introduce \(\eta\), with

\[
\eta^2=1,\qquad [a,b]\eta=\eta[b,a].
\]

Equivalently, \(\eta[a,b]=[b,a]\eta\). Moving the shift through a pair exchanges the entries. A two-place iterant expression has the form \(u+v\eta\), with \(u,v\in\mathbb R^2\). If \(\sigma[a,b]=[b,a]\), multiplication expands as

\[
(u+v\eta)(w+x\eta)
=uw+v\sigma(x)+(ux+v\sigma(w))\eta.
\]

Thus the phase change remains effective inside a product. It cannot be discarded after drawing the alternating sequence.

There is a concrete real-matrix representation:

\[
[a,b]\longmapsto
\begin{pmatrix}a&0\\0&b\end{pmatrix},\qquad
\eta\longmapsto
\begin{pmatrix}0&1\\1&0\end{pmatrix}.
\]

It sends \([a,b]+[c,d]\eta\) to \(\begin{pmatrix}a&c\\d&b\end{pmatrix}\). Every real \(2\times2\) matrix has exactly one such expression. Matrix multiplication verifies the exchange rule and gives an associative, faithful realisation of the algebra. This specified two-place representation loses no coefficient information.

## #2 — Why the square is negative

Use the sign convention of Kauffman's v2 construction:

\[
\epsilon=[-1,1],\qquad i=\epsilon\eta.
\]

The phase shift anticommutes with the sign pair: \(\eta\epsilon=-\epsilon\eta\). Consequently,

\[
\begin{aligned}
i^2
&=[-1,1]\eta[-1,1]\eta\\
&=[-1,1][1,-1]\eta^2\\
&=[-1,-1]=-1.
\end{aligned}
\]

Both \(\epsilon\) and \(\eta\) square to \(1\); their ordered composite squares to \(-1\). The negative result is produced by their anticommutation. Choosing the other starting phase gives \([1,-1]\eta=-i\), whose square is also \(-1\). More exactly, conjugating by the shift exchanges them: \(\eta i\eta=-i\).

By contrast, the pair \([-1,1]\) alone has square \([1,1]\). Nor does the arithmetic mean of its alternating entries, zero, produce the required square. The construction retains the relation between sign and shift rather than replacing the process by one sampled entry or its average.

The real recurrence \(R(x)=-1/x\), defined for \(x\neq0\), helps locate this operation. It satisfies \(R^2(x)=x\) and has no real fixed point; starting at \(1\) gives the period-two orbit \(1,-1,1,\ldots\). The iterant algebra supplies an element satisfying \(i=-1/i\). This is an enlargement of the algebra in which a fixed point can be expressed, not convergence of that real orbit.

## #3 — The ordinary complex numbers are present exactly

The matrix of the constructed \(i\) is

\[
J=\begin{pmatrix}0&-1\\1&0\end{pmatrix},\qquad J^2=-I.
\]

It sends \((x,y)\) to \((-y,x)\), the positive quarter-turn in the usual oriented plane. The matrices \(aI+bJ\) form a subalgebra, and

\[
(aI+bJ)(cI+dJ)=(ac-bd)I+(ad+bc)J.
\]

This gives an isomorphism from ordinary \(\mathbb C\) into the iterant algebra, with \(a+bi\) represented by \(aI+bJ\). For example, \((2+3i)(4-i)=11+10i\); the two matrix products give \(\begin{pmatrix}11&-10\\10&11\end{pmatrix}\). The temporal presentation and the familiar complex multiplication agree exactly on this subalgebra.

The larger algebra remains noncommutative. The fact that \(i\) commutes with every \(a+bi\) does not make it commute with \(\eta\). Likewise, changing phase by \(\eta i\eta=-i\) differs from multiplying a vector by \(i\): the former reverses the chosen complex orientation, while the latter rotates within it. Four applications of \(J\) return a vector to its starting point; two applications of the bare shift already return its two-place address.

## #4 — More than one representation can carry a matrix

Kauffman's [[symbolon/episteme/sources/mathematics-logic/kauffman/kauffman-2014-iterants-fermions-dirac-arxiv/kauffman-2014-iterants-fermions-dirac-arxiv.md#^kauffman-2014-iterants-fermions-dirac-arxiv-q002|nontrivial-kernel qualification]] concerns a broader construction using permutation groups. It does not contradict the faithful two-place representation above. An explicit three-place example exhibits the distinction.

Let the underlying real vector space be the direct sum of one copy of \(\mathbb R^3\) for each permutation in \(S_3\), and represent \(a\sigma\) as \(\operatorname{diag}(a)P_\sigma\). Put \(e_1=[1,0,0]\), and let \(\tau=(23)\) exchange the second and third places. Then

\[
p(e_1\,\mathrm{id})=E_{11}=p(e_1\tau).
\]

The two expressions occupy different permutation components, so \(e_1\,\mathrm{id}-e_1\tau\) is a nonzero formal element. Its representing matrix is zero: the retained first row cannot detect a swap of the other two rows' destinations. Adding this kernel element changes an expression without changing its image.

A representation can therefore make a process visible without uniquely recovering every process expression from the resulting matrix. This is a specific limitation of a map, with a worked witness. It prevents the success of the iterant construction from establishing one uniquely privileged ontology of time or alternation. The exact complex subalgebra survives that qualification intact.

## #5→0 — Return preserves the phase's office

The [[symbolon/episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md|native theorem spine]] places its rotational account within the full eight-determination movement. Its cardinal sequence runs North, East, West, South: the local **#2→#3** step crosses the diameter, from **01** to **10**, rather than making four successive quarter-turns. The square-root construction supplies an exact algebra for complex orientation; it does not replace that native sequence with the orbit \(1,i,-1,-i\).

The [[symbolon/episteme/sources/internal-corpus/taylor/taylor-2026-binary-explication/taylor-2026-binary-explication.md|Binary Explication]] also distinguishes the completed definitional return **0/1 = 4+2 = 5→0 = 0/1** from the process traversal continuing through **1/0 = 4′+2′ = 5′→0′** to **0/1**. File Two's inverse-phase primes and File Three's Night-pass primes have their respective offices. None is defined merely by exchanging the entries of a period-two pair. The comparison gains force by preserving what each phase change actually does.

[[section-rooms/arguments/A02-Copula-Self-Identity-through-Difference|A02]] receives a precise formal neighbour for identity carried through difference: the square \(-1\) is achieved through the exchanged signs and retained shift. [[section-rooms/arguments/A14-Computational-Process-Ontology|A14]] receives an executable transformation grammar. Its account of a result changing subsequent availability remains an additional native operation: \(\eta^2=1\) by itself records no accumulating history. [[section-rooms/arguments/A16-Arche-Topos-as-Differential-Field|A16]] places orientation among distinct transformations, and [[section-rooms/arguments/A17-Toroidal-Circulation-and-the-Arche-Topos|A17]] distinguishes cyclic repetition from a return that retains travel.

The result returns to [[section-rooms/04-mathematical-substrate/movements/27-s3-p2-mark-reentry-complex|§3 · #2]] as an explicit sign–shift product, with its complex-number isomorphism and representation boundary. [[section-rooms/arguments/A18-Primordial-Symbolon-and-Its-Eight-Determinations|A18]] carries it back into the whole native field. The formal operation is complete; its whole-bearing use depends on retaining both the construction and the source relation through which it entered the argument.
