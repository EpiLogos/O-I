// The atlas lifetime (projections/atlas/src/ui/lifetime.ts; T-ATLAS-DISPOSE): every window, document and global listener, timer,
// frame and observer the mounted atlas registers is released by one dispose, and nothing registers once it is gone. Counted
// against stub targets (no DOM, no WebGL): a listener added is a listener removed, the signal is aborted, a cancelled timer
// or frame never runs, and the atlas's marks come off the shared document body. The Sun follower's default timers are the
// lifetime's too, so a follower still waiting when the atlas is disposed never reads.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ATLAS_BODY_CLASSES,
  ATLAS_BODY_DATA,
  beginLifetime,
  later,
  lifetimeLive,
  listen,
  nextFrame,
  watch,
  whenIdle,
} from '../src/projections/atlas/src/ui/lifetime.ts'
import {createSunFollower} from '../src/projections/atlas/sunFollow.ts'

/** A target that counts what is added and removed. The signal is honoured by the browser, not here: the explicit removal
 * is what this counts, and the test checks the signal is aborted too. */
class CountingTarget {
  added = []
  removed = []
  addEventListener(type, listener, options) {
    this.added.push({type, listener, options})
  }
  removeEventListener(type, listener) {
    this.removed.push({type, listener})
  }
  /** the listeners added and not yet removed */
  live() {
    return this.added.filter(a => !this.removed.some(r => r.type === a.type && r.listener === a.listener))
  }
}

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

function withGlobals(patch, body) {
  const saved = Object.fromEntries(Object.keys(patch).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  Object.assign(globalThis, patch)
  return Promise.resolve().then(body).finally(() => {
    for (const [k, d] of Object.entries(saved)) {
      if (d) Object.defineProperty(globalThis, k, d)
      else delete globalThis[k]
    }
  })
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

test('one lifetime at a time: a second begin is refused while one is live, and dispose frees the slot', () => {
  assert.equal(lifetimeLive(), false)
  const first = beginLifetime()
  assert.equal(first.live, true)
  assert.equal(lifetimeLive(), true)
  assert.throws(() => beginLifetime(), /already mounted/, 'a second lifetime is refused by name')
  first.dispose()
  assert.equal(first.live, false)
  assert.equal(lifetimeLive(), false)
  const second = beginLifetime()
  second.dispose()
})

test('every listener added under the lifetime is removed on dispose, and its signal is aborted', () => {
  const win = new CountingTarget()
  const doc = new CountingTarget()
  const life = beginLifetime()
  const onKey = () => {}
  const onHash = () => {}
  const onDown = () => {}
  listen(win, 'keydown', onKey)
  listen(win, 'hashchange', onHash)
  listen(doc, 'pointerdown', onDown, true)
  assert.equal(win.live().length, 2, 'two window listeners are bound while the atlas is mounted')
  assert.equal(doc.live().length, 1)
  const signal = win.added[0].options.signal
  assert.equal(signal.aborted, false)
  life.dispose()
  assert.deepEqual(win.live(), [], 'no window listener remains after dispose')
  assert.deepEqual(doc.live(), [], 'no document listener remains after dispose')
  assert.equal(win.removed.length, win.added.length, 'each addition is matched by a removal')
  assert.equal(doc.removed.length, doc.added.length)
  assert.equal(signal.aborted, true, 'the signal the listeners were added with is aborted')
  assert.equal(doc.removed[0].listener, onDown)
})

test('a listener removed by its own cancellation is not removed again on dispose', () => {
  const win = new CountingTarget()
  const life = beginLifetime()
  const stop = listen(win, 'resize', () => {})
  stop()
  assert.equal(win.removed.length, 1)
  life.dispose()
  assert.equal(win.removed.length, 1, 'dispose does not remove it twice')
})

test('timers and frames under the lifetime never run once it is disposed', async () => {
  const frames = []
  const cancelled = []
  let nextId = 1
  await withGlobals({
    requestAnimationFrame: cb => {
      const id = nextId++
      frames.push({id, cb})
      return id
    },
    cancelAnimationFrame: id => {
      cancelled.push(id)
    },
  }, async () => {
    const life = beginLifetime()
    let ranTimer = false
    let ranFrame = false
    later(() => { ranTimer = true }, 20)
    nextFrame(() => { ranFrame = true })
    life.dispose()
    assert.equal(cancelled.length, 1, 'the pending frame is cancelled')
    // a browser drops a cancelled frame: only the frames not cancelled are delivered
    for (const frame of frames) if (!cancelled.includes(frame.id)) frame.cb(0)
    await wait(40)
    assert.equal(ranTimer, false, 'the pending timer is cancelled')
    assert.equal(ranFrame, false, 'the pending frame does not run')
  })
})

test('a timer that fired before dispose is forgotten by the lifetime, so dispose does not touch it', async () => {
  const life = beginLifetime()
  let ran = 0
  later(() => { ran++ }, 5)
  await wait(30)
  assert.equal(ran, 1)
  life.dispose()
  assert.equal(ran, 1)
})

test('registrations made after dispose install nothing: no listener, timer, frame, observer or idle callback', async () => {
  const win = new CountingTarget()
  const observed = []
  let rafCalls = 0
  let idleCalls = 0
  await withGlobals({
    requestAnimationFrame: () => { rafCalls++; return 1 },
    cancelAnimationFrame: () => {},
    requestIdleCallback: () => { idleCalls++; return 1 },
    cancelIdleCallback: () => {},
  }, async () => {
    const life = beginLifetime()
    life.dispose()
    let ran = false
    listen(win, 'keydown', () => {})
    later(() => { ran = true }, 5)
    nextFrame(() => { ran = true })
    whenIdle(() => { ran = true }, 4000, 5)
    watch({observe: t => observed.push(t), disconnect: () => observed.push('disconnect')}, {})
    await wait(20)
    assert.equal(win.added.length, 0, 'no listener is added after dispose')
    assert.equal(rafCalls, 0, 'no frame is requested after dispose')
    assert.equal(idleCalls, 0, 'no idle callback is requested after dispose')
    assert.deepEqual(observed, [], 'no observer is attached after dispose')
    assert.equal(ran, false, 'nothing registered after dispose runs')
  })
})

test('an observer watched under the lifetime is disconnected on dispose', () => {
  const log = []
  const observer = {observe: () => log.push('observe'), disconnect: () => log.push('disconnect')}
  const life = beginLifetime()
  watch(observer, {})
  life.dispose()
  assert.deepEqual(log, ['observe', 'disconnect'])
})

test('whenIdle uses the platform idle callback and cancels it on dispose', async () => {
  const handles = []
  const cancelled = []
  await withGlobals({
    requestIdleCallback: () => { handles.push(7); return 7 },
    cancelIdleCallback: h => { cancelled.push(h) },
  }, async () => {
    const life = beginLifetime()
    let ran = false
    whenIdle(() => { ran = true }, 4000, 1500)
    life.dispose()
    assert.deepEqual(handles, [7])
    assert.deepEqual(cancelled, [7], 'the idle callback is cancelled')
    assert.equal(ran, false)
  })
})

test('dispose takes the atlas marks off the shared document body and keeps what the shell set', () => {
  const body = {classList: new FakeClassList(), dataset: {}}
  body.classList.add('mode-graph', 'sky-ready', 'shell-owned')
  body.dataset.mode = 'graph'
  body.dataset.lens = 'field'
  body.dataset.shellOwned = 'kept'
  const restore = globalThis.document
  globalThis.document = {body}
  try {
    const life = beginLifetime()
    life.dispose()
    for (const name of ATLAS_BODY_CLASSES) assert.equal(body.classList.contains(name), false, `${name} is taken off`)
    assert.equal(body.classList.contains('shell-owned'), true, 'a class the atlas does not own stays')
    for (const key of ATLAS_BODY_DATA) assert.equal(key in body.dataset, false, `data-${key} is taken off`)
    assert.equal(body.dataset.shellOwned, 'kept', 'a dataset key the atlas does not own stays')
    life.dispose()
  } finally {
    globalThis.document = restore
  }
})

test('the Sun follower created under the atlas waits on the lifetime: disposing the atlas stops its pending read', async () => {
  const life = beginLifetime()
  const reads = []
  const applied = []
  const follower = createSunFollower({
    keyOf: instant => instant,
    drawnKey: 'present',
    read: async instant => { reads.push(instant); return instant },
    apply: state => { applied.push(state) },
    delayMs: 15,
  })
  follower.offer('year:1800')
  assert.equal(follower.pending(), true, 'a read is pending for the instant the window stands at')
  life.dispose()
  await wait(40)
  assert.deepEqual(reads, [], 'the pending read never starts once the atlas is disposed')
  assert.deepEqual(applied, [])
})
