/** Places day/night — lane-4 T27. Pure proof of the terminator geometry (drawn from a STATED subsolar point), the
 * reading's own answer (stated, or the reason verbatim), the instant a time window stands for, and the layer's law.
 * Source reads pin the wiring: the host asks the native route, the renderer draws only what the map passes, and no
 * astronomy vocabulary enters the vendored module.
 *
 * Loads `vendor/research-canvas/packages/canvas/src/psychogeographic/terminator.ts` through the esbuild-in-tmp pattern
 * of `places-basemap.test.mjs`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const canvasDir=resolve(engine,'../vendor/research-canvas/packages/canvas/src/psychogeographic');
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-terminator-'));
 try{
  const out=join(temporary,'places-terminator.mjs');
  await build({
   stdin:{contents:`export * from ${JSON.stringify(resolve(canvasDir,'terminator.ts'))};`,resolveDir:engine},
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

const read=(file)=>readFileSync(file,'utf8');
const unit=(lat,lon)=>{
 const φ=lat*Math.PI/180,λ=lon*Math.PI/180;
 return [Math.cos(φ)*Math.cos(λ),Math.cos(φ)*Math.sin(λ),Math.sin(φ)];
};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

/** Even-odd ray casting over the ring's own [lon,lat] pairs (the ring is closed by its pole points). */
function inside(ring,[lon,lat]){
 let hit=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if((yi>lat)!==(yj>lat)&&lon<((xj-xi)*(lat-yi))/(yj-yi)+xi)hit=!hit;
 }
 return hit;
}

const SUBSOLAR={latitude_degrees:20,longitude_degrees:30};

test('T27: the night ring is closed, spans the globe, and lies on the great circle 90 degrees from the stated point', ()=>{
 const ring=api.nightRing(SUBSOLAR);
 const first=ring[0],last=ring[ring.length-1];
 assert.deepEqual(last,first,'the ring is closed');
 for(const [lon,lat] of ring){
  assert.ok(lon>=-180&&lon<=180,'longitude in range');
  assert.ok(lat>=-90&&lat<=90,'latitude in range');
 }
 const subsolar=unit(SUBSOLAR.latitude_degrees,SUBSOLAR.longitude_degrees);
 // The last three points are the night pole closure and the return to the start; every point before them is terminator.
 for(const [lon,lat] of ring.slice(0,-3)){
  assert.ok(Math.abs(dot(unit(lat,lon),subsolar))<1e-9,`terminator point ${lon},${lat} is 90 degrees from the subsolar point`);
 }
});

test('T27: the night side is the side away from the stated subsolar point, and the day side is not shaded', ()=>{
 const ring=api.nightRing(SUBSOLAR);
 // Antipode-side night point: lat -40, lon -150 (dot with the subsolar unit vector is negative).
 assert.ok(inside(ring,[-150,-40]),'a point on the night side is inside');
 assert.ok(!inside(ring,[30,20]),'the subsolar point itself is not inside');
 assert.ok(!inside(ring,[60,20]),'a day-side point is not inside');
});

test('T27: a northern subsolar point puts the night pole in the south, a southern one in the north', ()=>{
 const north=api.nightRing({latitude_degrees:30,longitude_degrees:0});
 assert.ok(inside(north,[0,-80]),'south pole side is night for a northern subsolar point');
 assert.ok(!inside(north,[0,80]),'north pole side is day');
 const south=api.nightRing({latitude_degrees:-30,longitude_degrees:0});
 assert.ok(inside(south,[0,80]),'north pole side is night for a southern subsolar point');
 assert.ok(!inside(south,[0,-80]),'south pole side is day');
});

test('T27: an equatorial subsolar point splits the globe along the meridians 90 degrees either side of it', ()=>{
 const ring=api.nightRing({latitude_degrees:0,longitude_degrees:0});
 assert.ok(inside(ring,[170,0]),'the far side is night');
 assert.ok(inside(ring,[-120,30]),'the far side is night at another latitude');
 assert.ok(!inside(ring,[10,0]),'the near side is day');
 assert.ok(!inside(ring,[-60,-20]),'the near side is day in the south');
});

test('T27: the terminator source holds the night polygon (fill) and the great circle alone (edge) — never the seam or pole edges', ()=>{
 const collection=api.terminatorFeature(SUBSOLAR);
 assert.equal(collection.type,'FeatureCollection');
 const [night,line]=collection.features;
 assert.equal(night.properties.kind,'night');
 assert.equal(night.geometry.type,'Polygon');
 assert.deepEqual(night.geometry.coordinates,[api.nightRing(SUBSOLAR)]);
 assert.equal(line.properties.kind,'terminator');
 assert.equal(line.geometry.type,'LineString');
 assert.ok(line.geometry.coordinates.every(([,latitude])=>Math.abs(latitude)<90),'the edge never runs along a pole');
 assert.equal(line.geometry.coordinates.length,api.nightRing(SUBSOLAR).length-3,'the great-circle samples only');
});

test('T27 (review-6 #8): the window instant reads through the time authority; an epoch QL cannot read is refused by name', ()=>{
 assert.equal(api.windowInstant({from:'2026-03-01T00:00:00Z',to:'2026-03-03T00:00:00Z'}),'2026-03-02T00:00:00.000Z');
 const bce=api.windowInstant({from:'-000500-01-01T00:00:00Z',to:null});
 assert.ok(bce&&bce.startsWith('-000500'),'a BCE window stays BCE');
 assert.throws(()=>api.skyRequestEpoch(bce),/years 0000–9999/);
 assert.equal(api.skyRequestEpoch('2026-03-02T00:00:00.000Z'),'2026-03-02T00:00:00');
});

test('T27: daylightFromSky admits only a STATED subsolar point, with its provenance', ()=>{
 const sky={snapshot_ref:'sha256:abc',epoch_utc:'2026-10-13T12:00:00Z',provider:{engine:'swiss'},subsolar:{latitude_degrees:-7.5,longitude_degrees:-120.25},bodies:[]};
 const stated=api.daylightFromSky(sky);
 assert.equal(stated.status,'stated');
 assert.deepEqual(stated.subsolar,{latitude_degrees:-7.5,longitude_degrees:-120.25});
 assert.equal(stated.epoch_utc,'2026-10-13T12:00:00Z');
 assert.equal(stated.snapshot_ref,'sha256:abc');
 assert.equal(stated.provider,'{"engine":"swiss"}');
});

test('T27: a sky snapshot with no stated subsolar point names the reason and draws nothing', ()=>{
 const sky={snapshot_ref:'sha256:abc',epoch_utc:'2026-10-13T12:00:00Z',provider:'swiss',schema:'ql.sky-snapshot/v1',bodies:[{body:'Sun',longitude_degrees:201.2}]};
 const answer=api.daylightFromSky(sky);
 assert.equal(answer.status,'unavailable');
 assert.ok(answer.reason.includes('sha256:abc'),'the reason names the snapshot');
 assert.ok(answer.reason.includes('states no subsolar point'),'the reason is the producer-facing sentence');
 assert.ok(answer.reason.includes(api.SUBSOLAR_NOT_STATED));
});

test('T27: out-of-range, non-finite or non-numeric subsolar values are refused, never clamped', ()=>{
 const base={snapshot_ref:'sha256:abc',epoch_utc:'2026-10-13T12:00:00Z',provider:'swiss'};
 for(const subsolar of [
  {latitude_degrees:95,longitude_degrees:0},
  {latitude_degrees:0,longitude_degrees:181},
  {latitude_degrees:Number.NaN,longitude_degrees:0},
  {latitude_degrees:'10',longitude_degrees:0},
  {latitude_degrees:0},
  'subsolar',
 ]){
  assert.equal(api.daylightFromSky({...base,subsolar}).status,'unavailable',JSON.stringify(subsolar));
 }
});

test('T27: a missing sky, or a sky that does not disclose its snapshot or epoch, is unavailable with its own reason', ()=>{
 assert.equal(api.daylightFromSky(null).status,'unavailable');
 assert.match(api.daylightFromSky(null).reason,/no sky snapshot/);
 const undisclosed=api.daylightFromSky({provider:'swiss',subsolar:SUBSOLAR});
 assert.equal(undisclosed.status,'unavailable');
 assert.match(undisclosed.reason,/does not disclose its snapshot or epoch/);
});

test('T27: the provider is named as given, compactly when structured, and "not disclosed" when absent', ()=>{
 assert.equal(api.providerLabel('kerykeion'),'kerykeion');
 assert.equal(api.providerLabel(null),'not disclosed');
 assert.equal(api.providerLabel(undefined),'not disclosed');
 assert.equal(api.providerLabel({}),'not disclosed');
 const long=api.providerLabel({key:'x'.repeat(400)});
 assert.ok(long.length<=160,'bounded');
 assert.ok(long.endsWith('…'));
});

test('T27: the instant a window stands for is its midpoint when bounded, its bound when half-open, and now when open', ()=>{
 assert.equal(api.windowInstant(null),null,'no window: now');
 assert.equal(api.windowInstant({from:null,to:null}),null,'open window: now');
 assert.equal(api.windowInstant({from:'2026-01-01T00:00:00.000Z',to:'2026-01-03T00:00:00.000Z'}),'2026-01-02T00:00:00.000Z','midpoint');
 assert.equal(api.windowInstant({from:'2026-01-01T00:00:00.000Z',to:null}),'2026-01-01T00:00:00.000Z','from-only');
 assert.equal(api.windowInstant({from:null,to:'2026-01-03T00:00:00.000Z'}),'2026-01-03T00:00:00.000Z','to-only');
 assert.equal(api.windowInstant({from:'not a date',to:null}),null,'an unparsed edge stands for now');
});

test('T27: the sky request epoch is the instant in UTC seconds; now is the supplied clock; the basis says which', ()=>{
 assert.equal(api.skyRequestEpoch('2026-01-02T03:04:05.678Z'),'2026-01-02T03:04:05');
 assert.equal(api.skyRequestEpoch(null,new Date('2026-10-13T08:09:10.000Z')),'2026-10-13T08:09:10');
 assert.match(api.daylightBasis(null),/^now/);
 assert.equal(api.daylightBasis('2026-01-02T00:00:00.000Z'),'window midpoint 2026-01-02T00:00:00.000Z');
});

test('T27: the layer law is stated, and the vendored module carries no astronomy of its own', ()=>{
 assert.match(api.DAYLIGHT_LAW,/stated subsolar point/);
 assert.match(api.DAYLIGHT_LAW,/computes no astronomy/);
 const source=read(resolve(canvasDir,'terminator.ts'));
 for(const word of ['ephemeris','obliquity','sidereal','julian','equation of time','right ascension','declination of the sun']){
  assert.ok(!source.toLowerCase().includes(word),`no ${word} in the vendored terminator`);
 }
});

test('T27: the map draws the terminator only from a stated point, and offers the toggle off by default', ()=>{
 const map=read(resolve(canvasDir,'PsychogeographicMap.tsx'));
 assert.match(map,/const \[daylightOn, setDaylightOn\] = useState\(false\)/,'off by default');
 assert.match(map,/data-testid="places-daylight-toggle"/);
 assert.match(map,/no sky reading host is attached to this map/,'the absent host names its reason');
 assert.match(map,/const feature = statedSubsolar \? terminatorFeature\(statedSubsolar\) : null;/,'nothing is drawn without a stated point');
 assert.match(map,/const daylightInstant = windowInstant\(layerFilter\?\.window \?\? null\);/,'the committed window sets the instant');
});

test('T27: the renderer exposes the terminator as its own source and layers, removed when null', ()=>{
 const renderer=read(resolve(canvasDir,'renderer.ts'));
 assert.match(renderer,/async drawTerminator\(feature\)/);
 assert.match(renderer,/"places-terminator"/);
 assert.match(renderer,/"places-terminator-fill"/);
 assert.match(renderer,/"places-terminator-edge"/);
 assert.match(renderer,/m\.removeSource\("places-terminator"\)/);
});

test('T27: the host asks the native instrument route the dated sky uses, and states its answer through the stated-only reader', ()=>{
 const host=read(resolve(engine,'src/researchInstruments.tsx'));
 assert.match(host,/naraInstrumentRequest\(\{operation:'identity',request:\{operation:'transit',request\}\}\)/);
 assert.match(host,/schema:'ql\.sky-request\/v1'/);
 assert.match(host,/return daylightFromSky\(reply\.transit\.sky\)/);
 assert.match(host,/daylight=\{PLACES_DAYLIGHT\}/);
});
