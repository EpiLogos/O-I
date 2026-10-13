/** Places tours — lane-4 T25 (recorded camera waypoints with holds and captions, played as map flights) and T26 (a stop
 * carries an optional journey binding as refs; the journey's own read decides whether that binding still holds).
 *
 * Pure proof through the esbuild-in-tmp pattern of `places-views.test.mjs`, plus source reads of the map's flight seam
 * and the vendor provenance record.
 *
 * Covers: capture of a stop is exact (longitude/latitude as x/y, zoom, pitch, bearing), and a three-stop tour survives a
 * JSON round trip with the same waypoints, holds and captions in order; a recorded stop carries no temporal, route or
 * dated-place field (the closed key set refuses one); the bounds and name rules refuse by name; the playback timeline is
 * the stops in order with flights and holds, and reduced motion removes the flight time without dropping a stop; a
 * stop's binding is a pair of refs read from the journey's own beats (beats() over a reading), absent bindings leave no
 * key behind, and deleting the beat leaves the stop byte-identical and unbound; the map exposes the flight seam and its
 * provenance record matches the vendored file. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const canvasDir=resolve(engine,'../vendor/research-canvas/packages/canvas/src/psychogeographic');
const vendorRoot=resolve(engine,'../vendor/research-canvas');
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-tour-'));
 try{
  const out=join(temporary,'places-tour.mjs');
  const entries={
   tours:resolve(engine,'src/placeTours.ts'),
   beats:resolve(engine,'../../src/techne/m0m5/journey/beats.ts'),
   navigation:resolve(canvasDir,'placeNavigation.ts'),
  };
  const contents=Object.entries(entries).map(([name,file])=>`export * as ${name} from ${JSON.stringify(file)};`).join('\n');
  await build({stdin:{contents,resolveDir:engine},tsconfig:engine+'/tsconfig.json',bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning'});
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const roundTrip=(value)=>JSON.parse(JSON.stringify(value));
const paris={latitude:48.85,longitude:2.35,zoom:11,pitch:40,bearing:-20};
const lyon={latitude:45.76,longitude:4.84,zoom:12.5};
const rome={latitude:41.9,longitude:12.5,zoom:9,pitch:0,bearing:0};

/** A three-stop tour: one stop bound to a journey beat, one with a place ref, one bare. */
function threeStopTour(){
 let tour={stops:[]};
 tour=api.tours.appendTourStop(tour,api.tours.captureTourStop({viewState:paris,placeRef:'place:paris',caption:'Arrive by the river',holdMs:4000})).record;
 tour=api.tours.appendTourStop(tour,api.tours.captureTourStop({viewState:lyon,placeRef:null,caption:'The confluence',holdMs:2500})).record;
 tour=api.tours.appendTourStop(tour,api.tours.captureTourStop({viewState:rome,placeRef:null,caption:null,holdMs:0})).record;
 return tour;
}

/** A reading with one scene-bearing expression binding: the journey's own read (beats) derives the beat from it. */
function readingWithBeat(sceneRef=`oi.expression:expr:1:scene:arrival`){
 return {
  subject:{subject_ref:'subject:pilgrim'},
  temporal:[],spatial:[],provenance:[],
  expressions:[{expression_ref:'expr:1',revision:'2',scene_ref:sceneRef}],
  disclosure:{instruments:[]},
 };
}

test('capture is exact: longitude and latitude as x and y, with zoom, pitch and bearing', () => {
 const stop=api.tours.captureTourStop({viewState:paris,placeRef:'place:paris',caption:'Arrive by the river',holdMs:4000});
 assert.deepEqual(stop,{place_ref:'place:paris',viewport:{x:2.35,y:48.85,zoom:11,pitch:40,bearing:-20},caption:'Arrive by the river',hold_ms:4000});
 assert.equal(api.tours.placeTourProblem({stops:[stop]}),null);
});

test('a three-stop tour survives a JSON round trip with the same waypoints, holds and captions in order', () => {
 const tour=threeStopTour();
 assert.equal(api.tours.placeTourProblem(tour),null);
 const replayed=roundTrip(tour);
 assert.deepEqual(replayed,tour);
 const {steps}=api.tours.placeTourSteps(replayed);
 assert.deepEqual(steps.map(step=>step.index),[0,1,2]);
 assert.deepEqual(steps.map(step=>step.holdMs),[4000,2500,0]);
 assert.deepEqual(steps.map(step=>step.caption),['Arrive by the river','The confluence',null]);
 assert.deepEqual(steps.map(step=>step.camera),[
  {latitude:48.85,longitude:2.35,zoom:11,pitch:40,bearing:-20},
  {latitude:45.76,longitude:4.84,zoom:12.5,pitch:0,bearing:0},
  {latitude:41.9,longitude:12.5,zoom:9,pitch:0,bearing:0},
 ]);
});

test('a recorded stop carries no temporal, route or dated-place claim: the closed key set refuses one', () => {
 const stop=api.tours.captureTourStop({viewState:paris,placeRef:null,caption:null,holdMs:0});
 assert.deepEqual(Object.keys(stop).sort(),['caption','hold_ms','place_ref','viewport']);
 for (const extra of ['window','time_window','route_id','temporal','validity','occurred_at']) {
  const problem=api.tours.placeTourProblem({stops:[{...stop,[extra]:{from:'1800',to:'1900'}}]});
  assert.ok(problem,`a stop carrying ${extra} is refused`);
 }
});

test('bounds and names refuse by name', () => {
 const stop=api.tours.captureTourStop({viewState:paris,placeRef:null,caption:'ok',holdMs:1000});
 assert.match(api.tours.placeTourProblem({stops:[{...stop,caption:'x'.repeat(api.tours.TOUR_CAPTION_MAX+1)}]}),/caption/i);
 assert.match(api.tours.placeTourProblem({stops:[{...stop,hold_ms:-1}]}),/hold/i);
 assert.match(api.tours.placeTourProblem({stops:[{...stop,hold_ms:api.tours.TOUR_HOLD_MAX_MS+1}]}),/hold/i);
 assert.match(api.tours.placeTourProblem({stops:[{...stop,viewport:{x:2,y:48,zoom:0}}]}),/viewport|zoom/i);
 assert.match(api.tours.placeTourProblem({stops:[{...stop,place_ref:''}]}),/place/i);
 assert.match(api.tours.placeTourProblem({stops:new Array(api.tours.TOUR_STOP_LIMIT+1).fill(stop)}),/stops/i);
 assert.equal(api.tours.placeTourProblem({stops:[]}),'A tour needs at least one stop.');
 assert.match(api.tours.placeTourNameProblem('  ',{}),/name/i);
 assert.match(api.tours.placeTourNameProblem('constructor',{}),/reserved/i);
 const full=Object.fromEntries(Array.from({length:api.tours.TOUR_LIMIT},(_,i)=>[`t${i}`,{}]));
 assert.match(api.tours.placeTourNameProblem('one more',full),/at most/i);
 assert.equal(api.tours.placeTourNameProblem('t0',full),null,'re-saving an existing name is not a new tour');
});

test('the playback timeline runs the stops in order: flight, then hold; reduced motion keeps every stop and drops the flight', () => {
 const tour=threeStopTour();
 const {steps,totalMs}=api.tours.placeTourSteps(tour);
 assert.equal(steps[0].startMs,0);
 for (const step of steps) {
  assert.equal(step.arriveMs-step.startMs,api.tours.TOUR_FLIGHT_MS);
  assert.equal(step.endMs,step.arriveMs+step.holdMs);
 }
 for (let i=1;i<steps.length;i++) assert.equal(steps[i].startMs,steps[i-1].endMs);
 assert.equal(totalMs,steps[steps.length-1].endMs);
 const still=api.tours.placeTourSteps(tour,{reducedMotion:true});
 assert.equal(still.steps.length,3);
 assert.deepEqual(still.steps.map(step=>step.holdMs),[4000,2500,0]);
 assert.ok(still.steps.every(step=>step.arriveMs===step.startMs));
});

test('a binding is a pair of refs read from the journey beat; a bound stop lists its ref in the tour', () => {
 const beats=api.beats.beats(readingWithBeat()).beats;
 assert.equal(beats.length,1);
 let tour=threeStopTour();
 tour=api.tours.withStopBinding(tour,1,{expression_ref:beats[0].expression_ref,scene_ref:beats[0].scene_ref});
 assert.deepEqual(tour.stops[1].binding,{expression_ref:'expr:1',scene_ref:'oi.expression:expr:1:scene:arrival'});
 const states=api.tours.resolveTourBindings(tour,beats);
 assert.equal(states[0].state,'none');
 assert.equal(states[1].state,'bound');
 assert.equal(states[1].binding.scene_ref,'oi.expression:expr:1:scene:arrival');
 assert.equal(states[2].state,'none');
 assert.equal(api.tours.placeTourProblem(tour),null);
});

test('deleting the journey beat leaves the stop intact and unbound, with no shadow record left behind', () => {
 const beats=api.beats.beats(readingWithBeat()).beats;
 const bound=api.tours.withStopBinding(threeStopTour(),1,{expression_ref:'expr:1',scene_ref:beats[0].scene_ref});
 const before=roundTrip(bound);
 const journeyAfterDelete=api.beats.beats({...readingWithBeat(),expressions:[]}).beats;
 const states=api.tours.resolveTourBindings(bound,journeyAfterDelete);
 assert.equal(states[1].state,'unbound');
 assert.match(states[1].reason,/no longer/i);
 assert.deepEqual(bound,before,'the tour is not mutated by the journey reading');
 const unbound=api.tours.withStopBinding(bound,1,null);
 assert.equal('binding' in unbound.stops[1],false,'an unbound stop keeps no binding key');
 assert.deepEqual(unbound.stops[1],threeStopTour().stops[1]);
 assert.equal(api.tours.placeTourProblem(unbound),null);
});

test('the journey read is the only binding source: a scene the reading does not carry resolves unbound', () => {
 const bound=api.tours.withStopBinding(threeStopTour(),0,{expression_ref:'expr:9',scene_ref:'oi.expression:expr:9:scene:elsewhere'});
 const states=api.tours.resolveTourBindings(bound,api.beats.beats(readingWithBeat()).beats);
 assert.equal(states[0].state,'unbound');
});

test('the map exposes a tour flight seam and the vendored file is recorded with an explicit provenance update', () => {
 const map=readFileSync(resolve(canvasDir,'PsychogeographicMap.tsx'),'utf8');
 assert.match(map,/onRegisterPlaceFlight\?:/);
 const out=execFileSync(process.execPath,[resolve(vendorRoot,'verify-source.mjs')],{encoding:'utf8'});
 assert.match(out,/Verified \d+ Research Canvas files/);
});

test('the tour seam is additive: the existing view restore and flight call stay as they were', async() => {
 const map=await readFile(resolve(canvasDir,'PsychogeographicMap.tsx'),'utf8');
 assert.match(map,/onRegisterPlaceViewRestore\?:/);
 assert.match(map,/const placeViewRestoreRef/);
 assert.match(map,/VIEW_FLIGHT_MS,\s*easing: flightEase/);
});
