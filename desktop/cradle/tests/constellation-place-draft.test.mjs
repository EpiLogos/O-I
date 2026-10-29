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

// Lane-4 T17c: the route is keyed by its subject, expires, and is consumed only after the owner's read of that subject.
// Every clock is passed explicitly so the proof does not depend on wall time.
const T0=1_000_000;
const TTL=10*60*1000;
const DRAFT={lat:LONDON.lat,lon:LONDON.lon,precision:'approximate'};

test('a route is offered for one subject; a plain open carries no draft', ()=>{
 api.offerConstellationRoute('wiki:frame:one',DRAFT,T0);
 assert.deepEqual(api.peekConstellationRoute('wiki:frame:one',T0).draft,DRAFT);
 api.offerConstellationRoute('wiki:frame:two',undefined,T0);
 assert.equal(api.peekConstellationRoute('wiki:frame:two',T0).draft,undefined);
 api.dropConstellationRoute('wiki:frame:one');
 api.dropConstellationRoute('wiki:frame:two');
});

test('a route expires ten minutes after it was offered and an expired route is released, not revived', ()=>{
 assert.equal(api.CONSTELLATION_ROUTE_TTL_MS,TTL);
 api.offerConstellationRoute('wiki:frame:expiry',DRAFT,T0);
 assert.ok(api.peekConstellationRoute('wiki:frame:expiry',T0+TTL));
 assert.equal(api.peekConstellationRoute('wiki:frame:expiry',T0+TTL+1),undefined);
 // Once released, an earlier clock cannot bring the draft back.
 assert.equal(api.peekConstellationRoute('wiki:frame:expiry',T0),undefined);
 assert.equal(api.routeReadFor('wiki:frame:expiry','wiki:frame:expiry',T0),undefined);
});

test('a failed read keeps the route and its draft for the retry; only a successful read consumes it', ()=>{
 const subject='wiki:frame:retry';
 api.offerConstellationRoute(subject,DRAFT,T0);
 // The first read fails: the editor reaches no consume, so the route is untouched.
 assert.deepEqual(api.routeReadFor(subject,subject,T0+1000).draft,DRAFT);
 // The retry reads the same subject and still finds the draft.
 assert.deepEqual(api.routeReadFor(subject,subject,T0+2000).draft,DRAFT);
 api.consumeConstellationRoute(subject);
 assert.equal(api.routeReadFor(subject,subject,T0+3000),undefined);
});

test('a draft never applies to a different subject than the one it was opened for', ()=>{
 api.offerConstellationRoute('wiki:frame:mine',DRAFT,T0);
 // A read of another constellation, or of a node, takes nothing and consumes nothing.
 assert.equal(api.routeReadFor('wiki:frame:mine','wiki:frame:other',T0),undefined);
 assert.equal(api.peekConstellationRoute('wiki:frame:other',T0),undefined);
 assert.deepEqual(api.peekConstellationRoute('wiki:frame:mine',T0).draft,DRAFT);
 assert.deepEqual(api.routeReadFor('wiki:frame:mine','wiki:frame:mine',T0).draft,DRAFT);
 api.dropConstellationRoute('wiki:frame:mine');
});

test('a subject that leaves releases its unconsumed route', ()=>{
 api.offerConstellationRoute('wiki:frame:leave',DRAFT,T0);
 api.dropConstellationRoute('wiki:frame:leave');
 assert.equal(api.routeReadFor('wiki:frame:leave','wiki:frame:leave',T0),undefined);
});

test('a routed save answers the map exactly once, whatever the owner or the local confirm does', async()=>{
 const answers=[],failures=[];
 const realWindow=globalThis.window;
 globalThis.window={dispatchEvent:event=>{if(event.type==='oi:constellation-result')answers.push(event.detail);return true;}};
 const route={frame_ref:'wiki:frame:save',place_ref:PLACE};
 const basis={target:{ref:'wiki:frame:save'}};
 try{
  // The owner saves.
  await api.settleRoutedSave(route,async()=>basis,()=>{},reason=>failures.push(reason));
  // The owner refuses (for example, no source basis).
  await api.settleRoutedSave(route,async()=>{throw new Error('Choose and read an evidence source');},()=>{},reason=>failures.push(reason));
  // The owner saves, then the local confirm fails: one saved answer, and the failure stays local.
  await api.settleRoutedSave(route,async()=>basis,()=>{throw new Error('confirm failed');},reason=>failures.push(reason));
  // No route was offered: nothing is answered.
  await api.settleRoutedSave(undefined,async()=>basis,()=>{},()=>{});
 } finally {
  if(realWindow===undefined)delete globalThis.window;else globalThis.window=realWindow;
 }
 assert.deepEqual(answers,[
  {target:route,kind:'saved'},
  {target:route,kind:'refused',reason:'Choose and read an evidence source'},
  {target:route,kind:'saved'},
 ]);
 assert.deepEqual(failures,['Choose and read an evidence source','confirm failed']);
});

// O-I #746: a route is placed stop by stop. The map's draft of a stop carries the relation it is a stop of and its place in the order, and the
// editor writes both onto the new place fact, so the owner's PlaceSet holds the stop in its route. The editor reads the subject's own facts at
// the revision it read: a place in the order those facts already hold goes to the next free one, after the route's last stop.
test('a route draft is a stop: the editor writes its relation and its place in the order, after the stops the subject holds', ()=>{
 const held={temporal:[],places:[
  {place_ref:'wiki:place:a',precision:'approximate',geometry:{type:'point',coordinates:[1,1]},relation:'TRAVELLED_TO',sequence:1,source_ref:BASIS},
  {place_ref:'wiki:place:b',precision:'approximate',geometry:{type:'point',coordinates:[2,2]},relation:'TRAVELLED_TO',sequence:2,source_ref:BASIS},
 ]};
 const seeded=api.applyPlaceDraft(held,{lat:3,lon:4,precision:'approximate',name:'Syracuse',relation:'TRAVELLED_TO',sequence:3});
 const fact=seeded.values.places[2];
 assert.deepEqual([fact.relation,fact.sequence],['TRAVELLED_TO',3]);
 assert.deepEqual(fact.geometry,{type:'point',coordinates:[4,3]});
 assert.match(seeded.notice,/stop 3 of its TRAVELLED_TO route/);
 const stale=api.applyPlaceDraft(held,{lat:3,lon:4,precision:'approximate',relation:'TRAVELLED_TO',sequence:2});
 assert.equal(stale.values.places[2].sequence,3,'a place in the order already held goes after the last stop');
 const first=api.applyPlaceDraft(emptyValues(),{lat:3,lon:4,precision:'approximate',relation:'TRAVELLED_TO'});
 assert.equal(first.values.places[0].sequence,1,'the first stop of a route is stop 1');
 const sourced={...seeded.values,places:seeded.values.places.map(row=>({...row,source_ref:BASIS}))};
 const [change]=api.factsChanges(held,sourced);
 assert.equal(change.change,'place_set');
 assert.deepEqual([change.places[2].relation,change.places[2].sequence],['TRAVELLED_TO',3],'the save carries the stop in its route');
 const plain=api.applyPlaceDraft(emptyValues(),{lat:3,lon:4,precision:'approximate'});
 assert.ok(!('relation' in plain.values.places[0])&&!('sequence' in plain.values.places[0]),'a place draft is no stop');
});
