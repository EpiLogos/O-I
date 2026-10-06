# Critic log — wave 2, essay + eight section-rooms (Aletheia's office)

Critic: `zcode:enrich-critic-w2b` · seat env-1/o-i (attached to standing lane `enrich/expressions-20261006`) · region `campaign-evidence/2026-10-06-expression-enrichment` · 2026-10-06
Subjects: the nine members authored by `zcode:enrich-essay-l2` (essay `0a0012fe` + legibility pass `e30d4175`; rooms `cecb3850`…`03525841`).

## Verdicts

- **roz-essay-reading — PASS** (all six rubric lines; two binding-note errata logged, E1/E2 below — corrections at next touch, not rejections)
- **roz-room-00-integral-threshold — PASS**
- **roz-room-01-differentiating-mind — PASS**
- **roz-room-02-return-of-zero — PASS**
- **roz-room-03-two-logics — PASS**
- **roz-room-04-mathematical-substrate — PASS**
- **roz-room-05-psychoid-flowering — PASS**
- **roz-room-06-objective-internality — PASS**
- **roz-room-07-instrument-returns — PASS**

No withholdings violation found on the independent re-audit. Two errata (binding-note text, not journeys) go back to the lane with the next touch of these files.

## Objective pass

- Richness linter scoped to `essay/` and `rooms/`: **9/9 PASS** (re-run by the critic).
- `validateJourney` (engine `shell/model.mjs`) run directly on all nine: **clean, zero errors**.
- Identity vs `main`: journey `id`, `description`, and every scene `id`/`name`/`character` byte-identical on all nine (9 + 8×6 scenes; no renames, no removals). All nine ids addressed in `site/essay-expression-map.json`.
- Journey-level metadata byte-identical to `main` on all nine — **previous/next room pointers and the M48→M01 return data preserved**.
- Ceilings: max formations per scene 7 (essay `06-objective-internality`), max pins 4 (`05-psychoid-flowering` m33, `03-two-logics` m22) — inside 10/8 everywhere.
- Rationale coverage (scripted): every distinct staged entity/step text has a rationale and no orphan keys — essay 37/37, rooms 19/23/15/17/28/19/19/19. Exact on all nine.
- Binding hash bookkeeping: `source_revision.records` carry the dbf3b17-basis hashes (verified: recorded sha256 = dbf3b17 bytes for room-02's eight records; fc59a719 bytes differ — the files changed between revisions), with `enrichment.basis_commit: "dbf3b17"` noting the lineage and `source_revision.commit: fc59a719` set. Same treatment wave 1 accepted as honest bookkeeping ("kept"). The fc59a719 re-read is evidenced in the staged content itself (fc59a719-only details appear in the scenes — see fidelity below); the records-list-vs-commit tension is the protocol's own and lands on the owner's convergence step.

## Withholdings — independent re-audit (scripted across all nine journeys, then pixel-checked)

Method: per scene, notation STAGING = entity `.text` + sequence-step `.text` (preserved kickers/titles/bodies excluded per the brief), each string classified new-vs-preserved against `main`, plus glyph-byte checks (Ø = U+00D8, ∅ = U+2205) and a full-string scan for mechanism/degree/tattva vocabulary.

1. **Antikythera mechanism** — the staged three-ring instrument (shape `ring`, count ≥3, counter-signed morph) exists in exactly two scenes: essay `07-instrument-returns` (rings z +0.45/0/−0.45, thetaRate 0.1 / phiRate −0.07) and `roz-room-07` `movement-45` (rings z +0.5/0/−0.5, same rates). Room-07 m43/m44 stage abstract marks only; the only pre-payoff "Antikythera" strings anywhere are preserved-from-main navigation lines ("next → M45 Antikythera as Attunement Instrument" in m44's body) — text, not imagery. The essay's scene[7] automation id `gearing-drift` sits in the payoff scene. **Held.**
2. **`0/1` notation** — staged only from the earning onward: essay scene[2] whose sequence's final step is the earning (M18), then scenes 3 and 8; room-02 from `movement-18` (#5→0) onward; rooms 03–07 after. Room-00 stages the bare promissory `0` (M06's own entry) and room-01 only station indices (`#0…#5→0`). Opening scenes carry direct language only ("What knows?", "the unnamed", "this one", "this one again") — JSON and every inspected frame at every capture phase. **Held.**
3. **Ø** — U+00D8 appears in exactly two scenes: `roz-room-02` `movement-16` (the one job: entity text Ø, walk 0 → Ø — the record's whole movement, "no further step"; pixel: the crossed zero with fused stroke, body verbatim "Ø is the first occlusion…") and `roz-room-05` `movement-34` (the full recognition chain, psychoid material). No other scene stages the chain (the X-bearing chain strings exist only in m34). U+2205 (∅) appears only as set-theoretic notation in the von Neumann ladder (room-02 m15: `∅ → {∅} → {∅,{∅}}`, the record's own) and the essay §1 history sequence (`0 → śūnya → ∅ → 0/1`). The record's guard is honoured: this Ø is staged as the crossed zero, never the empty set. **Held.**
4. **Diaphaneity** — the 180°→360° disclosure is staged only at `roz-room-04` `movement-25` (#0): compass walker `N·E·W 180° → N·E·S·W 360°` beside the determinations walk — exactly M25's own triangle→square content ("The `#3→#4`, `180°→360°` turn changes perspective into contextual holding"). Room-00 m05 stages light → refracted → the prism visible with two colour bands and NO degrees (pixel-verified). **Held.**
5. **36-tattva** — no scene stages 36 or tattva names; room-01 m11 stages the sixfold compression as station indices in z (#0 +0.5 → #1 +0.3 → #2 0 → #3 −0.25 → #4 −0.38 → #5→0 −0.5 — the record's own QL anchor order encoded as depth; the walker traverses #0→#2→#5→0 while #1/#3/#4 hold, disclosed in the note). M11's own limit is respected ("the thirty-sixfold system remains available through a linked QL plate"). **Held.**

## Render pass (pixel evidence, not frame counts)

Critic captures from the committed working tree (clean for essay+rooms) under `/tmp/expression-enrich/critic-w2b/`: 40 first-pass + 21 close-up/burst frames, own injection-pattern driver (server up, `domcontentloaded`, `__JOURNEY__` + `__START_PRESENTATION__`, `inspect()` wait, `setScene(<index>)`, durations inflated so the presentation clock never advances). Author captures reused only where valid (capture mtime after the journey's last write and before commit): rooms 00/01/02/03/05/06/07 key-scene morphs+yaws. **All essay author captures predate the legibility pass (`e30d4175`) and room-04's m29 yaws predate its final write — both superseded by critic captures.**

Critic-measured pixel diffs (PIL, tol 24, share of changed pixels):

| pair | diff |
|---|---|
| room-07 m45 mechanism time pair (+4s/+12s) | 3.88% |
| room-07 m45 pitched pair (+5s/+13s, pitch 0.85) | 7.22% |
| room-07 m45 yaw pair ±0.5 | 3.57% |
| essay §5→0 mechanism yaw pair ±0.55 | 3.85% |
| essay §0 interiority yaw pair +0.42/−0.5 | 5.43% |
| essay §3 torus/covering-square yaw pair −0.5/+0.6 | 4.86% |
| room-04 m29 torus yaw pair (critic, fresh) | 4.44% |
| room-04 m25 determinations t2/t4 | 5.81% |
| room-02 m18 earn t1 vs close-up 0/1 | 10.52% |
| chain burst 0→X / X→Ø/X | 5.34% / 5.25% |
| register dusk vs night-gold | 3.05% |
| register paper vs documentary | 6.78% |
| opening t1 vs walk t3 | 11.05% |

What the frames show (inspected, not just diffed):

- **The recognition chain walks, legibly** (the wave's decisive evidence): room-05 m34 burst crops at 800 ms spacing show `0` forming and holding (+5.0–7.4s), the stroke cutting in (+8.2–9.8s), `Ø` crisp and holding (+10.6–15.0s), `X` crisp (+17.4–19.8s), `Ø/X` crisp (+22.2–24.8s), the red `(0/Ø)/(1/X)` entering (+25.8s) — the record's own chain in its one allowed place. Mid-morph frames stripe (known engine artifact, ledgered).
- **The earning is legible**: room-02 m18 close-up shows `0/1` large and crisp between the standing boundaries, kicker `MOVEMENT 18 OF 48 · §1 · #5→0`, title band `Argued` (= record frontmatter), body verbatim from M18 ("the notation is now earned as the essay's own relational notation, 0/1 ⟷ 1/0"); the walker's steps are the mediant construction `1/1, 1/2, 2/1` — M18's Kaplan/Stern–Brocot content.
- **The mechanism scene**: room-07 m45 on night-gold ground — outer ring ellipse, brighter middle annulus, inner knot with dark gaps, separated in depth at pitch 0.85; phase visibly advances between +4/+12s and +5/+13s; yaw pair gives parallax. Counter-rotation: `thetaRate 0.1` maps to `toroidalMorph.oscillationSpeed`, `phiRate −0.07` to `toroidalMorph.poloidalRate` (engine `nativeParameters.mjs` / `GPGPUSimulator.mjs`) — opposite-signed rates on the two toroidal angles, by construction "different motions legible together, never made the same motion". Honest limit: per-ring angular direction is not resolvable from stills (particles near-uniform per ring); the counter-phase is param-verified at engine semantics level and phase-motion is pixel-verified. The essay's §5→0 scene carries the identical staging (same three rings, same rates, JSON-verified); its own frames needed >16 s to settle from a scene[0] jump (see capture finding below) — the +24 s frame shows the three-ring structure on the deep ground.
- **The withheld opening**: "What knows?" crisp at t1; walk frames at later phases show the walker mid-flight and — at every capture phase — no notation anywhere.
- **Two logics**: essay §2 at +10.5 s shows `0/1` ink left, `1/0` red right, the bare relation's `=` with slash forming below — held apart, the collapse darkening.
- **Registers are genuinely distinct**: paper-panel (00, prism frame), holographic round+red (01, author yaws), documentary blue (02, Ø frame), warm (03, basin yaw), cool blue (04, determinations), dusk (05, chain — near-black ground, parchment/red/blue), working-green (06, workcell frame), night-gold `whiteOnBlack` (07, mechanism). JSON palettes/backgrounds/depth-tints differ per room and the sampled frames read differently at a glance.
- **Claim-status bands**: all 48 room movement kickers/titles checked against record frontmatter at fc59a719 — 48/48 faithful, including the compound statuses carried verbatim (m25 "Derived (native eight-turn traversal; local calculus identities) / Argued (calculus analogy, Jungian 4+2, perspectival geometry)", m26/m29 "Mixed: …" in full). Spot-verified Offered/Argued bands against frames (m16, m18, m45).

## Rubric findings (per member)

### roz-essay-reading — PASS

1. **Fidelity** — records spot-read at fc59a719: M01, M02, M06, M18, M25, M34, M37, M42, M45 (essay scenes 0, 2, 4, 5, 6, 7). The withholding IS the essay's own program (M01: "The Antikythera mechanism enters only after the argument has derived what attunement requires"; diaphaneity's "formal geometry and technical consequences are deliberately withheld"); the earning is M18's ("The notation is now earned"); the six products and S5's `5→0` are M37/M42's ("The section now returns through its parent field… The achieved articulation returns as `0/1`"); the mechanism scene's claim text is M45 verbatim. Nothing staged that the records do not say; nothing carried that was dropped (all preserved text verified byte-identical where checked).
2. **Move carries the argument** — (a) scene[2]: the zero-figure walks the station's history `0 → śūnya → ∅` and lands on the earned `0/1` largest and deepest-inked — history accumulating into notation, the arc's key turn; (b) scene[3]: `0/1` repelled left / `1/0` red attracted right while the bare relation walks `−/− → (−1)/(+1) → (−1)+(+1)=0` beneath — dia's collapse and sym's held pair in one composition; (c) scene[7]: the mechanism enters as three counter-phased z-rings (heavens beyond / gearing / observer's seat — M45's figure translated to depth) with the inner ring walking `vocation → 4:2 → AHI` (the observer-side movements M43/M46/M48 landing in the observer's seat). Decoration nowhere.
3. **Restraint** — the withheld opening is quiet by stated design (pointer 0.35 repel, "the question is held open, not seized"); the return is the slowest beat (18 s, transition 2.4, pointer 0.25) — stated.
4. **Legibility** — text blocks top-left clear of the mass in every inspected frame; hierarchy 22/14; glyphs legible at settled steps (`What knows?`, `0/1` in scene[3] and the return, `psyche/physis`); mid-morph striping is the known engine artifact, not a journey defect.
5. **Continuity** — one arc, verified in pixels and JSON: withheld naming → earned `0/1` → two logics → derivational braid (3D torus over covering square) → psychoid seam → six products in the round with `5→0` on S5 → the mechanism's earned entry → the acquired return `0/1 → 1/0 (rotated) → 0/1` on an open ring; `loop:true` returns the night to the lit threshold.
6. **Craft-note honesty** — rationales 37/37, sign-of statements in the notation's own terms; 3D meanings stated and verified against actual entity z (interiority below the display plane; the lift: torus above, covering square at z −0.5; the instrument's three depths); automations tied to meaning and present in the artifact (9 lanes; `gearing-drift` on the mechanism). **Errata** (binding notes, corrections at next touch): **E1** — the shared legibility paragraph states "speed ≤ 0.6, circulation ≤ 0.5, turbulence ≤ 0.22"; the committed walk scenes actually run up to speed 0.8, circulation 1.7, turbulence 0.34 (16 walk scenes exceed the stated bounds — the pattern's purpose, letterforms holding, is pixel-verified regardless; correct the numbers, not the journeys). **E2** — the withholding note cites "room-01 movement-30" for the sixfold; the scene is movement-11.

### roz-room-00-integral-threshold — PASS

1. Fidelity: m01's panel triple (readings/observer/situation → unshown horizon), m03's cut→gift→forgotten-field with the broken token held apart, m05's prism-without-degrees, m06's promissory `0` with the Bohm bridge ("enfolded, before explication") — all the records' own moves; 6/6 bands faithful. 2. Move: the pole receding in z among given marks (m02, 3D — depth = the world given through the opening). 3. Restraint: the promise opens rather than resolves (slowest transition 2.0) — stated. 4. Legibility: prism frame clean. 5. Continuity: the promissory `0` here is the sign room-02 earns — the across-member thread works. 6. Rationales 19/19; E1 applies to the shared paragraph.

### roz-room-01-differentiating-mind — PASS

1. Fidelity: prakāśa→vimarśa as the reflexive bend (M07), the inner instrument in series (M08), the sixfold compression and its QL anchor (M11 — read in full; the z-order is the record's own #0→#5→0 descent), the means named internal then objective (M12). No 36-tattva staging. 2. Move: the 180° bend staged as the glyph's own rotation; the descent walked through depth while three stations hold — the hologram image ("any local unit retains the whole descent"), disclosed. 3. Restraint: holds are quiet stations, stated. 4. Legibility: author yaws valid and legible. 5. Continuity: apoha planted here returns at room-06 m38 (the ledger's thread, preserved in relations). 6. Rationales 23/23; E1 applies.

### roz-room-02-return-of-zero — PASS

1. Fidelity: M13–M18 read; the von Neumann ladder is m15's own; Ø's one job is m16's whole movement (0 → Ø, no further step — the record's "M16 carries only this first decisive pressure"); the mediant walker is M18's Kaplan construction between retained endpoints. 2. Move: absorption darkening (m14), the ladder growing (m15), the stroke fused (m16 — pixel), the container disclosed (m17 `1/0 → 0·q=1 → ∞`), the mediant walk earning `0/1` (m18 — pixel, crisp). 3. Restraint: m16 is a single-formation scene — one job, one glyph; deliberate and stated. 4. Legibility: the earning frame is the wave's cleanest. 5. Continuity: ∅ (set) → Ø (crossed) distinction maintained across rooms 02/05 and the essay. 6. Rationales 15/15; E1 applies.

### roz-room-03-two-logics — PASS

1. Fidelity: m19 refusal→edge→world; m20's collapse darkening red (the appropriation the record marks); m21's held pair completing to `(0/1)/(1/0)`; m22's Harmonia as third term with the net waiting (the ledger's plant, pin in scene); m24 `B={0,1}` counted to `4+2` in the round. Bands 6/6. 2. Move: Ares/Aphrodite converging while Harmonia appears at the midpoint (positions converge, third formation) — the record's own dramatic. 3. Restraint: the net pin sits quiet — stated. 4. Legibility: author m22/m23 frames valid; essay-level corroboration clean. 5. Continuity: warm register distinct; dia/sym thread from essay §2 lands here. 6. Rationales 17/17; E1 applies.

### roz-room-04-mathematical-substrate — PASS

1. Fidelity: M25 read in full — the eight determinations walked in the record's fixed table order (`−/− → 0/1 → ?/! → −/+ → X/x → AM/IS → ∞/dx → 1/0`), the compound claim-status carried verbatim, the compass disclosure landing exactly here (M25's own `180°→360°`), Trika's quaternary payoff (pramātṛ/pramāṇa/prameya as one appearing-act — the brief's planted thread). 2. Move: the torus over its covering square (m29, 3D — "a path closes on the torus while its endpoints differ on the plane", the record's displaced return); the Spanda kernel's `4+2 → 5→0 → 4+2` pulse (m26). 3. Restraint: m27/m28 hold quiet single-walkers between the two big scenes — stated moves. 4. Legibility: determinations frame crisp at zoom; compass text legible over the triangle mid-morph. 5. Continuity: cool register; the braid signs (`4+2`, `χ=0`, `9/8`) recur from the essay's §3. 6. Rationales 28/28; E1 applies.

### roz-room-05-psychoid-flowering — PASS

1. Fidelity: M34 read in full — the chain is the record's own unfolded sequence with per-sign offices; `Argued` band verbatim; the psyche/physis seam (M31), complexio→quaternity→4+2 inside four corner pins (M33), Apollonian form fading transparent (M35). 2. Move: the chain WALKS — pixel-verified through `0 → Ø → X → Ø/X` into the red meta-relation (burst evidence); this is the presaging ledger's payoff in its one allowed place. 3. Restraint: dusk ground with three inks only; the chain scene is one walker and nothing else — the sequence is the scene. 4. Legibility: crisp at every held step (the wave's best glyph frames). 5. Continuity: Ø here is the recognition-chain sign, distinct from m16's occlusion job — the two jobs never blur. 6. Rationales 19/19; E1 applies.

### roz-room-06-objective-internality — PASS

1. Fidelity: m37–m42 walk the six products' own predicates (Central's three registers; S1→instruction→act; the potency ladder exists→operative; intention→resistance→changed form; the attempt present/absent across z with the host-here bright; one whole→differentiating→still whole) — the records' own words; `Argued` band verified (M41). 2. Move: situation as constitution staged as depth (m41, 3D). 3. Restraint: cool-green working-day accents, no churn — stated register. 4. Legibility: workcell frame clean. 5. Continuity: apoha's return from room-01 lands here (m38) — the transverse thread held. 6. Rationales 19/19; E1 applies.

### roz-room-07-instrument-returns — PASS

1. Fidelity: M45 read in full — the mechanism claim verbatim in the body, `Offered` band verbatim (matches frontmatter), the heavens-beyond/gearing/observer's-situation mapping is the record's own figure (open frame, sky not enclosed, the reading the gearing does not own) translated to three z-depths; m43/m44 carry abstract marks only (withholding kept then paid — the lane's defining discipline). 2. Move: counter-phased rings (engine-semantic verification above) + the middle ring walking `cycles → legible together` (the attunement claim as the walking text). 3. Restraint: m48 is the journey's lowest click strength (0.45) — "the return without possessing", stated. 4. Legibility: night-gold frames legible; the dim-grey editorial on dark scenes is the ledgered engine observation, duplicated content not lost. 5. Continuity: `AHI → return of zero → 0/1` terminal proposition (m48) hands to the essay's return scene — the M48→M01 loop preserved as data and staged. 6. Rationales 19/19; E1 applies.

## Point-Cloud #6 candidates met (this wave)

1. **Entity-sequence phase is not reset by `setScene`** (extends the wave-1 presentation-clock finding): the in-scene sequence clock keeps running across scene switches, so offset-based morph captures on non-first scenes land on arbitrary loop phases. Cost this audit three extra capture passes and a dense-burst method; a `__FIELD_STUDIES__` sequence reset (or a documented phase query) would make morph evidence reproducible.
2. **Scene-jump settle time is unbounded and scene-dependent**: jumping from scene[0] to the essay's deep-ground scenes (07/08) left visible crossfade ghosts past +16 s under swiftshader, while room-07's night scenes settled within ~4 s. Capture tooling should expose a steady-state heuristic (e.g. pixel-delta settling) instead of fixed sleeps.
3. Standing (already ledgered, re-confirmed): mid-morph glyph striping on text walkers; `TextLayer.size` minimum 14 with a generic validation message; dim editorial text on dark scenes (no text-colour field).

## Evidence inventory

- Contact sheets (committed, this region): `renders/essay-rooms/roz-essay-reading-contact-sheet.png` (18 frames — the arc's turns + 3D yaw pairs), `renders/essay-rooms/rooms-registers-contact-sheet.png` (18 frames — eight registers + signature moves), `renders/essay-rooms/room-05-movement-34-chain-walk.png` (24 burst crops — the recognition chain walking, +ms labelled).
- Critic captures (`/tmp/expression-enrich/critic-w2b/`): 40 first-pass frames, 21 close-ups, 24 chain-burst crops, 4 late-settle essay mechanism frames. Author captures reused as corroboration where valid (mtime-verified per file; essay author captures and room-04 m29 yaws excluded as stale).
- Records read at fc59a719: movements 01, 02, 06, 11, 16, 18, 25, 34, 37, 42, 45 (five to the duty's four; chosen because they carry the withholdings' load), plus claim_status frontmatter verified for all 48 room movements.
