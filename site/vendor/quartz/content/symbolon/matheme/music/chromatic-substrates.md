---
title: "The Two Chromatic Substrates"
aliases:
  - "The Two Chromatic Substrates"
record_id: matheme-music-chromatic-substrates
record_type: matheme
register: matheme
claim_status: Derived
source_relation: "Extracted authorial musical matrices; exact modular operations; Argued epistemic coordination"
source_ids:
  - taylor-2026-binary-explication
  - taylor-2026-core-theorems-pithy
  - taylor-2026-ql-musical-derivation-v3
---

# The Two Chromatic Substrates

## #0 — One palette, two traversals

The [foundational ratios](foundational-ratios.md) **derive** the two generators from which this musical projection proceeds: `9/8`, the whole-tone, and `3/2`, the fifth. File 4's [“The Two Chromatic Substrates”](../../episteme/sources/internal-corpus/taylor/taylor-2026-binary-explication/taylor-2026-binary-explication.md) **sources** two ways of ordering the same twelve pitch classes. The chromatic basis advances through whole-tone adjacency; the fifths basis advances through harmonic fifth-motion. Their different orders change how the same-position conjugate relation sounds.

The matrices below use twelve-tone equal temperament and octave equivalence. Write pitch class as `p∈ℤ₁₂`, with `C=0`, `C♯=1`, and so on. Addition is modulo twelve. For an actual starting frequency `f₀`, an equal-tempered displacement of `n` semitones gives `f₀·2^(n/12)` before octave reduction.

This declares the projection's tuning. Its whole-tone step is `2^(1/6)`; its fifth is `2^(7/12)`. The pure ratios `9/8` and `3/2` remain the foundational interval relations, while these tempered values provide the exact closed pitch-class implementation. The distinction lets the native generators retain their derivational role without asserting false frequency equalities.

## #1 — The chromatic basis

Let `k=0,…,5` index the six QL positions, and let `ε=0` mark the bimba face and `ε=1` the pratibimba face. At the source's C anchor, the chromatic map is

$$
p_{\mathrm c}(k,\varepsilon)=2k+\varepsilon\pmod{12}.
$$

Increasing `k` advances two semitones. The bimba orbit and its one-semitone translate are

$$
WT_0=\{0,2,4,6,8,10\},\qquad
WT_1=\{1,3,5,7,9,11\}.
$$

A step of two preserves parity. Its order in `ℤ₁₂` is `12/gcd(2,12)=6`, so it visits six classes before returning. One helix therefore supplies one whole-tone collection; both helices together supply all twelve classes. The source matrix is:

| Position | Bimba | Conjugate position | Pratibimba |
|---|---|---|---|
| 0 | C | 0′ | C♯ |
| 1 | D | 1′ | D♯ |
| 2 | E | 2′ | F |
| 3 | F♯ | 3′ | G |
| 4 | G♯ | 4′ | A |
| 5 | A♯ | 5′ | B |

The within-helix path follows one face through its six positions. Crossing to the same `k` on the other face adds a semitone from bimba to pratibimba. It accesses the parity which the whole-tone generator alone cannot reach.

## #2 — The fifths basis

For the fifths basis, place the conjugate six after the first six in the fifths traversal:

$$
p_{\mathrm f}(k,\varepsilon)
=7(k+6\varepsilon)\pmod{12}
=7k+6\varepsilon\pmod{12}.
$$

Since `gcd(7,12)=1`, repeated addition of seven visits every pitch class before returning:

$$
\mathrm C\to\mathrm G\to\mathrm D\to\mathrm A\to\mathrm E\to\mathrm B
\to\mathrm F\sharp\to\mathrm C\sharp\to\mathrm G\sharp
\to\mathrm D\sharp\to\mathrm A\sharp\to\mathrm F\to\mathrm C.
$$

The first six entries and next six entries give the second source matrix:

| Position | Bimba | Conjugate position | Pratibimba |
|---|---|---|---|
| 0 | C | 0′ | F♯ |
| 1 | G | 1′ | C♯ |
| 2 | D | 2′ | G♯ |
| 3 | A | 3′ | D♯ |
| 4 | E | 4′ | A♯ |
| 5 | B | 5′ | F |

Here the two six-entry lines partition one twelve-step orbit. Advancing from B by a fifth enters F♯, the beginning of the conjugate line. Advancing from its final F by a fifth returns to C. This differs from the chromatic basis, whose step of two stays within each six-class orbit.

## #3 — The slash-flip keeps the position

Define the conjugate operation on the position and face together:

$$
\sigma(k,\varepsilon)=(k,1-\varepsilon),\qquad \sigma^2=\mathrm{id}.
$$

The operation retains `k` and exchanges the face; applying it twice restores the starting state. Its interval-character follows from the map through which it is sounded. In the chromatic basis it sends an even class to the next odd class and that odd class back to its paired even class: `+1` on bimba, `−1` on pratibimba. A uniform `+1` transposition would not perform this involution, because applying it twice advances two semitones rather than returning.

In the fifths basis, conjugate classes differ by six semitones. This is the tritone, self-inverse modulo twelve because `6+6≡0`. The chromatic flip therefore has the minimum nonzero pitch-class distance, while the fifths flip has the maximum shortest distance around the twelve-class circle.

At `k=2`, the chromatic matrix gives `E↔F`; the fifths matrix gives `D↔G♯`. Both perform `2↔2′`. Playing `E→D♯` in the chromatic matrix is also a semitone motion, but it changes `2→1′`; it crosses the helices without retaining the position. The source's principle is now operationally exact: **the slash-flip is one operation whose interval-character is contextual**.

## #4 — The contents travel through the map

The source assigns the same contents to the six position-indices in both bases:

| `k` | Name-content | Power-content | Candidate's stadial label |
|---|---|---|---|
| 0 | Truth | Play | Archaic |
| 1 | Mind | Need | Magic |
| 2 | Word | Sacrifice | Mythic |
| 3 | Logos | Decision | Mental-Rational |
| 4 | Son | Love | Integral |
| 5 | Image | Work | Supermental |

These are the candidate's authorial QL assignments. Its stadial column belongs to that synthesis; it does not establish a historical claim that Gebser supplied this entire six-row musical mapping. Each position carries both Name and Power, with their emphasis changing through the face traversed. The note is its location under a specified basis and anchor.

E makes the dependency concrete. In the chromatic matrix E occupies `k=2`, Word/Sacrifice; in the fifths matrix it occupies `k=4`, Son/Love. Changing basis changes which note carries a position while preserving that position's defined contents. [A06, Vāk](../../../section-rooms/arguments/A06-Vak.md) **extends** the relation between formative operation and articulated sign; the musical assignment gives that relation a particular coordinate grammar.

The [musical-v3 house](../../episteme/sources/internal-corpus/taylor/taylor-2026-ql-musical-derivation-v3/taylor-2026-ql-musical-derivation-v3.md) **sources** the parallel candidate system. File 4 and v3 are superseded in practice by the actual ql-mef package. Its current implementation remains unrecovered here; these matrices identify the housed candidate precisely rather than certifying the package's present mappings.

## #5→0 — Closure retains its tuning account

The modular traversals close exactly under the declared tempered projection. Their pure-ratio counterparts retain a remainder. Six pure whole-tones and twelve pure fifths differ from the corresponding octave returns by the same ratio:

$$
\frac{(9/8)^6}{2}
=\frac{531441}{524288},
\qquad
\frac{(3/2)^{12}}{2^7}
=\frac{531441}{524288}.
$$

Thus reducing octave register alone does not turn the pure generators into these finite cycles. Tempering changes their frequency ratios to obtain the exact pitch-class closure. [A15](../../../section-rooms/arguments/A15-Ratio-Rationality-Measure-Reckoning-Harmony-Account.md) **qualifies** the account by requiring the operation and criterion to remain available in the result; [§3 · #4, Musical Resolution](../../../section-rooms/04-mathematical-substrate/movements/29-s3-p4-topology-music-resolution.md) **embodies** the return through retained difference.

The music register carries the full circuit:

$$
\frac01=4+2=(5\rightarrow0)=\frac10
=4'+2'=(5'\rightarrow0')=\frac01.
$$

The chain's primes denote File 2's inverse-phase positions. In the matrices above, primes mark the conjugate P′ face through which File 3's Night-pass Power sequence is projected. These are distinct uses of the glyph, related through the full circuit rather than interchangeable indices.

The two bases now supply a palette and a conjugate operation to the pairing grammar declared in the [music domain](README.md), which **extends** them into relations among positions. This record **returns-to** the [foundational ratios](foundational-ratios.md) with its tuning and coordinate choices explicit. The same substrate can be traversed in two orders because the account preserves what each order changes and what its return retains.
