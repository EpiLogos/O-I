import test from 'node:test';
import assert from 'node:assert/strict';
import {readings} from './factory-run-fixture.mjs';
import {composeRunExpression} from '../src/contributions/factory/run-expression.ts';
import {nativeRunDisplayTitle} from '../src/contributions/factory/run-expression-display.ts';

test('native display titles admit multiline and long Unicode Returns without changing source evidence',()=>{
  const data=readings();data.run.destination='Repair\nthe actual\tRun';
  data.attempt.attempts[0].readableReturn.summary='Original failure\n'+ '🧭'.repeat(1400);
  const before=structuredClone(data);const doc=composeRunExpression(data,'expression:title-contract');
  assert.deepEqual(data,before);
  for(const entity of Object.values(doc.entities)){
    assert.ok(Buffer.byteLength(entity.title,'utf8')<=4096);
    assert.ok(!/[\u0000-\u001f\u007f-\u009f]/u.test(entity.title));
  }
  assert.equal(doc.entities['expression:title-contract:entity:run'].title,'Repair the actual Run');
  const returned=Object.values(doc.entities).find(e=>e.subject.subject_ref==='return:repair');
  assert.ok(returned.title.endsWith('…'));assert.ok(data.attempt.attempts[0].readableReturn.summary.includes('\n'));
});
test('display truncation never splits Unicode and keeps exact short titles',()=>{
  assert.equal(nativeRunDisplayTitle('Native title'), 'Native title');
  assert.ok(!nativeRunDisplayTitle('😀'.repeat(1200)).includes('\uFFFD'));
  assert.equal(nativeRunDisplayTitle('\n\t'), 'Untitled');
});
