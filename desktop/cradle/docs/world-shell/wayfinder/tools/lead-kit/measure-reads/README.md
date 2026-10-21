# Measuring the shell's owner reads, before and after

Counts what start-up and a reload ask of the owners, on private stacks over the real ground, without a sealed candidate.

1. Export each revision without a worktree and link the seat's `node_modules`:
   `git archive <rev> desktop packages shared-field suite tests scripts | tar -x -C <scratch>/<name>`, then symlink
   `node_modules` in `packages/live-shell/ui`, `desktop/cradle` and `desktop/cradle/expressions-app`.
2. Build `walk-bridge` (`desktop/cradle/kernel`, `--bin walk-bridge`) and `live-shell` (`packages/live-shell`) with one
   `CARGO_TARGET_DIR` per tree.
3. `stack.sh start <tree> <target-dir> <stack-dir> <base-port>` starts the bridge (kernel trace on), live-shell and vite on
   base..base+3 with every owner pinned to the installed one; `stack.sh stop <stack-dir>` stops only those pids.
4. `node load.mjs http://localhost:<base+3>/app/ <stack-dir>/marks.txt 120 90` loads the shell headless, waits, reloads, waits,
   and marks each phase.
5. `python3 split.py <stack-dir>/trace.log <stack-dir>/marks.txt` counts owner processes, read-model hits/misses/joins and the
   commands behind them, per phase.

Run the two revisions back to back with the same installed owners, and keep git fetches and pushes in this repository out of
the run: they move the change watch. Compare process counts, not wall time, on a loaded machine. `load.mjs` takes Playwright
and chrome-headless-shell from this machine's paths; change them for another.

A read that should be retained can be probed alone: start one bridge, POST `/op`
`{"op":"now","project":null,"request":{"kind":"list"}}` twice, and the trace shows `miss` then `hit`. Every write that withdrew
the readings is named in the trace (`[owner] <ms> written <owner> <operation>`, `[read] <ms> *_<file:line> written`).
