// The Earth pane's attach, hold and release (projections/atlas/AtlasProjectionPanel.tsx; T-ATLAS-DISPOSE). The real panel runs
// here, through the attach path: one atlas per session, a second pane told the atlas is open elsewhere (named, not thrown),
// closing the holder disposes the atlas and releases its window listener, and the next pane mounts a fresh atlas. Two
// modules are stood in for by the loader: the WebGL mount (fixtures/atlas-mount-stub.mjs, which keeps the lifetime contract
// the real mountAtlas keeps) and the corpus provider (fixtures/atlas-provider-stub.mjs, the atlas's fixture corpus). What is
// NOT claimed here: that the real globe mounts, draws and disposes its GPU resources. That is verified on screen.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const mountStub = new URL('./fixtures/atlas-mount-stub.mjs', import.meta.url).href
const providerStub = new URL('./fixtures/atlas-provider-stub.mjs', import.meta.url).href

// The in-memory TypeScript loader of the atlas host suite, with two stand-ins: the panel's mount and provider imports
// resolve to the stub modules above. Every other module is the production module.
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const STUBS = {'./mount': ${JSON.stringify(mountStub)}, './provider/suiteProvider': ${JSON.stringify(providerStub)}};
export async function resolve(s, c, n) {
  if (c.parentURL && c.parentURL.endsWith('/AtlasProjectionPanel.tsx') && STUBS[s]) return {url: STUBS[s], format: 'module', shortCircuit: true};
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
  const text = (await readFile(new URL(u), 'utf8')).replace(/import\.meta\.env/g, '({BASE_URL:"/"})');
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(text, {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

// ── a DOM stand-in: the attach path creates, appends and empties elements, and binds one window listener through the stub ──
class FakeClassList {
  set = new Set()
  add(...names) { names.forEach(n => this.set.add(n)) }
  remove(...names) { names.forEach(n => this.set.delete(n)) }
  toggle(name, force) {
    const on = force === undefined ? !this.set.has(name) : !!force
    if (on) this.set.add(name)
    else this.set.delete(name)
    return on
  }
  contains(name) { return this.set.has(name) }
}
class FakeNode {
  children = []
  attrs = {}
  classList = new FakeClassList()
  dataset = {}
  className = ''
  textContent = ''
  isConnected = true
  constructor(tag) { this.tagName = tag }
  append(...nodes) { this.children.push(...nodes) }
  replaceChildren(...nodes) { this.children = [...nodes] }
  setAttribute(name, value) { this.attrs[name] = String(value) }
  remove() { this.isConnected = false }
  closest() { return null }
}
/** A window-like target counting what is added and removed. */
class CountingTarget {
  added = []
  removed = []
  addEventListener(type, listener, options) { this.added.push({type, listener, options}) }
  removeEventListener(type, listener) { this.removed.push({type, listener}) }
  live() { return this.added.filter(a => !this.removed.some(r => r.type === a.type && r.listener === a.listener)) }
}
class FakeObserver {
  observe() {}
  disconnect() {}
}

const win = new CountingTarget()
globalThis.window = win
globalThis.document = {
  createElement: tag => new FakeNode(tag),
  body: new FakeNode('body'),
  documentElement: new FakeNode('html'),
  addEventListener() {},
  removeEventListener() {},
}
globalThis.MutationObserver = FakeObserver
globalThis.IntersectionObserver = FakeObserver

const transport = {kind: 'unavailable', reason: 'the attach test has no kernel'}
const pane = () => new FakeNode('div')
const stub = await import(mountStub)
const panel = await import(new URL('../src/projections/atlas/AtlasProjectionPanel.tsx', import.meta.url).href)
const {lifetimeLive} = await import(new URL('../src/projections/atlas/src/ui/lifetime.ts', import.meta.url).href)
panel.bindAtlasScope({namespace: 'test.atlas-dispose', workspaceId: 'w1'})


// The held pane's handover and the attach's teardown (projections/atlas/AtlasProjectionPanel.tsx; T-ATLAS-DISPOSE). The
// claim frees when its holder releases it: the first pane that asked mounts the atlas, the others stay held, in the order
// they asked. A throw part way through an attach releases every observer, subscription, follower and timer it made. The
// loader, the DOM stand-in and the mount and provider stubs are those of atlas-dispose.test.mjs.

const until = async (condition, ms = 3000) => {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > ms) throw Error('timed out waiting')
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}
const heldText = element => element.children.map(child => child.textContent)

// Observers that count what is observed and not yet disconnected (the attach's MutationObserver).
let observersLive = 0
globalThis.MutationObserver = class {
  constructor(callback) { this.callback = callback }
  observe() { observersLive++ }
  disconnect() { observersLive-- }
}

// The shell's disclosure session: the subscriptions the attach holds, counted through the same singleton the panel imports.
const session = (await import(new URL('../../../../desktop/cradle/src/techne/session.ts', import.meta.url).href)).disclosureSession
let subscriptionsLive = 0
const realSubscribe = session.subscribe.bind(session)
session.subscribe = listener => {
  subscriptionsLive++
  const unsubscribe = realSubscribe(listener)
  let gone = false
  return () => {
    if (!gone) subscriptionsLive--
    gone = true
    unsubscribe()
  }
}

test('a held pane mounts when the holder releases the claim; the first pane that asked wins, the others stay held', async () => {
  const mounts = stub.stubState().mounts
  const holder = await panel.attachAtlas({element: pane(), transport, follow: true})
  assert.equal(holder.held, null)

  const firstAsked = []
  const secondAsked = []
  const waitElement = pane()
  const first = await panel.attachAtlas({element: waitElement, transport, follow: true, onHandover: o => firstAsked.push(o)})
  const secondElement = pane()
  const second = await panel.attachAtlas({element: secondElement, transport, follow: true, onHandover: o => secondAsked.push(o)})
  assert.equal(first.held, panel.ATLAS_HELD_MESSAGE)
  assert.equal(second.held, panel.ATLAS_HELD_MESSAGE)

  holder.unmount()
  await until(() => firstAsked.length === 1)
  assert.equal('attachment' in firstAsked[0], true, 'the first waiting pane is handed a mounted atlas')
  assert.equal(firstAsked[0].attachment.held, null, 'the handed pane holds the atlas')
  assert.equal(stub.stubState().mounts, mounts + 2, 'one fresh mount for the handover')
  assert.equal(lifetimeLive(), true, 'the atlas is live under the new holder')
  assert.equal(secondAsked.length, 0, 'the second waiting pane is not woken while the first holds the claim')
  assert.deepEqual(heldText(secondElement), [panel.ATLAS_HELD_MESSAGE], 'the second pane stays held in its body')
  assert.equal(heldText(waitElement).includes(panel.ATLAS_HELD_MESSAGE), false, 'the handed pane no longer says it is held')

  // the first holder closes: the claim passes to the next pane that asked, and no third mount happens
  firstAsked[0].attachment.unmount()
  await until(() => secondAsked.length === 1)
  assert.equal(secondAsked[0].attachment.held, null, 'the second pane mounts once the claim frees again')
  assert.equal(stub.stubState().mounts, mounts + 3)
  secondAsked[0].attachment.unmount()
  assert.equal(lifetimeLive(), false, 'with no pane left waiting, the claim is free')
  second.unmount()
  first.unmount()
})

test('a waiting pane that closes before the claim frees is not woken, and the claim passes over it', async () => {
  const mounts = stub.stubState().mounts
  const holder = await panel.attachAtlas({element: pane(), transport, follow: true})
  const gone = []
  const waiter = await panel.attachAtlas({element: pane(), transport, follow: true, onHandover: o => gone.push(o)})
  const kept = []
  const after = await panel.attachAtlas({element: pane(), transport, follow: true, onHandover: o => kept.push(o)})
  waiter.unmount()
  holder.unmount()
  await until(() => kept.length === 1)
  assert.equal(gone.length, 0, 'a pane that closed while waiting is not handed the atlas')
  assert.equal(stub.stubState().mounts, mounts + 2)
  kept[0].attachment.unmount()
  after.unmount()
})

test('a failed mount for the handed pane is reported to that pane, and the claim is released for the next waiter', async () => {
  const holder = await panel.attachAtlas({element: pane(), transport, follow: true})
  const failed = []
  const next = []
  const a = await panel.attachAtlas({element: pane(), transport, follow: true, onHandover: o => failed.push(o)})
  const b = await panel.attachAtlas({element: pane(), transport, follow: true, onHandover: o => next.push(o)})
  stub.failNextMount()
  holder.unmount()
  await until(() => failed.length === 1)
  assert.ok('error' in failed[0], 'the handed pane is told the mount refused')
  await until(() => next.length === 1)
  assert.equal(next[0].attachment.held, null, 'the refused claim passes to the next waiting pane')
  next[0].attachment.unmount()
  a.unmount()
  b.unmount()
})

test('a throw part way through the attach leaves no observer, subscription, follower or timer, and the claim is released', async () => {
  const before = stub.stubState().disposals
  panel.presentAtlasView('earth') // the attach then skips its own first read of the view, so the observer is made before the throw
  stub.refuseStateReads(true)
  await assert.rejects(panel.attachAtlas({element: pane(), transport, follow: true}), /stub state refused/)
  stub.refuseStateReads(false)
  assert.equal(observersLive, 0, 'the attach\'s observer is disconnected')
  assert.equal(subscriptionsLive, 0, 'the disclosure subscription the attach made is released')
  assert.equal(lifetimeLive(), false, 'the atlas lifetime, with its timers, is released')
  assert.equal(stub.stubState().disposals, before + 1, 'the mounted atlas is disposed')
  const again = await panel.attachAtlas({element: pane(), transport, follow: true})
  assert.equal(again.held, null, 'the claim is free after the failed attach')
  again.unmount()
  assert.equal(observersLive, 0)
  assert.equal(subscriptionsLive, 0)
})

test('a clean attach and close leave no observer or subscription behind', async () => {
  const attached = await panel.attachAtlas({element: pane(), transport, follow: true})
  assert.equal(observersLive, 1)
  // T-PLACES-ONTO-ATLAS: two disclosure subscriptions while the atlas stands — the Sun's (the window's instant) and Places' (the shared
  // spatial focus turns the Earth, places/placesHost.ts); both are released with it
  assert.equal(subscriptionsLive, 2)
  attached.unmount()
  assert.equal(observersLive, 0)
  assert.equal(subscriptionsLive, 0)
})

// ── the Earth goes where the person is looking (r23, 19 Oct: Technē's centre pane said the atlas was open in another pane, and the
// pane that held it was a concealed pane of another mode's layout, which stays mounted while concealed) ──
//
// A held pane shown while the holder is concealed takes the claim: the concealed holder tears its atlas down through its own teardown,
// which releases the claim to the pane on screen, and becomes a held pane that waits. A holder on screen keeps the Earth.

const settle = () => new Promise(resolve => setTimeout(resolve, 30))

// The Earth pane kind through the module door (registerAtlasHost.ts), as the shell's panes mount it (projectionPaneSession.ts).
const modules = await import(new URL('../../../../desktop/cradle/src/surface/projectionModules.ts', import.meta.url).href)
const {registerAtlasHost} = await import(new URL('../src/projections/atlas/registerAtlasHost.ts', import.meta.url).href)
registerAtlasHost()
const earth = modules.projectionModule('projection.earth')
const context = element => ({kind: 'projection.earth', binding: {id: 'earth', title: 'Earth'}, element, encounter: undefined, subject: undefined})

test('a held pane shown while the holder is concealed takes the Earth; the concealed holder tears its atlas down and waits', async () => {
  const {mounts, disposals} = {...stub.stubState()}
  const holderTold = []
  const holderElement = pane()
  const holder = await panel.attachAtlas({element: holderElement, transport, follow: true, onHandover: o => holderTold.push(o)})
  const waiterTold = []
  const waiterElement = pane()
  const waiter = await panel.attachAtlas({element: waiterElement, transport, follow: false, view: 'earth', onHandover: o => waiterTold.push(o)})
  assert.equal(waiter.held, panel.ATLAS_HELD_MESSAGE)

  holder.setVisible(false)
  waiter.setVisible(true)
  await until(() => waiterTold.length === 1)
  assert.equal(waiterTold[0].attachment.held, null, 'the pane on screen holds the Earth')
  assert.equal(heldText(waiterElement).includes(panel.ATLAS_HELD_MESSAGE), false, 'and no longer says it is held')
  assert.equal(stub.stubState().disposals, disposals + 1, 'the concealed holder\'s atlas is disposed')
  assert.equal(stub.stubState().mounts, mounts + 2, 'one fresh mount, in the pane on screen')
  assert.equal(lifetimeLive(), true, 'one atlas stands')
  assert.equal(holderTold.length, 1, 'the concealed pane is told it no longer holds the Earth')
  assert.equal(holderTold[0].attachment.held, panel.ATLAS_HELD_MESSAGE, 'it is a held pane now')
  assert.deepEqual(heldText(holderElement), [panel.ATLAS_HELD_MESSAGE], 'and says so in its body')

  // the concealed pane waits in line: when the pane on screen closes, the claim passes back to it
  waiterTold[0].attachment.unmount()
  await until(() => holderTold.length === 2)
  assert.equal(holderTold[1].attachment.held, null)
  assert.equal(stub.stubState().mounts, mounts + 3)
  holderTold[1].attachment.unmount()
  assert.equal(lifetimeLive(), false)
  waiter.unmount()
  holder.unmount()
})

test('a holder on screen keeps the Earth; once it is concealed the Earth moves to the held pane on screen, and back again', async () => {
  const {mounts, disposals} = {...stub.stubState()}
  const aTold = []
  const a = await panel.attachAtlas({element: pane(), transport, follow: true, onHandover: o => aTold.push(o)})
  const bTold = []
  const b = await panel.attachAtlas({element: pane(), transport, follow: false, view: 'graph', onHandover: o => bTold.push(o)})
  a.setVisible(true)
  b.setVisible(true)
  await settle()
  assert.equal(bTold.length, 0, 'two panes on screen: the one that opened it first keeps it')
  assert.equal(stub.stubState().mounts, mounts + 1)

  a.setVisible(false)
  await until(() => bTold.length === 1)
  assert.equal(bTold[0].attachment.held, null, 'the holder is concealed: the held pane on screen takes the Earth')
  assert.equal(aTold.length, 1)
  assert.equal(aTold[0].attachment.held, panel.ATLAS_HELD_MESSAGE)

  // the person goes back: b is concealed, a is shown — the Earth follows, still drawn once
  bTold[0].attachment.setVisible(false)
  await settle()
  assert.equal(aTold.length, 1, 'a concealed holder with no held pane on screen keeps the Earth')
  aTold[0].attachment.setVisible(true)
  await until(() => aTold.length === 2)
  assert.equal(aTold[1].attachment.held, null)
  assert.equal(bTold.length, 2)
  assert.equal(bTold[1].attachment.held, panel.ATLAS_HELD_MESSAGE)
  assert.equal(stub.stubState().mounts, mounts + 3, 'one mount per move, never two at once')
  assert.equal(stub.stubState().disposals, disposals + 2)
  aTold[1].attachment.unmount()
  await until(() => bTold.length === 3)
  bTold[2].attachment.unmount()
  assert.equal(lifetimeLive(), false)
  a.unmount()
  b.unmount()
})

test('a held pane never told it is shown does not take the Earth from a concealed holder', async () => {
  const {mounts} = {...stub.stubState()}
  const holder = await panel.attachAtlas({element: pane(), transport, follow: true, onHandover: () => {}})
  holder.setVisible(false)
  const told = []
  const waiter = await panel.attachAtlas({element: pane(), transport, follow: true, onHandover: o => told.push(o)})
  await settle()
  waiter.setVisible(false)
  await settle()
  assert.equal(told.length, 0, 'panes mounted concealed in other modes\' layouts do not pull the Earth between them')
  assert.equal(stub.stubState().mounts, mounts + 1)
  waiter.unmount()
  holder.unmount()
  assert.equal(lifetimeLive(), false)
})

test('when the claim frees, a held pane on screen is handed the Earth before a concealed one that asked earlier', async () => {
  const holder = await panel.attachAtlas({element: pane(), transport, follow: true})
  const concealedTold = []
  const concealed = await panel.attachAtlas({element: pane(), transport, follow: true, onHandover: o => concealedTold.push(o)})
  concealed.setVisible(false)
  const shownTold = []
  const shown = await panel.attachAtlas({element: pane(), transport, follow: true, onHandover: o => shownTold.push(o)})
  shown.setVisible(true)
  holder.unmount()
  await until(() => shownTold.length === 1)
  assert.equal(shownTold[0].attachment.held, null)
  assert.equal(concealedTold.length, 0, 'the concealed pane keeps waiting')
  shownTold[0].attachment.unmount()
  await until(() => concealedTold.length === 1)
  concealedTold[0].attachment.unmount()
  concealed.unmount()
  shown.unmount()
  assert.equal(lifetimeLive(), false)
})

test('the Earth pane kind (the module door) adopts the Earth when it is handed over, and its unmount disposes it', async () => {
  const {mounts, disposals} = {...stub.stubState()}
  const concealedElement = pane()
  const concealed = await earth.create(context(concealedElement))
  concealed.setVisible(false)
  const shownElement = pane()
  const shown = await earth.create(context(shownElement))
  shown.setVisible(true)
  await until(() => stub.stubState().mounts === mounts + 2)
  await until(() => heldText(concealedElement).includes(panel.ATLAS_HELD_MESSAGE))
  assert.equal(heldText(shownElement).includes(panel.ATLAS_HELD_MESSAGE), false, 'the pane on screen draws the Earth')
  assert.equal(stub.stubState().disposals, disposals + 1)
  // the pane on screen closes: its handle tears down the atlas it was handed, and the claim passes to the concealed pane
  shown.unmount()
  assert.equal(stub.stubState().disposals, disposals + 2, 'the handed atlas is disposed with its pane')
  await until(() => stub.stubState().mounts === mounts + 3)
  concealed.unmount()
  assert.equal(stub.stubState().disposals, disposals + 3)
  assert.equal(lifetimeLive(), false, 'no claim is left behind')
})

test('a handover the mount refuses is said in the Earth pane\'s body', async () => {
  const holder = await earth.create(context(pane()))
  const waitingElement = pane()
  const waiter = await earth.create(context(waitingElement))
  stub.failNextMount()
  holder.unmount()
  await until(() => heldText(waitingElement).some(text => text.startsWith('The Earth could not mount:')))
  assert.deepEqual(heldText(waitingElement), ['The Earth could not mount: stub mount refused'])
  waiter.unmount()
  assert.equal(lifetimeLive(), false)
})
