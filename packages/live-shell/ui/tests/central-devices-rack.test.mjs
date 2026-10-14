// The Base Devices chain takes its Central apertures from the one selection the
// Document row shows (WORLD-SHELL-DESIGN §5, §17.2; src/central). Rendered under SSR
// (the mode-surface-fidelity pattern): the owner's Day reading is passed in as the
// `standing` the hook would have read, because effects do not run server-side.
//
// Channels: the events and the Day answers are constructed from the real capture's
// shape (the walk test reads the captures); the rack, the Day die, and the Nara face
// are the production components, rendered as they are.

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

const {BaseDevicesDetail} = await import('../src/shell/ModeDetail.tsx')
const {InhabitantRack} = await import('../src/inhabitants/inhabitantRack.tsx')
const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
const {createTimeSpine} = await import('../src/timeline/timeSpine.ts')
const vertical = await import('../src/central/centralVertical.ts')
const rack = await import('../src/central/centralRack.ts')

const html = (element) => renderToStaticMarkup(element)
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}
const central = inhabitantManifest('central')
assert.ok(central, 'the central family is admitted by the shell\'s own door')

// The Base Devices chain as it stands with no selection (the reference markup).
const todayMarkup = html(createElement('div', {className: 'mode-detail', 'data-mode-detail': 'base-devices'},
  createElement(InhabitantRack, {manifests: [central], transport})))

// A world the Central selection reads: the spine and the reading the World cut holds.
const NOW_REF = 'central:now:control:root:' + '0'.repeat(63) + '1'
const DAY_REF = 'central:day:control:root:2026-10-06'
const nowEvent = {stream: 'central-now', kind: 'now', subject_ref: NOW_REF, instant_unix_ms: Date.UTC(2026, 9, 6, 10, 0), summary: 'sample clearing', day_ref: DAY_REF, evidence_refs: []}
const CONVERSATION_SPACE = 'session-space/nara-' + 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const conversationEvent = {stream: 'session-space', kind: 'conversation', subject_ref: CONVERSATION_SPACE, instant_unix_ms: Date.UTC(2026, 9, 6, 9, 30), summary: 'sample dialogue', day_ref: DAY_REF, evidence_refs: []}

function worldWith(events, selected) {
  const spine = createTimeSpine()
  if (selected) spine.selectOccasion(selected, Date.UTC(2026, 9, 14))
  return {spine, source: {events}}
}

// The owner's answers, as the kernel gives them: a ready Day (a fixture shape, the
// one `central.document-reading` form the Day die reads) and the uninitialised refusal.
const readyStanding = vertical.interpretDayOpen(DAY_REF, {data: {schema: 'oi.central-day-open/v1', project: null, day: {
  document_state: 'ready', source: {ref: 'central:source:control:root:Control/user/day/2026-10-06/day.md'},
  document: {document_id: 'day-document:2026-10-06'}, revision: {revision: 'central.content-fnv1a64/v1:12:0000000000000001'}}}})
const uninitialisedStanding = vertical.interpretDayOpen(DAY_REF, {error: 'Current Day has no native document yet. Use the explicit native initialisation path; its temporal artifact is not a Daily Die'})

test('no selected occasion: the Devices chain is unchanged (the same markup as the rack alone)', () => {
  assert.equal(html(createElement(BaseDevicesDetail, {transport})), todayMarkup, 'no world: unchanged')
  const empty = worldWith([nowEvent], null)
  assert.equal(html(createElement(BaseDevicesDetail, {transport, world: empty, standing: null})), todayMarkup, 'a world with no retained occasion: unchanged')
})

test('a browser subject stands in the Document row: the Devices chain keeps its own unchanged markup', () => {
  const selected = worldWith([nowEvent], nowEvent)
  const subject = {kind: 'day', path: 'Control/agents/now/day/2026-09-12.md'}
  assert.equal(html(createElement(BaseDevicesDetail, {transport, world: selected, subject, standing: readyStanding})), todayMarkup, 'the browser subject shadows the occasion')
})

test('a selected Day occasion with a ready Day: the Day die has its body, docked in the chain', () => {
  const markup = html(createElement(BaseDevicesDetail, {transport, world: worldWith([nowEvent], nowEvent), standing: readyStanding}))
  assert.match(markup, /data-document-device="ql-daily-die"/, 'the Day die body renders from the owner\'s Day identity')
  assert.doesNotMatch(markup, /Expand: the Day die docks/, 'the die is docked, not folded')
  assert.doesNotMatch(markup, /No Day is selected/, 'the empty-slot copy does not claim there is no Day')
  assert.match(markup, /data-face-id="day-die"/)
})

test('a selected Day occasion with an uninitialised Day: the owner state is named above the chain, and no die is drawn', () => {
  const markup = html(createElement(BaseDevicesDetail, {transport, world: worldWith([nowEvent], nowEvent), standing: uninitialisedStanding}))
  assert.match(markup, /data-central-day-notice="uninitialised"/)
  assert.match(markup, /has no Day document yet/)
  assert.match(markup, /central · initialise-day/, 'the owner op that would admit the Day is named')
  assert.doesNotMatch(markup, /data-document-device="ql-daily-die"/, 'no die is drawn for a Day the owner has not initialised')
})

test('a selected conversation occasion: the Nara face docks on its conversation; the owner gap is named (no expression is disclosed)', () => {
  const markup = html(createElement(BaseDevicesDetail, {transport, world: worldWith([conversationEvent], conversationEvent)}))
  assert.match(markup, /data-conversation-device="nara"/, 'the Nara face is docked in the chain')
  assert.match(markup, new RegExp(`data-conversation-gap="${CONVERSATION_SPACE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), 'the face names this conversation')
  assert.match(markup, /session-space/, 'the gap names the owner that owes the binding')
})

test('the apertures follow the Document row\'s own selection and the Day standing', () => {
  const world = worldWith([nowEvent], nowEvent)
  const resolved = vertical.resolveCentralOccasion(world.spine.occasion(), world.source.events)
  assert.equal(resolved.state, 'selected', 'the rack reads the same resolver the Document row reads')
  const apertures = rack.centralRackApertures(resolved.selection, readyStanding)
  assert.deepEqual(apertures.day, {project: null, sourceRef: 'central:source:control:root:Control/user/day/2026-10-06/day.md', documentId: 'day-document:2026-10-06'})
  assert.equal(apertures.conversation, undefined)
  assert.deepEqual(rack.centralRackApertures(null, readyStanding), {}, 'no occasion: no aperture')
})
