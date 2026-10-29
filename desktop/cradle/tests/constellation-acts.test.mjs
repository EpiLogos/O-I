// A constellation you made, act by act, through the Wiki owner (O-I #742; constellationActs.ts): the detached authoring panel's acts, each
// now one owner's act at the revision read — New constellation, Rename and Edit question, a passage gathered with its span, a member
// removed with its connections, a connection changed or retracted, a member's time and place in its constellation (wikiFacts.ts, the
// reader's time-and-place editor) — and the whole a frame of the register gathers round (the reader's graph opens it in the browser).
// SCRIPTED: a kernel behind the bridge's fetch, holding one register file and applying `aikit.constellation.apply` as AIKit keeps a frame
// (its revision, its members' participations, its relations, its applied operations), so every act is read back from what it wrote.
import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSTRUCTION, PARTICIPATION, RELATION, newConstruction} from '../src/knowledge/construction.ts';
import * as acts from '../src/knowledge/constellationActs.ts';
import {inspectFacts, saveFacts, prepareFacts, restoreFactsCheckpoints, factsKey} from '../src/knowledge/wikiFacts.ts';
import {selectedPassage} from '../src/knowledge/selection.ts';
import {readFileSync} from 'node:fs';

const transport = {kind: 'bridge', url: 'http://controlled.invalid'};
const WIKI = {schema: 'central.path-ref/v1', ref: 'central:path:wiki', root: '/scratch', path: 'Control/agents/wiki/wiki.json'};
const EVIDENCE = {schema: 'central.path-ref/v1', ref: 'central:path:evidence', root: '/scratch', path: 'Work/notes.md'};

/** AIKit keeps what it writes with its keys in order (observed on the walk's register, 29 Oct): the scripted owner keeps it so too. */
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
/** The scripted kernel: one register, AIKit's apply on it, the reads readRegister makes. */
function kernel() {
  const objects = [{object: 'space', ref: 'central:wiki:root', title: 'Central', anchor_ref: 'wiki:node:central', node_refs: [], revision: 1}];
  let revision = 1;
  const calls = [];
  const file = () => ({schema: 'central.file-reading/v1', location: WIKI, revision: `file:r${revision}`, byte_len: 0, content_encoding: 'utf-8', content: JSON.stringify({objects})});
  const apply = request => {
    const at = objects.findIndex(row => row.object === 'frame' && row.ref === request.frame_ref);
    const frame = at < 0 ? null : objects[at];
    if ((frame?.revision ?? 0) !== request.expected_revision) throw Error(`knowledge.wiki_revision_conflict: ${request.frame_ref} stands at ${frame?.revision ?? 0}`);
    const next = frame ? structuredClone(frame) : {object: 'frame', ref: request.frame_ref, revision: 0, constellations: [{anchor_ref: '', members: [], returns: []}], [CONSTRUCTION]: {title: '', inquiry: {question: ''}, frame: null, compositions: []}};
    const members = next.constellations[0].members;
    for (const change of request.changes) {
      if (change.change === 'create') Object.assign(next, {constellations: [{anchor_ref: change.anchor_ref, members: [], returns: []}], [CONSTRUCTION]: {title: change.title, inquiry: change.inquiry, frame: change.frame, compositions: []}});
      else if (change.change === 'inquiry_set') Object.assign(next[CONSTRUCTION], {title: change.title, inquiry: change.inquiry});
      else if (change.change === 'member_add') members.push({ref: change.member.subject_ref, [PARTICIPATION]: ordered(change.member.participation)});
      else if (change.change === 'member_remove') next.constellations[0].members = members.filter(row => row[PARTICIPATION].participation_ref !== change.participation_ref);
      else if (change.change === 'temporal_set' || change.change === 'place_set') {
        const member = members.find(row => row[PARTICIPATION].participation_ref === change.participation_ref);
        member['aikit.techne-facet/v1'] = {contract: 'aikit.techne-facet/v1', ...member['aikit.techne-facet/v1'], ...(change.temporal ? {temporal: change.temporal} : {}), ...(change.places ? {spatial: change.places} : {})};
      } else if (change.change === 'relation_put') {
        const r = change.relation, i = objects.findIndex(row => row.ref === r.relation_ref);
        const edge = {object: 'edge', ref: r.relation_ref, revision: i < 0 ? 1 : objects[i].revision + 1, from_ref: 'x', to_ref: 'y', relation: r.relation,
          [RELATION]: {from_participation_ref: r.from_participation_ref, to_participation_ref: r.to_participation_ref, direction: r.direction, standing: r.standing, evidence: r.evidence}};
        if (i < 0) objects.push(edge); else objects[i] = edge;
      } else if (change.change === 'relation_retract') {
        const i = objects.findIndex(row => row.ref === change.relation_ref);
        objects[i] = {...objects[i], revision: objects[i].revision + 1, [RELATION]: {...objects[i][RELATION], standing: 'retracted'}};
      } else throw Error(`unscripted change ${change.change}`);
    }
    next.revision += 1;
    next[CONSTRUCTION].applied = {...next[CONSTRUCTION].applied, [request.operation_ref]: {actor_ref: request.actor_ref, request_digest: 'a'.repeat(64), basis_revision: request.expected_revision, result_revision: next.revision}};
    if (at < 0) objects.push(next); else objects[at] = next;
    revision += 1;
    const {object: _o, ...reading} = next;
    return {schema: 'aikit.constellation/v1', frame_ref: next.ref, revision: next.revision, persisted: true, state: 'saved',
      reading: {frame: reading, construction: next[CONSTRUCTION], relations: objects.filter(row => row.object === 'edge').map(({object: _e, ...edge}) => edge)}};
  };
  const answer = op => {
    calls.push(op);
    if (op.op === 'world_browse') return {result: 'world_read', snapshot: {navigator: {root: {work: {projects: []}}}}};
    if (op.op === 'files_list') return {result: 'directory_read', directory: {schema: 'central.directory-reading/v1', location: {...WIKI, path: op.path}, entries: op.path === 'Work'
      ? [{name: 'notes.md', kind: 'file', location: EVIDENCE, byte_len: 1, retrieval_allowed: true}] : [{name: 'wiki.json', kind: 'file', location: WIKI, byte_len: 1, retrieval_allowed: true}], automatic_agent_or_model_invocation: false}};
    if (op.op === 'file_read') return {result: 'file_read', reading: op.location.ref === EVIDENCE.ref ? {schema: 'central.file-reading/v1', location: EVIDENCE, revision: 'evidence:r1', content: 'In 1922.', source: {ref: 'source:notes'}} : file()};
    if (op.op === 'invoke_action' && /wiki\.read$/.test(op.invocation.action)) return {result: 'action_dispatched', dispatch: {state: 'invoked', data: {schema: 'central.wiki-reading/v1', source: {path: WIKI.path, ref: 'source:wiki', revision: `file:r${revision}`}}}};
    if (op.op === 'invoke_action' && op.invocation.action === 'aikit.constellation.apply') {
      try { return {result: 'action_dispatched', dispatch: {state: 'invoked', data: apply(op.invocation.input.request)}} }
      catch (error) { return {result: 'action_dispatched', dispatch: {state: 'refused', message: error.message}} }
    }
    if (op.op === 'knowledge') return {result: 'knowledge', data: PASSAGE_READING};
    throw Error(`unscripted op ${op.op}`);
  };
  return {calls, objects, install() {
    const original = globalThis.fetch;
    globalThis.fetch = async (_url, options) => { const op = JSON.parse(options.body); try { return {json: async () => ({ok: true, outcome: answer(op)})} } catch (error) { return {json: async () => ({ok: false, error: error.message})} } };
    return () => { globalThis.fetch = original };
  }};
}
// A source the reader reads (the native fixture's source:a), and two passages selected in it as the reader selects them.
const PASSAGE_READING = JSON.parse(readFileSync(new URL('./fixtures/wiki-native.json', import.meta.url)))['source:a'];
const bytes = text => new TextEncoder().encode(text).length;
const spanOf = text => { const at = bytes(PASSAGE_READING.content.slice(0, PASSAGE_READING.content.indexOf(text))); return {revision: PASSAGE_READING.revision, start_byte: at, end_byte: at + bytes(text)} };
const passage = selectedPassage(PASSAGE_READING, spanOf('🌱'), '🌱', 'Alpha');
const second = selectedPassage(PASSAGE_READING, spanOf('[['), '[[', 'Alpha');
const applied = calls => calls.filter(op => op.op === 'invoke_action' && op.invocation.action === 'aikit.constellation.apply').map(op => op.invocation.input.request);

test('New constellation writes one in the space with its title and question; Rename and Edit question change it at its revision', async () => {
  const k = kernel(), restore = k.install();
  try {
    const {whole} = await acts.createConstellation(transport, undefined, 'central:wiki:root', 'Readings', 'Which readings belong together?');
    assert.match(whole, /^wiki:anchor:/);
    const read = await acts.readConstruction(transport, undefined, whole);
    assert.deepEqual([read.reading.title, read.reading.question, read.reading.revision], ['Readings', 'Which readings belong together?', 1]);
    await acts.actOn(transport, undefined, whole, 'Readings', (register, frame) => ({request: acts.inquiryRequest(register, frame, {title: 'Close readings'})}));
    await acts.actOn(transport, undefined, whole, 'Close readings', (register, frame) => ({request: acts.inquiryRequest(register, frame, {question: 'What do they share?'})}));
    const again = await acts.readConstruction(transport, undefined, whole);
    assert.deepEqual([again.reading.title, again.reading.question, again.reading.revision], ['Close readings', 'What do they share?', 3]);
    assert.deepEqual(applied(k.calls).map(request => [request.changes[0].change, request.expected_revision]), [['create', 0], ['inquiry_set', 1], ['inquiry_set', 2]]);
    await assert.rejects(acts.createConstellation(transport, undefined, 'central:wiki:elsewhere', 'X', 'Y'), /not in this wiki's register now/);
  } finally { restore(); }
});

test('a passage is gathered with its span once; removing a member retracts its connections first; a connection changes or is retracted', async () => {
  const k = kernel(), restore = k.install();
  try {
    const {whole} = await acts.createConstellation(transport, undefined, 'central:wiki:root', 'Readings', 'Which?');
    const gather = selected => acts.actOn(transport, undefined, whole, 'Readings', (register, frame) => ({request: acts.passageRequest(register, frame, selected), passages: [selected]}));
    await gather(passage);
    await gather(second);
    await assert.rejects(gather(passage), /already gathered in Readings/);
    let {reading} = await acts.readConstruction(transport, undefined, whole);
    assert.deepEqual(reading.members.map(member => [member.label, member.anchor]), [['🌱', spanOf('🌱')], ['[[', spanOf('[[')]]);
    // A connection between the two, as Promote makes it (sceneConstellationRelation.ts: relation_put, standing proposed).
    const [a, b] = reading.members;
    await acts.actOn(transport, undefined, whole, 'Readings', (_register, frame) => ({request: {schema: 'aikit.constellation-action/v1', frame_ref: frame.ref, expected_revision: frame.revision,
      actor_ref: 'human:cradle-wiki', operation_ref: 'operation:wiki:relate', changes: [{change: 'relation_put', relation: {relation_ref: 'wiki:relation:r', expected_revision: null,
        from_participation_ref: a.participation_ref, to_participation_ref: b.participation_ref, relation: 'cause', direction: 'directed', standing: 'proposed', evidence: []}}]}}));
    ({reading} = await acts.readConstruction(transport, undefined, whole));
    assert.deepEqual(reading.connections.map(edge => [edge.relation, edge.standing]), [['cause', 'proposed']]);
    await acts.actOn(transport, undefined, whole, 'Readings', (register, frame) => ({request: acts.connectionRequest(register, frame, 'wiki:relation:r', {standing: 'asserted', relation: 'dates'})}));
    ({reading} = await acts.readConstruction(transport, undefined, whole));
    assert.deepEqual(reading.connections.map(edge => [edge.relation, edge.standing]), [['dates', 'asserted']]);
    assert.throws(() => acts.connectionRequest({relations: []}, k.objects.find(row => row.object === 'frame'), 'wiki:relation:r', {standing: 'certain'}), /no longer in|stands proposed/);
    await acts.actOn(transport, undefined, whole, 'Readings', (register, frame) => ({request: acts.removeRequest(register, frame, a.participation_ref)}));
    assert.deepEqual(applied(k.calls).at(-1).changes.map(change => change.change), ['relation_retract', 'member_remove'], 'a connection is retracted before its member leaves');
    ({reading} = await acts.readConstruction(transport, undefined, whole));
    assert.deepEqual([reading.members.map(member => member.label), reading.connections.length], [['[['], 0]);
  } finally { restore(); }
});

test('a member\'s time and place are its constellation\'s: read at the frame\'s revision, saved as that frame\'s change with the same operation', async () => {
  const k = kernel(), restore = k.install();
  try {
    const {whole} = await acts.createConstellation(transport, undefined, 'central:wiki:root', 'Readings', 'Which?');
    await acts.actOn(transport, undefined, whole, 'Readings', (register, frame) => ({request: acts.passageRequest(register, frame, passage), passages: [passage]}));
    const {reading} = await acts.readConstruction(transport, undefined, whole);
    const subject = {frame_ref: reading.frame_ref, participation_ref: reading.members[0].participation_ref};
    const basis = await inspectFacts(transport, undefined, subject);
    assert.deepEqual([basis.target, basis.revision, basis.values], [{kind: 'participation', ref: subject.participation_ref, frame_ref: subject.frame_ref}, 2, {temporal: [], places: []}]);
    const temporal = [{facet_ref: 'wiki:temporal:1', kind: 'occurrence', instant: '1922-01-01T00:00:00Z', precision: 'year', source_ref: 'source:notes'}];
    const draft = {...basis.values, temporal, facet_sources: [{source_ref: 'source:notes', revision: 'evidence:r1', location: EVIDENCE}]};
    const pending = prepareFacts({basis, draft});
    const key = factsKey(basis.target);
    assert.deepEqual(Object.keys(restoreFactsCheckpoints({[key]: {basis, draft, pending}})), [key], 'a retained participation draft restores');
    const saved = await saveFacts(transport, undefined, {basis, draft, pending});
    assert.deepEqual(saved.values.temporal, temporal);
    const request = applied(k.calls).at(-1);
    assert.deepEqual([request.frame_ref, request.expected_revision, request.operation_ref, request.changes], [subject.frame_ref, 2, pending.operation_ref,
      [{change: 'temporal_set', temporal, participation_ref: subject.participation_ref}]]);
  } finally { restore(); }
});

test('the whole a frame gathers round, any frame of the register; a whole no constellation you made gathers round takes no act', async () => {
  const register = {file: {content: JSON.stringify({objects: [{object: 'frame', ref: 'wiki:frame:form:wiki:node:s', revision: 1, constellations: [{anchor_ref: 'wiki:node:s', members: []}]}]})}, frames: [], relations: []};
  assert.equal(acts.wholeOfFrame(register, 'wiki:frame:form:wiki:node:s'), 'wiki:node:s');
  assert.equal(acts.wholeOfFrame(register, 'wiki:frame:absent'), null);
  assert.equal(acts.constructionRound(register, 'wiki:node:s'), null);
  const k = kernel(), restore = k.install();
  try { await assert.rejects(acts.actOn(transport, undefined, 'wiki:node:central', 'Central', () => { throw Error('not reached') }), /Central is not a constellation you made/); }
  finally { restore(); }
  assert.equal(newConstruction('A', 'B', 'central:wiki:root').changes[0].change, 'create');
});
