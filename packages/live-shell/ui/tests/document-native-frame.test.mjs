// Central's document forms in the native app (Ticket I): the Flow and the Day die draw in their panes, and their island
// read and save run, under Tauri. A srcdoc document inherits the shell window's CSP (script-src: a hash, no
// 'unsafe-inline'), so natively every inline script of the form was refused — the Flow pane's head over blank paper
// (seen on screen, native candidate ae9301a1b). Under Tauri the faces' iframe is now the native document frame
// (kernel `document_frame`, served by the host's oi-material protocol with no policy), written with the very projection
// a srcdoc frame carries; over the walk-bridge and in the browser preview the faces keep srcdoc.
// Channels: SCRIPTED — the transport switch and the write gate (frame.ts), and the frame page's own script run in a VM
// against a fake window/parent/document. CODE-READING — the faces' iframe props and the protocol's route order. NOT a
// screen pass: the native draw, island read and saves are owed the lead's computer-use pass on the built candidate.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import vm from 'node:vm'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) return r
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.includes('?raw')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const root = new URL('../../../../', import.meta.url)
const frame = await import(new URL('desktop/cradle/src/document/frame.ts', root).href)
const page = await readFile(new URL('desktop/cradle/kernel/src/document_frame.html', root), 'utf8')
const kernelModule = await readFile(new URL('desktop/cradle/kernel/src/document_frame.rs', root), 'utf8')
const constant = name => kernelModule.match(new RegExp(`pub const ${name}: &str = "([^"]+)";`))?.[1]

// ── the transport switch (scripted) ──────────────────────────────────────

test('under Tauri the frame is the native document frame; over the bridge and in the preview it stays srcdoc', () => {
  const html = '<!doctype html><html><head></head><body>form</body></html>'
  const native = frame.documentFrameProps('tauri', html)
  assert.equal(native.src, 'oi-material://localhost/__application/document/frame.html')
  assert.equal(native.srcDoc, undefined, 'no srcdoc natively: it would inherit the window\'s policy')
  for (const kind of ['bridge', 'unavailable']) {
    assert.deepEqual(frame.documentFrameProps(kind, html), {key: 'srcdoc', srcDoc: html}, kind)
  }
})

test('the native frame\'s key follows the projection: unchanged keeps the frame, a new projection is a fresh frame', () => {
  const a = '<html><head></head><body>a</body></html>'
  const b = '<html><head></head><body>b</body></html>'
  assert.equal(frame.documentFrameProps('tauri', a).key, frame.documentFrameProps('tauri', a).key, 'the person\'s in-form edits are never dropped by a re-render')
  assert.notEqual(frame.documentFrameProps('tauri', a).key, frame.documentFrameProps('tauri', b).key)
  assert.notEqual(frame.documentFrameProps('tauri', a).key, frame.documentFrameProps('tauri', a + ' ').key)
  assert.equal(frame.documentFrameProps('bridge', a).key, frame.documentFrameProps('bridge', b).key, 'srcdoc keeps one frame and moves its document, as before')
})

test('the host writes the projection only to its own frame\'s window, and only when it asks', () => {
  const own = {name: 'frame window'}
  const ready = {type: frame.DOCUMENT_FRAME_READY}
  assert.deepEqual(frame.documentFrameWrite({data: ready, source: own}, own, '<p>doc</p>'), {type: 'oi:document-frame-write', html: '<p>doc</p>'})
  assert.equal(frame.documentFrameWrite({data: ready, source: {name: 'another frame'}}, own, 'x'), null, 'another source is refused')
  assert.equal(frame.documentFrameWrite({data: ready, source: undefined}, undefined, 'x'), null, 'no frame mounted, nothing written')
  assert.equal(frame.documentFrameWrite({data: {type: 'oi:document-host-response'}, source: own}, own, 'x'), null)
  assert.equal(frame.documentFrameWrite({data: null, source: own}, own, 'x'), null)
})

// ── the frame page itself (scripted, in a VM) ─────────────────────────────

function runPage({topLevel = false} = {}) {
  const script = page.match(/<script>([\s\S]*?)<\/script>/)[1]
  const posted = [], calls = [], listeners = new Map()
  const parent = {postMessage: (message, origin) => posted.push({message, origin})}
  const context = {
    document: {open: () => calls.push('open'), write: html => calls.push(['write', html]), close: () => calls.push('close')},
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type) },
  }
  context.window = context
  context.parent = topLevel ? context : parent
  vm.runInNewContext(script, context)
  const send = (data, source = parent) => listeners.get('message')?.({data, source})
  return {posted, calls, listeners, send, parent}
}

test('the frame page asks its parent once and writes exactly what its parent sends, once', () => {
  const run = runPage()
  // The VM's objects carry its own realm's prototypes: compare their JSON.
  assert.deepEqual(JSON.parse(JSON.stringify(run.posted)), [{message: {type: 'oi:document-frame-ready'}, origin: '*'}])
  run.send({type: 'oi:document-frame-write', html: '<p>evil</p>'}, {postMessage() {}})
  run.send({type: 'oi:document-frame-other', html: '<p>no</p>'})
  run.send({type: 'oi:document-frame-write', html: 42})
  assert.deepEqual(run.calls, [], 'another window, another message, or no document: nothing written')
  run.send({type: 'oi:document-frame-write', html: '<!doctype html><p>the form</p>'})
  assert.deepEqual(run.calls, ['open', ['write', '<!doctype html><p>the form</p>'], 'close'])
  assert.equal(run.listeners.has('message'), false, 'its listener is gone once it has written')
})

test('loaded top-level, the frame page asks nothing and writes nothing', () => {
  const run = runPage({topLevel: true})
  assert.deepEqual(run.posted, [])
  assert.equal(run.listeners.size, 0)
})

// ── one contract across the host and the page (code-reading) ──────────────

test('the page, the kernel module and the faces\' URL name one path and one pair of messages', async () => {
  assert.equal(constant('PATH'), '/__application/document/frame.html')
  assert.equal(frame.DOCUMENT_FRAME_URL, `oi-material://localhost${constant('PATH')}`)
  assert.equal(constant('READY'), frame.DOCUMENT_FRAME_READY)
  assert.equal(constant('WRITE'), frame.DOCUMENT_FRAME_WRITE)
  assert.match(page, /parent\.postMessage\(\{type: 'oi:document-frame-ready'\}, '\*'\)/)
  assert.match(page, /data\.type !== 'oi:document-frame-write'/)
  assert.doesNotMatch(page, /content-security-policy|http-equiv/i, 'the written form runs its own scripts')
  const protocol = await readFile(new URL('desktop/cradle/src-tauri/src/material_protocol.rs', root), 'utf8')
  const frameRoute = protocol.indexOf('oi_cradle_kernel::document_frame::serve(')
  assert.ok(frameRoute > 0, 'the protocol answers the frame path')
  assert.ok(frameRoute < protocol.indexOf('if path.starts_with("/__application/")'), 'before the application asset route, which admits only the Expressions build')
  assert.doesNotMatch(protocol.slice(protocol.indexOf('fn document_frame('), protocol.indexOf('fn world_file(')), /Content-Security-Policy/, 'the frame response carries no policy header')
})

test('both document faces take their iframe\'s document from the transport switch', async () => {
  for (const file of ['DocumentFlowFace.tsx', 'DocumentDayDieFace.tsx']) {
    const source = await readFile(new URL(`../src/inhabitants/${file}`, import.meta.url), 'utf8')
    assert.match(source, /const frameProps = useDocumentFrame\(frame, face, transport\)/, file)
    assert.match(source, /<iframe key=\{frameProps\.key\} ref=\{frame\} [^>]*sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" src=\{frameProps\.src\} srcDoc=\{frameProps\.srcDoc\}\/>/, file)
    assert.doesNotMatch(source, /srcDoc=\{face\}/, `${file}: no srcdoc by default — natively it would inherit the window's policy`)
  }
  const flow = await readFile(new URL('../src/inhabitants/DocumentFlowFace.tsx', import.meta.url), 'utf8')
  assert.match(flow, /useDocumentHostRead\(frame, true\)/, 'the island read still asks the frame\'s own window')
  const day = await readFile(new URL('../src/inhabitants/DocumentDayDieFace.tsx', import.meta.url), 'utf8')
  assert.match(day, /event\.source !== frame\.current\?\.contentWindow/, 'the die\'s bridge still answers only its own frame')
})

test('a Flow\'s re-read takes the owner\'s page as the new baseline: seen on r7, a title written from Clip view left the pane "edited since save"', async () => {
  const flow = await readFile(new URL('../src/inhabitants/DocumentFlowFace.tsx', import.meta.url), 'utf8')
  const reread = flow.match(/const reread = useCallback\(\(\) => \{([\s\S]*?)\}, \[load\]\)/)
  assert.ok(reread, 'the face keeps one re-read')
  // The re-read asks the owner fresh, whatever the window holds (O-I #820: readFlowInstance's fresh flag).
  for (const step of ['baselineText.current = undefined', 'draftBasis.current = undefined', 'setBaselined(false)', 'setDirty(false)', 'void load(true)'])
    assert.ok(reread[1].includes(step), `the re-read does ${step}`)
  assert.match(flow, /reread: pending \? undefined : reread,/, 'the door carries that re-read, never the bare load')
})
