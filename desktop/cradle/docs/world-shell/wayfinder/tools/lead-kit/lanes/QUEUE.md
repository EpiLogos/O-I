# The build run's queue (second account, 20 Oct)

PATH.md §7 (row "B — the build list of 20 Oct") is the record: what each lane made true, what runs and what is open.
This file is the lead's working queue. It holds the lanes still to brief and the follow-up decisions already taken, so
a run that resumes after a restart starts here. The lanes run at most three at once, Sonnet builders under
`LANE-RULES.md` beside this file, with the lead converging. Builds go only through `cargo-serial.sh` and
`../tsc-serial.sh`.

## Decisions taken on the follow-ups (owner, 20 Oct: "all follow ups are seemingly obvious decisions")

- **Key source and the drivers.** Key source chooses the pitches only under the Torus driver. Manual, Focus and
  Automation keep their own drive, as ME1 built it.
- **The plate beside the native torus.** The plate stays parked while the native torus follows, as it has since
  #419. The body is the torus, and the plate and chamber are studies of its modes (§20.2 "Modes").
- **§20.1's Sound page** follows the ruling and §20.2. A symbol's voice is a name or a mode, with Gain, Attack and
  Release, and it stands where the symbol stands. Frequency, Follow plate, Waveform and Pan leave the table. This is
  a docs commit to O:I `main` after ME2 lands, written from what ME2 built.
- **The collision "set to strike" (§21.2 → §20.2).** §20.2 Field gains "Collisions strike: On · Off, default Off".
  Under On, a collision in the field strikes the torus at the point where it happens. MT2 builds it with every
  other strike at its point.
- **The Day's agent session.** It is prepared under refs derived from the World (C2), so the Day's agent needs no
  accepted Central Agent profile.
- **The Day document's unmapped fields.** Central maps `/body/p5_tomorrow`, `/body/p5_blockers` and
  `/body/p4_moments` as fields (C4), so each entry lands on its own face and Close's carry reads what Synthesis
  proposed.
- **Close's "learned" list** goes to knowledge as a learning return (`projectcentral.now.return`, kind learning) from
  the Day's agent (C2b). Today the list is only counted.
- **"Close now" by a person.** The app calls `central.day.close-carry` with the human credential (C3). An agent's
  close still needs Close saved at Day start.
- **Grants.** The Day's agent is `native-service:aikit/day-agent`, with `central.day.move.record`,
  `central.receiving.submit` and `central.day.close-carry`. Its token is `~/.central/native-token-day-agent`. The
  human grant adds the Day's four write actions. The owner runs the script the lead prepared, because the agent may
  not write grants or tokens.

## After the PRs of 20 Oct (all landed 21 Oct)

Done:
- The landings: O-I #689, QL-MEF #341, #340 and #342, Central #286, ai-kit #538, Factory #287.
- The seats are released: env-2 central, ai-kit, factory and ql-mef, and env-1 ql-mef.
- The Day's grants are written. The Day agent's token is `~/.central/native-token-day-agent`.
- O:I's QL session is re-pinned to #342 (`instrument-session.mjs`, `PROVENANCE.json`, `strikeAt` in the `.d.mts`).

Left:
- Install from merged main: `oi update --apply --channel mainline`. Every installed cut was checked to be in `main` on
  21 Oct. The installed `ctrl` predates the Day's moves, so they work only after this.
- MT2 makes a touch a point: the frame calls `strikeAt` with the touched (θ, φ).

## The owner's open question (MT1)

Each Jankó key's point on its helix. The sources fix which pitch classes lie on which arc (Musical V3 §II-1.1), but
they leave three things open:
- which torus circle the helices wind on: the graph's M1-5 says the meridian, the M1′ seed §10 the longitude;
- the angle of each position inside its half-arc, and how twelve keys sit on a six-position circuit;
- where the pratibimba arc lies on the 720° cover: half a turn on, at the negation point θ = π, or on the second
  sheet (D17's Hopf fibre).

Once ruled, it is one pure function in `janko.rs` and a `point` field per key in `ql.janko-surface/v1`. A
second-sheet answer also widens `strike-at`'s domain to [0, 4π).

## Lanes to brief and run, in order

| Lane | Seat | Make true | Waits on |
|---|---|---|---|
| Q1 | O:I env-1 | The brief beside this file: the Team cell, the manifest's "waiting", and the nodal quartet read as the QL engine gives it. | — |
| C4 | Central env-2 | The Day document's three fields mapped. A batch Day read (`central.day.read-batch`), so the browser's Days rows cost one call (B5). | — |
| C2b | ai-kit env-2 | Close's learned list as a learning return. The `day_move_runner` tests run in CI against a ctrl built from Central `main` (today they skip). | C4 |
| C3 | O:I env-1 | The Day device on its owners. Every `dayBinding.ts` key (`at_/prompt_/last_/running_/gave_<move>`, `agentWrites`, `src_<mode>`, `closeRoutine`, `tomorrow`, `tomorrowOpen`) is read from `central.day.moves.read` and written through the kernel. One visible runner, open only while the app is, polls `central.day.moves.due` and calls `aikit work day-move due` with the Day agent's token. The person's pad press calls `aikit work day-move run`, and Close now goes through close-carry. Two Days open as two tabs. The Prompt pads (P1's owner) are wired the same way. | P1, C2b |
| K1 | O:I kernel + AIKit | Each chat's time and agent in the kernel's reading (`aikit history` `changed_at_unix_ms` per space; `encounter_agency_read`), so Factory's chats sort newest first and name their agent (B3 follow-up). | — |
| MS1 | QL-MEF + O:I | Body source Declared · Tattva on the Torus and on Resonance (#684 "Body source"). The Torus's Pulses are announced through the stage channel. | MT1 |
| MM2 | O:I kernel + shell | The M3 clock and the Deck drawn whole on MM1's reading (QL-MEF #340). | #340 merged and installed |
| MB | O:I shell | Binding and the singlet. | MM2 |
| MT2 | O:I hosted + shell | Every strike at its point, the collision strike included: a touch at the surface point (`strikeAt`), a key at its helix point once the owner rules it, a note in a Live clip at its key's point, a singlet at its codon's place. | #342 merged and installed, MB |
| ME3 | O:I hosted | Glyphs from M3′ forms, and Morph on M3′'s torus. | MM2 |
| MS2 | QL-MEF + O:I | The Sky's place and rulers, and the planets bending the torus. | MS1 |
| KM | QL-MEF + O:I kernel | The M′ matrices' kernel op (`ql kernel m1`), so the manifest's "waiting" M′ matrices bind (B4). | — |
| B4r | per gap | The rest of B4: the Chakra's today centres and the Situation matrix, M4.4's lens reading, Exact-ratio's source ratios, the agent set's Join. Each gets an owner, or a NATIVE-GAP row in QL-MEF's matrices that names who builds it. | — |
| B5r | AIKit | The next cut inside `Service::open`. Browser rows show the last reading first, and that reading survives a relaunch. | C4 |
| B6 | QL-MEF native voices | The sound's packets (QL-MEF #281): materials, voice modes, modulators, the missing effects, presets. | MT1 |
| B7 | O:I + QL-MEF | The keyboard's playing path (§21.2, M′ plan §3.2): one input path, polyphony, velocity and pressure, sustain, voice stealing, panic, and release on focus loss. | MT1 |
| FB | O:I shell | The Field device on its owner: a Field family in `nativeDeviceCatalogue.ts` and `FIELD_DESIGN_FAMILIES`, so the design's Sound, Level, Tempo, Hold to change, Key source, Resonance, Symbol voices, Pulse and Lights rows read and write the scene (`SETTINGS.field` in `expressionsDevice.ts` already holds Key source and Symbol voices). | — |
| VND | O:I | `scripts/vendor-expressions-engine.mjs` maps `vendor/research-canvas`, so the vendored `shell/researchMaterial.mjs` and `shell/capture.mjs` refresh (stale since the `.canvas` import commit 03780afc0). | — |
| DOC | O:I `docs/dlw/DLW.md` | §20.1's Sound table rewritten to the voice ME2 built (Voice, Name or mode, Gain, Attack, Release; the place follows the symbol), and §20.2's Field parameters gain Collisions strike. Committed after the planning lane's in-flight `DLW.md` edits land. | the planning lane's edit |
| B8 | the owner's desktop session | The candidate's screen pass at the end of each wave, with computer use in the desktop app. | each wave |

## Republishing a QL proof

A QL change that moves a locked input of the M2 or M3 finite proof needs that proof republished before CI passes. In order:

1. Dispatch the engine's workflow on the branch (`gh workflow run m3-engine.yml --ref <branch>`, or `kernel-m2.yml`). Its final
   ledger step fails until the proof is published, and that failure is expected.
2. Download the artifact to a scratch folder, never into the seat's `target`, which is the product's shared pool.
3. Run `m3-publish-driver.py <seat> <artifact dir> "<reason>"` beside this file from a checkout at the run's exact head.
4. Run `requalify-m-ledger.py apply --previous-git-ref 85db896e… --m1-c-log … --rust-log … --m3-audit …` with the replay
   files in `fixtures/kernel/source-requalification/`.
5. Give any new construct an owner in `c/registry/promotions/k9-bindings-v1.json`, then run `k8-census.py --write-receipt`.
6. Run every step of `scripts/verify invariants`, and push. QL-MEF #340 is the worked example (eca9438).

## Resume

1. Read PATH.md §7 and this file.
2. Check each open PR (O-I `dlw/build`, QL-MEF, ai-kit, Factory), and merge what is green.
3. Join seats through `seat join` (`--region` takes every path in one flag), brief the next lanes from the table, and
   run at most three at once.
