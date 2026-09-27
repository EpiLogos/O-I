---
title: "The Riemann Sphere"
record_id: matheme-riemann-sphere
record_type: matheme
register: matheme
claim_status: Derived
source_relation: "Explicit geometric construction; argued native return"
---

# The Riemann Sphere

## #0 — Add one point to the complex plane

The [NIST source house](../../episteme/sources/mathematics-logic/nist/nist-dlmf-2026-complex-variable/nist-dlmf-2026-complex-variable.md) states the extended complex plane `Ĉ=ℂ∪{∞}`. Its topology is the one-point compactification: neighbourhoods of ∞ contain the complement of a sufficiently large compact region of the plane. The [projective line](projective-line.md) identifies it with `ℂP¹`.

The input here is the complex plane, not the real affine line or the integer lattice quotient that produces a torus.

## #1 — Construct the sphere explicitly

For `z=x+iy`, let `r²=x²+y²` and map

`z ↦ (2x/(r²+1), 2y/(r²+1), (r²−1)/(r²+1))`.

The squared coordinates sum to 1: the numerator is `4r²+(r²−1)²=(r²+1)²`. As `|z|→∞`, the point approaches the north pole `(0,0,1)`, assigned to ∞. Zero maps to the south pole `(0,0,−1)` and 1 to `(1,0,0)`.

## #2 — Recover the inverse and the second chart

Away from the north pole, the inverse is `z=(X+iY)/(1−Z)`. This makes the sphere-minus-one-point an affine complex chart. Near ∞, use `w=1/z`; on the overlap `z≠0`, the transition is holomorphic with derivative `−1/z²≠0`.

At ∞ the second coordinate is 0. The point has not become a finite value in the original chart; its finite coordinate belongs to the other chart. Each chart has a boundary of applicability even though the sphere itself is covered.

## #3 — Work reciprocal across the poles

The map `z↦1/z` extends to the sphere by exchanging 0 and ∞. In the homogeneous description this is just `[x:y]↦[y:x]`, so there is no undefined zero pair. Its square is the identity.

Binary expressions such as `0/0` or ∞−∞ do not thereby gain unique values. The successful extension of one transformation is not an unrestricted extension of every field operation. [Cross-ratio](../formal-neighbours/cross-ratio.md) states the related invariant under its own transformation conditions.

## #4 — Distinguish the sphere from the torus

The [torus cover](torus-cover-winding.md) identifies lattice translates of the plane; the Riemann sphere adds one point to the complex plane. They are different constructions. The torus has two independent fundamental-group generators; the sphere is simply connected.

Simply connected does not mean motionless or devoid of dynamics. For example, rotating the sphere about an axis gives an explicit continuous motion. The [core's](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md) sphere/torus imagery therefore uses a stated topological contrast, not a theorem that a sphere cannot carry movement, structure or a viable consciousness.

## #5→0 — Return through the second coordinate

The result is a representable infinity point and a precise transition between two local descriptions. A chart's failure to contain a point becomes a reason to change chart, with the original coordinate's restriction retained.

This record returns-to [Movement28](../../../section-rooms/04-mathematical-substrate/movements/28-s3-p3-projective-dimensional-reframing.md), [projective completion](projective-completion.md) and [manifold atlas](manifold-atlas.md). The native return can use this construction while preserving the distinct mathematical object and the limits of the analogy.
