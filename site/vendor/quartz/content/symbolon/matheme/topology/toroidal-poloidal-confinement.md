---
record_id: matheme-toroidal-poloidal-confinement
title: "Toroidal and poloidal circulation — magnetic confinement"
record_type: matheme
register: matheme
claim_status: Argued
source_relation: "Derived geometry; Paraphrased physical apparatus; Argued QL relation"
source_ids: [taylor-2026-core-theorems-pithy, iter-what-is-tokamak, hatcher-2002-algebraic-topology, taylor-2026-binary-explication]
---
# Toroidal and poloidal circulation — magnetic confinement

## #0

Toroidal confinement gives circulation a material task: sustain a hot plasma in a bounded region while controlling its relation to the vessel. The [housed ITER account](../../episteme/sources/physics/iter/iter-what-is-tokamak/iter-what-is-tokamak.md#iter-what-is-tokamak-q001) establishes the doughnut-shaped vacuum chamber, charged plasma and magnetic apparatus. The [native core, VIII](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md) takes that apparatus as a physical neighbour of return through differentiated winding. The mathematical surface and the engineered plasma retain different proof obligations.

This page first constructs the directions and their composition. Its geometric results are Derived under explicit assumptions. The apparatus description is Paraphrased from institutional sources; its coordination with QL remains Argued. [A17](../../../section-rooms/arguments/A17-Toroidal-Circulation-and-the-Arche-Topos.md) receives a precise physical case of coupled circulation, while [A16](../../../section-rooms/arguments/A16-Arche-Topos-as-Differential-Field.md) retains the differential field within which that case becomes legible.

## #1

Use a circular torus of major radius \(R\) and minor radius \(r\), with \(R>r>0\):

\[
X(\theta,\phi)=((R+r\cos\theta)\cos\phi,
(R+r\cos\theta)\sin\phi,r\sin\theta).
\]

Both angles are modulo \(2\pi\). Varying \(\phi\) at fixed \(\theta\) goes toroidally around the central axis, the long direction. Varying \(\theta\) at fixed \(\phi\) goes poloidally around the tube's cross-section, the short direction. The coordinate tangents are orthogonal and have lengths

\[
|X_\theta|=r,\qquad |X_\phi|=R+r\cos\theta.
\]

Write their unit vectors as \(e_\theta\) and \(e_\phi\). The angular and physical components therefore carry different scale factors. A toroidal angular step on the outer side traverses more physical distance than the same angular step on the inner side.

These are two independent directions on a surface. The plasma occupies a volume, and a magnetic configuration can contain a family of surfaces within it. This chosen circular surface is a geometric model; it does not reproduce an entire vessel, a shaped plasma boundary or an experimentally reconstructed equilibrium. The [torus-cover and winding record](torus-cover-winding.md) owns the quotient and integer winding proof, with [Hatcher's source house](../../episteme/sources/mathematics-logic/hatcher/hatcher-2002-algebraic-topology/hatcher-2002-algebraic-topology.md) retaining the mathematical reference.

## #2

On the model surface, take a nonzero tangent field

\[
B=B_\theta e_\theta+B_\phi e_\phi.
\]

A field line is a curve whose tangent is parallel to \(B\); its curve parameter need not be physical time. Where \(B_\phi\ne0\), its angular slope follows from the metric factors:

\[
\frac{d\theta}{d\phi}
=\frac{B_\theta/r}{B_\phi/(R+r\cos\theta)}
=\frac{R+r\cos\theta}{r}\frac{B_\theta}{B_\phi}.
\]

Thus the ratio of physical components is not by itself the angular winding ratio. To specify the simple helical curve \(\theta=\phi/2\), choose the direction ratio

\[
\frac{B_\theta}{B_\phi}=\frac{r}{2(R+r\cos\theta)}.
\]

For \(R=3\) and \(r=1\) in a common length unit, this ratio is \(1/8\) at \(\theta=0\) and \(1/4\) at \(\theta=\pi\). Both yield \(d\theta/d\phi=1/2\). From zero angles, the curve closes after \(\phi=4\pi\), \(\theta=2\pi\): two toroidal turns and one poloidal turn. After only one toroidal turn it is on the opposite side of the tube's cross-section.

This constructs a line direction and its winding. It does not solve Maxwell's equations and plasma force balance for a three-dimensional field. In a constant-angular-slope model, rational slope gives a closed line and irrational slope gives dense winding on that surface. Neither condition alone measures confinement quality. [A15](../../../section-rooms/arguments/A15-Ratio-Rationality-Measure-Reckoning-Harmony-Account.md) receives the exact conversion between ratio, local scale and completed winding.

## #3

A tokamak supplies the fields through an apparatus. Toroidal-field coils generate the toroidal component. The toroidal plasma current contributes the poloidal component; the central solenoid induces plasma current, while external poloidal-field coils help control plasma position and shape. Philippe Moreau's ITER-hosted *Magnetic Diagnostics* lecture, slide 3, explicitly presents their combination as helical field lines. This is the dedicated physical geometry witness beyond the existing chamber card. [Moreau, slide 3](https://www.iter.org/sites/default/files/media/2024-12/l2_iis-magnetic-diagnostics-ph-moreau-v2-reduced.pdf#page=3).

ITER's magnet-system account distinguishes the toroidal coils, external poloidal coils, central solenoid and correction coils. It also names fast vertical-stability and edge-instability control systems. The physical arrangement therefore includes field production, shaping, error correction and active control. A drawing of two arrows around a torus cannot stand in for those distinct functions. [ITER, “Magnets”](https://www.iter.org/machine/magnets).

These two primary resources were recovered directly for this page. They have not yet received their own canonical source houses and passage records. Their direct citations make the warrant inspectable while leaving that locality debt explicit; the housed “What Is a Tokamak?” cards are not silently enlarged to carry their claims. No apparatus dimensions, achieved pulse performance or present operational status are inferred from the model calculation.

## #4

A field line describes magnetic direction. A charged particle has additional motion. In the idealised nonrelativistic case of a uniform magnetic field with no electric field, the Lorentz equation is

\[
m\dot v=Q\,v\times B.
\]

Its perpendicular component turns with cyclotron-frequency magnitude \(|Q|B/m\); its parallel component remains constant. For perpendicular speed \(v_\perp\), the orbit radius is \(\rho=mv_\perp/(|Q|B)\). The resulting particle helix around a field line is distinct from the field line's toroidal/poloidal helix around the machine. A guiding-centre approximation requires the orbit scale to be small compared with the scale on which the field changes. The uniform-field calculation supplies no general trajectory solution in a toroidal plasma.

The same equation yields

\[
\frac{d}{dt}\left(\frac12m|v|^2\right)
=Q\,v\cdot(v\times B)=0.
\]

This is conservation of a particle's kinetic energy under the stated magnetic-only force law. Its reason is the perpendicular force, not the genus of a surrounding surface. Heating, collisions, electric fields, nonuniformity, transport and collective plasma behaviour require additional terms or models. A closed toroidal chamber removes the simple ends of a straight tube; it does not eliminate particle or energy losses.

Physical confinement consequently needs measurements of the actual field, plasma position, energy and stability. Moreau's lecture identifies these diagnostic tasks and the measurement chain through which the field becomes available to control (slides 9–11). The [housed ITER experimental-purpose card](../../episteme/sources/physics/iter/iter-what-is-tokamak/iter-what-is-tokamak.md#iter-what-is-tokamak-q002) further limits the case: ITER is intended to test long-pulse operation and reactor-scale technologies and is not equipped to produce electricity. The apparatus remains a bounded witness for [movement 29](../../../section-rooms/04-mathematical-substrate/movements/29-s3-p4-topology-music-resolution.md), whose energetic image carries these conditions with it.

## #5→0

The earned relation is movement sustained through differentiated directions, with the conditions of its return made explicit. [A18](../../../section-rooms/arguments/A18-Primordial-Symbolon-and-Its-Eight-Determinations.md) places that relation within the native eight determinations. The [core source](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md) grounds the prior quotient, independent windings and circulation; the physical case shows one engineering use of that available geometry. Its force survives without a claim that the torus is universally optimal or that topological return entails metaphysical conservation.

The [Matheme Two Locks](../README.md) keep the larger record forms intact. Definition/Quilt carry `0/1 = 4+2 = 5→0 = 0/1`; Process/Music carry `0/1 = 4+2 = 5→0 = 1/0 = 4′+2′ = 5′→0′ = 0/1`. The [Binary source house](../../episteme/sources/internal-corpus/taylor/taylor-2026-binary-explication/taylor-2026-binary-explication.md) retains their provenance. File 2's inverse-phase primes and File 3's Night sequence have their own offices; the two magnetic directions neither replace those sequences nor mechanically enact them.

[Movement 30](../../../section-rooms/04-mathematical-substrate/movements/30-s3-p5-arche-topos.md) gathers this material witness into the arche-topos. [Movement 45](../../../section-rooms/07-instrument-returns/movements/45-s50-p2-antikythera-attunement.md) carries its bounded instrumental relation onward: a made arrangement coordinates processes whose powers it does not create from nothing. The final return is therefore to the apparatus and its conditions—field, current, geometry, plasma, measurement and correction—through which this particular circulation can be sustained.
