import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The per-mode surfaces at mockup density — production modules in memory
// (the mode-grammar loader pattern): .ts/.tsx transpiled, CSS stubbed.
const root = new URL('../../../../', import.meta.url)
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

const {ModeCentreFrame} = await import('../src/shell/ModeCentre.tsx')
const {ModeContextDock} = await import('../src/shell/ModeContextDock.tsx')
const {BaseDocumentDetail, TechneClipDetail, FactoryTaskLogDetail} = await import('../src/shell/ModeDetail.tsx')
const {StubWorkspaceProvider} = await import('../src/shell/workspaceContext.tsx')
const {ModeBrowser} = await import('../src/shell/ModeBrowser.tsx')

const html = element => renderToStaticMarkup(element)
const UNAVAILABLE = {kind: 'unavailable', reason: 'the test carrier is down'}

// ————————————————————————————————————————————————————————————————————————
// Base · Session — the day as clips at the mockup's session grammar.

test('base session: five coloured track columns, named clips, the eight-slot rhythm and stop rows', () => {
  const out = html(createElement(ModeCentreFrame, {mode: 'base', presentation: 'session', world: null}))
  const document = out
  for (const track of ['Day', 'Flows', 'Beings', 'Things', 'Goals']) {
    assert.ok(document.includes(`data-track="${track}"`), `${track} track drawn`)
  }
  assert.ok(!document.includes('its document opens in the …'), 'no truncated sentence in a clip cell')
  assert.ok(document.includes('mode-centre-tri'), 'the clip triangle drawn')
  assert.equal((document.match(/mode-centre-stoprow/g) ?? []).length, 5, 'a stop row per track')
  assert.equal((document.match(/mode-centre-soft\b/g) ?? []).length, 35, 'soft-stop squares: seven per track')
  assert.ok(document.includes('mode-centre-disclosure'), 'the unread-reading disclosure styled inside the frame')
  // The colours are the mockup's identity grammar.
  assert.ok(document.includes('--mode-day'), 'the colour grammar present')
})

test('base arrangement: the hour ruler drawn, the day window banded, lanes named', () => {
  const out = html(createElement(ModeCentreFrame, {mode: 'base', presentation: 'arrangement', world: null}))
  assert.equal((out.match(/mode-centre-tick/g) ?? []).length, 19, 'hour ticks 05:00–23:00')
  assert.ok(out.includes('mode-centre-window'), 'the day window drawn')
  assert.ok(out.includes('mode-centre-now') === false, 'no now needle without a live reading — never a wall clock')
  for (const lane of ['documents', 'entries', 'returns · handoffs', 'the close']) {
    assert.ok(out.includes(`data-lane="${lane}"`), `the ${lane} lane drawn`)
  }
})

test('base arrangement: the now needle rides only the kernel’s own reading', () => {
  const now = Date.UTC(2026, 9, 10, 14, 37)
  const world = {source: {status: 'live', now: {instantUnixMs: now, dayRef: '2026-10-10', source: 'test'}}}
  const out = html(createElement(ModeCentreFrame, {mode: 'base', presentation: 'arrangement', world}))
  assert.ok(out.includes('mode-centre-now'), 'the now needle over a real reading')
  assert.ok(out.includes('data-lane'), 'the lanes stand beside it')
})

test('techne journey: the six stop columns with Expression, eight stops, the launcher column', () => {
  const out = html(createElement(ModeCentreFrame, {mode: 'techne', presentation: 'session', world: null}))
  for (const column of ['Place', 'Occasion', 'Artefact', 'Expression', 'Narration', 'Transition']) {
    assert.ok(out.includes(`>${column}</span>`), `the ${column} column drawn`)
  }
  assert.equal((out.match(/data-stop=/g) ?? []).length, 8, 'eight walk stops')
  assert.ok(out.includes('The walk'), 'the scene-launcher column drawn')
  assert.ok(out.includes('record a walk'), 'record-a-walk affordance drawn')
})

test('techne relation field: lenses in the design’s order, the declared break, the standings', () => {
  const out = html(createElement(ModeCentreFrame, {mode: 'techne', presentation: 'arrangement', world: null}))
  const lenses = [...out.matchAll(/data-lens="([a-z]+)"/g)].map(match => match[1])
  assert.deepEqual(lenses, ['chronology', 'causal', 'recurrence', 'concurrency'], 'the design’s lens order')
  assert.ok(out.includes('mode-centre-break'), 'the declared break drawn as a break')
  assert.ok(out.includes('mode-centre-standing-legend'), 'the epistemic standings legend drawn')
  for (const standing of ['fact', 'claim', 'inferred', 'disputed', 'ghost']) {
    assert.ok(out.includes(`mode-centre-standing-${standing}`), `the ${standing} standing drawn`)
  }
})

// ————————————————————————————————————————————————————————————————————————
// The detail row — device cards, the clip craft, the task log.

test('base document (empty): the six device cards at chain anatomy, dark lamps', () => {
  const out = html(createElement(BaseDocumentDetail, {transport: UNAVAILABLE, subject: null}))
  assert.equal((out.match(/mode-detail-devcard(?=")/g) ?? []).length, 6, 'six document device cards')
  assert.equal((out.match(/mode-detail-devcard-lamp/g) ?? []).length, 6, 'a power lamp per card')
  assert.ok(out.includes('mode-detail-dropzone'), 'the dashed drop zone drawn')
  for (const device of ['Text', 'Highlight', 'Notes', 'Packet', 'Answer', 'Form device']) {
    assert.ok(out.includes(`<strong>${device}</strong>`), `${device} card named`)
  }
  assert.ok(out.includes('dark — waits for its subject'), 'the honest reason line')
})

test('techne clip: the four craft sections — identity, relations, constellation, source', () => {
  const out = html(createElement(TechneClipDetail, {world: null}))
  for (const craft of ['identity', 'relations', 'constellation', 'source']) {
    assert.ok(out.includes(`data-craft="${craft}"`), `the ${craft} section drawn`)
  }
  assert.ok(out.includes('mode-detail-standing-chip'), 'standing chips on the relation rows')
  assert.ok(out.includes('mode-detail-constellation-ghost'), 'the ghost ring holds the constellation')
})

test('factory task log: the track’s real clips as the task column and log rows', () => {
  const tasks = [
    {n: 1, title: 'survey the vault', state: 'done', startUnixMs: Date.UTC(2026, 9, 10, 13, 41), lastActivityUnixMs: Date.UTC(2026, 9, 10, 13, 58), disclosure: null},
    {n: 2, title: 'correlate occurrences', state: 'running', startUnixMs: Date.UTC(2026, 9, 10, 14, 2), lastActivityUnixMs: null, disclosure: 'the running clip draws no end of its own'},
  ]
  const out = html(createElement(FactoryTaskLogDetail, {taskLabel: 'correlate occurrences', task: {
    sessionRef: 'session:test', purpose: 'correlate occurrences', agentName: 'Fizz', needleState: 'live',
    tasks, budget: {used: 2, max: 12},
  }}))
  assert.equal((out.match(/mode-detail-tasklist-row/g) ?? []).length, 2, 'a task row per clip')
  assert.equal((out.match(/mode-detail-logrow(?=")/g) ?? []).length, 2, 'a log row per clip')
  assert.ok(out.includes('2 / 12 turns'), 'the budget reading carried')
  assert.ok(out.includes('running'), 'the clip’s own state drawn')
  assert.ok(out.includes('task-log read'), 'the deeper tool rows named as waiting')
})

// ————————————————————————————————————————————————————————————————————————
// The dock — per-mode tiles, pin/close, launcher.

test('the dock: base opens the companion, packet and trail tiles; pin and close on every header', () => {
  const out = html(createElement(ModeContextDock, {mode: 'base', world: null, transport: UNAVAILABLE, subject: null}))
  assert.equal((out.match(/data-tile=/g) ?? []).length, 3, 'three tiles open by default')
  assert.equal((out.match(/data-i="Pin\|/g) ?? []).length, 3, 'pin on every tile header')
  assert.equal((out.match(/data-i="Close\|/g) ?? []).length, 3, 'close on every tile header')
  assert.ok(out.includes('mode-dock-wedge'), 'the resize wedge drawn (it dies with the toggle)')
  assert.ok(out.includes('mode-dock-launch'), 'the launcher below the tiles')
  assert.ok(out.includes('Fizz'), 'the situated agent companion')
  assert.ok(out.includes('+ Save current tiles as preset'), 'the curate affordance')
})

test('the dock: each mode’s companion is its own — Epii on Technē, Anima on Expressions', () => {
  const techne = html(createElement(ModeContextDock, {mode: 'techne', world: null, transport: UNAVAILABLE, subject: null}))
  assert.ok(techne.includes('Epii'), 'Technē’s companion is Epii')
  assert.ok(techne.includes('Epii · Source · Proposals · Field'), 'the companion’s own tabs')
  const expressions = html(createElement(ModeContextDock, {mode: 'expressions', world: null, transport: UNAVAILABLE, subject: null}))
  assert.ok(expressions.includes('Anima'), 'Expressions’ companion is Anima')
})

test('the dock: the agents tile reads the agency surface — and discloses its absence honestly', () => {
  const out = html(createElement(ModeContextDock, {mode: 'live', world: null, transport: UNAVAILABLE, subject: null, initialOpen: ['agents']}))
  assert.ok(out.includes('mode-dock-rows'), 'the agents tile renders its rows body')
  assert.ok(out.includes('carrier is unavailable'), 'with no carrier the tile discloses the absence — never a fake row (a light is a reading, so no light is drawn)')
  assert.ok(!out.includes('mode-dock-row-light'), 'no illuminated lie: an unknown state has no lit indicator')
})

// ————————————————————————————————————————————————————————————————————————
// The browser — rail marks, the results header, the New affordance, the
// aperture slot.

test('the browser: results header, the New affordance on the Project group, the aperture slot', () => {
  const out = html(createElement(StubWorkspaceProvider, {transport: UNAVAILABLE},
    createElement(ModeBrowser, {mode: 'base', onSelectSubject: () => {}, selectedSubject: null})))
  assert.ok(out.includes('mode-browser-resulthead'), 'the results header drawn')
  assert.ok(out.includes('>Name</span>'), 'the header names the column')
  assert.ok(out.includes('mode-browser-new'), 'the New affordance drawn')
  assert.ok(out.includes('exactly Day · Flow · Beings · Things'), 'New names the four forms')
  assert.ok(out.includes('mode-browser-aperture'), 'the aperture slot drawn')
  for (const row of ['Field', 'World', 'Subject', 'Occasion']) {
    assert.ok(out.includes(`mode-browser-aperture-name">${row}</span>`), `the ${row} concept drawn`)
  }
  assert.ok(out.includes('not selected'), 'the subject line honest when nothing is selected')
})
