/** Expression runtime belongs to the Cradle host, not this portable package. */
import assert from 'node:assert/strict';
import {gestureFor} from '../expression.mjs';
assert.equal(gestureFor('resize'),'edge');
for(const intent of ['open','close','split','move','save'])assert.equal(gestureFor(intent),null);
assert.throws(()=>gestureFor('invented'),RangeError);
await import('../../../desktop/cradle/tests/native-cues-lifecycle.mjs');
