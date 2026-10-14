// The Earth's Sun follows the shared window's instant (projections/atlas/sunFollow.ts; T-ATLAS-SUN): a window that moves is
// read once it has been still for ~300 ms, and a reply is applied only when it answers the instant still wanted and no newer
// read has started. Channels: the logic is the module's own, run on injected timers and controlled reads (no kernel, no
// clock). What is NOT claimed: the status line and the globe are not drawn here.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createSunFollower, SUN_FOLLOW_DELAY_MS} from '../src/projections/atlas/sunFollow.ts'

/** Timers the test advances by hand: due callbacks run in time order, as a clock would run them. */
function fakeTimers() {
  let now = 0
  let seq = 0
  const due = new Map()
  return {
    set(run, ms) {
      const id = ++seq
      due.set(id, {at: now + ms, run})
      return id
    },
    clear(id) {
      due.delete(id)
    },
    advance(ms) {
      const end = now + ms
      for (;;) {
        let next = null
        for (const [id, job] of due) if (job.at <= end && (!next || job.at < next[1].at)) next = [id, job]
        if (!next) break
        due.delete(next[0])
        now = next[1].at
        next[1].run()
      }
      now = end
    },
    get pending() {
      return due.size
    },
  }
}

/** A reader whose replies the test resolves by hand, in whatever order it likes. */
function controlledReader() {
  const reads = []
  return {
    reads,
    read(instant) {
      return new Promise((resolve) => reads.push({instant, resolve}))
    },
  }
}

const flush = () => new Promise((resolve) => setImmediate(resolve))
const year = (y) => ({present: false, year: y})
const keyOf = (i) => (i.present ? 'present' : `year:${i.year}`)

function follower(drawnKey, timers, reader, applied) {
  return createSunFollower({
    keyOf,
    drawnKey,
    read: reader.read,
    apply: (state, instant) => applied.push({state, instant}),
    timers,
  })
}

test('the default still-time is about 300 ms', () => {
  assert.equal(SUN_FOLLOW_DELAY_MS, 300)
})

test('a scrub reads once, for the instant where the window stops, after it has been still', async () => {
  const timers = fakeTimers()
  const reader = controlledReader()
  const applied = []
  const f = follower('year:1800', timers, reader, applied)
  for (let y = 1801; y <= 1805; y++) {
    f.offer(year(y))
    timers.advance(100)
  }
  assert.equal(reader.reads.length, 0, 'nothing is read while the window moves')
  assert.equal(f.pending(), true, 'the window stands at an instant the Sun is not yet drawn for')
  // the last offer was 100 ms before the loop ended: the read is due 300 ms after that offer
  timers.advance(SUN_FOLLOW_DELAY_MS - 100 - 1)
  assert.equal(reader.reads.length, 0, 'not before the window has been still for the delay')
  timers.advance(1)
  assert.equal(reader.reads.length, 1, 'one read, once still')
  assert.deepEqual(reader.reads[0].instant, year(1805))
  reader.reads[0].resolve('state-1805')
  await flush()
  assert.deepEqual(applied, [{state: 'state-1805', instant: year(1805)}])
  assert.equal(f.pending(), false)
})

test('an instant with the drawn key is not read again', async () => {
  const timers = fakeTimers()
  const reader = controlledReader()
  const applied = []
  const f = follower('year:1931', timers, reader, applied)
  f.offer(year(1931))
  timers.advance(10 * SUN_FOLLOW_DELAY_MS)
  assert.equal(reader.reads.length, 0)
  assert.equal(f.pending(), false)
  assert.equal(applied.length, 0)
})

test('a reply for an instant the window has left is dropped; the instant still wanted is applied', async () => {
  const timers = fakeTimers()
  const reader = controlledReader()
  const applied = []
  const f = follower('year:1800', timers, reader, applied)
  f.offer(year(1900))
  timers.advance(SUN_FOLLOW_DELAY_MS)
  assert.equal(reader.reads.length, 1)
  // the window moves on before the first reply
  f.offer(year(1950))
  timers.advance(SUN_FOLLOW_DELAY_MS)
  assert.equal(reader.reads.length, 2, 'the newer instant is read once still')
  // the superseded reply arrives last-but-one: it is dropped, whatever it answers
  reader.reads[0].resolve('state-1900')
  await flush()
  assert.deepEqual(applied, [], 'a superseded reply draws nothing')
  assert.equal(f.pending(), true, 'the instant wanted is not yet drawn')
  reader.reads[1].resolve('state-1950')
  await flush()
  assert.deepEqual(applied, [{state: 'state-1950', instant: year(1950)}])
  assert.equal(f.pending(), false)
})

test('a reply that arrives after the window has moved back to the drawn instant draws nothing', async () => {
  const timers = fakeTimers()
  const reader = controlledReader()
  const applied = []
  const f = follower('year:1800', timers, reader, applied)
  f.offer(year(1900))
  timers.advance(SUN_FOLLOW_DELAY_MS)
  assert.equal(reader.reads.length, 1)
  f.offer(year(1800)) // back to the drawn instant while the read is in flight
  timers.advance(SUN_FOLLOW_DELAY_MS)
  assert.equal(reader.reads.length, 1, 'the drawn instant needs no read')
  reader.reads[0].resolve('state-1900')
  await flush()
  assert.deepEqual(applied, [], 'the reply for 1900 does not replace the Sun drawn for 1800')
  assert.equal(f.pending(), false)
})

test('an offer for the instant already wanted does not restart the still-time', async () => {
  const timers = fakeTimers()
  const reader = controlledReader()
  const applied = []
  const f = follower('year:1800', timers, reader, applied)
  f.offer(year(1900))
  timers.advance(200)
  f.offer(year(1900)) // the same instant again (a disclosure change that leaves the year as it was)
  timers.advance(100)
  assert.equal(reader.reads.length, 1, 'the read is due 300 ms after the first offer, not after the repeat')
})

test('a dispose cancels the pending read and drops a late reply', async () => {
  const timers = fakeTimers()
  const reader = controlledReader()
  const applied = []
  const f = follower('year:1800', timers, reader, applied)
  f.offer(year(1900))
  timers.advance(SUN_FOLLOW_DELAY_MS)
  f.dispose()
  reader.reads[0].resolve('state-1900')
  await flush()
  assert.deepEqual(applied, [])
  f.offer(year(1950))
  timers.advance(10 * SUN_FOLLOW_DELAY_MS)
  assert.equal(reader.reads.length, 1, 'no read after dispose')
  assert.equal(timers.pending, 0)
})

test('the present sky and a dated year are different instants', async () => {
  const timers = fakeTimers()
  const reader = controlledReader()
  const applied = []
  const f = follower('present', timers, reader, applied)
  f.offer({present: true, at: new Date('2026-10-14T10:00:00Z')})
  timers.advance(10 * SUN_FOLLOW_DELAY_MS)
  assert.equal(reader.reads.length, 0, 'the present stays drawn while the window is all time')
  f.offer(year(2026))
  assert.equal(f.pending(), true)
  timers.advance(SUN_FOLLOW_DELAY_MS)
  assert.equal(reader.reads.length, 1)
  assert.deepEqual(reader.reads[0].instant, year(2026))
})
