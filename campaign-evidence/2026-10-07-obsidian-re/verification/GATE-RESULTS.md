# Gate results — Obsidian 1.7.7 RE campaign (2026-10-07)

All four campaign gates **PASS** (38/38 checks). Run them:

```bash
cd Work/O-I/campaign-evidence/2026-10-07-obsidian-re/verification
for g in gates/gate*.mjs; do node "$g"; done
```

Each gate exits non-zero on any failed check. Raw outputs: `logs/*.log`.

## Round-trip rule — realized for A3 (2026-10-07)

The Rust clean-room parity suite (`desktop/cradle/kernel/tests/links_parity.rs`,
committed with the cradle) binds to the same fixture vault and the same
captured 1.7.7 oracle as gate 3 and enforces the same assertions on every
kernel CI run: resolved/unresolved maps, all 37 probes, backlinks, and the
exact 16-node / 19-edge adjacency, plus orphan/attachment toggle semantics.

Anything O-I rebuilds from this campaign (Rust clean-room) must pass **this
same suite** — the same fixture vaults, the same oracles, the same checks —
with no gate edits. Gates that compare trees/maps bind to the oracles under
`ProjectCentral/now/tmp/obsidian-re-20261007/lanes/`; if that scratch is
ever pruned, regenerate oracles from live Obsidian first (drivers and pinning
procedure: `lanes/a1/`, `lanes/a2/notes/cdp-drive.mjs`, `lanes/a3/run/`,
per `BRIEF.md` in the same tmp root) before running the gates.

Anything O-I rebuilds from this campaign (Rust clean-room) must pass **this
same suite** — the same fixture vaults, the same oracles, the same checks —
with no gate edits. Gates that compare trees/maps bind to the oracles under
`ProjectCentral/now/tmp/obsidian-re-20261007/lanes/`; if that scratch is
ever pruned, regenerate oracles from live Obsidian first (drivers and pinning
procedure: `lanes/a1/`, `lanes/a2/notes/cdp-drive.mjs`, `lanes/a3/run/`,
per `BRIEF.md` in the same tmp root) before running the gates.

## Oracle provenance & pinning

Oracles were captured from the **bundled 1.7.7** code of
`/Applications/Obsidian.app` in isolated runs: fresh scratch
`--user-data-dir` per run, `updateDisabled: true` preseeded, post-run check
that no `obsidian-*.asar` was downloaded. The auto-updater otherwise shadows
the bundled code on relaunch (it fetched 1.14.4 within ~60 s of any
unprotected launch), and the owner's daily profile already runs 1.13.7.
Findings pin to 1.7.7; version deltas are out of scope.

## Gate 1 — first-open fixture diff (7/7)

File: `gates/gate1-first-open.mjs`. Contract: `findings/a1-file-save-handling.md` F8.
The harness re-derives the first-open `.obsidian` tree from the dossier text
and compares against the live-captured `lanes/a1/fixtures/empty-vault/`.

- exactly four files (`app.json` `{}`, `appearance.json` `{}`,
  `core-plugins.json` 28-key defaults, `workspace.json` default layout);
- core-plugins defaults match the documented true/false set (key/value set;
  serialization order is not contract — noted, not normalized away silently);
- workspace.json matches the documented structural facts (widths, collapsed,
  active leaf, empty `lastOpenFiles`).

## Gate 2 — crash recovery (6/6)

File: `gates/gate2-crash.mjs`. Contract: F2/F3/F7. The harness reproduces the
documented write mechanics (`open('w')` truncate → partial write → SIGKILL)
and compares on-disk state classes against the live-captured
`lanes/a1/fixtures/crash-torn/`.

- torn file **byte-identical** to Obsidian's captured torn state (`REPLACEMEN`, 10 bytes);
- original content gone (in-place truncate, no deferred write);
- no tmp/bak/journal anywhere; all `.obsidian` JSON stays valid;
- the torn file is the on-disk truth — nothing repairs it.

## Gate 3 — graph parity (7/7)

File: `gates/gate3-graph-parity.mjs`. Contract: `findings/a3-graph-links.md` F1–F6.
A resolver + graph builder written **from the dossier rules alone** runs over
`lanes/a3/fixture-vault/` and is compared against the live 1.7.7 dump:

- `resolvedLinks` and `unresolvedLinks` maps identical (all 12 sources, occurrence counts);
- all 37 recorded `getFirstLinkpathDest` probes reproduce;
- backlinks (inverted resolved) match per destination with counts;
- default-option graph: **16 nodes**, and the edge set matches the live
  19-edge adjacency **exactly**.

Recorded normalizations (documented, not silent): map comparison canonicalizes
key order (Obsidian's index insertion order is creation-order, not contract);
probe replay distinguishes the pipeline (subpath stripped before resolution —
bare `[[#Section]]` resolves to self) from the raw `getFirstLinkpathDest`
(a `#…` linktext handed straight to it fails lookup — live-proven by the
`#Head → null` probe).

## Gate 4 — plugin contract (18/18)

File: `gates/gate4-plugin-contract.mjs`. Contract: `findings/a2-plugin-ecosystem.md` §1–§8.
Assertions over the probe-plugin dumps from three isolated pinned runs:

- `require("obsidian")` = exactly **122** symbols, `apiVersion === "1.7.7"`,
  27 load-bearing extension points present;
- restricted-mode mechanics: trust flag unset → manifests scanned → nothing
  loaded; enable order = `community-plugins.json` order (throws-plugin first);
- lifecycle: `onload` → `registerEvent` → `saveData/loadData`; styles canary;
  `onExternalSettingsChange` after external rewrite; disable → `onunload` →
  re-enable builds a fresh instance with `onUserEnable`;
- error isolation: `Plugin failure: <id>` surfaced, later plugins load, failed
  instance stays in the plugins map (documented 1.7.7 quirk);
- `data.json` is exactly `JSON.stringify(data, null, 2)` and round-trips;
  `core-plugins.json` is an `{id: boolean}` map; all runs pinning-CLEAN.

## Corrections made at convergence

- `findings/a3-graph-links.md` counts line corrected against its own oracle:
  **17 resolved pairs / 33 occurrences / 4 distinct unresolved keys** (was
  misquoted as 21/34/6). The dump, not the summary, is the oracle; gate D7
  now asserts the corrected numbers.
- No other lane claims conflicted; A1/A2/A3 corroborate each other on the
  write path (renderer `original-fs`, in-place, non-atomic), config debounces,
  and the trust gate.
