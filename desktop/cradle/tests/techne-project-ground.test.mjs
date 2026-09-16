import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadFixture } from '../src/techne/fixtures/load-fixtures.mjs';
import { groundModel, groundAvailability } from '../src/techne/project/ground.ts';

const representative = await loadFixture('representative-subject-v1.json');
const absent = await loadFixture('absent-facets-v1.json');

test('the ground model discloses the reading’s ground identity verbatim', () => {
  const ground = groundModel(representative);
  assert.equal(ground.subject_ref, representative.subject.subject_ref);
  assert.equal(ground.native_owner, 'aikit/semantic-wiki');
  assert.equal(ground.kind, 'wiki-node');
  assert.equal(ground.standing, 'agent-maintained');
  // Step 0 of the traversal: the ground ref is the bounded whole here.
  assert.equal(ground.ground_ref, representative.whole.whole_ref);
});

test('members, relation origins and sources ride verbatim, grouped honestly', () => {
  const ground = groundModel(representative);
  assert.deepEqual(ground.member_refs, representative.whole.member_refs);
  assert.equal(ground.relations_by_origin['authored'], 1);
  assert.equal(ground.relations_by_origin['ql-derived'], 1);
  assert.equal(ground.sources.length, representative.provenance.length);
  assert.equal(ground.sources[0].source_ref, representative.provenance[0].source_ref);
  assert.equal(ground.sources[0].standing, 'architecture-contract');
});

test('the Return leg is the disclosed governed-write Action', () => {
  const ground = groundModel(representative);
  assert.ok(ground.return_action, 'the representative ground discloses a governed write');
  assert.equal(ground.return_action.action_ref, 'aikit.wiki.stage');
  assert.equal(ground.return_action.authority, 'governed-write');
});

test('a reading without sources or actions yields an honest sparser ground', () => {
  const ground = groundModel(absent);
  assert.equal(ground.ground_ref, absent.whole.whole_ref);
  assert.deepEqual(ground.sources, absent.provenance.map((p) => ({
    source_ref: p.source_ref,
    native_owner: p.native_owner,
    standing: p.standing ?? null,
  })));
  assert.equal(ground.return_action, null, 'no Return route is invented');
  assert.equal(groundAvailability(absent).available, true);
});

test('the project pane mints no stochastic identity', async () => {
  const here = fileURLToPath(new URL('../src/techne/project/', import.meta.url));
  for (const file of ['ground.ts', 'register.ts', 'ProjectGround.tsx']) {
    const source = await readFile(`${here}${file}`, 'utf8');
    assert.doesNotMatch(source, /crypto\.randomUUID|Math\.random|Date\.now/, `${file} mints identity or time`);
  }
});
