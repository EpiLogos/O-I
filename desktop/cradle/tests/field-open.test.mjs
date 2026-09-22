/** The buffered Technē field-open store: one recorder, one consumer, enforced.
 * A concealed Technē host that stayed mounted reads a `target` that is not its
 * own binding id and leaves the ref for the presented host — the "one consumer"
 * invariant the T3 review required be enforced, not assumed. Pure logic, no
 * browser or kernel. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestTechneFieldOpen, consumeTechneFieldOpen, peekTechneFieldOpen, peekTechneFieldTarget, resetTechneFieldOpen} from '../src/expressions/fieldOpen.ts';

test('a non-Expression ref is never recorded', () => {
  resetTechneFieldOpen();
  requestTechneFieldOpen('not-an-expression');
  requestTechneFieldOpen('');
  assert.equal(peekTechneFieldOpen(), null);
});

test('with no target named, any Technē host may consume, exactly once', () => {
  resetTechneFieldOpen();
  requestTechneFieldOpen('expression:knowledge-abc');
  assert.equal(peekTechneFieldOpen(), 'expression:knowledge-abc');
  assert.equal(peekTechneFieldTarget(), null);
  assert.equal(consumeTechneFieldOpen('any-host'), 'expression:knowledge-abc');
  assert.equal(peekTechneFieldOpen(), null, 'consuming clears it');
  assert.equal(consumeTechneFieldOpen('any-host'), null, 'a summon opens exactly once');
});

test('a named target is consumed only by the host whose id matches; a concealed host leaves it', () => {
  resetTechneFieldOpen();
  requestTechneFieldOpen('expression:knowledge-xyz', 'techne-presented');
  assert.equal(peekTechneFieldTarget(), 'techne-presented');
  // The concealed host (a warm tree / foreign-tree pane tab) reads the ref but
  // leaves it — it is not the presented centre.
  assert.equal(consumeTechneFieldOpen('techne-concealed'), null, 'a concealed host does not consume');
  assert.equal(peekTechneFieldOpen(), 'expression:knowledge-xyz', 'the ref survives for the presented host');
  // The presented host, named by the recorder, consumes it.
  assert.equal(consumeTechneFieldOpen('techne-presented'), 'expression:knowledge-xyz', 'the presented host consumes');
  assert.equal(peekTechneFieldOpen(), null);
});

test('a host with no id does not consume a targeted ref', () => {
  resetTechneFieldOpen();
  requestTechneFieldOpen('expression:knowledge-t', 'techne-presented');
  assert.equal(consumeTechneFieldOpen(null), null, 'an unidentified host does not consume a targeted ref');
  assert.equal(peekTechneFieldOpen(), 'expression:knowledge-t');
});

test('recording again replaces the pending ref/target (the field shows one subject)', () => {
  resetTechneFieldOpen();
  requestTechneFieldOpen('expression:knowledge-1', 'a');
  requestTechneFieldOpen('expression:knowledge-2', 'b');
  assert.equal(peekTechneFieldOpen(), 'expression:knowledge-2');
  assert.equal(peekTechneFieldTarget(), 'b');
  assert.equal(consumeTechneFieldOpen('a'), null);
  assert.equal(consumeTechneFieldOpen('b'), 'expression:knowledge-2');
});

test('reset clears any pending ref', () => {
  requestTechneFieldOpen('expression:knowledge-r', 'x');
  resetTechneFieldOpen();
  assert.equal(peekTechneFieldOpen(), null);
  assert.equal(consumeTechneFieldOpen('x'), null);
});
