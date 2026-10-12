# PATH — the DLW build, live route

Every agent reads this, and `DLW-VISION.md` §0 and §6, before acting. The
conductor keeps PATH true; nobody else edits it. Builders never reconstruct
the plan from chat — if PATH and a ticket disagree, stop and return `OPEN`.

Updated: 2026-10-12, `claude-code:dlw-conductor` (Opus). Vision tickets
(DLW-VISION §5.3) added to §5, 12 Oct. Wave 0 recorded 12 Oct: R0 returned
**FAIL**; wave 0 stays open (§7, §9); carries in §10. Wave W0b recorded
12 Oct: P0-R5, P0-R1 (r1d) and P0-BIMBA-LIVE committed; no review run on
W0b, so W0b and wave 0 stay open (§9). Wave W0c recorded 12 Oct: P0-R4
code legs committed (`7b59fecad`); P0-R6 blocked (zone-escape: the host does
not disclose the product universe); P0-R5b blocked-by P0-R6; no review run,
so W0c stays open (§9); carries 24–35 in §10. Wave W0d recorded 12 Oct:
P0-R6-host (`2ac3c157f`), P0-R6-ui (`c4761bfd0`), P0-R5b (`e736ce78c`) and
the P0-R4 honesty nit (`4a5887376`) committed; every UI leg UNVERIFIED
(computer-use) and no rebuild from these commits yet; no review run, so W0d
stays open (§9); carries 36–47 in §10.

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
- **Native app**: built from a commit (W0b). The one supported command
  (P0-R1, runner repaired and committed `b50b970c3`), run from the seat root:
  `bash desktop/cradle/docs/world-shell/evidence/p0-r1/run-native-at-head.sh all`
  (`P0R1_STAMP=<stamp>` names the evidence run directory; `launch`
  re-launches a built candidate; `readback` copies composition, catalogue,
  `ctrl --version` and the AX run-context line; `quit` quits through the app
  menu and records the exit code). The runner refuses a dirty tree.
  Acceptance run: `run-20261012T-r1d` (15:55–16:06Z, evidence `e411dc7d7`),
  built from the clean tree at `b50b970c3` with the committed runner; host
  markers read `source_revision b50b970c3b92…`, `source_dirty: false`;
  the window's AX tree reads "Native host · revision b50b970c3b92"
  (channel `scripted`, not pixels); quit exit code 0. `run-20261012T-r1c`
  (from `f5adaa2ab`, uncommitted scratch runner) is kept as the builder's
  prior run; `r1b` (dirty tree) is history. `~/Applications/O-I Shell
  Candidate.app` 0.1.2 (8 Oct) and `O-I.app` (legacy cradle, 7 Oct) are
  evidence of nothing on this lane.
- **Run-context reading** (P0-R5 (A), `f5adaa2ab`): `StatusBar.tsx` mounts
  one reading from `runContextOf`/`carrierOf` (`ui/src/shell/runContext.tsx`);
  owner refusals in `NativeMaterialBrowser.tsx` and `ProductPreferences.tsx`
  render through `OwnerRefusal.tsx`, guarded by
  `tests/run-context-refusal-guard.test.mjs`. Lane suites 143/143, tsc 0.
- **Bimba map receipt** (P0-BIMBA-LIVE, `dcfb3731c`):
  `evidence/p0-bimba-live/read.py` re-runs read-only (`python3 -I`); 12 Oct
  16:10:53Z read: 3713 nodes / 13880 relations, `graph_revision 12`, 45/45
  headlines confirmed, digest `1a4b75ce…6b6c`. A later digest that differs
  is read row by row.
- **Target pool**: `Work/O-I/target` was a self-referencing symlink (10 Oct 23:41 →
  12 Oct); the conductor replaced it with a real directory 12 Oct 16:13 (the
  link held no data). The seat's `target` link resolves again; the runner's
  explicit `--target-dir` is no longer needed. The re-made pool had no
  `CACHEDIR.TAG`, so `cargo clean` refused it; the W0b runner wrote cargo's
  own tag into the pool root. Builds: `Work/O-I/target/p0-r1/20261012T-r1{c,d}`.
- **Out-of-repo side effects of every P0-R1 run**: the app's `prepare()`
  rewrites `~/.config/oi-shell-candidate/0-1-2/{composition,catalogue}.json`
  and one hosted registration (§10 item 6).
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
- **Seat tree**: clean after `4a5887376` (W0d converge, 12 Oct); pushed,
  `origin/dlw/build-20261012` = `4a5887376` before the W0d record commit.
  Conductor re-run at `4a5887376`: lane suites 169/169 (includes agent
  suites 89 and `owner-readback` 10), tsc 0. Host: `cargo test --features
  native_shell` 34 passed / 3 ignored (P0-R6-host converge, `2ac3c157f`).
- **`live_shell_config` now names the product universe in code**
  (`2ac3c157f`): `suite_product_ids` (`native_shell.rs:73` reader, `:223`
  call in `prepare()`, `:474` published) is the union of the footprint's
  `backing.options[*].products` in `OWNERS` order — central, actuation,
  ai-kit, software-factory, workcell, quaternal-logic. The host refuses to
  start when the selected backing names a product outside it. **Not yet
  observed in a running window**: no rebuild from `2ac3c157f` or later has
  run (§10 item 36). The UI readback (`c4761bfd0`,
  `ui/src/shell/ownerReadback.tsx`) reads admitted = `product_ids`,
  excluded-by-footprint = universe minus `product_ids`, failed = a
  contribution with `registration: "failed"`, absent = outside the
  universe, and "No host readback" when the field is missing.

## 3. Hard gates

| Gate | State | Clears by | Blocks |
|---|---|---|---|
| R1 native run at HEAD | **red** (partly) — built and launched from the clean commit `b50b970c3` (r1d, W0b); run context seen through scripted AX only; no pixel capture; no in-window owner readback (compiled/selected/registered/excluded/failed, waiting owners) | conductor: P0-R1 acc. 2 pixels + acc. 4 capture (needs the computer-use gate); acc. 3 in-window readback (code landed W0d, P0-R6 `2ac3c157f` + `c4761bfd0`; needs a runner rebuild and an observation, §10 item 36) | all acceptance |
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

## 5. Next claimable

1. **P0-V2** — resolved 12 Oct (`2c331a4e7`; conductor cite fix after the
   Sonnet diagnostic).
2. **P0-R5 (A + B)** — committed W0b (`f5adaa2ab`). Native-window legs
   UNVERIFIED (computer-use). (C), the 64-file error-string sweep, is a
   follow-up ticket (not yet filed; §10 item 11).
3. **P0-BIMBA-LIVE** — resolved W0b (`dcfb3731c`; 45/45 confirmed; the
   M4.3-2.0…2.2 defect sent to the QL owner as a NOW return).
4. **P0-R1 (remainder)** — the clean-commit build is done (r1d,
   `e411dc7d7`). What is left: acc. 2 in pixels and acc. 4 window capture
   (conductor; **blocked by the computer-use gate**, owner act, §3); acc. 3
   in-window owner readback (needs a UI ticket under
   `packages/live-shell/ui/src`, not yet filed, §10 item 4); full-suite
   backing and a fresh candidate profile (§10 items 5–6). **Nothing in
   P0-R1 is claimable now** without the owner act or the new ticket.
5. **P0-R4** — code legs committed W0c (`7b59fecad`); honesty nit
   committed W0d (`4a5887376`, §10 item 27 done). What is left: the
   native-window walk (Blocked-by P0-R1 and the computer-use gate); the
   owner-side ops (§10 items 29–30). Ticket stays open; nothing in it is
   claimable by a builder.
6. **P0-R6** — committed W0d: host field `2ac3c157f`, UI readback
   `c4761bfd0`. Code legs done; acceptance 5 (pixels, both viewports) and
   the in-window observation wait on a rebuild (§10 item 36) and the
   computer-use gate. Not claimable; ticket open for its UI legs only.
7. **P0-R5b** — committed W0d (`e736ce78c`): (a), (b), (d), (18) with tests.
   UI legs wait on the computer-use gate (§10 item 40). Not claimable.
8. **Claimable now (conductor):** the P0-R1 runner rebuild from the clean
   tree at the W0d record commit, then `readback` (scripted AX) for the
   run context, `suite_product_ids` and the owner readback text (§10 item
   36; P0-R1 evidence zone; one cargo build at a time); file the follow-up
   tickets named in §10 (items 9, 10, 11, 15, 19, 29, 30, 41); the P0-R1
   runner fixes in §10 item 15 (P0-R1 evidence zone, ahead of the rebuild,
   since the first readback missed the AX tree in r1d).
9. **Claimable as a one-file builder ticket once filed:** the
   `owner-receipt` style rule (§10 item 41) in
   `packages/live-shell/ui/src/` (reuse RefusalCard's folded-receipt class
   or add one rule). No other product-code ticket is claimable: each waits
   on the R1 gate, a phase gate, the computer-use gate, or the owner.

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
| W0b | P0-R5 (A+B) committed; P0-R1 committed (r1d clean-commit build; acc. 2 pixels, 3 in-window, 4 capture unmet); P0-BIMBA-LIVE committed (45/45 confirmed) | `f5adaa2ab` (P0-R5), `b50b970c3` + `e411dc7d7` (P0-R1 runner + r1c/r1d evidence), `dcfb3731c` (P0-BIMBA-LIVE); record commit "DLW W0b: record — PATH and ticket resolutions" | none run (no W0b review verdict); R0 re-review still owed for wave 0 (§7) and needs the computer-use gate | — (open: no review verdict; P0-R1 acceptance incomplete) |
| W0c | P0-R4 committed (code legs only; native walk and owner ops unmet); P0-R6 blocked (zone-escape: host product universe, no code); P0-R5b blocked (blocked-by P0-R6, no code) | `7b59fecad` (P0-R4); record commit "DLW W0c: record — PATH and ticket resolutions" | none run (no W0c review verdict) | — (open: two tickets blocked; no review verdict) |
| W0d | P0-R6-host committed; P0-R6-ui committed; P0-R5b committed ((a), (b), (d), (18)); P0-R4-nit committed. All code legs; every UI leg UNVERIFIED (computer-use); no rebuild from these commits | `2ac3c157f` (P0-R6-host), `c4761bfd0` (P0-R6-ui), `e736ce78c` (P0-R5b), `4a5887376` (P0-R4-nit); record commit "DLW W0d: record — PATH and ticket resolutions" | none run (no W0d review verdict) | — (open: no review verdict) |

## 10. Carries

Registered from R0 (12 Oct) and the wave-0 converge returns. Each is owned
by the ticket named, or by the owner where marked.

1. ~~**P0-R1** — rebuild and relaunch from a clean tree at a commit holding
   the repairs~~ done W0b: r1d from the clean tree at `b50b970c3`,
   `source_dirty: false` (`e411dc7d7`).
2. **P0-R5** — (A) and (B) landed W0b (`f5adaa2ab`). Still owed: observe
   the reading and the refusal card in the native window (computer-use).
   The development-browser path states "no revision disclosed"; the
   `/api/config` producer is still not traced (checked only as static
   markup). The "fixture harness" kind is not rendered: see item 20.
3. **P0-R1 acc. 4** — capture the window with run context visible
   (computer-use, or Screen Recording for the conductor shell, then
   `P0R1_STAMP=<stamp> bash desktop/cradle/docs/world-shell/evidence/p0-r1/run-native-at-head.sh launch`
   and `screencapture`, labelled `screen-capture (no interaction)`).
   Still owed after W0b: `screencapture` was refused again in r1c and r1d.
4. **P0-R1 acc. 3** — UI ticket filed as **P0-R6** (`1fdae0e30`); blocked
   W0c on the host disclosure (item 24). Evidence copies done W0b (r1d: `7-composition.json`,
   `7-catalogue.json`, `7-ctrl-version.txt` = `7a451112a1a4`; catalogue
   points factory, workcell and ql at `live-shell/unavailable/*`). Still
   owed, as a new UI ticket under `packages/live-shell/ui/src` (to file):
   show the
   compiled/selected/registered/excluded/failed readback (`live_shell_config`)
   in the window, with factory, workcell and ql each named as waiting.
   Excluded-by-footprint must read differently from absent-because-unbuilt.
   A structured host-side readback of the full `live_shell_config`
   (contributions, product_ids, backing) is also missing; adding one is a
   product-code change plus a rebuild.
5. **P0-R1** — quit exit code done W0b (app-menu Quit, parent waits on
   the pid, exit 0 in r1c and r1d). Still owed: exercise the full-suite
   backing, not only the footprint default 0/1/2.
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

Registered from the W0b converge returns (12 Oct). No W0b review ran, so
there are no review carries yet.

15. **P0-R1 runner** (P0-R1 evidence zone) — `readback` does not wait for
    the webview's AX tree (the first r1d readback walked 6 elements and
    missed the run context; kept as `readback-attempt-1/`): poll
    `ax-run-context.swift` until the element count settles. The runner
    also does not copy `stage/native-checkout-drift.json` into the run's
    logs (copied by hand in r1c and r1d).
16. **P0-R1 acc. 2** — the run-context span's title (tree digest, carrier)
    is not exposed to accessibility; observing it needs computer-use (hover).
17. **P0-R5 follow-ups** — filed as **P0-R5b** (`1fdae0e30`), blocked W0c:
    (a) `RunContextReading` reads `readShellConfig` once per `StatusBar`
    mount; a `readShellConfig(true)` refresh does not re-render it —
    subscribe to config refreshes.
    (b) Consolidate the partial carrier readings at `ModeBrowser.tsx:126-130`
    (transport `:126`, carrier `:127`, World row `:130`; re-opened W0c),
    `ModeContextDock.tsx:208`, `App.tsx:355-357` through
    `runContextOf`/`carrierOf`.
    (c) `SettingsWorkspace.tsx` Acknowledgement still dumps the settings
    result as JSON; allowlisted in the guard as a developer disclosure.
    (d) In the error state `runContextOf` is passed carrier "not yet read"
    although the read failed; the field should say "configuration not read"
    (not rendered today).
18. **P0-R5 behaviour change — owner or conductor to confirm.**
    `NativeMaterialBrowser` no longer shows the retained `native_outcome`
    receipt (the folded JSON); only the owner's words, the operation and
    the retained copy ref remain. If the receipt is wanted as a developer
    view, re-add it folded and allowlisted in the guard.
19. **P0-V1 zone (optional re-cites)** — DLW-VISION :990, :1050, :1051,
    :546-547/:1052 and :156/:472 cite BMAP for phrases the live map holds
    verbatim (P0-BIMBA-LIVE rows N11-N14, E2). Not divergences.
20. **needs-owner (P0-R5)** — the ticket's three-way reading names a
    "fixture harness" world, but no host supplies a fixture marker and the
    shell has no producer for one. The reading renders native host /
    development browser / pending only. Owner to say whether a fixture
    label is wanted and what it reads from.
21. **WIDGET-GUIDE §8 proposals (P0-R5 builder; conductor to adopt or
    decline):** (1) the status region carries one run-context reading
    (world name, disclosed revision, uncommitted-changes flag, carrier),
    with a pending wording during the read and a named absence when no
    revision is disclosed; (2) an owner refusal card is a named disclosure:
    owner, boundary operation, the owner's own words, a remedy only when
    the owner names one, the retained copy ref when kept, and no receipt or
    JSON surface; (3) refused and accepted outcomes of a native operation
    both show as named rows, never a preformatted dump.
22. **P0-BIMBA-LIVE** — the receipt holds only while the map stays at
    `graph_revision 12` and oi-omarchy is reachable. The M4.3-2.0…2.2
    defect went to the QL owner as NOW return
    `bimba-map-defect-m4320-m4321-m4322-2026-10-12` (kind question,
    active); no QL-MEF GitHub issue was filed — posting publicly needs the
    owner's go-ahead.
23. **Brief hygiene** — the P0-BIMBA-LIVE brief's check wrote `> read.out`
    to the seat root, outside the zone. Briefs name
    `desktop/cradle/docs/world-shell/evidence/p0-bimba-live/read.out`.

Registered from the W0c converge returns (12 Oct). No W0c review ran, so
there are no review carries yet.

24. **P0-R6 — host disclosure, owner or conductor go/no-go.**
    `live_shell_config` (`native_shell.rs:429-430`) carries `product_ids`
    (backing-admitted only) and `contributions`; no field names the suite
    product universe. Proposal from the builder: add a host field in
    `candidate::config` carrying the footprint's backing-options product
    list (full suite: central, actuation, ai-kit, software-factory,
    workcell, quaternal-logic), so the shell marks non-admitted products
    excluded-by-footprint. Hard-coding the universe in the UI is refused (a
    second store; port and honesty laws). The host change is product code
    in `desktop/cradle/src-tauri` plus a rebuild through the P0-R1 runner.
25. **P0-R6 / P0-R4 — native walk** (computer-use): P0-R4's lamps,
    "waiting · <Owner>" headers, aria-labels and refusal cards at
    `7b59fecad`, from a clean-tree rebuild (`source_dirty: false`). Gated on
    §3 (computer-use) and P0-R1.
26. **P0-R4 — native-run admissions not exercised**: Central roster through
    bundled ctrl `7a451112a1a4`, AIKit `harness_agent_read`, Workcell
    `workcell_status_read`. The r1d catalogue points workcell at
    `live-shell/unavailable/*`, so the Git lamp is expected to read
    "waiting · Workcell" (code-reading only).
27. **P0-R4 honesty nit (fix next pass)** —
    `AgentShellBrowser.gitRowsFromWorkcell` (`ui/src/agent/AgentShellBrowser.tsx:112-118`)
    labels an answered seat without a `workcell_ref` as a refusal
    ("workcell · refused"). Mark it refused only when `seatError` is set;
    otherwise say the reading answered without a ref (meta likewise).
28. **P0-R4 looseness to review** — when Central's roster answers with no
    accepted `skill_refs`, the skillset row waits on AIKit with the remedy
    "AIKit builds agent-chain skillset admit". The empty refs come from
    Central's roster profiles; a reviewer confirms AIKit (rack owner,
    AGENT-DEVICE-OWNERSHIP.md:27) is the right party to wait on.
29. **Owner tickets (to file, owners' seats)** — ai-kit: build
    `agent-chain skillset admit` or declare it absent; workcell: build
    `workcell git-seat attach` or declare it absent.
30. **needs-owner (P0-R4)** — `agent-chain order` has no grounded owner (the
    composition is declared at the shell's family door,
    `ui/src/inhabitants/agentDeviceCatalogue.ts:33`, `CHAIN_SLOTS`). Owner
    names who owns it, or rules it absent.
31. **P0-R5b ordering — conductor call.** Either land P0-R6 first, then
    claim P0-R5b; or rule that items (d) and (18) (`runContext.tsx`,
    `OwnerRefusal`, `NativeMaterialBrowser`) run before P0-R6, leaving (a)
    and (b) (StatusBar and the mode files R6 mounts into) behind it.
32. **Packaging** — the r1d payload ships workcell, factory and ql as
    `live-shell/unavailable/*`. Bundling them is `build-native-candidate.py`
    / `package-payload.py` work (P0-R1 / §10 item 5, full-suite backing).
33. **WIDGET-GUIDE §8 proposals (P0-R4 builder; conductor to adopt or
    decline):** (1) an unlit admit lamp's header reads "waiting · <Owner>"
    and its accessible name "not admitted — waiting on <Owner>"; no bare
    "unadmitted", no lamp prop defaulting to on; (2) a refused owner reading
    is one line of at most 240 characters, "waiting on <Owner> — <reading
    op> refused: <owner's words>", and "not reached" when the shell's own
    transport failed; (3) a missing-op refusal names op, owner and remedy
    ("<Owner> builds <op> on its own seat, or declares it absent"), and says
    so when no owner is grounded.
34. **Brief hygiene (W0c)** — the dispatch's test command names
    `tests/owner-readback*.test.mjs`; the glob matches no file and zsh
    aborts the whole command. Drop it until P0-R6 adds that suite. The
    dispatch also named `docs/world-shell/wayfinder/` at the seat root; the
    path is `desktop/cradle/docs/world-shell/wayfinder/`.
35. ~~**P0-R5b builder receipt incomplete**~~ done W0d: the P0-R5b
    builder read DLW-VISION §0 and §6.

Status of earlier items after W0d: item 4 — code landed (`2ac3c157f`,
`c4761bfd0`), observation owed (items 36–37). Item 17 (a), (b), (d) done
(`e736ce78c`); (c) stays as ruled. Item 18 done (`e736ce78c`, folded and
allowlisted). Item 24 done: ruled option (a), landed `2ac3c157f`. Item 27
done (`4a5887376`). Item 31 done (ruled: P0-R5b after P0-R6-ui; ran in that
order). Item 34 done: `tests/owner-readback.test.mjs` exists, so the glob
now matches.

Registered from the W0d converge returns (12 Oct). No W0d review ran, so
there are no review carries yet.

36. **Rebuild and observe (conductor, P0-R1 runner)** — nobody has seen
    `suite_product_ids` or the owner readback in a running native window.
    Rebuild from the clean tree at the W0d record commit (marker
    `source_dirty: false`), then `readback` (scripted AX) for the run
    context and the owner-readback rows. The `prepare()` wiring
    (`native_shell.rs:223` call, the subset refusal at `:224-230`, the
    `RUNTIME` slot at `:427`, the config field at `:474`) is checked by
    code-reading only; the unit tests cover the pure reader, not the Tauri
    bootstrap. Do item 15 (AX settle) first.
37. **P0-R6 UI legs (computer-use)** — acceptance 5: both viewports, the
    status-region look, chip overflow in the status bar.
38. **P0-R6 absent-vs-unbuilt split is partial** — "absent, not compiled
    into this build" appears only for a contribution row with
    `compiled: false` whose owner is outside the universe. A product inside
    the universe that the backing does not admit reads "excluded by
    footprint" even when it is not compiled. Ticket acceptance 2 holds for
    today's footprint; a later host field (compiled per product) would
    close it.
39. **needs-owner (P0-R6)** — `live_shell_config` carries no display names
    for the suite owners, so the readback names each owner by its host
    product id (central, actuation, ai-kit, software-factory, workcell,
    quaternal-logic). The names live only in the Rust `OWNERS` table. Owner
    rules: the host discloses display names (a host field), or the shell
    keeps ids. The shell does not hard-code them.
40. **P0-R5b UI legs (computer-use)** — (a) the run-context reading updates
    live after `readShellConfig(true)` (the re-render is code-reading only;
    `renderToStaticMarkup` runs no effects); (b) the longer `carrierOf`
    wording ("Native owner configuration" / "Development native bridge" /
    the unavailable reason) fits the ModeBrowser World row, the
    ModeContextDock carrier row and the App transport link, both viewports;
    (d) "configuration not read" in the window when the read fails; (18)
    the folded receipt beneath the owner's words in NativeMaterialBrowser.
41. **Follow-up ticket (to file)** — the restored
    `<details className="owner-receipt">` (`NativeMaterialBrowser.tsx:132`)
    has no style rule anywhere in `packages/live-shell/ui/src` or
    `desktop/cradle/src` (conductor grep at `4a5887376`), so it renders
    unstyled. Add one rule or reuse RefusalCard's folded-receipt class.
42. **P0-R5b behaviour change — conductor accepts as the ticket's
    consequence.** The three carrier readouts (ModeBrowser World row,
    ModeContextDock carrier row, App transport link) now show `carrierOf`
    wording where they showed the bare transport kind (`tauri` / `bridge`).
    The ticket asked for that consolidation. The layout check is item 40
    (b); if the wording breaks a row, the remedy is WIDGET-GUIDE proposal
    item 46 (1), not a second reading.
43. **P0-R4 nit — new unread state.** Before the first
    `workcell_status_read` returns, and for an unexpected result kind with
    no error, the Git row reads "Git seat not read" (key `seat-unread`, meta
    "workcell · unread"); it previously read as refused. Follows the
    ticket's rule; the label can be renamed (e.g. "reading…") if preferred.
    Rendered row unverified (computer-use).
44. **P0-R6-ui extra states** — beyond the ticket's four, the module draws
    "not disclosed" (a host build that predates `suite_product_ids`;
    excluded is not claimed without the universe) and pending / unread (the
    reading before the host answers, and when the read fails). Both tested.
45. **P0-R6-ui / P0-R5b shared mount** — `RunContextReading` now returns a
    fragment holding the run-context span and `OwnerReadback`; P0-R5b's
    subscription landed on top of it (`e736ce78c`). Any later change to the
    status region starts from that fragment.
46. **WIDGET-GUIDE §8 proposals (W0d builders; conductor to adopt or
    decline):** P0-R6-ui — a readback row states its state in plain words
    and its remedy on the same line ("<owner> · excluded by footprint …
    Remedy: no remedy named"); the development path draws a stated absence
    ("No host readback") and no state chips, never an empty table. P0-R5b —
    (1) a readout row that names a carrier puts a short label in its value
    and the full carrier wording in its title, so a long label cannot break
    a narrow row; (2) a refusal surface keeps the owner's words as the
    visible surface and folds any native receipt beneath them as a named
    developer view, never as the surface (RefusalCard's pattern).
    P0-R6-host and P0-R4-nit returned none.
47. **P0-R4 still open** — native walk per device family (item 25), the
    owner ops (items 29–30) and items 26, 28, 32, 33 stand unchanged by W0d.
