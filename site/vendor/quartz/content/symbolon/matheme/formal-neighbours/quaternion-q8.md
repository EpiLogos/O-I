---
title: "Quaternion Q8 and Rotation"
record_id: matheme-quaternion-q8
record_type: matheme
register: matheme
claim_status: Derived
source_relation: "Explicit mathematical construction; argued native comparison"
---

# Quaternion Q8 and Rotation

## #0 — Define the algebra before its subgroup

The real quaternion algebra has basis `1,i,j,k` with `i²=j²=k²=ijk=−1`. Multiplication gives `ij=k`, `jk=i`, `ki=j`, while reversing the order negates each result. The [core spine](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md) supplies the native phase relation beside which this formal neighbour is admitted.

The algebra is a four-dimensional real vector space with multiplication. Its eight-element multiplicative subgroup `Q8={±1,±i,±j,±k}` is a different object from the whole algebra or the continuous group of unit quaternions.

## #1 — Work noncommutativity

`ij=k` but `ji=−k`, so the order of operations matters. The inverse of `i` is `−i` because `i(−i)=−i²=1`; similarly for `j,k`. Every listed element has its inverse in the set, and multiplying signed basis units stays within it.

A faithful complex-matrix representation takes

`i↦diag(i,−i)`, `j↦[[0,1],[−1,0]]`, `k↦[[0,i],[i,0]]`.

Direct multiplication reproduces the rules, while matrix associativity supplies associativity for the represented algebra. Here the matrix-entry `i` is ordinary complex multiplication, distinguished from the quaternion basis label by the map.

## #2 — Keep six imaginary units inside eight elements

The set `{±i,±j,±k}` contains six signed imaginary basis units. It is not a subgroup: `i·i=−1` lies outside it. Adjoining ±1 gives Q8. Hence a sixfold correspondence that uses only those imaginary units must record its omitted real units and cannot call the six the whole group.

The eight elements also do not automatically coincide with the native eight determinations. A proposed coordinate mapping must specify which operations correspond and remains Offered until those relations are demonstrated.

## #3 — Let unit quaternions act on three-space

Identify a vector `v=(x,y,z)` with the pure imaginary quaternion `xi+yj+zk`. For a unit quaternion `q`, the map `v↦qvq⁻¹` preserves the imaginary subspace and Euclidean norm and gives an orientation-preserving rotation.

For `q=i`, conjugation keeps `i` fixed and sends `j,k` to `−j,−k`: a half-turn about the first axis. More generally `q=cos(θ/2)+u sin(θ/2)` for a unit imaginary axis `u` gives angle θ about that axis. This exhibits every axis-angle rotation.

## #4 — State the double cover precisely

`q` and `−q` give the same conjugation because their signs cancel. The only unit quaternions acting trivially on every imaginary vector are ±1: commuting with each basis unit forces the imaginary coefficients to vanish. Thus the rotation map has kernel `{±1}` and is a two-to-one map from the unit-quaternion group, isomorphic to `SU(2)`, onto `SO(3)`.

This continuous rotation double cover differs from the torus orientation cover of the Klein bottle and the infinite universal cover of the torus. Their shared “double” vocabulary does not identify their domains, groups or operations. [Möbius/Klein](../topology/mobius-klein-surfaces.md) keeps the surface construction separate.

## #5→0 — Return with order and cover retained

The result is an exact noncommutative eight-element group within a continuous algebra, plus a distinct rotation-cover construction. The native phase field can use these as specified formal neighbours without deriving its positional meanings from their cardinalities.

This record returns-to [complex orientation](../ql/complex-orientation.md), [A18](../../../section-rooms/arguments/A18-Primordial-Symbolon-and-Its-Eight-Determinations.md), and [translations](../mono-poly/translations.md). A valid comparison must preserve the order of products and name which cover it invokes.
