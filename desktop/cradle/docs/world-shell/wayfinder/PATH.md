# PATH — the DLW build, live route

Every agent reads this, and `DLW-VISION.md` §0 and §6, before acting. The
conductor keeps PATH true; nobody else edits it. Builders never reconstruct
the plan from chat — if PATH and a ticket disagree, stop and return `OPEN`.

Updated: 2026-10-12, `claude-code:dlw-conductor` (Opus). Vision tickets
(DLW-VISION §5.3) added to §5, 12 Oct.

## Roles (owner's model map, 12 Oct 2026)

| Role | Model | May | May not |
|---|---|---|---|
| Conductor | Opus, this session | claim/unclaim, dispatch, converge, build, typecheck, stage, commit, keep PATH/MAP/matrices, escalate to the owner, run computer-use acceptance | write product code (except one-file glue to unblock a return), invent spec, resolve §10 conflicts |
| Builder | Haiku, ≤3 at once | edit inside the claimed zone, run lane-local checks, return the receipt | stage, commit, leave the zone, answer an OPEN-QUESTION, call UI done from code |
| Reviewer | Sonnet, 1 at a time, at seams | read the wave diff and refute the done-claim | fix, re-scope, review single patches |

Brief templates: `BRIEF-BUILDER.md`, `BRIEF-REVIEWER.md`. Vision:
`DLW-VISION.md` (figure and framing; §6 is the builder carry every brief
embeds). Plan of record: `DLW-PLAN.md` (§9 order, §10 open questions, §11
laws). Standing map: `MAP.md`. Craft: `WIDGET-GUIDE.md` + `../icon-cut.html`.

## 1. Current phase

**0 — R1-boot.** Phase chain: 0 → 1 craft → 2 seams → 3 verticals →
4 targets (lane 3 → 2+4 → 1+5) → 5 retire. No fan-out across a red gate.

## 2. Ground as verified 12 Oct (conductor, executed checks)

- **Seat** `worktrees/env-1/o-i`, lane `dlw/build-20261012`, cut from
  `origin/main` `619a4548b`. The whole shell is on O-I `main` (#635, #637,
  `0dfa7b5ea` fold-in, the 11 Oct Live-mode device-face rounds).
  `agent/o-i-20261007-1639` and `m-prime-methodology` are history — DLW-PLAN's
  12 Oct revision marks them so (§1.1, §11); EXECUTION-* still name them; read those seat lines as stale.
- **Design pack home** is this directory (`desktop/cradle/docs/world-shell/`).
  The copy under `Work/reverse-engineering/2026-10-07-techne-instrument-re/`
  is the origin mirror; new writes land here. Historical tickets (K1, L1–L9,
  C1–C3, F1–F4, V1, CE1) stay there; new tickets live in `tickets/` here.
- **ctrl** installed `7a45111` (11 Oct 16:30) contains the roster fix
  `efef5c3` — the "ctrl binary reinstall" owner act is **done**.
- **Native app**: none at HEAD. `~/Applications/O-I Shell Candidate.app`
  is 0.1.2 from 8 Oct (pre agent-shell); `O-I.app` is the legacy cradle
  (7 Oct). Neither is evidence of anything on this lane.
- **Native host**: `desktop/cradle/src-tauri` feature `native_shell`
  (`src/native_shell.rs` includes `packages/live-shell/src/{api,runtime,
  inhabitants}.rs`); producer `packages/live-shell/build-native-candidate.py`
  → `package-payload.py`. Owner binaries resolve through the `OWNERS` table
  (`OI_CENTRAL_CTRL_BIN`, …).
- **Running services, not this lane's — never stop them**: Vite `:5176`,
  walk-bridge `:4179`. `:8788` is down. Private stacks use free ports
  (recipe: memory *private-native-stack*).
- **Disk** 55 GB free. One cargo build at a time on the shared target pool.
- **Computer use**: no desktop computer-use tool in the conductor session
  (checked 12 Oct). Subagents never have it.
- **The vision is now part of what every agent reads.** `DLW-VISION.md`
  compiles the owner's contemplation (`CONTEMPLATION-DLW-INSTRUMENT.md`) and
  his mode ruling of 12 Oct (CONT:232-252). It governs figure and framing and
  never overrides an owner ruling or settled law (DLW-VISION.md:14-17). Every
  agent reads §0 (the one page) and §6 (the builder carry); both briefs embed
  §6. The ruling is settled: five modes, **Live (base) · Central · Factory ·
  Expressions · Technē**. Epi-Logos is a lens, not a mode. Live is the
  reverse-engineering basis, ported, not approximated, and its destination is
  Expressions with audio and video track layers on one timeline. No agent
  presents the ruling as open. DLW-VISION.md, the vision tickets and both briefs are committed on the lane (`f591929b2`);
  P0-V1's remaining work is the plan. DLW-PLAN.md carries the 12 Oct rewrites uncommitted in the seat
  (+781/−76 against `f591929b2`, 12 Oct); tickets pin PLAN line cites to the committed plan
  (`0dfa7b5ea`, unchanged through `f591929b2`).

## 3. Hard gates

| Gate | State | Clears by | Blocks |
|---|---|---|---|
| R1 native run at HEAD | **red** | conductor, ticket P0-R1 | all acceptance |
| Computer-use channel in the conductor session | **red** | owner: turn on Computer Use for this session in the Claude desktop app | every UI acceptance leg; R0 review |
| ctrl roster fix installed | **green** (verified above) | — | — |
| Factory receiving/advancement join | red | Factory owner | Phase 3 only |
| R2 installed-state rename (ledger item 12) | owner nod | owner | retirement bookkeeping only |
| §10 OPEN-QUESTIONs (46 open of 51 in the 12 Oct revision; 42 in the committed plan) | open | owner | any builder who hits one stops |
| Vision ledger rows still PARTLY/OWNER (DLW-VISION §4) — named for tickets: L2 leave act, L7 primary presentation, L9, L23 timing, T-CROSS proposal | open | owner | T-WORLDCTX build leg; T-CROSS; T-LIVE-INTO-EXPRESSIONS. T-NARA builds without choosing L7. Any builder reaching such a row returns `OPEN Ln` |

## 4. Open claims

| Ticket | Agent | Zone | Since |
|---|---|---|---|
| conductor | claude-code:dlw-conductor | `desktop/cradle/docs/world-shell/wayfinder/` | 2026-10-12 |
| P0-R1 | claude-code:dlw-conductor | the ticket's zones (`src-tauri/` host glue, live-shell build scripts, `evidence/p0-r1/`) | 2026-10-12 |

## 5. Next claimable

1. **P0-R1** — native run path at HEAD. Conductor-led (judgment when the
   host fails; heavy serial build). Blocked-by: none. Claimed: the ticket names the conductor (12 Oct).
2. **P0-R5** — run-context disclosure + disclosure components. Haiku,
   UI-only zone; can build in parallel with R1's compile, accepts in the
   native app after R1. Blocked-by: none (acceptance blocked-by P0-R1).
3. **P0-R4** — owner bindings in the native run (roster, gateway, workcell
   reading, skillsets). Haiku once R1 boots. Blocked-by: P0-R1.
4. **P0-V2 (remaining: item 23 re-pins)** — dated re-pin notes or
   corrections in the six stale documents the ticket lists. Haiku, docs
   zone. Blocked-by: none (P0-V1 resolved 12 Oct). Items 17–22 are done.
5. **P0-BIMBA-LIVE** — read the live Bimba map read-only and keep a
   re-runnable receipt for every headline the vision binds. Conductor.
   Blocked-by: none (operational: oi-omarchy reachable).

### Queued by phase (vision tickets, DLW-VISION §5.3)

Phase order holds: no ticket below crosses a red gate. Files are in
`tickets/`.

- **Phase 0** — **P0-V1** resolved 12 Oct (vision + plan rewrites landed).
- **Phase 2** — **T-TRAIL** every transition leaves a trail stop; return
  appends. Blocked-by: Phase 1 gate; UI legs P0-R1 + computer-use. Stays
  `OPEN` on retention and placement (PLAN §10 item 28).
- **Phase 2** — **T-WORLDCTX** the Central mode's leave act and initial
  world. Blocked-by: owner ruling on L2's leave act (owner question first);
  Phase 1 gate for the build leg; UI legs P0-R1 + computer-use.
- **Phase 3** — **T-NARA** one Nara dialogue binding met three ways (Central
  vertical leg). Blocked-by: Phase 2 gate, T-TRAIL, P0-R1, P0-R4; needs a
  current Nara identity and an open Expression. Chooses no primary
  presentation (L7 stays the owner's).
- **Phase 3** — **T-CROSS** journey → scene → exact return by ref equality.
  *Proposed to the owner*; not claimable until he accepts (if he declines, it
  stays a lane-5 target). Also blocked by the journey owner, T-TRAIL, the
  Phase 2 gate and P0-R1.
- **Phase 3** — the Factory vertical is unchanged (PLAN Phase 3 item 1).
  "Feed Expressions" (CONT:180) is planned behind the red receiving gate. No
  new ticket.
- **Phase 4** — **T-LABELS** title "Central", plain instrument names, M′ as
  provenance; never rename the stored book mode `base` without a migration.
  Blocked-by: Phase 3 gate; UI legs P0-R1 + computer-use.
- **Phase 4** — lane-5 targets carry the provenance mechanics of
  origin-return (L-6) under plain names. This rides the target sets, not a
  ticket.
- **Phase 5** — **T-RETIRE-RECORD** retirement-with-record template from
  LEGACY-CRADLE-RETIREMENT's shape. Decides nothing about modes (L9).
  Blocked-by: Phase 4 gate.

**Deferred, owner-timed, not claimable (no claim row):**
**T-LIVE-INTO-EXPRESSIONS** (alias T-LIVE-EXPR), Live joined into
Expressions on one audio and video timeline. Blocked-by: the Live port
measured whole against the RE corpus; the owner naming the time (L23); a
video-track design; Phase 4 gates; P0-R1. Listed so no other ticket does it by
accident (DLW-VISION.md:1367-1368). Until then nothing merges Live's rail
entry.

**Stop rule for every vision ticket** (DLW-VISION.md:1369-1370): a builder
who reaches a §4 row still PARTLY or OWNER returns `OPEN` with the row id.

## 6. Foreign lanes — do not touch

- `worktrees/env-3/o-i` — `ui-coherence-track-20261005` / Central Field
  base, active today (`2f4ee7e93`, 10:14). Its files, its seat.
- `worktrees/env-1/ai-kit` — `feat/central-field-ai-kit`, claimed.
- #281 M′ physical music (`Work/Quaternal-Logic`) — the musical owner; the
  shell admits its landings, never builds them.
- Archetypal-Earth curation lane (`Work/Archetypal-Earth`) — L5 port is
  done; re-pin AE HEAD before any further port.
- env-1 owner-held Factory Expressions remainer lanes (register note).
- Whoever runs Vite 5176 / walk-bridge 4179.

## 7. Stop rule for wave 0

Do not close wave 0 until: P0-R1 and P0-R5 each have a builder or
conductor return in the template shape; commits exist (or a stated
no-commit reason); the native app at HEAD has been launched and its window
captured with the run context visible; the computer-use gate is either
green or carried as the owner's named act; Sonnet **R0** has returned
`PASS` or `PASS-WITH-CARRIES` with carries registered here; PATH updated.

## 8. Review cadence

R0 after wave 0 · R1 end of Phase 1 · R2 per seam batch · R3 before
verticals · R4a/R4b after each vertical · R5 per target-lane block ·
R6 before retirement. Exception: the same builder failure twice on one
acceptance bullet → a Sonnet diagnostic, then rewrite or escalate. Never a
third rewrite of an invent-the-spec problem.

## 9. Wave log

| Wave | Tickets | Commits | Review | Closed |
|---|---|---|---|---|
| 0 | P0-R1, P0-R5 (+ baseline tsc repair `24e7d8f7f`) | `24e7d8f7f` | R0 pending | — |
