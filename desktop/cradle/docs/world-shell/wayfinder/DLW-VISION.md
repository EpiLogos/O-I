# DLW — the vision: the instrument of Epi-Logos

> **Superseded on device semantics and owner facts (12 Oct 2026):** `DEVICE-SEMANTICS-LOCK.md` is the law, `PATH.md` the route, `EXECUTE.md` the execution prompt. This vision draft treated settled owner facts as open questions and asked them; its §4 ledger and §6 carry are retired — builders do not read it.

**Standing.** Compiled 12 Oct 2026 from the owner's contemplation and his mode
ruling of the same day ([CONTEMPLATION-DLW-INSTRUMENT.md](CONTEMPLATION-DLW-INSTRUMENT.md),
ruling at CONT:232-252). The contemplation is the source of the vision, and it
is read as the owner's account, not as claims to test against older documents.
It was aligned with the planning suite (DLW-PLAN, WORLD-SHELL-DESIGN, PATH, MAP,
WIDGET-GUIDE), the shell as built, the kernel ground (Bimba map, Seeds, the L5
lock, the QL law), and the Glass Bead study. The study is research input; its
heuristics are not law. The 7 Oct owner rulings supersede older wording
"wherever the two differ" (PROG:14-15). **Inferred** from that precedent: a
later owner ruling governs earlier wording only where the two actually say
different things at the same level.
[DLW-PLAN.md](DLW-PLAN.md) stays the plan of record for detail and is revised
as §5 sets out. This document governs vision and framing only. It never
overrides an owner ruling or settled law: the mode ruling (CONT:232-252), D13,
§11a, the two-clock doctrine, and the 126 target identities (MAP:200-201).

**Markers.**
- **Grounded**: a source states it, and the source is cited. An owner ruling is
  Grounded and settled; it is never presented as open.
- **Inferred**: the text says what it is drawn from.
- **Open**: unruled, or the sources are silent.
- **Conflict**: source against source, both sides given verbatim-short.
- **Tension**: a reading, or a difference of emphasis or sense, that pulls
  against another. Not a contradiction between sources.

**Path keys.** Every O-I key resolves in the env-1 seat tree. The O-I docs cited
here were checked byte-identical to their `Work/O-I` copies on 12 Oct.
- Source trees:
  - `OI` = `/Users/admin/Central/worktrees/env-1/o-i`
  - `WS` = `OI/desktop/cradle/docs/world-shell`
  - `UI` = `OI/packages/live-shell/ui/src`
  - `CRADLE` = `OI/desktop/cradle/src`
  - `EXP` = `OI/docs/experience`
  - `QL` = `/Users/admin/Central/Work/Quaternal-Logic`
  - `NARA` = `/Users/admin/Central/Work/personal/Nara-Personal`
  - `CTRL` = `/Users/admin/Central/Control`
  - `FLOOR` = `/Users/admin/Central/CLAUDE.md` (the rendered session floor)
  - `BMAP` = `/Users/admin/Documents/epi/Epi-Logos-C-Experiments/Idea/Bimba/Map`
  - `SEEDS` = `…/Idea/Bimba/Seeds/M`
- Working-shell documents:
  - `CONT` = `WS/wayfinder/CONTEMPLATION-DLW-INSTRUMENT.md`
  - `PLAN` = `WS/wayfinder/DLW-PLAN.md`
  - `PATH`, `MAP`, `WG` = `WS/wayfinder/{PATH,MAP,WIDGET-GUIDE}.md`
  - `WSD` = `WS/WORLD-SHELL-DESIGN.md`
  - `UXS` = `WS/UX-SPINE-ALIGNMENT.md`
  - `AGC` = `WS/AGENTIC-CONVERGENCE.md`
- Shell code:
  - `GRAM` = `UI/shell/modeGrammar.ts`
  - `APP` = `UI/App.tsx`
  - `DOCK` = `UI/shell/ModeContextDock.tsx`
  - `BRIDGE` = `UI/projections/encounterBridge.ts`
  - `ENC`, `STORE`, `MODE` = `CRADLE/workspace/{encounter,store,mode}.ts`
- Glass Bead study:
  - `GBG` = `OI/docs/research/glass-bead-game`
  - `MECH`, `DECAY`, `LADDER`, `AFTER`, `REL`, `PRAX` = GBG `01-MECHANICS`, `02-EVOLUTION-DECAY`, `03-LADDER`, `04-COMPUTATIONAL-AFTERLIFE`, `05-DLW-RELATION`, `06-THE-PRAXIS`
  - `APPA`, `APPB` = GBG appendix-a (expressions dive), appendix-b (worlds-of-knowing dive)
- Other references:
  - `LIVE` = `OI/docs/research/ableton-live-12.0.25`
  - `TDR` = `EXP/TECHNE-DUAL-READING.md`
  - `SF` = `OI/docs/SHARED-FIELD.md`
  - `LAW` = `QL/skills/ql-law/SKILL.md`
  - `LOCK` = `QL/docs/L5-TECHNE-DUAL-READING-LOCK.md`
  - `MPW` = `QL/docs/M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md`
  - `PROG` = `desktop/cradle/docs/world-shell/PROGRAMME.md`

Code was read at HEAD `6e2ab0b50`. The whole shell is on O-I `main` (#635, #637)
(PATH §2).

**Standing note on kernel cites.** Every `BMAP/` cite points to a generated repo
reflection of the live Neo4j map, "not crystallised canon"
(BMAP/M4/AGENTS.md:4,10). The live map is the authority (LAW:19; MPW:28).
**P0-BIMBA read 12 Oct 2026** (read only, through the owner's `bimba-graph`
module, `CTRL/user/skills/bimba-graph/bimba_graph.py`; 3713 nodes / 13880
relations). Confirmed on the live map: M4, M4.0–M4.5, M4.3-2, M4.4.4, M4.5,
M4.5-0…5, M5-1, M5-4, M5-5 and M5-5-0…5. Where the live map differs from the
repo reflection the live map wins, and the text cites it as "live Bimba map
(queried 12 Oct 2026)", with the node and field. The divergences are recorded
at L-4, L-8, §3.1, §3.3 and §5.3 item 25. The `BMAP/datasets/*-deep` files are
seed archive: "read them to derive or recover, never at runtime" (LAW:20);
where the live map holds the same phrase, it is cited instead.

**Coordinate grammar.**
- The prefix is `M`. `#` is the legacy spelling.
- After a position-4 segment the separator is `.`, as in `M4.0…M4.5` (LAW:25-31).
- A prime (`M4′`) is the Pratibimba of the same coordinate: the functional coded
  surface, with the address conserved.
- Quotations keep their source spelling.

---

## §0 One page — what a builder holds before touching any surface

1. **The figure.** A DAW is "a total environment for a medium"; the Glass Bead
   Game is "a total environment for meaning" (CONT:26-28). "Hesse described the
   pattern. Live proved the pattern can exist as software. The DLW is the
   instance" (CONT:32), aimed at the contents and values of a *world*: "Not a
   database, not a wiki, not a chatbot, not a knowledge graph" (CONT:30). Live's
   proof is for a medium (CONT:194). The study's finding that no coherent
   computational Game yet exists (AFTER:150-152) is the bar the instance has to
   meet. Live's lesson is that the power "is not in any single feature — it is
   in the integration, the porousness, the shared clock" (CONT:26). The figure
   is also the audit against ornament, a device that judges synthesis for the
   player, and sterility (UXS:159-165; REL:185-192).
2. **The native game.** Epi-Logos is the game the DLW exists to let anyone play
   (CONT:14,198): "the corpus made playable… the reflective turn — language
   operating on language — as a total environment" (CONT:198). The corpus is
   the esoteric identity, the system the exoteric, and the mode the projection
   of one over the other, "bimba over pratibimba" (CONT:18). **Inferred:** in
   kernel terms, M over M′, where M is "the ontological map" and M′ "the living
   functional surface" (SEEDS/M-SYSTEM-INDEX.md:11-13). The corpus is wider than
   the M map (CONT:18 lists the essay, QL/MEF, Vāk, Ta-Onta, Nara, Epii, the
   Covenant). The day is the session in which the game is played (CONT:228).
3. **Five modes, owner-ruled** (CONT:232-252): **Live (base) · Central ·
   Factory · Expressions · Technē**. Epi-Logos is a lens, not a mode (CONT:252).
   - Live is the reverse-engineering basis. It holds Live's real deep dynamics
     as one unified technology, "ported, not approximated" (CONT:244-246).
   - Its destination is Expressions, with audio and video track layers on one
     timeline, "like davinci" (CONT:236-240,247-250). The sources already
     ground the music/audio half: a composition environment "inside the
     existing Expressions application" (MPW:10), and "the DaVinci Resolve
     pattern the owner names: an integrated musical working mode, not another
     app" (WSD:917-918). Neither names a video layer; the video half rests on
     the ruling alone and is the named gap (L23). The order is a sequence:
     Live stays a distinct mode now so the port stays clean and measurable,
     and moves into Expressions later.
   - One environment, never separate apps (CONT:169). A mode switch closes no
     surface (PLAN:2490-2497), and identity survives every crossing (LOCK:39).
     Material becomes material in another mode: a reading becomes a
     commission's source, a cymatic sweep a Journey phrase, a Palace
     composition a return (CONT:167).
4. **Origin-return.** Technē's editing is "working the material backward into
   its origin". That is compassion, "loving sensitivity to origins", with
   origin as Gebser's ever-present origin, "not a point in the past" (CONT:84-88).
   Every lens, constellation, journey and palace "is an act of tracing material
   back to its source… And the tracing is love" (CONT:88). This is the owner's
   correction of the study's "world of knowing" (PRAX:306-310). The kernel
   grounds the return itself:
   - M0 is "The Ever-Present Origin" (live Bimba map (queried 12 Oct 2026), M0
     `c_1_primary_designation`);
   - M4 Nara is where "individual self awakens through compassionate
     sensitivity to origins" (live Bimba map (queried 12 Oct 2026), M4
     `c_0_core_nature`);
   - M5-5's synthesis is the 5→0 Möbius write-back: "As ἀνάλογος it completes
     the return"; its etymological archaeology "pulls #0 ground-material back
     into #5 visibility… depositing through review and Hen vault-write into
     M0's bimba node" (live Bimba map (queried 12 Oct 2026), M5-5
     `q_5_mobius_writeback_reopens`; BMAP/M5/M5-5/M5-5.md:38). Its essence is
     "etymological archaeology as multi-lens vimarśa" (M5-5.md:18);
   - the map joins the two by edges: M5-5 `DEMONSTRATES_THROUGH_ETYMOLOGY` →
     M4.4.4, whose method includes "Reduction - excavating to constitutional
     origins", and M5-5 `RETURNS_TO` → M5-0 (live Bimba map (queried 12 Oct
     2026)). The edges ground origin-return as one movement across M5 and M4;
   - every Logos stage carries a Gebser structure (BMAP/M5/M5-5/M5-5-0…5.md:24);
   - M4.5-1 names "pedagogical compassion" (BMAP/M4/M4.5/M4.5-1.md:17): the
     teaching carries the same care as the return.

   Provenance by ref and revision, with an exact return, is the material
   condition of the act. It is not the act.
5. **Nara and Epii are encounters.**
   - The meditation "is not a pause. It is a
     dialogical encounter. The oracle speaks; you listen. The system meets you;
     you meet the system. This is the layer that keeps the symbols alive"
     (CONT:98). It is M4 Nara. The lock puts "Nara foreground" in the 3:3
     reading (LOCK:31) and runs M4 Nara ↔ S4 Workcell ↔ S4′ Anima → M4′
     (LOCK:96); the live map holds M4 `INVERTS_TO` M4′ as an edge. Nara's work
     is "not providing answers but midwifing recognition" (live Bimba map
     (queried 12 Oct 2026), M4 `q_4_individuation_threshold`). The Seeds make
     M4′ Nara: "journal, daily note, dream, oracle", over session/DAY/NOW
     (M'-SYSTEM-SPEC.md:72).
   - Teaching is M5 Epii: "The system teaches by being met… The teaching is the
     encounter" (CONT:106). Epii pedagogy is a 3:3 depth (LOCK:155). Palace is
     "the explicit deep objectification of the otherwise ambient M5
     articulation/pedagogy/recognition pole" (LOCK:358).
   - Nara is not reduced to evidence law, which is "one expression, at the
     surface" (CONT:96), nor Epii to a help panel. No device judges synthesis
     for the player (PRAX:497-500).
6. **Honesty.** Every write goes through its native owner's operation; a face
   with no write path is a reading (PLAN:459-492). Placement never upgrades
   standing. Waiting is drawn as waiting, with the owner named. M1 generates
   sound and M2 only modulates (D13, MPW:32-34). A refusal mutates nothing
   (APPB:72-76).
7. **Ending.** "Games end… The score remains. This is what keeps a total
   environment from becoming a totalising prison" (CONT:159). "An instrument
   that cannot imagine its end will defend it" (CONT:161). In the kernel, M5-5
   "perfects itself by perishing into ground… its completion is the act of
   handing the whole back, enriched… The cycle completes by starting" (live
   Bimba map (queried 12 Oct 2026), M5-5 `q_5_mobius_writeback_reopens`).
   **Inferred:** the ending is the return, handing the work back as ground.
   The day closes, and "stops before it cleans" if it cannot close honestly
   (CTRL/agents/governance/field-and-now/day-close.md:18). In the kernel, a
   stage ends "when stage completion criteria are met, not on fixed time
   intervals" (M5-5.md:19). Nothing larger than the day yet retires with record
   (§4 L9).

---

## §1 The figure and the layer map

### 1.1 The structural identification

- **Hesse described the pattern.**
  - The Game is "a mode of playing with the total contents and values of our
    culture… like the organist on an organ" (MECH:30-39).
  - Hesse withholds the rules on purpose, so every layer below is reconstructed
    and not specified (MECH:229-247).
  - Magister Thomas: the Game "is neither philosophy nor religion… an art sui
    generis" (MECH:199-206). "A philosophical project" is the owner's
    clarification of 11 Oct, recorded in the study (GBG/README.md:23-24;
    PRAX:50-51); the 12 Oct contemplation does not repeat it.
- **Live proved it for a medium.**
  - The study calls Live "the historical proof of the possibility" (REL:140-141)
    and says the rack is "generalised from Ableton's device chain" (REL:38-39).
  - The study claims a shared musical ancestor, "the organ loft" (REL:42-44,58-62).
    No source documents or denies a Hesse→Ableton influence (**Open**).
  - **Tension, reconciled.** CONT:32 says "Live proved the pattern can exist as
    software"; AFTER:150-152 says a coherent computational Game: "none exists".
    CONT:194 scopes Live's proof to "a total environment for a medium". The two
    claims are about different things and agree.
  - **Tension.** Live's lesson is "the integration, the porousness, the shared
    clock" (CONT:26). The plan carries Live mostly as feature parity plus a table
    of re-meant controls (PLAN:583-589,699-707). The mode ruling answers it:
    the port is of Live's "real deep dynamics as a whole unified technology"
    (CONT:240-241).
- **The DLW is the instance.**
  - The plan's sentence: "one desktop application… one World through four
    projections, in five working modes plus the Epi-Logos lens… on one transport,
    one rack, one encounter spine" (PLAN:75-79). The ruling confirms the five.
  - The kernel states the same figure: "The kernel is structurally an instrument;
    MEF is the scales of that instrument; the bimba map is the score being read
    while also being written" (SEEDS/epi-logos-kernel-spec.md:28).
  - **Inferred** (from that line with MECH:115-118): the Game's Archive of
    accepted symbols corresponds to the live Bimba map, and the Commission's
    power to admit symbols to re-authoring the map, the only licensed channel
    (LAW:61-64, D0/D10).
- **Epi-Logos: native game, and a lens** (CONT:14,198,252).
  - Ruled: "Epi-Logos a lens, not a mode (standing ruling D2/A5)" (CONT:252).
    The cradle already rules it "NOT a mode entry" (MODE:135-139). D2's earlier
    wording, "a mode in the footer, very minimal button… meant to just focus the
    corpus" (PLAN:2644-2647), yields to the 12 Oct wording, which names D2/A5
    itself as the standing ruling (CONT:252). That the later wording governs is
    **Inferred** from the PROG:14-15 precedent.
  - In the kernel, "Epi-Logos" names four things:
    - M5-1, Epii's argument (BMAP/M5/M5-1/M5-1.md:14-18);
    - M5-5-4, stage 4 of the Logos cycle (BMAP/M5/M5-5/M5-5-4.md:14);
    - MEF L5-5′ (QL/docs/MEF-LENS-REGISTER.md:155-163);
    - M4.5-1, Core Epi-Logos Voice (BMAP/M4/M4.5/M4.5-1.md:14).
  - "The station where language sees itself" fits M5-5, "where logos examines
    logos itself" (M5-5.md:23). No kernel source states "the project is named
    for that turn" (CONT:16); it is the owner's naming.
- **Modes against projections.** The five modes are not the design's four
  projections (Earth, Timeline, Constellation, Expressions; WSD:299-310). Modes
  are a separate axis from projections (WSD:223-226).

### 1.2 The layers

Each layer gives the Hesse referent, the Live referent, the DLW standing and the
coordinate. The binding rules are collected in §6.

**L-0 The fixed instrument.**
- *Hesse:* "like the organist on an organ" (MECH:30-39). The organ is the first
  layer the contemplation lists (CONT:28,192).
- *DLW, owner-ruled:* Live mode is the fixed basis, Live's real deep dynamics
  ported as one unified technology (live-set, live-dynamics, live-engine,
  live-shell): "building from that only gets better" (CONT:240-246).
  **Inferred:** this is the organ's role, one fixed instrument every game is
  played through.
- **Tension.** The study maps the organ to the rack: the rack "generalised from
  Ableton's device chain… is building Lusor Basiliensis's organ: a fixed
  instrument of admitted symbolic stops over the total contents of a world"
  (REL:38-41). It also calls the Live rebuild "the working instrument whose
  grammar the World inherits" (REL:29-31). The owner's ruling makes Live mode
  the fixed basis; organ = Live mode stays **Inferred**.
- *Built:* `live-engine` with a typed track/device/mixer graph, deterministic
  offline render, and realtime audition bit-identical to it. Glue, Echo,
  Reverb, Gain and Bypass come from gated `live-dynamics` models. It sounds in
  its own audition path today (APPA:217-224). The measured dynamics backlog is
  LIVE/reconstruction-backlog.md (D1–D18 at 12 Oct, :57-75).
- *Coordinate:* **Inferred** from usage: the Live corpus's "M0/M1/M3" are gate
  and seam labels, not Bimba coordinates ("live-engine is M1", "M1 gate green",
  APPA:218,222; "The M3 POST is that write path", LIVE/integration-map.md:278-279).
  No source states the distinction.

**L-1 Time spine: NOWs and DAYs.**
- *Hesse:* games last "for days and weeks"; a course of "many years"
  (MECH:128-136,233-236).
- *Live:* one transport, kept in the shell as the same 28 slots in every mode,
  each re-meant (GRAM:156-166).
- *Built:*
  - `timeSpine.ts` defines Now, Occasion, Transport, Cron and Chronos. For
    Chronos, "until a family binds, the stratum honestly reports no functions"
    (UI/timeline/timeSpine.ts:19-21).
  - `oi.field-now/v1` and `oi.field-day/v1` are defined
    (OI/shared-field/field-now.mjs:303-360).
- *Designed:* five strata and the two-clock doctrine (WSD:577-596; PLAN:1992-1998).
  WSD's heading "Four strata" introduces a list of five (WSD:802-827), a defect.
- **Two NOWs, both grounded.** The Central/Workcell NOW is a horizon of bounded
  work (EXP/WORKCELL-NOW-TEMPORAL-FIELD.md:70-95). FieldNow is a shared field's
  collective reading with a presence cursor (field-now.mjs:2,45), drawn as "the
  FieldNow presence pulse" (GRAM:454). The contemplation's "FieldNow pulse"
  (CONT:44) is the second. They are two units, not rivals.
- **Day hours, three sides.**
  - Design: 08:30 / close routine / 21:00 (WSD:40; GRAM:282-285; PLAN:621). WSD
    makes 21:00 a Cron cadence (WSD:812-824).
  - Policy: `day_boundary_minutes: 0`, `automatic_day_rollover: true`
    (CTRL/user/civil-time-policy.json), a date rule, not a working window.
  - Practice: the owner's Nara flow opens on a 6am scheduled task
    (NARA/CLAUDE.md:33).
  - Open: whether a cron-fired close fits the law that a DAY is a civil-date
    reading, "never a scheduler's opinion" (day-close.md:5).
- *Above the day:* no WEEK, SEASON or YEAR unit exists in the system. FieldDay's
  interval is set by policy (OI/shared-field/README.md:110-112); the shell's
  only week is a presentation window
  (UI/projections/useWorldTemporalReading.ts:107-114). The owner already closes
  longer units in practice, in Nara's container, outside the DLW:
  - weekly (ISO week) and monthly quilts (NARA/.claude/skills/quilt-weekly/SKILL.md:2-3; quilt-monthly);
  - a quarterly merge-back that "closes the loop" into the tarot journey record
    (NARA/.claude/skills/quilt-journey-merge/SKILL.md:3,11);
  - "roughly twenty months to a deck" (NARA/CLAUDE.md:22).
- *Coordinate:*
  - D5: "one tick = 360/12 = 30°" (LAW:62). "The kernel-bridge profile-tick is
    the only clock… no widget-local interval"
    (SEEDS/INTEGRATED-1-2-3-COSMIC-ENGINE-ARCHITECTURE.md:653). "The sky is
    M2-5's dated state; it is not a second M3 clock" (MPW:110).
  - DAY/NOW appears at M3′, the clock (SEEDS/M'-SYSTEM-SPEC.md:71), and as the
    session/DAY/NOW substrate of M4′ Nara, the lived day (M'-SYSTEM-SPEC.md:72;
    SEEDS/M'-ENGINE-FACES-ONTOLOGY-2026-07-11.md:96). The lock gives product
    ownership to Central (LOCK:601) without moving coordinates (LOCK:100).
    **Inferred:** the clock at M3′ and the lived day at M4′ read as one chain,
    which would place "the day as the session" (CONT:228) in Nara's container.
    No source states that tie.

**L-2 Material in states.**
- *Hesse:* the Archive registers "examined and accepted symbols", and admission
  "scarcely ever occurs nowadays" (MECH:115-118; DECAY:99-101). Hesse forbade
  dissenting games (MECH:217-219); the DLW's "disputed" standing is the
  opposite policy.
- *Live:* clips in states; a modulated knob shows its modulator (CONT:50,52).
- *Designed:* epistemic standing: fact · claim · inferred · hypothesis ·
  disputed · ghost, "never upgraded by placement" (WSD:253-260).
- *Built:* the carrier is an untyped `state?: string`, and only `fact` has a
  producer (UI/timeline/worldTrackAdapter.ts:22-30). The Technē frame omits
  `hypothesis` (UI/shell/ModeCentre.tsx:86-92). Modulation disclosure is built:
  base and effective values shown apart (UI/components/nativeModulation.ts:1-12).
- **Tension.** The contemplation's list (proposed, landed, refused, in-progress,
  ghost; CONT:52) is a fourth vocabulary beside epistemic standing, save
  outcomes (saved/unchanged/stale/conflict/refused, WSD:714-717), and lamp and
  disclosure states (WG:46-51; AGC:271-273). They name different axes.
- *Coordinate:* the kernel's `CanonWriteBackState` (DryRun / PendingReview /
  Applied / Rejected) (SEEDS/INTEGRATED-4-5-0-RECOGNITION-ARCHITECTURE.md:344,351-356)
  is not mapped to the shell.

**L-3 Transformations.**
- *Hesse:* "alter, transpose, and develop" themes (MECH:14-19,58-70).
- *Live:* devices in chains and racks; macros.
- *Built:* the Device SDK (define, validate, scaffold; aperture {reading,
  disabled, apply, captureCurrent}). "A row without a writePath IS a reading"
  (UI/inhabitants/sdk/DEVICE-SDK.md:1-50; PLAN:459-492). One parameter model
  has three presentations (WSD:268-272).
- **Three counts of "family", kept apart:** 6 products (PLAN:123-125); 7
  admitted at the world gate (APPA:239-240); 22 Expressions device
  sub-families through `familyAdmission` (APPA:242-243). CONT:60,141's "22
  declared families" is the third.
- **Tension.** The contemplation lists lenses, agents and devices as one layer
  of transformations (CONT:58-60). The plan keeps their carriers apart: "a
  device never hosts a pane" (WS/wayfinder/DLW-PANES-ONTOLOGY.md:164-197;
  PLAN:1641). One function, separate carriers.
- "Versioned" is asserted for schemas and agent profiles, not for parameter
  addresses (WSD:777-781; AGC:247-248).
- *Coordinate:* kernel transformations are typed `ql.kernel.cross.*/v1`
  (QL/docs/HOLOGRAPHIC-KERNEL-FORMAL-REFERENCE.md:88-109). MEF lenses at M2-1 are
  a different object from shell lenses (BMAP/M2/M2-1/M2-1.md:15-22).

**L-4 Routing.**
- *Hesse:* the Commissions and an anonymous authority; the study's answer is
  that "the DLW colours the modulated knob" (MECH:106-113; REL:72-76).
- *Built:* the writers law (`kernel:<op>` | `shell.<setter>` | `<tool>:<command>`)
  is enforced at admission, on the extension path and at the world gate
  (PLAN:459-492). Palace Return routes a native owner Action, and a refused
  proposal "mutates NOTHING" (APPB:72-76).
- *Designed:* agent routing in Live terms. Return tracks A·Review and B·Wiki;
  write-arm off means writes arrive as proposals (AGC:181-185,264-266).
- **Two senses of routing.** *Signal routing* is the chain reading and arity
  (PLAN:297,494-512). *Authority routing* is the door, the returns and
  attribution, the contemplation's sense (CONT:64-70). No source joins the two.
- **Gap.** Live device writes travel on an HTTP seam, `POST device-param`
  (OI/packages/live-shell/src/main.rs:174-176), outside the writers law
  (LIVE/integration-map.md:271-282). "One neutral door" is not yet true for
  that family.
- *Coordinate:* the only route from lived pattern to canon is M4.3 PatternPacket
  → M4.5 → review (proposed → reviewed → accepted|rejected → applied) →
  verification → human gate → governed write. "Forbidden: any direct write… to
  the M0 graph" (INTEGRATED-4-5-0:161,166,639-660). **Grounded (live map):**
  M5-4 is the agentic protocol seam. One node holds both readings: its role is
  "System agentic protocols: mediation of S/S', M', S4/S5 review, runtime
  agency, and operational capacities", it has the six agents M5-4.0…M5-4.5 as
  `HAS_INTERNAL_COMPONENT`, it `MEDIATES_PROTOCOL_LAYER` over S4.0…S5-5′, and
  its M′ affordance is M5-4′ "Agentic Control Room" (live Bimba map (queried 12
  Oct 2026), M5-4 `c_1_coordinate_role` and edges). INTEGRATED-4-5-0's review at
  M5-4 (:79,153) and the reflection's "Siva-Shakti" with six agent children
  (BMAP/M5/M5-4/M5-4.0…M5-4.5.md) both stand; the 17 Sep reflection does not
  render the role field. No DLW surface claims the M5-4 or M5-4′ address until
  a ticket binds it, and the address is provenance only (PROG:97-101).

**L-5 Composition modes.**
- *Hesse:* the formal school takes its unity from the contents; the
  psychological school, which Knecht calls "pedagogical", from "the meditation
  which followed every stage" (MECH:90-102).
- *Designed, owner-ratified 2026-09-16; revised 19 Oct 2026:* two operating modes
  of one field. Technē is deep and research-authoring; 3:3 Expression is lived.
  The four-and-two reading of Technē (its six instruments as M0′–M5′) is
  withdrawn (owner, 19 Oct 2026; lock §0.1 item 3). "Crossing… changes
  mode of disclosure and available operation, not subject identity"
  (LOCK:3,14-51; TDR:12-35). By the owner amendment, the Expressions system and
  the Technē HUD are "one application with two operating modes" (LOCK:390-392).
- **Tension — the school pairing.** The contemplation pairs the schools with
  Central and Technē, then names "the dual reading: 4:2 Technē / 3:3
  Expression" in the same paragraph (CONT:74-78). The study pairs formal with
  Technē and psychological with Expression (REL:51; PRAX:283-286,309). In the
  L5 lock, Central was disclosed as Technē's Project instrument and as an M0
  depth in 3:3 (LOCK:181-218). Reading Central as "the ground both readings stand on" is
  **Inferred**; CONT:184 "All return to Central" supports it.
- *Coordinate:* 0/1 = 4+2 = 5→0 = 0/1. 4:2 is the fourth (4/3) and 3:3 the
  fifth (3/2) (SEEDS/M'-SYSTEM-SPEC.md:364-374). The 3:3 halves are the physical
  and mental poles (SEEDS/epi-logos-kernel-spec.md:30), "cosmic played
  instrument / personal lived return" (M'-ENGINE-FACES:94-97). There is no M6
  or M7 (LOCK:51,122).

**L-6 Editing: Technē and origin-return.**
- *Hesse:* Knecht translates the Confucius game "back into its original
  language" (MECH:120-126,140-147). The meditation is on each symbol's "content,
  origin, and meaning" (MECH:78). "Forgetfulness of origins" marks decay
  (DECAY:150-151). Meditation and origin-return are one movement in Hesse.
- *Owner's correction, Grounded* (CONT:82-90): Technē's editing "is not just
  editing — it is working the material backward into its origin"; the tracing
  is compassion, "loving sensitivity to origins", with origin as Gebser's
  *Ursprung*, "an ever-present source". "The Archive is reversible. And the
  tracing is love" (CONT:88). It corrects the study's "world of knowing"
  (PRAX:306-310).
- **Tension, read together.** CONT:90 says Technē "is not 'the world of
  knowing'"; CONT:182,184 call Technē "the knowing" and add "The work of
  origin-return". Read together: Technē's knowing is origin-return.
- *Kernel grounding of the return:*
  - **M0.** "The Ever-Present Origin" (live Bimba map (queried 12 Oct 2026), M0
    `c_1_primary_designation`: "Subsystem #0 - The Foundational Void -
    Proto-Logy - The Ever-Present Origin"). The ever-present Origin is "not a
    starting point in time but the perpetual condition"
    (SEEDS/M5'/ql-musical-derivation-v3.md:155).
  - **M5-5.** The 5→0 Möbius write-back, "As ἀνάλογος it completes the return"
    (M5-5.md:38). On the live map the Logos Atelier sits at unprimed M5-5: its
    etymological archaeology deposits "through review and Hen vault-write into
    M0's bimba node", and M5-5 `RETURNS_TO` M5-0, so the return passes through
    review, to M5-0, then into M0 (live Bimba map (queried 12 Oct 2026), M5-5
    `q_5_mobius_writeback_reopens` and edges). Operational essence
    "etymological archaeology as multi-lens vimarśa" (M5-5.md:18); the Seeds'
    "M5-5 Logos Atelier" in the Möbius loop (INTEGRATED-4-5-0:179).
  - **Gebser.** Each Logos stage carries a Gebser structure, archaic to
    supramental (BMAP/M5/M5-5/M5-5-0…5.md:24). Nara's lens 0 is the "Gebser
    Lens" (live Bimba map (queried 12 Oct 2026), M4.4.0).
  - **M4.4.4.** The "Phenomenological Lens": "Reduction - excavating to
    constitutional origins" (live Bimba map (queried 12 Oct 2026), M4.4.4
    `c_0_essence`; BMAP/M4/M4.4/M4.4.4/M4.4.4.md:18). **Grounded (live map):**
    M5-5 `DEMONSTRATES_THROUGH_ETYMOLOGY` → M4.4.4, and M4.4.4.5 "Phenomenology
    of Pratyabhijna" is joined to M5-5 by `RECEIVES_ETYMOLOGICAL_EVIDENCE`.
    Etymological archaeology at M5 and Nara's reduction to constitutional
    origins at M4 are one movement on the map.
  - **M4 Nara.** "Individual self awakens through compassionate sensitivity to
    origins"; Nara operates "through profound compassionate sensitivity to
    origins" (live Bimba map (queried 12 Oct 2026), M4 `c_0_core_nature`,
    `c_1_description`). The seed archive's gloss names the referent as
    "unique temporal-spatial emergence conditions", natal origin
    (nara-deep/nodes-full-detail.json:62).
  - **M4.5-1.** Compassion joined to teaching: "pedagogical compassion"
    (M4.5-1.md:17).
- **Inferred join to Technē.** The lock makes M5′ "the SAME application in M5/M0
  deep-working mode" (LOCK:399-401), the two poles the 5→0 write-back joins. The
  owner places origin-return in Technē; the kernel places the return at M5→M0;
  Technē is the mode that works those poles. The site sources the contemplation
  cites (B3, B8) were not found.
- *Built and designed mechanics* (the material condition):
  - the cradle Trail with `returnTo` (CRADLE/CradleFrame.tsx:1012-1026), not
    carried into the new shell;
  - the Technē Clip "source" section, declared-waiting (UI/shell/ModeDetail.tsx:254-263);
  - the lane-5 "source/verso leg with explicit return… restores the exact beat
    by ref equality" (PLAN:1700-1720);
  - page-anchored cites, backlinks and ghosts, built in Archetypal-Earth
    (APPB:51-53).
- **Tension — three senses of "editing".** The warp engine is Live's (D9; Live
  mode, the port). The owner's earlier words liken Central to Live's clip view,
  "the nitty gritty fucntionalities of warping etc", for seeing what folders
  are worked in (PLAN:1316-1320). The contemplation's editing layer is
  origin-return in Technē (CONT:82-84). Three senses, no contradiction.

**L-7 Meditation: M4 Nara, the dialogical encounter.**
- *Hesse:* "silent, formal meditation on the content, origin, and meaning… kept
  from degenerating into mere empty signs" (MECH:76-83).
- *Owner's correction, Grounded.* The study reads the meditation as evidence law
  and a pause (PRAX:40; REL:66-82). The owner: "Not just evidence law"
  (CONT:96); "The meditation is not a pause. It is a dialogical encounter. The
  oracle speaks; you listen. The system meets you; you meet the system"
  (CONT:98). The owner's account governs (Standing). The live map agrees: Nara's
  work is "not providing answers but midwifing recognition", and it completes
  "where the person, fully met, becomes a co-creator of meaning" (live Bimba map
  (queried 12 Oct 2026), M4 `q_4_individuation_threshold`,
  `q_5_dialogical_consummation`).
- *Nara's place in the sources* (the DLW interface, C3, stays the owner's):
  - the lock puts "Nara foreground" in the 3:3 Expression reading (LOCK:31) and
    lists "M4 Nara, centres, EarthBody, identity/oracle/transformation/depth" in
    the Expression field (LOCK:153);
  - one chain: "M4 Nara ↔ S4 Workcell ↔ S4′ Anima → M4′" (LOCK:96); M4 is "the
    strongest situated bridge" (LOCK:465); M4 `INVERTS_TO` M4′ is also a map
    edge (live Bimba map (queried 12 Oct 2026));
  - the Seeds make M4′ "Nara | journal, daily note, dream, oracle, personal
    Pratibimba" (M'-SYSTEM-SPEC.md:72);
  - M4′'s whole-application body is the Expressions application
    (LOCK:388-399); the lock's lens reading of M4′ as Places/World is withdrawn
    (owner, 19 Oct 2026);
  - in code the Expressions companion is Anima, with the tab "Nara · oracle",
    "the Nara/oracle side of the retained body" (DOCK:66);
  - `nara-conversation` is a Central-family rack face over
    `oi.nara-dialogue-binding/v1`. It resolves only "with a current Nara identity
    and an open Expression" and renders no transcript
    (UI/inhabitants/ConversationNaraFace.tsx:3-12; UI/inhabitants/worldShellFamilies.ts:84-89);
  - the owner's day flow file is Nara's living log (NARA/CLAUDE.md:32-45).
- **The oracle.** The Oracle Interface is M4's own designation, not a separate
  node: "Subsystem #4 - Oracle Interface Between Personal and Universal
  Domains" (live Bimba map (queried 12 Oct 2026), M4
  `c_1_primary_designation`; also `q_1_the_oracle_interface`). M4.2
  "Translates cosmic patterns into comprehensible symbolic guidance… Ethical
  divination respects free will" (live Bimba map, M4.2 `c_0_essence` and
  `c_1_key_principles`; BMAP/M4/M4.2/M4.2.md:18,21). The owner draws Thoth cards daily
  (NARA/CLAUDE.md:22,34-36). "The oracle speaks; you listen" is this oracle. The
  study's failure mode, a device that "judges synthesis for the player — scores
  the scene, picks the reading" (PRAX:497-500; UXS:160-162), is a different
  thing, and the rule against it stays.
- Nara's two-stroke rule, "every outer manifestation is followed by inner
  integration" (BMAP/M4/M4.3/M4.3.md:17), is the structural analogue of
  Hesse's meditation after each symbol (**Inferred**).
- Personal bodies are handle-only behind a ConsentGate
  (INTEGRATED-4-5-0:43,115,129-134).

**L-8 Teaching: M5 Epii, the encounter.**
- *Hesse:* "Magister Ludi… originally meant… simply schoolmaster" (LADDER:50-55).
- *Owner-stated, governing:* "The system teaches by being met. Epii is the face
  you meet. The teaching is the encounter" (CONT:106). "The system teaching
  itself is the system performing its own name" (CONT:108).
- *Three loci, Grounded:*
  - **In situ.** M4.5 "hosts epii consciousness in situ, running Logos Cycle
    over each Nara episode" (BMAP/M4/M4.5/M4.5.md:14). Its six children:
    Curriculum Map, Core Epi-Logos Voice, Method Transparency Lab, Integration
    Lab, Pedagogy Lab, Logos Cycle Engine (live Bimba map (queried 12 Oct 2026),
    M4.5-0…M4.5-5). M4.5-1 carries "pedagogical compassion". On the map, M5-5
    `ENABLES_PRACTICE` → M4. **Inferred:** the teaching runs inside the
    meditation, not beside it.
  - **Ambient.** M5′ Epii is "pedagogy, archaeology, review"
    (M'-SYSTEM-SPEC.md:73). Epii pedagogy is a 3:3 Expression depth (LOCK:155).
  - **Objectified.** Palace is "teachable", "the explicit deep objectification
    of the otherwise ambient M5 articulation/pedagogy/recognition pole"
    (LOCK:356-358). Palace is the form the M5 pedagogy pole takes in Technē.
- *Study heuristics, kept as such:* the schoolmaster placed in Factory ("the
  Desk is the schoolroom") and the measure "a pupil who no longer needs the
  teacher" (PRAX:205-208,505-510). They do not replace the owner's measure.
- *Built:* Epii is the Technē companion, "Epii · Source · Proposals · Field"
  (DOCK:67). A cradle pedagogy compiler exists (CRADLE/expression/pedagogy.ts:16-25).
  QL `logos.return` records a T/C/T′/C′ envelope labelled a "Logos cycle", with
  `learning_demonstrated=false` (QL/crates/ql-mef/src/epi_agent.rs:883-930).
  **Inferred:** the only built place where teaching could be evidenced; still
  undemonstrated.
- No teaching surface exists in the shell. Live's Lessons panel was not adopted
  (PLAN:776-778). On the live map, M5-0, M5-2, M5-3 and M5-4 carry placeholder
  descriptions ("Node with ID 18…22") over populated q-registers; M5-2/3/4 also
  carry roles and rendered affordances. M4.5.0…5 are unnamed dot-after-5
  duplicates of M4.5-0…5 that carry only `s_4_role` values (live Bimba map
  (queried 12 Oct 2026); BMAP/M5/M5-0/M5-0.md:14).

**L-9 Performance: through Expressions and Technē.**
- *Hesse:* the Game is conducted publicly; the Magister subordinates himself
  "to the inviolable inner laws of the Game" (MECH:182-196). The study's
  instruction to builders is to "Design for: human performers and an audience"
  (AFTER:142-143).
- *Built, on main via #635:* the Expressions native transport
  (UI/components/NativeTransportBar.tsx); scene playback
  (UI/components/nativeScenePlayback.ts); property takes (record, replace,
  append) (UI/components/NativeTakes.tsx; UI/native/frameTakes.ts). "Live replay
  not yet run" applies only to the Device SDK row (APPA:343). Live mode's
  transport, session and mixer are read-only (UI/components/TransportBar.tsx:13-22).
- *The Expressions medium* (CONT:120-125), each piece against the sources:
  - **Glyph projection scenes as the medium.** Glyph, text and role material in
    scenes is landed (APPA:127-147). Naming it "the medium" is the owner's
    (CONT:120,123). "Glyph projection" is a third sense of "projection" (§5.1).
  - **The physics sim as a single instrument.** Owner-stated (CONT:124). WSD
    docks "the field/PCM owner… as an instrument device… the stage stays the
    instrument's visible body" (WSD:922-924). Whether the GPGPU field is that
    device's body is Open (L17).
  - **GPGPU particle field.** `GPGPUSimulator`, landed
    (APPA:151; OI/desktop/cradle/expressions-app/src/engine/).
  - **2D Chladni plate and 3D standing-wave cavity.** Landed in the cymatic
    resonator, 8×8 and 4×4×4 modes, "a damped modal resonator in the envelope
    domain" (APPA:163-168; …/expressions-app/src/engine/cymaticResonator.ts:7-25).
  - **`followCymatic`.** A per-entity voice field that "sounds the entity's
    cymatic/template frequency" (APPA:174-176; UI/components/nativeEntityFace.sound.ts:12).
  - **Audio and video track layers on one timeline** (CONT:247-250). The ruled
    destination of Live in Expressions. **Named gap:** no design or code names a
    video track (WSD and PLAN carry no "video"). Track kinds enter as adapters on
    the Timeline projection (WSD:945-951; PLAN §5.2, §5.8).
- **Tension — composition direction.** CONT:116,127: "Technē composes →
  Expressions performs". MPW:14,160-162 puts composition and production inside
  Expressions, with Technē views disclosing and operating the same work. The
  lock names M3 Journey ↔ Expression Scenes the strongest formal bridge
  (LOCK:457-466) between two operating modes of one application
  (LOCK:390-399). Read as that relation, the contemplation's direction is
  grounded at the M3 bridge; it is not a pipeline or a hierarchy.
- **Tension — causation wording.** CONT:124: "the cymatic patterns produce
  sound". MPW:86-88 and PLAN:2017-2022: excitation plus material "determine
  evolving state", and audio and visible displacement "derive from that state".
  The plate as sounding body agrees with MPW's resonator role; only the causal
  wording differs.
- **Open — entity voices.** Each is "a small voice per present entity — never a
  second clock and never the native M2 PCM owner" (entitySound.ts:5-7). The
  phrase "M2 PCM owner" differs in wording from D13 (MPW:32-34). Entity sound
  declares no MPW role (MPW:86). Its D13 standing is unruled.
- "The Palace in Technē becomes the performance in Expressions" (CONT:127) has
  no source; the Palace returns proposals (APPB:72-76).
- *Coordinate:* D13: "M1 is the oscillator source; M2 pitch structures are
  tuning/modulation targets"; M2 sources carry `generates: false` (MPW:32-34;
  UI/inhabitants/ql/qlModulationSources.ts:31-54). M3 is score material and M4
  the body (PLAN:2023-2100).

**L-10 Recording: day-close, handoff, score.**
- *Hesse:* games are written down "rather similar to the pattern of a chess
  game" (MECH:115-126).
- *Built:* the day/now device reads the day record. Close and rollover are
  declared controls, never fired from a device
  (UI/inhabitants/CentralDayNowDevice.tsx:3-20).
- *Designed:* the Factory handoff reading order (EXP/FACTORY-AGENCY.md:130-142).
- *Law:* snapshot first, then derive the dated reading; "yesterday remains a
  reading" (day-close.md:7-14,22).
- **Tension.** "The score is material" (CONT:135) against the study's "a score
  that ends rather than accumulates" (AFTER:144; REL:54). The owner's word
  stands; the study's caution survives as the reuse rule "choose first, create
  only when missing" (PRAX:279-281).
- CONT:137 cites appendix-a §1 for the day-close; that table has no day-close
  row (APPA:30-48).
- *Coordinate:* persist "through existing Expression/Scene/Edition and native
  owner services, not a second project or score store" (MPW:138). "No layer
  writes canon… on its own" (INTEGRATED-4-5-0:53-66).

**L-11 Design channel: the SDK and the neutral door.**
- *Hesse:* the annual competition is "the sole occasion when competitors were
  permitted to overstep the bounds of the canon" (MECH:134-136).
- *Built:* validate-before-admit; "one product family per product, squatting
  refused" (UI/inhabitants/sdk/products.ts:16).
- **Tension.** CONT:141 maps the competition to the SDK. The study maps it to the
  byte-locked icon-cut specimen, which "must never become 'never'"
  (REL:165-171). Two readings of one figure.
- *Coordinate:* for symbols, the channel is re-authoring the live Bimba map.
  Renderers hold no local tables (LAW:61-64; INTEGRATED-1-2-3:654-655).

**L-12 Collaboration: the shared field.**
- *Hesse:* cooperative construction; no scoring exists anywhere in the text
  (MECH:207-210,287).
- *Built:* participant, projection, contribution and encounter contracts; a
  contribution is "an attributable difference returned by a Participant"
  (SF:179-199,300-334). The contact law
  (OI/docs/ENCOUNTER-SECURITY-IMPLEMENTATION.md:163-189). FieldNow
  compare-and-swap (APPB:283-286).
- **A2A.** The study lists "two-world live acceptance" among landed
  underpinnings (APPB:263,281-282). The security record keeps "Contact→A2A
  admission" an unclosed front (ENCOUNTER-SECURITY-IMPLEMENTATION.md:282). The
  shell's TS sources carry no A2A binding (grep, 12 Oct). In the DLW: unbound.
- In the shell, the Field tile shows only the carrier kind (DOCK:206-211).
  Visiting is contract-only and has not been exercised end to end (PLAN §10
  item 21; APPB:308-312). Fog is mockup-only (PLAN:2420-2426).
- **Tension, inside the study.** PRAX's skill is legibility, not scoring:
  "Skill at this game is legible *because* the discipline is: the epistemic
  standings ride the clips" (PRAX:422-423). AFTER's "game collapse" is
  "adding scoring, competition, or winning" (AFTER:68-69). The two do not
  contradict; the word "skill" pulls toward the scoring the study refuses.
- *Coordinate:* M4.4.4.4 has canonical Bimba, a per-user Pratibimba overlay, and
  a depersonalised Archetype Atlas (seed: nara-deep:50,911). Contact law and A2A
  have no coordinate.

**L-13 Extension: the seventh product.**
- *Built:* the seventh-product test has run twice. "If a core change is needed,
  either the family boundary or the core concept is wrong" (PLAN:324-329,491-492).
- **Gap.** The SDK "never creates a mode" (UI/inhabitants/sdk/modes.ts:29-31).
- **Tension.** "Open at its edges, closed at its core" (CONT:153). In Hesse,
  openness is the early phase and closure the decay (DECAY:97-100). The owner
  names a structure; Hesse a history.
- *Coordinate:* six is "foundation, not terminus"
  (BMAP/datasets/paramasiva-deep/Quaternal_Logic_Lived_Topology.md:147-203).
  137 = 64+72+1 sits at M1/M2/M3, never M0 (INTEGRATED-1-2-3:46-56).

**L-14 Ending.**
- *Hesse:* the Board "cannot metabolize" Knecht's warning (DECAY:152-169).
  "Decay inscribed in evolution — 'the ordinary fruit of any beautiful
  historical form'" (CONT:192). **Open:** no DLW layer holds decay. **Inferred:**
  origin-return (L-6) is the counter-practice to the "forgetfulness of origins"
  Hesse names as decay (DECAY:150-151).
- *Built and law:* the day close; a refusal mutates nothing.
- *Designed:* the legacy cradle retires "on the owner's named day against the
  cutover gates" (PLAN:2984-2988).
- *Precedents:* the Superseded list (LAW:70-77); projection withdrawal as "a new
  Projection revision rather than deletion" (SF:487); the owner's quilts and deck
  cycle (L-1).
- **Open.** Retiring a mode, a projection or the shell with record. "An
  instrument that cannot imagine its end will defend it" (REL:172-178; CONT:161).
- *Coordinate:* 5→0 sediments into the next ground; "There is no final genus
  level" (Quaternal_Logic_Lived_Topology.md:330-334). Stage transition occurs
  "when stage completion criteria are met, not on fixed time intervals"
  (M5-5.md:19). **Inferred:** with the day-close law ("never a scheduler's
  opinion", day-close.md:5) this reads as one discipline: an ending is a
  completion that leaves a record, not a timer firing.

**L-15 Porous modes.** "Live is not five apps sharing a file format… one
environment, read in modes that slip into each other as the work demands"
(CONT:169). The mechanisms and gaps are in §2.4. *Coordinate:* coordinate, lens,
tick, session and `day_now` survive the 0/1 toggle (SEEDS/M'-SYSTEM-SPEC.md:172-180);
"Depth changes disclosure and composition, not ontology" (LOCK:452-479).

---

## §2 Modes

### 2.1 The mode set — owner-ruled (CONT:232-252)

- **The ruling.** "Five modes stand: Live stays as the base mode" (CONT:234).
  Owner's words: "lets just keep the live mode, it ought be integrated cleanly,
  eventually, into expressions where we've planned to have the video and audio
  track layers together (like a video editor would, like davinci)…" (CONT:236-241).
  Mode set: **Live (base) · Central · Factory · Expressions · Technē**, with
  Epi-Logos a lens, not a mode (CONT:251-252).
- **Source tie, music/audio half only.** MPW:10 is the strongest tie for "into
  Expressions": a composition environment "inside the existing Expressions
  application. Music is a first-class M1–M2–M3 working mode of that engine".
  WSD §18 names "the DaVinci Resolve pattern the owner names: an integrated
  musical working mode, not another app" (WSD:917-918), and "Revision 5's Live
  column is that mode's transport face" (WSD:919-920). MPW:144-146 agrees: "a
  proper musical working mode, not another app". The rack names Live "(music,
  the shell's base mode, restored)" (WSD:24-26). No source names a video layer
  (WSD carries no "video"); the video half rests on the ruling alone and stays
  the named gap (L23).
- **"Base" settled for Live.** WSD:24-26, REL:29-33 ("The DLW's base mode is
  music") and the ruling agree. CONT:179's "Central is the base. The other modes
  return to it" names Central as the ground of return (CONT:184, "All return to
  Central"), not the base mode.
- **The code matches the set.** `SURF_MODES = ['live','base','factory',
  'expressions','techne']` (GRAM:33). The rail needs no entry added or removed.
  Code maps "base → book mode `base` + WorldContext.world = 'central' — …
  Central is a world context, not a separate mode" (GRAM:20-21).
- **Naming defect.** GRAM:228 titles the Central mode `'Base · Central'`, and the
  comment at GRAM:31-32 reads "Live · Base · Central · Factory". Under the ruling,
  "base" names Live. The title should read "Central" (T-LABELS). Two ids carry
  the word, and they differ:
  - the surf/shell id `base` is Central's (GRAM:20, GRAM:33);
  - the stored book mode `base` serves both Live and Central. Live is "book mode
    `base`, the music presentation" (GRAM:19); Central is book mode `base` plus
    `WorldContext.world = 'central'` (GRAM:20); restore reads `storedMode ===
    'base' && …world === 'central' ? 'base' : 'audio'`
    (UI/continuity/workspace.tsx:27).

  A rename that touches only Central's `base` would break Live's restore, so the
  book mode is not renamed without a migration. The GRAM:21 comment ("Central is
  a world context, not a separate mode") contradicts the ruling's wording and
  is corrected in the same ticket. Renaming touches the grammar tests and is the
  ticket's call. WSD:26,32 and PLAN §4.2's heading carry the same label.
- **Central as a mode.** The ruling names Central a mode. The design builds it
  as a world context over one book mode (WSD:533-536), which a mode can be. What
  stays open is the leave act (L2).
- **A sequence, not a split.** APPA:217-224 says the clean-room live-engine is
  "separate, the audio base mode… not the Expressions sounding surface".
  CONT:118 says Expressions "retains basically the same full native Live musical
  system". The ruling orders them: Live separate now, so the port stays clean
  and measurable; into Expressions later (CONT:247-250).
- **Two containments, two levels; both stand.** In D-A and D-G, "the Ableton
  Live fork" is the whole re-engineered shell: "The build base is the
  reengineered Ableton shell now under construction" (PROG:17-19). D-G puts the
  Expressions application inside that shell: it "remains the M4 body —
  genuinely integrated into the Ableton Live fork" (PROG:110-112). The 12 Oct
  ruling puts Live *mode*'s music system inside the Expressions *mode* (CONT:247-250).
  One is the application inside the shell, the other a mode's system inside a
  mode. Nothing is superseded.
- **The cradle.** The installed cradle's strip holds "the four work modes only"
  (MODE:139-142), with Base for Central's ground. The new shell restored Live
  beside them.
- **Build.** The five-mode grammar is law. Live is ported as Live's real
  dynamics from the measured corpus, never approximated. Live's move into
  Expressions waits on the owner's timing (T-LIVE-INTO-EXPRESSIONS, L23).

### 2.2 Live function families → DLW modes

Live mode, the port, holds every family first; the rows below say where each
family's *function* also lands in the other modes. The CONT:38 test: does the
relocated control carry the same structural function (**F**) or only the
slot's position (**P**)?

| Live family | Where it lands | Function test (CONT:38) | Standing |
|---|---|---|---|
| Transport (play/stop/tempo/meter/metronome/quantise/punch/loop/Link) | All five modes; 28 fixed slots (WSD:23-41; GRAM:156-166) | **F:** Central punch/loop → day window (GRAM:282-285); Technē occasion window; Factory "write window" (GRAM:344-346); metronome → Factory heartbeat, Technē presence pulse. **P:** Expressions punch/loop all "loop the saved sequence" (GRAM:396-398); Central metronome = autosave; CPU = save state; key/scale = packet tokens or aperture (GRAM:264-292,449-478) | Typed data built (GRAM:173-480). Interactive only in Factory (UI/agent/AgentShellTransport.tsx:133-159) and Expressions (NativeTransportBar). Live read-only "until its owner lands" (GRAM:223). Central and Technē drawn waiting (UI/shell/ModeTransportBar.tsx:81-106) |
| Arm slot | All five | **F:** Expressions "Studio arm" = record-arm. **P:** in Central, Factory and Technē the slot is the write-authority gate (GRAM:209,279,341,393,465). Intended re-meaning (GRAM:4-5) | Grammar built |
| Session / clip launch | All five (GRAM:178,231,301,363,415) | **F** in all: day-as-clips, tasks, scene rows, journey stops | Live read-only (UI/components/SessionView.tsx:30-57); Expressions whole-scene play real (:100-122); Factory grid live; Central day track live-verified at 18 clips (PLAN:1383-1385); Technē Journey waits (GRAM:479) |
| Arrangement | All five (GRAM:179,232,302,364,416) | **F** | Live drawn, no automation lanes (UI/components/ArrangementView.tsx:49-148); World cut timeline for Central and Technē (UI/projections/worldTimelinePresentation.tsx) |
| Automation and clip envelopes | Live mode (port) | **F** | `AutomationEnvelopes`, `AutomationLanes`, `ClipEnvelopeChooserViewState` in the set model (LIVE/session-model.md:69,72). Not ported |
| Browser + pool | All five, one catalogue each (WS/wayfinder/DLW-PANES-PER-MODE.md) | **F** (the Archive register, MECH:115-118) | Live: devices in set only (UI/components/BrowserPane.tsx:10-37); Central: Days and Files cut; Technē: Sources and Files cut (GRAM:241-257,426-443) |
| Tunings and scale awareness | Live mode (port); M2 pitch structures as tuning/modulation targets (D13, MPW:32-34) | **F** | Browser "Tunings" (LIVE/ui/UI-EVIDENCE.md:52); `root_note`, `scale_name` (LIVE/lom/LOM-INVENTORY.md:236); "SET ScaleAndTuning" (LIVE/devices/arpeggiator-derivation.md:120). No shell carrier |
| Device chain / racks | All five, a format per mode (UI/inhabitants/sdk/modes.ts:303-316) | **F** | Only `chain-plate` renders; die, run-viewer, scene-strip and instrument-face are declared contracts (modes.ts:299-302). Live faces registered (UI/panels/index.ts:24-26) on a write route outside the writers law (L-4). QL faces all waiting (UI/inhabitants/quaternalLogicFamilyManifest.ts:39-74) |
| Sampling instruments | Live mode (port) | **F** | Simpler LOM surface (LIVE/lom/LOM-INVENTORY.md:170); Sampler in the browser (UI-EVIDENCE.md:53,56). Not ported |
| Macros / modulation | Factory, Expressions, Technē (QL) | **F**; the honesty law (CONT:52) | Expressions disclosure built; M2 sources `generates:false`; scope beyond QL addresses open (PLAN:3159-3162) |
| Mixer / sends / returns | Factory (Watch, Solo, Arm, budget; UI/agent/AgentSessionGrid.tsx:26-30); Live inert (UI/components/MixerStrip.tsx) | Authority routing, not signal routing (L-4) | Agent return tracks A·Review / B·Wiki designed (AGC:181-185); Expressions buses under #281 (MPW:162) |
| Warp engines | Live mode (port) | **F** | WarpMode enum, stretch and transposition measured (LIVE/reconstruction-backlog.md:65, D9). `--play` skips warped clips (OI/packages/live-shell/src/play.rs:12-14). Not ported |
| Clip view craft | Central, by the owner's analogy (PLAN:1316-1320); Technē editing is origin-return (CONT:82-84) | — | **Tension**, three senses of "editing" (L-6). Central clip craft built (UI/shell/ModeDetail.tsx:60-100); Technē editor core E01–E26 targets, 0 passed (PLAN:1685-1737) |
| Recording / takes | All five (GRAM:277,339,391,463,467) | **F**; takes are "never a clock and never a Timeline track" (UI/timeline/worldTrackAdapter.ts:33-34; UI/timeline/qlAudioTrackAdapter.ts:138) | Expressions takes and Factory voice built; Central dictate, Technē record-walk and Live record waiting |
| Comping / take lanes | Live mode (port); Expressions takes as seed (WSD:936-937) | **F** | `TakeLanes/` in the track model (LIVE/session-model.md:70). No comping anywhere |
| Groove | None | **P:** aperture readouts in the groove pool's place (UI/shell/ModeBrowser.tsx:121-140) | No groove function (PLAN:3120-3125) |
| Follow actions | Factory ("Then", hand-off); Technē per-edge transitions (PLAN:307,1706-1707) | **F** | Tooltip string only (UI/agent/agentFidelity.ts:103) |
| Note / audio editors | Expressions (MPW:162, "edit notes and gestures") | — | No piano roll; Live clip panel read-only (UI/components/DeviceChainPanel.tsx:17-42) |
| Controller / key / MIDI mapping | Live mode (port) | **F** | 140 controller remote-script directories, `MidiMap` (LIVE/lom/LOM-INVENTORY.md:16,304). Not ported; MIDI/MPE input has no destination (below) |
| Max for Live / plug-ins | All modes, through the SDK door | **F** (L-11, L-13) | Seventh-product test run twice (PLAN:324-328) |
| Link / share / export | All five (GRAM:194,264,326,378,450); aperture World/Local/Shared/Federated (GRAM:457) | **F** | Expressions export built (APPA:52-57); aperture and view-as fog mockup-only (PLAN:2420-2426) |
| Lessons / help | None adopted (PLAN:776-778); `data-i` tooltip law built (GRAM:501-504) | — | See L-8 |
| Audio + video track layers on one timeline | Expressions, owner-ruled (CONT:247-250) | **F** for audio only (the DaVinci pattern, WSD:917-918; MPW:10); the video layer rests on the ruling alone | **Named gap.** No design or code names a video track; track kinds enter as Timeline adapters (WSD:945-951) |

**No destination in any mode** (PLAN:297-309,420-422): mixer volume, pan, sends
and crossfader outside Factory; scene tempo and signature; locators; freeze and
flatten; the waveform/warp editor outside Live mode; MIDI/MPE input (the #281
Jankó packet); mode-wide undo. **Ruled destination, no home yet:** video track
layers (Expressions, L23).

### 2.3 Mode profiles

Lenses use their plain names under ruling D-F: project/graph, canvas, timeline,
journey, places, palace, "not to be called 'M' anything" (PROG:97-108;
PLAN:1619-1622). LOCK:415's "No rename is performed anywhere *by this
amendment*" is a sequence, not a contradiction; the code rename of the `m0m5`
tree is deferred to harmonisation (PROG:104-105). `ModeDetail` LENSES use plain
names (ModeDetail.tsx:318-327); GRAM still labels "M3′ Journey" and "M2′
Relation Field" (GRAM:415-416). The M/S/S′/M′ fourfold is a product-level
pairing, "not an assertion that the same-index S product exclusively implements
that surface" (LOCK:92-100).

**Live (base mode, owner-ruled)**
- The reverse-engineering basis (CONT:244-246); destination Expressions (L23).
- Centre: the audio cut over a read-only `.als` mirror (GRAM:19). Companion:
  Fizz (DOCK:63). Out: audition only (play.rs:1-4).
- **Inferred** from usage: Live-corpus M-labels ("M0", "M1", "the M3 POST") are
  gate and seam labels, not Bimba coordinates (APPA:218,222; PLAN:3136;
  LIVE/integration-map.md:278-279). No source states it.

**Central** (code title "Base · Central", a naming defect, §2.1)
- CONT:179: "the ground — the field where material lives, where a day
  composes". WSD §6: "one World context" (WSD:533-536). All modes return to it
  (CONT:184).
- Coordinates: S0 at M0 (LOCK:92). Technē's Project instrument is the deep aperture
  over Central's root World and its ProjectCentrals, "not a new Projects database"
  (LOCK:181-218).
- Rack: hygiene, impact, day-die, flow, nara-conversation, day-now
  (UI/inhabitants/worldShellFamilies.ts:40-91). Companion: Fizz (DOCK:64).
- Out: packets; wiki returns as "a staged wiki proposal" (PRAX:464-465), "never
  a direct edit" (APPB:394). To build: the Central vertical (PLAN:2949-2954).

**Factory**
- CONT:180: "agents under custody, runs commissioned and watched and received".
  "No bespoke Factory application is built" (WSD:561-562).
- Coordinates: S3 at M3 Mahāmāyā (LOCK:95), with no exclusive M3′ surface.
  Native ownership: "developmental Runs/Methods/artifacts/evidence/Recognition"
  (LOCK:604). Companion: Fizz (DOCK:65).
- In: commissions from a reading (designed, WSD:566-568). Out: Return through
  Factory receiving, which is red (PATH §3). "Feed Expressions" (CONT:180) is
  planned (APPB:254-259).

**Expressions**
- CONT:181: "the form — the sounding, the physical, the scene". The 3:3
  body (TDR:35).
- Chain: M4 Nara ↔ S4 Workcell ↔ S4′ Anima → M4′ (LOCK:96), Nara in the
  foreground of the 3:3 reading (LOCK:31). M4′ is "the general Expressions application body, with the
  operative M1–M2–M3 backend" (LOCK:388-397); D-G: "remains the M4 body"
  (PROG:110).
- Companion: Anima, with the tab "Nara · oracle" (DOCK:66), matching "Anima_i =
  M_i × S4′, situated expressive operator for the 3:3 / Expression reading"
  (LOCK:507-508). The panel passes the app an `epi-logos` lens when quaternal-logic
  is installed (UI/panels/expressions.tsx:118,173-174).
- In: Journey scenes, one scene identity, no shadow store (TDR:341,365). Out:
  takes, captures, exports. Later: Live, with audio and video track layers (L23).

**Technē**
- CONT:182,88-90: "the work of origin-return", the owner's correction of
  PRAX:306-310.
- Chain: M5 Epii ↔ S5 QL-MEF ↔ S5′ Aletheia → M5′ (LOCK:97). M5′ is "the SAME
  application in M5/M0 deep-working mode" (LOCK:399-401); the six lenses are
  narrower projections, and "M5′ is not reducible to a Palace screen"
  (LOCK:406-410). Palace is the objectified M5 pedagogy pole (LOCK:358).
- Centre: lens bar. Timeline and journey are `cut`; project/graph, canvas,
  places and palace are `waiting`, owners named (ModeDetail.tsx:321-327). The
  legacy cradle has landed models of all six (CRADLE/techne/m0m5/*; APPB:25-31).
  The atlas is ported and called only from a dev entry
  (UI/projections/atlas/dev/main.ts:11).
- Companion: Epii (DOCK:67). The dock names the Expressions companion by its
  S4′ operator (Anima) and the Technē companion by its M5 subsystem (Epii). The
  lock's "Technē_i := Aletheia_i" (LOCK:510-517) went with the four-and-two
  reading (owner, 19 Oct 2026), so the label stands (L21).
- Out: Palace Return as an attributable proposal to M0′, a lane-5 target
  (PLAN:1700-1720).

### 2.4 How modes bleed

- **The owner's account** (CONT:167): material becomes material in another mode.
  A Central reading becomes a Factory commission's source; a live cymatic sweep
  in Expressions becomes a Journey phrase; a Technē Palace composition becomes a
  return to Central's wiki as a proposal.
- **The carriers each example needs, Grounded:** commissions from a reading
  (WSD:566-568); Journey ↔ Expression Scenes (LOCK:465; TDR:341,365); Palace
  Return as proposal (APPB:72-76). **Inferred:** each crossing is an act that
  keeps the material's origin ref, origin-return run forward.
- **Built mechanisms:**
  - **The spine.** "No second selection or navigation model" (PLAN:2241-2286).
    `chooseMode` is one transition; it sets world and mode, keeps the context,
    and closes no surface (APP:257-264). Live and Expressions share the centre
    residence `world.expressions` (APP:261).
  - **The transport.** Continuity is in the slot places; meanings change
    (WSD:23-41).
  - **Selection.** `BRIDGE.transition` writes subject and occasion as "Refs and
    titles only — never content" (BRIDGE:74-96). The one-field identity law
    preserves subject_ref, revision, constellation, ActionRefs and AgentSession
    (TDR:77-96). In the cradle, `encounter()` is "the only transition" (ENC:61-89).
  - **The cut switch** crosses between Technē and Expressions (WSD:266-268).
- **The act's discipline:** "selection != disclosure; visible Action !=
  authorised invocation" (TDR:324-329). A crossing never sends, discloses or
  launches by itself (EXP/FACTORY-AGENCY.md:42,102).
- **Gaps:**
  - None of CONT:167's three crossings is wired (WSD:566-568; GRAM:395,467).
  - No trail stop is written (BRIDGE:48,74-96). `encounter()` is imported only
    by `desktop/cradle/tests/encounter-inhabitants.test.mjs`. The Trail tile
    shows only the current subject (DOCK:199-204; PLAN item 28).
  - Leaving Central drops the world context (APP:259), against the cradle law
    that the world holds "until the person leaves it" (STORE:54-56).
  - The one enacted drill-through (Expression → Technē → Central source) is in
    the legacy cradle (CradleFrame.tsx:1012-1026).
  - Implicit shifts: `openCenterPanel` forces factory or expressions
    (APP:327-338). No source states a trigger rule.
  - **Conflict, two trail shapes.** The store's `TrailStop {mode, surfaceRef,
    surfaceKind, label, position}` with `TRAIL_LIMIT = 24` (STORE:61,68) against the
    encounter's `{address, at}`, unbounded (ENC:61-63,85). The bridge carries
    the store shape (BRIDGE:7,48).

---

## §3 The kernel binding

### 3.1 The law the coordinates express

- **The matheme.** `0/1 = 4+2 = 5→0 = 0/1`, and `QL_POSITIONS == 6` (LAW:35-36).
  Explicate positions: 1 what, 2 how, 3 which, 4 why/where (the nesting
  threshold). Implicate: 0 from-where, 5 to-where. `5/0` is the Möbius twist
  (LAW:30,35).
- **Grammar** (LAW:25-31): hyphen a structural link; dot flowering, only after
  a 4; slash reflective identity; prime the Pratibimba.
- **Context frames.** `(0000) → (0/1) → (0/1/2) → (0/1/2/3) → (4.0-4.5) → (5/0)`.
  Only `(4.0–4.5)` has an internal rhythm (LAW:37-38).
- **Authority.** "The live Bimba map (Neo4j) is the authority; where a spec or
  table disagrees, the map wins" (LAW:19, D10). "The owner is not a source for
  anything these sources hold; derive it" (LAW:21).
- **Registry.** `M` plus 1,875 source coordinates and 21,083 relations. Built-in
  bindings are "structural indexes only", and lookup fails closed
  (QL/docs/KERNEL-RECURSIVE-M-REGISTRY.md:25-31,99-108).
- **What the kernel exposes.** Every symbol has an address and a source of
  record. Some addresses are thin: M5-0/2/3/4 carry placeholder descriptions
  over populated q-registers, and M4.5.0…5 are unnamed and carry only roles
  (live Bimba map (queried 12 Oct 2026); L-8).
  Personal bodies are protected: "Raw bodies… never cross the plugin boundary"
  (INTEGRATED-4-5-0:43).
- **Spelling breaches:** `M4-4-4-4` and `M4-4` in INTEGRATED-4-5-0:76-77 and
  M′-SYSTEM-SPEC, listed as superseded (LAW:75); the Map's unnamed `M4.5.0…5`,
  a dot after a 5, beside the populated `M4.5-0…5`. `#`-prefixed coordinates
  are legal legacy aliases (LAW:25). On the live map (queried 12 Oct 2026):
  - the superseded dash spellings `M4-0…M4-5` (LAW:75) still stand as six
    orphan duplicate nodes with no relations, already ledgered as
    `k2-grammar-nesting-threshold:#4`, state `proposed`
    (QL/fixtures/kernel/m-ledger-v1.json). Cite only the dotted nodes; the
    orphans' prose is not canon;
  - `M4.3-2.0…M4.3-2.2` put a dot after a 2. None of the ledger's 19
    nesting-threshold records covers them: an open map defect, sent to the QL
    owner (§5.3 item 25).

### 3.2 M0–M5 (Bimba, unprimed)

| Coord | Name | Map holds | Cite |
|---|---|---|---|
| M0 | Anuttara | absolute ground; M0-3 Archetypal Number Language; M0-5 Śiva-Śakti `(5/0)`; "The Ever-Present Origin" | BMAP/M0/M0-0/M0-0.md:14-24; M0-5.md:14-24; live Bimba map (queried 12 Oct 2026), M0 `c_1_primary_designation` |
| M1 | Paramaśiva | M1-3 Spanda (bi-phasal oscillator); M1-5 toroidal recognition (720°, 36×2 = 72 bridge) | BMAP/M1/M1-3/M1-3.md:14-24; M1-5.md:14-24 |
| M2 | Paraśakti | M2-1 MEF; M2-5 planetary harmonic integration, "M2 is the sky" | BMAP/M2/M2-1/M2-1.md:15-22; LAW:46 |
| M3 | Mahāmāyā | M3-2 64 codons; M3-5 "a geometric codon–hexagram clock, not an astrological or solar one" | BMAP/M3/M3-5/M3-5.md:14-24; LAW:47 |
| M4 | Nara | "Dialogical interface facilitating sacred conversation between universal archetypal patterns and particular manifestation"; designation "Oracle Interface Between Personal and Universal Domains" | BMAP/M4/AGENTS.md:4; live Bimba map (queried 12 Oct 2026), M4 `c_0_core_nature`, `c_1_primary_designation` |
| M5 | Epii | M5-1 the living argument; M5-5 "the logos cycle itself — not a process Epii performs but what Epii fundamentally is" | M5-1.md:14-18; M5-5.md:17 |

- 137 = 64+72+1 sits at M1/M2/M3, "NOT M0" (INTEGRATED-1-2-3:46-56).
- One substrate, K2 over Cl(4,2), is shared by personal and cosmic quaternions at
  different scales (M'-SYSTEM-SPEC.md:345-362).

### 3.3 M0′–M5′ — three registers (two Conflicts, both in the lane labels)

1. **The Seeds domain table** (M'-SYSTEM-SPEC.md:66-73): M0′ Bimba map field;
   M1′ relational movement; M2′ harmonic matrix; M3′ clock/cosmos ("DAY/NOW,
   solar/kairos clock"); M4′ Nara (journal, daily note, dream, oracle); M5′ Epii
   (pedagogy, archaeology, review, autoresearch).
2. **The L5 lock** (owner-ratified 2026-09-16; LOCK:181-384): M0′
   Project/Wiki/Graph, M1′ Canvas/Constellation, M2′ Relation Field/Timeline, M3′
   Journey/Scenes, M4′ Places/World, M5′ Palace, the "professional Technē
   projection" (LOCK:767). Amendment §11a makes M4′ and M5′ whole-application
   bodies (LOCK:388-418). **Withdrawn by the owner, 19 Oct 2026:** the lens
   numbering does not hold what the coordinate system says of those layers;
   the instruments keep their names (lock §0.1 item 3).
3. **The lane documents:** instruments as M5-0′…M5-5′, mapped by PROG:106-108.
   - **Conflict, lane labels against the live map.** PROG:106-108 maps "M5-2′
     timeline · M5-3′ journey · M5-4′ places". The live map holds M5-2′
     "Backend Studio", M5-3′ "Frontend Studio" and M5-4′ "Agentic Control
     Room", each an "M' rendered affordance exposing" its M5-x parent; M5′
     contains only those three, and there is no M5-0′, M5-1′ or M5-5′ (live
     Bimba map (queried 12 Oct 2026)). The map wins (LAW:19). The owner's
     plain-name ruling already detaches the instruments from M labels
     (PROG:97-101), so the lane labels are not map addresses.
   - **Conflict over M5-5′:** "M5-5' is the Logos Atelier"
     (NARA/test-site/docs/epii-system-site-framing.md:369-371, a site-framing
     document, not a kernel source) against palace (PROG:108). Neither side is
     a kernel source, and the live map holds no M5-5′ node. The live map names
     the Logos Atelier at unprimed M5-5 (M5-5 `q_5_mobius_writeback_reopens`),
     as the Seeds do, "logos atelier" (INTEGRATED-4-5-0:78,179); the Map puts
     etymological archaeology inside M5-5 (M5-5.md:18); the site framing says
     "Keep the Logos Cycle and Logos Atelier distinct" (:491).

The Seeds table names each M′ by its domain, and it is the reading that stands
(manual §25: M1-2-3′ sounds and keeps time, M4/5/0′ knows and acts). It does not
contradict the live map, whose M4′ and M5′ are bare prime nodes: a name
(`Nara'`, `Epii'`), structural metadata and an owner (`m_0_owned_by_coordinate`
M5-3), with no descriptive content (live Bimba map (queried 12 Oct 2026)). Further
grounded points:
- "Do the six deep instruments map to L5-0…5? No… All are L5-5 Technē acts"
  (LOCK:766). "No M6 or M7" (LOCK:51).
- The first traversal through the six instruments and back is "not a compulsory workflow"
  (LOCK:424,775).
- The Guardians (Anuttara/Central … Epii/QL-MEF, LOCK:489-497) are stewardship
  identities, "not renamed to Canvas/Timeline/etc." (LOCK:498).
- S3′ is named Chronos (LOCK:95). The shell's "chronos stratum"
  (quaternalLogicFamilyManifest.ts:89) is the QL time-source stratum, not S3′.

### 3.4 M4 Nara (M4.0–M4.5)

Headlines from the repo reflection, confirmed (live map, 12 Oct) by P0-BIMBA.

| Coord | Map headline (short) | Cite |
|---|---|---|
| M4.0 | 6-fold archetypal personality matrix through birthdate | BMAP/M4/M4.0/M4.0.md:14 |
| M4.1 | body as materia and animistic unity | M4.1.md:14-17 |
| M4.2 | 6-fold divinatory system; "Ethical divination respects free will" | M4.2.md:14-21 |
| M4.3 | mediator/process layer; two-stroke rule; M4.3-2 dialogical containers, "not oracles but transformation vessels" | M4.3.md:14,17-18; M4.3-2.md:14-18 |
| M4.4 | "Context ledger and lens shelf… records transformation without performing it"; lens 0 is the "Gebser Lens"; M4.4.4, the "Phenomenological Lens", "Reduction - excavating to constitutional origins" | M4.4.md:14; live Bimba map (queried 12 Oct 2026), M4.4.0 and M4.4.4 `c_0_essence`; M4.4.4.md:18 |
| M4.5 | "hosts epii consciousness in situ, running Logos Cycle over each Nara episode"; six children Curriculum Map, Core Epi-Logos Voice, Method Transparency Lab, Integration Lab, Pedagogy Lab, Logos Cycle Engine; M4.5-1 "pedagogical compassion" | M4.5.md:14; live Bimba map (queried 12 Oct 2026), M4.5-0…5; M4.5-1.md:17 |

- **One chain, three uses of "M4", always qualified:** M4 Nara (Map); M4′ the
  Expressions body (§11a); "the M4 body" (D-G). (A fourth, M4′ as the
  Places/World lens, is withdrawn.) The lock writes them as one chain, M4 Nara ↔ S4 Workcell ↔ S4′ Anima
  → M4′ (LOCK:96), with Nara foreground in 3:3 (LOCK:31); the live map holds M4
  `INVERTS_TO` M4′.
- **Open.** The Nara identity decisions D1 and D3–D6 are "draft-for-review;
  generated proposal, not adopted law"
  (QL/docs/NARA-IDENTITY-COMPOSITION-DECISIONS.md:3,93-98).

### 3.5 M5 Epii and the Logos cycle

- **Kernel role.** "Lensed-weighting as {lens} layer (Epii)"
  (SEEDS/epi-logos-kernel-spec.md:346), with "lens-weighting (Epii-layer
  modulation across 12 lenses)" (:199). The spec reads "build the LLM-Nara
  interface; build the EBM-Epii engine" (:499).
- **The cycle** (M5-5.md:20): `#5-5-0` a-logos, pre-verbal silence; `-1`
  pro-logos; `-2` dia-logos; `-3` logos; `-4` epi-logos, integral synthesis;
  `-5` an-a-logos, "proportional recognition completing the return". Each stage
  carries a Gebser structure and a MEF lens (M5-5-0…5.md:24). Transition is
  "not on fixed time intervals" (M5-5.md:19). M4.5 runs the cycle on every Nara
  episode (M4.5.md:14). M5-5's synthesis is the 5→0 write-back, through review
  and M5-0 into M0 (M5-5.md:38; live Bimba map (queried 12 Oct 2026), M5-5
  `RETURNS_TO` M5-0).
- **Stage 4.** Epi-logos is stage index 4 (Grounded). Calling stage 4 "the
  nesting threshold" is **Inferred**. **Tension:** two kernel senses of one name
  at different positions. The MEF register names the lens L5-5′ "Epi-Logos",
  "Word beyond words" (MEF-LENS-REGISTER.md:163); M5-5-4 is a Logos-cycle stage
  (BMAP/M5/M5-5/M5-5-4.md:14). They are different objects (§1.1), not sources
  in contradiction.
- **Built.** The `logos.return` faculty is S5′ Aletheia (epi_agent.rs:196). The
  code labels its T/C/T′/C′ envelope a "Logos cycle" (:908); its relation to the
  six Map stages is unstated.
- **The tick, three sides.** "One tick is the complete eight-element traversal…
  Twelve epogdoon-steps" (kernel-spec:28); "Twelve ticks complete the
  double-covered cycle" (:160); D5: "one tick = 360/12 = 30°" (LAW:62). Never
  paraphrase a tick as one thing.
- **Clocks are distinct.** "One instrument does not mean these clocks are
  identical" (MPW:134-136). The MEF lenses and the M3 clock lenses "never merge"
  (LAW:54).
- **Logos cycle ↔ modes: not stated by any source.** "Do not force it"
  (CONT:216). The lock's refusal to pair sixfolds by count is analogous
  (**Inferred**, LOCK:766). The cycle stays unbound to modes.

### 3.6 Binding table

Status: **built** (in code at HEAD); **waiting** (declared, owner named);
**law** (ruled, not landed). M4.x and M5-x rows: confirmed (live map, 12 Oct).

| Coordinate | What it grounds in the DLW | Status | Cite |
|---|---|---|---|
| M0 / M0′ | Central's ground; the origin returns reach | rack/browser rows built | LOCK:181-218; GRAM:20-21; ModeDetail.tsx:321-327 |
| M1 | sole oscillator (D13); instrument face; M1-phase stratum | faces waiting | MPW:32-34; quaternalLogicFamilyManifest.ts:39-74; PLAN:1895-1908 |
| M2 | modulation only (`ql:m2/audio-octet/0..7`, `nodal-quartet/0..3`, `generates:false`); tuning targets; M2-5 sky as chronos source | sources built; sky waiting | qlModulationSources.ts:31-54; manifest:89 |
| M3 | score material in tracks and clips; m3-clock | score material law (#281); m3-clock waiting | WSD:933; PLAN:2082-2085,1704-1713 |
| M4 / M4′ | Nara foreground in 3:3; Expressions body (§11a, D-G); nara-conversation face; Anima companion | face built (binding reading only); companion is a name and tabs | LOCK:31,96,388-418; ConversationNaraFace.tsx:1-40; DOCK:66 |
| M5 / M5′ | Technē as the whole deep mode; origin-return (5→0); Epii companion; the objectified pedagogy pole (the Palace, L8) | companion is a name and tabs; `logos.return` has no shell binding | LOCK:358,399-410; M5-5.md:38; DOCK:67; PLAN:1700-1720 |
| Technē / Expressions | the two operating modes; the cut switch | switch specified; crossing is a lane-5 target | PLAN:1646-1651; WSD:266-268 |

**Unbound** (no source binds these to a mode, device, projection or stratum):
the Logos cycle; `logos.return` in the shell; M4.1; M4.2 (the oracle exists only
as a tab label); M4.3 and M4.3-2; M4.4; M4.5 curriculum and pedagogy lab; M2-1
MEF lenses as devices; M3-5 clock lenses other than the zodiac; 137; any time
unit longer than the day (LAW:53; MEF-LENS-REGISTER.md:133-141).

### 3.7 Kernel rules for builders (carried in §6 COORDS)

- **Derive first.** Read the map, the lock and the rulings. Call a thing Open
  only after the sources are exhausted (LAW:21).
- **The map wins.** New ratios and tables enter only by re-authoring the map.
  Renderers hold no local codon, 72 or tarot tables (LAW:19,61-64;
  INTEGRATED-1-2-3:654-655).
- **Bind, never recompute.** "Without renderer-local recomputation or fabricated
  availability" (LOCK:722). One profile tick, no widget-local clock.
- **Keep primed and unprimed apart; qualify every M4.** Epii ≠ Palace ≠ Aletheia
  (LOCK:400-406,510-517).
- **Never pair sixfolds, or the Logos cycle and modes, by count**
  (LOCK:55-85,766).
- **A coordinate existing is not it being ready.** Missing legs degrade visibly
  (INTEGRATED-1-2-3:424-432).
- **Protected stays protected.** Lived pattern → canon only through propose →
  review → accept → apply, dry-run by default (INTEGRATED-4-5-0:639-660).

---

## §4 Open questions — the merged ledger

The rows merge the contemplation's C1–C9 (CONT:202-222) with the plan's §10
ledger of 42 items (PLAN:2999-3250). Rows marked *new* surfaced during alignment.

Verdicts: **SOURCE** (the sources or an owner ruling settle it); **PARTLY**;
**OWNER** (only the owner can settle it). Each row ends with what the build does.

| Id | Question | What the sources give | Verdict | Build |
|---|---|---|---|---|
| L1 *new* | The mode set; where the Live musical system lives | Owner ruling: Live (base) · Central · Factory · Expressions · Technē; Live the RE basis, ported not approximated; destination Expressions with audio and video track layers (CONT:232-252). Source tie for the music/audio half: MPW:10; WSD:917-918. The video layer rests on the ruling alone. APPA:217-224 and CONT:118 become a sequence (§2.1). D-G (Expressions inside the shell, PROG:110-112) and the 12 Oct ruling (Live mode's music system inside the Expressions mode) sit at different levels; both stand | **SOURCE** (owner ruling) | Five-mode grammar is law. Copy says "Live mode". Live stays distinct until T-LIVE-INTO-EXPRESSIONS (L23) |
| L2 *new* | Central: a mode, or the world context riding every mode | The ruling names Central a mode (CONT:251). The design implements it as a world context (GRAM:20-21; WSD:533-536). Code drops the world on leaving (APP:259) against STORE:54-56 | PARTLY (mode: SOURCE; leave act: OWNER) | GRAM:20-21's mapping stands. T-WORLDCTX states the leave act. Title "Central" (T-LABELS) |
| L3 | Epi-Logos: lens, mode or native game; lens carry-over (items 2, 3, 27) | Ruled: "a lens, not a mode (standing ruling D2/A5)" (CONT:252), as the cradle (MODE:135-139). The native game is the vision sense (CONT:14). WorldContext never takes `epi-logos` (APP:259); the Expressions app gets an `epi-logos` lens (expressions.tsx:118) | **SOURCE** (lens, not mode; item 2 answered as (a)) / OWNER (item 27) | No Epi-Logos rail entry |
| L4 | Units above the day (C1) | None in the system (L-1). The owner closes weeks, months, quarters and decks in Nara's practice. QL cycles are not DLW units | OWNER | The Day is the only unit that closes. Create no week or season object; bind no QL cycle |
| L5 *new* | Day hours, and who fires the close | Three sides (L-1). The mockup: closing is "the owner's act — never an agent's" (WS/world-shell-mockup-r1.html:798). The session floor tells agents to "close the day you were standing in" (FLOOR:297-298) | OWNER | 08:30/21:00 stay design text with a source tag. No shell device fires a close; closing stays `central.day.lifecycle` |
| L6 | Technē → Expressions: what a composed Expression is (C2) | Artifact: Expression/Scene under `oi.expression/v1` (APPA:104-147). Journey→Scenes the strongest formal bridge (LOCK:465), one application with two operating modes (LOCK:390-399), "one scene identity, no shadow store" (PLAN:1704-1713). "View → scene" waits (GRAM:467) | PARTLY | The crossing is a lane-5 target with exact return by ref equality. No pipeline or hierarchy |
| L7 | The DLW interface of the Nara encounter: rack, dock or day (C3) | The encounter is ruled by the owner's words (CONT:98). Sources (L-7): 3:3 foreground, the M4→M4′ chain, the Expressions companion, the Central rack face, the day flow | PARTLY (meaning SOURCE; interface OWNER) | One binding, no second conversation store, no verdict on synthesis, bodies handle-only. Draw no pause |
| L8 | A teaching surface, or teaching distributed (C4; item 29) | "The teaching is the encounter" (CONT:106). Three loci (L-8): in situ at M4.5, ambient at M5′, objectified in Palace (LOCK:358) | PARTLY | No teaching-surface ticket. Essay and epii families stay receiving-only (PLAN:3204-3206) |
| L9 | Retiring a mode, projection or the shell with record (C5) | Closure above the day exists in the owner's practice, outside the DLW. Retirement of a mode or the shell has no source. Precedents: LAW:70-77; SF:487; the legacy cradle retirement | OWNER | Retire nothing larger than a family. Record every supersession; delete nothing |
| L10 | Logos cycle ↔ modes (C6) | Not stated by any source; "Do not force it" (CONT:216) | OWNER if wanted | No mapping built or written |
| L11 | What "the performance" is (C7; items 30, 25) | Each mode's play slot names its own: Answer, Run, Play scenes, Walk, play the set (GRAM:205,275,337,389,461). Pole 1-2-3 "plays itself on the tick" (M'-ENGINE-FACES:94-100). The sounding claim waits for #281 (PLAN:1285-1295). The Palace returns; it is not performed | PARTLY / OWNER | Each slot keeps its meaning. No sounding claim |
| L12 | Origin-return as a working surface (C8; item 28) | The owner's correction (CONT:82-90), grounded in the kernel's return (L-6). Mechanics exist. Read with L7: one movement in Hesse (MECH:78) | PARTLY (meaning SOURCE; surface OWNER) | Build the provenance mechanics under plain names; T-TRAIL first. Name the act as the owner does in vision text; coin no UI label |
| L13 | How a non-owner enters and plays (C9; items 3, 21, 27) | Four cradle doorways (PLAN:2717-2753). Minimal O:I needs no QL (OI/docs/VISION.md:33-45,133-137). Hosted visitors "need no local agent or API key" (EXP/WIKI-CONSTELLATION-UX.md:19,79). The EF-movement ruling, quoted by the study, keeps "a permanent supported entry" (REL:152-154; its own source not traced). Visiting is contract-only (PLAN:3233) | OWNER | No onboarding surface |
| L14 | Mode-shift trigger and continuity (CONT §3.15; items 4, 28, 37) | Continuity answered; the crossings named (§2.4). Trigger rule, multi-select R1/R2 (PLAN:3088-3095), query grammar (PLAN:3168-3172) and the two trail shapes are open | PARTLY | Every shift goes through the one transition. No crossing sends, discloses or launches by itself |
| L15 | Which state vocabulary material carries (items 35, 38) | L-2. QL already produces some standings, e.g. "calculated-ephemeris-not-observed-sky" (quaternalLogicFamilyManifest.ts:40-45) | PARTLY / OWNER | Render only produced standings. Keep the vocabularies named and apart. Unknown shows as unknown |
| L16 *new* | Hesse's two schools vs the dual-reading pair | The pair stood as Technē 4:2 / Expression 3:3 (LOCK:3); its four-and-two half is withdrawn (owner, 19 Oct 2026). The school assignment is a reading (L-5) | OWNER (schools) | Build to the two modes, with no M′ numbers on Technē's instruments |
| L17 *new* | Does the plate sound; entity voices and D13; is the physics sim the M1 instrument device | Causal wording tension only (L-9). "M2 PCM owner" wording vs D13. No MPW role declared. CONT:124 vs WSD:922-924 on which body is the instrument | OWNER, with the QL owner (#281) | Keep the common-cause law. Add no generator. Label entity voices "retained-app voices, relation to M1 unruled". Send the wording repair to the QL owner |
| L18 | Live audio-chain family and Live's leftover meanings (items 16, 18–20, 22, 24–26) | Home ruled: Live mode, the RE basis (CONT:244-246). Faces sit on the Live-corpus "M3" `POST device-param` seam (main.rs:174-176), outside the writers law. The seam has no owner op | PARTLY (home SOURCE; seam owner OWNER) | Faces stay readings until the seam has an owner op. Port only measured dynamics (LIVE/reconstruction-backlog.md). Every device count says what it counts |
| L19 *new* | Technē instrument names | D-F plain names (PROG:97-108). LOCK:415 scoped "by this amendment". Code rename deferred (PROG:104-105). GRAM:415-416 still carries M′ labels | SOURCE | UI shows plain names; the M′ address is provenance only (T-LABELS) |
| L20 | The product's full name (item 1) | "DLW" is never expanded in CONT (CONT:1,14,196) | PARTLY / OWNER | Write "DLW". Do not expand it in UI |
| L21 *new* | Technē companion label: Epii or Aletheia | Settled: LOCK:510-517 "Technē_i := Aletheia_i" went with the four-and-two reading (owner, 19 Oct 2026), so DOCK:67 "Epii" (M5) stands; Anima is the S4′ operator (LOCK:507) | SETTLED | Keep the label |
| L22 *new* | Review at M5-4, or M5-4 as the six agents | Both. The live M5-4 holds the "S4/S5 review" role, the six agents as internal components, and the M5-4′ "Agentic Control Room" affordance (live Bimba map (queried 12 Oct 2026); L-4). INTEGRATED-4-5-0:79,153 and the reflection (BMAP/M5/M5-4/*) agree with it | **SOURCE** (map, LAW:19) | No DLW surface claims the M5-4 or M5-4′ address until a ticket binds it; the address is provenance only (PROG:97-101) |
| L23 *new* | When Live moves into Expressions; the audio+video track design | Direction ruled (CONT:247-250). No design or code names a video track. Track kinds enter as adapters (WSD:945-951; PLAN §5.2, §5.8) | OWNER (timing); design Open | T-LIVE-INTO-EXPRESSIONS waits on the owner. Nothing merges Live's rail entry meanwhile |

**Plan items the vision does not touch** (status only):

| Item | Status |
|---|---|
| 5–11 (autonomy ladder … Hold launch, PLAN:3096-3115) | OWNER, unchanged |
| 12 (installed-state rename) | owner nod; blocks retirement bookkeeping only |
| 13 (ctrl reinstall) | **SOURCE: done** (PATH §2, roster fix `efef5c3` installed). Closed in the 12 Oct plan revision (PLAN §10 item 13) |
| 14, 15, 17, 39, 40, 42 | Open, unchanged |
| 23 (QL procedural body generation) | PARTLY; #281 states it as law, not landed (MPW:118-122) |
| 31 (step-transition bound) | Open, source vs source |
| 33 (modulation scope) | PARTLY; #281 lists the intended sources (MPW:124-130) |
| 36 (`expressions-track-adapter` vs `expressions-tracks`) | A gap with an owner; send to the family owner as a repair |
| 41 (lane-3 kernel additions) | Open |

---

## §5 The plan delta

"Rewrite" here means the conductor edits the planning document. It is not
PATH's "rewrite or escalate" of a failed brief (PATH:174-176). Rows still open
in §4 are written in as recorded questions, never as resolutions; ruled rows are
written in as law.

### 5.1 DLW-PLAN

1. **Preface.** PLAN §0 points to DLW-VISION as the vision source. Extend the
   precedence line (PROG:14-15): the vision governs figure and framing; owner
   rulings and settled law (MAP:200-201) govern specification.
2. **§0 (PLAN:73-165).** Keep PLAN:75-79 word for word. Add the figure paragraph
   (§0 item 1), the five-mode ruling (§0 item 3), and the owner's measure,
   "the teaching is the encounter". Attribute "a philosophical project" to the
   owner's clarification of 11 Oct, as the study records it (GBG/README.md:23-24;
   PRAX:50-51).
3. **§2 relocation table (PLAN:272-331).** Add the F/P column, the seven missing
   families and the video row (§2.2), and the no-destination list. Split
   routing into signal and authority. Record the arm slot's two meanings as
   intended re-meaning.
4. **§4 head (PLAN:603-642).** Write the mode ruling as law (L1, L3) with the
   MPW:10 and WSD:917-918 tie for the music/audio half; the video layer rests
   on the ruling alone. Record L2 as partly settled. Note the cradle's four-mode
   strip and that Rev 3/4's four arrangements (PLAN:634-641) predate Live's
   restoration.
5. **§4.1 LIVE (PLAN:643-1307).** State Live as the reverse-engineering basis
   (CONT:244-246): the measured reference (§4.1.a) and the derivation corpus are
   the port's basis, ported not approximated. Add the sequence into Expressions
   (CONT:247-250; L23). Add the missing families (tunings and scale, automation
   and clip envelopes, warp engines, comping, controller mapping, samplers) with
   their LIVE cites. Carry L18's seam.
6. **§4.2 BASE · CENTRAL (PLAN:1308-1399).** Retitle "CENTRAL" and record GRAM:228
   as a naming defect. Record the ruling naming Central a mode over the world-
   context mechanism (L2). Keep the owner's clip-view words (PLAN:1316-1320)
   beside origin-return as the L-6 tension, unmerged.
7. **§4.3 FACTORY (PLAN:1400-1503).** Add CONT:167's first crossing, a reading
   becoming a commission's source (WSD:566-568), and "Feed Expressions"
   (CONT:180) as planned behind the red receiving gate.
8. **§4.4 Expressions (PLAN:1504-1616).** Add the destination of Live with audio
   and video track layers (L23), the medium pieces (L-9), L17, the three family
   counts, and "a lens is not a device" (DLW-PANES-ONTOLOGY.md:164-197). Add the
   chain M4 Nara ↔ S4 Workcell ↔ S4′ Anima → M4′ with Nara foreground
   (LOCK:31,96). Correct
   "on the unmerged lane" to "on main via #635" for transport, scenes and takes.
9. **§4.5 Technē (PLAN:1617-1740).** Record origin-return as the owner's
   correction of "world of knowing", with its kernel grounding (L-6). List the
   provenance mechanics as built or target. Add §11a's M5′ as the whole deep
   mode and Palace as the objectified M5 pedagogy pole (LOCK:358). The
   contemplation's "TECHNE-DUAL-READING.md" cite resolves to TDR; cite TDR with
   LOCK. Add the Epii/Aletheia tension (L21).
10. **§5.4 time spine (PLAN:1943-1999).** Fix the strata count (WSD:802-803). Add
    a units subsection: the Day is the only unit that closes; FieldDay is set by
    policy; WEEK and SEASON are open; the hours sit in a three-sided record. Name
    the FieldNow and FieldDay contracts (field-now.mjs:303-360) and the two NOWs
    apart. **Tension, reconcilable:** "every act… addressable in this time"
    (CONT:44) beside "Do not create a universal event ontology"
    (EXP/WORKCELL-NOW-TEMPORAL-FIELD.md:194-232); refs on the spine satisfy the
    first without the second.
11. **§5.6 standing (PLAN:2122-2158).** Name the vocabularies apart and place the
    contemplation's list beside them. Register the missing `hypothesis` in the
    Technē frame as a defect.
12. **§6.1 spine (PLAN:2241-2287).** Name the three spines apart: time,
    navigation (mode × world × epoch), encounter (`encounter()` + Trail). Name
    the three senses of "projection": the four projections, shared-field
    projection, glyph projection (WSD:299-310,237-239; CONT:120). Record mode ×
    world × epoch against arrangement × projection × device as open
    (WSD:223-226,326-345). Add a porous-modes paragraph from §2.4.
13. **§7 Epi-Logos (PLAN:2576-2805).** Add the owner's register (CONT:18), the
    four kernel senses, and the ruling "a lens, not a mode" (CONT:252) beside
    D2's earlier "a mode in the footer". Record the Expressions `epi-logos` lens
    as partial carry-over.
14. **§10 ledger.** Close item 2 by the ruling (answer (a)) and item 13. Add L1,
    L2, L5, L16, L17, L19, L21, L22 and L23. Cross-reference C1–C9. Mark items 1
    and 3 partly answered. The ledger is the one list of open questions.
15. **§11 laws (PLAN:3251-3343).** Add §6 of this document. Correct the stale
    seat lines: `agent/o-i-20261007-1639` is history (PATH §2).
16. **§8 matrices.** Propose to the owner a row that counts the leaving: work and
    people that left the workstation and held (REL:179-184). Proposed, not
    adopted.

### 5.2 Design documents and the widget guide

17. **WG §4.6 dock and §4.14 companion.** A companion never renders a verdict on
    synthesis. The companion body reads its bound presence, not only a name and
    a note (DOCK:62-68). "Nara · oracle" stays: grounded (M4's designation
    "Oracle Interface Between Personal and Universal Domains", live Bimba map
    (queried 12 Oct 2026); M4.2; LOCK:153).
18. **WG §4.3.** Mark the aperture slot as reusing the groove pool's place, with no
    groove function.
19. **WG §4.1.** The Central punch row carries the source tag for 08:30/21:00 and
    L5. The close control is drawn declared and never fired
    (UI/inhabitants/centralDayNowModel.ts:55-105).
20. **WG §4.12.** Add: "The Palace returns attributable proposals; it is not
    performed."
21. **WG §9.** Add six rules: a lens is not a device; every relocated Live control
    names its function or is labelled reuse of the slot's place; plain
    instrument names, the M′ address as provenance; no coined names; Live-corpus
    M-labels are not Bimba coordinates (Inferred, L-0); "base" names Live mode,
    while the stored book mode `base` serves both Live and Central (§2.1; the
    L21 tension recorded beside it).
22. **WSD.** Fix "Four strata" (WSD:802-803). Correct "Base · Central" at WSD:26,32
    to "Central". Point UXS §2.1 (UXS:139-150), the one place in the design that
    names the figure, to DLW-VISION.
23. **Re-pin stale documents before citing them:** integration-map Part II says
    the panels are "NOT registered", but they are (LIVE/integration-map.md:164-181);
    PANES-ONTOLOGY T9 (DLW-PANES-ONTOLOGY.md:461-462); PANES-PER-MODE GRAM line
    cites (DLW-PANES-PER-MODE.md:76-77); EXPRESSIONS-ENCOUNTER-SPINE lines 17 and
    74; SF:489-493 still says the hosted field is "planned"; APPA's unmerged-lane
    rows; MAP:130 has a duplicated row (de-duplicated in the seat, 12 Oct).

### 5.3 PATH phases and tickets

The phase chain 0→1→2→3→4→5 is unchanged (PATH §1). No ticket crosses a red gate.

**Ticket mechanics.** Each ticket below has a file in `WS/wayfinder/tickets/` and a PATH §5 entry (committed `f591929b2`, 12 Oct; P0-BIMBA's receipt is ticket P0-BIMBA-LIVE). The
conductor, who alone keeps PATH (PATH:3-5,14), writes each as
`WS/wayfinder/tickets/<ID>-<slug>.md` from `BRIEF-BUILDER.md`, adds it to
PATH §5 with its blocked-by, and dispatches reviewers from
`BRIEF-REVIEWER.md`. Both briefs embed §6 from wave 1.

24. **Phase 0, P0-V1** (conductor, docs only): land DLW-VISION and the §5.1
    rewrites.
25. **Phase 0, P0-BIMBA: done, 12 Oct 2026** (no ticket file; its re-runnable receipt is ticket P0-BIMBA-LIVE) (read only, through the owner's
    `bimba-graph` module). Confirmed: M4.0–M4.5, M4.3-2, M4.4.4, M4.5,
    M4.5-0…5, M4.5-1, M5-1, M5-4, M5-5 and M5-5-0…5. Divergences, the map
    winning (LAW:19):
    - M5-4 holds both the six agents and the S4/S5 review role; L22 closes as
      SOURCE (L-4);
    - the live M5-2′/M5-3′/M5-4′ are Backend Studio, Frontend Studio and
      Agentic Control Room, against PROG:106-108's lane labels; there is no
      M5-5′ node (§3.3);
    - M5-0/2/3/4 have placeholder descriptions over populated q-registers, not
      stubs; M4.5.0…5 are unnamed and carry roles (L-8);
    - orphan dash duplicates M4-0…M4-5 remain (ledgered,
      `k2-grammar-nesting-threshold:#4`, proposed); `M4.3-2.0…2.2` put a dot
      after a 2 with no ledger record. Send the second to the QL owner (§3.1);
    - M0 "The Ever-Present Origin", Nara's "compassionate sensitivity to
      origins", the Oracle Interface and the Gebser lens are on the live map;
      they are re-cited there (L-6, L-7).
26. **Phase 2 seams.**
    - **T-TRAIL.** `BRIDGE.transition` appends a trail stop on every transition,
      and `returnTo` appends rather than rewinds. The Trail tile lists the
      stops. The ticket names which trail shape it uses (STORE:61,68 or
      ENC:61-63,85) and stops with `OPEN` on retention (24 vs unbounded, item 28).
      Prerequisite for L12 and L14.
    - **T-WORLDCTX.** States the leave act and the initial world for the Central
      mode (L2). Until then GRAM:20-21's mapping stands.
27. **Phase 3 Central vertical: the T-NARA leg.** One real
    `oi.nara-dialogue-binding/v1`, shown three ways: the Central rack face; the
    Central day's conversation clip; the Expressions-mode Anima companion after
    a mode crossing (Central's own companion is Fizz, DOCK:64). Precondition: a
    current Nara identity and an open Expression (ConversationNaraFace.tsx:9-10).
    Acceptance: the same binding ref in all three; no transcript store and no
    verdict on synthesis; absence shows as a ghost mark. It chooses no primary
    presentation (L7), extends PLAN:2949-2954, and adds no new vertical.
28. **Phase 3, proposed to the owner: T-CROSS.** Technē journey → real Expression
    Scene refs → opened in Expressions → verso inspected → exact return by ref
    equality (PLAN:1704-1713; LOCK:268-296,465). Acceptance: one scene identity,
    no shadow store, the computer-use walk with receipts. Blocked by the journey
    owner (UI/shell/ModeCentre.tsx:216) and P0-R1. If declined, it stays a lane-5
    target.
29. **Phase 3 Factory vertical: unchanged** (PLAN:2942-2948). "Factory outputs…
    feed Expressions" (CONT:180) is planned, behind the red receiving gate.
30. **Phase 4.**
    - Lane-5 targets carry L-6's provenance mechanics under plain names.
    - **T-LABELS** (UI only): plain names in GRAM:415-416,445-446 with the M′
      address in a provenance field; the Central mode's title "Central", not
      "Base · Central" (GRAM:228; comment GRAM:31-32). Correct the GRAM:21
      comment ("Central is a world context, not a separate mode") to the
      ruling. Do not rename the stored book mode `base` without a migration: it
      serves both Live and Central (GRAM:19-20; UI/continuity/workspace.tsx:27).
      Update the mode-grammar tests in the same ticket.
31. **Phase 5, T-RETIRE-RECORD.** Turn LEGACY-CRADLE-RETIREMENT.md's shape into a
    template: what retires, what does not, the named day, the gates. It decides
    nothing about modes (L9).
32. **Deferred, owner-timed: T-LIVE-INTO-EXPRESSIONS** (short id T-LIVE-EXPR). Integrate Live into Expressions with
    audio and video track layers on one timeline (CONT:247-250), as Timeline
    track adapters (WSD:945-951; PLAN §5.8). Not claimable until the owner names
    the time and the Live port is measurable as a whole (L23). No PATH claim row until
    then; it is listed so that no other ticket does it by accident.
33. **Stop rule.** A builder who reaches any §4 row still PARTLY or OWNER returns
    `OPEN` with the row id (PATH:5).

---

## §6 Builder carry

Every brief built from `BRIEF-BUILDER.md` and `BRIEF-REVIEWER.md` embeds the
block below. A reviewer refutes a done-claim against it.

```text
DLW BUILDER CARRY (DLW-VISION.md §6, 12 Oct 2026)
WHAT    The DLW is the instrument of Epi-Logos: one environment where a world's
        material is gathered, worked back to its origin, met in dialogue,
        taught by being met, sounded, and closed with a record.
KEY     L-n = layer in §1.2; Ln = row in the §4 ledger; Cn = the
        contemplation's open item n (CONT:202-222).
FIGURE  The Glass Bead Game is the figure: a total environment for meaning.
        Live is the proof for a medium. The DLW is the instance, aimed at a
        world's contents and values. Its power is the integration, the
        porousness and the shared clock, not any one feature. Audit: no beauty
        beyond a landed owner, no device judging synthesis for the player, no
        analysis without the World's own voice. (§0.1)
GAME    Epi-Logos is the native game: the corpus made playable by anyone, the
        reflective turn (language working on language) as a whole environment.
        In the shell it is a lens, not a mode (owner-ruled). The day is the
        session in which the game is played. (§0.2)
MODES   Five, owner-ruled: Live (base) · Central · Factory · Expressions ·
        Technē. No Epi-Logos rail entry. Add, remove or merge no mode. Title
        the Central mode "Central". (§2.1, L1-L3)
LIVE    Live mode is the reverse-engineering basis: port Live's real dynamics
        from the measured corpus as one technology; never approximate. Its
        destination is Expressions with audio and video track layers on one
        timeline; distinct until the owner times T-LIVE-INTO-EXPRESSIONS.
        (L-0, L18, L23)
CROSS   The modes bleed, and that is the point: material becomes material in
        another mode. The owner's three crossings are the targets: a Central
        reading → a Factory commission's source; an Expressions cymatic sweep
        → a Journey phrase; a Technē Palace composition → a proposal back to
        Central's wiki. None is wired yet. One transition for every shift; a
        mode never closes surfaces; subject, trail and occasion travel. A
        crossing is an explicit act that keeps the origin ref. It never sends,
        discloses or launches by itself. (§2.4, L14)
NARA    The meditation that keeps symbols from becoming empty signs is M4 Nara:
        a dialogical encounter, not merely a pause and not only evidence law
        (that is its surface). The system meets the player and the player
        meets it; Nara midwifes recognition, it does not hand down answers.
        Nara is foreground in the 3:3 reading: M4 Nara ↔ S4 Workcell ↔ S4′
        Anima → M4′, the Expressions body. Nara's oracle speaks and the player
        listens. Separately, no device scores a scene or picks a reading for
        the player. One dialogue binding, no second conversation store, bodies
        handle-only behind consent. The DLW interface for Nara is the owner's
        (C3): build what is grounded, and draw the rest as waiting. (L-7, L7)
EPII    Teaching is the encounter: the system teaches by being met, and in
        teaching itself it performs its own name. It lives in three grounded
        places: in situ (M4.5 runs the Logos cycle over each Nara episode),
        ambient (M5′, a 3:3 depth), and objectified (Palace, the form of the M5
        pedagogy pole, "teachable"). Its voice is pedagogical compassion
        (M4.5-1), the same care as origin-return. No help or Lessons panel
        stands in for it. Record learning only when it is observed
        (learning_demonstrated stays false until then). A separate teaching
        surface is Open (C4). (L-8, L8)
ORIGIN  Technē's editing is origin-return: every lens, constellation, journey
        and palace traces material back toward its source, as care for where
        it came from (compassion, "loving sensitivity to origins"; the origin
        is ever-present, not a past point; M0 "The Ever-Present Origin").
        Kernel form: 5→0, an-a-logos completing the return, etymological
        archaeology deposited through review into M0 (M5-5). So: every derived
        thing names its source and can be walked back to it in one act; a
        return reaches the origin's owner as a proposal, never as a direct
        write. Ref + revision + exact return are the floor, not the feature.
        Give the act no coined UI label. (§0.4, L-6, L12)
HONESTY Every write is a native owner op; no writePath = a reading. A UI flag is
        not evidence. Placement never upgrades standing; no producer = unknown.
        Waiting names its owner. A refusal mutates nothing. Never edit the wiki.
MUSIC   M1 generates; M2 modulates only (generates: false). Sound and form
        derive from one state. No sounding claim before #281. (L-9, D13)
TIME    One clock per stratum; bind, never fork. No device fires a close.
        Tag 08:30/21:00 as design text; invent no week or season. (L-1, L5)
RECORD  Record through the native owner; no second store, no score store.
EXTEND  Extend at the SDK door, never by special-casing the core. Symbols enter
        only by re-authoring the Bimba map; no local tables. (L-11, L-13)
FIELD   Draw fog only where built; otherwise state the fog as waiting with its
        owner (PLAN:2420-2426). Returns attributed; no score or rank. (L-12)
ENDING  What you build ends by completion, not by timer, and leaves a record
        (snapshot, then reading; a refusal mutates nothing). An ending hands
        its work back as ground for the next. Supersede, never delete.
        Retiring a mode, projection or the shell is Open (L9): do not invent
        it. (L-14)
COORDS  Prefix M; dot only after a 4. Primed/unprimed apart; qualify every M4.
        Plain instrument names, M' as provenance. No Logos-cycle-to-mode map;
        no sixfold pairing by count. Never recompute QL. Cite the live map;
        never cite the orphan M4-0…M4-5 nodes. (§3.1, §3.7)
WORDS   Plain speech, no coined names. "Base" means Live mode. The shell id
        `base` is Central's; the stored book mode `base` serves both Live and
        Central, so never rename it without a migration. Keep apart: NOW
        (Central/FieldNow); family (6 products / 7 world-gate families / 22
        Expressions device sub-families); routing (signal/authority); state;
        projection (four/shared/glyph). (§1.2, §2.1)
STOP    Reaching a §4 row still PARTLY or OWNER: return OPEN with the row id.
```
