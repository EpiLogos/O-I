/** Places navigation — T1 (pitch and bearing), T2 (flyToPlace), T10 (the
 * precision grammar on the live globe). Pure proof, no DOM, no maplibre.
 *
 * Loads `vendor/research-canvas/packages/canvas/src/psychogeographic/placeNavigation.ts`
 * and the cradle authority `desktop/cradle/src/techne/m0m5/place/project.ts`
 * (`precisionMarker`) through the same esbuild-in-tmp pattern as
 * `place-reading.test.mjs`. The expectations read `precisionMarker` itself, so
 * the vocabulary is never re-declared in this test.
 *
 * Covers: zoom band per precision class; four distinct marker renderings from
 * the authority's kind; unlocated never drawn and never at (0,0); the flight
 * plan (unlocated does not fly, the register is named); the easing and the
 * duration by distance; a saved viewport that round-trips pitch and bearing and
 * reads pre-T1 records as untilted.
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
let authority;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-navigation-'));
 try{
  const nav=resolve(engine,'../vendor/research-canvas/packages/canvas/src/psychogeographic/placeNavigation.ts');
  const project=resolve(engine,'../../src/techne/m0m5/place/project.ts');
  const out=join(temporary,'places-navigation.mjs');
  await build({
   stdin:{
    contents:`export * from ${JSON.stringify(nav)};\nexport {precisionMarker} from ${JSON.stringify(project)};`,
    resolveDir:engine,
   },
   tsconfig:engine+'/tsconfig.json',
   bundle:true,
   platform:'node',
   format:'esm',
   outfile:out,
   logLevel:'warning',
  });
  api=await import(pathToFileURL(out));
  authority=api.precisionMarker;
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const PRECISIONS=['exact','approximate','region','unlocated'];
const LONDON={latitude:51.5074,longitude:-0.1278};
const PARIS={latitude:48.8566,longitude:2.3522};
const TOKYO={latitude:35.6762,longitude:139.6503};

// ---------------------------------------------------------------------------
// T10 — the precision grammar on the globe
// ---------------------------------------------------------------------------

test('each precision class reads its marker kind from the cradle authority', ()=>{
 for(const precision of PRECISIONS){
  assert.equal(api.markerStyleForPrecision(precision).kind,authority(precision).kind,precision);
 }
});

test('the four precisions have four distinct renderings', ()=>{
 const kinds=new Set(PRECISIONS.map(p=>api.markerStyleForPrecision(p).kind));
 assert.equal(kinds.size,4);
 assert.deepEqual([...kinds].sort(),['halo','no-coordinate','outline','solid']);
 const drawn=PRECISIONS.filter(p=>api.markerStyleForPrecision(p).drawn);
 assert.deepEqual(drawn,['exact','approximate','region']);
 const solid=api.markerStyleForPrecision('exact');
 const halo=api.markerStyleForPrecision('approximate');
 const outline=api.markerStyleForPrecision('region');
 assert.match(halo.background,/radial-gradient/);
 assert.match(outline.border,/dashed/);
 assert.notEqual(solid.background,halo.background);
 assert.notEqual(solid.border,outline.border);
 assert.notEqual(halo.diameterPx,solid.diameterPx);
});

test('an exact fix is solid and certain; every uncertain class carries the authority note verbatim', ()=>{
 const exact=api.markerStyleForPrecision('exact');
 assert.equal(exact.uncertainty,false);
 assert.equal(exact.note,authority('exact').note);
 for(const precision of ['approximate','region','unlocated']){
  const style=api.markerStyleForPrecision(precision);
  assert.equal(style.uncertainty,true,precision);
  assert.equal(style.note,authority(precision).note,precision);
 }
});

test('an unlocated place is never drawn, not even at (0,0)', ()=>{
 assert.equal(api.placeMarkerPlan({precision:'unlocated',latitude:0,longitude:0}),null);
 assert.equal(api.placeMarkerPlan({precision:'unlocated',latitude:12.5,longitude:41.9}),null);
 assert.equal(api.markerStyleForPrecision('unlocated').drawn,false);
});

test('a real point at (0,0) is still drawn for an exact fix: only the unlocated class is withheld', ()=>{
 const plan=api.placeMarkerPlan({precision:'exact',latitude:0,longitude:0});
 assert.ok(plan);
 assert.equal(plan.style.kind,'solid');
 assert.equal(plan.latitude,0);
 assert.equal(plan.longitude,0);
});

test('a drawable class with a non-finite or out-of-range coordinate has no plan', ()=>{
 assert.equal(api.placeMarkerPlan({precision:'exact',latitude:Number.NaN,longitude:0}),null);
 assert.equal(api.placeMarkerPlan({precision:'approximate',latitude:10,longitude:200}),null);
 assert.equal(api.placeMarkerPlan({precision:'region',latitude:undefined,longitude:0}),null);
});

test('an undisclosed precision is not drawn and says so', ()=>{
 const style=api.markerStyleForPrecision('guessed');
 assert.equal(style.drawn,false);
 assert.equal(style.uncertainty,true);
 assert.equal(api.placeMarkerPlan({precision:'guessed',latitude:1,longitude:1}),null);
});

// ---------------------------------------------------------------------------
// T2 — flyToPlace: zoom by precision, eased flight, duration by distance
// ---------------------------------------------------------------------------

test('zoom lands in the documented band for each precision class', ()=>{
 const exact=api.flightZoomForPrecision('exact');
 const approximate=api.flightZoomForPrecision('approximate');
 const region=api.flightZoomForPrecision('region');
 assert.ok(exact>=15&&exact<=17,`exact street band, got ${exact}`);
 assert.ok(approximate>=10&&approximate<=12,`approximate city band, got ${approximate}`);
 assert.ok(region>=3&&region<=5,`region continent frame, got ${region}`);
 assert.equal(api.flightZoomForPrecision('unlocated'),null);
 assert.ok(exact>approximate&&approximate>region,'closer precision flies closer');
});

test('an unlocated place does not fly and the plan names it for the register', ()=>{
 const plan=api.planPlaceFlight({precision:'unlocated',title:'Lost Harbour',point:null,from:LONDON});
 assert.equal(plan.flies,false);
 assert.equal(plan.reason,'unlocated');
 assert.match(plan.note,/Lost Harbour/);
 assert.match(plan.note,/no coordinate disclosed/);
 assert.match(plan.note,/no-coordinate register/);
 assert.equal('latitude' in plan,false);
});

test('an exact place flies to its own point at street zoom with the shared easing', ()=>{
 const plan=api.planPlaceFlight({precision:'exact',title:'Rome',point:{latitude:41.9028,longitude:12.4964},from:LONDON});
 assert.equal(plan.flies,true);
 assert.equal(plan.kind,'solid');
 assert.equal(plan.zoom,api.flightZoomForPrecision('exact'));
 assert.equal(plan.latitude,41.9028);
 assert.equal(plan.longitude,12.4964);
 assert.equal(plan.easing,api.flightEase);
});

test('a region with no point to fly to is named, not flown to a guessed point', ()=>{
 const plan=api.planPlaceFlight({precision:'region',title:'The Steppe',point:null,from:LONDON});
 assert.equal(plan.flies,false);
 assert.equal(plan.reason,'no-point');
});

test('the flight easing is the cubic in-out the Canvas transitions use', ()=>{
 assert.equal(api.flightEase(0),0);
 assert.equal(api.flightEase(1),1);
 assert.equal(api.flightEase(0.5),0.5);
 assert.ok(Math.abs(api.flightEase(0.25)-0.0625)<1e-12);
 assert.ok(Math.abs(api.flightEase(0.75)-0.9375)<1e-12);
 let previous=-1;
 for(let i=0;i<=20;i++){const v=api.flightEase(i/20);assert.ok(v>=previous);previous=v;}
});

test('flight duration grows with the angle travelled and stays within its bounds', ()=>{
 const short=api.angularDistanceDegrees(LONDON,PARIS);
 const long=api.angularDistanceDegrees(LONDON,TOKYO);
 assert.ok(short<long);
 assert.ok(api.flightDurationMs(short)<api.flightDurationMs(long));
 assert.equal(api.flightDurationMs(0),900);
 assert.equal(api.flightDurationMs(180),3600);
 assert.equal(api.flightDurationMs(10000),3600);
 assert.equal(api.flightDurationMs(Number.NaN),900);
});

test('great-circle distance is zero to itself and 180 degrees to its antipode', ()=>{
 assert.ok(Math.abs(api.angularDistanceDegrees(LONDON,LONDON))<1e-9);
 assert.ok(Math.abs(api.angularDistanceDegrees({latitude:0,longitude:0},{latitude:0,longitude:180})-180)<1e-6);
});

// ---------------------------------------------------------------------------
// T1 — pitch and bearing: defaults, clamps, and the saved viewport record
// ---------------------------------------------------------------------------

test('a record saved before T1 reads as untilted, with pitch and bearing 0', ()=>{
 const state=api.viewStateFromPlaceRecord({x:12.5,y:41.9,zoom:9});
 assert.deepEqual(state,{latitude:41.9,longitude:12.5,zoom:9,pitch:0,bearing:0});
});

test('an untilted view writes exactly the legacy record shape, with no pitch or bearing keys', ()=>{
 const record=api.placeRecordFromViewState({latitude:41.9,longitude:12.5,zoom:9,pitch:0,bearing:0});
 assert.deepEqual(record,{x:12.5,y:41.9,zoom:9});
 assert.equal('pitch' in record,false);
 assert.equal('bearing' in record,false);
 const legacy=api.placeRecordFromViewState({latitude:41.9,longitude:12.5,zoom:9});
 assert.deepEqual(legacy,{x:12.5,y:41.9,zoom:9});
});

test('a tilted and rotated view round-trips latitude, longitude, zoom, pitch and bearing', ()=>{
 const before={latitude:-33.8688,longitude:151.2093,zoom:6.5,pitch:42,bearing:-27};
 const record=api.placeRecordFromViewState(before);
 assert.deepEqual(record,{x:151.2093,y:-33.8688,zoom:6.5,pitch:42,bearing:-27});
 assert.deepEqual(api.viewStateFromPlaceRecord(record),before);
});

test('pitch is clamped to 0..85 and bearing wraps into [-180, 180); bad values read as 0', ()=>{
 assert.equal(api.clampPitch(120),api.PITCH_MAX);
 assert.equal(api.PITCH_MAX,85);
 assert.equal(api.clampPitch(-5),0);
 assert.equal(api.clampPitch(Number.NaN),0);
 assert.equal(api.clampPitch(undefined),0);
 assert.equal(api.normalizeBearing(370),10);
 assert.equal(api.normalizeBearing(-190),170);
 assert.equal(api.normalizeBearing(180),-180);
 assert.equal(api.normalizeBearing(Number.POSITIVE_INFINITY),0);
});

test('an older view state object gains pitch and bearing defaults and keeps its place', ()=>{
 const state=api.withCameraDefaults({latitude:48.8566,longitude:2.3522,zoom:11});
 assert.deepEqual(state,{latitude:48.8566,longitude:2.3522,zoom:11,pitch:0,bearing:0});
});

test('a record without a finite longitude, latitude and zoom is not a viewport', ()=>{
 assert.equal(api.viewStateFromPlaceRecord(null),null);
 assert.equal(api.viewStateFromPlaceRecord({x:1,y:2}),null);
 assert.equal(api.viewStateFromPlaceRecord({x:1,y:Number.NaN,zoom:3}),null);
});
