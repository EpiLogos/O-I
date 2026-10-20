# Build handoff — 20 Oct 2026

The DLW build moves to the owner's second account. The owner carries this document across. The first account keeps the
planning, pages and creatures lanes and does no build work. Nothing here starts a session.

## Read first, in order

1. `PATH.md` — the live route. Its roles (§1), seats (§2), gates (§3) and open claims (§7) are the build's state of record.
   The build lead keeps it true.
2. `MAP.md` › "Lanes now" — the build lane's items, and what the planning and pages lanes send you.
3. `FOUNDATION.md` §6 — the foundation's order.
4. `DEVICE-SEMANTICS-LOCK.md` §0, then the ticket you claim (`tickets/`).
5. The manual, on O-I `main`: `docs/dlw/DLW.md` (device UI §16; each mode's tracks and clips §17.1–§21.1).

## Where it stands

- `dlw/build` in the seat `worktrees/env-1/o-i`, clean and equal to origin. #677 landed on `main` as #685 (20 Oct). PR #683
  carries everything since.
- The last candidates are r28 (`Work/O-I/target/p0-r1/20261020T-r28`; evidence
  `desktop/cradle/docs/world-shell/evidence/p0-r1/run-20261020T-r28/`) and r29, built for the reads
  (`run-20261020T-r29-reads/`). PATH §7 says what each row was seen doing on the native app and what each still owes its
  screen check.
- Loading (PATH L1, which carries the measurements):
  - Done:
    - the shell's first script is split (main window 6.38 → 2.80 MB), and panes draw their last reading at once;
    - the reads were paying for re-deriving state on every call, not for the process start: a warm process saves only
      about 5 ms;
    - Central stopped re-deriving its source table on every action (EpiLogos/Central#284, merged), and AIKit's
      session-space and lifecycle reads stopped building its whole Service (EpiLogos/ai-kit#535, merged). A day read now
      takes 309 → 93 ms; start-up's 12 task reads take 1.9 → 0.18 s;
    - the kernel notices an answering owner within a millisecond and traces every owner process (`72216b455`).
  - Owed:
    - Central's browser rows on last-reading-first (they show "Reading the Flows…" for 3–5 s on every return);
    - the last reading across a relaunch;
    - `central.files.read`, which starts 52 `ctrl` processes at start-up (4.4 s), one per file, to batch into one;
    - the next cut inside AIKit's `Service::open`, for `client status`, `model-catalogue` and `knowledge resolve`.
- Quaternal Logic is installed at `74e9c8e`, which is its `main`.
- The device lane's designs are in the catalogue (`main` `b14b51b8f`; here `ce0edad3f` and `5e60d82d3`). Each binding names
  the keys no owner serves yet as absent, with the reason. O-I #684 lists the reading each needs: the M3 generation cell,
  the sky's day and hour rulers, the Body source for Torus and Resonance, the agent-set Join, the agent's team cell, and
  bindings for Light, Resonator bank, Binding and Voice.

## The work, in order

From MAP's build lane:

1. What PATH §7 says is owed: the screen checks, and L1's three owes.
2. Foundations (item 4) and loading (item 5): L1's owed reads first.
3. Reverse engineering into the product (item 3).
4. Technē's construction chain, end to end (item 6).
5. The owner operations drag and drop needs, then those the planning lane's action table finds missing (item 7).
   The UI/UX lane's phase 2 (manual §10.9) put every object's acts in its menu. Each act an owner cannot take yet stands dimmed
   and names its operation, so this list can be re-read off the menus at any time (`frame/menu/objectActions.ts`). What waits, 20 Oct:
   - **Every mode:**
     - clip: cut, copy and paste (`clip.copy-to`, `clip.move-to`), info text, and Arrangement view's split, consolidate and crop;
     - track: duplicate, colour, group and move;
     - slot: its stop button;
     - row: rename, duplicate and delete.
   - **Live (kernel · live-set):** clip launch, stop, duplicate, delete and insert; track rename; row insert.
   - **Central (the page owner, today's set in the Day):** page duplicate, delete and create in a world (Insert clip); a page's
     switch (`active`); world rename; row insert.
   - **Factory (AIKit's encounter, Factory):** task duplicate, delete and insert; session rename; taking a session off the set;
     row insert.
   - **Expressions:** taking an Expression off the set; a stop's rename.
   - **Technē:** an event's name, colour and switch; event duplicate, delete and insert; a reading's rename and removal.
6. The shell refinements (item 8).
7. The readings the device lane's designs wait on (O-I #684).
8. T-PROCEDURAL-BODY (20 Oct, built on the owner's second account in one run; `tickets/T-PROCEDURAL-BODY-at-the-earths-standard.md`): a
   generated world held to the Earth's own numbers, procedural tiles at close zoom, weather from the occasion, the moon-to-planet look,
   and the rings carrying only agents at work and what they made. What it carries to you:
   - **Route.** A click cannot place a stop as one of a route: AIKit's `PlaceFacet` (`ai-kit crates/aikit-core/src/knowledge_facets.rs:214-243`)
     has no relation and no sequence, `TechnePlaceFacet.relation` only reads a subject's TRAVELLED_TO, and `routeModel` orders by validity
     dates because the contract carries no sequence field. The click is refused in words; a route needs a facet field first (an AIKit
     change, then the editor's `MapPlaceDraft`).
   - **Portal.** A portal is "a way through to someone else's world": it needs the visiting owner (WORLD-INHABITATION-V1 is contracted,
     not built). The click is refused in words naming it.
   - **Sessions of other projects.** The sessions provider reads only O-I's agency (`AgentSessionsProvider.tsx:21`), so a session of a
     project the Day did not bring in rides your world, and no root-register session shows. A session's world comes from its space's
     `definition.projects` (`system/sessionWorld.ts`).
   - **The outer ring may be empty on real ground.** Recent artefacts come from Central's change horizon rows that name an agent
     (`actor_kind` agent or an `agent_session_ref`). The 16 Oct reading found none attributed (`agent/devices/receiptBindings.ts:9-13`):
     the ring fills when agents write under their session.
   - **Unverified on the native app** (headless captures only): the sky lens end to end on a real sky layer (the harness has none; the
     flight follows the controller's own `ctl.skyCam.busy`, bounded at 12 s, and from the Graph or the ground flies at once), the anchor
     stub's look, the dotted and uncertainty rings drawn in CSS. The native candidate's screen pass is owed.
9. **Expressions in full** (owner, 20 Oct: the app's own UI still draws inside the field pane; the Studio's Full holds every device;
   the rack's face is the toolbelt). The manual's §20.1 (Pane view, Device view, Where everything is), §20.3 and §16.3's rack rule
   say where each of the app's functions lives; the catalogue's Studio draws its Full as that suite, through the rack's `member`
   door (`catalogue/panels/design.ts`). The UI/UX lane builds this as part of its phase 3 (device grammar); the files below are
   taken until it lands. What the build found:
   - **The field pane is the whole app.** The pane is an iframe of `field-studies-journeys` (`panels/expressions.tsx:251`,
     `expressions-boundary/src/host.ts:482`), and its 'devices' presentation hides only part of the app's chrome
     (`field-studies-journeys/src/workspace.css:613-633`). Still opening inside it: `#inspector` (the app's Studio, 19 sections),
     `#toolbelt-panel` (open by default over 1000 px, `app.ts:169, 953`), `#live-workspace` (open by default, `app.ts:167, 953`),
     `#context-panel`, `#belt-picker`, `#shape-picker`, `#modes-panel`, `#entry-gate`, `#capture-panel`, `#automation-assignment`,
     `#automation-monitor` and the dialogs (`shell.ts:13-29`). A maximised pane sends `frame` and all of it comes back
     (`components/expressions/studio/framePresentation.ts:19-21`). The pane's presentation hides every one, at every size.
   - **The shell opens the app's Studio in the pane itself:** the pool's "Open in studio ↗" (`components/NativeDevicePoolView.tsx:57-59`),
     `components/GlyphSequenceEditor.tsx:286` and `host.openStudio` (`panels/expressions.tsx:318-325` → `app.ts:2338-2342`). Each
     opens instead the device, or the Clip view tab, that holds the setting.
   - **Device view is the Studio rack:** its macros (the toolbelt, `Journey.shared.toolbelt`) and its Chains page; a device added by
     hand stands after it on "Your rack" (the 8 Oct ruling: never an always-on strip of every device). The Stage plate beside it
     (`components/expressions/studio/ExpressionsStudio.tsx:203-207`) holds what has no home yet: its relays of the app's rail, View
     (camera, guides, snap), still and film capture, Present and the Edition's export and import. It goes once those homes stand:
     Present in the View menu, Export in the File menu, the scene's View in its Clip panel (View: Kept), the rail's tools in Clip view.
   - **Pane view's seed** is the field pane and the Studio's Full side by side (`shell/modeFrames.ts:59-60`).
   - **The Studio's Full** hosts `member` for a rack: each member's design in its Whole view on that device's own binding, as the
     band draws it (`frame/devices/designed.ts`), so the pane and the chain read the same values.
   - **Homes with nothing behind them yet:** the Expression's title and description on its track head; Present in the View menu
     (`desktop/cradle/src-tauri/src/menus.rs`); compositions as the browser's starters; Export in the File menu.
   - **The port ledger** (`EXPRESSIONS-PORT-STATUS.json`): the eleven `studio-only-by-design` rows ("retained during port") end.
     Each takes its home from the manual's table, and no row stays retained.

These wait for the planning lane to write them into the manual; MAP's planning lane items 1–5 say what each is:
- the three layers per mode (Session, Arrangement, Pane);
- the actions on every object, with their context menus;
- waiting and faults drawn rather than written;
- flipped-up devices that lead with their display;
- terminal, files and web as devices.

Build none of them ahead of the manual.

## How the build runs

These rules each cost a failure to learn.

- **Roles** are PATH §1:
  - one lead (Opus) converges, commits and keeps PATH;
  - builders are Opus, one or two at a time, each with an exclusive file zone and a brief from `BRIEF-BUILDER.md`;
  - no Workflow tool, no research fan-outs, no task chips.
- **The owner's eye judges UI.** Each wave ends with a computer-use pass on a candidate built at HEAD. Headless WebKit draws no
  3D, and a Chromium capture is only a first look. A visibly wrong state (a die showing one flat face) is a fault even when
  every check passes.
- **Seats:**
  - env-1 is the build seat (`dlw/build`);
  - env-2 (`dlw/native-build`) is where candidates are built;
  - env-3 is a foreign lane: never touch it;
  - never create a worktree.
- **Shared seat:** neighbours commit the whole tree. Commit with `git commit -- <paths>`, and judge CI by HEAD.
- **Type-checks:**
  - run them through `tools/lead-kit/tsc-serial.sh` (one lock, because the machine swaps);
  - `tsc-tree.sh`'s second argument is a scratch folder it deletes, so keep it outside the seat;
  - check all three roots at each convergence (cradle, expressions-app, live-shell);
  - live-shell's WebStorage suites run with `npm run test:webstorage`.
- **CI:**
  - every push to #683 cancels its running checks, so batch pushes;
  - when a docs commit lands on `main`, merge `main` into `dlw/build`, or CI stops (check that #683 is mergeable after each push).
- **Candidates:**
  - `desktop/cradle/docs/world-shell/evidence/p0-r1/run-native-at-head.sh` builds them;
  - check QL's export receipt first (it goes stale when QL's `main` moves);
  - two builds in one seat collide;
  - a full-suite candidate writes the owner's ground (`Control/user/flows`), so back it up and restore it.
- **Processes:** stop only your own pids, never by pattern. Vite 5176 and walk-bridge 4179 are not yours.
- **The machine** has 16 GB, and swap was nearly full on 19 Oct while builds and model servers ran. Name the load beside any
  timing.

## What DeepSeek Flash can take

It fits a bounded change in named files, where the code already has a pattern to copy and a check proves the result (tsc, the
package's tests, `scripts/load-census.mjs`, a binding test). The lead writes the brief, reads the diff and runs the checks.
DeepSeek judges no UI, builds no candidate and writes nothing to the owner's ground.

- **Now:**
  - Central's browser rows on last-reading-first: `shell/modeBrowsers.tsx` and `shell/ModeBrowser.tsx`, copying
    `owners/ownerReading.ts`.
  - Further load-when-drawn splits that `scripts/load-census.mjs` finds, following `shell/loadWhenDrawn.ts`.
- **Once the planning lane has written the rule or table, and the lead has done one device or object as the pattern:**
  - The text sweep: the 200-odd "Reading …" and "No reading of …" lines inside devices and panes become the drawn unread state.
  - Live's keys on objects whose owner operation exists: rename ⌘R, duplicate ⌘D, Delete, insert scene ⌘I, fold U, switch off 0.
  - The shared context menu wired onto tracks, clips, scenes and browser rows from the action table.
- **Not for it:**
  - cuts inside the owners' own start-up (AIKit's `Service::open`, Central's admission) and the kernel's owner processes;
  - anything judged on the native screen (the die, display-first devices, the three layers);
  - candidate builds and screen passes;
  - design.

## Stays on the first account

- **The planning lane:** the manual and MAP, with the window and device rules above.
- **The pages lane:** the Day, Flow, Being and Thing templates, and the die.
- **The creatures and environs lane:** `Work/face-rig`.

Their work reaches the build through the manual, MAP and `dlw/build` commits, never through messages between sessions.
