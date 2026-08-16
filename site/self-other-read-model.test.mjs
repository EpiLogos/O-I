import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { selfOtherViewModel } from './self-other-read-model.mjs';

const fixtureUrl = new URL('./public/data/self-other-demo.json', import.meta.url);

test('Self / Other browser adapter is derived from canonical shared-field contracts', async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  const view = selfOtherViewModel(fixture);

  assert.equal(view.field.ref, 'oi:field:public');
  assert.equal(view.self.name, 'Ariadne');
  assert.equal(view.self.kind, 'human');
  assert.equal(view.other.name, 'Parāśakti');
  assert.equal(view.other.kind, 'agent');
  assert.equal(view.self.source_system, 'central');
  assert.equal(view.other.source_system, 'software-factory');
});

test('Self / Other adapter rejects a participant outside the selected field', async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  fixture.other.field_ref = 'oi:field:elsewhere';

  assert.throws(() => selfOtherViewModel(fixture), /selected SharedField/);
});
