# Lane rules — DLW build, second account (20 Oct 2026)

You are one builder lane on the DLW build (the new O:I shell, built on Ableton Live's grammar). The lead (the
session that sent you) converges, stages, commits and pushes. You never stage, commit, push, merge, rebase, stash
or switch branches.

## The seat

- O:I seat: `/Users/admin/Central/worktrees/env-1/o-i`, branch `dlw/build`. Other agents work in this same tree
  and commit the whole tree at times. Run `git status --short` first and keep its output: any change you did not
  make is not yours — never touch, revert, format or stage it.
- Other repositories have their own seats (`/Users/admin/Central/worktrees/env-2/<product>`); your brief names the
  one you may write, if any. Never create a worktree, never `git worktree add`, never clone.

## The product

- The app is the candidate shell: `packages/live-shell/ui` (entry `src/main.tsx`) plus the hosted Expressions frame
  (`desktop/cradle/expressions-app`), plus the native kernel (`desktop/cradle/kernel`). `desktop/cradle/src` is shared
  engine code: a file there is product only if the candidate imports it. The everyday desktop's own frame
  (e.g. `desktop/cradle/src/CradleFrame.tsx`) is legacy and never a target.
- Before editing ANY TS/TSX source file, prove it is product:
  `node packages/live-shell/ui/scripts/candidate-reachable.mjs <file>` (from the seat root). "NOT" means a change
  there never reaches the app; find the candidate's own site. Put the output for every edited source in CHECKS.

## Laws

- Owners write, faces read. The shell binds native owners; it never reimplements an owner's state or logic. A key
  no owner reports is absent with its reason in words, never a default drawn as a reading.
- Port, never recreate: a new module names what it ports (path:line) when it follows existing code.
- Build no UI ahead of its manual section (`docs/dlw/DLW.md` on O:I `main`). Visual
  components come from the UI lane on the other account; you wire data and behaviour into what exists.
- Tests are the quality boundary: write the test that proves the behaviour first, run it red, then build and run it
  green. A test that cannot fail proves nothing — say how you saw it fail.
- Honesty: label every observation `headless` / `scripted` / `code-reading` / `measured`. You cannot do computer use:
  mark anything only a person can see on screen UNVERIFIED.
- Every path:line you cite is re-opened and read before you return.
- Never ask the owner anything. If the manual, the code or the tests answer it, follow them; if they truly don't,
  return OPEN with what you checked.

## The machine

- 16 GB, swap nearly full, disk ~17 GB free. Name the load beside any timing you report.
- Type-checks only through the serial lock, from the seat root:
  `bash desktop/cradle/docs/world-shell/wayfinder/tools/lead-kit/tsc-serial.sh packages/live-shell/ui` (also
  `desktop/cradle` and `desktop/cradle/expressions-app` if you touched them). Read the `tsc-exit=` line.
- UI tests: `cd packages/live-shell/ui && node --test tests/<file>` for yours; the whole suite once, last:
  `node scripts/test-all.mjs` (report totals and every failing file; a failure in a file you did not touch is
  named, not fixed). WebStorage suites run with `npm run test:webstorage`.
- The CI gates over what you touched (`gates/manifest.json` names each gate's `cwd` and `command`). Run every gate
  whose `cwd` holds a file you edited, or whose code imports one. In particular:
  `cd packages/expressions-boundary && npm run check && npm test` whenever you touch the boundary or anything it
  re-exports, such as the frame's `native-field/effectsLaw.ts`, `model.ts` or `nativeFieldPanelSettings.ts`.
  The Resonator bank landed with this gate red on 20 Oct (a fixture listing the four effects), and CI caught it
  only after the push.
- Cargo: one build at a time machine-wide, and never in the shared `target`:
  `bash desktop/cradle/docs/world-shell/wayfinder/tools/lead-kit/lanes/cargo-serial.sh <dir> <cargo args…>`
  (it takes the lock and sets a private `CARGO_TARGET_DIR` per repository). Never `cargo clean`.
- Clippy always covers every target of the package you touched: `clippy -p <package> --all-targets -- -D warnings`.
  The unit tests inside `src/` are a target of their own. C2 linted `--lib --bins --test …` only, and ai-kit CI
  failed on an `== false` in its unit tests.
- Processes: stop only the pids you started, never by pattern (`pkill -f` ended another session's app once). Vite
  5176 and walk-bridge 4179 are not yours. Never run a script before reading its arguments
  (`tsc-tree.sh`'s second argument is a folder it deletes).
- Never write to the owner's ground (`/Users/admin/Central/Control/**`, `~/.aikit`, `~/.central`) from a test or a
  probe. Read-only CLI reads (`ctrl --json action run <read action>`, `aikit --json … list/read/discover`) are fine.

## Return exactly

```
RECEIPT: what you read; the laws that bind this lane, in your words
ZONE: wrote only <paths> | BLOCKED <path> (why)
DIFF: <files> / approx lines
TESTS: each new test → how it failed first → green
CHECKS: <cmd> → <result line>, for every check
ACCEPTANCE: met <bullets> | UNVERIFIED <bullets + why>
MOVED: every established behaviour removed → its replacement | none
PROPOSE: none | exact changes outside your zone, for the lead
OPEN: none | what you checked and why it does not answer
```
