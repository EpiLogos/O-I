---
title: "The Projective Line"
record_id: matheme-projective-line
record_type: matheme
register: matheme
claim_status: Derived
source_relation: "Explicit geometric construction; argued native return"
---

# The Projective Line

## #0 — State the field and the equivalence

For a field `F`, take nonzero pairs `(x,y)∈F²` and identify `(x,y)` with `(λx,λy)` for every nonzero scalar `λ`. The equivalence classes are the projective line `P¹(F)`, written `[x:y]`. The zero pair is excluded because it determines no one-dimensional direction.

The [admitted projective-line note](../../../section-rooms/arguments/concepts/reference-notes/projective-line.md) places this construction beside the native zero/infinity relation. The [NIST house](../../episteme/sources/mathematics-logic/nist/nist-dlmf-2026-complex-variable/nist-dlmf-2026-complex-variable.md) supplies the complex completion's exact source context; the real construction is explicitly given here rather than attributed to that complex-only passage.

## #1 — Enter the affine chart

Where `y≠0`, divide both coordinates by `y`: `[x:y]=[x/y:1]`. Each such point has a unique affine coordinate `z=x/y`. For example, `[2:4]=[1:2]` has affine coordinate 1/2.

If `y=0`, then `x≠0`, and every such pair represents `[1:0]`. This is the one additional point, conventionally ∞. It is a projective class, not an ordinary field value obtained by dividing 1 by 0.

## #2 — Use the second chart

Where `x≠0`, take `w=y/x`. On the overlap, both coordinates are defined and `w=1/z`. At ∞, this second chart has `w=0`; the first chart has no finite coordinate there.

The swap `[x:y]↦[y:x]` is defined everywhere because swapping a nonzero pair leaves it nonzero. It exchanges 0=`[0:1]` and ∞=`[1:0]`, and agrees with reciprocal on nonzero finite coordinates. This extends a specified map; it does not create unrestricted binary division at all projective pairs.

## #3 — Distinguish real and complex lines

For `F=ℝ`, a projective point is an unoriented line through the origin in a real plane. Unit directions identify antipodal points; the resulting `ℝP¹` is a circle. For `F=ℂ`, the affine coordinate has two real dimensions, and `ℂP¹` is the [Riemann sphere](riemann-sphere.md).

The word “line” refers to projective dimension over the chosen field. The real circle and complex sphere differ in real dimension and topology. Their common homogeneous notation does not make them interchangeable surfaces.

## #4 — Return the coordinate limit to the native relation

The [core's](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md) `0/1` and `1/0` retain a defined/undefined seam in ordinary arithmetic. Homogeneous coordinates show one exact way to make the endpoint of a particular map representable by changing the object and chart.

The construction does not remove that arithmetic seam. It states where the old affine coordinate ceases to apply and supplies another coordinate for the larger space. The native reading of dimensional reframing is Argued through this exact change of representation.

## #5→0 — Return with the chart transition

The result is a space covered by two charts, with reciprocal transition on their overlap. Zero and infinity can be exchanged by a well-defined projective transformation while ordinary field division keeps its restrictions.

This record returns-to [Movement28](../../../section-rooms/04-mathematical-substrate/movements/28-s3-p3-projective-dimensional-reframing.md), [projective completion](projective-completion.md) and [division pluralisms](../formal-neighbours/division-pluralisms.md). The completed representation remains accountable to the equivalence relation and field from which it was constructed.
