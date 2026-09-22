/** The composition root's summon-record decision (CradleFrame's production
 * routing, extracted): a construction summon becomes a field-open ONLY in the
 * Technē cut, and it names the presented Technē centre by the SAME
 * centreBindingOf(ws,"techne","techne") call the stage slot uses to mount that
 * centre — so the recorded target is always the presented host's binding id.
 * This closes the §41 fail-on-disconnect coverage gap two independent reviews
 * flagged: a regression to the mode gate or the target resolution now fails a
 * test. Pure logic; centreBindingOf is injected. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {techneFieldOpenRequest} from '../src/surface/techneSummonRecord.ts';

const workspace = {id: 'w'}; // opaque — only handed to resolveCentre
const presented = {id: 'techne-centre-42', kind: 'techne'};

test('records ONLY in the Technē cut — every other mode is suppressed', () => {
  const stub = () => presented;
  for (const mode of ['base', 'expressions', 'factory', 'epi-logos', 'settings']) {
    assert.equal(techneFieldOpenRequest(workspace, mode, 'expression:x', stub), null, `${mode} records nothing`);
  }
  assert.deepEqual(techneFieldOpenRequest(workspace, 'techne', 'expression:x', stub), {ref: 'expression:x', target: 'techne-centre-42'});
});

test('names the presented centre by the SAME centreBindingOf call the stage slot uses', () => {
  const calls = [];
  const stub = (...args) => { calls.push(args); return presented; };
  techneFieldOpenRequest(workspace, 'techne', 'expression:x', stub);
  assert.deepEqual(calls, [[workspace, 'techne', 'techne']], 'resolveCentre is called with (workspace, "techne", "techne") — identical to the stage-slot mount');
});

test('the target is the presented centre binding id, verbatim', () => {
  const req = techneFieldOpenRequest(workspace, 'techne', 'expression:x', () => ({id: 'other-id', kind: 'techne'}));
  assert.equal(req.target, 'other-id');
});

test('a non-Expression ref is never recorded', () => {
  const stub = () => presented;
  assert.equal(techneFieldOpenRequest(workspace, 'techne', 'not-an-expression', stub), null);
  assert.equal(techneFieldOpenRequest(workspace, 'techne', undefined, stub), null);
  assert.equal(techneFieldOpenRequest(workspace, 'techne', '', stub), null);
  assert.equal(techneFieldOpenRequest(workspace, 'techne', 42, stub), null);
});

test('no presented Technē centre → target null (the documented any-host fallback)', () => {
  assert.deepEqual(techneFieldOpenRequest(workspace, 'techne', 'expression:x', () => undefined), {ref: 'expression:x', target: null});
});
