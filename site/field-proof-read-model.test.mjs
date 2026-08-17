import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fieldProofViewModel } from './field-proof-read-model.mjs';

const fixtureUrl = new URL('./public/data/field-proof-demo.json', import.meta.url);

test('field proof validates Projection, Encounter and recursive Contributions through canonical contracts', async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  const view = fieldProofViewModel(fixture);

  assert.equal(view.projection.ref, 'projection:factory:finding:projection-floor');
  assert.equal(view.projection.subject_kind, 'software-factory.finding');
  assert.equal(view.encounter.mediation, 'direct-address');
  assert.equal(view.contributions.length, 2);
  assert.equal(view.contributions[0].target_ref, view.projection.ref);
  assert.equal(view.contributions[1].target_ref, view.contributions[0].ref);
  assert.equal(view.contributions[1].target_kind, 'oi.contribution');
});

test('field proof rejects a broken nested Contribution relation', async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  fixture.contributions[1].target.ref = 'contribution:missing';

  assert.throws(() => fieldProofViewModel(fixture), /second Contribution/);
});
