// The Live cut's auto-open: one attempt on entry and at most one retry, which waits for the retained GPU field to report live (or runs at
// the first check if it already is). Never a loop; a refusal after the retry stands; leaving Live ends the entry.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveEntry} from '../src/native-field/liveEntry.mjs';

// A fake instrument: each open() either succeeds (the instrument opens) or is refused; busy holds while an attempt is in flight.
function harness({fieldLive = false, refuse = []} = {}) {
  const h = {opened: false, busy: false, field: fieldLive, attempts: 0, refusals: [...refuse]};
  h.open = () => {
    h.attempts += 1;
    h.busy = true;
    const refused = h.refusals.shift() ?? false;
    queueMicrotask(() => { h.busy = false; if (!refused) h.opened = true; });
  };
  h.entry = createLiveEntry({open: h.open, isOpen: () => h.opened, isBusy: () => h.busy, fieldLive: () => h.field});
  return h;
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('an entry whose first attempt opens the instrument makes no retry', async () => {
  const h = harness({fieldLive: true});
  h.entry.enter();
  await settle();
  h.entry.check(); h.entry.check();
  assert.equal(h.attempts, 1);
  assert.equal(h.entry.pending, false, 'opened: the entry is done');
});

test('a refused first attempt with the field already live is retried at the first check, and only once', async () => {
  const h = harness({fieldLive: true, refuse: [true, true, true]});
  h.entry.enter();
  await settle();
  h.entry.check();
  await settle();
  for (let i = 0; i < 5; i++) { h.entry.check(); await settle(); }
  assert.equal(h.attempts, 2, 'one attempt and one retry: never a loop');
  assert.equal(h.opened, false, 'the retry was refused: the refusal stands');
  assert.equal(h.entry.pending, false);
});

test('a refused first attempt waits for the retained GPU field, then retries once when it reports live', async () => {
  const h = harness({fieldLive: false, refuse: [true, false]});
  h.entry.enter();
  await settle();
  for (let i = 0; i < 3; i++) { h.entry.check(); await settle(); }
  assert.equal(h.attempts, 1, 'no retry while the field is not live');
  assert.equal(h.entry.pending, true, 'the entry still waits for its one retry');
  h.field = true;
  h.entry.check();
  await settle();
  assert.equal(h.attempts, 2, 'the retry runs once the field reports live');
  assert.equal(h.opened, true, 'the retry opened the instrument');
  h.entry.check(); h.entry.check();
  assert.equal(h.attempts, 2, 'nothing after the retry');
});

test('a retry that is refused too stands, and the entry does not start another', async () => {
  const h = harness({fieldLive: false, refuse: [true, true]});
  h.entry.enter();
  await settle();
  h.field = true;
  h.entry.check();
  await settle();
  for (let i = 0; i < 4; i++) { h.entry.check(); await settle(); }
  assert.equal(h.attempts, 2);
  assert.equal(h.opened, false);
  assert.equal(h.entry.pending, false, 'a settled entry holds no further attempt');
});

test('a check while an attempt is in flight does not start a second one', async () => {
  const h = harness({fieldLive: true, refuse: [true]});
  h.entry.enter();
  h.entry.check(); h.entry.check();
  assert.equal(h.attempts, 1, 'busy: the in-flight attempt is not doubled');
  await settle();
});

test('leaving Live ends the entry: no retry runs for it, and a later entry starts fresh with its own one retry', async () => {
  const h = harness({fieldLive: false, refuse: [true, true, true]});
  h.entry.enter();
  await settle();
  h.entry.leave();
  h.field = true;
  h.entry.check();
  await settle();
  assert.equal(h.attempts, 1, 'the left entry runs no retry');
  h.entry.enter();
  await settle();
  h.entry.check();
  await settle();
  h.entry.check();
  await settle();
  assert.equal(h.attempts, 3, 'the new entry: its first attempt and one retry');
});

test('an entry entered while another operation holds the owner waits, then makes its one attempt', async () => {
  const h = harness({fieldLive: true});
  h.busy = true;
  h.entry.enter();
  assert.equal(h.attempts, 0);
  h.busy = false;
  h.entry.check();
  await settle();
  assert.equal(h.attempts, 1);
});
