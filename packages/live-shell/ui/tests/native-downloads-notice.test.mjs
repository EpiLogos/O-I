import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Ticket P, G1: every file the stage exports lands, and the person is told where. The candidate's main window was built from config
// with no download handler, and wry cancels a download without one: every `<a download>` (Capture PNG, Save video, Export ▾, the
// canvas's .canvas, the frame PNG, quarantine, the natal chart) vanished. main.rs now builds every window the config would create
// from that same config with the receiver (src-tauri/src/downloads.rs, browser.rs's `.on_download` ported; its decision is tested
// in Rust); the host's notice reaches the Studio's Capture section (studioExports.ts). Production modules in memory (the loader of
// expressions-studio-plate.test.mjs); the notices are fixtures shaped as downloads.rs serialises them — the native leg is the lead's.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

const noop = () => {}
globalThis.__CRADLE_WALK__ = false
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis
globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop

const src = path => new URL(`../src/${path}`, import.meta.url).href
const world = await import(src('inhabitants/worldShellFamilies.ts'))
world.loadWorldShellFamilies()
const [Exports, Stage, Commands] = await Promise.all([
  import(src('components/expressions/studio/studioExports.ts')),
  import(src('components/expressions/studio/StudioStage.tsx')),
  import(src('native/stageCommands.ts')),
])
const repo = path => readFile(new URL(`../../../../${path}`, import.meta.url), 'utf8')

// The notices exactly as downloads.rs serialises DownloadNotice (its test the_notice_reads_as_the_shell_parses_it pins the same keys).
const SAVED = {state: 'saved', file: 'field-study (1).png', folder: '/Users/person/Downloads', place: '~/Downloads', fault: null, reason: null}
const SAVING = {...SAVED, state: 'saving'}
const FAILED = {state: 'failed', file: 'take.webm', folder: '/Users/person/Downloads', place: '~/Downloads', fault: 'not_saved',
  reason: 'The download failed or was cancelled; nothing was saved'}
const NOWHERE = {state: 'failed', file: null, folder: null, place: null, fault: 'no_destination',
  reason: 'This machine offers no Downloads folder to save it in, so it was not saved'}

test('the host\'s notice is read exactly: where it landed, or its named fault — anything else is no notice', () => {
  assert.deepEqual(Exports.readExportNotice(SAVED), SAVED)
  assert.deepEqual(Exports.readExportNotice(FAILED), FAILED)
  assert.deepEqual(Exports.readExportNotice(NOWHERE), NOWHERE)
  for (const bad of [null, 'saved', [], {...SAVED, state: 'done'}, {...SAVED, file: 7}, {...SAVED, fault: 'not_saved'},
    {...FAILED, fault: null}, {...FAILED, reason: null}, {...FAILED, fault: 'disk_full'}, {...SAVED, place: ''}]) {
    assert.equal(Exports.readExportNotice(bad), null, JSON.stringify(bad))
  }
})

test('the notice in the person\'s words: the file\'s name and its folder, or what did not happen and why', () => {
  assert.equal(Exports.exportWords(SAVED), 'Saved “field-study (1).png” in ~/Downloads.')
  assert.equal(Exports.exportWords(SAVING), 'Saving “field-study (1).png” to ~/Downloads…')
  assert.equal(Exports.exportWords(FAILED), '“take.webm” was not saved: The download failed or was cancelled; nothing was saved.')
  assert.equal(Exports.exportWords(NOWHERE), 'The export was not saved: This machine offers no Downloads folder to save it in, so it was not saved.')
})

test('one listener on the host\'s topic keeps the last notice; a notice the shell does not read is named, never shown as a save', async () => {
  let handler = null
  const topics = []
  await Exports.listenForExports(async (event, take) => {topics.push(event); handler = take; return noop})
  await Exports.listenForExports(async () => {throw new Error('a second listener is never attached')})
  assert.deepEqual(topics, [Exports.NATIVE_DOWNLOAD_EVENT])
  assert.equal(Exports.NATIVE_DOWNLOAD_EVENT, 'oi:native-download')
  let shown = null
  const Probe = () => {shown = Exports.useLastExport(); return null}
  handler({payload: FAILED})
  renderToStaticMarkup(createElement(Probe))
  assert.deepEqual(shown, FAILED)
  handler({payload: {state: 'saved', file: 42}})
  renderToStaticMarkup(createElement(Probe))
  assert.equal(shown.state, 'failed')
  assert.match(Exports.exportWords(shown), /a download notice this shell does not read/)
})

// MOVED (O-I #747): Capture is File › Export › Picture…, so the last export stands under Picture…'s choices, and the panel says it on the
// status bar wherever the export was asked from (panels/expressions.tsx). REPLACED: "Capture shows the last export under its controls".
test('Picture… shows the last export under its choices, and the status bar says it: the file and folder; a failure says so', async () => {
  const sender = {reason: null, readings: Commands.stageReadings(null), refusal: null, send: noop}
  const body = exported => renderToStaticMarkup(createElement(Stage.PictureChoicesBody, {sender, options: Commands.STAGE_CAPTURE_DEFAULTS,
    onOptions: noop, onDone: noop, exported}))
  assert.doesNotMatch(body(null), /studio-export-line/, 'nothing is said before an export')
  const saved = body(SAVED)
  assert.match(saved, /<p class="studio-export-line" role="status" data-export="saved" title="\/Users\/person\/Downloads\/field-study \(1\)\.png">Saved “field-study \(1\)\.png” in ~\/Downloads\.<\/p>/)
  assert.ok(saved.indexOf('data-stage="capture-png"') < saved.indexOf('studio-export-line'), 'the line stands under Export, in Picture…\'s choices')
  assert.match(body(FAILED), /data-export="failed"[^>]*>“take\.webm” was not saved: The download failed or was cancelled/)
  const panel = await readFile(new URL('../src/panels/expressions.tsx', import.meta.url), 'utf8')
  assert.match(panel, /useEffect\(\(\) => \{if \(exported\) sayOnInfoLine\(container\.current, 'Export', exportWords\(exported\)\)\}, \[exported\]\)/)
})

test('the main window is built from its config with the download receiver and the navigation guard; nothing else about it changes', async () => {
  const main = await repo('desktop/cradle/src-tauri/src/main.rs')
  assert.match(main, /\nmod downloads;\n/)
  assert.match(main, /\.filter\(\|window\| window\.create\)\s*\.map\(\|window\| \{\s*window\.create = false;\s*\(window\.label\.clone\(\), None\)\s*\}\)/,
    'every window the config would auto-create is taken, keeping no store of its own')
  assert.match(main, /tauri::WebviewWindowBuilder::from_config\(app, &config\)\?;/, 'built from its own config, as auto-create builds it')
  // REPLACED (O-I #747 round 896, 1R-authority.1, F1): the shell's own windows also refuse a navigation to anything but the bundled shell.
  assert.match(main, /builder\s*\.on_download\(downloads::receiver\(\)\)\s*\.on_navigation\(shell_navigation\)\s*\.build\(\)\?;/)
  assert.match(main, /Some\(id\) => builder\.data_store_identifier\(\*id\),\s*None => builder,/, 'only an isolated run\'s store is applied, as before')
  assert.doesNotMatch(main, /if !config\.create \{/, 'the old isolated-store loop is the one loop now')
  const downloads = await repo('desktop/cradle/src-tauri/src/downloads.rs')
  assert.match(downloads, /pub const DOWNLOAD_EVENT: &str = "oi:native-download";/, 'the host speaks on the topic the Studio reads')
  assert.doesNotMatch(downloads.split('#[cfg(test)]')[0], /std::fs|tokio::fs/, 'the receiver writes nothing itself; WebKit writes the download')
  // The candidate's overlay still auto-declares its window: main.rs takes it in code, so the config keeps every property.
  const overlay = JSON.parse(await repo('packages/live-shell/tauri.candidate.conf.json'))
  assert.equal(overlay.app.windows.length, 1)
  assert.equal(overlay.app.windows[0].create, undefined)
  assert.equal(overlay.app.windows[0].titleBarStyle, 'Overlay')
})

// O-I #747 round 896, 1S (DLW build ruling 2026-11-09, review c99c M1): the F1 guards are wired where they act, pinned here so a refactor or
// a merge that drops one fails (mutants K4 and K6 survived every test): the kernel's two commands (one body, run_kernel_op) refuse a window
// whose page is not the shell's, returning the refusal before the op is stamped or run; and every detached window (windows.rs) is built
// with the same navigation guard as the main one. Each read with its comments and strings blanked.
const rust = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
test('1S: the kernel\'s commands refuse a page that is not the shell\'s before anything runs, and every detached window keeps the navigation guard', async () => {
  const main = rust(await repo('desktop/cradle/src-tauri/src/main.rs'))
  // Generic over the runtime since round 896 1T item 16 (a host test drives it on the mock runtime: main.rs run_kernel_op_tests).
  const start = main.indexOf('async fn run_kernel_op<R: tauri::Runtime>(')
  assert.ok(start > 0, 'the one body of kernel_op and kernel_press')
  const body = main.slice(start, main.indexOf('\n}\n', start))
  // Since round 896 1T item 21 the admission is admit_page: the window's address and the document its main frame committed.
  const guard = body.search(/\n\s*admit_page\(&app, &webview\)\?;/)
  assert.ok(guard > 0, 'run_kernel_op asks admit_page of the window\'s page and returns its refusal (?)')
  assert.ok(guard < body.indexOf('.stamp(&mut op'), 'before the op is stamped or run')
  const admit = main.slice(main.indexOf('fn admit_page<R: tauri::Runtime>('), main.indexOf('fn dev_server<R: tauri::Runtime>('))
  assert.match(admit, /let address = webview\.url\(\)\.map_err\(/, 'the page is the window\'s own address')
  assert.match(admit, /let committed = committed_page\(app, webview\.label\(\)\);\s*shell_page\(&address, committed\.as_ref\(\), dev_server\(app\)\.as_ref\(\)\)\s*\}/,
    'and the document its main frame committed, both asked of shell_page')
  const windows = rust(await repo('desktop/cradle/src-tauri/src/windows.rs'))
  assert.match(windows, /let builder = WebviewWindowBuilder::new\(&app, &label, WebviewUrl::App\(asset\.into\(\)\)\)[^;]*\.on_navigation\(crate::shell_navigation\);/,
    'a detached window is built with the shell window\'s navigation guard')
})

// O-I #747 round 896, 1T item 21 (DLW build ruling 2026-11-09): the committed page the admission reads is recorded by the host's own
// page-load hook, at Started (wry's commit, the main frame's alone), for every webview, and goes with its window, a tab of it with it
// (1T.0.1 item 7, review 956d finding 8: window_gone keeps only the records of webviews Tauri still holds). The mock runtime
// runs no hook, so its wiring is read here; what the record does is the host's tests (main.rs run_kernel_op_tests,
// native_shell.rs candidate_view_admission_tests).
test('1T: the host records each webview\'s committed page at its load\'s start, and forgets it with its window', async () => {
  const main = rust(await repo('desktop/cradle/src-tauri/src/main.rs'))
  assert.match(main, /\.manage\(CommittedPages::default\(\)\)/, 'the record is the app\'s')
  assert.match(main, /\.on_page_load\(\|webview, payload\| \{\s*if payload\.event\(\) == tauri::webview::PageLoadEvent::Started \{\s*page_committed\(webview, payload\.url\(\)\);/,
    'the page-load hook records the committed page first, at Started')
  assert.match(main, /WindowEvent::Destroyed[^}]*\}\s*=\s*&event\s*\{[^}]*window_gone\(app, label\);/, 'a destroyed window\'s record goes')
  assert.match(main, /fn window_gone<R: tauri::Runtime>\(app: &AppHandle<R>, label: &str\) \{[^}]*\.retain\(\|webview, _\| webview != label && app\.get_webview\(webview\)\.is_some\(\)\);/,
    'and the records of its tabs, which Tauri no longer holds')
  const shell = rust(await repo('desktop/cradle/src-tauri/src/native_shell.rs'))
  const admit = shell.slice(shell.indexOf('pub(crate) fn admit_candidate_webview<R: tauri::Runtime>('), shell.indexOf('pub(crate) fn admit_candidate_view<R: tauri::Runtime>('))
  assert.match(admit, /let committed = crate::committed_page\(webview\.app_handle\(\), label\);/, 'the candidate admission reads the committed page')
  assert.match(admit, /if shell\(&url\) && committed\.as_ref\(\)\.is_some_and\(shell\)/, 'and requires both to be the shell\'s page')
})

// O-I #747 round 896, 1T item 11 (review c99c L6): the material frame is `oi-material://application.localhost` on macOS and Linux, and
// `http://oi-material.application.localhost` on Windows and Android, where Tauri serves a custom scheme by http. The CSP names both, in
// the everyday config and in the candidate's overlay (which replaces `frame-src`), so a Windows frame is not refused by the CSP.
test('1T: the frame-src of the shell\'s CSP names the material frame in both its forms, everyday and candidate', async () => {
  const everyday = JSON.parse(await repo('desktop/cradle/src-tauri/tauri.conf.json')).app.security.csp['frame-src'].split(/\s+/)
  const candidate = JSON.parse(await repo('packages/live-shell/tauri.candidate.conf.json')).app.security.csp['frame-src'].split(/\s+/)
  for (const sources of [everyday, candidate]) {
    assert.ok(sources.includes('oi-material:'), sources.join(' '))
    assert.ok(sources.includes('http://oi-material.application.localhost'), sources.join(' '))
    assert.ok(!sources.some(source => /^https?:$|\*/.test(source)), 'no other page by scheme or wildcard')
  }
})
