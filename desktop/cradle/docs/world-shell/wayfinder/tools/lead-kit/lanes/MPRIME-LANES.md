# M′ execution lanes — from the manual at O:I main a56e1719b (20 Oct)

Ground: manual §16.16 (One body, Two scales), §20.1–§20.2, §20.9, §20.14, §21.2 (What strikes the Torus), §22.1
(the Sky as M2′), §22.3 (the M3 clock as M3′, the living form, two tori), §22.7 (Resonator bank), §22.8 (Binding).
Scratchpad copy: `DLW.md` (re-exported from main a56e1719b). QL law: QL-MEF `AGENTS.md`, `skills/ql-law/SKILL.md`; the
M′ physical-music Wayfinder and packets (QL-MEF `docs/M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md`, `docs/M-PRIME-PHYSICAL-MUSIC-WORK-PACKETS.md`).

Every lane: `LANE-RULES.md` binds it. Sonnet builders, at most three at once with the B-list lanes. Each QL-MEF lane
works in `/Users/admin/Central/worktrees/env-2/ql-mef` on its own branch; each O:I lane in the env-1 seat on `dlw/build`.
QL changes reach the candidate only after merge and `oi update` (the lead's). Mac C++ headers are broken (QL's C++
consumer acceptances run on Omarchy, not here): QL lanes stay in Rust and C unless the brief says otherwise.

| Lane | Owner / seat | What it makes true | Waits on |
|---|---|---|---|
| MM1 | QL-MEF Rust, env-2/ql-mef `mprime/m3-form-cell` | The M3 reading carries the living form (three folds: each base's polarity and mobility), the line change, the matrix turn and the pose turn as operations, and the generation cell for the form's hexagram under the chosen matrix (lower and upper pairs, positive and negative codons, dual or non-dual) with the seed and pose map it reads with (#684 "M3 clock"). | — |
| MT1 | QL-MEF Rust, env-2/ql-mef `mprime/strike-at-point` | Each Jankó key's point on its helix, derived from the torus's geometry and published in `ql.janko-surface/v1` (packet K, 13 Oct ruling); a strike at a surface point (θ1, θ2) in the native owner, each mode excited by its own shape at that point. | (serial after MM1 in the same seat) |
| ME1 | O:I hosted frame | Key source Torus · Sky · Manual (default Torus) and Frequency driver Torus · Manual · Focus · Automation (default Torus): the field's modes and the plate follow what the torus plays; old scenes keep their explicit choice. | — |
| MR | O:I hosted frame + shell | The Resonator bank rings: a bank of tuned bodies after the torus, one per part of the M3 clock's cut, tuned to the mode's root, with Decay, Tilt, Span, Mix, Gain, Swap; bound on the clock's own aperture (`set-aperture`, `reciprocal-aperture`). | — |
| ME2 | O:I hosted frame + kernel validator | A symbol's voice is a name or a mode from M2′'s store and carries part of the torus's sound to where the symbol stands; no symbol oscillator remains; old `sound` blocks migrate. | — |
| MS1 | QL-MEF + O:I hosted + shell | Body source Declared · Tattva on the Torus and on Resonance: the M2 condition's tattva and fibre announced through the stage channel, the manual's table applied, the values shown and held while Tattva rules (#684 "Body source"). | MT1 (seat) |
| MM2 | O:I kernel + shell | The M3 clock and the Deck drawn whole on MM1's reading: `law.*`, `generation.*`, the living form's readouts, the line/matrix/pose changes as writes, the Deck's I Ching and Tarot of the current form. | MM1 merged + installed |
| MB | O:I shell (+ hosted for Skin) | Binding: its junctions, string and nonets from the generation cell, its own physics (V(r), tension, coupling), motion only on kernel events, Stretch → Q into Resonance; a non-dual cell's singlet handed to the torus. | MM2 |
| MT2 | O:I hosted + shell | Every strike lands at its point: a key at its helix point, a touch at the surface point, a note in a Live clip at its key's point as the clip plays, a singlet at its codon's place on the ring. | MT1 merged + installed, MB |
| ME3 | O:I hosted frame | Symbols take glyphs from M3′ forms (a fold, a codon, a hexagram, a card) beside letters, shapes and images; a step that changes a symbol's M3′ form moves it one line or one axis; Morph moves along M3′'s torus at the M1′ proportion (9:16), its two forms a form and one of its changes. | MM2 |
| MS2 | QL-MEF + O:I | The Sky's place and rulers (the world's or your place in the request; sunrise, sunset, Chaldean day and hour rulers; Scale mapping's Sky source bound to them) and the planets bending the torus at their longitudes. | MS1 |

Not built, returned to the planning lane: the field collision "set to strike" (§21.2 points to §20.2, which has no such
setting). The Studio's Body row opening the Torus folds into MR's shell part (the manifest's "waiting" note).

Order of dispatch as slots free: MM1, ME1, MR, then MT1 (after MM1 frees the QL seat), ME2, MS1, MM2, MB, MT2, ME3, MS2.
Q1's Team cell and P1 (Prompt pads) follow MM1/ME1/MR.
