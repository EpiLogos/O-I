/** Controlled producer records only. Never shipped or imported by production. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePublications } from '../build-publications.mjs';
import { openPublication, publicAssetUrl, publicationHref, publicationRoute } from '../src/library/publication-model.mjs';
import { producerFixtures, SUBJECT, COLLECTION } from './publication-fixtures.mjs';
const clone = value => structuredClone(value);
const binding = input => input.projection.representation.payload.regions[0].bindings.find(b => b.binding_ref === 'subject');

test('private field excludes the Projection, HTML, embedded data and download, not merely search rows', () => {
  const [world] = producerFixtures();
  world.field.visibility = 'private';
  const result = compilePublications([world]);
  assert.equal(result.seed.entries.length, 0);
  assert.equal(result.seed.presentation_projections.length, 0);
  assert.equal(result.editions.length, 0);
  assert.ok(!JSON.stringify(result).includes('Fixture paragraph'));
});

test('a denied subject inside a mixed outward Projection requires native reselection before any output', () => {
  const [world] = producerFixtures();
  world.entries.find(e => e.ref === SUBJECT).meta.visibility = 'private';
  assert.throws(() => compilePublications([world]), /public admission/);
});

test('withdrawal wins over an older public copy, in either input order', () => {
  const [world] = producerFixtures();
  const withdrawn = clone(world); withdrawn.projection.state = 'withdrawn';
  for (const inputs of [[world, withdrawn], [withdrawn, world]]) {
    const result = compilePublications(inputs);
    assert.equal(result.editions.length, 0);
    assert.equal(result.seed.entries.length, 0);
  }
});

test('conflicting field membership cannot be overwritten by input order', () => {
  const [world] = producerFixtures();
  const seed = {schema:'oi.explore-browser-seed/v1', entries:[], relations:[], presentation_projections:[], fields:[{field_ref:'field:other',visibility:'private',kind:'explore'}], entry_fields:{[SUBJECT]:'field:other'}};
  for (const inputs of [[world, seed], [seed, world]]) assert.throws(() => compilePublications(inputs), /public admission/);
});

for (const key of ['apiKey', 'access_token', 'refreshToken', 'Authorization', 'privateNotes', 'internal_evidence', 'dialogue', 'machine_facts']) {
  test(`sensitive outward metadata ${key} is refused before native edition rendering`, () => {
    const [world] = producerFixtures();
    world.projection.provenance[0][key] = 'NOT_FOR_PUBLICATION';
    assert.throws(() => compilePublications([world]), /public admission/);
  });
}

for (const value of ['Control%2Fuser%2Fsecret.md', 'Control%252Fuser%252Fsecret.md', 'nara:dialogue:private', 'https://example.com/media.png?access_token=secret', 'https://example.com/?X-Amz-Credential=secret']) {
  test(`encoded protected references and credential-bearing links are not browser data: ${value.split('?')[0]}`, () => {
    const [world] = producerFixtures();
    binding(world).props.text = `[source](/explore.html?ref=${value})`;
    assert.throws(() => compilePublications([world]), /public admission/);
  });
}

test('public media permits ordinary URLs, not credential-bearing query or fragment transports', () => {
  for (const url of ['https://example.com/a?token=secret', 'https://example.com/a#access_token=secret', 'https://example.com/a?api%4bey=secret', 'https://example.com/a?X-Amz-Signature=secret']) assert.equal(publicAssetUrl(url), null);
  assert.equal(publicAssetUrl('https://example.com/a?revision=r3#figure-2'), 'https://example.com/a?revision=r3#figure-2');
});

export function largeSeed(count = 1875) {
  const {seed} = compilePublications(producerFixtures());
  for (let i = 0; i < count; i++) {
    const ref = `world:fixture/wiki:node-${String(i).padStart(4,'0')}`;
    seed.entries.push({...clone(seed.entries.find(e=>e.ref===SUBJECT)), ref, label:`Record ${String(i).padStart(4,'0')}`});
    seed.relations.push({from:COLLECTION,to:ref,relation:'wiki.contains',origin:'wiki',provenance:clone(seed.relations[0].provenance)});
  }
  return seed;
}

test('native collection discovery does not silently stop at the first thousand subjects', () => {
  const model = openPublication(largeSeed());
  const members = model.search('', COLLECTION);
  assert.equal(members.length, 1876);
  assert.equal(model.search('Record 1874', COLLECTION)[0].ref, 'world:fixture/wiki:node-1874');
});

test('collection and search return address survives refresh without browser storage', () => {
  const input = {ref:SUBJECT,collection_ref:COLLECTION,q:'Record',page:'70',focus_ref:'world:fixture/wiki:node-1874',at:'17',offset:'.3'};
  const route = publicationRoute(publicationHref(input));
  assert.equal(route.page,'70'); assert.equal(route.focus_ref,input.focus_ref); assert.equal(route.q,'Record');
});

test('bounded result pages cover the complete native set without duplication or truncation', () => {
  const model=openPublication(largeSeed()),all=model.search('',COLLECTION);
  const refs=[]; let pages=1;
  for(let page=1;page<=pages;page++) {
    const result=model.searchPage('',COLLECTION,page); pages=result.pages;
    assert.ok(result.items.length<=24); assert.equal(result.total,1876);
    refs.push(...result.items.map(item=>item.ref));
  }
  assert.deepEqual(refs,all.map(item=>item.ref)); assert.equal(new Set(refs).size,refs.length);
  assert.throws(()=>model.searchPage('',COLLECTION,pages+1),/results page/);
});

test('browser reception rejects mixed, missing, duplicate or substituted native manifest pairs', () => {
  const {seed,editions}=compilePublications(producerFixtures()),manifests=editions.map(e=>e.manifest);
  assert.doesNotThrow(()=>openPublication(seed,manifests));
  for(const variant of [[],manifests.slice(1),[...manifests,manifests[0]]]) assert.throws(()=>openPublication(seed,variant),/edition/);
  for(const key of ['ref','revision','system']) {
    const changed=clone(manifests); changed[0].source[key]='mismatched';
    assert.throws(()=>openPublication(seed,changed),/edition/);
  }
  const changed=clone(manifests);changed[0].projection_file=changed[1].projection_file;
  assert.throws(()=>openPublication(seed,changed),/edition/);
});
