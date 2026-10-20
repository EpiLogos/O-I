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

- `dlw/build` in the seat `worktrees/env-1/o-i`, at `e3b37bd3a` and equal to origin. #677 landed on `main` as #685 (20 Oct).
  PR #683 carries everything since; it is open, mergeable, and its checks are green.
- The last candidate is r28 (`Work/O-I/target/p0-r1/20261020T-r28`; evidence `desktop/cradle/docs/world-shell/evidence/p0-r1/run-20261020T-r28/`). PATH §7 says
  what each row was seen doing on the native app and what each still owes its screen check.
- Loading (PATH L1):
  - Done: the shell's first script is split (main window 6.38 → 2.80 MB), and panes draw their last reading at once.
  - Owed: Central's browser rows on last-reading-first (they show "Reading the Flows…" for 3–5 s on every return); reads that
    start a new owner process each time (start-up asks 50 ops in its first 4.5 s, 19 s of owner time,
    `run-20261020T-r28/kernel-trace.log`); the last reading across a relaunch.
  - A session on the first account began the resident readers on 20 Oct and was stopped. Look for its commits after
    `e3b37bd3a` and its notes in PATH's L1 row before starting. Its uncommitted change to
    `desktop/cradle/kernel/src/owner_process.rs` (130 lines, 20 Oct 10:15) is still in the env-1 tree.
- Quaternal Logic is installed at `74e9c8e`, which is its `main`.
- The device lane's designs are in the catalogue (`main` `b14b51b8f`; here `ce0edad3f` and `5e60d82d3`). Each binding names
  the keys no owner serves yet as absent, with the reason. O-I #684 lists the reading each needs: the M3 generation cell,
  the sky's day and hour rulers, the Body source for Torus and Resonance, the agent-set Join, the agent's team cell, and
  bindings for Light, Resonator bank, Binding and Voice.

## The work, in order

From MAP's build lane:

1. What PATH §7 says is owed: the screen checks, and L1's three owes.
2. Foundations (item 4) and loading (item 5), the resident readers first.
3. Reverse engineering into the product (item 3).
4. Technē's construction chain, end to end (item 6).
5. The owner operations drag and drop needs, then those the planning lane's action table finds missing (item 7).
6. The shell refinements (item 8).
7. The readings the device lane's designs wait on (O-I #684).

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
  - the resident readers in the kernel (process lifetimes, the owner's authority);
  - anything judged on the native screen (the die, display-first devices, the three layers);
  - candidate builds and screen passes;
  - design.

## Stays on the first account

- **The planning lane:** the manual and MAP, with the window and device rules above.
- **The pages lane:** the Day, Flow, Being and Thing templates, and the die.
- **The creatures and environs lane:** `Work/face-rig`.

Their work reaches the build through the manual, MAP and `dlw/build` commits, never through messages between sessions.
