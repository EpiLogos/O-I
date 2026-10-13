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
  (fixed in `864643e2e`). Phase-1 lane `dlw/phase1-semantics-20261013`: tsc 0;
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

Phase 1's no-UI work landed on `dlw/phase1-semantics-20261013` (13 Oct):
T-SEMANTICS-GATE, T-LABELS (code legs), T-AE-REPORT, T-TIMELINE-WALKS leg 1,
T-EXPRESSION-TRACKS (code legs), T-CAPABILITY-HOMES (lock §4.2), T-HOLDERS
(lock §4.8–4.9). What stands:

1. **Screen pass (lead, when the gate clears):** rebuild, launch, see and
   capture P0-R1/R4/R5/R5b/R5c/R6 and Phase 1's UI legs (T-LABELS acc. 4;
   the Timeline's walk lanes and sections; the Expressions two-lane tracks)
   at both viewports; then R0, then R1.
2. No-UI, claimable while the gate is red: **T-AE-C2-WORDING** (the
   founding corpus's name in AE UI copy → provider labels, C2-b8; ticket to
   write from T-AE-REPORT's resolution); **T-CAPABILITY-HOMES-LANDED** (13
   landed O-I/Suite refs without a family scope); a `test:webstorage`
   script that runs the 8 WebStorage suites with an owned tmp file.
3. After R0 (Phase 2 — seams; UI legs): **T-ATLAS-HOST** (the atlas mounts
   as `projection.earth` / `projection.constellation`; the World's corpus
   provider; host stores in the workspace) → **T-TIMELINE-WALKS leg 2** (the
   Journey reads the walks) · **T-SEQUENCE-EDITOR-MOUNT** (the scene's Clip
   detail) · **T-TRAIL**.

Deferred, owner-timed: T-LIVE-INTO-EXPRESSIONS.

## 6. Review points (Sonnet, one at a time)

R0 after the screen pass · R1 end of Phase 1 · R2 each seam batch · R3
before verticals · R4a/b after each vertical · R5 each target-lane block ·
R6 before retirement. Exception: a builder failing the same acceptance
bullet twice gets one Sonnet diagnostic; never a third builder attempt.

## 7. Open claims

| Ticket | Who | Zone | Since |
|---|---|---|---|
| T-HOLDERS (§4.8 + §4.9) | haiku builder | `src/inhabitants/sdk/semantics.ts`, `src/inhabitants/familyManifest.ts`, `src/inhabitants/sdk/define.ts`, `src/inhabitants/sdk/validate.ts`, `src/inhabitants/sdk/semantic-registry.json`, `src/inhabitants/quaternalLogicFamilyManifest.ts`, `src/inhabitants/qlMusicalExtension.ts`, `src/projections/atlas/atlasFamilyManifest.ts`, `src/expressions/expressionsFamilyManifest.ts`, `scripts/validate-devices.mjs`, `tests/live-semantics.test.mjs`, `tests/holders.test.mjs` (new) | 2026-10-13 |
| T-TIMELINE-WALKS leg 2 | claude-code:dlw-lead | the Journey in `src/shell/ModeCentre.tsx` | after T-ATLAS-HOST |

## 8. Foreign lanes — never touch

`worktrees/env-3/o-i` (Central Field base lane); the `worktrees/env-1/ai-kit`
claim; #281 M′ music in `Work/Quaternal-Logic` (the shell admits its
landings); the Archetypal-Earth curation lane; whoever runs Vite 5176 /
walk-bridge 4179.

## 9. Carries

- Native run at the lane's HEAD: see §10 (R1 code leg).
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
