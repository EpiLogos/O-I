---
title: "The Diatonic CF Grammar"
aliases:
  - "The Diatonic CF Grammar"
record_id: matheme-music-diatonic-cf-grammar
record_type: matheme
register: matheme
claim_status: Derived
source_relation: "Extracted authorial CF selections; exact scale and ratio operations; Argued modal coordination"
source_ids:
  - taylor-2026-binary-explication
  - taylor-2026-ql-musical-derivation-v3
  - taylor-2026-core-theorems-pithy
---

# The Diatonic CF Grammar

## #0 — A configuration selects its tones

The [lens anchors](lens-anchors.md) **define** where the field is heard from; a context-frame, **CF**, configures relations within that field. File 4's [“The Diatonic CF Grammar, Major/Minor, and the 84-Fold Field”](../../episteme/sources/internal-corpus/taylor/taylor-2026-binary-explication/taylor-2026-binary-explication.md) **sources** a seven-step selection which gives the diatonic scale its musical body.

The [musical-v3 house](../../episteme/sources/internal-corpus/taylor/taylor-2026-ql-musical-derivation-v3/taylor-2026-ql-musical-derivation-v3.md), §I-4, **sources** the frames’ distinct operations. Their number is not a count of seven QL positions: CF5 enters a nested sixfold, CF6 bridges its return, and CF7 closes the encompassing passage. The selected musical position is also distinct from the position inside a frame’s notation.

| CF | Native expression | Configurational operation |
|---|---|---|
| CF1 | `(00/00)` | Undifferentiated fourfold-zero ground |
| CF2 | `(0/1)` | Dyadic distinction |
| CF3 | `(0/1/2)` | Triadic circulation |
| CF4 | `(0/1/2/3)` | Tetradic contextual closure |
| CF5 | `(4.0/1–4.4/5)` | Fractal-doubling executive: the sixfold active within position 4 |
| CF6 | `(4.5/0)` | The nested .5 bridge returning towards ground |
| CF7 | `(5/0)` | Synthesis-return of the encompassing passage |

The source reads CF1–CF4 as the articulation of `0/1` and CF5–CF7 as the return towards `1/0`. The CF5 change is recursive, not simply another item added to the first four.

## #1 — The major selection at Lens 0

Use the chromatic C-reference map `p(k,ε)=2k+ε mod12`, where `ε=0` is Name/bimba and `ε=1` is Power/pratibimba. The candidate assigns the frames these musical selections:

| Degree / frame | Selected position | Face | Note | Content |
|---|---|---|---|---|
| 1 / CF1 | 0 | Name | C | Truth |
| 2 / CF2 | 1 | Name | D | Mind |
| 3 / CF3 | 2 | Name | E | Word |
| 4 / CF4 | 2′ | Power | F | Sacrifice |
| 5 / CF5 | 3′ | Power | G | Decision |
| 6 / CF6 | 4′ | Power | A | Love |
| 7 / CF7 | 5′ | Power | B | Work |

The resulting pitch-class set is

$$
S=\{0,2,4,5,7,9,11\}.
$$

Its ordered semitone steps, including return to the octave, are `2,2,1,2,2,2,1`: the major-scale pattern. The passage from B to C in the next octave returns CF7 to CF1 in the renewed cycle; it does not add an eighth independent frame. Five selected positions are inner and two, `0` and `5′`, are framing positions. The selection therefore uses the full twelve-state palette. It is not a seven-note subset of the architectural inner eight.

The unselected inner positions are `1′,3,4`, giving D♯, F♯, G♯; the unselected outer positions are `0′,5`, giving C♯, A♯. These five remain available for another selection or a chromatic approach. Their architectural offices do not make them physically unsoundable.

## #2 — The tetrachords carry exact return

The [foundational ratios](foundational-ratios.md) **derive** the pure-ratio architecture:

$$
\frac43\cdot\frac98\cdot\frac43=\frac21.
$$

A Pythagorean realisation of the major scale uses the successive frequency ratios

$$
1,\quad\frac98,\quad\frac{81}{64},\quad\frac43,
\quad\frac32,\quad\frac{27}{16},\quad\frac{243}{128},\quad2.
$$

The lower tetrachord reaches `4/3`; the `9/8` bridge reaches `3/2`; the upper tetrachord reaches `2`. Within either tetrachord, two whole-tones leave the **leimma**:

$$
\frac{4/3}{(9/8)^2}=\frac{256}{243}.
$$

The seven successive ratios are consequently `9/8,9/8,256/243,9/8,9/8,9/8,256/243`. Their product is exactly two. The tempered pitch-class selection above has the same ordered interval types under different frequency values; its semitones are `2^(1/12)`, not the pure leimma.

The two small steps also perform different positional crossings. E→F keeps position 2 and exchanges its face. B→C in the next octave changes `5′→0`: both position and face change. The source coordinates their two crossings with its Klein return. The note sequence establishes those two face changes; a topological double-cover claim requires the additional construction kept in [A17](../../../section-rooms/arguments/A17-Toroidal-Circulation-and-the-Arche-Topos.md), which **qualifies** that coordination. Write the closing C as “C in the next octave” here: musical register return must not be confused with conjugate pitch C♯ at position `0′`.

## #3 — Parallel minor and modal rotation

Parallel C minor changes three degrees of C major:

| Degree | Major | Natural minor | Change of position |
|---|---|---|---|
| 3 | E | E♭ = D♯ | `2→1′` |
| 6 | A | A♭ = G♯ | `4′→4` |
| 7 | B | B♭ = A♯ | `5′→5` |

The sixth and seventh changes preserve the position-index and flip its face. The third changes both. Thus parallel minor is a specified reselection, not three applications of the same-position D operator. Its pitch classes are `{0,2,3,5,7,8,10}` and its Name/Power sequence is `NNPPPNN`. The authorial interpretation hears Need where the major third carried Word; the changed address shows exactly what that interpretation reads.

Relative modes perform a different operation: retain the seven notes of S and choose another member as tonic. Rotate their order, lift wrapped notes by an octave, then subtract the new tonic to obtain relative semitone degrees. At the fixed Lens-0 map, `N` and `P` retain the faces of the actual notes:

| Mode | Tonic / grounded frame | Relative degrees | Fixed-map faces |
|---|---|---|---|
| Ionian | C / CF1 | `0,2,4,5,7,9,11` | `NNNPPPP` |
| Dorian | D / CF2 | `0,2,3,5,7,9,10` | `NNPPPPN` |
| Phrygian | E / CF3 | `0,1,3,5,7,8,10` | `NPPPPNN` |
| Lydian | F / CF4 | `0,2,4,6,7,9,11` | `PPPPNNN` |
| Mixolydian | G / CF5 | `0,2,4,5,7,9,10` | `PPPNNNP` |
| Aeolian | A / CF6 | `0,2,3,5,7,8,10` | `PPNNNPP` |
| Locrian | B / CF7 | `0,1,3,5,6,8,10` | `PNNNPPP` |

For example, F Lydian traverses F–G–A–B–C–D–E. Its first four notes are Power-side at the fixed C map, and the following three are Name-side. File 4’s differing face patterns for the last four modal rows do not follow from its stated fixed Lens-0 assignments; the table here computes them from the printed notes. Re-anchoring and assigning a new local coordinate map would be another operation, requiring its own rule.

## #4 — Lens scales and sounding clusters

For a lens with chromatic anchor `a`, its transposed major selection is `S_a={a+s mod12 : s∈S}`. The source’s twelve scales follow. These are pitch-class spellings; F can stand for enharmonic E♯ and C for B♯ where the key’s diatonic spelling requires them.

| Lens | Anchor | Seven selected pitch classes |
|---|---|---|
| L0 | C | C D E F G A B |
| L1 | D | D E F♯ G A B C♯ |
| L2 | E | E F♯ G♯ A B C♯ D♯ |
| L3 | F♯ | F♯ G♯ A♯ B C♯ D♯ F |
| L4 | G♯ | G♯ A♯ C C♯ D♯ F G |
| L5 | A♯ | A♯ C D D♯ F G A |
| L0′ | C♯ | C♯ D♯ F F♯ G♯ A♯ C |
| L1′ | D♯ | D♯ F G G♯ A♯ C D |
| L2′ | F | F G A A♯ C D E |
| L3′ | G | G A B C D E F♯ |
| L4′ | A | A B C♯ D E F♯ G♯ |
| L5′ | B | B C♯ D♯ E F♯ G♯ A♯ |

A scale supplies available tones; a chord specifies tones sounding together. Holding CF1–CF5’s selections at Lens 0 gives the cluster `{C,D,E,F,G}`. Over C its degrees are `1,2,3,4,5`. A C-major-ninth chord instead contains `{C,E,G,B,D}`; the cluster has F and lacks B. The source’s major-ninth label therefore cannot describe this exact five-note set.

Changing the cluster’s bass changes its interpretation without filling its missing scale degrees. Over D the set has degrees `1,2,♭3,4,♭7`; it is compatible with Dorian but does not establish Dorian’s characteristic major sixth. The actual sounded set must remain distinct from the full modal field it can suggest.

## #5→0 — Configuration returns as a mode of knowing

The twelve lens-scales and seven modal groundings yield `12×7=84` indexed configurations. The product counts pairs of choices, not eighty-four distinct pitch-class sets: each scale’s seven rotations retain its notes while changing their tonic. The separate five-note-cluster/bass space needs its own voicing account; it is not made a superset of these configurations merely by having a larger count.

The full musical circuit remains

$$
\frac01=4+2=(5\rightarrow0)=\frac10
=4'+2'=(5'\rightarrow0')=\frac01.
$$

The chain’s primes mark inverse-phase positions. Primes on the selected musical positions mark File 3’s conjugate Night face. An octave repeat is a further distinction of register, explicitly named in this record. These offices allow the complete return to remain readable.

The record **returns-to** [A15](../../../section-rooms/arguments/A15-Ratio-Rationality-Measure-Reckoning-Harmony-Account.md) through exact selections whose criterion is exposed, and [§3 · #4, Musical Resolution](../../../section-rooms/04-mathematical-substrate/movements/29-s3-p4-topology-music-resolution.md) **embodies** their interval return. The CF grammar gives the achieved field several ways to become home. Its authorial epistemic interpretation remains attached to the actual configuration; its current ql-mef implementation remains unrecovered, so these are the housed candidate’s selections with the stated corrections.
