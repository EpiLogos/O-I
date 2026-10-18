/** T-WORLDS W4 (manual §24): the branch of M4 a Nara turn stands in follows the practice it comes from; Nara answers from the person's
 * own pages, each passage disclosed and named; a container's rules hold in the flow form. Pure: no kernel, no owner. Run from
 * desktop/cradle: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/nara-practice.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceBranch, practiceOfFlow, spokenContext} from '../src/nara/practice.ts';
import {buildDialogueContext, focusOf, validateDialogueContext} from '../src/nara/dialogueContext.ts';
import {answerTerms, answeringConcern, drawnFromHtml, livedOfInput, livedPracticeOf, livedRelations, livedTurn, withLivedDisclosure} from '../src/nara/livedContext.ts';
import {buildNativeTurnBasis, INSTRUMENT_PRACTICE, nativeTurnText} from '../src/nara/nativeDialogue.ts';
import {appendContribution, circleHolder, containerOf, portableCopy, Refusal, upgradeDocument, validateDocument} from '../src/flow/plural.ts';

const identity = {selection_ref: 'nara-identity-selection:1', source: {source_ref: 'central:source:control:root:Control/self/nara/identities/p.json', revision: 's-1'},
  reading: {person_ref: 'person:frank', nara_ref: 'nara:frank', input_revision: 'i-1', profile: {name: 'Frank', birth: {}}, matrix: [], natal: null}};
const expression = {expression_ref: 'expression:room', revision: 4, selection: {entity_ref: null, relation_ref: null, scene_ref: 'scene:1'},
  entities: {}, relations: {}, scenes: [{scene_ref: 'scene:1', title: 'Room'}], profiles: [], provenance: null};
const location = {schema: 'central.path-ref/v1', ref: 'ref:Control/user/flows/journal.html', root: 'R', path: 'Control/user/flows/journal.html'};

test('each practice stands at its own place in Nara\'s map, and every place lies inside its branch', () => {
  const table = [
    [{kind: 'journal'}, 'M4.4.4.2', 'context'], [{kind: 'dreams'}, 'M4.4.4.3', 'context'], [{kind: 'journey'}, 'M4.2', 'oracle'],
    [{kind: 'sitting'}, 'M4.1', 'embodied'], [{kind: 'centres'}, 'M4.1', 'embodied'], [{kind: 'identity'}, 'M4.0', 'identity'],
    [{kind: 'container', container: 'dialogue'}, 'M4.3-2.0', 'transformation'], [{kind: 'container', container: 'circle'}, 'M4.3-2.1', 'transformation'],
    [{kind: 'container', container: 'inquiry'}, 'M4.3-2.2', 'transformation'], [{kind: 'return'}, 'M4.5', 'integration'],
    [{kind: 'conversation'}, 'M4.4.4.4', 'context'], [{kind: 'spoken'}, 'M4.1', 'embodied'],
  ];
  for (const [practice, coordinate, branch] of table) {
    assert.deepEqual(practiceBranch(practice), {coordinate_ref: coordinate, m4_branch: branch, active_m_focus: 'm4'}, practice.kind);
    const basis = buildNativeTurnBasis(identity, 'agent-session/nara-1', expression, practice);
    assert.equal(basis.context.coordinate_ref, coordinate, 'the constant is gone: the practice places the turn');
    assert.equal(basis.practice, practice);
    validateDialogueContext(basis.context);
  }
  assert.throws(() => practiceBranch({kind: 'container', container: 'panel'}), /dialogue, a circle or an inquiry/);
});

test('the Expression\'s instrument stands with the centres, and a spoken turn stays with the body whatever the practice', () => {
  assert.equal(INSTRUMENT_PRACTICE.kind, 'centres');
  const instrument = buildNativeTurnBasis(identity, 'agent-session/nara-1', expression);
  assert.equal(instrument.context.coordinate_ref, 'M4.1', 'the voice gate (nara_voice.rs) still admits the instrument\'s turns');
  assert.equal(instrument.context.m4_branch, 'embodied');
  const journal = buildNativeTurnBasis(identity, 'agent-session/nara-1', expression, {kind: 'journal'}).context;
  const spoken = spokenContext(journal);
  assert.deepEqual([spoken.coordinate_ref, spoken.m4_branch, spoken.active_m_focus], ['M4.1', 'embodied', 'm4']);
  assert.equal(spoken.context_ref, journal.context_ref, 'only its place in the map moves');
});

test('a context\'s focus follows its branch, else the root its coordinate names; it is never assumed', () => {
  assert.equal(focusOf('context', 'M4.4.4.2'), 'm4');
  assert.equal(focusOf(null, 'M2.3'), 'm2');
  assert.equal(focusOf(null, 'ql:m-coordinate:bimba:M3-1'), 'm3');
  assert.equal(focusOf(null, '#5-2'), 'm5');
  assert.throws(() => focusOf(null, 'subject:selected'), /names no M root/);
  const context = buildDialogueContext({context_ref: 'c', nara_ref: 'nara:frank', subject_ref: 'person:frank', agent_session_ref: 's',
    coordinate_ref: 'M2.1', expression_ref: 'e', expression_revision: '1', profile_ref: 'p', profile_revision: '1', disclosed: []});
  assert.equal(context.active_m_focus, 'm2', 'a coordinate outside M4 is not stood in M4 by default');
});

test('a Flow page keeps its practice: its container, its journey, or the practice it was made for', () => {
  assert.deepEqual(practiceOfFlow({container: 'circle'}), {kind: 'container', container: 'circle'});
  assert.deepEqual(practiceOfFlow({journey: {schema: 'ql.nara-oracle-journey/v1'}}), {kind: 'journey'});
  assert.deepEqual(practiceOfFlow({practice: 'dreams'}), {kind: 'dreams'});
  assert.deepEqual(practiceOfFlow({}), {kind: 'conversation'});
  assert.equal(livedPracticeOf({kind: 'dreams'}), 'dreams');
  assert.equal(livedPracticeOf({kind: 'container', container: 'inquiry'}), 'flow');
});

const lived = {schema: 'oi.nara-lived-context/v1', sources: [], unread: [], skipped: [], context: {
  schema: 'ql.nara-lived-context/v1', context_revision: 'sha256:c', subject_ref: 'person:frank',
  concern: {concern_ref: 'concern:answer:x', title: 'the river and the move', terms: ['the river and the move']}, occasion: null, journey: null,
  passages: [
    {key: 'ref:Control/user/flows/journal.html/doc-j/e1@r-1', source_ref: 'ref:Control/user/flows/journal.html', revision: 'r-1', document_id: 'doc-j',
      entry_id: 'e1', contribution_id: null, selector: null, kind: 'journal', actor: 'human', author_ref: 'participant:p-f', mode: 'current', standing: 'reported',
      day_ref: null, occurred_at_unix_ms: 1, received_at_unix_ms: 1, late_receipt: false, unreviewed_revision: false, superseded_by: null,
      reasons: [{reason: 'concern-term', term: 'river'}], text: 'The <river> & the move.'},
    {key: 'ref:Control/user/flows/dreams.html/doc-d/e7@r-2', source_ref: 'ref:Control/user/flows/dreams.html', revision: 'r-2', document_id: 'doc-d',
      entry_id: 'e7', contribution_id: null, selector: null, kind: 'dream', actor: 'human', author_ref: 'participant:p-f', mode: 'current', standing: 'reported',
      day_ref: null, occurred_at_unix_ms: 2, received_at_unix_ms: 2, late_receipt: false, unreviewed_revision: false, superseded_by: null,
      reasons: [{reason: 'concern-term', term: 'river'}], text: 'A river under the house.'}],
  disclosed: [{ref_id: 'ref:Control/user/flows/journal.html/doc-j/e1@r-1', revision: 'r-1', standing: 'reported', disclosure: 'personal-consent', disclosed_via_ref: 'oi:answer-this:1'},
    {ref_id: 'ref:Control/user/flows/dreams.html/doc-d/e7@r-2', revision: 'r-2', standing: 'reported', disclosure: 'personal-consent', disclosed_via_ref: 'oi:answer-this:1'}],
  attribution: {human: 2, agent: 0, operational: 0}, candidates: 5, omitted: [{key: 'k', reason: 'passage budget reached'}], composed_at_unix_ms: 3}};
const answering = {location, entryId: 'e1', passage: 'the river and the move'};

test('Answer this asks in the person\'s own words: the passage itself, then its own words', () => {
  assert.deepEqual(answerTerms('The river, and the  move — again the river!'), ['The river, and the move — again the river!', 'river', 'move']);
  assert.ok(answerTerms('x'.repeat(400))[0].length === 240, 'a term is at most 240 characters');
  assert.throws(() => answerTerms('   '), /Choose the words/);
  const concern = answeringConcern(answering);
  assert.equal(concern.concern_ref, 'concern:answer:ref:Control/user/flows/journal.html#e1');
  assert.equal(concern.title, 'the river and the move');
});

test('the turn carries each passage by its key, disclosed by the person\'s consent, and the retained answer names them all', () => {
  const basis = buildNativeTurnBasis(identity, 'agent-session/nara-1', expression, {kind: 'journal'});
  basis.context = withLivedDisclosure(basis.context, lived.context);
  assert.equal(basis.context.disclosed.length, 3, 'the identity and the two passages');
  assert.equal(withLivedDisclosure(basis.context, lived.context).disclosed.length, 3, 'a passage is disclosed once');
  validateDialogueContext(basis.context);
  const input = JSON.parse(nativeTurnText('What does the river carry?', basis, 'nara', livedTurn(lived, answering)));
  assert.equal(input.context.coordinate_ref, 'M4.4.4.2');
  assert.deepEqual(input.lived_context.passages.map(p => p.key), lived.context.passages.map(p => p.key));
  assert.equal(input.lived_context.answering.entry_id, 'e1');
  assert.match(input.instruction, /Name each passage you draw on by its key/);
  assert.equal(JSON.parse(nativeTurnText('q', basis, 'nara')).lived_context, undefined, 'a turn not asked from the pages carries none');
  const retained = livedOfInput(input.lived_context);
  assert.deepEqual(retained.passages.map(p => p.kind), ['journal', 'dream']);
  assert.throws(() => livedOfInput({context_revision: 'c', passages: [{kind: 'journal'}]}), /no passage identity/);
  const escape = text => text.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[c]);
  const html = drawnFromHtml(retained, escape);
  for (const passage of lived.context.passages) assert.ok(html.includes(escape(passage.key)), `${passage.key} is named`);
  assert.equal(drawnFromHtml(null, escape), '');
  const flow = {location, doc: {entries: [{id: 'e1'}], meta: {revision: 5}}};
  const {relations, replyTo} = livedRelations(flow, retained);
  assert.deepEqual(relations[0], {type: 'reply', entryId: 'e1', anchor: 'the river and the move', revision: 5});
  assert.deepEqual(relations.slice(1).map(r => [r.type, r.ref]), lived.context.passages.map(p => ['source', p.key]));
  assert.deepEqual(replyTo, {entryId: 'e1', anchor: 'the river and the move'});
  const elsewhere = livedRelations({location: {ref: 'ref:other'}, doc: {entries: [{id: 'e1'}], meta: {revision: 1}}}, retained);
  assert.ok(elsewhere.relations.every(r => r.type === 'source') && !elsewhere.replyTo, 'a reply only where the passage stands');
});

// ── containers in the flow form ────────────────────────────────────────────────────────────────────────────────────────────

const legacy = () => ({meta: {documentId: 'doc-c', created: '2026-10-18T07:00:00Z', title: 'Circle', revision: 0, view: 'dialogue', current: null,
  journalCurrent: null, exported: null, template: 'ql-dialogue-flow v0.3',
  participants: [{initial: 'F', kind: 'person', name: 'Frank'}, {initial: 'A', kind: 'person', name: 'Ada'}, {initial: 'N', kind: 'agent', name: 'Nara'}]},
  entries: [], notes: [], packet: [], media: [], journal: []});
const held = (container) => { const doc = upgradeDocument(legacy(), '2026-10-18T07:00:00Z'); doc.meta.container = container; return doc; };
const keyOf = (doc, initial) => doc.meta.participants.find(p => p.initial === initial).key;
const write = (doc, initial, kind, n) => appendContribution(doc, {operationRef: `op-${n}`, authorKey: keyOf(doc, initial), html: `<p>${n}</p>`,
  at: '2026-10-18T08:00:00Z', ...(kind ? {kind} : {})}, {kind: 'human'});
const refusal = fn => { try { fn(); } catch (error) { if (error instanceof Refusal) return error.code; throw error; } return null; };

test('in a container an entry says its kind; out of one, or with another kind, it is refused', () => {
  const inquiry = held('inquiry');
  assert.equal(containerOf(inquiry), 'inquiry');
  const observed = write(inquiry, 'F', 'observe', 1);
  assert.equal(observed.entry.kind, 'observe');
  const interpreted = write(observed.doc, 'F', 'interpret', 2);
  assert.equal(interpreted.doc.entries[0].kind, 'observe', 'a later interpretation does not rewrite an observation');
  assert.equal(write(interpreted.doc, 'F', undefined, 3).entry.kind, undefined, 'the form invents no kind');
  assert.equal(refusal(() => write(held(undefined), 'F', 'observe', 4)), 'not-in-a-container');
  assert.equal(refusal(() => write(inquiry, 'F', 'wonder', 5)), 'invalid-entry-kind');
  const forged = interpreted.doc; forged.entries[0].kind = 'wonder';
  assert.ok(validateDocument(forged).some(issue => issue.code === 'invalid-entry-kind'));
  assert.equal(portableCopy(held('dialogue')).meta.container, 'dialogue', 'a shared copy keeps its form');
});

test('in a circle Speak as passes round the participants in order, and only the holder writes', () => {
  let circle = held('circle');
  assert.equal(circleHolder(circle).initial, 'F', 'nobody has spoken: the first holds the word');
  assert.equal(refusal(() => write(circle, 'A', undefined, 1)), 'not-the-holder');
  circle = write(circle, 'F', 'observe', 1).doc;
  assert.equal(circleHolder(circle).initial, 'A');
  circle = write(circle, 'A', undefined, 2).doc;
  assert.equal(circleHolder(circle).initial, 'N', 'the agent is in the round');
  assert.equal(refusal(() => write(circle, 'F', undefined, 3)), 'not-the-holder');
  circle = appendContribution(circle, {operationRef: 'op-3', authorKey: keyOf(circle, 'N'), html: '<p>3</p>', at: '2026-10-18T08:01:00Z'}, {kind: 'human'}).doc;
  assert.equal(circleHolder(circle).initial, 'F', 'round again');
  circle.meta.participants.find(p => p.initial === 'F').left = {at: '2026-10-18T09:00:00Z', revision: circle.meta.revision};
  assert.equal(circleHolder(circle).initial, 'A', 'one who left the round is passed');
});
