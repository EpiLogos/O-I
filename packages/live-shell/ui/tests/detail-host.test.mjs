import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The one detail host at the mockup's floor (manual §3; world-shell-mockup.html `#dth`, clipDetail(), DVN): one head line over
// the row, drawn from the mode's registration; one rule for the Clip side in every mode — while nothing is selected, one line
// saying what it waits for and no body under it; with a clip selected, the mode's body. The status bar's switch is named as the
// mode names its two sides. Production modules in memory (the mode-surface-fidelity loader).
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

const {DetailHost} = await import('../src/frame/detail/DetailHost.tsx')
const {DetailContext} = await import('../src/frame/detail/detailReading.ts')
const {MODE_DETAILS} = await import('../src/shell/modeDetails.tsx')
const {publishTimelineReading} = await import('../src/projections/timelinePaneHost.ts')
const {publishShownTracks} = await import('../src/frame/tracks/tracksDoor.ts')
const {selectedClipOf} = await import('../src/frame/detail/ClipBox.tsx')
const {factoryTrackAdapter} = await import('../src/timeline/factoryTrackAdapter.ts')
const {StatusBar} = await import('../src/components/StatusBar.tsx')

const UNAVAILABLE = {kind: 'unavailable', reason: 'the test carrier is down'}
const T = (h, m) => Date.UTC(2026, 9, 8, h, m)
// One agency track as agent/agentRunModel.ts shapes it: its one real task and the soft-stop slot.
const track = {sessionRef: 'ses-214', purpose: 'correlate occurrences', agentRef: 'agent:fizz', agentName: 'Fizz', agentAccepted: true,
  spaceRef: 'space:lead', spaceLabel: null, depth: 0, parentRef: null, group: false, memberRefs: [], needle: null, telemetryOn: false,
  budget: {used: 2, max: 12}, disclosure: null, tasks: [
    {n: 1, title: 'correlate occurrences', state: 'running', startUnixMs: T(13, 41), lastActivityUnixMs: T(14, 24), softStop: false, disclosure: null},
    {n: 2, title: null, state: 'unknown', startUnixMs: null, lastActivityUnixMs: null, softStop: true, disclosure: null}]}
const set = factoryTrackAdapter.project({tracks: [track], nowUnixMs: T(14, 30)})
const taskRef = set.clips[0].id

const reading = (mode, overrides = {}) => ({mode, transport: UNAVAILABLE, world: null, worldCut: false, centralSubject: null,
  live: {ctx: null, document: null, selection: {track: 0, scene: null}}, native: {},
  factory: {tracks: [track], task: {taskLabel: track.purpose, task: {sessionRef: track.sessionRef, purpose: track.purpose, agentName: track.agentName, needleState: null}}},
  focusedInstrument: null, ...overrides})
const timeline = (selectedRef) => publishTimelineReading({mode: 'factory', set: null, document: null, colors: [], selection: {track: 0, scene: null}, select() {}, setColor() {}, selectedRef, selectTrackItem() {}})
const host = (detail, side) => renderToStaticMarkup(createElement(DetailContext.Provider, {value: detail}, createElement(DetailHost, {side})))
const head = markup => markup.match(/<header class="detail-head"[^>]*>(.*?)<\/header>/)[1].replace(/<[^>]+>/g, '').replaceAll('&#x27;', "'")

test('every mode registers its head, its one waiting line, and what the chain ends in', () => {
  for (const [mode, table] of Object.entries(MODE_DETAILS)) {
    assert.equal(typeof table.head.clip, 'function', `${mode}: a clip head`); assert.equal(typeof table.head.device, 'function', `${mode}: a device head`)
    assert.ok(table.clipWaits.length > 10, `${mode}: one line for the Clip side's wait`)
    assert.ok(table.dropHint === null || typeof table.dropHint === 'string', `${mode}: a drop hint, or none where the chain draws its own receiver`)
  }
  assert.equal(MODE_DETAILS.expressions.clipUngated, true, 'Expressions\' clip is the open Expression\'s scene, not chosen from its tracks')
  assert.equal(MODE_DETAILS.factory.dropHint, null, 'Factory\'s chain ends in its own armed drop receiver, so the host draws no second one')
})

test('the Clip side with nothing selected: the head, one line saying what it waits for, and no body under it', () => {
  timeline(undefined); publishShownTracks(set)
  const out = host(reading('factory'), 'clip')
  assert.equal(head(out), 'Task log')
  assert.equal((out.match(/class="clip-empty"/g) ?? []).length, 1, 'one line')
  assert.match(out, /<p class="clip-empty" role="status">Select a task on a session&#x27;s track to read its tool-run log here\.<\/p>/, 'in the mode\'s own words')
  assert.doesNotMatch(out, /data-detail-body=/, 'no body under it')
  assert.doesNotMatch(out, /clip-box|declared, waiting|Desk/)
})

test('the Clip side with a task selected: its head names the task and its session, the body is the Clip view, no strip over it', async () => {
  timeline(taskRef); publishShownTracks(set)
  const out = host(reading('factory'), 'clip')
  assert.equal(head(out), 'correlate occurrences — Fizz · ses-214 · the task\'s tool-run log')
  assert.match(out, /data-detail-body="factory:clip"/)
  assert.match(out, /data-clip-view="factory-task"/)
  assert.doesNotMatch(out, /class="clip-empty"/, 'no waiting line over a body')
  assert.match(out, /data-row="span"/, 'the clip box\'s facts are rows of the props column')
  const css = await readFile(new URL('../src/frame/detail/detail.css', import.meta.url), 'utf8')
  assert.match(css, /\.detail-body--clip:has\(\.clipv\) > \.clip-box \{ display: none \}/, 'so the strip stands down over a Clip view')
  timeline(undefined); publishShownTracks(null)
})

test('the Device side\'s head: the session\'s path in Factory, the focused instrument where one takes the side', () => {
  const none = {ref: null, clip: null, track: null, set: null}
  assert.deepEqual(MODE_DETAILS.factory.head.device({detail: reading('factory'), selected: selectedClipOf(taskRef, set), instrument: null}),
    {name: 'correlate occurrences', line: 'the agent\'s path: gateway → agent → skills → world → git'}, 'the selected task\'s session, as the chain reads it')
  assert.equal(MODE_DETAILS.factory.head.device({detail: reading('factory'), selected: none, instrument: null}).name, 'No session selected', 'no selection, no session — as the chain says')
  assert.deepEqual(MODE_DETAILS.factory.head.device({detail: reading('factory'), selected: none, instrument: 'techne:m2'}),
    {name: 'Instruments', line: 'Timeline open on the focused pane; its controls are its own'})
  assert.deepEqual(MODE_DETAILS.base.head.device({detail: reading('base', {centralSubject: {kind: 'day', path: 'Control/agents/now/day/2026-10-08.md'}}), selected: none, instrument: null}),
    {name: 'Day · Thu 08 Oct', line: 'document devices: each modifies the open document'})
  // Live's head names the track and its devices in order (the mockup's liveDetail() head; live-detail-chain.test.mjs): with no set,
  // no track, as Factory says no session and Central no document.
  assert.deepEqual(MODE_DETAILS.live.head.device({detail: reading('live'), selected: none, instrument: null}), {name: 'No track selected'})
  assert.match(MODE_DETAILS.expressions.head.device({detail: reading('expressions'), selected: none, instrument: null}).line, /^the Expressions engine's own controls/)
  assert.deepEqual(MODE_DETAILS.techne.head.device({detail: reading('techne'), selected: none, instrument: 'techne:m4'}),
    {name: 'Instruments', line: 'World open on the focused pane; its controls are its own'})
  assert.deepEqual(MODE_DETAILS.base.head.clip({detail: reading('base'), selected: selectedClipOf(null, null), instrument: null}), {name: 'Document', line: undefined})
})

test('the host holds one rule and names no mode: the head and the waiting line are registrations', async () => {
  const source = await readFile(new URL('../src/frame/detail/DetailHost.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /'(live|base|factory|expressions|techne)'/, 'the host names no mode')
  assert.match(source, /const waiting = side === 'clip' && !selected\.ref && !registration\.clipUngated/)
  assert.match(source, /registration\.head\[side\]\(/)
  assert.match(source, /<ClipWaiting line=\{registration\.clipWaits\} \/>/)
})

test('the status bar names the two sides as each mode does (the mockup\'s DVN)', () => {
  const state = {set: null, path: null, error: null, loading: false}
  const expected = {live: ['Clip', 'Device'], base: ['Document', 'Devices'], factory: ['Task log', 'Agent chain'], expressions: ['Scene', 'Studio'], techne: ['Clip', 'Instruments']}
  for (const [mode, [clip, device]] of Object.entries(expected)) {
    const out = renderToStaticMarkup(createElement(StatusBar, {state, documentError: null, viewport: [1440, 900], audio: mode === 'live', mode, reading: null, detailMode: 'clip', changeDetailMode: () => {}, presentedView: 'session'}))
    const nav = out.match(/<nav class="status-detail-views"[^>]*>(.*?)<\/nav>/)[1]
    assert.match(nav, new RegExp(`aria-label="${clip}" data-detail-side="clip"[^>]*>.*?<span>${clip}</span>`), `${mode}: ${clip}`)
    assert.match(nav, new RegExp(`aria-label="${device}" data-detail-side="device"[^>]*>.*?<span>${device}</span>`), `${mode}: ${device}`)
  }
})
