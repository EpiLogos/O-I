# A1 — Vault file persistence in Obsidian 1.7.7 (write path, config lifecycle, crash behavior)

Lane: A1 · Date: 2026-10-07 · Target: `/Applications/Obsidian.app` Obsidian **1.7.7**
(CFBundleShortVersionString 1.7.7, CFBundleVersion 0.14.8), bundled `obsidian.asar`.
All dynamic runs pinned per campaign BRIEF (see "Pinning caveat" below).

---

## Scope & method

**Question:** how does Obsidian 1.7.7 write to the vault — save-path mechanics and
atomicity, `.obsidian` config lifecycle, external-change detection, kill -9
crash behavior, first-open fixture, updater write pattern.

**Method.** Static analysis of `shared/obsidian-asar-extracted/` (real app:
`main.js` = Electron main process, `app.js` = renderer bundle) and
`shared/app-asar-extracted/` (updater shell). Both files are single-line
minified; locations are cited as **byte offsets** in the extracted files.
The shared REA bulk analyses of obsidian.asar failed (empty output; my own
rerun also failed with `artifact_operation_failed/io` on the 3 MB minified
`app.js`), so all static evidence is grep + byte-window reads (`dd`) of the
extracted sources, plus targeted dynamic confirmation.

**Dynamic rig** (all scratch under `lanes/a1/`, per BRIEF):
- Launch: `/Applications/Obsidian.app/Contents/MacOS/Obsidian
  --user-data-dir=<lane>/userdata/<run> --remote-debugging-port=<rare port>
  <vault>`. The positional `<vault>` argument is **ignored** by 1.7.7's shell
  (its argv scan only looks for `obsidian://` URLs); the working method is to
  seed `<userdata>/obsidian.json` with a vault registry entry before launch:
  `{"updateDisabled":true,"vaults":{"<16hex>":{"path":...,"ts":...,"open":true}}}`.
  `--user-data-dir` works; `--remote-debugging-port` works but must be an
  unusual port (a "standard" 9223 was occupied by an unrelated process and the
  app binds nothing).
- Renderer driven over CDP (`lanes/a1/cdp-eval.mjs`); disk observed by a 30 ms
  stat-poller (`lanes/a1/poller.py`) recording size/mtime_ns/birthtime/inode
  diffs, plus pre/post `stat` tree snapshots.
- Kill tests: `kill -9` only PIDs launched by this lane; renderer killed first,
  then main, to avoid post-crash writes by survivors.

**Pinning caveat.** The shell's auto-updater downloads `obsidian-<ver>.asar`
into the *userData* and loads it **on next launch**. In run 1 (without
protection) it fetched `obsidian-1.14.4.asar` ~4 s after first launch
(`lanes/a1/transcripts/launch1.stdout.log`). All subsequent runs seeded
`"updateDisabled": true`; verified 0 `obsidian-*.asar` files in every scratch
userData afterwards. Running-instance identity was confirmed per-run: loader
log `Loading main app package /Applications/Obsidian.app/Contents/Resources/obsidian.asar`
and CDP page title `Obsidian v1.7.7`. **Delta risk:** findings pin to 1.7.7
bundled code; a relaunch in a used userData would run newer code, and the
owner's daily app (userData `~/Library/Application Support/obsidian/`) already
runs 1.13.7 — behaviors may have changed there.

---

## Findings

### F1. The write "bridge" is no bridge: vault IO runs in the renderer process
**Behavior.** There are no `ipcMain` handlers for vault file data. The renderer
is created with `nodeIntegration:true` (`obsidian-asar-extracted/main.js`
webPreferences in window factory `K`, byte ~line 8 of the minified file) and
its file-system adapter uses `window.require("original-fs")` directly
(`app.js` offset 532391–533054: `this.fs=window.require("original-fs"),
this.fsPromises=this.fs.promises … this.ipcRenderer=t.ipcRenderer …
try{this.btime=window.require("btime")}catch(e){}`).
`@electron/remote` is enabled by the shell (`i.remote.enable(webContents)`,
main.js `be()` helper) but in `app.js` it is used only for window management
(`getCurrentWindow`, `systemPreferences`, `app.quit`; `app.js` offset
1664750–1666150, function `MN`). Live check over CDP on the 1.7.7 instance:
`require('fs').promises.writeFile` is functional **in the renderer**,
`adapter.fsPromises.writeFile` is Node's native implementation, `btime`
loaded. The only fs work done in the main process is: global config
`<userData>/obsidian.json` and per-window `<vault-id>.json` state (direct
`writeFileSync`, main.js helper `I(e,o)=U(()=>m.writeFileSync(L(e),JSON.stringify(o)))`,
`L(e)=join(userData,e+".json")`), print-to-PDF, icon file, adblock list
cache, and `trash` → `shell.trashItem`.

**Evidence:** static offsets above; CDP eval transcript (F1 probe, session
43117); confirmed indirectly by crash tests — after the main process was
killed mid-burst, vault writes continued from the surviving renderer (see F6
note and `transcripts/crash-1.log`).

**Confidence:** high. **Limitations:** no syscall trace (fs_usage needs root,
not available); process attribution is architectural + behavioral, not a
`fs_usage` PID log.

### F2. Note save = debounced direct in-place overwrite; no temp file, no rename, no fsync
**Behavior.** Editing path: MarkdownView constructor arms
`requestSave=Xl(this.save.bind(this),2000)` (2 s trailing debounce, `app.js`
offset ~1901204); every edit marks dirty and re-arms. Cmd+S is the command
`editor:save-file` → `view.save()` immediately (offset ~2142291). Switching
away from a leaf saves immediately (`onUnloadFile → save(!0)`, offset
~1901500). `save()` waits for the adapter queue then calls `vault.modify(file,data)`
(offset ~1902400). `vault.modify` → `adapter.write(path,data,opts)` (offset
~740300). `adapter.write` is **`fsPromises.writeFile(fullPath, data, "utf8")`
in place** (offset ~536901) — truncate-and-overwrite, same inode, no
`obsidian.asar.tmp`-style staging (no `.tmp` string exists anywhere in
`app.js`), no fsync flag. Binary variant `writeBinary` (offset ~537365) and
`append` (offset ~537838) are likewise direct.
After writing, `applyWriteOptions` (offset ~539050) applies
`opts.ctime` via the native `btime.btime(path, ms)` module and `opts.mtime`
via `fsPromises.utimes(path, s, s)`; `opts.immediate` callback updates the
in-memory cache. On save failure the view backs the text up through the
file-recovery core plugin (`storeTextFileBackup` → `forceAdd`, offsets
1902900 / 1333502).

**Observed.** Poller transcript `transcripts/d2c-save-poller.jsonl`:
`Note A.md` changed with **inode unchanged** (old_ino == new_ino) and
size 57→56 — in-place modify. Autosave latency sampled in-renderer: clean at
~2.1 s after last edit in active-window runs (two independent runs: state
flip between t=1872→2127 ms and t=1837→2139 ms).
All vault writes are serialized through a promise queue
(`adapter.queue`, offset ~550400) with a 60 s hang-kill that rejects the
pending op with "File system operation timed out." (offset ~550050).

**Confidence:** high. **Limitations:** fsync absence is established from the
absence of any fsync/open-with-flags code on the write path and cannot be
positively disproven without syscall tracing.

### F3. A crash mid-write leaves a torn file permanently; nothing repairs it
**Behavior (instrumented experiment, `lanes/a1/torn-run.sh`, transcript
`transcripts/crash-torn.log`).** Renderer's `fsPromises.writeFile` was patched
in-page to reproduce writeFile's real syscall sequence — `open(path,'w')`
(truncates) → write first 10 bytes → hang — then `kill -9` (renderer first,
then main) during the hang. Result on disk: `torn.md` = **10 bytes
`REPLACEMEN`** — original content gone, new content partial. Recovery
relaunch (fresh userData, same vault): Obsidian loads the 10-byte file as
the note's content; stat untouched; **no tmp files, no backup restore, no
repair of any kind**. All `.obsidian/*.json` remained valid.
Uninstrumented burst kill (`transcripts/crash-4.log`, valid section):
kill between writes → file always a complete payload, all config JSON valid,
no tmp/leftover files anywhere in the vault.

**Confidence:** high for "writes are non-atomic and unrepaired"; the torn
state was produced by emulating writeFile's exact syscall order rather than
by racing a natural kill (natural 1–8 MB writes complete in <30 ms, too fast
to race reliably). **Limitations:** disk cache means a power-loss (not just
SIGKILL) could tear at different boundaries; not tested.

### F4. `.obsidian` config lifecycle — what exists, what triggers each write
**Files on first open:** exactly `app.json`, `appearance.json`,
`core-plugins.json`, `workspace.json` (see F8). Later, on demand:
`hotkeys.json`, `community-plugins.json`, `plugins/<id>/data.json`,
`themes/…`, `snippets/…`. `configDir` is `".obsidian"` (`app.js` offset
728335, `Cb=".obsidian"`; renameable via `setConfigDir` but validated to
start with ".").

**Writers (all funnel through one primitive).** `writeJson` (offset ~733300)
= `adapter.write(path, JSON.stringify(data, null, 2))` — pretty-printed,
in-place, non-atomic (F2). Config-file taxonomy per the sync filter (offsets
2812768–2813003): `app.json`+`types.json`, `appearance.json`, `hotkeys.json`,
`core-plugins.json`+`core-plugins-migration.json`, `community-plugins.json`,
`themes/*/{theme.css,manifest.json}`, `snippets/*.css`,
`plugins/<id>/…`, other top-level `*.json` = core-plugin data.

**Triggers:**
- `setConfig(key,val)` → `requestSaveConfig` = **`Xl(saveConfig, 1000,
  leading)`** (offset ~730043): a 1 s debounce whose timer *extends* under
  repeated calls. `saveConfig` (offset ~731700) **rewrites both `app.json`
  and `appearance.json` every time**, splitting keys by the fixed list `ub`
  (offset 725221: accentColor, theme, cssTheme, enabledCssSnippets,
  showViewHeader, nativeMenus, translucency, textFontFamily,
  interfaceFontFamily, monospaceFontFamily, baseFontSize,
  baseFontSizeAction → appearance.json; everything else → app.json).
- **Every vault open normalizes config:** `setupConfig` (offset ~731000)
  mkdirs `.obsidian` if missing, reads app+appearance, migrates one legacy
  key (`editorFontFamily`→`textFontFamily`), then calls `requestSaveConfig`
  — i.e. both files are rewritten shortly after every open (observed: mtime
  bumps on recovery relaunches; `appearance.json` rewritten even when its
  content is unchanged — `d2c` transcript).
- Hotkey edit → `writeConfigJson("hotkeys", …)` (offset ~1230400); external
  hotkeys.json edits are picked up via a vault `raw` event listener (offset
  ~1230110). Core plugin toggle → `writeConfigJson("core-plugins", …)`
  (offset ~2222400). Community plugin enable/disable →
  `writeConfigJson("community-plugins", …)` (offset ~2209350). Plugin
  `saveData` → `writeConfigJson(pluginId, data, {mtime})` →
  `plugins/<id>/data.json` (offset ~2218900).
- External change of app/appearance.json: `reloadConfig` (offset ~730109),
  500 ms debounce, compares mtimes against an in-memory `configTs` and
  re-reads + diffs, triggering `config-changed`.
- Malformed JSON on read: logged (`"failed to read JSON"`) and treated as
  absent (readJson → undefined) — the next save silently replaces it.

**Observed:** `d2c` transcript — one `setConfig` call produced writes of
app.json (2→26 B, `{"focusNewTab": false}`) AND appearance.json (content
identical, mtime bumped) at the same tick. In a killed-process run
(`crash-4.log`), setConfig calls made <1 s before the kill were **lost**
(app.json still `{}` post-kill): the debounce is a real loss window.
Under an occluded window, Chromium timer throttling stretched the 1 s/2 s
debounces to ~10 s (writes fired bunched, in trigger order:
app/appearance → workspace → note). Timing is not a contract.

**Confidence:** high. **Limitations:** hotkeys/community-plugin writes not
dynamically exercised (static confidence only); occlusion throttling measured
roughly (n=1).

### F5. workspace.json — written ~1 s after layout changes, never on an interval
**Behavior.** `requestSaveLayout = Xl(this.saveLayout.bind(this),1000)`
(trailing debounce 1 s, offset 2133462). `saveLayout` (offset ~2165922):
gated on `layoutReady`; serializes main/left/right splits, left-ribbon,
active leaf id, plus `lastOpenFiles` from the recent-files tracker; writes
`adapter.write(configDir+"/workspace.json", JSON.stringify(layout,null,2))`
(`workspace-mobile.json` on mobile); **errors swallowed**. Triggers seen in
code: any `layout-change` (leaf open/close/move), file open/close (recent
tracker `collect` → requestSaveLayout, offset ~2131400), view state changes
(e.g. search sort), window resize (50 ms debounce, offset ~2129250). There is
**no interval write**; on graceful quit the dirty-editor flush runs
(`workspace.on("quit")` saves every view with `data!==lastSavedData` and
awaits `adapter.promise`, offset ~2141436) and the main process gives the
window 3 s before force-destroying it (main.js close handler
`setTimeout(… destroy(), 3e3)`), but a quit with no pending changes does not
rewrite workspace.json (observed: vault tree byte-identical across graceful
quit, `transcripts/quit-before/after.txt`).
**Killed process:** whatever the 1 s debounce had not flushed is lost; the
file on disk is always the last *complete* write (JSON valid in every crash
catalog). Observed debounce stretches under window-occlusion throttling mean
the real loss window can exceed 1 s.

**Confidence:** high. **Limitations:** full enumeration of layout-change
trigger sites not exhaustively catalogued (representative sites cited).

### F6. External-change detection: recursive fs.watch (FSEvents on macOS), mtime+size reconcile
**Behavior.** `startWatchPath` (offset ~544850):
`this.fs.watch(dir, {persistent:false, encoding:"utf8", recursive:Kc})` where
`Kc = (platform==='darwin'||'win32')` — on macOS this is FSEvents-backed and
**one recursive watch on the vault root covers everything, including
`.obsidian`** (`watchHiddenRecursive` is an explicit no-op on desktop
platforms, offset ~543989; Linux instead adds per-directory watches incl.
hidden dirs). Change callback → `onFileChange` → `setTimeout(0)` →
`reconcileFile` (offset ~545500): lstat; files reconciled by comparing
`Math.round(mtimeMs)` and `size` against the cache → `modified` only if
changed; deletions reconciled immediately or re-checked after 100 ms
(`reconcileDeletion`, offset ~548300); watcher `error` falls back to a full
reconcile of that path.

**Observed (live instance):** externally `touch`-class edits (shell appends)
to an open note produced vault `raw` events and the **open editor auto-reloaded**
the new content within ~1 s; `vault.on('modify')` fired (~1 s). External file
create → vault `create` event in 660 ms; external delete → `delete` in
789 ms (session 43117 event log). External new file appeared in the file
explorer. NOT picked up as special: none observed — `.obsidian` json changes
are also watched (hotkeys reload; app/appearance via reloadConfig).

**Confidence:** high. **Limitations:** exact FSEvent coalescing latency under
load not characterized; behavior when the vault is on a network volume not
tested.

### F7. kill -9 forensics: what a crash leaves behind
**Behavior (fresh userData per run; renderer killed before main).**
In the **vault**: no tmp/bak/swp files in any run (5 crash catalogs); content
files either fully-old or fully-new or torn (F3); config JSONs always valid
on disk; un-flushed debounced changes (config/workspace ≤ debounce window)
silently lost. In the **userData**: `SingletonLock`/`SingletonSocket`/
`SingletonCookie` **left behind** (cleaned only by graceful quit — compare
`userdata/crash-*` vs `userdata/u2`); the per-window state file
`<vault-id>.json` (bounds/maximized/zoom — written by the main-process close
handler via `I(e,l)`) is **never written** on kill; global `obsidian.json`
(vault registry, written non-atomically by main via `writeFileSync`) is not
updated. On recovery relaunch: stale singleton locks are handled by Electron;
the app re-reads the vault normally, re-runs first-open config normalization
(rewrites app/appearance/core-plugins with fresh mtimes, keeps workspace.json
content) and does not touch content files (observed: `crash-torn` recovery
left `torn.md` byte-identical; `crash-4` recovery left `burst.md`
byte-identical).
**Process note:** killing only the main process leaves the renderer alive
for seconds, still issuing vault writes (`crash-1`/`crash-3` logs) — the
renderer is the writing process (corroborates F1). Valid runs killed the
renderer first.

**Confidence:** high. **Limitations:** power-loss/FS-level tearing not
tested; `obsidian.json` torn-write behavior under kill not crash-tested.

### F8. First-open fixture — exactly what 1.7.7 creates in a fresh vault
**Observed twice** (non-empty vault and a completely empty vault;
`transcripts/empty-launch.log`, session 43401): after first open `.obsidian/`
contains **exactly four files** (plus the transient case-sensitivity probe
`.OBSIDIANTEST`, written+deleted during open — static evidence
`testInsensitive`, offset ~532900; too brief to catch on disk):
- `app.json` — `{}` (2 bytes)
- `appearance.json` — `{}` (2 bytes)
- `core-plugins.json` — 637 bytes, 2-space JSON, 28 keys, defaults:
  true for file-explorer, global-search, switcher, graph, backlink, canvas,
  outgoing-link, tag-pane, page-preview, daily-notes, templates,
  note-composer, command-palette, editor-status, bookmarks, outline,
  word-count, file-recovery; false for properties, slash-command,
  markdown-importer, zk-prefixer, random-note, slides, audio-recorder,
  workspaces, publish, sync.
- `workspace.json` — ~4010 bytes default layout: `main` = one tabs split with
  one `empty` leaf (active), `left` = file-explorer + search + bookmarks
  (width 300), `right` = backlink + outgoing-link + tag + outline (width 300,
  collapsed), `left-ribbon.hiddenItems` for 6 core actions, `active` leaf id,
  `lastOpenFiles: []`. Leaf/split ids are random hex per install.
- **Absent:** `hotkeys.json`, `community-plugins.json`, `.trash/`,
  plugins dir.
After graceful quit of the first-open session the tree is unchanged.

**Confidence:** high (n=2 fresh vaults, byte-level catalogs in transcript).

### F9. (bonus) App self-update write pattern — the one atomic writer
`app-asar-extracted/main.js:238-249`: the shell updater verifies the
downloaded `.asar.gz` with **SHA-256 + RSA-SHA256 signature**, gunzips, then
`writeFile(<userData>/obsidian.asar.tmp)` → `fs.promises.rename(tmp, final)`.
Write-tmp-then-rename (atomic on same volume) — in contrast to every vault/
config write (F2/F4). The new asar is loaded only on next launch, which is
exactly the pinning hazard described above.

---

## Observed transcripts & fixtures (lanes/a1/)

- `transcripts/launch1.stdout.log` — 1.7.7 load line + unthrottled updater
  download of obsidian-1.14.4.asar (~4 s).
- `transcripts/d2c-save-poller.jsonl` — 30 ms poller: in-place same-inode
  note write; config-pair rewrite; workspace.json write; debounce bunching
  under window occlusion.
- `transcripts/crash-torn.log` — torn-write experiment + recovery catalog.
- `transcripts/crash-4.log` (section `mainpid=25866…`) — valid burst-kill
  catalog + recovery diff (the earlier sections of crash-1/3/4 logs are from
  harness builds with a PID-parsing bug — main never killed — and are
  superseded; kept for the orphan-renderer observation only).
- `transcripts/quit-before.txt|quit-after.txt`,
  `quit-userdata-before/after.txt` — graceful quit no-op on vault; window
  state + registry updates in userData.
- `transcripts/empty-launch.log` — first-open fixture on an empty vault.
- Scripts: `crash-run.sh`, `torn-run.sh`, `poller.py`, `cdp-eval.mjs`.
- Fixtures: `fixtures/empty-vault/` (pristine first-open state),
  `fixtures/crash-torn/` (torn file in situ).

## Open questions & unverified items

1. Syscall-level attribution (fs_usage) — blocked without root; F1 rests on
   architecture + surviving-renderer behavior.
2. `hotkeys.json` / `community-plugins.json` / plugin `data.json` writes not
   dynamically exercised.
3. file-recovery snapshot storage (`forceAdd`) not examined (localStorage vs
   file) — the save-failure backup path exists statically.
4. Global `obsidian.json` non-atomicity under kill mid-write untested.
5. Observed occlusion-related debounce stretch (~10 s) measured once; exact
   Chromium throttling regime not characterized.
6. `rea` bulk analysis of obsidian.asar failed (`artifact_operation_failed`,
   reason `io`) both shared and local — static evidence is grep/dd-based.

## Rebuild hints for a Rust clean-room (behavioral requirements only)

1. **Compatibility surface:** 1.7.7 writes notes and config **in place**
   (truncate+overwrite, no temp, no rename, no fsync), same inode. A rebuild
   that *chooses* atomic tmp+rename gains safety but changes observable
   behavior (new inode per write, transient temp entries visible to
   third-party watchers). Document the choice; don't silently mix.
2. **Save schedule:** editor autosave = trailing debounce ~2 s after last
   edit; immediate save on Cmd+S and on leaving a leaf; on quit, flush all
   dirty editors and wait for the write queue; main process should grant a
   few seconds grace before hard exit.
3. **Config model:** two files (`app.json`/`appearance.json`) with a fixed
   key split; any settings change rewrites **both** ~1 s later (debounced,
   extended under continued edits); 2-space pretty JSON; both files
   re-normalized and rewritten at every vault open; unknown or corrupt JSON
   = silently reset to defaults on next save.
4. **workspace.json:** serialize full layout + active leaf + recent-files
   list; write ~1 s after the last layout event; never on an interval;
   tolerate loss of the last debounce window on crash; write failures are
   non-fatal and silent.
5. **External changes:** recursive directory watch (FSEvents on macOS)
   covering hidden dirs; reconcile by mtime+size; externally-modified open
   notes reload into the editor automatically; create/delete propagate to
   the file tree sub-second; deletion handling tolerates transient
   disappearances (re-check ~100 ms).
6. **Crash semantics:** no journals, no WAL, no per-write backups; a crash
   mid-write persists a torn file that the app loads as-is on next launch;
   stale singleton lock files must be detected and reclaimed at startup;
   per-window state is written only on graceful close.
7. **First-open fixture:** create `.obsidian/` with the four files exactly as
   catalogued in F8 (this is our acceptance fixture); nothing else; plus a
   transient same-name/different-case probe file for case-sensitivity
   detection, deleted immediately.
8. **Metadata preservation on write:** Obsidian can preserve mtime
   (`utimes`) and birthtime (native helper) when requested by callers
   (plugins use it); rebuild needs an equivalent for plugin compatibility.
9. **Trash:** deletion goes to the OS trash via a main-process call, or to a
   vault-local `.trash/` with collision-numbered names (`name 2.md`) when
   configured; both must exist.
10. **Updater (if replicated):** verify SHA-256 + detached RSA signature,
    decompress, write `<name>.tmp`, atomic rename, activate on next launch.

## Pinning caveat (explicit)

All findings pin to the **bundled 1.7.7** code of `/Applications/Obsidian.app`
(running-instance identity re-verified per run via loader log and CDP page
title). The updater shadows this on any relaunch that reuses a userData
containing a downloaded `obsidian-<newer>.asar`; every dynamic run here used
a fresh scratch userData with `updateDisabled:true` and verified zero
downloaded asar files post-run. The owner's daily profile runs 1.13.7;
differences between 1.7.7 and 1.13.7 are out of scope and unmeasured here.
