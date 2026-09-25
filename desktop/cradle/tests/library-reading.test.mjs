import test from 'node:test';
import assert from 'node:assert/strict';
import {readLibrary} from '../src/library/libraryReading.ts';

// Controlled fixture only — never the real transport-backed providers
// (collectionsProvider / nativeExpressionsProvider). Exercises the host
// adapter's own contract: sanitization, dedupe-by-ref, the shared-scope
// privacy boundary and honest coverage-on-failure.
const transport = {kind: 'bridge', url: 'http://library-reading-fixture.invalid'};

function fixtureProvider(id, items, coverageState = 'complete') {
  return {
    id, label: id, kinds: ['composition'], scopes: ['local', 'shared'],
    async list(_query, _signal) {
      return {items, coverage: {provider: id, state: coverageState}};
    },
  };
}

function failingProvider(id, message) {
  return {
    id, label: id, kinds: ['composition'], scopes: ['local'],
    async list() { throw new Error(message); },
  };
}

test('sanitizes provider items to refs, titles, locations, revisions and collection memberships — no source bodies', async () => {
  const providers = [fixtureProvider('collections', [
    {
      kind: 'composition', ref: 'central:controlled:a.json', title: 'Alpha', owner: 'Work/Test',
      scope: 'local', project: 'Test', revision: 'sha256:abc',
      collectionMemberships: [{manifest_path: 'a.manifest.json', manifest_location: {}, manifest_revision: 'sha256:1', member_id: 's0', slot: 0, file: 'items/s0.json', group: 'Featured', title: 'Alpha'}],
      // A provider read can carry source bodies (readContents); the adapter
      // must never forward anything beyond the sanitized shape.
      sourceLocation: {schema: 'central.path-ref/v1', ref: 'central:controlled:a.json'},
    },
  ])];
  const result = await readLibrary(transport, {scope: 'local'}, undefined, providers);
  assert.equal(result.entries.length, 1);
  const entry = result.entries[0];
  assert.deepEqual(Object.keys(entry).sort(), ['collectionMemberships', 'collections', 'expressionRef', 'kind', 'owner', 'project', 'ref', 'revision', 'scope', 'title'].sort());
  assert.equal(entry.ref, 'central:controlled:a.json');
  assert.equal(entry.revision, 'sha256:abc');
  assert.deepEqual(entry.collectionMemberships, [{title: 'Alpha', group: 'Featured', manifest_path: 'a.manifest.json'}]);
  assert.equal(entry.collectionMemberships[0].slot, undefined, 'internal manifest bookkeeping (slot) does not cross the sanitized boundary');
  assert.deepEqual(result.coverage, [{provider: 'collections', state: 'complete'}]);
});

test('dedupes across providers by native ref, first reading wins', async () => {
  const providers = [
    fixtureProvider('collections', [{kind: 'composition', ref: 'expression:shared-ref', title: 'From collections', owner: 'a', scope: 'local'}]),
    fixtureProvider('expressions', [{kind: 'composition', ref: 'expression:shared-ref', title: 'From native index', owner: 'b', scope: 'local'}]),
  ];
  const result = await readLibrary(transport, {scope: 'local'}, undefined, providers);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].title, 'From collections');
});

test('the shared scope keeps only entries a provider itself disclosed as local or shared, never a private/ineligible one', async () => {
  const providers = [fixtureProvider('collections', [
    {kind: 'composition', ref: 'expression:public', title: 'Public', owner: 'a', scope: 'shared'},
    {kind: 'composition', ref: 'expression:nested', title: 'Nested subset', owner: 'a', scope: 'local'},
  ])];
  const local = await readLibrary(transport, {scope: 'local'}, undefined, providers);
  assert.equal(local.entries.length, 2);
  const shared = await readLibrary(transport, {scope: 'shared'}, undefined, providers);
  assert.deepEqual(shared.entries.map(e => e.ref).sort(), ['expression:nested', 'expression:public']);
});

test('a provider read that throws is named in coverage, not silently dropped or invented as empty success', async () => {
  const providers = [fixtureProvider('collections', [{kind: 'composition', ref: 'x', title: 'X', owner: 'a', scope: 'local'}]), failingProvider('expressions', 'the native Expression index is offline')];
  const result = await readLibrary(transport, {scope: 'local'}, undefined, providers);
  assert.equal(result.entries.length, 1, 'a healthy provider still reads through a sibling failure');
  const failed = result.coverage.find(c => c.provider === 'expressions');
  assert.equal(failed.state, 'unavailable');
  assert.match(failed.reason, /offline/);
});

test('defaults to the real built-in providers (collectionsProvider, nativeExpressionsProvider) when none are injected', async () => {
  // No providers array: readLibrary must still resolve (against the real
  // provider pair) rather than throw for a missing default.
  const result = await readLibrary(transport, {scope: 'local'});
  assert.ok(Array.isArray(result.entries));
  assert.ok(Array.isArray(result.coverage));
});

test('native Expressions carry their own Scene lists from the Expression owner; unreadable ones stay undisclosed, not empty', async () => {
  const providers = [fixtureProvider('native-expressions', [
    {kind: 'composition', ref: 'expression:readable', expressionRef: 'expression:readable', title: 'Readable', owner: 'oi', scope: 'local'},
    {kind: 'composition', ref: 'expression:refused', expressionRef: 'expression:refused', title: 'Refused', owner: 'oi', scope: 'local'},
    {kind: 'composition', ref: 'central:controlled:file.json', title: 'File', owner: 'Work/Test', scope: 'local'},
  ])];
  const asked = [];
  const scenes = async ref => {asked.push(ref); if (ref === 'expression:refused') throw new Error('denied'); return [{scene_ref: 'scene:1', title: 'Overview'}, {scene_ref: 'scene:2', title: 'Inquiry'}];};
  const result = await readLibrary(transport, {scope: 'local'}, undefined, providers, scenes);
  const by = ref => result.entries.find(entry => entry.ref === ref);
  assert.deepEqual(by('expression:readable').scenes, [{scene_ref: 'scene:1', title: 'Overview'}, {scene_ref: 'scene:2', title: 'Inquiry'}]);
  assert.equal(by('expression:refused').scenes, undefined);
  assert.equal(by('central:controlled:file.json').scenes, undefined);
  assert.deepEqual(asked.sort(), ['expression:readable', 'expression:refused'], 'only native Expressions are inspected');
});
