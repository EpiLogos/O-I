/** Places basemap — lane-4 T4 (the layer stack over an honest offline core) and T5 (terrain
 * elevation as an opt-in layer). Pure proof of the stack model, the gate, the credits and the
 * terrain readout, plus source reads of the wiring in the map, the renderer and the host.
 *
 * Loads `vendor/research-canvas/packages/canvas/src/psychogeographic/{basemapSources,basemapLayers,disclosure}.ts`
 * through the same esbuild-in-tmp pattern as `places-chrome.test.mjs`. The reasons are compared
 * with the disclosure module's own constants, so they cannot drift from the owner's sentences.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {readFileSync,readdirSync} from 'node:fs';
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
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-basemap-'));
 try{
  const out=join(temporary,'places-basemap.mjs');
  const modules=['basemapSources','basemapLayers','disclosure'].map(name=>`export * from ${JSON.stringify(resolve(canvasDir,name+'.ts'))};`).join('\n');
  await build({
   stdin:{contents:modules,resolveDir:engine},
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
const OPEN={offlineOnly:false,hasPolicy:true,optedIn:true};
const NONE={};

// ---------------------------------------------------------------------------
// T4 — the registry is data, with honest credit and licence
// ---------------------------------------------------------------------------

test('T4: every live source is data with an https tile template, a credit, a licence and a finite zoom ceiling', ()=>{
  const sources=[...api.LIVE_BASEMAP_SOURCES,api.TERRAIN_BASEMAP_SOURCE];
  const ids=sources.map(source=>source.id);
  assert.equal(new Set(ids).size,ids.length,'ids are unique');
  for(const source of sources){
   assert.match(source.tiles,/^https:\/\//,`${source.id} is https`);
   assert.match(source.tiles,/\{z\}/,`${source.id} carries the zoom placeholder`);
   assert.match(source.tiles,/\{x\}/);
   assert.match(source.tiles,/\{y\}/);
   assert.ok(source.attribution.trim().length>0,`${source.id} names its credit`);
   assert.ok(source.licence.trim().length>0,`${source.id} names its licence`);
   assert.ok(Number.isInteger(source.maxZoom)&&source.maxZoom>0,`${source.id} has a zoom ceiling`);
  }
  assert.ok(!ids.includes(api.OFFLINE_GROUND_ID),'the offline ground is never a network source');
 });

test('T4: the families are street, satellite and hybrid, and the credits name the providers', ()=>{
  const families=new Set(api.LIVE_BASEMAP_SOURCES.map(source=>source.family));
  for(const family of ['street','satellite','hybrid']) assert.ok(families.has(family),`${family} family present`);
  const eox=api.LIVE_BASEMAP_SOURCES.find(source=>source.id==='eox-sentinel2');
  assert.match(eox.attribution,/Sentinel-2 cloudless by EOX/);
  assert.match(eox.licence,/CC BY 4\.0/);
  const osm=api.LIVE_BASEMAP_SOURCES.find(source=>source.family==='street');
  assert.equal(osm.attribution,'© OpenStreetMap contributors');
});

test('T5: the terrain source is terrarium-encoded elevation with the Terrain Tiles credit', ()=>{
  assert.equal(api.TERRAIN_BASEMAP_SOURCE.kind,'raster-dem');
  assert.equal(api.TERRAIN_BASEMAP_SOURCE.encoding,'terrarium');
  assert.equal(api.TERRAIN_BASEMAP_SOURCE.attribution,'Terrain Tiles: Mapzen, AWS Open Data');
});

// ---------------------------------------------------------------------------
// T4 — the default is the offline ground, exactly as before
// ---------------------------------------------------------------------------

test('T4: the default stack draws only the offline ground, fully opaque, with no credit added', ()=>{
  const stack=api.defaultBasemapStack();
  assert.deepEqual(stack.layers[api.OFFLINE_GROUND_ID],{visible:true,opacity:1});
  for(const source of api.LIVE_BASEMAP_SOURCES) assert.equal(stack.layers[source.id].visible,false,`${source.id} starts off`);
  assert.equal(stack.terrainVisible,false);
  for(const gate of [OPEN,NONE]){
   const plan=api.composeBasemapPlan(stack,gate,{});
   assert.deepEqual(plan.ground,{visible:true,opacity:1});
   assert.deepEqual(plan.rasters,[]);
   assert.equal(plan.terrain,null);
   assert.deepEqual(plan.attributions,[]);
  }
});

// ---------------------------------------------------------------------------
// T4 — the live gate names its reason, verbatim, and draws nothing without it
// ---------------------------------------------------------------------------

test('T4: the live gate names the owner reason for each absence, and is open only after an opt-in', ()=>{
  assert.equal(api.basemapGateReason({offlineOnly:true,hasPolicy:true,optedIn:false}),api.HOSTED_NETWORK_REASON);
  assert.equal(api.basemapGateReason({offlineOnly:true,hasPolicy:true,optedIn:true}),api.HOSTED_NETWORK_REASON,'the host offline stance outranks an opt-in');
  assert.equal(api.basemapGateReason({offlineOnly:false,hasPolicy:false,optedIn:false}),api.NO_POLICY_REASON);
  assert.equal(api.basemapGateReason({offlineOnly:false,hasPolicy:true,optedIn:false}),api.OPT_IN_REASON);
  assert.equal(api.basemapGateReason(OPEN),null);
});

test('T4: a visible source draws nothing while the gate is closed, and its row is disabled with the reason', ()=>{
  const stack=api.setBasemapVisible(api.defaultBasemapStack(),'osm-street',true);
  const closed={offlineOnly:true,hasPolicy:true,optedIn:false};
  const plan=api.composeBasemapPlan(stack,closed,{});
  assert.deepEqual(plan.rasters,[]);
  assert.deepEqual(plan.attributions,[]);
  assert.deepEqual(plan.ground,{visible:true,opacity:1},'the offline ground is untouched');
  const row=api.basemapRows(stack,closed,{}).find(item=>item.id==='osm-street');
  assert.equal(row.enabled,false,'a closed gate cannot be switched on');
  assert.equal(row.visible,true,'the owner\'s own visibility is kept, so the row reads what is set');
});

test('T4: the imagery stacks bottom to top in registry order, whatever order the owner turned them on', ()=>{
  let stack=api.defaultBasemapStack();
  stack=api.setBasemapVisible(stack,'esri-place-names',true);
  stack=api.setBasemapVisible(stack,'osm-street',true);
  const plan=api.composeBasemapPlan(stack,OPEN,{});
  assert.deepEqual(plan.rasters.map(draw=>draw.key),['osm-street','esri-place-names']);
  assert.deepEqual(plan.rasters.map(draw=>draw.layerId),['basemap-osm-street-layer','basemap-esri-place-names-layer']);
});

test('T4: opacity is kept within 0 to 1, and a value that is not a number reads as opaque', ()=>{
  const stack=api.defaultBasemapStack();
  assert.equal(api.setBasemapOpacity(stack,'osm-street',2).layers['osm-street'].opacity,1);
  assert.equal(api.setBasemapOpacity(stack,'osm-street',-1).layers['osm-street'].opacity,0);
  assert.equal(api.setBasemapOpacity(stack,'osm-street',Number.NaN).layers['osm-street'].opacity,1);
  assert.equal(api.setBasemapOpacity(stack,'osm-street',0.35).layers['osm-street'].opacity,0.35);
  assert.equal(api.setBasemapOpacity(stack,'no-such-layer',0.5),stack,'an unknown layer is not invented');
});

test('T4: a source the renderer refused is left off the map, its refusal verbatim on its row, and its credit not drawn', ()=>{
  const stack=api.setBasemapVisible(api.defaultBasemapStack(),'eox-sentinel2',true);
  const refusal='Failed to fetch';
  const plan=api.composeBasemapPlan(stack,OPEN,{'eox-sentinel2':refusal});
  assert.deepEqual(plan.rasters,[]);
  assert.ok(!plan.attributions.some(line=>line.includes('EOX')),'no credit for a source that is not on screen');
  const row=api.basemapRows(stack,OPEN,{'eox-sentinel2':refusal}).find(item=>item.id==='eox-sentinel2');
  assert.equal(row.failure,refusal);
  assert.equal(row.visible,true,'the owner can see it is still set and retry it');
});

test('T4: each drawn source is credited with its name and licence, and only the drawn ones', ()=>{
  let stack=api.setBasemapVisible(api.defaultBasemapStack(),'osm-street',true);
  stack=api.setTerrainVisible(stack,true);
  const plan=api.composeBasemapPlan(stack,OPEN,{});
  assert.deepEqual(plan.attributions,[
   '© OpenStreetMap contributors [ODbL 1.0 data; OSM tile usage policy]',
   'Terrain Tiles: Mapzen, AWS Open Data [Mixed open terrain sources (Joerd attribution)]',
  ]);
});

test('T4: hiding the live layers takes terrain off too, and the offline ground stays as it was', ()=>{
  let stack=api.setBasemapVisible(api.defaultBasemapStack(),'osm-street',true);
  stack=api.setTerrainVisible(stack,true);
  stack=api.setBasemapOpacity(stack,api.OFFLINE_GROUND_ID,0.6);
  const hidden=api.hideLiveBasemaps(stack);
  assert.equal(hidden.layers['osm-street'].visible,false);
  assert.equal(hidden.terrainVisible,false);
  assert.deepEqual(hidden.layers[api.OFFLINE_GROUND_ID],{visible:true,opacity:0.6});
});

test('T4: the top live imagery is the one the readouts name; none when only the ground draws', ()=>{
  let stack=api.setBasemapVisible(api.defaultBasemapStack(),'osm-street',true);
  stack=api.setBasemapVisible(stack,'esri-imagery',true);
  const top=api.topLiveRaster(api.composeBasemapPlan(stack,OPEN,{}));
  assert.equal(top.attribution,'Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community');
  assert.equal(api.topLiveRaster(api.composeBasemapPlan(api.defaultBasemapStack(),OPEN,{})),null);
});

// ---------------------------------------------------------------------------
// T5 — terrain: opt-in, gated, and read as the place's elevation or named absent
// ---------------------------------------------------------------------------

test('T5: terrain draws only through the gate, and a refused terrain draws nothing', ()=>{
  const on=api.setTerrainVisible(api.defaultBasemapStack(),true);
  const plan=api.composeBasemapPlan(on,OPEN,{});
  assert.equal(plan.terrain.encoding,'terrarium');
  assert.equal(plan.terrain.sourceId,'basemap-terrain-dem');
  assert.equal(api.composeBasemapPlan(on,{offlineOnly:true,hasPolicy:true,optedIn:false},{}).terrain,null);
  assert.equal(api.composeBasemapPlan(on,OPEN,{'terrain-dem':'Failed to fetch'}).terrain,null);
  const terrain=api.terrainBasemapRow(on,OPEN,{'terrain-dem':'Failed to fetch'});
  assert.equal(terrain.failure,'Failed to fetch');
});

test('T5: terrain off or unavailable reads "No terrain source"; a selected place reads its elevation', ()=>{
  assert.equal(api.NO_TERRAIN_SOURCE,'No terrain source');
  assert.equal(api.terrainReadout({active:false,selected:null}),'No terrain source');
  assert.equal(api.terrainReadout({active:false,selected:{title:'Ostia',located:true,elevationMeters:12}}),'No terrain source');
  assert.equal(api.terrainReadout({active:true,selected:null}),'Terrain on · select a place for its elevation');
  assert.equal(api.terrainReadout({active:true,selected:{title:'Ostia',located:true,elevationMeters:11.6}}),'Elevation at Ostia: 12 m');
  assert.equal(api.terrainReadout({active:true,selected:{title:'Ostia',located:true,elevationMeters:null}}),'Elevation at Ostia: not loaded yet');
  assert.equal(api.terrainReadout({active:true,selected:{title:'Atlantis',located:false,elevationMeters:null}}),'Atlantis: no coordinate, so no elevation');
});

test('T5: a sampled negative elevation is shown as read, never as absent', ()=>{
  assert.equal(api.terrainReadout({active:true,selected:{title:'Dead Sea shore',located:true,elevationMeters:-430.2}}),'Elevation at Dead Sea shore: -430 m');
});

// ---------------------------------------------------------------------------
// Source reads — the wiring is the one the model describes
// ---------------------------------------------------------------------------

test('the map draws the stack through the renderer, names the switch, and keeps the old live pair gone', ()=>{
  const map=read(resolve(canvasDir,'PsychogeographicMap.tsx'));
  assert.match(map,/from "\.\/basemapLayers"/);
  assert.match(map,/data-testid="places-basemap"/);
  assert.match(map,/data-testid="places-live-allow"/);
  assert.match(map,/Allow live sources/);
  assert.match(map,/data-testid="places-terrain-readout"/);
  assert.match(map,/readyRenderer\.setBasemapPlan\(plan\)/);
  assert.match(map,/renderer\.onBasemapError\?\.\(/);
  assert.match(map,/policy\.requestLiveAction\("tile_refresh"/,'every live row passes the tile_refresh gate');
  assert.doesNotMatch(map,/Enable live tiles|Refresh tiles|refreshLiveTiles/,'the single-source pair is superseded by the stack');
  assert.doesNotMatch(map,/tile\.openstreetmap\.org/,'the live URLs live only in the registry');
  assert.doesNotMatch(map,/stroke:\s*"#/);
});

test('the renderer holds the plan by diffing, reads terrain elevation, and names refusals from its own map', ()=>{
  const renderer=read(resolve(canvasDir,'renderer.ts'));
  assert.match(renderer,/async setBasemapPlan\(plan\)/);
  assert.match(renderer,/m\.setTerrain\(null\)/,'terrain comes off before its source is removed');
  assert.match(renderer,/type: "raster-dem"/);
  assert.match(renderer,/encoding: terrain\.encoding/);
  assert.match(renderer,/map\.queryTerrainElevation\(\[longitude, latitude\]\)/);
  assert.match(renderer,/if \(cause\?\.name === "AbortError"\) return;/,'a tile the map cancelled is not a refusal');
  assert.match(renderer,/basemapErrorHandler\(held\.key, cause\?\.message \?\? String\(event\.error\)\)/,'the refusal is reported with its own message');
  assert.match(renderer,/if \(m\.getSource\(draw\.sourceId\)\) \{/,'a layer that stays keeps its tiles');
  assert.doesNotMatch(renderer,/setLiveTileSource/);
});

test('the basemap modules hold no timer, frame loop or keyframed motion', ()=>{
  for(const name of ['basemapSources.ts','basemapLayers.ts']){
   const text=read(resolve(canvasDir,name));
   assert.doesNotMatch(text,/requestAnimationFrame|setInterval|@keyframes|\banimation\s*:/,`${name} is still`);
  }
});

test('the host opts in through its own switch and the policy gate, with session view state and no browser storage', ()=>{
  const host=read(resolve(engine,'src/researchInstruments.tsx'));
  assert.match(host,/offlineOnly=\{!state\.livePlaces!\.allowed\}/);
  assert.match(host,/policy=\{state\.livePlaces!\.policy\}/);
  assert.match(host,/onLiveSourcesAllowedChange=\{allowed=>/);
  assert.match(host,/live\.policy\.optIn\('tile_refresh'/);
  assert.match(host,/live\.policy\.optOut\('tile_refresh'\)/);
  // lane-4 T21: a first visit seeds the stack from the Scene's saved layers (absent = the defaults); allowed stays false.
  assert.match(host,/state\.livePlaces\?\?=\{allowed:false,policy:createLiveServicePolicy\(\),stack:restoredLayers\.stack\}/);
  assert.doesNotMatch(host,/tileSource=\{tileSource\} offlineOnly /,'the bare offline stance is gone from the Places mount');
});

test('the vendored basemap files carry no browser storage', ()=>{
  const dir=canvasDir;
  for(const name of readdirSync(dir).filter(file=>/^basemap.*\.ts$/.test(file))){
   assert.doesNotMatch(read(resolve(dir,name)),/localStorage|sessionStorage/,`${name} keeps no browser storage`);
  }
});
