---
title: "Chinese Remainder: Six as Two by Three"
record_id: matheme-crt-z6
record_type: matheme
register: matheme
claim_status: Derived
source_relation: "Explicit mathematical proof; argued native comparison"
---

# Chinese Remainder: Six as Two by Three

## #0 — State the rings and the map

Let `ℤ/nℤ` denote integer residue classes modulo `n`. Define

`φ:ℤ/6ℤ→ℤ/2ℤ×ℤ/3ℤ`, `φ([k]₆)=([k]₂,[k]₃)`.

The [admitted reference note](../../../section-rooms/arguments/concepts/reference-notes/chinese-remainder-theorem-z6.md) locates this finite Chinese-remainder construction beside the [core's](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md) binary/ternary account. The proof below is explicit and does not borrow an unverified quotation from that note.

## #1 — Enumerate all six images

| k mod 6 | mod 2 | mod 3 |
|---|---|---|
|0|0|0|
|1|1|1|
|2|0|2|
|3|1|0|
|4|0|1|
|5|1|2|

Every pair in the two-by-three product occurs exactly once. If a representative changes by a multiple of 6, both residues stay unchanged, so the map is well-defined.

## #2 — Construct the inverse

For `a mod2` and `b mod3`, set `ψ(a,b)=3a+4b mod6`. Modulo 2 this is `a`, and modulo 3 it is `b`. Changing `a` by 2 or `b` by 3 changes the expression by a multiple of 6, so this map is also well-defined.

For example, the pair `(1,2)` gives `3+8=11≡5 mod6`. The pair `(0,1)` gives 4. These recover the table's corresponding entries, proving surjectivity and a two-sided inverse.

## #3 — Preserve the operations

Reduction modulo 2 and modulo 3 each preserves integer addition and multiplication. Consequently `φ(k+l)=φ(k)+φ(l)` and `φ(kl)=φ(k)φ(l)`, with componentwise operations in the product. The map also preserves 1, making it a ring isomorphism.

Coprimality matters. With moduli 2 and 4, a residue's mod 2 value is forced by its mod 4 value; the pair `(1 mod2,0 mod4)` is impossible. Independence of the two coordinates in the present construction depends on `gcd(2,3)=1`.

## #4 — Retain the algebraic boundary

`ℤ/6ℤ` is not a field: the nonzero classes 2 and 3 multiply to 0. Under `φ`, they become `(0,2)` and `(1,0)`, whose componentwise product is `(0,0)`. This exposes the product's zero-divisor structure directly.

The native sixfold can receive this as an exact binary/ternary decomposition. The isomorphism does not independently assign personhood, harmonic meaning or QL positions to the residues. Those assignments require their declared maps. Its content is stronger and narrower: six residues form the exact product ring of the coprime two- and three-residue systems.

## #5→0 — Return the pair to one address

The result permits passage both ways without loss: one mod 6 address becomes two independent residues, and `3a+4b` recovers it. This gives [translations](../mono-poly/translations.md) a concrete bijective example alongside maps that discard information.

This record returns-to [A18](../../../section-rooms/arguments/A18-Primordial-Symbolon-and-Its-Eight-Determinations.md), [perfect six](../harmonics/perfect-six.md), and [Movement26](../../../section-rooms/04-mathematical-substrate/movements/26-s3-p1-spanda-4-2.md). The modular construction keeps its own operations when returned to the native field.
