import test from 'node:test';
import assert from 'node:assert/strict';
import {graphHopContext, graphSummonSubject, resolveNativeGraphFocus} from '../src/knowledge/nativeFocus.ts';

const provenance = {source: 'central:wiki', revision: 'r1'};
const node = (ref, native_owner = 'ai-kit', extra = {}) => ({ref, kind: 'wiki-node', label: ref, native_owner, provenance, actions: [], ...extra});
const ghost = {ref: 'view:unresolved-link:Missing', kind: 'unresolved-link', label: 'Missing', native_owner: 'graph-presentation', provenance, actions: [], unresolved: {key: 'Missing', sources: {}}};

test('a canvas summon admits its exact subject ref and native owner, never the canvas expression owner', () => {
  const admitted = graphSummonSubject({ref: 'central:node:alpha', nativeOwner: 'ql-mef', kind: 'subject', revision: 3, title: 'Alpha', sceneRef: 'scene:1', entityRef: null, relationRef: null});
  assert.deepEqual(admitted, {ok: true, subject_ref: 'central:node:alpha', native_owner: 'ql-mef'});
});

test('a summon with no admissible subject is refused with a named reason, never guessed', () => {
  for (const carried of [undefined, null, 'central:node:alpha', ['central:node:alpha'], {}]) {
    const refused = graphSummonSubject(carried);
    assert.equal(refused.ok, false);
    assert.equal(typeof refused.reason, 'string');
  }
  assert.match(graphSummonSubject({ref: 'central:node:alpha'}).reason, /native owner/);
  assert.match(graphSummonSubject({nativeOwner: 'ql-mef'}).reason, /subject reference/);
  assert.equal(graphSummonSubject({ref: '   ', nativeOwner: 'ql-mef'}).ok, false, 'a blank ref is refused');
  assert.equal(graphSummonSubject({ref: 'central:node:\u0007', nativeOwner: 'ql-mef'}).ok, false, 'control characters are refused');
  assert.equal(graphSummonSubject({ref: 'x'.repeat(4097), nativeOwner: 'ql-mef'}).ok, false, 'oversized refs are refused');
});

test('a project is carried only as a bounded string', () => {
  assert.equal(graphSummonSubject({ref: 'a', nativeOwner: 'o', project: 'Work'}).project, 'Work');
  assert.equal(graphSummonSubject({ref: 'a', nativeOwner: 'o', project: 7}).project, undefined);
});

test('the focus context carries exactly the subject and owner, and refuses an empty one', () => {
  assert.deepEqual(graphHopContext({subject_ref: 'central:node:alpha', native_owner: 'ql-mef'}), {subject_ref: 'central:node:alpha', native_owner: 'ql-mef'});
  assert.equal(graphHopContext({subject_ref: 'central:node:alpha', native_owner: ''}), null);
});

test('focus selects the one node of the exact owner, by ref or by its subject ref', () => {
  const reading = {nodes: [node('central:node:alpha'), node('view:occurrence:1', 'ql-mef', {subject_ref: 'central:node:beta'})]};
  const byRef = resolveNativeGraphFocus(reading, {subject_ref: 'central:node:alpha', native_owner: 'ai-kit'});
  assert.equal(byRef.state, 'found');
  assert.equal(byRef.node.ref, 'central:node:alpha');
  const bySubject = resolveNativeGraphFocus(reading, {subject_ref: 'central:node:beta', native_owner: 'ql-mef'});
  assert.equal(bySubject.state, 'found');
  assert.equal(bySubject.node.ref, 'view:occurrence:1');
});

test('a subject the graph does not hold is an honest not-in-this-graph refusal, never a wrong node', () => {
  const reading = {nodes: [node('central:node:alpha'), ghost]};
  const absent = resolveNativeGraphFocus(reading, {subject_ref: 'central:node:zeta', native_owner: 'ai-kit'});
  assert.equal(absent.state, 'missing');
  assert.match(absent.detail, /not in this graph/);
});

test('a subject disclosed under a different owner is refused with the exact mismatch named, never mapped', () => {
  const reading = {nodes: [node('central:node:alpha', 'ai-kit')]};
  const mismatch = resolveNativeGraphFocus(reading, {subject_ref: 'central:node:alpha', native_owner: 'ql-mef'});
  assert.equal(mismatch.state, 'missing');
  assert.match(mismatch.detail, /owner "ai-kit", not "ql-mef"/);
  assert.match(mismatch.detail, /No owner is mapped/);
});

test('an unresolved ghost or a label never stands in for a native subject', () => {
  const reading = {nodes: [{...ghost, ref: 'central:node:alpha', subject_ref: 'central:node:alpha'}]};
  assert.equal(resolveNativeGraphFocus(reading, {subject_ref: 'central:node:alpha', native_owner: 'graph-presentation'}).state, 'missing');
});

test('two native occurrences of one subject are ambiguous and are never guessed between', () => {
  const reading = {nodes: [node('view:a', 'ai-kit', {subject_ref: 'central:node:alpha'}), node('view:b', 'ai-kit', {subject_ref: 'central:node:alpha'})]};
  assert.equal(resolveNativeGraphFocus(reading, {subject_ref: 'central:node:alpha', native_owner: 'ai-kit'}).state, 'ambiguous');
});
