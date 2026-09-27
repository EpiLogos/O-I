/** W1–W5 place-reading glue — pure proof (no DOM, no native fixture).
 * Loads `../src/placeReading.ts` and its m0m5 model dependency
 * (`../../src/techne/m0m5/place/{world,filter}.ts`) through the same
 * esbuild-in-tmp pattern `relation-field.test.mjs` already uses to cross the
 * field-studies-journeys ↔ desktop/cradle/src boundary.
 *
 * Covers: filtering by relation type/standing/validity window narrows the
 * facet list and the wrapped PlacesRepository identically and never mints or
 * drops identity; mythic standing is never classed as factual; an unlocated
 * place stays unlocated through the filter; the filter toggle collapses back
 * to "open" once every offered option is included again; the Scene entity
 * lookup for "Edit place/time" resolves the reading's own subject, never an
 * unrelated entity.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-place-reading-'));
 try{
  const out=join(temporary,'place-reading-adapters.mjs');
  await build({
   stdin:{contents:"export * from './src/placeReading.ts';",resolveDir:engine},
   tsconfig:engine+'/tsconfig.json',
   bundle:true,
   platform:'node',
   format:'esm',
   outfile:out,
   logLevel:'warning',
  });
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function facet(overrides={}){
 return {place_ref:'place:rome',precision:'exact',geometry:{type:'point',coordinates:[12.4964,41.9028]},...overrides};
}

function reading(spatial){
 return {
  contract:'ql.techne/v1',
  reading_ref:'reading:test',
  subject:{subject_ref:'subject:pilgrim',native_owner:'wiki'},
  spatial,
  disclosure:{instruments:[]},
 };
}

test('an open filter admits every disclosed facet, unchanged and in order',()=>{
 const facets=[facet({place_ref:'a',relation:'OCCURRED_AT'}),facet({place_ref:'b',relation:'LOCATED_IN'})];
 const admitted=api.filteredFacets(reading(facets),api.OPEN_PLACE_FILTER);
 assert.deepEqual(admitted,facets);
 assert.equal(admitted[0],facets[0],'the same facet object, never a clone');
});

test('a relation filter narrows to only the included relation types',()=>{
 const facets=[facet({place_ref:'a',relation:'OCCURRED_AT'}),facet({place_ref:'b',relation:'LOCATED_IN'}),facet({place_ref:'c',relation:'MYTH_LOCATED_AT'})];
 const filter={...api.OPEN_PLACE_FILTER,relations:new Set(['OCCURRED_AT'])};
 const admitted=api.filteredFacets(reading(facets),filter);
 assert.deepEqual(admitted.map(f=>f.place_ref),['a']);
});

test('mythic standing is a distinct class from factual and owner vocabulary, never merged',()=>{
 const facets=[
  facet({place_ref:'a',relation:'OCCURRED_AT'}),
  facet({place_ref:'b',relation:'MYTH_LOCATED_AT'}),
  facet({place_ref:'c',relation:'visited'}),
 ];
 const options=api.placeFilterOptions(reading(facets));
 assert.deepEqual(options.standing,['factual','mythic','owner-vocabulary']);
 const onlyMythic=api.filteredFacets(reading(facets),{...api.OPEN_PLACE_FILTER,standing:new Set(['mythic'])});
 assert.deepEqual(onlyMythic.map(f=>f.place_ref),['b']);
});

test('a validity window excludes facets whose own interval never meets it, never invents a date',()=>{
 const facets=[
  facet({place_ref:'a',relation:'OCCURRED_AT',valid_from:'1900',valid_to:'1910'}),
  facet({place_ref:'b',relation:'OCCURRED_AT',valid_from:'1950',valid_to:'1960'}),
 ];
 const filter={...api.OPEN_PLACE_FILTER,window:{from:'1945',to:null}};
 const admitted=api.filteredFacets(reading(facets),filter);
 assert.deepEqual(admitted.map(f=>f.place_ref),['b']);
});

test('an unlocated place stays unlocated through the filter — no coordinate manufactured',()=>{
 const facets=[facet({place_ref:'a',precision:'unlocated',geometry:undefined,relation:'LOCATED_IN'})];
 const admitted=api.filteredFacets(reading(facets),api.OPEN_PLACE_FILTER);
 assert.equal(admitted[0].precision,'unlocated');
 assert.equal(admitted[0].geometry,undefined);
});

test('the filtered repository narrows getLocatedNodes to exactly the admitted place refs',async()=>{
 const facets=[facet({place_ref:'a',relation:'OCCURRED_AT'}),facet({place_ref:'b',relation:'MYTH_LOCATED_AT'})];
 let requestedScope=null;
 const base={
  async getLocatedNodes(scope){requestedScope=scope;return [{graphNodeId:'a'},{graphNodeId:'b'},{graphNodeId:'unrelated'}];},
  async getGeographyEdges(){return [];},
  async getArchetypeExpressionsForPlace(){return [];},
  async getRelatedNodesForPlace(){return [];},
 };
 const filter={...api.OPEN_PLACE_FILTER,relations:new Set(['OCCURRED_AT'])};
 const wrapped=api.filteredPlacesRepository(base,reading(facets),filter);
 const nodes=await wrapped.getLocatedNodes('subject:pilgrim');
 assert.equal(requestedScope,'subject:pilgrim');
 assert.deepEqual(nodes.map(n=>n.graphNodeId).sort(),['a','unrelated'],'a located node the reading never names a facet for passes through; a named one the filter excludes does not');
});

test('toggling a filter value collapses back to "open" once every option is included again',()=>{
 const all=['OCCURRED_AT','LOCATED_IN'];
 let set=api.toggleFilterMembership(null,all,'OCCURRED_AT');
 assert.deepEqual([...set],['LOCATED_IN']);
 set=api.toggleFilterMembership(set,all,'OCCURRED_AT');
 assert.equal(set,null,'every option included again reads as open, not as an explicit full set');
});

test('subjectEntityRef resolves the reading\'s own subject and only that subject',()=>{
 const entities={
  'entity:1':{subject:{subject_ref:'subject:other'}},
  'entity:2':{subject:{subject_ref:'subject:pilgrim'}},
  'entity:3':{},
 };
 assert.equal(api.subjectEntityRef(entities,'subject:pilgrim'),'entity:2');
 assert.equal(api.subjectEntityRef(entities,'subject:absent'),null);
 assert.equal(api.subjectEntityRef(undefined,'subject:pilgrim'),null);
});
