import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

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
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)
// Parity batches B2 and B5 (world-shell-mockup.html rev 5, DLW manual §10.1, §10.5): the transport and the status bar the shell draws, rendered
// as the shell renders them (each mode's bindings over the one transport, its lazy parts fetched first as f7-transport.test.mjs does).
//  - Home (the mockup's #home) stands between the playing keys and the map in every mode and opens the Earth in Technē (G13);
//  - Technē's Draw is the Earth's Place tool and its Follow the focused pane's Follow/Pin (G4), each live or dimmed with its reason;
//  - the title line's Back and Forward say the trail (G11);
//  - the status bar's "aperture" is the field aperture, its panes counted apart (G12); the Clip switch carries the clip's picture (F8).
// The ▤ detail toggle the mockup draws stays out: manual §10.1 lists the transport's groups with no detail toggle (the keys and the
// status bar's ▲ do it), which the parity audit §6.5 names as the mockup gone stale.
const {ModeTransport} = await import('../src/shell/modeTransports.tsx')
const {TransportBar} = await import('../src/components/TransportBar.tsx')
const {HOME, TransportHome, pressHome} = await import('../src/frame/transport/HomeSlot.tsx')
const {followBinding} = await import('../src/shell/transports/useTechneTransport.tsx')
const {SURF_MODES} = await import('../src/shell/modeGrammar.ts')
const {createTimeSpine} = await import('../src/timeline/timeSpine.ts')
const {statusApertureWords, clipPictureOf, ClipPicture} = await import('../src/components/StatusBar.tsx')
const {publishInstrumentOpener, bringInstrumentIntoView} = await import('../src/frame/instrumentDoor.ts')
await (await import('../src/shell/loadWhenDrawn.ts')).loadEveryPart()

const html = element => renderToStaticMarkup(element)
const tags = markup => [...markup.matchAll(/<(button|output|select)[^>]*>/g)].map(match => match[0])
const enabled = tag => !/\sdisabled=""/.test(tag)
const slotTag = (markup, id) => tags(markup).find(tag => tag.includes(`data-slot="${id}"`)) ?? ''
const bar = (mode, door = {mode, chooseMode() {}}) => html(createElement(TransportHome.Provider, {value: door},
  createElement(ModeTransport, {mode, reading: {timeSpine: createTimeSpine(), tempoBpm: null}})))

if (process.env.B2_DUMP) for (const mode of SURF_MODES) {
  console.log(`== ${mode}`)
  for (const tag of tags(bar(mode))) console.log((tag.match(/data-slot="([^"]+)"/)?.[1] ?? (tag.includes('data-transport-home') ? 'HOME' : '-')).padEnd(12), enabled(tag) ? 'live' : 'dim ', tag.match(/data-i="([^"]{0,110})/)?.[1])
}

test('Home stands between the playing keys and the map in every mode, live, wearing the Earth', () => {
  for (const mode of SURF_MODES) {
    const markup = bar(mode)
    const home = tags(markup).find(tag => tag.includes('data-transport-home'))
    assert.ok(home, `${mode}: Home is drawn`)
    assert.ok(enabled(home), `${mode}: Home is live`)
    assert.match(home, /aria-label="Home"/)
    const at = markup.indexOf('data-transport-home')
    assert.ok(markup.lastIndexOf('data-slot="keys"', at) > 0 && markup.indexOf('data-slot="key-map"', at) > at, `${mode}: after the keys, before the map (the mockup's order)`)
  }
  // without the frame's door (a bar drawn outside the shell) Home stands dimmed, never a press that goes nowhere
  const lone = html(createElement(ModeTransport, {mode: 'live', reading: {tempoBpm: null}}))
  assert.ok(!enabled(tags(lone).find(tag => tag.includes('data-transport-home'))))
})

test('Home switches to Technē, then brings the Earth into Technē\'s panes; in Technē it only brings the Earth', () => {
  const calls = []
  pressHome('live', {chooseMode: mode => calls.push(['mode', mode]), bring: () => calls.push(['bring'])})
  assert.deepEqual(calls, [['mode', HOME.mode], ['bring']], 'the switch first, then the Earth: one queue on the book, so it lands in Technē')
  calls.length = 0
  pressHome('techne', {chooseMode: mode => calls.push(['mode', mode]), bring: () => calls.push(['bring'])})
  assert.deepEqual(calls, [['bring']])
  assert.equal(HOME.kind, 'projection.earth', 'the Earth the browser\'s Instruments open')
  // the door it presses is the pane tree's own: bringInstrumentIntoView asks the published opener for the Earth, in view
  const asked = []
  publishInstrumentOpener((kind, at) => asked.push([kind, at]))
  try { bringInstrumentIntoView(HOME.kind) } finally { publishInstrumentOpener(null) }
  assert.deepEqual(asked, [['projection.earth', 'in-view']])
  assert.throws(() => bringInstrumentIntoView(HOME.kind), /No pane tree is mounted/, 'with no pane tree, Home says so on the line')
})

test('Technē\'s Draw is the Earth\'s Place tool: dimmed with the plate\'s words while no Earth is open', () => {
  const draw = slotTag(bar('techne'), 'draw')
  assert.ok(draw && !enabled(draw), 'no Earth open: drawn dimmed')
  assert.match(draw, /The Earth is not open in this session, so there is no globe to place on/, 'the Place tool\'s own refusal')
})

test('Technē\'s Follow is the focused pane\'s Follow/Pin: lit while it follows, pins to THE selection, lets a pinned pane follow again', () => {
  const pins = []
  const pane = (over = {}) => ({id: 's1', kind: 'projection.earth', title: 'Earth', index: 1, count: 1, follows: true, pin: ref => pins.push(ref), ...over})
  assert.match(followBinding(null, null).refused, /No pane is focused/)
  assert.match(followBinding(pane({follows: false}), null).refused, /holds its own subject/)
  const following = followBinding(pane(), {ref: 'thing:bollingen', title: 'Bollingen'})
  assert.equal(following.lit, true)
  following.press()
  assert.deepEqual(pins, ['thing:bollingen'])
  const pinned = followBinding(pane({pinned: 'thing:bollingen'}), null)
  assert.equal(pinned.lit, false)
  pinned.press()
  assert.deepEqual(pins, ['thing:bollingen', undefined], 'pinned, Follow lets it follow again')
  assert.equal(followBinding(pane(), null).press, undefined, 'following with nothing selected: nothing to pin to, so no press')
  // in the bar, with no pane tree mounted, Follow stands dimmed with its reason
  const follow = slotTag(bar('techne'), 'follow')
  assert.ok(follow && !enabled(follow)); assert.match(follow, /No pane is focused/)
})

test('the title line\'s Back and Forward say the trail, never the browser\'s categories', async () => {
  const source = await readFile(new URL('../src/components/TransportBar.tsx', import.meta.url), 'utf8')
  assert.match(source, /`Back\|Back along the trail to \$\{back\.label\}\.`/)
  assert.match(source, /`Forward\|Forward along the trail to \$\{forward\.label\}\.`/)
  const markup = html(createElement(TransportBar, {tempoBpm: null, name: 'Mercurius sketch', mode: 'live', view: 'session', setView() {}, chooseMode() {},
    browser: true, dock: true, toggleBrowser() {}, toggleDock() {}}))
  assert.match(markup, /aria-label="Back"[^>]*data-i="Back\|Nothing before this on the trail yet\."/)
  assert.ok(tags(markup).some(tag => tag.includes('data-transport-home') && enabled(tag)), 'the shell\'s bar hands Home its door')
})

test('the status bar\'s aperture is the field aperture, its panes counted apart (the mockup\'s "aperture shared · 2 panes")', () => {
  assert.equal(statusApertureWords('shared', {panes: 2, pinned: 0}), 'aperture shared · 2 panes')
  assert.equal(statusApertureWords('federated', {panes: 3, pinned: 2}), 'aperture federated · 3 panes · 2 pinned')
  assert.doesNotMatch(statusApertureWords('world', {panes: 1, pinned: 1}), /aperture \d/, '"aperture" never names a count of pinned panes')
})

test('the Clip switch carries a small picture of the selected clip: its track\'s colour, dimmed when done, the record colour while it records', () => {
  const tracks = {tracks: [{id: 't1', name: 'Drums', color: '#e2a35e', kind: 'midi'}], clips: [{id: 'c1', trackId: 't1', columnId: 's1', label: 'Kit 1', status: 'running'}]}
  assert.deepEqual(clipPictureOf(tracks, 'c1'), {label: 'Kit 1', color: '#e2a35e', status: 'running'})
  assert.equal(clipPictureOf(tracks, 'c9'), null, 'a clip the views do not draw has no picture')
  assert.equal(clipPictureOf(null, 'c1'), null)
  const picture = html(createElement(ClipPicture, {picture: {label: 'Kit 1', color: '#e2a35e', status: 'done'}}))
  assert.match(picture, /class="status-clip-picture"/); assert.match(picture, /data-status="done"/); assert.match(picture, /--tc:#e2a35e/)
})
