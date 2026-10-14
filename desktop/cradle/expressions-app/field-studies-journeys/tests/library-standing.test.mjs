// lane-3 E21: the Library's wiki standing is the owner's reading, asked through one typed host request and dropped when stale.
// Run after `npm run build:journeys` (this suite imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createWikiStandingClient, disclosedOwnerOf, readWikiStandingData, validWikiStandingBasis, wikiStandingKey, WIKI_STANDING_KIND} from '../build/libraryStanding.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const appSource = readFileSync(join(here, '../src/app.ts'), 'utf8');

const BASIS = {subject_ref: 'wiki:subject:alpha', expression_ref: 'expression:open', revision: 4};
const ROW = {register_key: 'central/register-one', expression_ref: 'expression:wiki', scene_ref: 'scene:wiki-1', scene_title: 'Opening',
  entity_ref: 'entity:wiki-a', entity_title: 'Alpha', subject_ref: BASIS.subject_ref};
const REPLY = {subject_ref: BASIS.subject_ref, expression_ref: BASIS.expression_ref, revision: BASIS.revision, standing_revision: 9, rows: [ROW]};

/** A fake host: records posts, settles through the callbacks the client is given, and runs timers by hand. */
function harness(current = BASIS, {hosted = true} = {}) {
  const posts = [];
  const settled = [];
  const timers = [];
  let basis = current;
  const client = createWikiStandingClient({
    post: message => {posts.push(message); return hosted;},
    current: () => basis,
    settle: entry => settled.push(entry),
    setTimer: (callback, ms) => {const timer = {callback, ms, cleared: false}; timers.push(timer); return timer;},
    clearTimer: timer => {if (timer) timer.cleared = true;},
  });
  return {client, posts, settled, timers, move: next => {basis = next;}};
}

const answer = (req, data, extra = {}) => ({v: 1, kind: `${WIKI_STANDING_KIND}-result`, req, ok: true, data, ...extra});

test('the request names the subject, the open Expression and its revision, and carries the channel kind', () => {
  const h = harness();
  assert.deepEqual(h.client.ensure(BASIS), {state: 'pending'});
  assert.equal(h.posts.length, 1);
  const [message] = h.posts;
  assert.equal(message.v, 1);
  assert.equal(message.kind, 'wiki-subject-standing');
  assert.ok(Number.isSafeInteger(message.req) && message.req > 0);
  assert.deepEqual(message.request, BASIS);
});

test('one request is in flight per basis: a second ask while pending posts nothing', () => {
  const h = harness();
  h.client.ensure(BASIS);
  assert.deepEqual(h.client.ensure(BASIS), {state: 'pending'});
  assert.equal(h.posts.length, 1);
});

test('the host answer for the basis that stands settles to the owner rows, with the wiki title and register named', () => {
  const h = harness();
  h.client.ensure(BASIS);
  assert.equal(h.client.receive(answer(h.posts[0].req, REPLY)), true);
  const settled = h.settled.at(-1);
  assert.equal(settled.state.state, 'read');
  assert.deepEqual(settled.state.rows, [{
    kind: 'projection', title: 'Alpha · Opening', detail: 'Wiki register central/register-one',
    register_key: 'central/register-one', scene_ref: 'scene:wiki-1', entity_ref: 'entity:wiki-a',
    subject_ref: BASIS.subject_ref,
  }]);
  assert.deepEqual(h.client.ensure(BASIS).state, 'read', 'the settled standing is kept for its basis');
});

test('a reply for another Expression, revision or subject is dropped: nothing is shown and nothing is cached', () => {
  const h = harness();
  h.client.ensure(BASIS);
  const req = h.posts[0].req;
  h.move({...BASIS, revision: 5});
  assert.equal(h.client.receive(answer(req, REPLY)), true, 'the reply is consumed as this channel\'s, then dropped');
  assert.equal(h.settled.length, 0, 'a stale answer settles nothing');
  assert.deepEqual(h.client.ensure({...BASIS, revision: 5}), {state: 'pending'}, 'the new basis asks again');
  assert.equal(h.posts.length, 2);
});

test('a reply whose echo names another revision is dropped even when the basis still stands', () => {
  const h = harness();
  h.client.ensure(BASIS);
  h.client.receive(answer(h.posts[0].req, {...REPLY, revision: 3}));
  assert.equal(h.settled.length, 0);
});

test('a refused answer is named as the refusal, and never shown as an empty standing', () => {
  const h = harness();
  h.client.ensure(BASIS);
  h.client.receive({v: 1, kind: 'wiki-subject-standing-result', req: h.posts[0].req, ok: false,
    error: 'No wiki register is loaded in this shell, so where this subject stands is not read yet.'});
  const settled = h.settled.at(-1).state;
  assert.equal(settled.state, 'refused');
  assert.match(settled.reason, /No wiki register is loaded/);
});

test('an unhosted shell refuses by name at once, and nothing stays pending', () => {
  const h = harness(BASIS, {hosted: false});
  const state = h.client.ensure(BASIS);
  assert.equal(state.state, 'refused');
  assert.match(state.reason, /not hosted/);
  assert.equal(h.timers.length, 1);
  assert.equal(h.timers[0].cleared, true, 'the timeout for an unsent request is cleared');
});

test('a host that never answers settles as a named refusal when the timeout runs', () => {
  const h = harness();
  h.client.ensure(BASIS);
  const timer = h.timers[0];
  assert.equal(timer.ms, 15000);
  timer.callback();
  assert.equal(h.settled.at(-1).state.state, 'refused');
  assert.match(h.settled.at(-1).state.reason, /did not answer/);
});

test('a message that is not this channel, or that names no pending request, is not taken', () => {
  const h = harness();
  h.client.ensure(BASIS);
  assert.equal(h.client.receive({v: 1, kind: 'host-command-result', req: h.posts[0].req}), false);
  assert.equal(h.client.receive({v: 1, kind: 'wiki-subject-standing-result', req: 7}), false);
  assert.equal(h.client.receive('not a message'), false);
});

test('malformed host data is refused as a whole: one bad row shows no partial standing', () => {
  assert.equal(readWikiStandingData(REPLY, BASIS).ok, 'read');
  assert.equal(readWikiStandingData({...REPLY, rows: [ROW, {...ROW, scene_ref: 4}]}, BASIS).ok, 'refused');
  assert.equal(readWikiStandingData({...REPLY, rows: [{...ROW, subject_ref: 'wiki:other'}]}, BASIS).ok, 'refused');
  assert.equal(readWikiStandingData({...REPLY, rows: 'many'}, BASIS).ok, 'refused');
  assert.equal(readWikiStandingData({...REPLY, rows: new Array(513).fill(ROW)}, BASIS).ok, 'refused');
  assert.equal(readWikiStandingData(null, BASIS).ok, 'refused');
  assert.equal(readWikiStandingData({...REPLY, subject_ref: 'wiki:other'}, BASIS).ok, 'stale');
  assert.equal(readWikiStandingData({...REPLY, expression_ref: 'expression:other'}, BASIS).ok, 'stale');
});

test('a basis is asked only with bounded refs and an exact positive revision', () => {
  assert.equal(validWikiStandingBasis(BASIS), true);
  assert.equal(validWikiStandingBasis({...BASIS, revision: 0}), false);
  assert.equal(validWikiStandingBasis({...BASIS, revision: 1.5}), false);
  assert.equal(validWikiStandingBasis({...BASIS, subject_ref: ' '}), false);
  assert.equal(validWikiStandingBasis({...BASIS, expression_ref: 'bad\u0000ref'}), false);
  const h = harness();
  assert.equal(h.client.ensure({...BASIS, revision: 0}).state, 'refused');
  assert.equal(h.posts.length, 0, 'an invalid basis is never posted');
  assert.notEqual(wikiStandingKey(BASIS), wikiStandingKey({...BASIS, revision: 5}));
});

test('the app asks the owner and never reads the projection state itself', () => {
  assert.match(appSource, /from '\.\/libraryStanding'/);
  assert.match(appSource, /createWikiStandingClient\(/);
  assert.match(appSource, /window\.addEventListener\('message',event=>\{if\(event\.source===window\.parent\)wikiStanding\.receive\(event\.data\);\}\);/);
  const standing = appSource.slice(appSource.indexOf('function subjectStandingFor('), appSource.indexOf('function subjectStandingFor(') + 1200);
  assert.match(standing, /wikiStanding\.ensure\(basis\)/);
  assert.match(standing, /projection:'read'/);
  assert.doesNotMatch(appSource, /wikiSubjectStandings|wikiProjectionStore/, 'the frame holds no wiki projection state of its own');
});

test('the graph owner is read from the occurrence subject that discloses it, never defaulted to wiki', () => {
  assert.deepEqual(disclosedOwnerOf({subject_ref: 'wiki:subject:alpha', native_owner: 'oi'}, 'wiki:subject:alpha'), {owner: 'oi'});
  assert.deepEqual(disclosedOwnerOf({subject_ref: 'wiki:subject:alpha', native_owner: 'wiki'}, 'wiki:subject:alpha'), {owner: 'wiki'});
  const absent = disclosedOwnerOf(undefined, 'wiki:subject:alpha');
  assert.ok('refused' in absent, 'no disclosed subject is refused, not guessed');
  assert.match(absent.refused, /does not disclose this subject/);
  const other = disclosedOwnerOf({subject_ref: 'wiki:subject:beta', native_owner: 'oi'}, 'wiki:subject:alpha');
  assert.ok('refused' in other, 'a different subject is not read as this one');
  for (const owner of [undefined, null, '', '   ', 'oi\u0000x', 'x'.repeat(513)]) {
    const verdict = disclosedOwnerOf({subject_ref: 'wiki:subject:alpha', native_owner: owner}, 'wiki:subject:alpha');
    assert.ok('refused' in verdict, `owner ${JSON.stringify(owner)} is refused, not defaulted`);
    assert.match(verdict.refused, /No owner is guessed/);
  }
});

test('a refusal, then the Library reopens, then the subject is asked again', () => {
  const h = harness();
  h.client.ensure(BASIS);
  h.client.receive({v: 1, kind: 'wiki-subject-standing-result', req: h.posts[0].req, ok: false,
    error: 'No wiki register is loaded in this shell, so where this subject stands is not read yet.'});
  assert.equal(h.client.ensure(BASIS).state, 'refused');
  assert.equal(h.posts.length, 1, 'within one open a refusal is not asked again');
  h.client.begin();
  assert.deepEqual(h.client.ensure(BASIS), {state: 'pending'}, 'reopening the Library asks again');
  assert.equal(h.posts.length, 2);
  h.client.receive(answer(h.posts[1].req, REPLY));
  assert.equal(h.client.ensure(BASIS).state, 'read');
});

test('a read at revision A, then the projection moves to B: the next open shows B', () => {
  const h = harness();
  h.client.ensure(BASIS);
  h.client.receive(answer(h.posts[0].req, REPLY));
  const a = h.client.ensure(BASIS);
  assert.equal(a.state, 'read');
  assert.equal(a.standing_revision, 9);
  h.client.begin();
  const shownWhileAsking = h.client.ensure(BASIS);
  assert.equal(shownWhileAsking.state, 'read', 'the settled read stays visible while the one re-ask is in flight');
  assert.equal(h.posts.length, 2, 'the open re-asks the subject once');
  const ROW_B = {...ROW, scene_title: 'Moved', entity_title: 'Alpha'};
  h.client.receive(answer(h.posts[1].req, {...REPLY, standing_revision: 10, rows: [ROW_B]}));
  const b = h.client.ensure(BASIS);
  assert.equal(b.standing_revision, 10);
  assert.deepEqual(b.rows.map(row => row.title), ['Alpha · Moved']);
  assert.equal(h.posts.length, 2, 'no further ask within the same open');
});

test('an ask already in flight is shared across the open: one request, one settle', () => {
  const h = harness();
  assert.deepEqual(h.client.ensure(BASIS), {state: 'pending'});
  h.client.begin();
  assert.deepEqual(h.client.ensure(BASIS), {state: 'pending'}, 'the in-flight ask is shared, not repeated');
  assert.equal(h.posts.length, 1);
  h.client.receive(answer(h.posts[0].req, REPLY));
  assert.equal(h.settled.length, 1, 'one settle for the one request');
  assert.equal(h.client.ensure(BASIS).state, 'read');
  assert.equal(h.posts.length, 1);
});

test('a read reply must name a readable standing_revision when it names one', () => {
  assert.equal(readWikiStandingData({...REPLY, standing_revision: 'nine'}, BASIS).ok, 'refused');
  assert.equal(readWikiStandingData({...REPLY, standing_revision: -1}, BASIS).ok, 'refused');
  const bare = readWikiStandingData({...REPLY, standing_revision: undefined}, BASIS);
  assert.equal(bare.ok, 'read');
  assert.equal(bare.standing_revision, null);
});

test('the Library asks once per subject per open, and the open clears refusals in the app', () => {
  assert.match(appSource, /wikiStanding\.begin\(\)/, 'openLibrary begins a new ask window');
  assert.match(appSource, /wikiStanding\.dispose\(\)/, 'the teardown releases the standing client');
});

test('the graph sites no longer default the owner to wiki: the reveal and the standing jump read the occurrence', () => {
  assert.doesNotMatch(appSource, /dataset\.owner\|\|'wiki'/, 'no element-carried wiki default remains');
  assert.match(appSource, /function disclosedOwnerOrRefuse\(subjectRef:string\)/);
  assert.match(appSource, /summonGraph\(subject,disclosedOwnerOrRefuse\(subject\)\);return;/);
  assert.match(appSource, /case 'reveal-subject':\{const subject=el\.dataset\.subject\?\?'';try\{summonGraph\(subject,disclosedOwnerOrRefuse\(subject\)\)/);
});
