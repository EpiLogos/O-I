/** Lane-4 T17b — the map's placemark draft seeds the owner's time/place editor
 * as a draft. Pure proof: the editor module is bundled with esbuild (its CSS
 * import stubbed); no DOM, no kernel. A draft is never a write: the source
 * basis stays empty and required, and the draft is offered once per open. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(root,'package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-constellation-draft-'));
 try{
  const out=join(temporary,'constellation-place-draft.mjs');
  await build({
   stdin:{
    contents:`export * from ${JSON.stringify(resolve(root,'src/knowledge/WikiFactsEditor.tsx'))};\nexport {factsChanges,prepareFacts} from ${JSON.stringify(resolve(root,'src/knowledge/wikiFacts.ts'))};`,
    resolveDir:root,
    loader:'ts',
   },
   tsconfig:join(root,'tsconfig.json'),
   bundle:true,
   platform:'node',
   format:'esm',
   jsx:'automatic',
   outfile:out,
   loader:{'.css':'empty'},
   logLevel:'warning',
  });
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const LONDON={lat:51.5074,lon:-0.1278};
const MOVED={lat:51.5101,lon:-0.0921};
const PLACE='wiki:place:london';
const BASIS='wiki:source:survey-london';

const emptyValues=()=>({temporal:[],places:[]});
const survey=()=>({
 temporal:[],
 places:[{place_ref:PLACE,precision:'approximate',identity:{names:[{name:'London survey point'}]},geometry:{type:'point',coordinates:[LONDON.lon,LONDON.lat]},source_ref:BASIS}],
});

test('a click draft seeds a new approximate point with no source basis', ()=>{
 const seeded=api.applyPlaceDraft(emptyValues(),{lat:LONDON.lat,lon:LONDON.lon,precision:'approximate'});
 assert.equal(seeded.values.places.length,1);
 const fact=seeded.values.places[0];
 assert.deepEqual(fact.geometry,{type:'point',coordinates:[LONDON.lon,LONDON.lat]});
 assert.equal(fact.precision,'approximate');
 assert.equal(fact.source_ref,undefined);
 assert.match(seeded.notice,/^Draft from the map: approximate point at 51\.50740, -0\.12780\. Not saved\./);
});

test('the seeded draft still requires a source basis before any save is prepared', ()=>{
 const seeded=api.applyPlaceDraft(emptyValues(),{lat:LONDON.lat,lon:LONDON.lon,precision:'approximate'});
 assert.throws(()=>api.factsChanges({temporal:[],places:[]},seeded.values),/Choose and read an evidence source for each fact/);
});

test('a drag draft moves the named place, keeps its precision, and clears its old basis', ()=>{
 const before=survey();
 const seeded=api.applyPlaceDraft(before,{lat:MOVED.lat,lon:MOVED.lon,precision:'approximate',from:LONDON,place_ref:PLACE});
 const fact=seeded.values.places[0];
 assert.equal(seeded.values.places.length,1);
 assert.equal(fact.place_ref,PLACE);
 assert.deepEqual(fact.geometry,{type:'point',coordinates:[MOVED.lon,MOVED.lat]});
 assert.equal(fact.precision,'approximate');
 assert.equal(fact.source_ref,undefined);
 assert.match(seeded.notice,/moved from 51\.50740, -0\.12780/);
 // The saved values the editor was read from are never mutated by a draft.
 assert.equal(before.places[0].source_ref,BASIS);
 assert.deepEqual(before.places[0].geometry.coordinates,[LONDON.lon,LONDON.lat]);
 assert.throws(()=>api.factsChanges(survey(),seeded.values),/Choose and read an evidence source/);
});

test('a drag of a region keeps its polygon and drafts nothing', ()=>{
 const values={temporal:[],places:[{place_ref:PLACE,precision:'region',geometry:{type:'polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]},source_ref:BASIS}]};
 const seeded=api.applyPlaceDraft(values,{lat:MOVED.lat,lon:MOVED.lon,precision:'region',from:LONDON,place_ref:PLACE});
 assert.deepEqual(seeded.values,values);
 assert.match(seeded.notice,/keeps its polygon/);
});

test('a move for a place this constellation does not hold drafts nothing', ()=>{
 const values=emptyValues();
 const seeded=api.applyPlaceDraft(values,{lat:MOVED.lat,lon:MOVED.lon,precision:'approximate',from:LONDON,place_ref:PLACE});
 assert.deepEqual(seeded.values,values);
 assert.match(seeded.notice,/not in this constellation/);
});

test('a constellation route carries the map draft once, and a plain open carries no draft', ()=>{
 const draft={lat:LONDON.lat,lon:LONDON.lon,precision:'approximate'};
 api.offerConstellationRoute('wiki:frame:one',draft);
 assert.deepEqual(api.takeConstellationRoute('wiki:frame:one'),{draft});
 assert.equal(api.takeConstellationRoute('wiki:frame:one'),undefined);
 api.offerConstellationRoute('wiki:frame:two');
 assert.deepEqual(api.takeConstellationRoute('wiki:frame:two'),{draft:undefined});
 assert.equal(api.takeConstellationRoute('wiki:frame:two'),undefined);
});
