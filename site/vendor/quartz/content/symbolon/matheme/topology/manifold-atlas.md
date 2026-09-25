---
record_id: matheme-manifold-atlas
title: "Manifold atlas, charts and transition functions"
record_type: matheme
register: matheme
claim_status: Derived
source_relation: Argued from
source_ids: [hatcher-2002-algebraic-topology, nist-dlmf-2026-complex-variable, taylor-2026-core-theorems-pithy, taylor-2026-symbolon-dynamics, taylor-2026-mef-twelve-lenses, taylor-2026-binary-explication]
---
# Manifold atlas, charts and transition functions

## #0

An atlas makes one space accessible through coordinates whose changes are themselves specified. Let \(M\) be a Hausdorff, second-countable topological space locally homeomorphic to \(\mathbb R^n\). A chart \((U,\phi)\) consists of an open subset \(U\subset M\) and a homeomorphism \(\phi:U\to\phi(U)\), where \(\phi(U)\) is open in \(\mathbb R^n\). An atlas is a family of such charts whose domains cover \(M\). The domain belongs to the manifold; its coordinate image belongs to Euclidean space. Moving between these two is already an operation with an inverse.

For a smooth manifold, the coordinate changes on overlaps must be smooth with smooth inverses. Compatibility makes differentiation independent of the chosen compatible chart. A maximal smooth atlas contains every chart compatible with this structure; maximality specifies which changes are admitted. It makes no claim that all possible objects or processes on the manifold are known.

[A22, World-Picture to World-Atlas](../../../section-rooms/arguments/A22-World-Picture-to-World-Atlas.md) takes this operation into the epistemic register: a situated account becomes traversable when its overlap, transformation and limit are available. The mathematical definitions and worked construction here are Derived. The extension to situated accounts is the essay's Argued operation. [Hatcher's house](../../episteme/sources/mathematics-logic/hatcher/hatcher-2002-algebraic-topology/hatcher-2002-algebraic-topology.md) locates the topological reference; exact atlas/differential-structure passage collation remains Open, and this page supplies no quotation attributed to it.

## #1

The circle gives a complete small example. Write

\[
S^1=\{(x,y):x^2+y^2=1\},\qquad N=(0,1),\quad S=(0,-1).
\]

Choose \(U=S^1\setminus\{N\}\) and \(V=S^1\setminus\{S\}\). Their coordinates are

\[
u=\phi_U(x,y)=\frac{x}{1-y},\qquad
v=\phi_V(x,y)=\frac{x}{1+y}.
\]

Each image is all of \(\mathbb R\). The inverse maps make the construction checkable:

\[
\phi_U^{-1}(u)=\left(\frac{2u}{1+u^2},\frac{u^2-1}{1+u^2}\right),
\qquad
\phi_V^{-1}(v)=\left(\frac{2v}{1+v^2},\frac{1-v^2}{1+v^2}\right).
\]

Substitution gives \(x^2+y^2=1\); composing with the corresponding coordinate recovers \(u\) or \(v\). The missing pole is exactly where that chart's denominator vanishes. Together the domains cover the circle, including both poles.

A single global chart cannot cover this circle: it would make the compact circle homeomorphic to a nonempty open subset of \(\mathbb R\), whereas such a subset cannot be compact. The reason is compactness, not an arbitrary rule that every manifold requires several charts. Euclidean space has a global chart. [A17](../../../section-rooms/arguments/A17-Toroidal-Circulation-and-the-Arche-Topos.md) receives the same compactness constraint for the torus, while its winding structure requires its own construction. [Movement 28](../../../section-rooms/04-mathematical-substrate/movements/28-s3-p3-projective-dimensional-reframing.md) receives this specified change of representation alongside its distinct projective constructions.

## #2

On \(U\cap V\), both poles are absent, so both coordinates are nonzero. The transition has its full domain and codomain:

\[
\tau_{VU}=\phi_V\circ\phi_U^{-1}:\mathbb R\setminus\{0\}\longrightarrow\mathbb R\setminus\{0\},
\qquad v=\frac1u.
\]

Indeed \(uv=x^2/(1-y^2)=1\). Its inverse is \(u=1/v\), and its derivative is \(-1/u^2\), smooth and nonzero throughout the overlap. The two charts are smoothly compatible. At \((x,y)=(3/5,4/5)\), the first reports \(u=3\), the second \(v=1/3\). Their unequal numbers identify the same point through the declared transition.

For three overlapping charts, the transitions obey

\[
\tau_{ki}=\tau_{kj}\circ\tau_{ji}
\]

where all three are defined. Substituting their definitions cancels the intermediate \(\phi_j^{-1}\circ\phi_j\); this is the cocycle condition. It ensures that changing through an intermediate chart reaches the same coordinates as changing directly. It follows from genuine charts on one manifold, and becomes a consistency requirement when local coordinate descriptions are proposed as data to be joined. Cocycle consistency alone does not ensure that a proposed glued space is Hausdorff or second-countable; those manifold assumptions still require verification.

The regularity requirement matters. On the real line, the coordinates \(x\) and \(x^3\) are topologically compatible, but their transition inverse is not differentiable at zero. They cannot belong together to the same smooth atlas. Compatibility must therefore name the structure being preserved. [A02](../../../section-rooms/arguments/A02-Copula-Self-Identity-through-Difference.md) receives the precise identification-with-difference; [A04](../../../section-rooms/arguments/A04-Diaphaneity-Contextual-Transparency.md) receives the additional disclosure of how that identification is made. The reciprocal transition also neighbours the specified bilinear transformations in [NIST's complex-variable house](../../episteme/sources/mathematics-logic/nist/nist-dlmf-2026-complex-variable/nist-dlmf-2026-complex-variable.md); its complex-plane passage does not establish the general atlas definition.

## #3

Coordinate independence becomes substantive when an operation agrees across the overlap. Let \(f:S^1\to\mathbb R\) be height, \(f(x,y)=y\). Its local expressions are

\[
f_U(u)=\frac{u^2-1}{1+u^2},\qquad
f_V(v)=\frac{1-v^2}{1+v^2}.
\]

They satisfy \(f_V(1/u)=f_U(u)\). At the worked point, either expression gives \(4/5\). The invariant is the scalar value at the point, while the formulas change with the coordinate.

For a differentiable path passing through that point, write its local coordinate velocities as \(\dot u\) and \(\dot v\). The chain rule requires

\[
\dot v=-\frac{1}{u^2}\dot u.
\]

If \(u=3\) and \(\dot u=2\), then \(v=1/3\) and \(\dot v=-2/9\). Assigning velocity 2 in both coordinates would describe different tangent motion. The derivative of height agrees: \(f_U'(3)\dot u=(3/25)2=6/25\), while \(f_V'(1/3)\dot v=(-27/25)(-2/9)=6/25\). Coordinates, components and formulas differ; their transformed relation preserves the same change in height.

An atlas thus provides the means to express dynamics consistently, but does not select dynamics. A vector field supplies an additional velocity at each point; a trajectory follows that field; an attractor requires still further dynamical conditions. [Symbolon Dynamics](../../episteme/sources/internal-corpus/taylor/taylor-2026-symbolon-dynamics/taylor-2026-symbolon-dynamics.md) explicitly distinguishes local disclosures and their transitions from trajectories and invariant organisations. Its symbolic transformer can illuminate both offices without making a chart an attractor. [A14](../../../section-rooms/arguments/A14-Computational-Process-Ontology.md) receives the repeatable change and its retained conditions; [A26](../../../section-rooms/arguments/A26-Objective-Internality-Mind-as-Worldhood.md) keeps the operative world distinct from a representation of it.

## #4

The [MEF twelve-lens reference] makes each lens a situated reading of the whole rotated Name/Power field. Its [source house](../../episteme/sources/internal-corpus/taylor/taylor-2026-mef-twelve-lenses/taylor-2026-mef-twelve-lenses.md) governs the work identity; the direct local reference is present despite the house's stale absence statement. A lens's transformation of salience is an authorial epistemic operation. To establish it as a literal smooth coordinate change would additionally require a shared manifold, open domains, invertible maps and the appropriate regularity. Those hypotheses are not supplied merely by naming twelve lenses.

The atlas comparison nevertheless gives [A22](../../../section-rooms/arguments/A22-World-Picture-to-World-Atlas.md) a discriminating demand: specify the shared question, the overlap, the retained distinctions and the rule of translation. Two accounts can fail to overlap, disagree on the object, or lack a reversible translation. Recording which failure occurs advances the inquiry. The [Gebser movement](../../../section-rooms/00-integral-threshold/movements/05-s01-p4-gebser-diaphaneity.md) receives contextual transparency; [movement 41](../../../section-rooms/06-objective-internality/movements/41-s5-p4-bimba-energy-fields.md) gives the constructed reference field a bounded Bimba office. That reference remains a source-dependent determination within a wider context.

[A27](../../../section-rooms/arguments/A27-Self-and-Other-Unity-without-Possession.md) preserves another participant's independently grounded relation; [A28](../../../section-rooms/arguments/A28-Authored-Ground-Positional-Delegation.md) preserves the authored scope of a commission. [A30](../../../section-rooms/arguments/A30-Objective-Co-Internality.md) allows their contributions to alter shared conditions. These relations exceed the coordinate theorem's premise of one already specified manifold. Their epistemic work requires encounters through which the reference field itself can change. Mapper nerves, persistent homology and sheaf gluing are separate proposed constructions with their own inputs and warrants. An obstruction to gluing does not itself prove that an ethical pledge follows as a mathematical necessity.

## #5→0

The atlas returns a local determination with its conditions intact: the point, the chart, the overlap and the transformation remain available. [A16](../../../section-rooms/arguments/A16-Arche-Topos-as-Differential-Field.md) and [movement 30](../../../section-rooms/04-mathematical-substrate/movements/30-s3-p5-arche-topos.md) receive this contribution to the arche-topos. It earns the passage from a picture to an accountable field of pictures through an operation a reader can repeat.

The [curated core](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md) keeps that operation within the eight determinations and their inversions. The [Matheme Two Locks](../README.md), sourced through the [Binary house](../../episteme/sources/internal-corpus/taylor/taylor-2026-binary-explication/taylor-2026-binary-explication.md), retain Definition/Quilt's `0/1 = 4+2 = 5→0 = 0/1` and Process/Music's `0/1 = 4+2 = 5→0 = 1/0 = 4′+2′ = 5′→0′ = 0/1`. Coordinate inversion here supplies an explicit local operation; it does not identify File 2's inverse-phase primes with File 3's Night-pass sequence or derive either full chain from the circle alone.

[A31](../../../section-rooms/arguments/A31-Deferential-Intelligence.md) asks whether returned resistance can revise the frame; [A33](../../../section-rooms/arguments/A33-Epistemic-Cultivation-Operational-Parity.md) asks what that revision changes in actual work. [Movement 42](../../../section-rooms/06-objective-internality/movements/42-s5-p5-research-vectors.md) turns these into tests of lens refraction and deferential return, while [movement 44](../../../section-rooms/07-instrument-returns/movements/44-s50-p1-ql-mef-bimba-harness.md) retains their conditions in the proposed instrument. The mathematical example establishes exact agreement across a declared overlap. The research programme asks how situated, revisable accounts can earn their own declared transitions.
