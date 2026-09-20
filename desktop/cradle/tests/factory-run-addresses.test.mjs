import test from 'node:test';
import assert from 'node:assert/strict';
import {readings} from './factory-run-fixture.mjs';
import {composeRunExpression} from '../src/contributions/factory/run-expression.ts';

test('long native refs survive intact within the native 128-byte local-address limit',()=>{
  const data=readings();
  data.units.units[0].workflowUnitRef='workflow-unit:'+ 'a'.repeat(250);
  data.attempt.attempts[0].workflowUnitRef=data.units.units[0].workflowUnitRef;
  const expressionRef='expression:factory-long-identity';
  const document=composeRunExpression(data,expressionRef);
  assert.ok(Object.values(document.entities).some(entity=>entity.subject.subject_ref===data.units.units[0].workflowUnitRef));
  for(const ref of Object.keys(document.entities))assert.ok(ref.slice(`${expressionRef}:entity:`.length).length<=128);
  assert.equal(new Set(Object.keys(document.entities)).size,Object.keys(document.entities).length);
});
