# PATH — the DLW build, live route

Every agent reads this, then `DEVICE-SEMANTICS-LOCK.md` §0, then its ticket.
The lead keeps PATH true; nobody else edits it. If PATH and a ticket
disagree, stop and return. Rewritten 12 Oct 2026 against the lock; the
earlier PATH (waves W0–W0e, carries 1–57) is in git at `760fa4916`.

## 1. Roles — exactly this, nothing more

| Role | Who | Count | Does | Never |
|---|---|---|---|---|
| **Lead** | the Opus session running the build | 1 | claims tickets, writes briefs, dispatches, converges each return itself (re-runs checks, reads the diff, stages the ticket's files, commits, pushes), keeps PATH, runs the native app and screen checks | spawns any agent other than the builders and the reviewer below; writes product code beyond one-file glue |
| **Builders** | Haiku subagents (Agent tool, `model: haiku`) | ≤3 at once, one ticket each, exclusive zones | edit inside the zone, run the ticket's checks, return the receipt | stage, commit, leave the zone, decide design |
| **Reviewer** | one Sonnet subagent (Agent tool, `model: sonnet`) | 1, only at review points (§6) | reads the wave's commits and refutes the done-claim | edits anything |

No Workflow tool, no Opus subagents, no research fan-outs. A ticket that
needs judgment (a native build, a cross-repo change, a design reading) is
the lead's own work, not a builder's.

Briefs: `BRIEF-BUILDER.md`, `BRIEF-REVIEWER.md`. Law: `DEVICE-SEMANTICS-LOCK.md`
(device semantics and settled owner facts) over the mockups
(`../world-shell-mockup.html`, `../agent-shell-mockup.html`), the specimen
(`../icon-cut.html` / `inhabitants/sdk/modes.ts`), `../WORLD-SHELL-DESIGN.md`,
`WIDGET-GUIDE.md`. DLW-PLAN and DLW-VISION are background only; where they
differ from the lock, the lock stands.

## 2. Ground

- Seat `worktrees/env-1/o-i`; the lead cuts its lane from `main` with `seat join`
  (the first lane, `dlw/build-20261012`, landed as #650). One cargo
  build at a time on the shared target (`Work/O-I/target`, repaired 12 Oct).
- Native run: `bash desktop/cradle/docs/world-shell/evidence/p0-r1/run-native-at-head.sh launch`
  then `readback` (builds the `native_shell` Tauri host from a clean commit;
  the marker must read `source_dirty: false`).
- Baseline at `4be97cc79`: tsc 0; lane suites 174/174; `cargo test --features native_shell` 36 pass.
- Baseline at `cc69e19fa` (13 Oct, plain `node --test tests/*.test.mjs` in
  `packages/live-shell/ui`): 1195 tests, 1185 pass, 10 fail in 10 files — 8
  WebStorage suites that need `--experimental-webstorage
  --localstorage-file=<tmp>` (by design), and 2 extensionless-import reds
  (fixed in `864643e2e`). The full package is green under the right
  invocation: plain `node --test tests/*.test.mjs` fails only inside the 9
  WebStorage suites, which pass under `npm run test:webstorage`. Phase-1 lane `dlw/phase1-semantics-20261013`: tsc 0;
  devices:validate PASS; the touched suites green (see each ticket).
- Running services that are not the lane's — never stop them: Vite 5176,
  walk-bridge 4179.

**Where things live (12 Oct 2026, one home):** the design pack is
`desktop/cradle/docs/world-shell/` — PROGRAMME, CONVERGENCE, the design and
standards, the mockups, the target register (`targets.json` +
`acceptance.py` + `ACCEPTANCE-CHECKPOINT.md`), `lanes/lane-1…7`,
`glyph-language/`, `evidence/`, and `wayfinder/` (PATH, the lock, EXECUTE,
briefs, tickets; `tickets/history/` holds the K1/L1–L9/C/F/V tickets). RE
campaigns live in `campaign-evidence/`. `Work/reverse-engineering/` keeps
only build artifacts and raw captures (not in git) — read its
`MOVED-TO-O-I.md`.

## 3. Gates

| Gate | State | Clears by |
|---|---|---|
| Screen: login unlocked + Computer Use on in the lead session (or Screen Recording for the lead's shell) | red | owner act |
| R1 native run at HEAD | code green (clean build, quit 0, AX reads the run context); pixel legs owe the screen gate | lead, after the screen gate |
| R0 review | FAIL stands until screen evidence exists | lead + reviewer |

**Rule:** a ticket with no UI leg may run while the screen gate is red; a
ticket with a UI leg lands its code and stays open until the lead has seen
it on screen. No new UI phase opens on top of unseen UI.

## 4. Phase

**0 → 1.** Phase 0's code is landed (W0–W0e): native host builds and
launches from a commit; run-context reading; owner refusals as disclosures;
owner readback from `live_shell_config` (`suite_product_ids`,
`suite_owner_names`); agent-chain owner bindings; live Bimba receipt.
Its screen legs (P0-R1, P0-R4, P0-R5/5b/5c, P0-R6) close with one screen pass
and R0. Phase 1 opens with the no-UI work below.

Phase chain: 0 native + disclosure → 1 semantics gate + craft →
2 seams → 3 verticals (Factory, Central) → 4 the 126 targets (lane 3 → 2+4 →
1+5) → 5 retirement.

## 5. Claimable now (in order)

1. **Screen pass** (Sonnet computer use) — waits on the owner's grant of
   "O-I Shell Candidate" (refused twice; never substituted by scripted AX
   clicks).
2. T-FACTORY-TIMELINE-PANE; T-EXPRESSIONS-PANE-LEASE.
3. Lane-5 T15 (the palace's free-placement board), T22–T24; T21's journey
   draft (scene order, pace) — no draft store exists yet.
4. Lane-3: E21's projection standing reached from the frame (a host
   request answering wikiSubjectStandings); `.canvas` import as one undo
   entry (the material batch and the native connect act, grouped).
5. Lane-2: the two parallel fullscreen paths (E23 requestStageFullscreen,
   A8 Canvas present) unified when focus-mode.test.mjs's pin allows.
6. Phase 3 Central vertical; Phase 5 retirement.

Held for the owner: M1′–M5′ restatement and instrument count (vision spec
#655); Factory `factory.run.close` grant; Factory owner `writeAuthority`.

## 6. Review points (Sonnet, one at a time)

R0 after the screen pass · R1 end of Phase 1 · R2 each seam batch · R3
before verticals · R4a/b after each vertical · R5 each target-lane block ·
R6 before retirement. Exception: a builder failing the same acceptance
bullet twice gets one Sonnet diagnostic; never a third builder attempt.

## 7. Open claims

One branch, one run (`dlw/build`, PR #654). Builders are Haiku, three at a
time, each with an exclusive zone; the lead converges, commits and keeps
this table true. Tickets and resolutions live in `tickets/`.

| Ticket | Who | Zone | Since |
|---|---|---|---|
| lane-3 E18 (per-document library, quarantine) | haiku builder | `field-studies-journeys/src/{store.ts,draftStorage.ts,recovery.ts,library.ts}` | 2026-10-13 |
| lane-5 T19 Accept route + seam B ref carry | haiku builder | `expressions-boundary/src/{protocol,host}.ts`, live-shell native owners + `driveHostedLens`, `palaceInstrument.tsx` Accept | 2026-10-13 |
| WebKit editor-remount (shell-recovery) | sonnet reviewer | read-only investigation | 2026-10-13 |

Landed on main this day: #656 and #654 (the first 133 commits), #657 (the
D-series, tours, E15/E16, the frame nudge's cradle withdrawal). Continuing on
#658 (`dlw/build`).

Open in CI: `Desktop shell recovery` fails intermittently on WebKit only —
"the same editor DOM returns, not a remount" on the full-workspace Settings
return at 360 px; ~9 clean runs to 19f5ed41d, then 3 failures in 4. Withdrawing
the cradle host's nudge did not cure it (9e0527d70 failed again). Under
investigation; no commit since 19f5ed41d touches the editor's retention.

Factory close, after 4c274de4d: the kernel resolves a grant against
`Control/user/native-action-authority.json` (root: `OI_CENTRAL_ROOT`, else the
nearest ancestor of the Factory state holding the contract); the native
host reads its own token (`CENTRAL_NATIVE_TOKEN`, else
`~/.central/native-token`, 6ce7de75c) — it never crosses the webview. Open:
the contract grants no `factory.run.close` yet — the owner's grant — and the
desk names no principal until one exists.

## 8. Foreign lanes — never touch

`worktrees/env-3/o-i` (Central Field base lane); the `worktrees/env-1/ai-kit`
claim; #281 M′ music in `Work/Quaternal-Logic` (the shell admits its
landings); the Archetypal-Earth curation lane; whoever runs Vite 5176 /
walk-bridge 4179.

## 9. Carries

- Native run at the lane's HEAD `c9c1510a8` (13 Oct, stamp `20261013T-phase1b`):
  clean build (`source_dirty: false`), sealed, launched, AX settled at 1595
  elements, the window reads "Native host · revision c9c1510a8da4" and "3 of
  6 owners admitted" (3 excluded by footprint), the rail reads "Central" and
  no element carries "Base · Central" / "08:30" / "21:00"; quit exit 0
  (`evidence/p0-r1/run-20261013T-phase1b/`; channel scripted). Screencapture
  still refused — the pixel legs stay owed.
- The target register refuses verify: `PROGRAMME.md` was edited (8 Oct) after the
  register recorded its hash — true before the move too. Re-record the basis
  (`python3 acceptance.py`) only with a dated note of what changed; the 0/126
  progress stands either way.

## 10. Wave log

| Wave | Tickets | Commits | Review |
|---|---|---|---|
| W0–W0e | P0-R1, R4, R5, R5b, R5c, R6, R6b, V1, V2, BIMBA-LIVE | `24e7d8f7f` … `760fa4916` | R0 FAIL (screen evidence owed) |
| lock | DEVICE-SEMANTICS-LOCK; plans conformed | `4be97cc79` + the conformance commit | — |
| P1 (no-UI) | T-AE-REPORT, T-SEMANTICS-GATE, T-TIMELINE-WALKS leg 1, T-LABELS, T-EXPRESSION-TRACKS, T-CAPABILITY-HOMES, T-HOLDERS | `68e0b8ba5` … `9a16b2579` (lane `dlw/phase1-semantics-20261013`) | R1 owed after the screen pass; UI legs unverified |
| P2–P4 (one run) | Atlas host + provider, sequence-editor mount; lane 3 E01–E16, E20, E24, E25, E09–E13; lane 2 T1–T8, T10–T13, T15–T18; lane 4 T1–T21 (T21 in flight); lane 1 A1–A8; lane 5 T1–T3 (glue + live surface); three Sonnet reviews and their fixes (T-REVIEW-1..3) | `77e7df56f` … `6d0cbae3d` on `dlw/build` (PR #654) | R2/R5 as T-REVIEW-1..3; native screen pass owed (computer-use access refused twice) |
