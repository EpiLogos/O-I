// T-REALIGN R2: the detail area holds Clip view over Device view, both at once when there is room, as Live 12 does (manual §16.4;
// Live 12.0.25 cap 31); ⇧Tab switches when one shows; the status bar's Clip and Device switches show or hide each; ⌥⌘E gives Clip
// view the main area and returns it (cap 29). One clip host draws the mode's designed clip through the device host's change path, so
// a refused change keeps the owner's words. Channels: SCRIPTED (pure functions; the host rendered to static markup through the
// transpiling loader) and code-reading (App.tsx, StatusBar.tsx).
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

const sides = await import('../src/frame/detail/detailSides.ts')
const {clipAsDevice} = await import('../src/frame/detail/ClipHost.tsx')
const {clipShape} = await import('../src/frame/detail/clipBinding.ts')
const {HostedDevice, setHosted, flushDrafts, hostState, resetHost} = await import('../src/frame/devices/deviceHost.tsx')
const {loadClip} = await import('../src/inhabitants/catalogue/clips/index.ts')
const {CLIP_ROOM} = await import('../src/inhabitants/catalogue/clips/design.ts')
const factory = await import('../src/agent/clipBinding.ts')
const {SETTINGS_WHY} = await import('../src/agent/sessionSettings.ts')
const {trackKey} = await import('../src/agent/agentRunModel.ts')
const {DetailHost} = await import('../src/frame/detail/DetailHost.tsx')
const {DetailContext} = await import('../src/frame/detail/detailReading.ts')
const {publishTimelineReading} = await import('../src/projections/timelinePaneHost.ts')
const {publishShownTracks} = await import('../src/frame/tracks/tracksDoor.ts')

const kept = (front, hidden = {}) => ({front, hidden: {clip: false, device: false, ...hidden}})
const both = sides.CLIP_MIN_H + sides.CHAIN_MIN_H

test('both sides stand when both fit; one, the front, when they do not; ⌥⌘E leaves Device view in the detail area', () => {
  assert.equal(sides.fitsBoth(both), true); assert.equal(sides.fitsBoth(both - 1), false)
  assert.deepEqual(sides.shownSides(kept('clip'), both), {clip: true, device: true}, 'Live 12: Clip view over Device view')
  assert.deepEqual(sides.shownSides(kept('device'), both), {clip: true, device: true}, 'the front side changes nothing while both stand (cap 31)')
  assert.deepEqual(sides.shownSides(kept('clip'), 300), {clip: true, device: false})
  assert.deepEqual(sides.shownSides(kept('device'), 300), {clip: false, device: true})
  assert.deepEqual(sides.shownSides(kept('device', {clip: true}), 900), {clip: false, device: true}, 'a hidden side stays hidden, however tall')
  assert.deepEqual(sides.shownSides(kept('clip'), 900, true), {clip: false, device: true}, 'expanded, Clip view is in the main area')
  assert.equal(sides.clipHeightIn(900, true), 900 - sides.CHAIN_H); assert.equal(sides.clipHeightIn(both, true), sides.CLIP_MIN_H)
  assert.equal(sides.clipHeightIn(300, false), 300)
})

test('⇧Tab brings the other side to the front and shows it; a status bar switch shows or hides its side, never the last one standing', () => {
  assert.deepEqual(sides.switchSide(kept('clip')), kept('device'))
  assert.deepEqual(sides.switchSide(kept('device', {clip: true})), kept('clip'), 'the side ⇧Tab brings is shown')
  const standing = {clip: true, device: true}
  assert.deepEqual(sides.toggleSide(kept('clip'), 'clip', standing), {front: 'device', hidden: {clip: true, device: false}}, 'hide Clip view: Device view stands alone')
  assert.deepEqual(sides.toggleSide(kept('device', {clip: true}), 'clip', {clip: false, device: true}), kept('clip'), 'show it again')
  assert.deepEqual(sides.toggleSide(kept('device'), 'device', {clip: false, device: true}), kept('device'), 'the last side standing stays (⌘⌥L hides the area)')
  assert.deepEqual(sides.toggleSide(kept('device'), 'clip', {clip: false, device: true}), kept('clip'), 'a side the area is too short for comes to the front')
})

test('⌥⌘E is Option and Command with E, whatever letter the dead key types', () => {
  const key = (over = {}) => ({key: 'e', code: 'KeyE', shiftKey: false, metaKey: true, altKey: true, ctrlKey: false, ...over})
  assert.equal(sides.expandsClip(key()), true)
  assert.equal(sides.expandsClip(key({key: '´'})), true, 'macOS: ⌥E is a dead key; the code names it')
  assert.equal(sides.expandsClip(key({altKey: false})), false); assert.equal(sides.expandsClip(key({shiftKey: true})), false)
  assert.equal(sides.expandsClip(key({ctrlKey: true})), false); assert.equal(sides.expandsClip(key({key: 'l', code: 'KeyL'})), false)
})

// ---------------------------------------------------------------------------------------------------------------- the host

const T = (h, m) => Date.UTC(2026, 9, 8, h, m)
const track = {sessionRef: 'ses-214', purpose: 'correlate occurrences', agentRef: 'agent:fizz', agentName: 'Fizz', agentAccepted: true,
  spaceRef: 'space:lead', spaceLabel: null, depth: 0, parentRef: null, group: false, memberRefs: [], needle: null, telemetryOn: false,
  budget: {used: 2, max: 12}, disclosure: null, tasks: [{n: 1, title: 'correlate occurrences', state: 'running', startUnixMs: T(13, 41), lastActivityUnixMs: T(14, 24), softStop: false, disclosure: null}]}
const taskRef = `${trackKey(track)}#task/1`

test('one clip host: the designed clip drawn whole through the device host, Launch left out where the clip is placed', async () => {
  const design = await loadClip('factory')
  const draw = (binding, size = 'detail') => renderToStaticMarkup(createElement(HostedDevice, {designed: clipAsDevice(clipShape(design, binding), size, CLIP_ROOM[size]),
    binding, view: 'whole', nav: {}, room: CLIP_ROOM[size], title: design.title}))
  const launched = draw(factory.factoryClipBinding({ref: taskRef, tracks: [track], events: []}))
  assert.match(launched, /class="clv" data-clip-mode="factory" data-size="detail"/)
  assert.match(launched, /role="tab"[^>]*>Clip<\/button><button[^>]*role="tab"[^>]*>Launch</, 'Clip and Launch, Live\'s panel one')
  assert.match(launched, />correlate occurrences</, 'the task\'s name on the head')
  const placed = draw(factory.factoryClipBinding({ref: taskRef, tracks: [track], events: [], placed: true}), 'expanded')
  assert.match(placed, /data-size="expanded"/)
  assert.doesNotMatch(placed, /role="tab"[^>]*>Launch</, 'a placed clip has no Launch tab')
})

test('a refused change goes nowhere but the Info line: the owner\'s words stand on the key, and the view\'s keys never reach an owner', async () => {
  resetHost()
  const binding = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: []})
  assert.equal(setHosted(binding, 'launch', 'loop'), true, 'a change the owner is asked for is a draft until the hand lets go')
  const refusal = await flushDrafts(binding, 0)
  assert.equal(refusal, SETTINGS_WHY.notHere)
  assert.equal(hostState(binding.id).refused.launch.reason, SETTINGS_WHY.notHere, 'the words, kept on the key')
  assert.equal(hostState(binding.id).sent.launch, undefined, 'nothing waits on an owner that refused')
  assert.equal(setHosted(binding, 'view.editor', 'envelopes'), false, 'which tab shows is the view\'s: no draft, no owner')
  resetHost()
})

const reading = mode => ({mode, transport: {kind: 'unavailable', reason: 'test'}, world: null, worldCut: false, centralSubject: null,
  live: {ctx: null, document: null, selection: {track: 0, scene: null}}, native: {}, factory: {tracks: [track]}, focusedInstrument: null})
const host = props => renderToStaticMarkup(createElement(DetailContext.Provider, {value: reading('factory')}, createElement(DetailHost, props)))

test('the host stands one side where it has no room for two (its first measure), the front one; the clip side waits in the mode\'s words', async () => {
  publishTimelineReading({mode: 'factory', set: null, document: null, colors: [], selection: {track: 0, scene: null}, select() {}, setColor() {}, selectedRef: undefined, selectTrackItem() {}})
  publishShownTracks(null)
  const clipFront = host({sides: kept('clip')})
  assert.match(clipFront, /data-stack="clip"/)
  assert.match(clipFront, /<p class="clip-empty" role="status">Select a task on a session&#x27;s track to open it in Clip view/)
  assert.match(clipFront, /data-detail-side="device" hidden=""/, 'Device view is concealed, not drawn over')
  // The device side is drawn only once it stands (the hidden-inhabitant law mounts it on first use): never under a clip-front first measure.
  assert.doesNotMatch(clipFront, /data-detail-body=/)
  publishTimelineReading(null)
})

test('the frame wires the sides: the front side, the hidden ones, ⇧Tab, ⌥⌘E and the status bar\'s Clip | Device switches in every mode', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /<DetailHost sides=\{\{front: detailMode, hidden: hiddenSides\}\} expanded=\{clipExpanded\} \/>/)
  assert.match(app, /if \(expandsClip\(event\) && !event\.defaultPrevented && !settingsPresented\) \{ event\.preventDefault\(\); setClipExpanded\(expanded => !expanded\)/)
  assert.match(app, /if \(switchesDetailSide\(event\)[^\n]*changeDetailMode\(side => side === 'clip' \? 'device' : 'clip'\)/)
  assert.equal((app.match(/toggleDetailSide=\{toggleDetailSide\}/g) ?? []).length, 2, 'both status bars carry the switches')
  const bar = await readFile(new URL('../src/components/StatusBar.tsx', import.meta.url), 'utf8')
  // Manual §10.1: a switch brings its view forward (⌥-click shows both); ▲ beside it shows or hides that view.
  assert.match(bar, /aria-label="Clip view" data-detail-side="clip" aria-pressed=\{shown\('clip'\)\}[\s\S]{0,400}onClick=\{event => bring\('clip', event\.altKey\)\}/)
  assert.match(bar, /aria-label="Device view" data-detail-side="device" aria-pressed=\{shown\('device'\)\}[\s\S]{0,400}onClick=\{event => bring\('device', event\.altKey\)\}/)
  assert.match(bar, /data-detail-toggle="clip"[\s\S]{0,200}onClick=\{\(\) => triangle\('clip'\)\}>▲<\/button>/)
  assert.match(bar, /data-detail-toggle="device"[\s\S]{0,200}onClick=\{\(\) => triangle\('device'\)\}>▲<\/button>/)
  const detail = await readFile(new URL('../src/frame/detail/DetailHost.tsx', import.meta.url), 'utf8')
  assert.match(detail, /<header className="detail-head" data-detail-head="device">/, 'Device view keeps its head line (the band stands under it, styles.css)')
  assert.match(bar, /<span>\{clipName \?\? 'Clip'\}<\/span>/); assert.match(bar, /<span>\{trackName \?\? 'Device'\}<\/span>/)
  const detailHost = await readFile(new URL('../src/frame/detail/DetailHost.tsx', import.meta.url), 'utf8')
  assert.match(detailHost, /frame\.style\.setProperty\('--clip-stack-h', `\$\{clipH\}px`\)/, 'the height Clip view takes above Device view, for the band\'s place')
  assert.doesNotMatch(detailHost, /'(live|base|factory|expressions|techne)'/, 'the host names no mode')
})
