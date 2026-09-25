---
title: "Cycle, Interval and Octave"
record_id: matheme-cycle-interval-octave
record_type: matheme
register: matheme
claim_status: Derived
source_relation: "Exact construction; argued native reading and bounded source relation"
---

# Cycle, Interval and Octave

## #0 — Name what is returning

A frequency, an interval and a pitch class are different objects. The [musical derivation house](../../episteme/sources/internal-corpus/taylor/taylor-2026-ql-musical-derivation-v3/taylor-2026-ql-musical-derivation-v3.md) and [Binary house](../../episteme/sources/internal-corpus/taylor/taylor-2026-binary-explication/taylor-2026-binary-explication.md) carry their native relation. [Scholtz](../../episteme/sources/mathematics-logic/scholtz/scholtz-1998-algorithms-diatonic-keyboard-tunings/scholtz-1998-algorithms-diatonic-keyboard-tunings.md) fixes the pure and tempered tuning distinctions.

Let `f>0`, choose reference `f₀`, and set `u=log₂(f/f₀)`. Multiplication of frequencies by 2 adds 1 to `u`. Quotienting `u` by integer shifts gives an octave-equivalence class in `ℝ/ℤ`.

## #1 — Work octave equivalence

The frequencies 240, 480 and 960 Hz have logarithmic coordinates 0, 1, 2 relative to 240 Hz. They share one class modulo 1 but differ in absolute frequency and register. The quotient retains class and forgets octave height.

An interval from `f` to `g` has ratio `g/f`, or logarithmic displacement `log₂(g/f)`. Reversing direction gives the reciprocal ratio and negative displacement. Returning to the same class can therefore retain a nonzero travelled displacement in the cover.

## #2 — Traverse the twelve-tone circle

In 12-TET, semitone number `n` has ratio `2^(n/12)`. Pitch classes are residues modulo 12. Whole-tone stepping adds 2 and gives two six-orbits, even and odd residues. Fifth stepping adds 7, coprime to 12, and visits all twelve residues before returning.

After six equal-tempered whole tones the frequency doubles. After twelve equal-tempered fifths it is multiplied by `2^7`. Both return to the initial pitch class while retaining different height changes. The cycle length alone does not specify the octave displacement.

## #3 — Keep directed steps exact

On the chromatic even orbit, the closing step A♯→C is two semitones modulo 12. Its ascending realisation can be A♯ in one octave to C in the next. It is not a minor third. A directed interval calculation must specify the start, end, basis and chosen register lift.

[The music matrices](../music/chromatic-substrates.md) separately define chromatic and fifths addresses. Numerical distance in one address system cannot be read as a semitone distance in the other without applying its generator.

## #4 — Distinguish pure iteration from the cyclic model

Pure fifth iteration multiplies by 3/2, whose twelvefold product differs from seven octaves by the [comma](pythagorean-comma.md). Pure 9/8 iteration likewise overshoots one octave after six tones. Thus the finite pitch-class orbit is a selected tempered identification, not an unadjusted equality among pure frequencies.

The source's rhythm-to-pitch relation concerns temporal organisation becoming audible as tonal experience. It is not exhausted by an octave quotient, and no universal perceptual threshold is established here. Waveform, presentation and listener conditions require their own empirical account.

## #5→0 — Return class with displacement retained

The result records both what returned and what moved: class can repeat while frequency rises, a formal pattern can recur while the particular traversal remains different. This is the exact musical carrier for the native account of return with retained difference.

This record returns-to [Movement29](../../../section-rooms/04-mathematical-substrate/movements/29-s3-p4-topology-music-resolution.md), [topological quilt](../quilt/topology.md) and [whole-tone return](whole-tone-return.md). The full process/music chain states its inverse phase explicitly; a cyclic residue alone does not provide that entire native traversal.
