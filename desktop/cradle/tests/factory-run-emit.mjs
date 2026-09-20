// Test-only specimen -> actual production composer -> native kernel probe.
import {readings} from './factory-run-fixture.mjs';
import {composeRunExpression} from '../src/contributions/factory/run-expression.ts';
const data=readings();
data.units.units[0].workflowUnitRef='workflow-unit:'+ 'x'.repeat(250);
data.attempt.attempts[0].workflowUnitRef=data.units.units[0].workflowUnitRef;
console.log(JSON.stringify(composeRunExpression(data,'expression:native-factory-receiving')));
