# PATH — the DLW build, live route

Every agent reads this, and `DLW-VISION.md` §0 and §6, before acting. The
conductor keeps PATH true; nobody else edits it. Builders never reconstruct
the plan from chat — if PATH and a ticket disagree, stop and return `OPEN`.

Updated: 2026-10-12, `claude-code:dlw-conductor` (Opus). Vision tickets
(DLW-VISION §5.3) added to §5, 12 Oct. Wave 0 recorded 12 Oct: R0 returned
**FAIL**; wave 0 stays open (§7, §9); carries in §10.

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
- **Native app**: none built from a commit. The one supported command
  (P0-R1, committed `bfca96176`, logs `dd0162a6d`), run from the seat root:
  `bash desktop/cradle/docs/world-shell/evidence/p0-r1/run-native-at-head.sh all`
  (`P0R1_STAMP=<stamp>` names the evidence run directory; `launch` re-launches
  a built candidate). Its only green run (`run-20261012T-r1b`, 14:37–15:00Z)
  built from `13aaf5360` **with the repairs uncommitted** (marker
  `source_dirty: true`); no build or launch from `bfca96176`/`dd0162a6d` or
  later exists yet. `~/Applications/O-I Shell Candidate.app` 0.1.2 (8 Oct)
  and `O-I.app` (legacy cradle, 7 Oct) are evidence of nothing on this lane.
- **Target pool**: `Work/O-I/target` was a self-referencing symlink (10 Oct 23:41 →
  12 Oct); the conductor replaced it with a real directory 12 Oct 16:13 (the
  link held no data). The seat's `target` link resolves again; the runner's
  explicit `--target-dir` is no longer needed.
- **Evidence logs**: repo `.gitignore` drops `*.log`; evidence commits need
  `git add -f` (`bfca96176` missed them; `dd0162a6d` fixed it).
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
  DLW-PLAN.md's 12 Oct rewrites are committed in `13aaf5360`. Tickets written
  before `13aaf5360` pin PLAN line cites to `0dfa7b5ea`; re-check a cite
  against the committed plan before relying on it.
- **Seat tree**: clean after `2c331a4e7` (P0-V2 item-23 re-pins committed, 12 Oct).

## 3. Hard gates

| Gate | State | Clears by | Blocks |
|---|---|---|---|
| R1 native run at HEAD | **red** (partly) — command committed; built and launched only from a dirty tree; no capture, no in-window run context or owner readback | conductor: P0-R1 remainder (§5) after P0-R5 (A) lands | all acceptance |
| Computer-use channel in the conductor session | **red — carried as the owner's named act** (12 Oct): turn on Computer Use for the conductor session in the Claude desktop app, or grant Screen Recording to the conductor's shell (`screencapture` was refused: "could not create image from display") | owner | every UI acceptance leg; P0-R1 acc. 2–4; R0 re-review |
| ctrl roster fix installed | **green** (verified above) | — | — |
| Factory receiving/advancement join | red | Factory owner | Phase 3 only |
| R2 installed-state rename (ledger item 12) | owner nod | owner | retirement bookkeeping only |
| §10 OPEN-QUESTIONs (46 open of 51 in the 12 Oct revision; 42 in the committed plan) | open | owner | any builder who hits one stops |
| Vision ledger rows still PARTLY/OWNER (DLW-VISION §4) — named for tickets: L2 leave act, L7 primary presentation, L9, L23 timing, T-CROSS proposal | open | owner | T-WORLDCTX build leg; T-CROSS; T-LIVE-INTO-EXPRESSIONS. T-NARA builds without choosing L7. Any builder reaching such a row returns `OPEN Ln` |

## 4. Open claims

| Ticket | Agent | Zone | Since |
|---|---|---|---|
| conductor | claude-code:dlw-conductor | `desktop/cradle/docs/world-shell/wayfinder/` | 2026-10-12 |
| P0-R5 | claude-code:dlw-conductor (scope owed) | `packages/live-shell/ui/src/` per the ticket | 2026-10-12 — **blocked**: builder stopped at the 12-file rule; no edits, no commit. Rescope recorded in the ticket's Resolution |

## 5. Next claimable

1. **P0-V2** — resolved 12 Oct (`2c331a4e7`; conductor cite fix after the
   Sonnet diagnostic).
2. **P0-R5 (A + B)** — run-context reading in the status region (≈4 files)
   and owner-refusal disclosure (≈3 files), with the grep guard and a new
   suite. Haiku. Blocked-by: none (acceptance blocked-by P0-R1 remainder +
   computer-use). (C), the 64-file error-string sweep, becomes a follow-up
   ticket (not yet filed).
3. **P0-R1 (remainder)** — rebuild and relaunch from a clean tree at a
   commit holding the repairs and P0-R5 (A); evidence copies of
   composition.json, catalogue.json and `ctrl --version`; quit exit code;
   window capture. Conductor. Blocked-by: P0-R5 (A) for a
   clean, disclosing build; the computer-use gate (owner act) for acc. 4.
4. **P0-BIMBA-LIVE** — read the live Bimba map read-only and keep a
   re-runnable receipt for every headline the vision binds. Conductor.
   Blocked-by: none (operational: oi-omarchy reachable).
5. **P0-R4** — owner bindings in the native run (roster, gateway, workcell
   reading, skillsets). Haiku. Blocked-by: P0-R1 (R1 gate still red — not
   claimable yet).

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
| 0 | P0-R1 (committed), P0-R5 (blocked, no code), P0-V2 item 23 (failed twice, uncommitted) (+ baseline tsc repair `24e7d8f7f`) | `24e7d8f7f`, `bfca96176`, `dd0162a6d`; record commit "DLW W0: record" | R0 **FAIL** (12 Oct): §7 stop rule unmet; P0-R1 acc. 1 (dirty-tree revision), 2, 3, 4 unmet; P0-R5 absent; R0 Q1 answered "yes, mistakable" | — (open) |

## 10. Carries

Registered from R0 (12 Oct) and the wave-0 converge returns. Each is owned
by the ticket named, or by the owner where marked.

1. **P0-R1** — rebuild and relaunch from a clean tree at the commit holding
   the repairs (`dd0162a6d` or later); record that commit as the source
   revision. Commit or revert the six P0-V2 docs first.
2. **P0-R5** — land (A) the run-context reading (native host at revision /
   fixture harness / development browser) in the status region in every
   mode and (B) the owner-refusal disclosure component with its grep guard;
   then observe in the native window. The development-browser path states
   "no revision" until the `/api/config` producer is traced.
3. **P0-R1 acc. 4** — capture the window with run context visible
   (computer-use, or Screen Recording for the conductor shell, then
   `P0R1_STAMP=<stamp> bash desktop/cradle/docs/world-shell/evidence/p0-r1/run-native-at-head.sh launch`
   and `screencapture`, labelled `screen-capture (no interaction)`).
4. **P0-R1 acc. 3** — copy composition.json, catalogue.json and the bundled
   `ctrl --version` into `evidence/p0-r1/`; show the
   compiled/selected/registered/excluded/failed readback (`live_shell_config`)
   in the window, with factory, workcell and ql each named as waiting.
   Excluded-by-footprint must read differently from absent-because-unbuilt.
5. **P0-R1** — capture the quit exit code through the real quit route
   (parent shell waits on the pid); exercise the full-suite backing, not
   only the footprint default 0/1/2.
6. **P0-R1 / Phase 5** — bring the runner's out-of-repo inputs (8 Oct
   package-command notices, Node archives, SDK inventory) in-repo or produce
   them; replace the `client_receipt` re-record with a check that can fail;
   launch against a fresh candidate profile, not 0-1-2's 8 Oct `owner_home`.
7. **T-LABELS** — carried from the window itself: the native app at HEAD
   shows "Base · Central" (`ui/src/inhabitants/sdk/modes.ts:159`,
   `ui/src/shell/modeGrammar.ts:228`); the ruling says "Central". Phase 4,
   unchanged; no R0 pass may treat that title as accepted.
8. ~~**P0-V2** — fix `integration-map.md:182`~~ done (`2c331a4e7`): (cite `:15` → `:44`), reviewer
   pass on the six-file diff, commit; list the re-pins in the Resolution.
   Future docs-builder tickets add an acceptance: every added `path:line` is
   re-opened (`sed -n '<line>p'`) before return; a cite-checker script goes
   in the conductor's kit.
9. **Follow-up ticket (to file)** — `packages/live-shell/ui/src/panels/devices-b2/README.md:40`
   says "(right-dock)"; the code registers `slot: 'bottom'`
   (`panels/devices-b2/index.tsx:42`).
10. **Finding (to file)** — `RightDock` is mounted nowhere, so non-device
    panels declaring `right-dock` (`inspector.tsx:16`, `clock.tsx:23`,
    `context.tsx:3`) have no host.
11. **Follow-up ticket (to file)** — P0-R5 (C): raw error strings in 64
    `role="alert"` files become disclosure components.
12. ~~Owner — repair the self-referencing `Work/O-I/target` symlink~~ done by
    the conductor 12 Oct (§2).
13. **Owner** — the computer-use gate (§3).
14. **Evidence hygiene** — `git add -f` for `*.log` evidence (§2).
