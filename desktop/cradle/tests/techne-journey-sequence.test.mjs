import test from 'node:test';
import assert from 'node:assert/strict';
import { FixtureTechneAdapter, assertReading } from '../src/techne/adapter.ts';
import { beats } from '../src/techne/journey/beats.ts';
import {
  DEFAULT_DWELL_SECONDS,
  EXPRESSION_EDIT_ACTION,
  composeProposal,
  draftFromBeats,
  dwellFor,
  moveBeat,
  orderChanged,
  paceBeat,
} from '../src/techne/journey/sequence.ts';
import { loadFixtureReadings } from '../src/techne/fixtures/load-fixtures.mjs';

const readings = await loadFixtureReadings();
const representative = readings.find((reading) => reading.reading_ref === 'ql.techne:reading:fixture:representative-subject@1');
const EXPRESSION = 'oi:expression:l5-techne-constellation';

/** A three-scene reading over the representative subject, plus optionally a
 * disclosed sequence action. Contract-checked, fixture-derived. */
function threeSceneReading({ disclosedAction } = {}) {
  const actions = disclosedAction
    ? [
        ...representative.actions,
        {
          action_ref: disclosedAction.action_ref,
          native_owner: 'oi/desktop',
          authority: 'owner-disclosed',
          summary: disclosedAction.summary,
          expected_effects: ['the Expression’s scene order changes under the owner’s revision discipline'],
          input_schema_ref: null,
        },
      ]
    : representative.actions;
  return assertReading({
    ...representative,
    expressions: [
      { expression_ref: EXPRESSION, revision: '3', scene_ref: `${EXPRESSION}/scene/opening`, composition_ref: null, profile_ref: null },
      { expression_ref: EXPRESSION, revision: '3', scene_ref: `${EXPRESSION}/scene/refrain`, composition_ref: null, profile_ref: null },
      { expression_ref: EXPRESSION, revision: '3', scene_ref: `${EXPRESSION}/scene/coda`, composition_ref: null, profile_ref: null },
    ],
    actions,
  });
}

test('the draft starts at the reading’s own order; moving a beat reorders the draft only', () => {
  const reading = threeSceneReading();
  const before = structuredClone(reading);
  const model = beats(reading);
  const draft = draftFromBeats(model.beats, EXPRESSION);
  assert.deepEqual(draft.scene_order, [
    `${EXPRESSION}/scene/opening`,
    `${EXPRESSION}/scene/refrain`,
    `${EXPRESSION}/scene/coda`,
  ]);
  const moved = moveBeat(draft, `${EXPRESSION}/scene/opening`, 2);
  assert.deepEqual(moved.scene_order, [
    `${EXPRESSION}/scene/refrain`,
    `${EXPRESSION}/scene/coda`,
    `${EXPRESSION}/scene/opening`,
  ], 'the opening scene moves to the end');
  assert.deepEqual(reading, before, 'the reading is never mutated by drafting');
  assert.equal(orderChanged(draft, model.beats), false, 'the identity draft proposes nothing');
  assert.equal(orderChanged(moved, model.beats), true);
});

test('pacing is local presentation: it changes dwell and never enters the proposal', () => {
  const model = beats(threeSceneReading());
  let draft = draftFromBeats(model.beats, EXPRESSION);
  assert.equal(dwellFor(draft, `${EXPRESSION}/scene/refrain`), DEFAULT_DWELL_SECONDS);
  draft = paceBeat(draft, `${EXPRESSION}/scene/refrain`, 9);
  assert.equal(dwellFor(draft, `${EXPRESSION}/scene/refrain`), 9);
  const route = composeProposal(draft, threeSceneReading());
  assert.deepEqual(Object.keys(route.input).sort(), ['expression_ref', 'revision', 'scene_order'],
    'the routed input carries only the owner’s scene-order semantics — no pace field exists in the substrate');
  assert.throws(() => paceBeat(draft, `${EXPRESSION}/scene/refrain`, 0), /positive/);
  assert.throws(() => paceBeat(draft, `${EXPRESSION}/scene/absent`, 5), /not in the draft/);
});

test('composeProposal falls back to oi.expression.edit with {expression_ref, revision, scene_order} when nothing sequence-shaped is disclosed', () => {
  const reading = threeSceneReading();
  const draft = moveBeat(draftFromBeats(beats(reading).beats, EXPRESSION), `${EXPRESSION}/scene/coda`, 0);
  const route = composeProposal(draft, reading);
  assert.equal(route.action_ref, EXPRESSION_EDIT_ACTION);
  assert.equal(route.subject_ref, reading.subject.subject_ref);
  assert.deepEqual(route.input, {
    expression_ref: EXPRESSION,
    revision: '3',
    scene_order: [
      `${EXPRESSION}/scene/coda`,
      `${EXPRESSION}/scene/opening`,
      `${EXPRESSION}/scene/refrain`,
    ],
  });
});

test('when the reading discloses a sequence-shaped native action, its action_ref is used verbatim', () => {
  const disclosed = threeSceneReading({
    disclosedAction: { action_ref: 'oi.expression.compose', summary: 'Restage the Expression: reorder scenes and compose the sequence' },
  });
  const draft = moveBeat(draftFromBeats(beats(disclosed).beats, EXPRESSION), `${EXPRESSION}/scene/refrain`, 0);
  const route = composeProposal(draft, disclosed);
  assert.equal(route.action_ref, 'oi.expression.compose', 'the disclosed action_ref, verbatim — never a desktop rewrite');

  const exact = threeSceneReading({
    disclosedAction: { action_ref: EXPRESSION_EDIT_ACTION, summary: 'Edit the Expression document' },
  });
  assert.equal(composeProposal(draft, exact).action_ref, EXPRESSION_EDIT_ACTION, 'the exact edit action wins');
});

test('a draft can only reorder disclosed scenes — invented or dropped scene refs are refused', () => {
  const reading = threeSceneReading();
  const draft = draftFromBeats(beats(reading).beats, EXPRESSION);
  assert.throws(
    () => composeProposal({ ...draft, scene_order: [`${EXPRESSION}/scene/opening`, `${EXPRESSION}/scene/invented`] }, reading),
    /not disclosed/,
  );
  assert.throws(
    () => composeProposal({ ...draft, scene_order: draft.scene_order.slice(1) }, reading),
    /never drop/,
  );
  assert.throws(
    () => composeProposal({ ...draft, scene_order: [...draft.scene_order, draft.scene_order[0]] }, reading),
    /repeats a scene ref/,
  );
});

test('routing against the fixture adapter is honest: disclosed actions route to oi/desktop, the fallback proposal comes back unrouted with its reason', async () => {
  const adapter = new FixtureTechneAdapter(readings);
  const route = { action_ref: 'oi.expression.open', subject_ref: representative.subject.subject_ref };
  const receipt = await adapter.routeAction(route, representative);
  assert.deepEqual(receipt, {
    action_ref: 'oi.expression.open',
    native_owner: 'oi/desktop',
    routed: true,
    authority: 'owner-disclosed',
    expected_effects: ['an Expression surface opens; no native mutation by itself'],
  });

  const draft = moveBeat(draftFromBeats(beats(threeSceneReading()).beats, EXPRESSION), `${EXPRESSION}/scene/opening`, 1);
  const proposal = composeProposal(draft, threeSceneReading());
  const refused = await adapter.routeAction(proposal, representative);
  assert.equal(refused.routed, false, 'the reading discloses no sequence action — routing refuses instead of executing');
  assert.match(refused.reason, /not disclosed by reading/);

  const disclosing = threeSceneReading({
    disclosedAction: { action_ref: 'oi.expression.compose', summary: 'Reorder scenes and compose the sequence' },
  });
  const routedProposal = composeProposal(draft, disclosing);
  const routed = await adapter.routeAction(routedProposal, disclosing);
  assert.equal(routed.routed, true);
  assert.equal(routed.native_owner, 'oi/desktop');
  assert.deepEqual(routedProposal.input.scene_order, [
    `${EXPRESSION}/scene/refrain`,
    `${EXPRESSION}/scene/opening`,
    `${EXPRESSION}/scene/coda`,
  ], 'the routed input carries the new scene order');
});
