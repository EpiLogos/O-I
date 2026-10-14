// lane-3 E21: the store's load entry for one register's settled standing (ensureWikiStanding). The owner path is the
// same ensureWikiProjection the Technē centre runs; an unavailable transport makes the reading settle without a kernel,
// so this suite is scripted and reaches no native owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import {configureWikiProjectionAccess, ensureWikiStanding, getWikiProjectionState} from '../src/techne/wikiProjectionStore.ts';

const CENTRAL = {key: 'central', title: 'Central'};
const NO_OWNER = {kind: 'unavailable', reason: 'no native owner in this test'};

test('concurrent callers share one reading per register and resolve with the same settled standing', async () => {
  configureWikiProjectionAccess('standing-load-share', 'epoch-share', () => true);
  const [first, second] = await Promise.all([ensureWikiStanding(CENTRAL, NO_OWNER), ensureWikiStanding(CENTRAL, NO_OWNER)]);
  assert.equal(first.phase, 'unavailable');
  assert.equal(first.reason, 'no native owner in this test');
  assert.equal(first, second, 'both callers receive the one standing the store holds');
  const later = await ensureWikiStanding(CENTRAL, NO_OWNER);
  assert.equal(later, first, 'a settled standing is not read again');
  assert.equal(getWikiProjectionState().standings.central, first);
});

test('a reading that cannot be read is a standing, never a rejection', async () => {
  configureWikiProjectionAccess('standing-load-unavailable', 'epoch-unavailable', () => true);
  const standing = await ensureWikiStanding({key: 'Factory', title: 'Factory', project: 'Factory', projectPath: 'Work/Factory'}, NO_OWNER);
  assert.equal(standing.phase, 'unavailable');
});

test('a load through a retired owner access is refused by name and reads nothing', async () => {
  configureWikiProjectionAccess('standing-load-retired', 'epoch-retired', () => false);
  await assert.rejects(ensureWikiStanding({key: 'Notes', title: 'Notes', project: 'Notes', projectPath: 'Work/Notes'}, NO_OWNER), /owner access changed/);
  assert.equal(getWikiProjectionState().standings.Notes, undefined, 'no standing is written for a retired access');
});
