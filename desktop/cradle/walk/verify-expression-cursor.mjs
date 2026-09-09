import assert from 'node:assert/strict';
import {advanceCompletion} from '../src/agent/expressionReading.ts';
// Exercise the production cursor through the reported pagination regression.
let high;
const step=observed=>{const result=advanceCompletion(high,observed);high=result.highWater;return result.arrived;};
assert.equal(step(80),false); // First historical reading is not an arrival.
assert.equal(step(12),false); // Earlier page cannot lower the cursor.
assert.equal(high,80);
assert.equal(step(undefined),false);
assert.equal(step(80),false); // Latest returns the same completion.
assert.equal(step(81),true); // Only a new completion arrives.
assert.equal(step(81),false);
assert.equal(step(15),false);
assert.equal(step(81),false);
assert.equal(high,81);
console.log('PASS production completion cursor: initial history, Earlier/Latest, absence, new completion, repeat');
