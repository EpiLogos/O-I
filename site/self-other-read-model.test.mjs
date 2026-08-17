import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { selfOtherViewModel } from './self-other-read-model.mjs';

const fixtureUrl = new URL('./public/data/self-other-demo.json', import.meta.url);
const goldenUrl = new URL('../shared-field/fixtures/golden.json', import.meta.url);

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
  assert.deepEqual(view.self_public_root.groups.map((group) => group.label), ['Projects', 'Interests', 'Outputs']);
});

test('front-door Self, public root and Other reuse the canonical golden fixtures', async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  const golden = JSON.parse(await readFile(goldenUrl, 'utf8'));

  assert.deepEqual(fixture.self, golden.human_participant);
  assert.deepEqual(fixture.self_root_projection, golden.human_participant_root_projection);
  assert.deepEqual(fixture.other, golden.agent_participant);
  assert.equal(JSON.stringify(fixture.self_root_projection).includes('PRIVATE_'), false);
});

test('Self / Other adapter rejects a participant outside the selected field', async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  fixture.other.field_ref = 'oi:field:elsewhere';

  assert.throws(() => selfOtherViewModel(fixture), /selected SharedField/);
});

test('Self / Other adapter rejects a public root published by another participant', async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  fixture.self_root_projection.publisher_participant_ref = 'participant:someone-else';

  assert.throws(() => selfOtherViewModel(fixture), /selected Self Participant/);
});
