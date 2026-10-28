// lane-5 T19, O-I #761: the Palace's Return on its route (projections/atlas/palaces/palaceReturn.ts). REPLACED (#761): the Accept request
// and outcome of the routed `invoke_action` (return.ts palaceAcceptRequest and palaceAcceptOutcome, moved here from the frame's
// palace-accept.test.mjs) retired with that route — the register's reading never disclosed its action as a governed write, so it never
// routed. Their pins are replaced, one for one, by the request Return the Palace sends to Central's receiving and the owner's readings it
// checks: the request carries the routed proposal, the reading it came from and the owner it is proposed to ('the Return the Palace sends
// …' below); a proposal the law did not route is never sent ('a proposal the routing law did not route …'); the owner's answer is
// accepted only when its reading says so, and the accepted one crosses back to the ground ('the owner's decision …'; the crossing itself
// is atlas-palaces-finish.test.mjs 'Propose Return reaches …'); a refusal and a missing reply are named, never accepted ('a reading that
// is not the owner's …'). The session's Accept is pinned in atlas-palaces-session.test.mjs and atlas-palaces-finish.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) return r
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText};
}`)}`, import.meta.url)

const {provingReading} = await import('../../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts');
const {deriveComposition} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/palace-state.ts');
const {palaceReturnProposal, returnCrossing} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/return.ts');
const {PALACE_RETURN_ROUTE, palaceReturnAsk, palaceReturnSent, palaceReturnDecided, returnLine} = await import('../src/projections/atlas/palaces/palaceReturn.ts');

const bound = reading => ({...deriveComposition(reading), bound: true});
/** The proving reading, naming Central's receiving as its route for new knowledge (wikiReadingProvider.ts knowledgeReturnAction). */
function reading() {
  const out = structuredClone(provingReading());
  out.snapshot = {revision: 'r1', basis_ref: 'central:source:Control/agents/wiki/wiki.json'};
  out.actions = [{action_ref: PALACE_RETURN_ROUTE, native_owner: 'central', authority: 'governed-write', expected_effects: []}];
  return out;
}
const ROOMS = [
  {key: 's:1', name: 'The Stone', kind: 'constellation', members: [{entity_ref: 'e1', subject_ref: 'wiki:node:carving', title: 'the carving'}], holds: null, saved: true, private: false},
  {key: 's:2', name: 'The Tower', kind: 'constellation', members: [{entity_ref: 'e3', subject_ref: 'wiki:node:tower', title: 'the tower'}], holds: null, saved: true, private: true},
  {key: 's:3', name: 'Walk', kind: 'region', members: [], holds: {expression_ref: 'expression:walk', title: 'Walk'}, saved: true, private: false},
];
const ask = (r = reading()) => palaceReturnAsk({palace: 'Central', rooms: ROOMS, reading: r, proposal: palaceReturnProposal(r, bound(r)), now: 1_793_203_021_000});
const PERSON = 'central:source:control:root:Control/user/identity';
const owned = (request, status, review = null) => ({schema: 'central.receiving-reading/v1', return_ref: 'central:return:control:root:a', revision: `rev-${status}`,
  record: {kind: 'request', status, author: {principal_ref: PERSON, actor_kind: 'human'}, request: {...request.request}, review}});

test('the Return the Palace sends carries the routed proposal: your rooms in your order, the reading it came from, the owner it is proposed to', () => {
  const r = reading(), request = ask(r);
  assert.equal(request.kind, 'ask');
  assert.equal(request.occurred_at_unix_seconds, 1_793_203_021);
  assert.match(request.producer_key, /^palace-return:[0-9a-f]{8}:1793203021$/);
  assert.equal(ask(r).producer_key, request.producer_key, 'the same Return at the same second is the same Return');
  assert.deepEqual(Object.keys(request.request).sort(), ['body', 'kind', 'proposal_ref', 'proposed_owner_ref', 'subject']);
  assert.equal(request.request.kind, 'proposal');
  assert.equal(request.request.subject, 'Return from Central: 3 rooms in your order');
  assert.equal(request.request.proposed_owner_ref, 'central:source:Control/agents/wiki/wiki.json');
  assert.equal(request.request.proposal_ref, r.reading_ref);
  assert.equal(request.request.body.split('\n').slice(1, 4).join('\n'), [returnLine(ROOMS[0], 0), returnLine(ROOMS[1], 1), returnLine(ROOMS[2], 2)].join('\n'));
  assert.equal(returnLine(ROOMS[0], 0), '1. The Stone (a constellation): the carving.');
  assert.equal(returnLine(ROOMS[1], 1), '2. A private room, under cloud: nothing of it is sent.', 'a private room is under cloud for every export');
  assert.equal(returnLine(ROOMS[2], 2), '3. Walk (a region): Walk.');
  assert.ok(request.evidence_refs.length > 0 && request.evidence_refs.length <= 128);
  assert.ok(!request.evidence_refs.includes('wiki:node:tower') && !request.evidence_refs.includes('s:2'), 'nothing a private room holds rides as evidence');
});

test('a proposal the routing law did not route, one with nothing to return, or one routed elsewhere is never sent', () => {
  const r = reading();
  const proposal = palaceReturnProposal(r, bound(r));
  assert.equal(palaceReturnAsk({palace: 'Central', rooms: ROOMS, reading: r, proposal: {...proposal, receipt: {...proposal.receipt, routed: false}}, now: 0}), null);
  assert.equal(palaceReturnAsk({palace: 'Central', rooms: ROOMS, reading: r, proposal: palaceReturnProposal(r, deriveComposition(r)), now: 0}), null);
  const proving = provingReading();
  assert.equal(palaceReturnAsk({palace: 'Central', rooms: ROOMS, reading: proving, proposal: palaceReturnProposal(proving, bound(proving)), now: 0}), null, 'aikit.wiki.stage is not the Palace\'s route');
});

test('the owner\'s decision is accepted only when its reading says so, with the reviewer the owner authenticated; an accepted Return crosses back to the ground', () => {
  const r = reading(), request = ask(r);
  const sent = palaceReturnSent(owned(request, 'pending'), request);
  assert.deepEqual(sent, {return_ref: 'central:return:control:root:a', revision: 'rev-pending', author: PERSON, owner: request.request.proposed_owner_ref, status: 'pending'});
  const accepted = palaceReturnDecided(owned(request, 'accepted', {disposition: 'accepted', reviewer_ref: PERSON}), sent, 'accepted');
  assert.deepEqual(accepted.receipt, {return_ref: sent.return_ref, revision: 'rev-accepted', reviewer: PERSON});
  assert.match(accepted.line, /^Accepted: central:source:Control\/agents\/wiki\/wiki\.json keeps central:return:control:root:a as accepted, by central:source:control:root:Control\/user\/identity \(revision rev-accepted\)/);
  assert.deepEqual(returnCrossing(r), {instrument: 'project'}, 'the ground the accepted Return re-opens');
  const rejected = palaceReturnDecided(owned(request, 'rejected', {disposition: 'rejected', reviewer_ref: PERSON}), sent, 'rejected');
  assert.match(rejected.line, /^Refused: .* as rejected, by .*\. Nothing changed in the sources\.$/);
});

test('a reading that is not the owner\'s reading of this Return — another Return, another state, no author, no reply — is named, never accepted', () => {
  const request = ask();
  assert.throws(() => palaceReturnSent(null, request), /did not answer with its reading/);
  assert.throws(() => palaceReturnSent({...owned(request, 'pending'), record: {...owned(request, 'pending').record, request: {...request.request, proposal_ref: 'other'}}}, request), /different Return/);
  assert.throws(() => palaceReturnSent({...owned(request, 'pending'), record: {...owned(request, 'pending').record, author: {}}}, request), /names no author/);
  const sent = palaceReturnSent(owned(request, 'pending'), request);
  assert.throws(() => palaceReturnDecided(owned(request, 'pending'), sent, 'accepted'), /reads the Return as pending, not accepted/);
  assert.throws(() => palaceReturnDecided({...owned(request, 'accepted', {disposition: 'accepted', reviewer_ref: PERSON}), return_ref: 'central:return:other'}, sent, 'accepted'), /did not read back this Return/);
  assert.throws(() => palaceReturnDecided(owned(request, 'accepted', {disposition: 'accepted'}), sent, 'accepted'), /names no reviewer/);
});
