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

const {ModeContextDock} = await import('../src/shell/ModeContextDock.tsx')
const {BaseDocumentDetail, TechneClipDetail, FactoryTaskLogDetail} = await import('../src/shell/ModeDetail.tsx')
const {StubWorkspaceProvider} = await import('../src/shell/workspaceContext.tsx')
const {ModeBrowser} = await import('../src/shell/ModeBrowser.tsx')

const html = element => renderToStaticMarkup(element)
const UNAVAILABLE = {kind: 'unavailable', reason: 'the test carrier is down'}

// The per-mode centre frames (shell/ModeCentre.tsx: Base's session grid and hour ruler, Technē's designed Journey and relation field)
// are gone: the centre is the pane engine's tracks pane in every mode (FOUNDATION F2–F3). Base's day tracks, session grid and
// ruler are asserted in central-tracks.test.mjs and f3-tracks.test.mjs (frame/tracks SessionGrid, ArrangementRuler, TracksPane
// over useCentralTracks); Technē's walks are asserted in journey-walks.test.mjs and techne-tracks.test.mjs (Technē's tracks).

// ————————————————————————————————————————————————————————————————————————
// The detail row — device cards, the clip craft, the task log.

test('base document (empty): one line saying what it waits for — no device cards in the pane (their chain is the Device side)', () => {
  const out = html(createElement(BaseDocumentDetail, {transport: UNAVAILABLE, subject: null, waits: 'Select a document to see it as data here.'}))
  assert.equal(out, '<p class="clip-empty" role="status">Select a document to see it as data here.</p>')
  assert.doesNotMatch(out, /mode-detail-devcard|mode-detail-dropzone/, 'the six dark document-device cards are retired')
})

test('techne clip: the event as a Clip view — its props and ladder, relations, constellation, source; "—" where the reading is silent', () => {
  const out = html(createElement(TechneClipDetail, {world: null}))
  assert.ok(out.includes('data-clip-view="techne-event"'), 'drawn through the one Clip view')
  for (const key of ['kind', 'standing', 'world', 'revision', 'occasion', 'place', 'provenance']) assert.ok(out.includes(`data-row="${key}"`), `the ${key} row`)
  for (const column of ['Relations · typed, in standing', 'Constellation · bounded whole', 'Source']) assert.ok(out.includes(`data-column="${column}"`), `the ${column} column`)
  assert.ok(out.includes('techne-ladder'), 'the disclosure ladder under the props')
  assert.ok(!out.includes('mode-detail-standing-chip') && !out.includes('declared, waiting'), 'no placeholder relation list, no waiting prose')
})

test('factory task log: the task as data through the Clip view — its session\'s readings, "—" where nothing is disclosed', () => {
  const tasks = [
    {n: 1, title: 'correlate occurrences', state: 'running', startUnixMs: Date.UTC(2026, 9, 10, 14, 2), lastActivityUnixMs: null, softStop: false, disclosure: 'the running clip draws no end of its own'},
    {n: 2, title: null, state: 'unknown', startUnixMs: null, lastActivityUnixMs: null, softStop: true, disclosure: null},
  ]
  const track = {sessionRef: 'session:test', purpose: 'correlate occurrences', agentRef: null, agentName: 'Fizz', agentAccepted: null, spaceRef: 'space:test',
    spaceLabel: null, depth: 0, parentRef: null, group: false, memberRefs: [], tasks, needle: null, telemetryOn: false, budget: {used: 2, max: 12}, disclosure: null}
  const out = html(createElement(FactoryTaskLogDetail, {track, name: 'Fizz · lead', events: [
    {stream: 'agency', kind: 'run', subject_ref: 'agency/session:test/turn', instant_unix_ms: Date.UTC(2026, 9, 10, 14, 2), summary: 'attempt 2 started'},
  ]}))
  assert.ok(out.includes('2 / 12 turns'), 'the budget reading carried')
  assert.ok(out.includes('<span>running</span>'), 'the task\'s own state drawn')
  assert.equal((out.match(/class="hl2"/g) ?? []).length, 1, 'a log row per owner event')
  assert.ok(!out.includes('declared, waiting'), 'undisclosed rows read "—", never prose')
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
  assert.ok(out.includes('mode-dock-lines'), 'the agents tile renders its lines body (the mockup\'s agents rows)')
  assert.ok(out.includes('carrier is unavailable'), 'with no carrier the tile discloses the absence — never a fake row (a light is a reading, so no light is drawn)')
  assert.ok(!out.includes('mode-dock-row-light'), 'no illuminated lie: an unknown state has no lit indicator')
})

// ————————————————————————————————————————————————————————————————————————
// The browser — rail marks, the results header, the New affordance. The
// aperture slot is the one browser's (frame/browser/apertureViews.tsx,
// tests/aperture-slot-context.test.mjs): the focused pane's own context.

test('the browser: results header, the New… category in the Project group; the rows draw no aperture of their own', () => {
  const out = html(createElement(StubWorkspaceProvider, {transport: UNAVAILABLE},
    createElement(ModeBrowser, {mode: 'base', onSelectSubject: () => {}, selectedSubject: null})))
  assert.ok(out.includes('mode-browser-resulthead'), 'the results header drawn')
  assert.ok(out.includes('>Name</span>'), 'the header names the column')
  // Lane L (15 Oct): the disabled New button that held its place in the Project group is the mockup's New… category, its rows
  // the four forms grid (tests/browser-rows-ssr.test.mjs).
  assert.match(out, /<h3>Project<\/h3>.*data-i="New…\|New document — exactly Day · Flow · Beings · Things/, 'the New… category in the Project group')
  assert.ok(out.includes('exactly Day · Flow · Beings · Things'), 'New names the four forms')
  assert.ok(!out.includes('mode-browser-aperture') && !out.includes('aria-label="Aperture"'), 'the slot stands in the one browser\'s pool, not in the rows')
})
