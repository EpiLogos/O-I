# PATH — the DLW build, live route

Every agent reads this before acting. The conductor keeps it true; nobody
else edits it. Builders never reconstruct the plan from chat — if PATH and a
ticket disagree, stop and return `OPEN`.

Updated: 2026-10-12, `claude-code:dlw-conductor` (Opus).

## Roles (owner's model map, 12 Oct 2026)

| Role | Model | May | May not |
|---|---|---|---|
| Conductor | Opus, this session | claim/unclaim, dispatch, converge, build, typecheck, stage, commit, keep PATH/MAP/matrices, escalate to the owner, run computer-use acceptance | write product code (except one-file glue to unblock a return), invent spec, resolve §10 conflicts |
| Builder | Haiku, ≤3 at once | edit inside the claimed zone, run lane-local checks, return the receipt | stage, commit, leave the zone, answer an OPEN-QUESTION, call UI done from code |
| Reviewer | Sonnet, 1 at a time, at seams | read the wave diff and refute the done-claim | fix, re-scope, review single patches |

Brief templates: `BRIEF-BUILDER.md`, `BRIEF-REVIEWER.md`. Plan of record:
`DLW-PLAN.md` (§9 order, §10 open questions, §11 laws). Standing map:
`MAP.md`. Craft: `WIDGET-GUIDE.md` + `../icon-cut.html`.

## 1. Current phase

**0 — R1-boot.** Phase chain: 0 → 1 craft → 2 seams → 3 verticals →
4 targets (lane 3 → 2+4 → 1+5) → 5 retire. No fan-out across a red gate.

## 2. Ground as verified 12 Oct (conductor, executed checks)

- **Seat** `worktrees/env-1/o-i`, lane `dlw/build-20261012`, cut from
  `origin/main` `619a4548b`. The whole shell is on O-I `main` (#635, #637,
  `0dfa7b5ea` fold-in, the 11 Oct Live-mode device-face rounds).
  `agent/o-i-20261007-1639` and `m-prime-methodology` are history — DLW-PLAN
  §1/§11 and EXECUTION-* still name them; read those seat lines as stale.
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

## 3. Hard gates

| Gate | State | Clears by | Blocks |
|---|---|---|---|
| R1 native run at HEAD | **red** | conductor, ticket P0-R1 | all acceptance |
| Computer-use channel in the conductor session | **red** | owner: turn on Computer Use for this session in the Claude desktop app | every UI acceptance leg; R0 review |
| ctrl roster fix installed | **green** (verified above) | — | — |
| Factory receiving/advancement join | red | Factory owner | Phase 3 only |
| R2 installed-state rename (ledger item 12) | owner nod | owner | retirement bookkeeping only |
| §10 OPEN-QUESTIONs (42, unruled) | open | owner | any builder who hits one stops |

## 4. Open claims

| Ticket | Agent | Zone | Since |
|---|---|---|---|
| conductor | claude-code:dlw-conductor | `desktop/cradle/docs/world-shell/wayfinder/` | 2026-10-12 |

## 5. Next claimable

1. **P0-R1** — native run path at HEAD. Conductor-led (judgment when the
   host fails; heavy serial build). Blocked-by: none.
2. **P0-R5** — run-context disclosure + disclosure components. Haiku,
   UI-only zone; can build in parallel with R1's compile, accepts in the
   native app after R1. Blocked-by: none (acceptance blocked-by P0-R1).
3. **P0-R4** — owner bindings in the native run (roster, gateway, workcell
   reading, skillsets). Haiku once R1 boots. Blocked-by: P0-R1.

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
