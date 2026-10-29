# Walk 739 — what was prepared (28 Oct 2026)

Stage one of O-I #739: the candidate, the worlds and Yours's recorded state, ready for the on-screen walk in
`CHECKLIST.md`. Channel for everything here: scripted (shell), except the one window capture named under Smoke.

## The candidate

- **Source:** O-I main `a74803a094425e22384b717d1ff330f076827b2d` (merge of #818: #738's worlds and Setup), seat env-1,
  branch `dlw/walk-739`, clean tree. Host marker: `source_revision` a74803a09, `source_dirty: false`; native checkout drift:
  none (`changed_files: []`).
- **Built with** `packages/live-shell/run-native-at-head.sh build`, backing `full-suite`, into a private target:
  `P0R1_TARGET=$HOME/.cache/oi-build-lane-739-target P0R1_STAMP=20261028T231512Z P0R1_QL_EXPORT=<scratch>/ql-inputs-20261028/ql-sky P0R1_QL_INPUTS=<scratch>/ql-inputs-20261028/inputs`.
  Steps 1–5 exit 0, 23:15–23:35 UTC. The run's own logs: `../evidence/p0-r1/run-20261028T231512Z/`.
- **Binary:** `$HOME/.cache/oi-build-lane-739-target/p0-r1/20261028T231512Z/run/oi-desktop-bundle/app/O-I Shell Candidate.app/Contents/MacOS/oi-cradle`
  (the sealed bundle, `codesign --verify --strict` exit 0). Not installed; `~/Applications/O-I Shell Candidate.app` (8 Oct,
  same bundle id) is untouched and must never be opened.
- **Launch, per world** (from the seat; the script records the pid and exit code):

  ```sh
  export P0R1_TARGET="$HOME/.cache/oi-build-lane-739-target" P0R1_STAMP=20261028T231512Z
  P0R1_WORLD="$HOME/DLW Worlds/Bare"     bash packages/live-shell/run-native-at-head.sh launch
  P0R1_WORLD="$HOME/DLW Worlds/Arriving" bash packages/live-shell/run-native-at-head.sh launch
  P0R1_WORLD="$HOME"                     bash packages/live-shell/run-native-at-head.sh launch   # Yours
  bash packages/live-shell/run-native-at-head.sh quit
  ```

- **Owners frozen into it** (from the owner's active managed receipt): central `575de6b0f51f`, actuation `76ecb6c1aead`,
  ai-kit `8c3571876046`, software-factory `ab7b4d3067b3`, workcell `1c07c8229010`, quaternal-logic `b87dfee08a57`
  (dirty: QL's checkout carries two untracked NOW files; the freeze gate allows it).
- **QL's export was stale, and was refreshed through QL's own tool.** The freeze's own check (`ql_export()` of
  `freeze-product-bindings.py`) refused both recorded input sets: 20261008 "QL export artifact digest/size mismatch",
  20261014 "QL export source input changed: …/fixtures/kernel/m2-retained-c-v1.json" (QL #356 moved it). QL's primary
  checkout was clean and behind origin/main by #356 only; it was fast-forwarded to `b87dfee`, and
  `scripts/export-sky.py --output <scratch>/ql-inputs-20261028/ql-sky --receipt <scratch>/ql-inputs-20261028/inputs/ql-export-receipt.json --installed-uv ''`
  made the export without touching QL's target; the other four QL inputs were copied unchanged from the 20261014 set. A
  dry freeze against today's earlier CLI build passed before the build was started. The receipt the build froze is
  `ql-export-receipt-20261028.json` here.
- **Not in this candidate:** `dlw/build-lane`'s three commits after a74803a09 — #763 (db5738c8a, 6d8ef5560) and #738's
  Skillset-rack follow-up (c5f7cb58b).

## The worlds

- Made with `packages/live-shell/starting-worlds.py --root "$HOME/DLW Worlds" make bare` and `make arriving`, then
  `register Bare` and `register Arriving`: `~/DLW Worlds/Bare` (empty) and `~/DLW Worlds/Arriving` (84 files: two git
  repositories with agent instructions, `.claude/` with two skills, Notes, two .wav, an Ableton set, an Obsidian vault).
- The register `~/.config/oi-shell-candidate/worlds.json` names both; its `current` is null, so a launch with no world
  named opens Yours.
- Bare was reset after the smoke launch (`reset Bare`, 23:37 UTC), so the walk's first run starts from an empty folder.
  The webview store a world keeps is keyed by its folder's path (`world_folder.rs` `store_identifier`) and lives outside
  the folder, so the smoke launch's page storage for Bare survives the reset; the smoke touched nothing in the window.

## Yours

- **As found** (`yours-as-found.json`, 23:16 UTC): the candidate's `full-suite` workspace book had 32 history entries,
  newest 22 Oct; the `0-1-2` book 10 entries, newest 28 Oct 08:33. Product homes: `~/.aikit` 16 058 files, `~/.oi` 291,
  `~/.config/oi` 12, `~/.central` 635 (counts, mtimes and digests only; no content).
- **Carried over** before any full-suite launch in Yours, nothing deleted:
  - `~/Library/Application Support/OI-Shell-Candidate/full-suite/workspace-book` renamed to `workspace-book.before-739`;
    the `0-1-2` workspace book copied in its place (`diff -r` identical).
  - `~/.config/oi-shell-candidate/full-suite/composition.json` copied to `composition.json.before-739`; its `owner_home`
    set to the `0-1-2` value (`…/OI-Shell-Candidate-Acceptance/core-independent-20261008/expression-home`); every other
    key unchanged. `personal_ground` was already the same in both.
  - Left as they were: the profile's `desktop/` (slow-ops logs, retained readings), `catalogue.json` and `hosted/`.
- **Baselines:** `yours-baseline-after-carry-over.json` (after the carry-over) and `yours-walk-baseline.json` (after the
  registration and the smoke; the one the walk's Y1 compares with). The recorder is
  `<scratch>/yours-state.py LABEL OUTDIR [--since EPOCH]`; it reads only.

## Smoke (no interaction)

- Launched into Bare by the script (pid 50966, 23:36:02 UTC). Within 15 s the world's homes stood under Bare: `.aikit`,
  `.actuation`, `.workcell`, `.config/oi-shell-candidate/full-suite` (composition, catalogue) and
  `Library/Application Support/OI-Shell-Candidate/full-suite`.
- The window (captured by window id only, `captures/smoke-bare-first-open.png` in scratch): Settings stands over Central on
  its Setup page, "SETUP 0 of 5 accepted", steps Ground · Harnesses and skills · Credentials · Machines · Projects; Ground
  found "A new ground" at `/Users/admin/DLW Worlds/Bare/…` with Accept; the head reads "Choose the native personal ground
  to open its work." The Ground step offers no folder chooser or name (§10.11 says it should); see CHECKLIST A2.
- Yours while it ran and after: the full-suite workspace book, its composition and the worlds register byte-identical
  to the baseline; `~/.oi`, `~/.config/oi`, `~/.central` unchanged; `~/.aikit` changed in 10 files (AIKit's gateway,
  routine dispatcher, encounter executor, and a session continuity turn: the owner's running daemons and this session),
  none naming a world folder; at the moment of the check the candidate had no child processes.
- Quit through the app menu by pid (`run-native-at-head.sh quit`): "clicked: Quit O-I Shell Candidate", host exit code 0.
