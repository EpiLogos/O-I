// lane-5 T19 Accept — moved from the frame's field-studies-journeys/tests/palace-accept.test.mjs (T-PALACES-ONTO-ATLAS); return.ts is
// unchanged at the owner seam. Its last pin, 'the Palace Accept control is wired to the invoke route, not left disabled', read the
// frame's palaceInstrument.tsx; it is replaced by atlas-palaces-session.test.mjs 'Accept sends the proposal through the owner's
// invoke_action …' (the session's acceptReturn over the owners) and atlas-palaces-plate.test.mjs (the M5 plate's Return section).
// The Accept request is built from the proposal the Palace made, names the reading it came from, and
// carries the reading request the owner re-reads. Its reply is qualified into one status line; only an invoked receipt
// crosses back to M0′. A proposal the law did not route is never sent.
import test from 'node:test';
import assert from 'node:assert/strict';
import {provingReading} from '../../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts';
import {deriveComposition} from '../../../../desktop/cradle/src/techne/m0m5/palace/palace-state.ts';
import {palaceReturnProposal, returnCrossing, palaceAcceptRequest, palaceAcceptOutcome} from '../../../../desktop/cradle/src/techne/m0m5/palace/return.ts';

const readingRequest = {expression_ref: 'expression:palace-probe', revision: 3, scene_ref: 'scene:one'};
const bound = reading => ({...deriveComposition(reading), bound: true});

test('an Accept request carries the routed proposal, the reading it came from and the reading request, attributed to the Palace', () => {
  const reading = provingReading();
  const proposal = palaceReturnProposal(reading, bound(reading));
  const request = palaceAcceptRequest(proposal, readingRequest);
  assert.equal(request.operation, 'invoke_action');
  assert.deepEqual(request.route, proposal.route);
  assert.equal(request.reading_ref, reading.reading_ref);
  assert.deepEqual(request.reading_request, {...readingRequest, scope: 'expression'});
  assert.equal(request.actor, 'human:techne-palace');
});

test('a proposal the routing law did not route, or one with nothing to return, is never sent', () => {
  const reading = provingReading();
  const proposal = palaceReturnProposal(reading, bound(reading));
  assert.equal(palaceAcceptRequest({...proposal, receipt: {...proposal.receipt, routed: false}}, readingRequest), null);
  assert.equal(palaceAcceptRequest(palaceReturnProposal(reading, deriveComposition(reading)), readingRequest), null);
});

test('an invoked receipt is accepted in one line and crosses back to M0′ on the reading', () => {
  const reading = provingReading();
  const proposal = palaceReturnProposal(reading, bound(reading));
  const outcome = palaceAcceptOutcome(reading, proposal, {state: 'dispatched', dispatch: {state: 'invoked', owner_operation: proposal.route.action_ref, data: {}}});
  assert.equal(outcome.accepted, true);
  assert.equal(outcome.line, `Accepted: ${proposal.route.action_ref} invoked by ${proposal.route.action_ref}. Returning to M0′.`);
  assert.deepEqual(outcome.crossing, returnCrossing(reading));
});

test('an owner refusal is named in the status line, and nothing crosses', () => {
  const reading = provingReading();
  const proposal = palaceReturnProposal(reading, bound(reading));
  const outcome = palaceAcceptOutcome(reading, proposal, {state: 'dispatched', dispatch: {state: 'owner_refused', owner_operation: 'aikit.wiki.stage', message: 'no grant for this actor'}});
  assert.equal(outcome.accepted, false);
  assert.match(outcome.line, /refused .*: no grant for this actor/);
  assert.equal(outcome.crossing, null);
});

test('a refusal the frame route makes (stale or not offered) and a missing reply are each named, never accepted', () => {
  const reading = provingReading();
  const proposal = palaceReturnProposal(reading, bound(reading));
  const stale = palaceAcceptOutcome(reading, proposal, {state: 'refused', reason: 'stale: the proposal was made from reading reading:old'});
  assert.equal(stale.accepted, false);
  assert.match(stale.line, /stale/);
  const empty = palaceAcceptOutcome(reading, proposal, null);
  assert.equal(empty.accepted, false);
  assert.match(empty.line, /no dispatch receipt/);
});
