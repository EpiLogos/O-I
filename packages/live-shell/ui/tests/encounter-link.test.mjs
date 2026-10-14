import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Production source in memory, same loader as the sibling encounter tests.
// The store here is a fixture shaped like the workspace book (its setContext /
// switchMode contract); the window is a fake history stack with real Back.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)

const {createSpineEncounterBridge, trailStopFrom} = await import('../src/projections/encounterBridge.ts')
const {createEncounterLink, inboundPlan, mergeLinkSearch} = await import('../src/projections/encounterLink.ts')

// A store fixture with the workspace book's contract: context merges through
// setContext (trail kept), and switchMode moves the tree mode.
const fixtureStore = (context = {}, mode = 'base') => {
  const workspace = {mode, accessEpoch: 1}
  const book = {
    current: {context},
    setContext(change) {
      const next = change(book.current.context ?? {})
      book.current.context = {...next, trail: next.trail?.slice(-24)}
      book.writes = (book.writes ?? 0) + 1
    },
    switchMode(next) {
      workspace.mode = next
    },
  }
  const bridge = createSpineEncounterBridge({current: {book, workspace}})
  const spine = {
    snapshot: () => bridge.snapshot(),
    switchMode: next => book.switchMode(next),
    setContext: change => book.setContext(change),
  }
  return {book, workspace, bridge, spine}
}

// A window fake with a real history stack: pushState truncates forward
// entries, back() moves the index and fires popstate like a browser does.
const fakeWindow = (url = '/index.html') => {
  const entries = [url]
  let index = 0
  const listeners = new Set()
  const calls = []
  const win = {
    location: {},
    history: {
      pushState(_data, _unused, next) { entries.splice(index + 1); entries.push(next); index++; calls.push(['push', next]); sync() },
      replaceState(_data, _unused, next) { entries[index] = next; calls.push(['replace', next]); sync() },
    },
    addEventListener(type, listener) { if (type === 'popstate') listeners.add(listener) },
    removeEventListener(type, listener) { listeners.delete(listener) },
  }
  function sync() {
    const u = new URL(entries[index], 'http://oi.test')
    win.location = {pathname: u.pathname, search: u.search, hash: u.hash}
  }
  const back = () => { index--; sync(); for (const l of [...listeners]) l() }
  sync()
  return {win, calls, back, entries: () => entries, listeners: () => listeners.size, current: () => entries[index]}
}

test('outbound: a new encounter pushes, a refinement replaces, an unchanged encounter writes nothing', () => {
  const store = fixtureStore({world: 'central'}, 'techne')
  const w = fakeWindow('/index.html')
  const link = createEncounterLink(store.spine, w.win)
  link.start()
  link.publish()
  assert.equal(w.calls.length, 1)
  assert.equal(w.calls[0][0], 'replace', 'the first write names the standing encounter without a history entry')
  assert.match(w.current(), /arr=techne/)

  store.bridge.transition({kind: 'subject', ref: 'stone1950', subjectKind: 'artefact', title: 'Stone 1950'})
  link.publish()
  assert.equal(w.calls.at(-1)[0], 'push', 'a subject change is a new encounter: pushState')
  assert.match(w.current(), /subject=stone1950/)
  assert.match(w.current(), /kind=artefact/)

  store.bridge.transition({kind: 'occasion', ref: 'reading:9', position: 'p.214'})
  link.publish()
  assert.equal(w.calls.at(-1)[0], 'replace', 'an occasion is a refinement of the same encounter: replaceState')
  assert.match(w.current(), /occasion=reading%3A9/)

  const before = w.calls.length
  link.publish()
  assert.equal(w.calls.length, before, 'an encounter the URL already names is not written again')
  link.dispose()
})

test('outbound: a trail append with the same address writes nothing; a mode change pushes', () => {
  const store = fixtureStore({}, 'techne')
  const w = fakeWindow()
  const link = createEncounterLink(store.spine, w.win)
  link.start()
  link.publish()
  const before = w.calls.length
  store.book.setContext(c => ({...c, trail: [...(c.trail ?? []), {mode: 'techne', label: 'Earlier'}]}))
  link.publish()
  assert.equal(w.calls.length, before, 'a trail stop that names the same address is not a new URL')
  store.workspace.mode = 'factory'
  link.publish()
  assert.equal(w.calls.at(-1)[0], 'push')
  assert.match(w.current(), /arr=factory/)
  link.dispose()
})

test('inbound: a link applies its arrangement and subject through the store, and does not write back', () => {
  const store = fixtureStore({}, 'base')
  const w = fakeWindow('/index.html?arr=techne&projection=timeline&subject=stone1950&kind=artefact&ap=2&as=field')
  const link = createEncounterLink(store.spine, w.win)
  link.start()
  assert.equal(store.workspace.mode, 'techne', 'the arrangement is applied through switchMode')
  assert.equal(store.book.current.context.subject.ref, 'stone1950', 'the subject is applied through setContext')
  assert.equal(store.book.current.context.subject.title, 'stone1950', 'an unresolved title falls back to the ref the link names')
  const writesAfterApply = w.calls.length
  // A render right after the apply must not write the link back.
  link.publish()
  assert.equal(w.calls.length, writesAfterApply, 'no write while the store is still the pre-apply state')
  assert.equal(w.current(), '/index.html?arr=techne&projection=timeline&subject=stone1950&kind=artefact&ap=2&as=field', 'the link is kept as it was given')
  link.dispose()
})

test('inbound apply keeps the trail: Back does not rewind the record it stands on', () => {
  const store = fixtureStore({trail: [{mode: 'base', label: 'Earlier'}]}, 'base')
  const w = fakeWindow('/index.html?arr=base&subject=a&kind=artefact')
  const link = createEncounterLink(store.spine, w.win)
  link.start()
  assert.equal(store.book.current.context.trail.length, 1)
  link.dispose()
})

test('popstate: Back walks the trail the sync pushed, and forward returns to it', () => {
  const store = fixtureStore({}, 'techne')
  const w = fakeWindow('/index.html')
  const link = createEncounterLink(store.spine, w.win)
  link.start()
  link.publish()
  store.bridge.transition({kind: 'subject', ref: 'a', subjectKind: 'artefact', title: 'A'})
  link.publish()
  store.bridge.transition({kind: 'subject', ref: 'b', subjectKind: 'artefact', title: 'B'})
  link.publish()
  assert.equal(w.entries().length, 3, 'the initial entry and one entry per encounter')
  assert.equal(store.book.current.context.trail.length, 1, 'only a transition from a subject leaves a trail stop; the first encounter leaves none')
  assert.equal(store.book.current.context.trail[0].surfaceRef, 'a', 'the stop names where the person came from')

  w.back()
  assert.equal(store.book.current.context.subject.ref, 'a', 'Back restores the previous encounter')
  link.publish()
  assert.equal(w.entries().length, 3, 'Back applied the link and wrote nothing back')
  w.back()
  assert.equal(store.book.current.context.subject?.ref, undefined, 'Back walks to the first encounter')
  link.publish()
  assert.equal(w.entries().length, 3)
  link.dispose()
})

test('an unresolved subject is applied as far as it can be and named, never silently dropped', () => {
  const store = fixtureStore({subject: {ref: 'old', kind: 'artefact', title: 'Old'}}, 'base')
  const named = []
  const w = fakeWindow('/index.html?arr=techne&subject=ghost')
  const link = createEncounterLink(store.spine, w.win, {onUnresolved: ref => named.push(ref)})
  link.start()
  assert.equal(store.workspace.mode, 'techne', 'the arrangement still applies')
  assert.equal(store.book.current.context.subject, undefined, 'a subject the spine cannot classify is not applied')
  assert.deepEqual(named, ['ghost'], 'the rest is named')
  const writes = w.calls.length
  link.publish()
  assert.equal(w.calls.length, writes, 'the named link is held, not rewritten over')
  assert.match(w.current(), /subject=ghost/, 'the address still says what was asked')
  link.dispose()
})

test('a location with no encounter is written from the store, not applied to it', () => {
  const store = fixtureStore({subject: {ref: 'kept', kind: 'artefact', title: 'Kept'}}, 'base')
  const w = fakeWindow('/index.html?dev=1')
  const link = createEncounterLink(store.spine, w.win)
  link.start()
  assert.equal(store.book.current.context.subject.ref, 'kept', 'a bare location leaves the restored store alone')
  link.publish()
  assert.match(w.current(), /dev=1/, 'keys the sync does not own are kept')
  assert.match(w.current(), /subject=kept/)
  link.dispose()
})

test('the link keeps projection, aperture and view-as from the location, which the store does not carry', () => {
  const store = fixtureStore({}, 'base')
  const w = fakeWindow('/index.html?arr=base&projection=timeline&ap=2&as=field')
  const link = createEncounterLink(store.spine, w.win)
  link.start()
  store.bridge.transition({kind: 'subject', ref: 'x', subjectKind: 'artefact', title: 'X'})
  link.publish()
  assert.match(w.current(), /projection=timeline/)
  assert.match(w.current(), /ap=2/)
  assert.match(w.current(), /as=field/)
  link.dispose()
})

test('detached windows keep their own query: no listener, no write, no apply', () => {
  const store = fixtureStore({}, 'techne')
  const w = fakeWindow('/index.html?arr=base&subject=other&kind=artefact')
  w.win.__OI_DETACHED__ = true
  const link = createEncounterLink(store.spine, w.win)
  link.start()
  link.publish()
  store.bridge.transition({kind: 'subject', ref: 'x', subjectKind: 'artefact', title: 'X'})
  link.publish()
  assert.equal(w.calls.length, 0)
  assert.equal(w.listeners(), 0)
  assert.equal(store.workspace.mode, 'techne')
  assert.equal(w.current(), '/index.html?arr=base&subject=other&kind=artefact')
  link.dispose()
})

test('the bridge: a subject transition leaves the stop it came from; the same subject is no transition', () => {
  const store = fixtureStore({subject: {ref: 'first', kind: 'artefact', title: 'First'}}, 'techne')
  store.bridge.transition({kind: 'subject', ref: 'second', subjectKind: 'artefact', title: 'Second'})
  const ctx = store.book.current.context
  assert.equal(ctx.subject.ref, 'second')
  assert.deepEqual(ctx.trail.at(-1), {mode: 'techne', label: 'First', surfaceRef: 'first', surfaceKind: 'artefact'})
  store.bridge.transition({kind: 'subject', ref: 'second', subjectKind: 'artefact', title: 'Second'})
  assert.equal(store.book.current.context.trail.length, 1, 'the same subject does not grow the trail')
})

test('the link helpers: an address with no subject, and a stop for a mode with no subject', () => {
  assert.equal(inboundPlan('?projection=earth').carried.arrangement, 'base', 'projection alone names an encounter, arrangement defaults to base')
  assert.equal(inboundPlan('?other=1'), null, 'a query with no encounter key names none')
  assert.equal(mergeLinkSearch('?dev=1&arr=old', 'arr=base&ap=0'), 'arr=base&ap=0&dev=1', 'link keys are replaced, other keys kept')
  assert.equal(trailStopFrom('audio', undefined), null, 'with no previous subject there is no stop to leave')
  assert.equal(trailStopFrom('audio', {title: 'no ref'}), null, 'a previous subject without a ref is no stop either')
  assert.deepEqual(trailStopFrom('audio', {ref: 'a', kind: 'artefact', title: 'A'}), {mode: 'base', label: 'A', surfaceRef: 'a', surfaceKind: 'artefact'})
})

test('the bridge: the first subject leaves no stop, so the legacy return chip shows no meaningless trail entry', () => {
  const store = fixtureStore({}, 'base')
  store.bridge.transition({kind: 'subject', ref: 'first', subjectKind: 'artefact', title: 'First'})
  assert.equal(store.book.current.context.subject.ref, 'first')
  assert.equal(store.book.current.context.trail, undefined, 'no previous subject, so no trail stop')
  store.bridge.transition({kind: 'subject', ref: 'second', subjectKind: 'artefact', title: 'Second'})
  assert.deepEqual(store.book.current.context.trail, [{mode: 'base', label: 'First', surfaceRef: 'first', surfaceKind: 'artefact'}], 'the second transition leaves the real stop')
})

test('no write-back loop: a render that still shows the pre-apply store is not written over the link', () => {
  // A store that applies changes only on commit, the way React state does.
  let pendingContext = null
  let pendingMode = null
  const workspace = {mode: 'base', accessEpoch: 1}
  const book = {
    current: {context: {}},
    setContext(change) { pendingContext = change(pendingContext ?? book.current.context) },
    switchMode(next) { pendingMode = next },
  }
  const bridge = createSpineEncounterBridge({current: {book, workspace}})
  const spine = {
    snapshot: () => bridge.snapshot(),
    switchMode: next => book.switchMode(next),
    setContext: change => book.setContext(change),
  }
  const commit = () => {
    if (pendingContext) book.current.context = pendingContext
    if (pendingMode) workspace.mode = pendingMode
    pendingContext = null
    pendingMode = null
  }
  const w = fakeWindow('/index.html?arr=techne&subject=stone1950&kind=artefact')
  const link = createEncounterLink(spine, w.win)
  link.start()
  link.publish()
  assert.equal(w.calls.length, 0, 'the render right after the apply still shows the pre-apply store and writes nothing')
  commit()
  link.publish()
  assert.equal(w.calls.length, 0, 'once committed the store agrees with the link: nothing written')
  assert.equal(workspace.mode, 'techne')
  assert.equal(book.current.context.subject.ref, 'stone1950')
  link.dispose()
})
