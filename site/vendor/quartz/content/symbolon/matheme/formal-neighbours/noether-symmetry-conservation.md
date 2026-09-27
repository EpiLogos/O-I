---
record_id: matheme-noether-symmetry-conservation
title: "Noether: symmetry and conservation"
record_type: matheme
register: matheme
claim_status: Argued
formal_standing: "Derived: specified variational identities and worked conservation laws; Argued: invariant/transformation comparison; Offered: generalised energetics"
source_relation: "Paraphrased and Argued from: Noether's primary theorems; Argued from: native theorem field and authored quilt"
source_ids: [taylor-2026-core-theorems-pithy, taylor-2026-binary-explication, watson-1998-resonance-of-emptiness]
external_source: "Noether, Invariant Variation Problems, Tavel translation, arXiv:physics/0503066v3, §§1–2; canonical house pending"
---
# Noether: symmetry and conservation

## #0 — The invariant belongs to an action

Noether's theorem begins with a specified variational problem. A variational symmetry preserves its action, allowing a specified boundary term; the corresponding conservation statement concerns trajectories or fields satisfying its equations of motion. Identifying an unchanged feature of an image is not yet enough to identify such a symmetry. The action, transformation and boundary must participate in the same calculation.

[Noether's original first and second theorems, in Tavel's translation, §1](https://arxiv.org/pdf/physics/0503066v3#page=3), distinguish transformations depending on constant continuous parameters from transformations depending on arbitrary functions and their derivatives. The first produces divergence relations, becoming conservation laws when the field equations hold. The second produces differential identities among those equations. The following first-order constructions exhibit that distinction directly. The primary text is recovered; its canonical source-house intake remains pending.

For smooth real fields \(\phi^a(x)\), consider

\[
S[\phi]=\int_\Omega\mathcal L(\phi,\partial_\mu\phi,x)\,d^dx.
\]

Assume sufficient differentiability for the variations, integrations by parts and commuting derivatives used below. Use compactly supported variations to derive the field equations, or impose boundary conditions that remove their boundary term. Neither choice makes every possible symmetry automatically compatible with every physical boundary.

## #1 — The boundary term carries a current

Put

\[
\pi_a^\mu=\frac{\partial\mathcal L}{\partial(\partial_\mu\phi^a)},\qquad
E_a=\frac{\partial\mathcal L}{\partial\phi^a}-\partial_\mu\pi_a^\mu.
\]

The product rule gives the identity

\[
\delta\mathcal L=E_a\delta\phi^a+
\partial_\mu(\pi_a^\mu\delta\phi^a).
\]

Repeated indices are summed. For a transformation at fixed coordinates, \(\delta\phi^a=\varepsilon\Delta^a\) with constant parameter \(\varepsilon\), suppose the Lagrangian changes by \(\delta\mathcal L=\varepsilon\partial_\mu B^\mu\). Equating the two expressions gives

\[
j^\mu=\pi_a^\mu\Delta^a-B^\mu,
\qquad \partial_\mu j^\mu=-E_a\Delta^a.
\]

This last equation holds before solving the field equations. On a solution, \(E_a=0\), it gives \(\partial_\mu j^\mu=0\): the local conservation law. These are the first-order integration-by-parts steps underlying [Noether's divergence argument, §2](https://arxiv.org/pdf/physics/0503066v3#page=4).

An integrated charge requires a further boundary statement. For a fixed spatial region \(V\),

\[
Q(t)=\int_V j^0\,d^{d-1}x,\qquad
\frac{dQ}{dt}=-\int_{\partial V}\mathbf j\cdot\mathbf n\,dA.
\]

Zero outward flux makes \(Q\) constant. With nonzero flux the same local conservation law describes transfer across the boundary. The finite region need not retain what its current transports elsewhere.

## #2 — Rotation and time translation conserve different quantities

Take a particle in a two-dimensional isotropic oscillator,

\[
L=\frac m2(\dot x^2+\dot y^2)-\frac k2(x^2+y^2),\qquad m,k>0.
\]

An infinitesimal rotation has \(\Delta x=-y\), \(\Delta y=x\). The kinetic variation is \(m(-\dot x\dot y+\dot y\dot x)=0\), and the potential variation is \(-k(-xy+yx)=0\). Thus \(B=0\), and the one-dimensional version of the current is

\[
\ell=m(x\dot y-y\dot x).
\]

The equations \(m\ddot x=-kx\), \(m\ddot y=-ky\) verify it directly:

\[
\dot\ell=m(x\ddot y-y\ddot x)=-kxy+kyx=0.
\]

For the solution \(x=A\cos\omega t\), \(y=B\sin\omega t\), with \(\omega^2=k/m\), the charge is \(\ell=mAB\omega\). A changing position carries a fixed angular momentum.

Time translation has a different charge. For any smooth mechanical Lagrangian, set \(p_i=\partial L/\partial\dot q_i\) and \(H=p_i\dot q_i-L\). Along its Euler–Lagrange solutions,

\[
\frac{dH}{dt}
=(\dot p_i-L_{q_i})\dot q_i-L_t=-L_t.
\]

An autonomous Lagrangian has \(L_t=0\), so its energy is conserved. Here \(H=\tfrac m2(\dot x^2+\dot y^2)+\tfrac k2(x^2+y^2)\), giving \(H=\tfrac k2(A^2+B^2)\) on the displayed orbit. Rotation yielded \(\ell\); time translation yielded \(H\). Their coexistence does not make them the same conserved quantity.

If the spring strength becomes \(k(t)\), rotational symmetry still gives \(\dot\ell=0\), but \(\dot H=\tfrac12\dot k(t)(x^2+y^2)\). The drive transfers energy. A symmetry claim is therefore answerable to the particular transformation and its actual time dependence.

## #3 — An arbitrary function yields an identity

The second theorem changes the parameter's office. Suppose a variational symmetry has

\[
\delta\phi^a=R^a\varepsilon(x)+R^{a\mu}\partial_\mu\varepsilon(x),
\]

where \(\varepsilon\) is an arbitrary smooth function of compact support. Its action variation vanishes. Integrating the derivative of \(\varepsilon\) by parts yields

\[
0=\int\bigl(E_aR^a-\partial_\mu(E_aR^{a\mu})\bigr)\varepsilon\,d^dx.
\]

Arbitrariness implies the differential identity

\[
E_aR^a-\partial_\mu(E_aR^{a\mu})\equiv0.
\]

The identity holds for all fields in the domain, without imposing \(E_a=0\). Higher derivatives of the arbitrary function produce corresponding higher derivative terms. This is the distinction stated in Noether's second theorem, not a new independent conserved charge for each value of the function.

A small variational model makes the identity visible. Let

\[
L(q,a,\dot q)=\tfrac12(\dot q-a)^2,\qquad
\delta q=\varepsilon(t),\quad\delta a=\dot\varepsilon(t).
\]

Writing \(w=\dot q-a\), one has \(\delta w=0\). The Euler expressions are \(E_q=-\dot w\) and \(E_a=-w\), hence

\[
E_q-\frac d{dt}E_a\equiv0.
\]

The equation \(E_a=0\) already entails \(E_q=0\). This particular model has \(w=0\) on solutions; the example establishes dependence of equations, not a propagating physical degree of freedom. Different pairs \((q,a)\) related by the stated transformation describe the same \(w\); their redundancy is exhibited by a transformation law and an identity. Boundary symmetries and their possible charges require separate treatment: using compact support here deliberately isolates the local identity.

## #4 — Translation must retain its measure

The authored quilt's Noether development asks what remains one through real variation. Its four translation questions are concrete: under which transformation, across which boundary, with which symmetry, and at what scale? The oscillator answers each. Its configuration rotates, its action is invariant, its angular momentum is conserved on solutions, and its time-dependent drive can alter energy while leaving that rotational law intact.

[[section-rooms/arguments/A12-Mono-Poly-One-All-Whole-Many|Mono/Poly]] receives an Argued comparison: one invariant relation can hold through many genuinely different configurations. The slash carries the specified transformation by which their agreement is assessed. The native One is not thereby identified with angular momentum or energy. [[section-rooms/arguments/A15-Ratio-Rationality-Measure-Reckoning-Harmony-Account|A15]] requires the unit and relation of measure to survive the comparison; [[section-rooms/arguments/A17-Toroidal-Circulation-and-the-Arche-Topos|A17]] keeps winding under homotopy distinct from a Noether charge. A sphere's contractible loops do not prevent a rotationally symmetric dynamics upon it from conserving angular momentum.

The [[symbolon/episteme/sources/psychology/watson/watson-1998-resonance-of-emptiness/watson-1998-resonance-of-emptiness.md|Watson encounter and its source chain]] motivate the wider question of an economy changing through encounter. Their psychic and ethical operations have their own standing. Libido, attention, money and compute acquire no common unit from the theorem. In particular, [[section-rooms/arguments/A27-Self-and-Other-Unity-without-Possession|A27]] requires encounter to be able to change the scale itself, rather than become a greater force within its predecessor's scale.

## #5→0 — A disclosed choice is not yet a gauge symmetry

The gauge model above supplies an exact comparison for a description whose representatives vary while \(w\) remains unchanged. [[section-rooms/06-objective-internality/movements/40-s5-p3-preference-hidden-zero|The hidden-zero movement]] asks which baselines, reference policies and evaluators condition a judgment. Some technical changes can preserve an observable; others alter the judgment or its governing purpose. Only the former are candidates for an explicitly demonstrated redundancy. Calling every evaluator change a gauge transformation would erase the very consequences the native inquiry seeks to disclose.

The second theorem therefore sets a precise research demand: identify a variational structure, a local transformation and the resulting differential identity before claiming its mathematical force. A baseline-invariant score formula alone does not supply all three. [[section-rooms/arguments/A24-Arbitration-and-the-Usurpation-of-Measure|A24]] retains the authority question, and [[section-rooms/arguments/A31-Deferential-Intelligence|A31]] retains the possibility that returned evidence revises the evaluator itself. Such revision can change the model rather than move between equivalent descriptions of it.

The [[symbolon/episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md|native theorem field]] carries this accountable return through the eight determinations; it is not deduced from physical conservation. [[section-rooms/06-objective-internality/movements/42-s5-p5-research-vectors|§5 · #5→0]] receives the remaining Offered programme with an exact test: name what transforms, prove what is preserved, and distinguish a change of representative from a change of law. Floquet dynamics and Landauer erasure remain separate model-and-source tasks. The present conservation calculation stands complete without treating those research directions as already established translations.
