import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production source in memory, same loader as the sibling native tests.
// The spine here is a fixture shaped like the shell's; it is not a workspace
// book and nothing here claims a native owner.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)

// The Timeline presentation mapping (projections/timelinePresentation.ts: the encounter → Session or Arrangement for the World
// cut's residence) was read by nothing once the tracks pane became the centre and was deleted on 15 Oct (FOUNDATION §7): the
// pane's presentation is its own state (projections/timelinePaneHost.ts, asserted in factory-timeline-pane.test.mjs).
const {createSpineEncounterBridge} = await import('../src/projections/encounterBridge.ts')

const fixtureSpine = () => {
  const writes = []
  const book = {
    current: {context: {world: 'central', subject: {ref: 'stone1950', title: 'Stone 1950'}}},
    setContext: change => {const next = change(book.current.context ?? {}); book.current.context = {...next, trail: next.trail?.slice(-24)}; writes.push(next)},
  }
  const workspace = {mode: 'techne', accessEpoch: 3}
  return {writes, bridge: createSpineEncounterBridge({current: {book, workspace}}), book, workspace}
}

test('the bridge reads the spine; a mount renders from fact, once', () => {
  const {bridge} = fixtureSpine()
  const seen = []
  const unsubscribe = bridge.subscribe(snapshot => seen.push(snapshot))
  assert.equal(seen.length, 1, 'one immediate delivery of the current spine')
  assert.equal(seen[0].mode, 'techne')
  assert.equal(seen[0].world, 'central')
  assert.equal(seen[0].subject?.ref, 'stone1950')
  assert.equal(seen[0].accessEpoch, 3)
  assert.equal(seen[0].presented, true)
  unsubscribe()
  bridge.publish()
  assert.equal(seen.length, 1, 'unsubscribe stops delivery')
})

test('selection propagates as an encounter transition into the ONE WorldContext owner', () => {
  const {bridge, writes} = fixtureSpine()
  bridge.transition({kind: 'subject', ref: 'ariadne-loom', title: "Ariadne's Loom", subjectKind: 'artefact'})
  assert.equal(writes.length, 1)
  assert.equal(writes[0].subject.ref, 'ariadne-loom')
  assert.equal(writes[0].world, 'central', 'the transition merges; it never replaces the context')
  bridge.transition({kind: 'occasion', ref: 'reading:9', position: 'p.214'})
  assert.equal(writes[1].reading.ref, 'reading:9')
  assert.equal(writes[1].subject.ref, 'ariadne-loom', 'the occasion transition keeps the standing subject')
  bridge.transition({kind: 'present', presentation: 'arrangement'})
  assert.equal(writes.length, 2, "'present' is pane-local by contract; the spine stores no presentation state")
})

test('the epoch guard retires a stale registration; a current one keeps receiving', () => {
  const {bridge, workspace} = fixtureSpine()
  const stale = []
  const fresh = []
  const unsubscribeStale = bridge.subscribe(snapshot => stale.push(snapshot.accessEpoch))
  workspace.accessEpoch = 4
  const unsubscribeFresh = bridge.subscribe(snapshot => fresh.push(snapshot.accessEpoch))
  bridge.publish()
  assert.deepEqual(stale, [3], 'the epoch-3 registration received only its initial delivery')
  assert.deepEqual(fresh, [4, 4], 'the epoch-4 registration received the initial delivery and the publish')
  unsubscribeStale()
  unsubscribeFresh()
})

test('an epoch bump never revives: even a fresh subscribe on the retired epoch is its own registration', () => {
  const {bridge, workspace} = fixtureSpine()
  const seen = []
  bridge.subscribe(() => seen.push('first'))
  workspace.accessEpoch = 4
  bridge.publish()
  const before = seen.length
  workspace.accessEpoch = 5
  bridge.publish()
  assert.equal(seen.length, before, 'every advance retires the prior generation; deliveries skip them all')
})
