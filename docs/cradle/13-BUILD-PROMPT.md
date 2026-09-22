---
Register: techne
Standing: execution brief (2026-09-23) for building the accepted UI lead
---

# 13 — Build the UI lead: execution prompt

Paste the block below into a fresh session opened at `/Users/admin/Central` (or `Work/O-I`). It is self-contained.

```text
You are building the O:I cradle desktop's new UI. It is specified and owner-accepted (23 Sep 2026).
Your job has two parts: add the right surfaces, and wire each of them to the real system. You must
not step over the parts that already work.

READ FIRST, IN THIS ORDER (repo Work/O-I, on main):
1. docs/cradle/10-SIDEBARS.md — the two sidebars, the seven laws, rulings D1–D6 and amendments
   A1–A6, the state IDs L*, R*, P*.
2. docs/cradle/11-FACTORY.md — Desk, the Run page (Map · Trajectory · Live · Handoff), Tasks, the
   right panel, object pages, state IDs F*, and five fixes on the Factory side.
3. docs/cradle/12-SETTINGS.md — sections, stage → review → apply → read back, the kernel operations
   still missing (including permission modes), state IDs S*.
4. docs/cradle/sidebars/sidebars-study.html — open it in the browser pane. It is the visual lead.
   Match its composition. Use the desktop tokens (packages/oi-design-system/tokens.css,
   desktop.css), never the study's own CSS.
5. packages/oi-design-system/DESKTOP-LANGUAGE.md — the 22 Sep shell behaviour rulings.
6. docs/cradle/05-EXECUTION.md §3 — walks are the acceptance.
   docs/experience/HARNESS-SETTINGS-RESEARCH-2026-09-22.md §4 — the negative roster of banned
   test shortcuts.

STEP 0 — RECONCILE BEFORE BUILDING (you own this):
- Take a git census of O-I first. The shared checkout Work/O-I is on the local-only branch
  ui/shell-law-2026-09-22. It is about 25 commits ahead of main (shell-law fixes, the settings
  L5/bootstrap/drift walk checks, removal of dev surfaces). It also has uncommitted work from
  another session: new configuration/panels.tsx and configuration/systemDisclosure.ts,
  ChatHarnessPanel removed, harnessSource and sourceHost edited, and more.
- Never edit, stash or reset that checkout. Check whether its session is still active: look at
  ListAgents and the O-I NOW records (ctrl --json action run projectcentral.now.inspect
  '{"project":"O-I"}').
  - If that session has finished, commit its tree on its own branch as it stands, with a message
    that says so.
  - Push that branch and open a PR; land it once it is green.
  - Build on top of it. Its settings work is the base that 12-SETTINGS refines.
- Work in your own worktrees (skill: agent-worktree-lifecycle) with one CARGO_TARGET_DIR per
  worktree. main is protected, so every change goes through a branch and a PR.

PROTECT — THESE ALREADY WORK; REGRESSING ANY OF THEM IS FAILURE:
- The corner wedge and window lights (data-window-corner, --shell-window-reserve;
  tests/window-lights-contract.test.mjs).
- Invisible scrollbars. The hidden, reveal-on-approach window footer.
- Base mode's left file-tree interaction. The Desk | Tasks pair. Draft retention across modes and
  restarts.
- The Context canvas insertion of files, terminals and browser material. Before you touch
  anything, capture a baseline walk of it: file insert, terminal insert, browser insert, and the
  state after sending.
- Flow's "Start writing" minting. The Day die face. The Visuals view. The settings v2
  plan/apply/axes path.
- The Technè wiki map (PR #480, merged). The Expressions stage and its single native field.
- Native identities for sessions, surfaces and runs.
- Commit shell refinements at once (ruling 5). Never leave them in a working tree.

BUILD, IN LANES. Lanes 1–4 can run in parallel as subagents, each on its own worktree with
disjoint files. CradleFrame.tsx, DesktopShell.tsx and workspace/mode.ts are hotspots: route every
edit to them through one integrator, serially.

Lane 0 — repairs (10-SIDEBARS §6.1, 11-FACTORY §8):
- Factory Tasks rows and Agents conversations open in the centre Tasks view.
- The Epi-Logos lens: the toggle lives in the window footer. It re-roots the file trees on the
  corpus, shows a chip in the head, and opens no surface.
- Document forms create a copy in place and never open the repo template.
- One scope:
  - tab focus stops changing the project silently (CradleFrame.tsx:404-415);
  - the Desk and Context read the scope;
  - workspaces move into the scope menu's footer.
- Inspect: the JSON dump becomes object pages.
- Activity becomes reachable.
- A1: harness, connection and model are separated. The chip at ChatComposer.tsx:131 shows the
  harness name. The model chip lists only real models. Settings calls the default a
  "connection", not a model.

Lane 1 — left frame (10-SIDEBARS §3):
- Head: a scope menu with live marks, All projects (Factory only) and workspaces; search opens ⌘K;
  one + menu.
- Foot: the universal Inbox (the receiving list is its only body; remove every other receiving
  or returns mount), the mode strip and Settings.
- The section and row grammar, with marks (R2–R5) driven by real session state.
- Open beside and Pop out on rows (the existing openInSidePane and detach routes).
- Factory INTENT: the vision page and goals. Add Goal and Vision entries to forms.json that
  create in place under ProjectCentral/user.
- Settings' left body is the section list.

Lane 2 — right panel (10-SIDEBARS §4):
- A one-row top: avatar menu (agents from real AIKit profiles), tabs per mode, ⤢ and ✕. No
  title band.
- The status line.
- Composer chips: permission mode, harness, model.
- One tape component shared by Activity and Run.
- Permission modes (A2) are new plumbing. In ai-kit, add session mode controls next to
  session_model_controls / set_session_model (ACP session/set_mode and Claude Code's permission
  modes). Expose mode-read and mode-select as encounter actions in the O-I kernel, then the chip.
  Bypass requires a confirmation and stays visibly marked. If a harness offers no modes, the chip
  is absent.

Lane 3 — Factory (11-FACTORY, in its build order):
- The Desk from real reads: the journey's commission.purpose, run-map units, discovery through
  `factory project locate`, the scope.
- The Run page: header; Map from `development run` plus `workflow inspect`; Live from attempts
  plus telemetry; Handoff from the readable return, with native recognition actions.
- Trajectory from the encounter journal:
  - join call and result by toolCallId;
  - turn markers and the lane strip;
  - usage stats from Pi's message_end usage, with an "Order" axis where timing is absent.
- Tasks: repair the join (executions, attempts and journey sessions, not only trajectories) and
  build the harness picker.
- Full-page centres (A4). Object pages open in place with ← back, or pop out.
- The Agents roster from real identities; no pasted markdown.
- Land the five Factory-side fixes (11-FACTORY §9) in Work/Factory through its own PRs.

Lane 4 — Settings (12-SETTINGS):
- stage → one review sheet → apply → readback. This replaces SetupFlow.
- Harness cards from client status (drop the broker).
- Models: the default connection, per-harness rows, route availability joined with the bound
  credentials, the eight policies, a catalogue dialog.
- Credentials: add kernel operations over aikit credential setup, verify, rotate, revoke and
  discover. The key field is write-only and empties after saving. No secret may appear in the DOM,
  the clipboard or the logs.
- Skills: toggles through the config plane (skills.capabilities is writable).
- Profiles, Permissions (including default permission mode per harness) and the Product pages.
- Fixtures only with ?fixtures=1. No raw JSON outside a "Show raw" disclosure.

ACCEPTANCE — each lane is done only when all of this holds:
- One walk per state ID it touches (L, R, P, F, S, A), run against the real kernel through the
  walk bridge (grade B or better). The receipts cite the spec IDs as spec_ref.
- Every walk passes the negative roster: no presence-only count()>0 checks, no fixture-backed
  acceptance, no raw JSON in the primary view, two-sided geometry checks.
- tsc, the cradle node tests, cargo test for the kernel, and the Context-canvas baseline walk all
  still pass.
- Screenshots in light and dark, at 1440, 1000 and 760 widths.
- Finally, install the build with `oi desktop install` and check each lane's headline behaviour in
  the installed app.

LAND AND RETURN:
- One PR per lane, CI green, merged by you.
- Record returns in the O-I NOW field (projectcentral.now.return) and close the day you stand in.
- Report to the owner leading with what the app now does and what to try. Name anything still
  blocked, and which native operation it waits on.
```
