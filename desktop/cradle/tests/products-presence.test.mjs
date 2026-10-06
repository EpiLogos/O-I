import test from 'node:test';
import assert from 'node:assert/strict';
import {presentProducts, knownPresent, notKnownAbsent, modesOffered, MODE_PRODUCT, WORKCELL} from '../src/workspace/products.ts';
import {STRIP_MODES} from '../src/workspace/mode.ts';

const position = (product_id, present) => ({product_id, availability: present ? 'discovered' : 'missing', native_state: '', current_world: present === undefined ? {} : {present}});
// The census of a minimal installation: Central, Actuation, AIKit and QL are present; Factory and Workcell are not.
const minimal = {positions: [position('central', true), position('actuation', true), position('ai-kit', true), position('software-factory', false), position('workcell', false), position('quaternal-logic', true)]};

test('presence is the census\'s own present fact, per product', () => {
  const presence = presentProducts(minimal);
  assert.deepEqual([...presence].sort(), ['actuation', 'ai-kit', 'central', 'quaternal-logic']);
  assert.equal(knownPresent(presence, WORKCELL), false);
  assert.equal(knownPresent(presence, 'quaternal-logic'), true);
});

test('an older census with no present facts is unknown: it never licenses a dispatch and never hides a surface', () => {
  const presence = presentProducts({positions: [position('central'), position('workcell')]});
  assert.equal(presence, undefined);
  assert.equal(knownPresent(presence, WORKCELL), false, 'no dispatch to a product on an unread census');
  assert.equal(notKnownAbsent(presence, 'software-factory'), true, 'no hiding before the census says absent');
  assert.equal(presentProducts(undefined), undefined);
});

test('the mode strip offers Factory only when the census does not say it is absent', () => {
  assert.equal(MODE_PRODUCT.factory, 'software-factory');
  assert.ok(STRIP_MODES.includes('factory'));
  assert.deepEqual(modesOffered(STRIP_MODES, presentProducts(minimal)), STRIP_MODES.filter(mode => mode !== 'factory'));
  const withFactory = {positions: [...minimal.positions.filter(p => p.product_id !== 'software-factory'), position('software-factory', true)]};
  assert.deepEqual(modesOffered(STRIP_MODES, presentProducts(withFactory)), [...STRIP_MODES]);
  assert.deepEqual(modesOffered(STRIP_MODES, undefined), [...STRIP_MODES]);
});
