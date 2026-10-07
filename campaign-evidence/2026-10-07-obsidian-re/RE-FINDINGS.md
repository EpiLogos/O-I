# RE findings — Obsidian 1.7.7 → O-I cradle (campaign index)

Campaign: 2026-10-07 · Owner-commissioned reverse-engineering investigation.
Target: `/Applications/Obsidian.app`, pinned **Obsidian 1.7.7**
(CFBundleVersion 0.14.8), legitimately possessed. Purpose: clean-room rebuild
of three feature families into the O-I cradle (Tauri 2 + React, Rust kernel).
**Rebuild language: Rust** (owner direction, 2026-10-07).

Method: `reverse-engineering-playbook` loop (decompile → understand →
recreate), four parallel lanes under `central-parallel-execution`, one
converging record (this campaign). Guardrails held: study/document only; no
Obsidian code or assets moved into any product tree; decompiled output exists
only as small quoted evidence snippets with byte offsets inside
`findings/`; every claim carries evidence + confidence + limitations.

## Documents

| Document | What it holds |
|---|---|
| `findings/a1-file-save-handling.md` | Vault write path, atomicity, config/workspace lifecycle, watcher, crash forensics (9 findings F1–F9) |
| `findings/a2-plugin-ecosystem.md` | Manifest, load, restricted mode, lifecycle, 122-symbol API surface, data.json (8 sections) |
| `findings/a3-graph-links.md` | Link syntax, resolution rule chain, cache shapes, graph/local-graph semantics (7 findings) |
| `integration-map.md` | Where each family lands in the cradle, what exists, what's missing, hazards (Lane B) |
| `contracts/a1-save-handling.contract.md` | Implementable save/handling contract → gates 1–2 |
| `contracts/a2-plugin.contract.md` | Plugin contract + O-I contribution-system design constraint → gate 4 |
| `contracts/a3-graph.contract.md` | Resolution + graph contract → gate 3 |
| `verification/GATE-RESULTS.md` | The four testing gates: 38/38 checks passing, oracle provenance, round-trip rule |
| `recreation-backlog.md` | Rust recreation tasks with per-task verify gates |

## Headline findings

1. **There is no write bridge.** The renderer has `nodeIntegration` and vault
   IO runs **in the renderer** via `window.require("original-fs")`; the main
   process's only fs writes are userData bookkeeping, print-to-PDF and trash
   (A1 F1, proven live: writes continue after the main process is killed).
2. **Obsidian's vault writes are non-atomic and unrepaired.** In-place
   truncate+overwrite, no temp/rename/fsync; a kill mid-write persists a torn
   file that the app loads as-is on relaunch. The ONLY atomic writer in the
   app is the self-updater (`tmp` → `rename`, signature-verified) (A1 F2/F3/F9).
   Debounced config/workspace writes (1 s) are real crash-loss windows.
3. **First open writes exactly four `.obsidian` files** — the acceptance
   fixture (A1 F8; gate 1).
4. **The plugin contract is permissive and eval-based**: manifests need only
   a truthy `id`; plugin code is `window.eval`'d CommonJS served a fixed
   122-symbol `obsidian` module map; community load is strictly sequential in
   `community-plugins.json` order behind a per-vault localStorage trust gate;
   error isolation keeps a failed instance registered; `onunload` is not
   guaranteed at app quit (A2 §1–§6).
5. **Link resolution is a fully pinned 11-step chain** — case-insensitive
   basename multimap with `.md` defaulting, relative-form joins, exact-path
   beating same-folder preference, shortest-path ambiguity fallback; aliases
   never resolve; unresolved keys collapse subpaths and optional `.md`.
   Graph = md files + phantom unresolved nodes, unique-pair edges, self-loops
   kept, orphans shown by default (A3 F4–F6). A from-the-docs-only script
   reproduces the live dump and all 37 resolution probes exactly (gate 3).
6. **Version pinning hazard (operational):** the auto-updater drops
   `obsidian-<newer>.asar` into userData and shadows the bundled code on
   next launch (~60 s after any unprotected launch). The owner's daily
   profile already runs 1.13.7 this way; all campaign findings pin to the
   bundled 1.7.7, with every dynamic run on fresh scratch userData +
   `updateDisabled:true`, verified clean post-run.

## Convergence corrections

- A3's summary counts were corrected against its own oracle: **17 resolved
  pairs / 33 link occurrences / 4 distinct unresolved keys** (was misquoted
  21/34/6). Gate D7 asserts the corrected numbers.
- No other cross-lane conflicts; A1/A2/A3 corroborate on the write path,
  debounces, and the trust gate.

## Tooling limitations (named, not hidden)

- `rea analyze-javascript-application` cannot process the ~3 MB minified
  renderer bundle (asar-mode: `artifact_integrity_mismatch` on a re-signed
  native module in the shell; renderer runs: `unreadable_output` schema
  rejection — retried, reproducible). All static evidence is grep +
  byte-window reads of the extracted asars; `app-asar-dir.analysis.json`
  (32 MB evidence graph over the updater shell) is the one good shared bundle.
- No syscall-level attribution (`fs_usage` needs root); process attribution
  is architectural + behavioral (surviving-renderer writes).

## What stayed unverified (per lane, consolidated)

- A1: syscall trace of the write path; dynamic exercise of hotkeys /
  community-plugins / plugin `data.json` writes; file-recovery snapshot
  storage; `obsidian.json` torn-write behavior; occlusion throttling regime
  (measured once, ~10 s stretch).
- A2: vault-switch plugin teardown path; trust-modal click-through (the same
  `setEnable(true)` call was driven via CDP); live registry fetch/install
  end-to-end; `emulate-mobile` require blocking; mobile/Capacitor paths;
  exact styles.css-vs-first-paint timing.
- A3: local graph dynamics (static reading, medium-high confidence); search/
  group query grammar details; stale-subpath navigation UX; cause of run 1's
  silent exit ~90 s after an update download; basename multimap tie-break at
  equal path length; anything about 1.13.7/1.14.4 behavior.
- Campaign-level: behavioral deltas between pinned 1.7.7 and the owner's
  daily 1.13.7 are unmeasured by design; the four gates bind to 1.7.7.

## Compliance record

No writes to `/Applications/Obsidian.app`, owner vaults, or real userData
(mtime-scan verified by lanes A1/A3). Only lane-launched PIDs were killed.
Recovered code appears only as short evidence snippets with offsets, inside
this campaign directory. Scratch (fixtures, userdata, drivers, transcripts)
lives under `ProjectCentral/now/tmp/obsidian-re-20261007/` and is cited only
through the durable documents above.
