import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Ticket C: the status bar's left is Live's Info view (manual §10.1: "Read what any control does"; the mockup's #info):
// whatever the pointer enters that carries data-i — or a title — reads there; idle it says how to use it, and while the
// native World is read it says that instead, in the line and never drawn over it. Channel: scripted.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document = {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage = {getItem: () => null, setItem: () => {}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const {StatusBar, infoOf, INFO_IDLE, INFO_READING_WORLD} = await import('../src/components/StatusBar.tsx')
const {publishFoundationPending, foundationPending} = await import('../src/native/foundationDoor.ts')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const state = {set: null, path: null, error: null, loading: false}
const bar = (props = {}) => renderToStaticMarkup(React.createElement(StatusBar, {state, documentError: null, viewport: [1440, 900], audio: false, mode: 'base', reading: null, detailMode: 'clip', changeDetailMode: () => {}, presentedView: 'session', ...props}))
const line = markup => markup.match(/<div class="statusbar-info-line"[^>]*>(.*?)<\/div>/)?.[1]

/** A stand-in element: `closest` answers with the nearest holder the selector names, as the DOM does. */
const element = (attributes, parent = null) => ({
  getAttribute: name => attributes[name] ?? null,
  closest(selector) {
    const wanted = [...selector.matchAll(/\[([a-z-]+)\]/g)].map(m => m[1])
    for (let node = this; node; node = node.parent) if (wanted.some(name => (node.attrs[name] ?? '') !== '')) return node
    return null
  },
  attrs: attributes, parent,
})

test('idle, the Info line says how to use it; while the native World is read, it says that — in the line', () => {
  publishFoundationPending(false)
  assert.equal(line(bar()), `<b>Info</b>${INFO_IDLE}`)
  assert.equal(INFO_IDLE, 'Hover anything to read what it does.')
  publishFoundationPending(true)
  assert.equal(foundationPending(), true)
  assert.equal(line(bar()), `<b>Info</b>${INFO_READING_WORLD}`)
  assert.match(bar(), /data-info="reading-world"/)
  publishFoundationPending(false)
})

test('a reading the shell already holds (the agent frame\'s data-i) stands in the line until the pointer reads another', () => {
  assert.equal(line(bar({agentInfo: {label: 'Run', fn: 'Launch the selected task.'}})), '<b>Run</b>Launch the selected task.')
})

test('the Info view reads the nearest data-i, else the nearest title, at any depth', () => {
  const slot = element({'data-i': 'Die face|the Day die\'s open face; ‹ › turns it', title: 'Die face — long title'})
  assert.deepEqual(infoOf(element({}, slot)), {label: 'Die face', fn: 'the Day die\'s open face; ‹ › turns it'}, 'an icon inside a slot reads its slot')
  assert.deepEqual(infoOf(element({title: 'Pop out — into its own native window'})), {label: 'Pop out', fn: 'into its own native window'})
  assert.deepEqual(infoOf(element({title: 'Viewport 1440 × 900', 'aria-label': 'Status'})), {label: 'Status', fn: 'Viewport 1440 × 900'})
  assert.equal(infoOf(element({})), null, 'nothing to read: the last reading stays')
  assert.deepEqual(infoOf(element({'data-i': '', title: 'Clip — the clip in focus'})), {label: 'Clip', fn: 'the clip in focus'}, 'an empty data-i is no reading')
})

test('the status bar carries no identity path; the work\'s identity is the title line\'s', async () => {
  const markup = bar()
  assert.doesNotMatch(markup, /statusbar-path/)
  assert.match(markup, /data-region="info-view"/)
  assert.match(markup, /data-region="run-context"/, 'the run context still stands in every mode')
  assert.match(markup, /<nav class="status-detail-views"/, 'the detail switch still stands')
  const code = await source('components/StatusBar.tsx')
  // REPLACED (be2o ruling 2): `document.addEventListener('mouseover', over)` — the one reader now takes focus as it takes the pointer.
  assert.match(code, /onInfoEvents\(document, /, 'one delegated reader over the whole window')
  assert.match(code, /parseDataI/, 'the shell\'s one info law (agent/statusInfo.ts), not a second parser of data-i')
})

test('the pending note is never drawn over the status bar: the foundation publishes it and the fixed overlay is gone', async () => {
  const foundation = await source('native/Foundation.tsx')
  assert.doesNotMatch(foundation, /native-foundation-pending/)
  assert.match(foundation, /publishFoundationPending\(pending\)/)
  const css = await source('styles.css')
  assert.doesNotMatch(css, /native-foundation-pending/)
  // lane F (F4): the line keeps a floor (min-width:0 left it one letter natively); status-info-room.test.mjs holds the room rules
  assert.match(css, /\.statusbar-info-line \{ flex:1 1 0; min-width:min\(45%, 560px\); height:20px;[^}]*background:var\(--bg-0\)/, 'the line is the mockup\'s .sb .info')
})

test('the status bar reads the aperture the panes stand in (the mockup\'s "aperture shared · 2 panes"), as the Workbench publishes it', async () => {
  const door = await import('../src/native/workbenchDoor.ts')
  assert.equal(door.apertureWords({panes: 2, pinned: 0}), 'aperture shared · 2 panes')
  assert.equal(door.apertureWords({panes: 1, pinned: 1}), 'aperture 1 pinned · 1 pane')
  door.publishWorkbenchAperture({panes: 2, pinned: 0})
  const held = door.useWorkbenchAperture
  assert.equal(typeof held, 'function')
  const source = (await import('node:fs/promises')).readFile
  const bar = await source(new URL('../src/components/StatusBar.tsx', import.meta.url), 'utf8')
  assert.match(bar, /apertureWords\(aperture\)/, 'the status bar draws the published aperture')
  const bench = await source(new URL('../src/native/Workbench.tsx', import.meta.url), 'utf8')
  assert.match(bench, /publishWorkbenchAperture\(presented \? \{panes: groups\.length, pinned\} : null\)/, 'the Workbench publishes it while presented')
})

// be2o ruling 2 (DLW build ruling 2026-11-11): the Info line reads what takes the keyboard's focus as it reads what the pointer enters, so
// a person who reaches a control by Tab reads what the same control says under the pointer. One list of events, used by every reader of
// the line: the status bar's, the agent frame's and a device window's.
test('focus alone shows what hover shows: every reader of the Info line takes focusin as it takes mouseover', async () => {
  const {INFO_EVENTS, onInfoEvents} = await import('../src/agent/statusInfo.ts')
  const {infoOfEvent} = await import('../src/components/StatusBar.tsx')
  assert.deepEqual([...INFO_EVENTS], ['mouseover', 'focusin'])
  const heard = new Map()
  const target = {addEventListener: (name, read) => heard.set(name, read), removeEventListener: (name, read) => { if (heard.get(name) === read) heard.delete(name) }}
  const read = []
  const detach = onInfoEvents(target, event => read.push(infoOfEvent(event)))
  assert.deepEqual([...heard.keys()].sort(), ['focusin', 'mouseover'])
  const approve = element({'data-i': 'Approve|Opens the pane, where the request stands as it was sent. Approve it there.'})
  heard.get('mouseover')({target: element({}, approve)})
  heard.get('focusin')({target: approve})
  assert.equal(read.length, 2)
  assert.deepEqual(read[1], read[0], 'the same reading, by focus alone')
  assert.deepEqual(read[1], {label: 'Approve', fn: 'Opens the pane, where the request stands as it was sent. Approve it there.'})
  assert.equal(infoOfEvent({target: null}), null)
  assert.equal(infoOfEvent({target: {}}), null, 'what is no element reads nothing')
  detach()
  assert.equal(heard.size, 0, 'both are detached together')
  // Each reader listens through the one list, never to mouseover alone.
  const bar = await source('components/StatusBar.tsx'), frame = await source('agent/statusInfo.ts'), windows = await source('frame/devices/DeviceWindows.tsx'), relayed = await source('frame/devices/RelayedDevice.tsx')
  assert.match(bar, /return onInfoEvents\(document, event => \{ const read = infoOfEvent\(event\)/)
  assert.match(frame, /return onInfoEvents\(frame, event => \{/)
  for (const text of [bar, frame]) assert.doesNotMatch(text, /addEventListener\('mouseover'/)
  assert.match(windows, /return \{info, onMouseOver: take, onFocus: take\}/)
  assert.match(windows, /onFocus=\{info\.onFocus\} onMouseOver=\{info\.onMouseOver\}/)
  assert.match(relayed, /onFocus=\{info\.onFocus\} onMouseOver=\{info\.onMouseOver\}/)
})
