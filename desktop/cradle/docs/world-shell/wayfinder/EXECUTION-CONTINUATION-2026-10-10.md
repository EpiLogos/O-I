# Continuation prompt — the World-shell development track (10 October)

> **Superseded on device semantics and owner facts (12 Oct 2026):** `DEVICE-SEMANTICS-LOCK.md` is the law, `PATH.md` the route, `EXECUTE.md` the execution prompt. This continuation is superseded.

Copy this whole file into a fresh session standing anywhere in the Central
world. It assumes the strap (central-session-strap) runs first.

---

You are the orchestrator for the World-shell development track — the DLW
(Digital Logos Workspace) build. The plan of record is
`wayfinder/DLW-PLAN.md` (3,481 lines, compiled from the entire ground,
grilled by two adversarial lanes, corrected — grill record in §13, the
42-item OPEN-QUESTION ledger in §10 awaiting the owner's rulings). The
track state is `wayfinder/DEVELOPMENT-TRACK-2026-10-09.md`. The governing
map is `wayfinder/MAP.md`. The craft standards are `wayfinder/WIDGET-GUIDE.md`
and `new-shell/icon-cut.html` (the owner's icon standard — every icon from
there, verbatim).

## Where the ground stands

Seat: `/Users/admin/Central/worktrees/env-1/o-i` (symlinked target into
`Work/O-I/target` — one shared build tree), branch **`m-prime-methodology`**
— the whole shell's working state is COMMITTED through `a74da6456` (fold
in the working state) on top of the new-shell lane's PR #635; the branch
and the earlier `agent/o-i-20261007-1639` line carry byte-identical trees
(#635 was the squash-landing of the same content — nothing diverged).
The working tree starts CLEAN. There is no other lane on the new shell:
the earlier "composition parent" framing is retired — all shell work is
this track's. Still: `git status` and `git log` before anything; one
cargo build at a time.

Landed and committed (the foundation — do not redo): the mode system
(`20da871dc` — one transport five meanings from `src/shell/modeGrammar.ts`),
per-mode content composition (`5d1a1da27` — browser/centre/detail/status
per mode from the grammar), Live's place (`0f4bfdadf`), the chain drag/
drop/refuse (`5b5b6a4ca`), the fidelity sweep (`109ba5d5c`), the inhabitant
craft + icon-cut mark system (`c05843ad3`), the atlas port (`4b17be9a2`,
82 modules corpus-neutral), the agent-shell craft + fault fixes
(`b80286705`, `a120086e6`, `7fbde446e`), the kernel read horizon
(`92695a963` — 55 s → 1.4 ms warm, live), the audit gates (`b5a22ae53`).
Suites at HEAD: mode-grammar 14/14, agent 51/51, inhabitants 10/10,
composition guard 29/29, fidelity 12/12, live-mode-place 8/8; tsc zero;
full sweep 1115/1125 with the 10 named parent-zone/baseline failures.

Computer Use works machine-wide (main agent only — subagents get refused;
the broker fix is `~/.zcode/cua-broker/relaunch-broker.sh` if it ever
regresses). The dev shell serves at http://localhost:5176/app/ (Vite on
5176; backend 8788; kernel bridge walk-bridge on 4179). The headless
iteration harness is /tmp/mode-audit-run/audit2.mjs (recreate if /tmp
cleared — playwright chrome channel, per-mode via
`button.mode-rail-button[data-mode=…]`, both widths).

## The remaining work, in order

1. **R4 — owner bindings in the native run** (the "not admitted" wall):
   gateway attachment, the ctrl binary reinstall (the roster fix is
   committed — Work/Central `9449881` — the installed binary predates it),
   the workcell reading grant, skillset admission; then the three named
   missing ops from the chain-drag table (`agent-chain skillset admit`,
   `workcell git-seat attach`, `agent-chain order`) — build them with their
   owners or the owners declare them.
2. **R3 round 2 — world-surface craft**: the sweep's DEFECT-TABLE.md names
   5 rows with owner (src/agent roster banner float, Factory status counts
   + browser drift, the parent's NativeWorldDetail floating sentence,
   BrowserPane 700px sliver, the second inline icon set); then the same
   treatment for the world surfaces (browser, Timeline, Earth) at the
   mockup standard.
3. **R6 — verdict re-base in the native app** once R4 lands: the fidelity
   oracle gains craft assertions; the parent closes on native
   computer-use evidence only.
4. **L4 + L9-face are LANDED** — the fold-in commit `a74da6456` carries
   the timeline adapters, time spine, QL adapters, World Timeline
   presentation and the musical face files (the earlier sequencing
   dissolved when the seat moved to m-prime-methodology, which already
   held the new-shell lane via #635).
5. **The native assembly**: freeze-product-bindings.py →
   package-payload.py → install. The bytes are staged at
   OI-Shell-Candidate-Acceptance/verify-orchestrator-20261009-g
   (native-feature-build-bytes, functional_acceptance pending). The
   tauri-bundled app alone refuses to bootstrap — the qualified payload
   assembly is the remaining step.
6. **The verticals** (L8): the Factory commission recovery and the real
   day through track/document/Nara/wiki — computer-use evidence in the
   native app.
7. **The OPEN-QUESTION ledger** (DLW-PLAN §10): the owner rules; the
   answers fold into the plan.
8. Then the 126-target ladder per DLW-PLAN §9's build order.

## The laws that bind every lane

Port law (name the legacy source by path:line; port + retire; native
owners never reimplemented). Aperture law (declared owner operations with
receipts; a UI flag is never a native effect). Widget law (the mockups
are the floor — the delivered feature functions and looks BETTER;
icon-cut.html for every icon). Honesty law (channel-label every
observation: computer-use / headless / scripted / code-reading; a
completion claim carries executed evidence). Musical law (M1 source, M2
modulates — `generates: false` is in the type; role classification; the
realtime boundary). Computer Use is main-agent-only; subagents iterate by
the headless render loop and READ their own screenshots.

Subagent protocol: full protocol pack read before work (the DLW-PLAN
replaces WORLD-SHELL-DESIGN as chapter source where they overlap); receipt
first; zones declared and honoured; never commit/stage — the orchestrator
converges, verifies with its own captures, and commits bounded; suites
green + tsc zero in zone at every stopping point.

## First acts

1. `git status` + `git log --oneline -15` (the parent may have landed
   more); read DEVELOPMENT-TRACK-2026-10-09.md and DLW-PLAN.md §0–1 + §9.
2. Check 5176/8788/4179 are serving; restart per the recorded commands if
   not (walk-bridge: `cd desktop/cradle/kernel && ./target/debug/walk-bridge`;
   shell: `LIVE_SHELL_KERNEL_BRIDGE=http://127.0.0.1:4179
   LIVE_SHELL_BIND=127.0.0.1:8788 ./target/debug/live-shell` from
   packages/live-shell; Vite: `npm run dev -- --port 5176 --strictPort`
   from packages/live-shell/ui).
3. Continue the track at item 1 (R4) — or wherever the owner directs.
