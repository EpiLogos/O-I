import test from 'node:test';
import assert from 'node:assert/strict';
import { tupleKey, hasLiteralTuple } from '../src/tuple-keys.ts';

test('native tuples that collided at delimiter boundaries remain distinct', () => {
  const pairs = [
    [['field:a|b', 'participant:c'], ['field:a', 'b|participant:c']],
    [['field:a\u001fb', 'origin:c'], ['field:a', 'b\u001forigin:c']],
    [['grant:a\u001fb', 'operation:c'], ['grant:a', 'b\u001foperation:c']],
    [['field:a', 'participant:b|c', 'participant:d'], ['field:a', 'participant:b', 'c|participant:d']],
  ];
  for (const [left, right] of pairs) assert.notEqual(tupleKey(...left), tupleKey(...right));
});

test('physical keys retain exact string identity and tuple boundaries', () => {
  const values = ['a', 'a|b', 'a\u001fb', '\"', '\\', '\n', '\u0000', 'é', 'e\u0301', 'λ', '😀', '\ud800', '\udfff'];
  const observed = new Set();
  for (const left of values) for (const right of values) {
    const key = tupleKey(left, right);
    assert.deepEqual(JSON.parse(key.slice('tuple:v2:'.length)), [left, right]);
    assert.ok(!observed.has(key), 'different literal tuples cannot share a storage key');
    observed.add(key);
  }
  assert.notEqual(tupleKey('a', 'b'), tupleKey('a', 'b', ''));
  assert.notEqual(tupleKey('é'), tupleKey('e\u0301'));
});

test('a physical key or matching fingerprint does not establish stored authority identity', () => {
  const stored = { fieldRef: 'field:a|b', participantRef: 'participant:c', authorityKey: 'field:a|b|participant:c', role: 'contributor' };
  assert.equal(hasLiteralTuple(stored, { fieldRef: 'field:a', participantRef: 'b|participant:c' }), false);
  assert.equal(hasLiteralTuple(stored, { fieldRef: 'field:a|b', participantRef: 'participant:c' }), true);
  assert.equal(hasLiteralTuple({ ...stored, bindingRevision: 2 }, { bindingRevision: '2' }), false);
  assert.equal(hasLiteralTuple({ ...stored, bindingRevision: 2 }, { bindingRevision: 2 }), true);
});
