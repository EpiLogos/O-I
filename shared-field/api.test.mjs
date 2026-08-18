import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './api.mjs';

test('unified shared-field API exposes projection, Explore presentation/authoring, shared-agency, Watch, Contact and hosted-state floors', () => {
  for (const name of [
    'createParticipant',
    'createProjection',
    'refineProjection',
    'receiveProjection',
    'selectCentralParticipantRoot',
    'createSharedField',
    'validateSharedFieldNesting',
    'createContribution',
    'createEncounter',
    'selfOtherReadModel',
    'createSharedFieldState',
    'createExploreEntry',
    'createExploreApplication',
    'createWorldPresentation',
    'validateWorldPresentation',
    'resolvePresentationBindings',
    'createWorldPresentationProjection',
    'worldPresentationFromProjection',
    'refineWorldPresentationProjection',
    'normalizeContributionField',
    'authoringDisclosure',
    'applyPresentationAuthoringOperation',
    'bindingAvailability',
    'createWatch',
    'validateWatch',
    'createContact',
    'validateContact',
    'hostedSnapshotFromRows',
    'createSpacetimeExploreSource',
    'createLiveExploreApplication',
    'hostedWatchFromRow',
    'hostedWatchesFromSpacetimeDb',
    'createSpacetimeWatchSource',
    'hostedContactFromRow',
    'hostedContactsFromSpacetimeDb',
    'createSpacetimeContactSource',
  ]) {
    assert.equal(typeof api[name], 'function', `${name} should be exported`);
  }

  assert.equal(api.PARTICIPANT_SCHEMA, 'oi.participant/v1');
  assert.equal(api.PROJECTION_SCHEMA, 'oi.projection/v1');
  assert.equal(api.SHARED_FIELD_SCHEMA, 'oi.shared-field/v1');
  assert.equal(api.CONTRIBUTION_SCHEMA, 'oi.contribution/v1');
  assert.equal(api.ENCOUNTER_SCHEMA, 'oi.encounter/v1');
  assert.equal(api.EXPLORE_ENTRY_SCHEMA, 'oi.explore-entry/v1');
  assert.equal(api.EXPLORE_RELATION_VIEW_SCHEMA, 'oi.explore-relation-view/v1');
  assert.equal(api.EXPLORE_RESULT_SCHEMA, 'oi.explore-result/v1');
  assert.equal(api.WORLD_PRESENTATION_SCHEMA, 'oi.world-presentation/v1');
  assert.equal(api.PRESENTATION_BINDING_SCHEMA, 'oi.presentation-binding/v1');
  assert.equal(api.PRESENTATION_AUTHORING_SCHEMA, 'oi.presentation-authoring/v1');
  assert.equal(api.WATCH_SCHEMA, 'oi.watch/v1');
  assert.equal(api.CONTACT_SCHEMA, 'oi.contact/v1');
});