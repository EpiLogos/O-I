# A2 — Obsidian 1.7.7 plugin ecosystem contract (manifest, load, lifecycle, API surface)

Lane: A2 of the 2026-10-07 Obsidian RE campaign. Serves the O-I cradle rebuild
(Rust/Tauri, clean-room). All byte offsets below refer to:

- `shared/obsidian-asar-extracted/app.js` — renderer bundle ("app.js @ N")
  (bundled Obsidian **1.7.7**, `apiVersion` === `1.7.7`, verified dynamically).
- `shared/obsidian-asar-extracted/main.js` — Electron shell main ("shell main.js @ N").

## Scope & method

- **Target pinning:** bundled `obsidian.asar` 1.7.7 (app version string `n1="1.7.7"`
  at app.js @ 2933498; dynamically confirmed `obsidian.apiVersion === "1.7.7"`).
  All dynamic runs used a **fresh scratch `--user-data-dir`** with
  `updateDisabled:true` preseeded, and a post-run check that no
  `obsidian-*.asar` was downloaded (clean in all 3 runs). See "Pinning caveat".
- **Static:** direct grep + byte-offset context windows over the extracted
  renderer bundle (shared bulk REA of obsidian.asar failed per campaign note;
  the 32 MB `shared/app-asar-dir.analysis.json` covers only the updater shell).
- **Dynamic:** 3 isolated launches of `/Applications/Obsidian.app/Contents/MacOS/Obsidian
  --user-data-dir=<lanes/a2/userdata/runN> --remote-debugging-port=9224 <fixture-vault>`
  (working flag combination, discovered here and independently confirmed by lane A1;
  `--user-data-dir` IS honored for Electron userData). Plugins enabled and driven
  over the Chrome DevTools Protocol from `lanes/a2/notes/cdp-drive.mjs`; the probe
  plugin dumped `Object.keys(require('obsidian'))`, `app` manager shapes, and a
  lifecycle log into its own plugin dir. Only PIDs started by this lane were killed.
  No owner vaults, real userData, or app bundle contents were touched.

Each finding: behavior → evidence → confidence → limitations.

---

## 1. Plugin manifest schema

**Behavior.** A community plugin must ship `manifest.json` (JSON object) in its
plugin folder. The loader validates almost nothing: a manifest is registered iff
`JSON.parse` succeeds **and** `.id` is a truthy string; there is no required-field
check beyond `id`, no type validation, no unknown-field rejection. Fields observed
read by the app:

| Field | Required | Type | Read where / effect |
|---|---|---|---|
| `id` | **yes** (manifest skipped without it) | string | key of `manifests` map; must equal the id in `community-plugins.json`; on install must equal registry id or abort ("Plugin ID mismatch.") |
| `name` | expected | string | command name prefix (`manifest.name + ": " + name`), Notices, settings tab names |
| `version` | expected | string | deprecation matching (`isDeprecated`), update resolution, error messages |
| `minAppVersion` | expected | string | update compatibility: release is skipped if app version `<` minAppVersion (semver-less dotted compare, app.js @ 1933221 `UU()`; comparator `GL(a,b)`="a<b" at app.js @ 1320682) |
| `author` | expected | string | normalized: falsy or exactly (case-insensitive) `"obsidian"` → set to `""` |
| `description` | expected | string | plugin browser UI |
| `isDesktopOnly` | expected | bool | `enablePlugin` refuses to load on mobile if true and not desktop (`!Pl.isDesktopApp && n.isDesktopOnly` → return false) |
| `fundingUrl` | optional | string | "Donate" button in plugin detail modal (app.js @ 2073385, 2901104) |
| `dir` | *internal* | — | injected by loader: folder path (dynamically observed `"dir": ".obsidian/plugins/re-probe"`) |

**Evidence.** Loader `loadManifests()`/`loadManifest()`: `if(!(l=JSON.parse(read(s))).id)
return;` + `l.dir=folder` + author normalization — app.js @ 2194608 region
(`RW="manifest.json"`) and @ 2199382 region; install-time id check app.js @ 2208706
region; `minAppVersion` compat in `UU()` app.js @ 1933221; dynamic `manifest` dump
in `lanes/a2/fixture-vault/.obsidian/plugins/re-probe/dumps/app-dump-onload.json`.
**Confidence:** high. **Limitations:** field *display* paths (settings UI) not all
traced; unknown whether the plugin browser enforces extra fields at registry level
(registry side not inspected).

## 2. Packaging & loading

**Behavior.**

- A plugin is a folder under `<vault>/.obsidian/plugins/` (`getPluginFolder()`
  returns `configDir + "/plugins"`, app.js @ 2209728 region). Contents:
  `manifest.json` (required), `main.js` (required to load), `styles.css`
  (optional), `data.json` (optional, created by the plugin itself).
- **Entry point is always `main.js`** (`HW="main.js"`, app.js @ 2194608), read as
  text (`adapter.read`), CommonJS style: `module.exports = <class extending Plugin>`.
- **Module provisioning mechanism:** the app *is* a webpack 5 bundle; plugin
  `require()` is served from an internal map `jW = {obsidian: <exports>,
  "@codemirror/autocomplete": …, "@codemirror/collab", "@codemirror/commands",
  "@codemirror/language", "@codemirror/lint", "@codemirror/search",
  "@codemirror/state", "@codemirror/text" (alias of state), "@codemirror/view",
  "@lezer/common", "@lezer/lr", "@lezer/highlight"}` with a legacy alias map `WW`
  (e.g. `@codemirror/closebrackets|comment|fold|…`) that logs
  "[CM6][<id>] Using a deprecated package" and forwards (app.js @ 2194608 region,
  `jW`/`WW` definitions). Unknown module names fall through to
  `window.require(name)` — i.e. **Node require in the renderer (nodeIntegration
  on; `Kp=window.require; function Yp(e){return Kp&&Kp(e)}`, app.js @ 639472)** —
  unless the body has class `emulate-mobile`, in which case the require fails with
  a Notice "attempted to load NodeJS package" (app.js @ 2203800 region).
- **Execution:** main.js source is wrapped and evaluated with
  `window.eval("(function anonymous(require,module,exports){" + source +
  "\n})\n//# sourceURL=" + "plugin:" + encodeURIComponent(id) + "\n")`, then
  called as `factory(require, module={exports:{}}, exports)` (app.js @ 2203800
  region). Before eval, `//# sourceMappingURL=data:…` lines are stripped
  (regex @ app.js @ 2199000 region, `ZW`; replaced source appended `/* nosourcemap */`).
- **Exports detection:** `exports.default || module.exports`; falsy →
  `throw new Error("Failed to load plugin " + id + ". No exports detected.")`.
  The export must be a constructor; the app does `new Exported(app, manifest)`
  and **requires `instanceof Plugin`** (internal class), else
  `throw new Error("Failed to load plugin " + id)` (same region).
- **styles.css:** after `onload()` completes, `loadCSS()` checks
  `<dir>/styles.css`, reads it, injects a `<style>` element **before** the
  theme's `customCss.styleEl`, and registers removal on unload (app.js @ 2199000
  region). Dynamically confirmed: canary rule `rgb(1,2,3)` computed at +4 s
  (`dumps/lifecycle.log` run 3).
- **`data.json`:** see §7.

**Evidence.** Offsets above; dynamic stack trace shows frame
`ReProbeThrows.onload (plugin:re-probe-throws:6:11)` — the sourceURL scheme in
the wild (`transcripts/run1/console-log.json`, `run3/console-log.json`).
**Confidence:** high. **Limitations:** `U_` flag that disables source-map
stripping not fully traced (dev-mode toggle); esbuild-style "no exports"
behavior with `Object.defineProperty` exports not probed.

## 3. Enable path & restricted mode

**Behavior.**

- Community state lives in two places:
  1. `<vault>/.obsidian/community-plugins.json` — **JSON array of enabled
     plugin ids** (order = user's enable order; dynamically observed to be
     rewritten verbatim on save).
  2. `localStorage["enable-plugin-<appId>"] === "true"` — the **restricted-mode
     gate** (`isEnabled()`: `"true"===localStorage.getItem("enable-plugin-"+appId)`,
     app.js @ 2208300 region). `appId` is the vault id from the global vault
     registry (dynamically: our preseeded 16-hex id). There is **no**
     `community-plugins` entry in `.obsidian` for the gate; it is per-vault
     localStorage in the renderer profile.
- At startup, `plugins.initialize()` (app.js @ 2203800 region, called at app.js
  @ 2950461 region): reads `community-plugins.json` (non-array → `[]`), fills
  `enabledPlugins` Set, `loadManifests()`, and if the enable flag is not
  `"true"`: if the key is *absent* it opens the "trust author" modal (class
  `QW`, app.js @ 2214050; buttons call exactly `plugins.setEnable(true/false)`
  then open the community-plugins settings tab); if `"false"` it silently
  stays restricted. Manifest scanning happens regardless of the gate.
- `setEnable(true)` sets the flag then enables every id in `enabledPlugins`,
  strictly sequentially (`for` + `await`), in `community-plugins.json` order —
  **not** alphabetical, **not** manifest order (app.js @ 2208300 region;
  dynamically: throws-plugin loaded first, probe second, matching the file).
- Per-plugin enable (`enablePlugin(id, userEnable)`): unknown id → false;
  deprecation list hit → Notice + refuse; two hard-coded blocks:
  `sliding-panes-obsidian` (Notice: built-in Stacked Tabs since v1.0) and
  `better-pdf-plugin` version `1.4.0`; `isDesktopOnly` on mobile → false;
  then `loadPlugin()`. `loadPlugin` steps: already-loaded → return; read
  `main.js`; eval; instantiate; `instanceof` check; store in `plugins[id]`
  **before** `load()` is awaited; then `loadCSS()`; then `onUserEnable()` iff
  user-initiated. Any throw → caught in `enablePlugin` → Notice
  "Failed to load plugin" + `console.error("Plugin failure: " + id, err)` →
  returns false (app.js @ 2203800–2208300 regions).
- **Startup hang watchdog:** during `initialize()`, each plugin gets a 3 s
  `setTimeout`; if still loading, a banner offers a Disable button which
  deletes the id from `enabledPlugins`, saves config and `location.reload()`
  (app.js @ 2203800 region, `msgPluginHang`).
- **Save:** `saveConfig()` writes `Array.from(enabledPlugins)` to
  `community-plugins.json` via `writeConfigJson`, debounced 1 s
  (`requestSaveConfig = debounce(saveConfig, 1000)`, app.js @ 2199382 region).
  `enablePluginAndSave`/`disablePluginAndSave` mutate the Set and save;
  `uninstallPlugin` = disable+save + `adapter.rmdir(dir, true)` + drop
  manifest/update entries (app.js @ 2208706 region).

**Evidence.** Offsets above; dynamic: `state-pre-enable.json`
(manifests scanned, enabledSet prefilled, nothing loaded, flag null),
`state-post-enable.json` (flag "true", both loaded in file order),
`community-plugins-after.json` (file unchanged in content/order).
**Confidence:** high. **Limitations:** the trust modal was observed via code +
pre/post states, not by clicking it (CDP path called `setEnable(true)` — the
same call the modal's button makes, verified in `QW` source).

## 4. Core plugins & load order

**Behavior.**

- Core ("internal") plugins are **compiled into the app**: the manager is
  `internalPlugins = new cG(this)` — a different class from community `plugins`
  (`new $W(this)`) — created in `initializeWithAdapter` (app.js @ 2948749
  region). All core plugin instances are constructed in a **fixed source
  order** via `loadPlugin(new …)` (28 plugins + conditional `browser`/
  webviewer for desktop dev/flag): file-explorer, global-search, switcher,
  graph, backlink, canvas, outgoing-link, tag-pane, properties, page-preview,
  daily-notes, templates, note-composer, command-palette, slash-command,
  editor-status, bookmarks, markdown-importer, zk-prefixer, random-note,
  outline, word-count, slides, audio-recorder, workspaces, file-recovery,
  publish, sync (constructor→id mapping at app.js @ 2949750 + per-class
  `this.id="…"`; `lG` legacy id list @ app.js @ 2221567 region).
- Core enable state: `.obsidian/core-plugins.json`, an **object map
  `{id: boolean}`** (dynamically captured; contains `canvas`, `properties`,
  `bookmarks` which are absent from the legacy `lG` list). Legacy array form
  is migrated via `.obsidian/core-plugins-migration.json`. Missing keys fall
  back to the plugin's `defaultOn` flag; save is debounced 500 ms
  (app.js @ 2221567 region, `cG.enable/saveConfig`; dynamically observed
  defaults: `properties:false`, `slash-command:false`, `bookmarks:true`, …).
- Core plugin *instances* get enabled (`onEnable`, commands/ribbon/views/status
  registration) — their data goes to `.obsidian/<id>.json` (core `saveData`
  uses `writeConfigJson(instance.id, …)`, app.js @ 2220067 region) — **not**
  `data.json`.
- **Order at boot** (app.js @ 2949750–2950973 region): managers constructed →
  core plugins registered & `await internalPlugins.enable()` → **then**
  `await plugins.initialize()` (community) → vault load → metadata cache
  initialize → workspace layout load. So: **core before community; community
  strictly sequential in community-plugins.json order.**
- **Core plugins are NOT bundled `main.js` plugins** — no manifest, no eval.

**Evidence.** Offsets above; dynamic `core-plugins.json` capture
(`transcripts/core-plugins-after.json`, fixture `.obsidian/core-plugins.json`).
**Confidence:** high (order), high (config format). **Limitations:** exact
rendering of each core plugin's `onEnable` not exhaustively traced; the
browser/webviewer gate uses dev-mode or `localStorage["webviewer"]`.

## 5. Updates & community registry

**Behavior.**

- Registry base: `https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/…`
  — `community-plugins.json` (array of `{id,name,author,description,repo}`),
  `community-plugin-stats.json` (downloads), `community-plugin-deprecation.json`
  (map id → array of bad versions). All fetched through `requestUrl` with a
  5-minute cache / 60 s error retry (app.js @ 2215450 region, `eG/nG/rG`,
  `TA(fn, 3e5, 6e4)`).
- Update resolution per installed plugin: fetch
  `https://raw.githubusercontent.com/<repo>/HEAD/versions.json` (map
  pluginVersion → minAppVersion), pick the greatest version whose
  minAppVersion ≤ app version (app.js @ 1933221, `UU`).
- Install: `https://github.com/<repo>/releases/download/<version>/<file>` —
  downloads `manifest.json` (id must match expected), `main.js` (sourcemap
  stripped + `/* nosourcemap */` appended; missing file is tolerated with a
  console log), `styles.css` (missing tolerated); writes them into
  `.obsidian/plugins/<id>/`; clears any pending update entry (app.js @ 2208706
  region, `installPlugin`).
- Deprecation enforcement: on init and every 12 h (`setInterval(…, 432e5)`)
  `checkForDeprecations()` re-fetches the deprecation list and force-disables
  (disable+save) any enabled plugin whose exact `id+version` is listed, with a
  Notice (app.js @ 2208300 region).

**Evidence.** Offsets above. **Confidence:** high (static; URLs and flows
read directly). **Limitations:** no live registry fetch performed in the
sandboxed runs; `theme` (snippet) install path only glanced at.

## 6. Lifecycle contract

**Component base (exported class `Component`).**
- State: `_loaded`, `_events` (array of cleanup callbacks), `_children`
  (app.js @ 1234898).
- `load()`: idempotent; sets `_loaded`, calls `onload()`, then `load()`s a
  *copy* of `_children`.
- `unload()`: only if `_loaded`; pops and unloads all children **first**, then
  pops and runs all registered cleanup callbacks, **then** calls `onunload()`.
  (Registration cleanups run before `onunload`.)
- `addChild(c)` loads immediately if parent loaded; `removeChild(c)` unloads it.
- `register(cb)`, `registerEvent(eventRef → ref.e.offref(ref))`,
  `registerDomEvent(el, type, cb, opts)`, `registerScopeEvent`,
  `registerInterval(id → clearInterval(id))`.
- Dynamically: `Component loaded flag=true` during `onload`
  (`dumps/lifecycle.log`).

**Plugin surface (exported class `Plugin extends Component`; constructor
`(app, manifest)`; app.js @ 2194608–2199382 regions).** All `add*`/`register*`
methods auto-register a cleanup via `this.register(...)`:
`addRibbonIcon(icon, title, cb)` (id `"<pluginId>:<title>"`),
`addStatusBarItem()` (element gets class `plugin-<id-lowercased-sanitized>`),
`addCommand(cmd)` (command id prefixed `"<pluginId>:"`, name prefixed
`"<manifest.name>: "`, auto-removed on unload), `removeCommand`,
`addSettingTab`, `registerView(type, factory)` (unregister + detach leaves of
type on user-disable), `registerHoverLinkSource`, `registerExtensions`,
`registerMarkdownPostProcessor` (triggers `post-processor-change`),
`registerMarkdownCodeBlockProcessor`, `registerCodeMirror` (no-op stub in 1.7.7),
`registerEditorExtension` (CodeMirror 6 extension via
`workspace.registerEditorExtension`), `registerObsidianProtocolHandler`/
`unregisterObsidianProtocolHandler` (duplicate action throws),
`registerEditorSuggest`, `loadData`/`saveData`, `loadCSS`,
`getModifiedTime`, and overridable hooks: `onload()`, `onunload()`,
`onUserEnable()`, `onExternalSettingsChange()`.

**`onExternalSettingsChange` mechanics:** the plugins manager subscribes to the
vault `"raw"` event; when the changed path is exactly
`<configDir>/plugins/<id>/data.json` for an *enabled* plugin, it calls the
plugin's debounced (50 ms) `_onConfigFileChange`, which re-stats `data.json`
and fires `onExternalSettingsChange()` only if mtime increased
(app.js @ 2199382 region, `$W.onRaw`; `Plugin._onConfigFileChange`,
`getModifiedTime`). **Dynamically confirmed:** external rewrite of `data.json`
fired the handler within ~55 ms (run 3 lifecycle log).

**Error isolation.** `Component.load()` has no try/catch; the try/catch lives
in `enablePlugin`. Observed behavior for a throwing `onload`:
`console.error("Plugin failure: re-probe-throws", Error…)` with the stack
pointing at `plugin:re-probe-throws:6:11`, a Notice, `enablePlugin` returns
false, startup continues, and a later plugin loads normally. **Notable:** the
failed instance REMAINS in `plugins[id]` (assignment precedes `load()`), so
`getPlugin(id)` still returns the half-loaded plugin (dynamic:
`state-post-enable.json` lists it as loaded; stack in
`transcripts/run3/console-log.json`). Failure in `onunload` is caught in
`disablePlugin` → Notice "Failed to unload plugin <id>" (app.js @ 2208300).

**Disable vs quit vs vault switch.**
- Disable (`disablePluginAndSave`): id removed from `enabledPlugins` + save;
  `unloadPlugin` sets `_userDisabled`, runs `unload()` (children → registered
  cleanups → `onunload`), removes from `plugins` map; `registerView` views of
  user-disabled plugins have their leaves detached. Dynamically: disable removed
  it, re-enable constructed a fresh instance (`onload` → `onUserEnable`),
  `onunload` observed (`state-disable-enable-cycle.json`, lifecycle log).
- App quit: `window.onbeforeunload` triggers workspace `"quit"`, may hold the
  close for pending saves, then `window.close()`. **No plugin unload cycle runs
  on quit** — `onunload` is not guaranteed at app exit (app.js @ 2985139).
- Vault switch: the renderer app object is created per vault load
  (`window.app = new <App>(…)` at bundle tail; `vault.on("closed")` → vault
  chooser). No explicit "unload all plugins" pass was found for the switch
  path; treat on-unload guarantees on vault switch as **unverified** (see
  open questions).

**Confidence:** high for Component/Plugin semantics (static + dynamic);
high for quit; low-medium for vault-switch teardown.

## 7. Plugin data persistence (`loadData`/`saveData` → `data.json`)

**Behavior.** `loadData()` → `vault.readPluginData(manifest.dir)` →
`readJson(dir + "/data.json")`: read file, `JSON.parse`; ENOENT → `null`;
other errors → `console.error("failed to read JSON", path)` and return
`undefined` (app.js @ 733000 region). `saveData(data)` →
`vault.writePluginData(dir, data, {mtime: Date.now()})` → `writeJson`:
`adapter.write(path, JSON.stringify(data, undefined, 2), {mtime})` —
**pretty-printed with 2-space indent, UTF-8 string, no BOM**; write errors are
**swallowed** (empty catch). The `{mtime}` is honored on desktop via
`fs.setTimes` (adapter write at app.js @ 1919217 region). Desktop adapter
(`Yc`) is `window.require("original-fs")`-based (app.js @ 534609): writes go
through a serialized queue (`this.queue`) directly to `fs.write(fullPath,
string)` — **no temp-file + rename atomicity**; the parent folder must
already exist (`adapter.write` gave ENOENT for a missing subfolder — observed
run 1). Also `_lastDataModifiedTime` bookkeeping feeds
`onExternalSettingsChange`. Core plugins instead persist to
`.obsidian/<id>.json` (§4).

**Evidence.** Offsets above; dynamic: `data.json` on disk exactly
2-space-pretty (`fixture-vault/.obsidian/plugins/re-probe/data.json`),
`dumps/data-json-raw.json` (`readBackMatches: true`), run-1 ENOENT errors in
`transcripts/run1/console-log.json`.
**Confidence:** high. **Limitations:** mobile (Capacitor) adapter path differs
(`UTF8` encoding flag app.js @ 1910072) — desktop is the rebuild target.

## 8. The API a plugin sees

**Module surface.** `require("obsidian")` exposes **122 symbols** — static
count of the webpack export map (`n.d(d,{…})` at app.js @ 236272–240172
window) **equals** the dynamic `Object.keys(require('obsidian')).length`
(122, `dumps/obsidian-module-keys.json`). Composition: 114
constructors/classes, 5 plain objects (`Platform`, `PopoverState`,
`editorEditorField`, `editorInfoField`, `editorLivePreviewField`,
`editorViewField`, `livePreviewState` — 7 objects total including the two
`*Field` sets), 1 string (`apiVersion` = `"1.7.7"`, i.e. the *app* version;
`requireApiVersion(v)` = app version ≥ v). Groups (exemplars):

- **Plugin & component base:** `Plugin` (§6), `Component`, `BaseComponent`,
  `Events`, `Scope`, `Keymap`, `Platform`.
- **UI views:** `ItemView`, `View`, `FileView`, `TextFileView`,
  `EditableFileView`, `MarkdownView`, `MarkdownPreviewView`,
  `MarkdownRenderChild`, `MarkdownRenderer`, `ViewRegistry`, `HoverPopover`,
  `WorkspaceLeaf`/`Workspace*` layout classes (14 Workspace* exports).
- **Modals & suggest:** `Modal`, `FuzzySuggestModal`, `SuggestModal`,
  `AbstractInputSuggest`, `EditorSuggest`, `PopoverSuggest`, `Menu`,
  `MenuItem`, `MenuSeparator`, `Notice`.
- **Settings:** `PluginSettingTab`, `SettingTab`, `Setting`, and component
  set (`ButtonComponent`, `TextComponent`, `TextAreaComponent`, `ToggleComponent`,
  `DropdownComponent`, `SliderComponent`, `ExtraButtonComponent`,
  `ColorComponent`, `MomentFormatComponent`, `ProgressBarComponent`,
  `SearchComponent`, `ValueComponent`, `AbstractTextComponent`).
- **Files & metadata:** `Vault`, `TAbstractFile`/`TFile`/`TFolder`,
  `FileManager`, `MetadataCache`, `FileSystemAdapter`, `CapacitorAdapter`.
- **Editor:** `Editor`, `EditorSuggest`; CodeMirror comes as separate module
  specifiers (`@codemirror/state|view|…`, `@lezer/*`) re-exported from the app
  bundle (§2), plus `editorEditorField`/`editorInfoField`/`editorLivePreviewField`/
  `editorViewField`/`livePreviewState`.
- **Utilities:** `moment`, `normalizePath`, `debounce`, `htmlToMarkdown`,
  `parseYaml`/`stringifyYaml`, front-matter helpers (`getFrontMatterInfo`,
  `parseFrontMatterEntry/Tags/Aliases/StringArray`), link helpers
  (`parseLinktext`, `getLinkpath`, `getAllTags`, `iterateRefs`/`iterateCacheRefs`),
  search helpers (`prepareFuzzySearch`, `fuzzySearch`, `prepareQuery`, …),
  rendering helpers (`renderMath`, `loadMathJax`, `loadMermaid`, `loadPdfJs`,
  `loadPrism`, `sanitizeHTMLToDom`, `setIcon`, `addIcon`, `getIconIds`, `setTooltip`),
  encoding (`arrayBufferToBase64`, `base64ToArrayBuffer`, `arrayBufferToHex`,
  `hexToArrayBuffer`, `getBlobArrayBuffer`), network (`request`, `requestUrl`),
  `resolveSubpath`, `stripHeading`, `fuzzySearch`.

**`app` object shape** (`this.app` / `window.app`; dynamic dump
`dumps/app-dump-onload.json`, 30 own keys): `vault`, `workspace`,
`metadataCache`, `fileManager`, `plugins` (community manager),
`internalPlugins` (core manager), `commands`, `hotkeyManager`, `keymap`,
`setting`, `customCss`, `statusBar`, `viewRegistry`, `metadataTypeManager`,
`foldManager`, `scope`, `dragManager`, `embedRegistry`, `shareReceiver`,
`appMenuBarManager`, `dom`, `title`, `lastEvent`, `appId`, `isMobile`,
mobile-only managers, nextFrame plumbing. Prototype method counts (same dump):
vault 60 (`read`, `create`, `getAbstractFileByPath`, `getMarkdownFiles`,
`getResourcePath`, `on/trigger`, `getConfig`…), workspace 81 (`getLeaf`,
`getLeavesOfType`, `getActiveViewOfType`, `openLinkText`, `revealLeaf`,
`onLayoutReady`, `iterateAllLeaves`, `registerEditorExtension`,
`registerObsidianProtocolHandler`…), metadataCache 45 (`getCache`,
`getFirstLinkpathDest`, `getBacklinksForFile`, `fileToLinktext`…), fileManager 27
(`processFrontMatter`, `generateMarkdownLink`, `renameFile`…), plugins 20
(`enablePluginAndSave`, `checkForUpdates`, `installPlugin`…), commands 6
(`addCommand`, `executeCommandById`, `listCommands`, `findCommand`…),
setting 20, customCss 37, hotkeyManager 14.

**`requestUrl`** (app.js @ 1930717–1932335): accepts string or
`{url, method, contentType, headers, body}`; desktop routes through main
process via IPC channel `"request-url"` (CORS bypass), returns
`{status, headers, arrayBuffer, json (lazy), text (lazy)}`, throws
`"Request failed, status N"` for status ≥ 400.

**Evidence.** Export map offset above + dynamic dumps (counts and types cross-
checked). **Confidence:** high for surface and counts; **limitations:**
individual method *signatures* not documented here (public typings not part of
the bundle; recover later from `obsidian.d.ts` of matching version if needed);
prototype-name dumps are minified-class prototypes, complete but unordered by
contract.

## Observed transcripts / fixtures (under `lanes/a2/`)

- Fixture vault: `fixture-vault/` (`.obsidian/community-plugins.json` =
  `["re-probe-throws","re-probe"]`; plugins `re-probe` (well-behaved probe) and
  `re-probe-throws` (intentional onload throw)).
- Dumps (run 3): `fixture-vault/.obsidian/plugins/re-probe/dumps/` —
  `obsidian-module-keys.json` (122 keys + types), `app-dump-onload.json`,
  `app-dump-postboot.json`, `data-json-raw.json`, `lifecycle.log`.
- Transcripts: `transcripts/` (latest run) and archived `transcripts/run1..3/` —
  `state-pre-enable.json`, `state-post-enable.json`,
  `state-disable-enable-cycle.json`, `community-plugins-after.json`,
  `core-plugins-after.json`, `obsidian-configdir-listing.json`,
  `console-log.json` (CDP console incl. "Plugin failure" stack),
  `vault-tree-after.txt`, `pinning-check.txt` ("CLEAN" in all runs),
  `obsidian-stdout-stderr.log`.
- Driver: `notes/cdp-drive.mjs`; context-extraction helper: `notes/ctx.py`.

## Open questions & unverified items

1. **Vault-switch plugin teardown** — no explicit unload-all found statically;
   not dynamically exercised. (Do plugins get `onunload` when the vault
   changes? Current reading: the app/window is torn down with the vault, but
   the mechanism is unproven.)
2. **Trust modal clicked-path** — `setEnable(true)` was invoked via CDP (same
   call as the modal button); the modal's own UI flow not clicked.
3. **Update flow end-to-end** (network fetch of a real release) — not
   exercised; install/uninstall verified statically only.
4. **`emulate-mobile` require blocking** — statically clear; not dynamically
   toggled.
5. **Mobile (Capacitor) plugin paths** (requestUrl native bridge, adapter
   differences, `isDesktopOnly` gating) — static only.
6. **exact `styles.css` timing vs first paint** — canary checked at +4 s only;
   static order is `onload()` → `loadCSS()`.

## Pinning caveat

Owner's daily Obsidian runs **1.13.7** via auto-updater shadowing; this study
pins to the **bundled 1.7.7**. All dynamic runs used fresh scratch userData
with `updateDisabled:true` preseeded and were verified clean of downloaded
`obsidian-*.asar` (`transcripts/run*/pinning-check.txt`). One behavioral delta
risk noted statically: the 1.7.7 *shell* (`app.asar` main.js) itself performs
update downloads into userData — a relaunch in the same userData would load
newer code; never done here. Findings for newer versions (e.g. plugin
manifest fields, module map contents, registry file names) may differ.

## Rust rebuild hints (behavioral contract only — the O-I plugin system will be its own design)

- Manifest: require a unique `id` (treat it as the plugin's identity everywhere:
  directory content, enable list, command-id namespace); tolerate and skip
  unparseable/id-less manifests; normalize author; expose `version`,
  `minAppVersion` (compatibility compare must be dotted-numeric, "at least"),
  `isDesktopOnly`, optional `fundingUrl`; inject the resolved plugin dir into
  the manifest object seen by the plugin.
- Isolation: run each plugin's code with only an injected `require` that serves
  a fixed module map (the public API) and denies/forwards unknown names
  deliberately; tag evaluated code with the plugin id so stack traces name the
  faulty plugin.
- Enable state: split "which plugins are enabled" (vault-file, ordered array)
  from "community plugins allowed at all" (host-level, per-vault flag with an
  explicit first-run trust decision).
- Load order: built-in plugins fully before community plugins; community
  plugins sequentially, in enable-file order; wrap each plugin's start in error
  isolation — a throwing start must not prevent later plugins, must surface the
  plugin id, and should leave the half-started instance inspectable.
- Lifecycle: two-phase Component semantics (idempotent load; unload =
  children first, registered cleanups second, user hook last); auto-cleanup
  registration is the core ergonomics — every registration helper must push a
  cleanup that runs even if the plugin's own hook is missing; `onunload` must
  be treated as best-effort (not guaranteed at process exit).
- Settings sync: watch the plugin's data file for external modification;
  debounce; only notify when mtime advanced; plugin hook optional.
- Persistence: JSON, pretty (2-space indent), UTF-8, single write per save;
  document non-atomicity or improve on it in the rebuild; missing file means
  empty settings; failed writes must not crash the host.
- Updates/deprecations: registry is a remote manifest of ids/repos; updates
  resolve per-repo version lists against `minAppVersion`; a small in-app
  blocklist keyed by exact id+version can force-disable known-bad releases.
- Hang watchdog: a startup timer per plugin with a user-visible "disable this
  plugin" recovery action that persists the disable and reloads.
