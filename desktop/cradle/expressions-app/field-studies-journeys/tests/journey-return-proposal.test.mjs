// lane-5 T19: explicit Return. A recognised result returns as an attributable proposal, routed through the shared
// routing law (resolveActionRoute), never executed here. Refusal mutates nothing; attribution names the actor and
// the source by ref.
import test from 'node:test';
import assert from 'node:assert/strict';
import {provingReading} from '../../../src/techne/m0m5/journey/proving-reading.ts';
import {deriveComposition, placeAt} from '../../../src/techne/m0m5/palace/palace-state.ts';
import {palaceReturnAction, palaceReturnProposal, palaceReturnRoute} from '../../../src/techne/m0m5/palace/return.ts';
import {resolveActionRoute} from '../../../src/techne/m0m5/adapter.ts';

function bound(reading) {
  return {...deriveComposition(reading), bound: true};
}

test('T19: a bound composition returns as one routed, attributable proposal over the disclosed governed-write action', () => {
  const reading = provingReading();
  const composition = bound(reading);
  const before = structuredClone(composition);
  const proposal = palaceReturnProposal(reading, composition);
  assert.equal(proposal.refusal, null);
  assert.equal(proposal.receipt.routed, true);
  assert.equal(proposal.receipt.action_ref, palaceReturnAction(reading).action_ref);
  assert.equal(proposal.receipt.authority, 'governed-write', 'the proposal awaits the owner under its own authority');
  assert.equal(proposal.route.input.basis_ref, reading.reading_ref);
  assert.equal(proposal.route.subject_ref, reading.subject.subject_ref);
  assert.ok(proposal.route.input.composed_refs.length > 0, 'the arranged native refs ride the proposal verbatim');
  assert.match(proposal.attribution, /human:techne-palace/, 'the actor is named');
  assert.ok(proposal.attribution.includes(reading.reading_ref), 'the source reading is named by ref');
  assert.deepEqual(composition, before, 'proposing mutates no composition');
});

test('T19: a composition that is not bound has nothing to return, and says so by name', () => {
  const reading = provingReading();
  const proposal = palaceReturnProposal(reading, deriveComposition(reading));
  assert.equal(proposal.route, null);
  assert.equal(proposal.receipt, null);
  assert.match(proposal.refusal, /not bound/);
});

test('T19: a reading that discloses no governed Return action has no Return leg, and says so by name', () => {
  const reading = structuredClone(provingReading());
  reading.actions = (reading.actions ?? []).map((action) => ({...action, authority: 'read'}));
  assert.equal(palaceReturnRoute(reading, bound(reading)), null);
  const proposal = palaceReturnProposal(reading, bound(reading));
  assert.match(proposal.refusal, /no governed Return action/);
});

test('T19: a route the routing law refuses comes back unrouted with its reason, and the reading is byte-unchanged', () => {
  const reading = provingReading();
  const before = JSON.stringify(reading);
  const route = palaceReturnRoute(reading, bound(reading));
  const refused = resolveActionRoute(reading, {...route, subject_ref: 'wiki:node:someone-else'});
  assert.equal(refused.routed, false);
  assert.match(refused.reason, /one subject, one route/);
  assert.equal(JSON.stringify(reading), before);
});

test('T19: a placed composition shapes the proposal from its own arrangement order', () => {
  const reading = provingReading();
  const base = deriveComposition(reading);
  const region = base.regions.find((candidate) => candidate.entries.length >= 1);
  const moved = placeAt(base, region.key, region.entries[0].ref, {room: {column: 0, row: 0}, locus: 0});
  const proposal = palaceReturnProposal(reading, {...moved, bound: true});
  assert.ok(proposal.route.input.composed_refs.includes(region.entries[0].ref));
});
