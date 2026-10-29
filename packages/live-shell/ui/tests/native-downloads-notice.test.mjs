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

test('the main window is built from its config with the download receiver; nothing about it but the receiver changes', async () => {
  const main = await repo('desktop/cradle/src-tauri/src/main.rs')
  assert.match(main, /\nmod downloads;\n/)
  assert.match(main, /\.filter\(\|window\| window\.create\)\s*\.map\(\|window\| \{\s*window\.create = false;\s*\(window\.label\.clone\(\), None\)\s*\}\)/,
    'every window the config would auto-create is taken, keeping no store of its own')
  assert.match(main, /tauri::WebviewWindowBuilder::from_config\(app, &config\)\?;/, 'built from its own config, as auto-create builds it')
  assert.match(main, /builder\.on_download\(downloads::receiver\(\)\)\.build\(\)\?;/)
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
