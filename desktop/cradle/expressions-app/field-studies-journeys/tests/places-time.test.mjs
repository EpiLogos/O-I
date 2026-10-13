/** Places time on the globe — lane-4 T14 (the docked time window), T15 (playback), T16 (imagery honesty), and
 * T17c (an owner's refused route returns its marker inside the map). Pure proof, no DOM, no maplibre, no kernel.
 *
 * Loads `vendor/research-canvas/packages/canvas/src/psychogeographic/placeTimeControl.ts` and `placeAuthoring.ts`,
 * the place filter (`src/techne/m0m5/place/filter.ts`) and the timeline label authority (`timeline/labels.ts`)
 * through the same esbuild-in-tmp pattern as `places-navigation.test.mjs`. Expectations read the authorities
 * themselves (`spanLabel`, `coversWindow`, `nameInWindow`), so no vocabulary is re-declared here.
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
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-time-'));
 try{
  const control=resolve(engine,'../vendor/research-canvas/packages/canvas/src/psychogeographic/placeTimeControl.ts');
  const authoring=resolve(engine,'../vendor/research-canvas/packages/canvas/src/psychogeographic/placeAuthoring.ts');
  const filter=resolve(engine,'../../src/techne/m0m5/place/filter.ts');
  const labels=resolve(engine,'../vendor/research-canvas/packages/canvas/src/timeline/labels.ts');
  const out=join(temporary,'places-time.mjs');
  await build({
   stdin:{
    contents:[
     `export * from ${JSON.stringify(control)};`,
     `export {placeRouteResultFor,constellationResultNotice} from ${JSON.stringify(authoring)};`,
     `export {coversWindow,nameInWindow,placesInWindow} from ${JSON.stringify(filter)};`,
     `export {spanLabel} from ${JSON.stringify(labels)};`,
    ].join('\n'),
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
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

// Fixtures: two dated periods with a gap between them, and one undated place.
const A_FROM='1800-01-01T00:00:00.000Z';
const A_TO='1850-12-31T23:59:59.999Z';
const B_FROM='1900-01-01T00:00:00.000Z';
const B_TO='1950-12-31T23:59:59.999Z';
const FACET_A={kind:'valid',interval:{from:A_FROM,to:A_TO}};
const FACET_B={kind:'valid',interval:{from:B_FROM,to:B_TO}};
const EXTENT={fromMs:Date.parse(A_FROM),toMs:Date.parse(B_TO)};
const DAY=86_400_000;

const PLACE_A={
 place_ref:'place:a',precision:'approximate',valid_from:A_FROM,valid_to:A_TO,
 identity:{names:[
  {name:'Old Harbour',valid_from:'1800-01-01T00:00:00.000Z',valid_to:'1830-12-31T23:59:59.999Z'},
  {name:'New Harbour',valid_from:'1831-01-01T00:00:00.000Z',valid_to:null},
 ]},
};
const PLACE_B={place_ref:'place:b',precision:'exact',valid_from:B_FROM,valid_to:B_TO};
const PLACE_C={place_ref:'place:c',precision:'approximate'};

// ---------------------------------------------------------------------------
// T14 — the track is the reading's own dated extent, and the window is the shared one
// ---------------------------------------------------------------------------

test('T14: the extent is the dated events extent, and no dated material is an honest absence', () => {
 const extent=api.extentOf([FACET_A,FACET_B]);
 assert.deepEqual(extent.extent,EXTENT);
 assert.equal(extent.reason,null);
 const none=api.extentOf([{kind:'valid'}]);
 assert.equal(none.extent,null);
 assert.equal(none.reason,api.NO_DATED_REASON);
 assert.equal(api.extentOf([]).extent,null);
});

test('T14: the control is disabled and says why when there is nothing to move across', () => {
 const none=api.timeControlStatus({extent:null,reducedMotion:false});
 assert.equal(none.enabled,false);
 assert.equal(none.reason,api.NO_DATED_REASON);
 assert.equal(none.playable,false);
 const instant=api.timeControlStatus({extent:{fromMs:EXTENT.fromMs,toMs:EXTENT.fromMs},reducedMotion:false});
 assert.equal(instant.enabled,false);
 assert.equal(instant.reason,api.NO_SPAN_REASON);
 const unavailable=api.timeControlStatus({extent:EXTENT,unavailableReason:'Shared time is not available for this reading.',reducedMotion:false});
 assert.equal(unavailable.enabled,false);
 assert.equal(unavailable.reason,'Shared time is not available for this reading.');
 const live=api.timeControlStatus({extent:EXTENT,reducedMotion:false});
 assert.equal(live.enabled,true);
 assert.equal(live.reason,null);
 assert.equal(live.playable,true);
});

test('T14: an open shared window is the whole extent; bounds are the place filter expansions, clamped to the extent', () => {
 assert.deepEqual(api.spanOfWindow(EXTENT,null),EXTENT);
 assert.deepEqual(api.spanOfWindow(EXTENT,{from:null,to:null}),EXTENT);
 // A bare year is read as its span: from 1820 begins 1820-01-01; to 1840 ends 1840-12-31T23:59:59.999Z.
 const bounded=api.spanOfWindow(EXTENT,{from:'1820',to:'1840'});
 assert.equal(bounded.fromMs,Date.parse('1820-01-01T00:00:00.000Z'));
 assert.equal(bounded.toMs,Date.parse('1840-12-31T23:59:59.999Z'));
 const clamped=api.spanOfWindow(EXTENT,{from:'1700',to:'2000'});
 assert.deepEqual(clamped,EXTENT);
});

test('T14: a span written as the shared window reads back as the same span', () => {
 const span={fromMs:Date.parse('1820-03-01T00:00:00.000Z'),toMs:Date.parse('1842-07-09T12:00:00.000Z')};
 const window=api.windowOfSpan(span);
 assert.deepEqual(api.spanOfWindow(EXTENT,window),span);
 assert.equal(window.from,'1820-03-01T00:00:00.000Z');
});

test('T14: the window label and the track ends are the timeline authority’s span labels', () => {
 assert.equal(api.windowLabel(EXTENT,{from:'1820',to:'1840'}),api.spanLabel(Date.parse('1820-01-01T00:00:00.000Z'),Date.parse('1840-12-31T23:59:59.999Z'),0));
 assert.equal(api.windowLabel(EXTENT,{from:'1820',to:'1840'}),'1820 – 1840');
 const ends=api.extentEndLabels(EXTENT);
 assert.equal(ends.start,api.spanLabel(EXTENT.fromMs,EXTENT.fromMs,0));
 assert.equal(ends.end,api.spanLabel(EXTENT.toMs,EXTENT.toMs,0));
});

test('T14: the track position of a window is its share of the extent', () => {
 const span=api.spanOfWindow(EXTENT,{from:'1800',to:'1850'});
 const percent=api.trackPercent(EXTENT,span);
 const length=EXTENT.toMs-EXTENT.fromMs;
 assert.equal(percent.left,0);
 assert.ok(Math.abs(percent.width-((Date.parse(A_TO)-EXTENT.fromMs)/length)*100)<1e-9);
});

test('T14: dragging moves the body without changing its width, and a handle never crosses the other', () => {
 const span={fromMs:Date.parse('1820-01-01T00:00:00.000Z'),toMs:Date.parse('1840-12-31T23:59:59.999Z')};
 const width=span.toMs-span.fromMs;
 const body=api.dragSpan(EXTENT,span,'body',1e15);
 assert.equal(body.toMs,EXTENT.toMs);
 assert.equal(body.toMs-body.fromMs,width);
 const back=api.dragSpan(EXTENT,span,'body',-1e15);
 assert.equal(back.fromMs,EXTENT.fromMs);
 assert.equal(back.toMs-back.fromMs,width);
 const pastEnd=api.dragSpan(EXTENT,span,'from',1e15);
 assert.equal(pastEnd.fromMs,span.toMs);
 const beforeStart=api.dragSpan(EXTENT,span,'to',-1e15);
 assert.equal(beforeStart.toMs,span.fromMs);
 const outside=api.dragSpan(EXTENT,span,'to',1e15);
 assert.equal(outside.toMs,EXTENT.toMs);
 assert.equal(outside.fromMs,span.fromMs);
});

test('T14: a window that is moved away returns intact when it is moved back', () => {
 const span=api.spanOfWindow(EXTENT,{from:'1820',to:'1840'});
 const away=api.centreSpanOn(EXTENT,span,Date.parse('1930-06-01T00:00:00.000Z'));
 assert.notDeepEqual(away,span);
 const back=api.centreSpanOn(EXTENT,away,Date.parse('1830-06-01T00:00:00.000Z'));
 assert.equal(back.toMs-back.fromMs,span.toMs-span.fromMs);
});

test('T14: identity names swap at their own boundaries (the place filter’s nameInWindow, unchanged)', () => {
 const early=api.nameInWindow(PLACE_A,{from:'1820',to:'1820'});
 const late=api.nameInWindow(PLACE_A,{from:'1840',to:'1840'});
 assert.equal(early.name,'Old Harbour');
 assert.equal(late.name,'New Harbour');
});

// ---------------------------------------------------------------------------
// T15 — step, play, speed; the same filter law at every frame; reduced motion steps only
// ---------------------------------------------------------------------------

test('T15: one step moves the window by one window-width, and stops at either end', () => {
 const span=api.spanOfWindow(EXTENT,{from:'1820',to:'1840'});
 const width=span.toMs-span.fromMs;
 const forward=api.stepSpan(EXTENT,span,1);
 assert.equal(forward.moved,true);
 assert.equal(forward.span.toMs-forward.span.fromMs,width);
 assert.equal(forward.span.fromMs-span.fromMs,width);
 const atStart=api.spanOfWindow(EXTENT,{from:'1800',to:'1810'});
 assert.equal(api.stepSpan(EXTENT,atStart,-1).moved,false);
 const atEnd=api.spanOfWindow(EXTENT,{from:'1940',to:'1950'});
 assert.equal(api.stepSpan(EXTENT,atEnd,1).moved,false);
});

test('T15: an open window steps and plays from its first eighth of the extent', () => {
 const start=api.startSpanFor(EXTENT,null);
 assert.equal(start.fromMs,EXTENT.fromMs);
 assert.equal(start.toMs-start.fromMs,(EXTENT.toMs-EXTENT.fromMs)/8);
});

test('T15: speed is one window-width per six seconds at x1, and x2 and x4 are faster by the same law', () => {
 const span=api.spanOfWindow(EXTENT,{from:'1800',to:'1810'});
 const width=span.toMs-span.fromMs;
 const at1=api.advanceSpan(EXTENT,span,6000,1,false).span;
 const at2=api.advanceSpan(EXTENT,span,3000,2,false).span;
 const at4=api.advanceSpan(EXTENT,span,1500,4,false).span;
 assert.equal(at1.fromMs-span.fromMs,width);
 assert.equal(at2.fromMs-span.fromMs,width);
 assert.equal(at4.fromMs-span.fromMs,width);
 assert.equal(api.PLAYBACK_SPEEDS.join(','),'1,2,4');
});

test('T15: playback stops at the end, or loops when the loop toggle is on', () => {
 const span=api.spanOfWindow(EXTENT,{from:'1930',to:'1940'});
 const stopped=api.advanceSpan(EXTENT,span,60_000_000,1,false);
 assert.equal(stopped.ended,true);
 assert.equal(stopped.span.toMs,EXTENT.toMs);
 const looped=api.advanceSpan(EXTENT,span,60_000_000,1,true);
 assert.equal(looped.ended,false);
 assert.ok(looped.span.fromMs>=EXTENT.fromMs&&looped.span.toMs<=EXTENT.toMs);
 assert.equal(looped.span.toMs-looped.span.fromMs,span.toMs-span.fromMs);
});

test('T15: play from the end restarts from the start, keeping the width', () => {
 const span=api.spanOfWindow(EXTENT,{from:'1940',to:'1950'});
 const restart=api.playStartSpan(EXTENT,span);
 assert.equal(restart.fromMs,EXTENT.fromMs);
 assert.equal(restart.toMs-restart.fromMs,span.toMs-span.fromMs);
});

test('T15: reduced motion keeps stepping and says why playback is not offered', () => {
 const status=api.timeControlStatus({extent:EXTENT,reducedMotion:true});
 assert.equal(status.enabled,true);
 assert.equal(status.playable,false);
 assert.match(status.playReason,/Reduced motion/);
 assert.match(status.playReason,/steps/);
});

test('T15: at every frame the place filter’s validity law stands, and filtered-out places return intact', () => {
 const places=[PLACE_A,PLACE_B,PLACE_C];
 const before=JSON.stringify(places);
 const first=api.placesAtSpan(places,api.startSpanFor(EXTENT,null));
 const visibleSets=[];
 let span=api.startSpanFor(EXTENT,null);
 let frames=0;
 for(;;){
  const visible=api.placesAtSpan(places,span);
  // Each visible place is the caller's own object, never a copy.
  for(const place of visible) assert.ok(places.includes(place));
  // Validity decides presence: A stands only where its own period meets the frame, B likewise, C always.
  const aVisible=span.toMs>=Date.parse(A_FROM)&&span.fromMs<=Date.parse(A_TO);
  const bVisible=span.toMs>=Date.parse(B_FROM)&&span.fromMs<=Date.parse(B_TO);
  assert.equal(visible.includes(PLACE_A),aVisible,`place A at frame ${frames}`);
  assert.equal(visible.includes(PLACE_B),bVisible,`place B at frame ${frames}`);
  assert.equal(visible.includes(PLACE_C),true);
  visibleSets.push(visible.map(place=>place.place_ref).join('|'));
  frames+=1;
  const step=api.advanceSpan(EXTENT,span,100,4,false);
  span=step.span;
  if(step.ended)break;
  assert.ok(frames<100_000,'playback must reach the end');
 }
 assert.ok(frames>10,'the frame law is exercised across the extent');
 // Filtered-out places are not mutated and return intact when the window returns to the start.
 assert.equal(JSON.stringify(places),before);
 const back=api.placesAtSpan(places,api.startSpanFor(EXTENT,null));
 assert.equal(back.map(place=>place.place_ref).join('|'),first.map(place=>place.place_ref).join('|'));
 assert.equal(JSON.stringify(back[0]),JSON.stringify(first[0]));
});

test('T15: a paused window is the window that was written; it is inspectable, not animating', () => {
 const span=api.spanOfWindow(EXTENT,{from:'1820',to:'1840'});
 const written=api.windowOfSpan(span);
 assert.deepEqual(api.spanOfWindow(EXTENT,written),span);
});

// ---------------------------------------------------------------------------
// T16 — the imagery note: the slider filters data and never turns imagery back in time
// ---------------------------------------------------------------------------

test('T16: with no time-dimension imagery source the note reads, and no imagery era is ever claimed', () => {
 const note=api.imageryTimeNote([{id:'offline-ground'},{id:'street'},{id:'satellite'}]);
 assert.equal(note,'data window · imagery not time-aware');
 assert.equal(note,api.IMAGERY_TIME_NOTE);
 assert.doesNotMatch(note,/era|historic|as of|circa|\b1[0-9]{3}\b|\b20[0-9]{2}\b/i);
});

test('T16: a visible time-aware imagery source is the only thing that lifts the note', () => {
 assert.equal(api.imageryTimeNote([{id:'satellite',timeDimension:true}]),null);
});

// ---------------------------------------------------------------------------
// T17c — the owner's answer to a route the map opened comes back to the map
// ---------------------------------------------------------------------------

test('T17c: a refused move returns its marker, and shows the owner’s words verbatim', () => {
 const words='This save needs a unique disclosed source basis.';
 const routed=api.placeRouteResultFor({graphNodeId:'place:a',outcome:{kind:'refused',reason:words}});
 assert.equal(routed.returnMarker,'place:a');
 assert.equal(routed.notice.text,words);
 assert.equal(routed.notice.kind,'source-basis');
 assert.equal(routed.notice.reload,false);
});

test('T17c: a saved route returns its marker and asks the map to read again', () => {
 const routed=api.placeRouteResultFor({graphNodeId:'place:b',outcome:{kind:'saved'}});
 assert.equal(routed.returnMarker,'place:b');
 assert.equal(routed.notice.kind,'saved');
 assert.equal(routed.notice.reload,true);
 assert.equal(routed.notice.text,api.constellationResultNotice({kind:'saved'}).text);
});

test('T17c: a refusal with no words says so, and an add has no marker to return', () => {
 const bare=api.placeRouteResultFor({graphNodeId:'place:c',outcome:{kind:'refused',reason:null}});
 assert.equal(bare.notice.text,'The owner refused this save; no change was made.');
 const add=api.placeRouteResultFor({graphNodeId:null,outcome:{kind:'refused',reason:'Stale source.'}});
 assert.equal(add.returnMarker,null);
 assert.equal(add.notice.text,'Stale source.');
});
