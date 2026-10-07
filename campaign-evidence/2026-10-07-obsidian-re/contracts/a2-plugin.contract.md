# Behavior contract — A2: plugin ecosystem (Obsidian 1.7.7)

Distilled from `findings/a2-plugin-ecosystem.md` (evidence there). Acceptance:
`verification/gates/gate4-plugin-contract.mjs` (18 checks). **Note:** the O-I
rebuild will not embed a JS plugin runtime (see "O-I shape" below); this
contract records the semantics any O-I contribution system must honor in its
own idiom, plus the exact Obsidian surface for interop decisions.

## 1. Manifest

- `manifest.json` in the plugin folder; registered iff it JSON-parses and has
  a truthy `id` — no other validation, no unknown-field rejection.
- Fields: `id` (identity everywhere: dir name binding, enable list, command
  namespace), `name`, `version`, `minAppVersion` (dotted "at least" compare),
  `author` (falsy/"obsidian" → ""), `description`, `isDesktopOnly`,
  optional `fundingUrl`; loader injects `dir`.

## 2. Packaging & loading

- Folder `.obsidian/plugins/<id>/`: `manifest.json` + `main.js` (required),
  `styles.css` (optional, injected after onload completes), `data.json`
  (plugin-created).
- `main.js` is CommonJS, evaluated via `window.eval` with a
  `sourceURL=plugin:<id>` (stack traces name the faulty plugin); sourcemaps
  stripped first.
- `require` serves a fixed module map: `obsidian` + @codemirror/* + @lezer/*;
  unknown names fall through to Node's `window.require` (nodeIntegration on),
  blocked with a Notice under `emulate-mobile`.

## 3. Restricted mode & enable state

- Two stores: `community-plugins.json` (ordered array of enabled ids) in the
  vault; `localStorage["enable-plugin-<appId>"] === "true"` (the community
  trust gate) in the renderer profile. Absent key → trust modal; `"false"` →
  silently restricted. Manifest scanning happens regardless.

## 4. Load order & lifecycle

- Boot order: core plugins (compiled in, fixed source order, enabled from
  `core-plugins.json`) **then** community plugins **strictly sequentially in
  `community-plugins.json` order**.
- Enable: eval → `exports.default || module.exports` → must be a constructor
  `instanceof Plugin` → `new Ctor(app, manifest)` → registered in the plugins
  map **before** `load()` → `loadCSS()` → `onUserEnable()` if user-initiated.
- Startup watchdog: ~3 s per plugin; hang offers a Disable action that
  persists and reloads.
- **Error isolation:** a throwing `onload` → Notice + `console.error("Plugin
  failure: <id>")`, later plugins still load — but the failed instance
  *remains* in the plugins map.
- Component semantics: idempotent `load()`; `unload()` = children first,
  registered cleanups second, user `onunload()` last. Every `add*`/`register*`
  helper auto-registers a cleanup.
- Disable: id removed + debounced save; views of user-disabled plugins detach;
  re-enable constructs a fresh instance. **App quit runs no unload cycle**
  (`onunload` is best-effort). Vault-switch teardown: unverified (open item).
- `onExternalSettingsChange`: fired when the plugin's `data.json` is modified
  externally; debounced ~50 ms, only when mtime advanced.

## 5. The API a plugin sees

- `require("obsidian")` = **exactly 122 symbols** (114 constructors, 7 plain
  objects/field sets, `apiVersion` = app version). Groups and exemplars in
  dossier §8. `app` (window.app) exposes ~30 managers; prototype method
  counts: vault 60, workspace 81, metadataCache 45, fileManager 27, plugins
  20, commands 6.
- `requestUrl` routes through the main process (CORS bypass), throws on
  status ≥ 400.

## 6. Persistence

- `loadData`/`saveData` → `.obsidian/plugins/<id>/data.json`: **exactly**
  `JSON.stringify(data, null, 2)`, UTF-8, single in-place (non-atomic) write,
  write errors swallowed, ENOENT read → `null`, parent dir must exist.
- Core plugin data → `.obsidian/<id>.json` instead.

## 7. Updates & deprecation

- Registry: obsidianmd/obsidian-releases (`community-plugins.json`, stats,
  deprecation list), 5-min cache. Updates resolve per-repo `versions.json`
  against `minAppVersion`. Deprecation check every 12 h force-disables
  exact id+version matches. Two hard-coded blocks exist.

## O-I shape (design constraint from the integration map)

The kernel's authority laws (zero-background-Agent checks, native
confirmation as the only issuance door, "consumer never mutates") rule out an
in-process plugin runtime holding vault IO. The compliant shape is the
architecture's own grain: `oi.package/v1` contribution envelopes
(`schemas/oi.package-v1.schema.json`) + owner-disclosed Actions
(`kernel/src/action.rs`) + surface registration (`src/surface/registry.ts`),
with resident out-of-process capability following the
terminal/browser/agency precedents. Obsidian-plugin *binary* compatibility is
explicitly NOT a goal; what transfers is the lifecycle discipline above
(isolation, ordered load, error isolation, best-effort unload, watchdog,
declared API surface, per-extension data file with external-change notify).

## Acceptance

`node verification/gates/gate4-plugin-contract.mjs` (18 checks) must pass
unchanged for any rebuild claiming this contract.
