/** Places layers persist per Scene — lane-4 T21. The layers panel's toggles (the place layer filter) and the basemap rows
 * (each live source's visibility and opacity, terrain on or off) are one bounded `placeLayers` record on the Scene's
 * `oi.research-scene/v1` material. Pure proof through the esbuild-in-tmp pattern of `places-views.test.mjs`, plus source reads
 * of the Places host wiring and the kernel's validator.
 *
 * Covers: a written record restores the same filter and rows and terrain; an absent record restores today's defaults; the
 * record is closed (no live-source allowance, no camera, no refs) and bounded in the JS validator and the material; a bad
 * record is refused and leaves the Scene byte-identical; a restore never grants a live source; the labels name each edit; the
 * host writes one settled change through the material path (600 ms idle, skipped when the Scene already keeps the layers, the
 * owner's allowance never written); the kernel admits the same record; the place views moved onto their own actions keep their
 * saved shape.
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
const kernelSource=resolve(engine,'../../kernel/src/expression_scene.rs');
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-layers-persist-'));
 try{
  const out=join(temporary,'places-layers-persist.mjs');
  const entries={
   views:resolve(engine,'src/placeViews.ts'),
   material:resolve(engine,'src/researchMaterial.ts'),
   labels:resolve(engine,'src/undoLabels.ts'),
   basemap:resolve(canvasDir,'basemapLayers.ts'),
   sources:resolve(canvasDir,'basemapSources.ts'),
  };
  const contents=Object.entries(entries).map(([name,file])=>`export * as ${name} from ${JSON.stringify(file)};`).join('\n');
  await build({stdin:{contents,resolveDir:engine},tsconfig:engine+'/tsconfig.json',bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning'});
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const read=(file)=>readFileSync(file,'utf8');
/** Source with comments removed, so a rule about code is not tripped by the prose that explains it. */
const code=(text)=>text.replace(/\/\*[\s\S]*?\*\//g,'').split('\n').map(line=>line.replace(/\/\/.*$/,'')).join('\n');
const roundTrip=(value)=>JSON.parse(JSON.stringify(value));
const ids=new Set();
const openFilter={relations:null,standing:null,window:null};

function stackWithChoices(){
 let stack=api.basemap.defaultBasemapStack();
 stack=api.basemap.setBasemapVisible(stack,'osm-street',true);
 stack=api.basemap.setBasemapOpacity(stack,'osm-street',0.4);
 stack=api.basemap.setBasemapVisible(stack,'esri-imagery',true);
 stack=api.basemap.setBasemapOpacity(stack,'offline-ground',0.8);
 return api.basemap.setTerrainVisible(stack,true);
}
const sceneWith=(research={})=>({id:'scene-1',name:'Scene',entities:[{id:'e1',name:'Object'}],research:{...api.material.emptyResearchMaterial(),...research}});

test('toggles and basemap rows written as one record restore exactly after a round trip', ()=>{
 const filter={relations:new Set(['born in','lived in']),standing:new Set(['factual']),window:null};
 const stack=stackWithChoices();
 const scene=sceneWith();
 api.material.applyResearchMaterial(scene,{type:'place-layers-set',value:api.views.layersRecordOf(filter,stack)});
 const saved=roundTrip(scene.research);
 assert.doesNotThrow(()=>api.material.validateResearchMaterial(saved,new Set(['e1'])));
 const restored=api.views.restoreLayers(saved.placeLayers);
 assert.deepEqual([...restored.filter.relations].sort(),['born in','lived in']);
 assert.deepEqual([...restored.filter.standing],['factual']);
 assert.equal(restored.filter.window,null,'the shared time window is not a layer');
 for(const id of Object.keys(stack.layers))assert.deepEqual(restored.stack.layers[id],stack.layers[id],`row ${id}`);
 assert.equal(restored.stack.terrainVisible,true);
});

test('all layers on and the offline ground only are kept open, and an absent record restores the same defaults', ()=>{
 const scene=sceneWith();
 api.material.applyResearchMaterial(scene,{type:'place-layers-set',value:api.views.layersRecordOf(openFilter,api.basemap.defaultBasemapStack())});
 const kept=api.views.restoreLayers(roundTrip(scene.research).placeLayers);
 const absent=api.views.restoreLayers(undefined);
 assert.equal(kept.filter.relations,null);
 assert.equal(kept.filter.standing,null);
 assert.deepEqual(kept.stack,api.basemap.defaultBasemapStack());
 assert.deepEqual(absent.stack,api.basemap.defaultBasemapStack());
 assert.equal(absent.filter.relations,null);
 assert.equal(absent.filter.standing,null);
 assert.equal(api.views.layersKey(absent.filter,absent.stack),api.views.layersKey(kept.filter,kept.stack),'absent and open are the same layers');
 assert.doesNotThrow(()=>api.material.validateResearchMaterial(roundTrip(api.material.emptyResearchMaterial()),ids),'material saved before the record existed validates');
});

test('the layer key tells one toggle from another, so a settle that restates the Scene is recognisable', ()=>{
 const base=api.views.layersKey(openFilter,stackWithChoices());
 assert.equal(api.views.layersKey(openFilter,stackWithChoices()),base);
 const toggledOff={relations:new Set(['born in']),standing:null,window:null};
 assert.notEqual(api.views.layersKey(toggledOff,stackWithChoices()),base,'a relation toggled off is a change');
 const opacity=api.basemap.setBasemapOpacity(stackWithChoices(),'osm-street',0.5);
 assert.notEqual(api.views.layersKey(openFilter,opacity),base,'an opacity step is a change');
 const windowOnly={...openFilter,window:{from:'1900',to:null}};
 assert.equal(api.views.layersKey(windowOnly,stackWithChoices()),base,'the time window is not part of the layers');
});

test('the record never holds the owner\'s live-source allowance, a camera or any reference', ()=>{
 const record=roundTrip(api.views.layersRecordOf({relations:new Set(['born in']),standing:null,window:null},stackWithChoices()));
 assert.deepEqual(Object.keys(record).sort(),['basemap','relations']);
 assert.deepEqual(Object.keys(record.basemap).sort(),['layers','terrainVisible']);
 for(const row of Object.values(record.basemap.layers))assert.deepEqual(Object.keys(row).sort(),['opacity','visible']);
 assert.doesNotMatch(JSON.stringify(record),/allow|live|viewport|window|entity|ref/i);
});

test('a restore never grants a live source: restored rows draw nothing until the owner allows them', ()=>{
 const restored=api.views.restoreLayers(roundTrip(api.views.layersRecordOf(openFilter,stackWithChoices())));
 assert.equal(restored.stack.layers['osm-street'].visible,true,'the row restores as saved');
 const ownerOff={offlineOnly:true,hasPolicy:true,optedIn:false};
 const plan=api.basemap.composeBasemapPlan(restored.stack,ownerOff,{});
 assert.deepEqual(plan.rasters,[],'no live imagery is requested');
 assert.equal(plan.terrain,null,'no terrain is requested');
 assert.deepEqual(api.basemap.composeBasemapPlan(restored.stack,{offlineOnly:false,hasPolicy:true,optedIn:false},{}).rasters,[],'a policy alone does not open the gate');
});

test('the JS validator admits only the closed record, and a refused write leaves the Scene byte-identical', ()=>{
 const good=roundTrip(api.views.layersRecordOf({relations:new Set(['born in']),standing:new Set(['mythic']),window:null},stackWithChoices()));
 assert.doesNotThrow(()=>api.material.validatePlaceLayersRecord(good));
 const refused=[
  'born in',
  [],
  {...good,extra:1},
  {...good,viewport:{x:0,y:0,zoom:1}},
  {...good,window:null},
  {...good,relations:'born in'},
  {...good,relations:['x'.repeat(161)]},
  {...good,standing:['canonical']},
  {...good,basemap:{...good.basemap,layers:{...good.basemap.layers,'bing-aerial':{visible:true,opacity:1}}}},
  {...good,basemap:{...good.basemap,layers:{'osm-street':{visible:true,opacity:1.5}}}},
  {...good,basemap:{...good.basemap,layers:{'osm-street':{visible:true,opacity:1,live:true}}}},
  {...good,basemap:{layers:good.basemap.layers}},
  {...good,basemap:{terrainVisible:'no',layers:good.basemap.layers}},
 ];
 for(const value of refused)assert.throws(()=>api.material.validatePlaceLayersRecord(value),undefined,JSON.stringify(value).slice(0,120));
 const scene=sceneWith();
 const before=JSON.stringify(scene);
 for(const value of refused){
  assert.throws(()=>api.material.applyResearchMaterial(scene,{type:'place-layers-set',value}));
  assert.equal(JSON.stringify(scene),before,'a refused layers write leaves the Scene as it was');
 }
 // the whole material is checked too: a record inside a material is admitted only in the same closed shape
 assert.throws(()=>api.material.validateResearchMaterial(roundTrip({...api.material.emptyResearchMaterial(),placeLayers:{...good,extra:1}}),ids));
 assert.doesNotThrow(()=>api.material.validateResearchMaterial(roundTrip({...api.material.emptyResearchMaterial(),placeLayers:good}),ids));
});

test('a layers write replaces only placeLayers: the occurrences, canvas views and place views are untouched', ()=>{
 const scene=sceneWith({namedViews:{'canvas view':{viewport:{x:1,y:2,zoom:3},selectedRefs:[],frameOrder:[]}}});
 const view=api.views.capturePlaceView({viewState:{latitude:48.85,longitude:2.35,zoom:11},filter:openFilter,stack:stackWithChoices(),window:null});
 api.material.applyResearchMaterial(scene,{type:'place-view-save',name:'Paris',place:view});
 const views=JSON.stringify(scene.research.placeViews);
 const canvas=JSON.stringify(scene.research.namedViews);
 api.material.applyResearchMaterial(scene,{type:'place-layers-set',value:api.views.layersRecordOf({relations:new Set(['born in']),standing:null,window:null},stackWithChoices())});
 assert.equal(JSON.stringify(scene.research.placeViews),views);
 assert.equal(JSON.stringify(scene.research.namedViews),canvas);
 assert.deepEqual(scene.entities,[{id:'e1',name:'Object'}]);
 assert.ok(scene.research.placeLayers.relations);
});

test('the layer and view actions name their edits in the undo history', ()=>{
 assert.equal(api.labels.researchMaterialLabel({type:'place-layers-set'}),'Set map layers');
 assert.equal(api.labels.researchMaterialLabel({type:'place-view-save'}),'Save place view');
 assert.equal(api.labels.researchMaterialLabel({type:'place-view-remove'}),'Remove place view');
 assert.equal(api.labels.researchMaterialLabel({type:'view-save'}),'Save view','a canvas view keeps its own label');
});

test('the place views moved onto their own actions keep the saved shape: placeViews, never namedViews', ()=>{
 const scene=sceneWith();
 const view=api.views.capturePlaceView({viewState:{latitude:20,longitude:0,zoom:1},filter:openFilter,stack:api.basemap.defaultBasemapStack(),window:null});
 api.material.applyResearchMaterial(scene,{type:'place-view-save',name:'Open',place:view});
 assert.deepEqual(scene.research.placeViews.Open,view);
 assert.deepEqual(scene.research.namedViews,{},'the canvas views are untouched');
 api.material.applyResearchMaterial(scene,{type:'place-view-remove',name:'Open'});
 assert.equal(scene.research.placeViews,undefined);
});

test('the Places host writes one settled layers change through the material path, and the map keeps no allowance in the record', ()=>{
 const host=read(resolve(engine,'src/researchInstruments.tsx'));
 // the host restores a first visit from the Scene's record, and only the layers
 assert.match(host,/restoreLayers\(\(\(\)=>\{try\{return host\.sceneMaterial\(sceneId\)\.research\?\.placeLayers;\}catch\{return undefined;\}\}\)\(\)\)/);
 assert.match(host,/state\.placeFilter\?\?=restoredLayers\.filter;/);
 assert.match(host,/state\.livePlaces\?\?=\{allowed:false,policy:createLiveServicePolicy\(\),stack:restoredLayers\.stack\};/);
 // one debounced settle: 600 ms idle, the timer replaced on each change, written once
 assert.match(host,/state\.placeLayersSave=\{timer:setTimeout\(write,600\),write\};/);
 assert.match(host,/if\(state\.placeLayersSave\)clearTimeout\(state\.placeLayersSave\.timer\);/);
 // every layer change schedules a settle: the layer toggles, the facets, the basemap rows and a view restore
 assert.match(host,/onLayerFilterChange=\{next=>\{state\.placeFilter=\{\.\.\.next,window:null\};scheduleLayersSave\(\);/);
 assert.match(host,/onBasemapStackChange=\{next=>\{state\.livePlaces!\.stack=next;scheduleLayersSave\(\);\}\}/);
 assert.match(host,/onFilterChange=\{next=>\{state\.placeFilter=\{\.\.\.next,window:null\};scheduleLayersSave\(\);/);
 // a settle that restates the Scene writes nothing, and the write carries the layers only
 const persist=host.slice(host.indexOf('const persistPlaceLayers='),host.indexOf('const scheduleLayersSave='));
 assert.ok(persist.length>200,'the persist function is located');
 assert.match(code(persist),/layersKey\(state\.placeFilter,state\.livePlaces\.stack\)===layersKey\(kept\.filter,kept\.stack\)\)return;/);
 assert.match(code(persist),/type:'place-layers-set',value:layersRecordOf\(state\.placeFilter,state\.livePlaces\.stack\)/);
 assert.doesNotMatch(code(persist),/allowed|optIn|optOut|requestLiveAction/);
 // a pending change is written when the instrument is destroyed, so the last change is not lost
 assert.match(host,/for\(const pending of views\.values\(\)\)pending\.placeLayersSave\?\.write\(\);/);
 // the map keeps its own stack, reporting each change; no change is written from the map's own code path
 const map=read(resolve(canvasDir,'PsychogeographicMap.tsx'));
 assert.doesNotMatch(code(map.slice(map.indexOf('const commitStack'),map.indexOf('const commitStack')+200)),/allowed|optIn|requestLiveAction/);
});

test('the kernel admits the same layers record and holds the same closed lists the app does', ()=>{
 const kernel=read(kernelSource);
 assert.match(kernel,/"placeViews",\s*"placeLayers",/,'the top-level keys admit placeLayers');
 assert.match(kernel,/fn place_layers_are_admitted_bounded_and_closed\(\)/);
 const list=(name)=>{
  const match=kernel.match(new RegExp(`const ${name}: &\\[&str\\] = &\\[([\\s\\S]*?)\\];`));
  assert.ok(match,`${name} is declared`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(entry=>entry[1]);
 };
 assert.deepEqual(list('BASEMAP_LAYER_IDS'),[api.sources.OFFLINE_GROUND_ID,...api.sources.LIVE_BASEMAP_SOURCES.map(source=>source.id)]);
 assert.deepEqual(list('PLACE_STANDINGS'),['factual','mythic','owner-vocabulary']);
});

// T-REVIEW-4 #3 and #7: undo or redo of "Set map layers" re-adopts the Scene's layers, and a settled change not yet written is
// written before its Scene is left (close, load of another Scene, destroy), and before the app's dispose tears anything down.
test('T-REVIEW-4 #3: the Scene record after an undo is a different layers key, so the view re-adopts it instead of keeping the undone layers', ()=>{
  const first={relations:new Set(['born in']),standing:new Set(['factual']),window:null};
  const second={relations:new Set(['lived in','born in']),standing:new Set(['factual','mythic']),window:null};
  const stack=stackWithChoices();
  const scene=sceneWith();
  api.material.applyResearchMaterial(scene,{type:'place-layers-set',value:api.views.layersRecordOf(first,stack)});
  const firstRecord=roundTrip(scene.research.placeLayers);
  api.material.applyResearchMaterial(scene,{type:'place-layers-set',value:api.views.layersRecordOf(second,stack)});
  // An undo writes the earlier record back into the Scene; the view's key (what it last wrote) is the second one.
  const viewKey=api.views.layersKey(second,stack);
  const undone=api.views.restoreLayers(firstRecord);
  assert.notEqual(api.views.layersKey(undone.filter,undone.stack),viewKey,'the Scene now differs from the last write, so it is re-adopted');
  assert.equal(api.views.layersKey(undone.filter,undone.stack),api.views.layersKey(first,stack));
  assert.deepEqual([...undone.filter.relations].sort(),['born in']);
});

test('T-REVIEW-4 #3: the view re-adopts only when no write is pending or in flight, and records the key it wrote or adopted', ()=>{
  const source=read(resolve(engine,'src/researchInstruments.tsx'));
  const body=code(source);
  // the adoption rule: a stored key that differs from the view's own, with nothing pending and nothing in flight
  assert.match(body,/const sceneLayersKey=layersKey\(restoredLayers\.filter,restoredLayers\.stack\);/);
  assert.match(body,/if\(state\.placeLayersKey===undefined\)state\.placeLayersKey=sceneLayersKey;/,'the first visit records the Scene key');
  assert.match(body,/else if\(!state\.placeLayersSave&&!state\.placeLayersWrites&&sceneLayersKey!==state\.placeLayersKey\)\{/,'a different key re-adopts only when nothing is pending or in flight');
  assert.match(body,/state\.placeFilter=restoredLayers\.filter;state\.livePlaces=\{\.\.\.state\.livePlaces!,stack:restoredLayers\.stack\};state\.placeLayersKey=sceneLayersKey;/);
  // the write records its key when acknowledged and counts as in flight until it settles
  assert.match(body,/state\.placeLayersWrites=\(state\.placeLayersWrites\?\?0\)\+1;/);
  assert.match(body,/\.then\(\(\)=>\{state\.placeLayersKey=key;\},error=>message\(/);
  assert.match(body,/\.finally\(\(\)=>\{state\.placeLayersWrites=\(state\.placeLayersWrites\?\?1\)-1;\}\);/);
  // the live-source allowance is never re-adopted
  assert.doesNotMatch(body.slice(body.indexOf('const sceneLayersKey'),body.indexOf('const sceneLayersKey')+500),/allowed/);
});

test('T-REVIEW-4 #7: a pending layers write is flushed at close, at load, and first in destroy, before anything is disposed', ()=>{
  const source=read(resolve(engine,'src/researchInstruments.tsx'));
  const body=code(source);
  assert.match(body,/function flushPlaceLayers\(\)\{for\(const pending of views\.values\(\)\)pending\.placeLayersSave\?\.write\(\);\}/);
  assert.match(body,/async function load\(selected:ResearchInstrument\)\{\s*flushPlaceLayers\(\);/,'load flushes before it reads the Scene');
  assert.match(body,/close\(\)\{flushPlaceLayers\(\);\+\+epoch;/,'close flushes first');
  const destroy=body.slice(body.indexOf('destroy(){'),body.indexOf('destroy(){')+200);
  assert.ok(destroy.startsWith('destroy(){flushPlaceLayers();++epoch;'),'destroy flushes before its first disposal');
  assert.ok(destroy.indexOf('flushPlaceLayers')<destroy.indexOf('unmount()')&&destroy.indexOf('flushPlaceLayers')<destroy.indexOf('mount.remove()'));
  // the app's dispose runs the instrument's destroy before the native editor endpoint is disposed
  const app=read(resolve(engine,'src/app.ts'));
  const dispose=app.indexOf('dispose:()=>{sceneTransportAlive=false');
  assert.ok(dispose>0);
  const research=app.indexOf('researchInstruments?.destroy();nativeEditorEndpoint?.dispose();',dispose);
  assert.ok(research>dispose&&research-dispose<400,'the instrument is destroyed before the endpoint is disposed');
  assert.doesNotMatch(app.slice(dispose,dispose+400),/nativeEditorEndpoint\?\.dispose\(\);researchInstruments/);
});
