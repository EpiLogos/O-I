---
title: "The Mode–Tonic Field and Voicing Landscape"
aliases:
  - "The Mode–Tonic Field and Voicing Landscape"
record_id: matheme-music-field
record_type: matheme
register: matheme
claim_status: Derived
source_relation: "Extracted authorial field definitions; exact finite-set and ratio operations; Argued musical-epistemic interpretation"
source_ids:
  - taylor-2026-binary-explication
  - taylor-2026-ql-musical-derivation-v3
  - taylor-2026-core-theorems-pithy
---

# The Mode–Tonic Field and Voicing Landscape

## #0 — Two choices give a field

The [diatonic CF grammar](diatonic-cf-grammar.md) **defines** a seven-note selection and seven ways of taking one of its frames as ground. The [lens anchors](lens-anchors.md) **define** twelve anchor identities. Their combination supplies the first field: a lens-scale and a modal grounding within it.

File 4's [“The 84-fold field and the voicing landscape”](../../episteme/sources/internal-corpus/taylor/taylor-2026-binary-explication/taylor-2026-binary-explication.md) **sources** this product and a second product in which a five-note cluster is placed over a bass. The [musical-v3 house](../../episteme/sources/internal-corpus/taylor/taylor-2026-ql-musical-derivation-v3/taylor-2026-ql-musical-derivation-v3.md), §II-4.8, **sources** the fuller cluster/bass proposal. The counts become exact when the objects counted remain explicit.

Use the tempered chromatic pitch classes `ℤ₁₂`. Let `a` denote a lens’s anchor class, and take the ordered major selection

$$
S=(0,2,4,5,7,9,11),\qquad S_a=a+S\pmod{12}.
$$

The lens ID is retained alongside its anchor. Notes shared by two scales therefore do not erase the difference between the two indexed configurations.

## #1 — Eighty-four modal groundings

Let `m∈{0,…,6}` choose a degree of S as tonic. The modal field is

$$
M=\{(a,m):a\in\mathbb Z_{12},\ m\in\{0,\ldots,6\}\},
\qquad |M|=12\cdot7=84.
$$

The tonic is `t(a,m)=a+S[m] mod12`. The sounded scale remains S_a, reordered from that tonic. Each parent collection has seven distinct tonic choices; the eighty-four entries count collection-and-ground configurations rather than eighty-four different unordered collections.

At `a=0`, choosing `m=0` yields C Ionian; choosing `m=1` yields D Dorian; choosing `m=3` yields F Lydian. The notes remain C, D, E, F, G, A, B. The operative change is which degree and CF becomes ground. In the authorial interpretation, changing that ground changes the form of relation through which the field is inhabited.

## #2 — One hundred forty-four cluster/bass anchorings

The source retains the first five CF selections as a simultaneous cluster:

$$
K=(0,2,4,5,7),\qquad K_a=a+K\pmod{12}.
$$

Allow the bass pitch class `b` to range independently over all twelve classes:

$$
V=\{(a,b):a,b\in\mathbb Z_{12}\},
\qquad |V|=12\cdot12=144.
$$

This grid uses the major-derived K just defined. Choosing a minor-derived upper cluster changes that input and gives a parallel grid; it is not an additional choice already counted in these 144 entries.

A member of V specifies a parent cluster and a bass class. It does not specify octave placement, upper-voice order, duration or doubling. Those further performance choices are not included in the count. If the bass shares a cluster pitch class, another octave can distinguish its performed voice; the pitch-class set alone does not record that difference.

For `a=0`, the upper collection is C–D–E–F–G. Over C its degree-set is `1,2,3,4,5`; over D it is `♭7,1,2,♭3,4`. The [CF grammar](diatonic-cf-grammar.md) **qualifies** the source’s chord labels: this cluster is not Cmaj9, and a D bass alone does not supply the missing sixth which would distinguish Dorian from neighbouring minor contexts. The field records a reusable upper collection and a selected bass, leaving the actual harmony answerable to all the notes sounded.

## #3 — Where the eighty-four and sixty belong

Partition V by whether its bass belongs to its own parent scale:

$$
V_{\mathrm{in}}=\{(a,b)\in V:b\in S_a\},\qquad
V_{\mathrm{out}}=\{(a,b)\in V:b\notin S_a\}.
$$

Each S_a contains seven classes and excludes five. Hence

$$
|V_{\mathrm{in}}|=84,\qquad |V_{\mathrm{out}}|=60,\qquad
V=V_{\mathrm{in}}\sqcup V_{\mathrm{out}}.
$$

There is an explicit correspondence with the modal field:

$$
\Phi:M\longrightarrow V_{\mathrm{in}},\qquad
\Phi(a,m)=(a,a+S[m]\bmod12).
$$

It is bijective: retaining a identifies the parent, and the seven distinct scale degrees identify m uniquely from the bass. This establishes the source’s `84+60` partition at the level of indexed cluster/bass choices. It does not make the five-note cluster equal to the seven-note mode. Φ retains the parent and tonic metadata while the sounding realisation uses a smaller upper collection.

The sixty remaining entries are exactly **outside-parent-scale bass choices**. Calling them cross-lens extensions adds another condition: the cluster and new bass must fit the alternative lens claimed for them. Membership of the bass alone cannot establish that condition.

## #4 — A cross-lens claim meets its notes

At the C parent, the five outside bass choices are C♯, D♯, F♯, G♯ and A♯. Test each against all twelve transposed major collections while retaining the entire upper cluster C–D–E–F–G:

| Outside bass | Other major-scale anchors containing cluster and bass |
|---|---|
| C♯ | None |
| D♯ | None |
| F♯ | None |
| G♯ | None |
| A♯ = B♭ | F |

Only the B♭ bass fits another complete diatonic collection of this defined family: F major contains C, D, E, F, G and B♭. The resulting sonority can be read within a B♭-grounded Lydian context of that parent, while still omitting F major’s A. A C♯ bass gives a playable chromatic sonority, but no transposed major collection contains all six selected pitch classes.

Transposition repeats this result at every parent anchor. Of the sixty outside-parent entries, twelve fit another member of the twelve major-collection family and forty-eight do not. The latter remain valid members of V; their harmonic account requires a chromatic or otherwise different collection. This corrects the source’s automatic passage from an outside bass to another lens’s modal field while preserving its full 144-choice landscape.

The same field can support many voicings because selection and execution remain distinct. A register change or reordered upper voice changes the performance; a changed bass alters its interval relations; a changed parent cluster changes which five CF selections have been retained.

## #5→0 — The comma retains the ratio-history

The discrete fields above use equal-tempered closure. Twelve tempered fifths give seven octaves exactly. Pure fifths retain the Pythagorean comma:

$$
\kappa=\frac{(3/2)^{12}}{2^7}
=\frac{3^{12}}{2^{19}}
=\frac{531441}{524288}.
$$

The same ratio compares six pure whole-tones with the octave, and five pure whole-tones with the doubled fourth:

$$
\frac{(9/8)^6}{2}=\kappa,
\qquad
\frac{(9/8)^5}{16/9}=\kappa.
$$

This comma is distinct from the `9/8` interval itself. [The foundational ratios](foundational-ratios.md) **derive** that interval as the exact completion of `16/9` to `2/1`. The comma instead measures the accumulated difference between these generator histories and their specified returns. File 4 interprets it as an *aletheic remainder*: the performed account preserves how its return was obtained. [A17](../../../section-rooms/arguments/A17-Toroidal-Circulation-and-the-Arche-Topos.md) **extends** the distinction between renewed circulation and recognition of the standing relation; the interpretation does not turn the comma into proof of a phenomenal state.

The music’s full circuit remains

$$
\frac01=4+2=(5\rightarrow0)=\frac10
=4'+2'=(5'\rightarrow0')=\frac01.
$$

Its primes mark inverse-phase positions. The lens and musical-position primes inherited by the indexed fields identify File 3’s Night/conjugate face, a distinct office. Both traversals are retained.

This record **returns-to** [A15](../../../section-rooms/arguments/A15-Ratio-Rationality-Measure-Reckoning-Harmony-Account.md) with its counted objects, correspondence and selection criteria exposed; [§3 · #4, Musical Resolution](../../../section-rooms/04-mathematical-substrate/movements/29-s3-p4-topology-music-resolution.md) **embodies** its interval return. File 4 and v3 remain the housed candidate lineage, superseded in practice by the actual ql-mef package whose current implementation is unrecovered here. The fields are available as exact operations without claiming that a numerical count alone has realised their musical or epistemic possibilities.
