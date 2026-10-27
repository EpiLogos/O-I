# T-AGENCY — the agent world and Technē's construction chain (19 Oct 2026; coordinates corrected 20 Oct)

From the session the owner commissioned on 19 Oct to settle ground truth and design the agency side in the manual. The owner
reviewed the manual the same evening; it landed as O-I `495c7f86c`. The ruling is written into the rows it changes, not over them
(`DEVICE-SEMANTICS-LOCK.md` §0.1 item 3 and §2.5, the plans, and QL-MEF's L5 lock and contract, §7), and MAP's build lane
(items 4–5), planning lane (item 3) and queue cite this route. PATH stays the lead's.

## 1. The owner's direction (19 Oct, verbatim)

- "consider the current m4 as kev m5 as llm m0 as graph knowledge system, ql based, split we're building for the agency side of
  our system"
- "the ta onta system becomes not just an sdk/apoi for agents in relation to expressions alone, but rather seems to be the full
  agentic sdk/api which ought become a fgull set of methodologies methods skills compose dinto skillsets"
- "get clean with the coordinate notation too my guy, M1-2-3', M4/5/0', nice and simple 3:3, we cna get more preciswe as we go"

Owner correction, 19 Oct (second round): the Technē reading that set M0′–M5′ as instruments (Project/Wiki/Graph, Canvas,
Timeline, Journey, World, Palace; QL-MEF `docs/L5-TECHNE-DUAL-READING-LOCK.md`, and `ANIMA-ALETHEIA-TEAMS.md` §10.2) is removed:
it does not hold what the coordinate system says of those layers. Live is M1′ and M2′ as one instrument. Additions are device UI,
in an existing device or as a device of their own, never prose that restates what the implementation already holds.

Owner ruling, 20 Oct (the coordinate recon): "M4 as Kev, M5 as LLM" was imprecise. M0′–M5′ are the app layers of the six M
subsystems, held by M5-3, which is O:I (the cradle and the DLW): Live holds M1′–M3′, Expressions is M4′ (of M4 Nara), Technē is
M5′ (of M5 Epii), and M0′ is the graph systems and the planetary continuity between local and collective. S is the six products
and S′ the six Ta-Onta organs, distinct from M/M′; M5-2 (the spine) and M5-4 (the agents' mediation) both link to them. The
models, language models and Kev, are AIKit (S2) capabilities; the six Epi-Logos agents at M5-4.0–M5-4.5 use them, the Nara and
Epii agents not exclusively. Factory reads the S coordinates in the (0/1/2/3) context frame. Applied to the Bimba map with
QL-MEF `migration/bimba-map/2026-10-20-s-sprime-current.cypher` (PR #339) and written into manual §25.

The 3:3 comes from the M′ seeds (Epi-Logos-C-Experiments `Idea/Bimba/Seeds/M/`):
- `M'-SYSTEM-SPEC.md` "Shell vs Subsystem Architecture": Shell 0 is the integrated M1′–M3′ cymatic harmonic clock (M1′ movement,
  M2′ harmonic and correspondence matrix, M3′ clock and cosmos); Shell 1 is the M4′/M5′/M0′ return (Nara, Epii, and the Bimba
  ground as the act needs it). The toggle keeps the coordinate, the tick and the profile; only the face changes.
- QL-MEF `skills/ql-law`: positions 1 what, 2 how, 3 which, 4 why/where (context), 0 from-where (ground), 5 to-where (synthesis);
  `5/0` is the Möbius twist in which synthesis settles into the next ground. M1 generates the sound; M2 is the synth and the sky.
- `INTEGRATED-4-5-0-RECOGNITION-ARCHITECTURE.md` §1–§2: M4 the lived field, M5 the review and return, M0 the canon graph that
  reviewed patterns write back into.
- `M4'/mental-pole-mechanics.md` set the 4′/5′/0′ triplet as LLM (Nara), EBM (Epii) and Verifier (Anuttara). The owner's split
  superseded the first two (19 Oct) with Kev and the LLM; on 20 Oct both moved to AIKit as capabilities the agents use, and the
  verifier's character stays with Quaternal Logic's rules: deterministic, raising a question at a gap instead of filling it.

The kernel's triads are `ConstellationGrain::ThreeFold123` and `ThreeFold450` (`crates/ql-core/src/structural.rs:448-466`), and
the team space has the same three participants at each cell: the engine (Quaternal Logic), the decision instrument (Kev, through
AIKit) and the face (the language model).

## 2. Ground truth (each row read on 19 Oct; channel in brackets)

| # | Fact | Evidence |
|---|---|---|
| 1 | Kev is live. Its route is managed-local at 127.0.0.1:8019: model `kev-latest` (jaredpalmer/kev-0.8b on Qwen3.5-0.8B base, temperature 2.35), 838 requests served, trained state 7,552 tokens, input ceiling 16,384. GLiNER2.5-Decide is installed beside it; no default is elected, and only QD5 evidence elects one. | `aikit decide status` [command]; `~/.workcell/decision-models/` [listing]; QL-MEF `QL-NATIVE-DECISION-AGENT-WAYFINDER.md` "Return and election" [code-reading] |
| 2 | Kev reads the situation, not the item. Its spreads are flat (clear readings about .2–.35, weak about .08), it answers about 10 questions per second, and it took 68 s under hook load. That is why decisions run in the background. | memory `kev-reads-context-not-the-item` (face-rig probe, 19 Oct); the wayfinder's "GLiNER and execution policy" [code-reading] |
| 3 | The decision law: seven deterministic steps run before any inference, and zero open heads means zero model calls. The contracts are `ql.agent-event/v1`, `agent-decision-frame/v1`, `agent-determination/v1` and `harmonic-event/v1`. The installed `ql` (36f9eb0) has `agent-event`. | the wayfinder's "Determination boundary and loop" [code-reading]; `ql agent-event` [command] |
| 4 | The team space landed on QL-MEF main as #333 (`61c0e16`, 19 Oct 20:28): `ql.vak-team-space/v1`, read with `ql context-frame team-space`. Its decision instruments are `ql.agent-decision-frame/v1` heads with legal labels, cardinality and an ambiguity policy (`preserve-candidates`, `abstain`, `single-if-supported`); `TeamSpace::admit_answer` refuses a model answer to gate 6, from an acting provider or a member, or with an illegal label. Manual §19.4, §19.14 and §19.15 already carry it (O-I `c27d40707`). | `git log` [command]; `crates/ql-mef/src/team_space.rs`, `schemas/ql-agent-contracts-v1.schema.json` [code-reading] |
| 5 | The Bimba map is live: 100.92.62.101:7474 answers, with 3,721 nodes. | Cypher `count(n)` over HTTP [probe] |
| 6 | AIKit's construction is real. The types are `Inquiry`, `AuthoredFrame`, `FrameRole`, `Participation`, `RelationInput`, `Construction` and `Change` (`crates/aikit-core/src/knowledge_construction.rs:30-233`). The verbs are `aikit knowledge wiki-construct`, `wiki-shape` and `wiki stage`. Stage falls back to `staging/<slug>` (`crates/aikit-cli/src/wiki.rs:1133`). The shape preflight asserts `automatic_agent_or_model_invocation: false` (`crates/aikit-core/tests/living_knowledge_acceptance.rs:260`). | [code-reading, command] |
| 7 | QL-MEF owns the geometry: `StructuralConstellation` (structural.rs:372), `ConstellationGrain` (:492), `QlShape` (shape.rs:21), `RelationFieldComposition` (carrier.rs:187) and `ShapeBinding` (carrier.rs:349). `ql techne reading` is installed. | [code-reading, command] |
| 8 | O:I reads the wiki itself. `readWikiRegister` (`desktop/cradle/src/techne/wikiExpression.ts:137`) lists the folder, reads `wiki.json` and parses it, and relations come from the kernel knowledge op. Neither AIKit's `KnowledgeApplication` nor `ql techne reading` is called. `techne/contract.ts` is a TypeScript mirror of QL's schemas. | [code-reading] |
| 9 | Members are truncated where the scene is projected. `wikiExpression.ts:344-418` sets SCENE_BUDGET 64 (63 constellations) and ENTITY_BUDGET 2048, and slices the members at :418. The candidate reaches this file through `wikiReadingProvider.ts`. The renderer window (`expression/engineProjection.ts:7-8`, 10 formations and 8 pins) keeps its hidden refs, which is right. | [code-reading; `candidate-reachable.mjs`] |
| 10 | Constellation authoring exists, but only in a detached window. `knowledge/WikiConstructionPanel.tsx` gathers passages, sets roles, shows open roles, saves through `aikit.constellation.apply` and opens the result live. The candidate reaches it only through `native/Detached.tsx` → `DetachedFrame` → `KnowledgeSurface` (`workspace/DetachedFrame.tsx:182`). The shell's Knowledge graph device drives the surface's handle but has no construction face. | [code-reading; `candidate-reachable.mjs`] |
| 11 | Ported but not hosted: `desktop/cradle/src/techne/m0m5/` (`canvas/store.ts`, `canvas/proposal.ts`, `canvas/agency.ts`, `project/projections.ts`) is NOT reachable from the candidate. The Canvas you see is the vendored Research Canvas over a read-only `ql.techne/v1` transport, whose mutations are refused by design (`expressions-app/vendor/research-canvas/packages/desktop-api/src/techneTransport.ts:485`). | [`candidate-reachable.mjs`; code-reading] |
| 12 | The inert-link reader (`techne/lenses.tsx:68`) is NOT reachable from the candidate. The candidate's Day and Flow links have opened in the shell since `d1a3e4bef`. Links in the Knowledge graph's reader are unverified on screen. | [`candidate-reachable.mjs`; git] |
| 13 | Ta-Onta is already the full agent world on paper. The full-field lock (owner-ratified 12 Sep, §0): "Its SDK/API, manual, agent definitions, Skills/Methods and surface contracts express one specification", over 36 positions SP00–SP55 across the six organs S0′–S5′. The manual had no mention of Ta-Onta before this change. QL-MEF `skills/` holds 39 skills and none carries a METHOD or METHODOLOGY form. AIKit's sets are `ql-native-agent` (7 members, 6 withheld here), `nara` (1) and `epi-logos-reader` (16); there is no Ta-Onta set. | QL-MEF `docs/integrations/epi-logos/TA-ONTA-FULL-FIELD-LOCK.md` [code-reading]; `aikit set list` / `set show` [command] |
| 14 | On arrival the O-I primary checkout stood 403 commits behind origin/main. It was fast-forwarded on 19 Oct, keeping its runtime files. | [command] |

## 3. Corrections to the pasted analysis (another tool, 19 Oct)

- "O:I's current path chiefly projects existing Wiki material into Expression." Not so: authoring exists (row 10). The gap is
  hosting it in the shell, not building it.
- "The Technē Reading lens disables anchor navigation" is true of a file the candidate never loads (row 12). The requirement
  (Wayfinder §34) stands, but the repair belongs in the candidate's own readers.
- "Adopt the TB0-1 contract mirror": the mirror is already ported (`techne/contract.ts`, `m0m5/`), and nothing hosts it (row 11).
  The work is choosing one owner of the Canvas model and hosting it, not porting again.
- Confirmed as stated: the projection truncation (row 9), the renderer window, AIKit's construction and staging (row 6), QL-MEF's
  geometry (row 7) and the direct register read (row 8).

## 4. The design (manual, O-I main, with the catalogue)

- §17.4 Canvas: a Form page. The board takes one of AIKit's sixteen forms round a centre card, the whole; a card goes on a role
  by Place, or by Suggest, which asks the Decision helper and shows its pick dashed until accepted; Layout Free · Radial · Form;
  Check, Fold and Declare through the owners. Catalogue: `techne__canvas.tsx` gains the Form page and three fixtures (the six M
  domains as a sixfold; three placed and one suggested; a conjugate with no direct, refused by Check).
- §19.4 Agent: one sentence: the helper stands on the team's chain as the Decision helper.
- §19.20 Decision helper (new device): the questions it may be asked (the team space's instruments with their labels), the spread
  of an answer, Provider, When, Deadline, admission per instrument, the counts, and the seven rules. Catalogue:
  `ai-kit__decision-helper.tsx` (new), pages Ask, Instruments and Provider; fixtures A gate reading, Abstained, Nothing open.
- §25 The agent world (new; corrected 20 Oct): the two faces (M1-2-3′ sounds and keeps time and Live holds all three; M4′
  Expressions, M5′ Technē, M0′ the ground of graphs and the planet, and the 5/0 return), the agents and the AIKit models they
  use, one act in order, the six powers and what each
  meets in each mode, carried practice, and agents in Live and Expressions. Two figures.
- The gallery takes `page` and `fixture` from an embed (`catalogue/main.tsx`, `docs/dlw/render.mjs`), so an entry opens its
  device on the page it describes.

## 5. Reconciliation — manual against code

| Manual | Owner op | Today | Gap | Done when |
|---|---|---|---|---|
| §17.4 Form page | AIKit `aikit.constellation.apply`, `wiki-shape validate / declare / compress`; QL-MEF Canvas/Constellation layout | WikiConstructionPanel, detached only (row 10); Research Canvas read-only (row 11) | No form on the shell's Canvas | Form, Centre, Layout, Place and Declare bind to the owners; a conjugate with no direct is refused by Check; the declared constellation is found by `aikit knowledge search` |
| §17.4 Suggest | `action/model/decide` over the open roles | Kev serving | No question built from a board | The open roles are the labels; the pick stands dashed with its confidence; Accept writes it and nothing else does |
| §19.20 Decision helper | `aikit decide status / invoke`; `ql.agent-decision-frame/v1`, `ql.agent-determination/v1`; `ql context-frame team-space` | Kev serving; team space landed (row 4); Ask row in §19.4 | No device; no binding | The spread, the engine's verdict and the counts come from the owners; zero heads make zero calls (by rule counts it); a late background answer is dropped; gate 6 is refused |
| Drawn vs belongs (K3) | Kernel Expression document | Members sliced at `wikiExpression.ts:418` | Semantic truncation | A 200-member constellation draws its window and says how many more; every member is selectable through search |
| §25.3 Six powers | Ta-Onta lock SP00–SP55 | Expression act ops only (`oi desktop expression`) | Powers outside Expressions are not one interface | Each power answers by the same name from CLI, agent and SDK (SP01 parity) or says it is missing |
| §25.4 Carried practice | AIKit praxis forms and sets | 39 QL skills, no forms, no Ta-Onta set | Methodology, six Methods and the set unwritten | `aikit set show ta-onta` lists the Methodology, six Methods and six child sets; `aikit method run` proves one Method end to end |
| §25.2 Ground | AIKit `KnowledgeApplication`, Bimba | O:I reads `wiki.json` directly (row 8) | Two read paths | O:I's reader, graph, search and agent context read through one knowledge route |
| Team space (§19.4) | QL-MEF `team_space.rs` | Landed (#333); installed `ql` not yet rebuilt | Install | `ql context-frame team-space` answers from the installed binary |

## 6. Route (proposed; ordered by walks)

1. **K1 — one read path.** Move O:I's wiki reads onto AIKit's knowledge route, so reader, graph, search and agent context share
   one resolver. If the direct read must stay for speed, measure the route first and record why.
2. **K2 — the Form page bound.** Bind the Canvas's Form page (manual §17.4) to the owners WikiConstructionPanel already uses:
   `aikit.constellation.apply` to declare, `wiki-shape validate` to check, `compress` to fold. Retire the detached-only path once
   the page does what the panel does.
3. **K3 — the whole stays whole.** Remove the slicing at the projection (`wikiExpression.ts:402-418`). Keep the renderer window,
   and add Draw with "N more".
4. **K4 — canonical shape.** Take roles, places and fold from QL-MEF and AIKit (`wiki-shape`, `ql techne reading`). Decide which
   one Canvas model the shell hosts: the vendored Research Canvas or `m0m5/canvas`. Retire the other.
5. **K5 — the Decision helper.** Bind `ai-kit:decision-helper` to `aikit decide` and the team space: questions built from QL
   owners' legal labels, background by default, the Ask row in the thread, and Suggest on the Canvas's Form page.
6. **K6 — the voice acts.** Find passages, Quote, Propose relations and Explain, as agent acts over the selected basis, each
   returning proposal cards that cite passages. Where they surface is a device question, put to the owner before any prose.
7. **K7 — Ta-Onta as practice.** One METHODOLOGY and six METHODs (Enter, Form, Find, Time, Compose, Return) written over the
   existing `skill/ql/*` and native commands; the `ta-onta` set with six child sets; the team space landed and installed; a parity
   check across CLI, agent and SDK.
8. **K8 — the walk.** The Technē Wayfinder's C1–C12 matrix (`.wayfinder/maps/techne-expression-mode.md` §40–§41). The first
   connected walk runs: an ordinary linked note → a passage → a constellation → live → save → read back → search. It must include
   a broken link, one source used twice, more than ten members, a role reused in another constellation, a shape-first draft, a
   stale revision and a restart. Negative tests: cut the relation-to-engine binding and the selection test fails; cut save and the
   read-back test fails.
9. **K9 — the M′ numbers out of the shell's code.** Technē's instruments are named by their work. Comments in
   `packages/live-shell/ui/src` still number them (`inhabitants/ql/devices/ProjectPlate.tsx`, `TechneDevices.tsx`,
   `techneCompacts.tsx`, `standingInstrument.ts`; `projections/atlas/palaces/PalacePlate.tsx`, `places/PlacesPlate.tsx`,
   `placeTool.ts`, `placesModel.ts`, `placesPlate.css`; `projections/stageInstruments/*`; `shell/modeSurface.css`), and two
   strings a person reads do: `inhabitants/capabilityHomes.ts:47-48` ("Technē M4′ bodies + Graph") and
   `projections/atlas/palaces/palaceSession.ts:621` ("the M0′ ground"). The legacy cradle keeps its copy of the old contract
   (`desktop/cradle/src/techne/contract.ts` `m_prime`, `mPrimeOf`; `instruments.ts` `mPrime`; `m0m5/palace/regions.ts`
   `m_prime`); QL no longer sends the field (QL-MEF `3c08974`), so it is dead there. QL's own TypeScript copy
   (`adapters/techne/surfaces/cradle`) keeps the same coordinate role names, and the two copies are renamed together.

K1, K3 and K5 are foundations (MAP build lane item 4). K4 and K2 are the construction chain (item 5). K6 waits on the planning
lane's answer to where the acts stand (item 3). K7 runs in QL-MEF and AIKit beside them. K8 closes it. K9 waits on nothing.

Blocked-by, per item: K2 on K4 (the Form page binds to the one Canvas model); K5 on a `ql` built with `context-frame team-space`
installed; K6 on the planning lane's device answer; K8 on K1–K5.

## 7. Open for the owner

- Retired in QL-MEF `69c0d82` (19 Oct, on the owner's word): the team space's Technē association, `ANIMA-ALETHEIA-TEAMS.md` §10.2's
  sentence and the code it described (`team_space.rs`: `M_PRIME_INSTRUMENTS`, each depth's `m_prime` and `techne`); the 17 team
  space tests pass. Retired in QL-MEF `3c08974`/`6d03a44` (PR #338, 20 Oct): the four-and-two reading at its source — the L5
  lock rewritten without the numbering (§0 records the withdrawal), `ql.techne/v1` without `m_prime`, the Technē_i role no
  longer bound to its coordinate's instrument, `ANIMA-ALETHEIA-TEAMS.md` §6 item 2, the execution maps, the K-AW alignment, the
  Vāk execution lock and the `aletheia-m-prime-gate` skill. The reading kind keeps its wire names (`4:2-deep`, `3:3-conjugate`)
  because the cradle validates them. Issues #212–#220 still carry M′ numbers in their titles.
- Answered 20 Oct: §11a holds. M4′ is Expressions and M5′ is Technē; Kev and the language models are AIKit (S2) capabilities the
  M5-4 agents use (see §1).
- The plain descriptions of the forms in §17.4 and of the six powers in §25.3 are readings of QL-MEF's law. QL governs; correct
  them where they miss.
- Where Ta-Onta's Methodology and six Methods live: QL-MEF `skills/` (beside the 39 domain skills) or Central's skills. This ticket
  assumes QL-MEF, because the lock is QL's.

## State of record (moved from PATH sec 7, 22 Oct 2026)

Moved verbatim from the retired `PATH.md` (history: PATH.md at `41557a9ed`). Hashes, run labels (r1, r23 ...) and cross-references inside are as PATH wrote them; "PATH sec N" and "FOUNDATION sec N" in this text name the retired files, whose content is now in `MAP.md` (State of the streams, The foundation's route), `EXECUTE.md` and the tickets.

### Row (PATH sec 7 table): K5, the Decision helper

| Ticket | Who | Zone | Since |
|---|---|---|---|
| K5 — the Decision helper on its owners (T-AGENCY K5; manual §19.20) | **code landed** `c43d143da`. Kernel ops `decision_status` (`aikit --json decide status`, asks no model) and `team_space` (`oi ql context-frame team-space --json`); `ai-kit:decision-helper` admitted as AIKit's face and drawn on them (`agent/devices/decisionHelperBinding.ts`): Provider, the model, where it runs, loaded or not, independence, no price; the team space's instruments with their labels, the collaboration gate the person's. It stands on a group's chain after the Agentset rack and is read only while it stands there. Unread and left unknown: the last question and answer, today's log and counts, When and Deadline, each instrument's measured admission; every write disabled with the op it lacks (the provider election, a team's When and Deadline, Probe, an instrument's request). QL installed at `74e9c8e` so `ql context-frame team-space` answers. Owes: the ops those writes lack; Ask and Suggest; the native screen pass (a group's chain needs an agent session on this machine) | `agent/devices/decisionHelper*.ts`, kernel `team_space.rs`, `agency.rs` `decision_status` | 20 Oct |
