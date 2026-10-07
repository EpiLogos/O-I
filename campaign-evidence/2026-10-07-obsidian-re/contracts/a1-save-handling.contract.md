# Behavior contract — A1: vault file save/handling (Obsidian 1.7.7)

Distilled from `findings/a1-file-save-handling.md` (evidence there). This is
the implementable-from-docs contract; the Rust rebuild answers to it through
`verification/gates/gate1-first-open.mjs` and `gate2-crash.mjs`.

## 1. Write semantics (as observed — compatibility surface)

- All note and config writes are **in-place** `writeFile`: truncate +
  overwrite, same inode, **no temp file, no rename, no fsync** (F2).
- All vault writes serialize through one promise queue; a hung op is rejected
  after ~60 s ("File system operation timed out") (F2).
- Writes may preserve metadata on request: mtime via `utimes`, birthtime via
  a native helper (F2). Plugins use this; a rebuild needs an equivalent.
- Deletion goes to OS trash (main-process call) or vault-local `.trash/` with
  collision-numbered names (`name 2.md`) per config (rebuild hints §9).

**Rebuild decision point (owner):** an O-I vault write that *chooses* atomic
tmp+rename gains durability but changes observable behavior (new inode per
write, transient temp entries visible to third-party watchers). Either choice
is allowed by this contract **if documented and consistent** — never mixed.

## 2. Save schedule

- Editor autosave: trailing debounce **~2 s** after the last edit.
- Immediate save on explicit save command and on leaving an editor leaf.
- On quit: flush every dirty editor, await the write queue; the shell grants
  ~3 s grace before destroying the window (F5).

## 3. Config plane

- Config dir `.obsidian` (renameable, must start with ".").
- First open creates **exactly**: `app.json` (`{}`), `appearance.json` (`{}`),
  `core-plugins.json` (28-key boolean map, documented defaults), `workspace.json`
  (default layout). Nothing else; a transient case-sensitivity probe file is
  created and deleted during open (F8). → **Gate 1 oracle.**
- `setConfig` rewrites **both** `app.json` and `appearance.json` on a **1 s
  extended debounce**; the key split is a fixed list (appearance keys:
  accentColor, theme, cssTheme, enabledCssSnippets, showViewHeader, nativeMenus,
  translucency, textFontFamily, interfaceFontFamily, monospaceFontFamily,
  baseFontSize, baseFontSizeAction; everything else → app.json).
- Every vault open re-normalizes and rewrites both files.
- All config JSON is 2-space pretty; malformed JSON on read = treated as
  absent and silently replaced on next save.
- Community enable state: `community-plugins.json` = ordered array of enabled
  ids (see A2 contract). Core enable state: `core-plugins.json` = `{id: bool}`.

## 4. workspace.json

- Written ~**1 s** after the last layout event (trailing debounce; never on
  an interval); holds splits, leaf ids/view states, active leaf, recent files.
- Write errors are swallowed (non-fatal). Graceful quit with no pending
  changes rewrites nothing. A crash loses the un-flushed debounce window.

## 5. External-change detection

- One recursive `fs.watch` on the vault root (FSEvents on macOS), covering
  `.obsidian`; reconcile by rounded mtime + size; deletions re-checked after
  ~100 ms (transient disappearance tolerance).
- Open editors auto-reload external modifications (~1 s); config files get a
  500 ms debounced mtime-compare reload.

## 6. Crash semantics

- **No journals, no WAL, no per-write backups.** A crash mid-write persists a
  torn file which the app loads as-is on next launch — there is no repair
  (F3). → **Gate 2 oracle** (torn file byte-identical, config JSONs valid,
  no tmp/backup anywhere).
- Config/workspace changes inside the debounce window are silently lost.
- Stale singleton lock files in userData are reclaimed at startup;
  per-window state is written only on graceful close (F7).

## 7. Self-update writer (the one atomic writer)

- Download → SHA-256 + RSA-SHA256 verify → gunzip → write `<name>.tmp` →
  atomic rename → activate **on next launch** (F9). Version pinning hazard:
  never relaunch study instances in a userData the updater has written to.

## Acceptance

`node verification/gates/gate1-first-open.mjs` (7 checks) and
`node verification/gates/gate2-crash.mjs` (6 checks) must pass unchanged for
any rebuild claiming this contract (round-trip rule in GATE-RESULTS.md).
