/** Places views — lane-4 T20 (a named view: camera, layer toggles, basemap rows, shared time window) and the
 * Scene-material law it lives under. Pure proof through the esbuild-in-tmp pattern of `places-basemap.test.mjs`,
 * plus source reads of the map's restore path, the Places host wiring and the kernel's validator.
 *
 * Covers: capture then restore is exact (camera with pitch and bearing, relations, standing, every basemap row with
 * its opacity, terrain, window); an absent record restores today's defaults; a captured camera is wrapped and
 * clamped into the globe the material validates; a restore never grants a live source (the composed plan draws
 * nothing while the owner has not allowed live sources); the name rules and the 32-view bound; the material's closed
 * bounds; save and remove touch only placeViews, and a refused save leaves the Scene byte-identical; the kernel
 * holds the same closed lists (read from its Rust source).
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
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-views-'));
 try{
  const out=join(temporary,'places-views.mjs');
  const entries={
   views:resolve(engine,'src/placeViews.ts'),
   material:resolve(engine,'src/researchMaterial.ts'),
   basemap:resolve(canvasDir,'basemapLayers.ts'),
   sources:resolve(canvasDir,'basemapSources.ts'),
   navigation:resolve(canvasDir,'placeNavigation.ts'),
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
const camera={latitude:48.85,longitude:2.35,zoom:11,pitch:40,bearing:-20};
const openFilter={relations:null,standing:null,window:null};
const ids=new Set();

function stackWithChoices(){
 let stack=api.basemap.defaultBasemapStack();
 stack=api.basemap.setBasemapVisible(stack,'osm-street',true);
 stack=api.basemap.setBasemapOpacity(stack,'osm-street',0.4);
 stack=api.basemap.setBasemapVisible(stack,'esri-imagery',true);
 stack=api.basemap.setBasemapOpacity(stack,'offline-ground',0.8);
 return api.basemap.setTerrainVisible(stack,true);
}

test('a view restores its camera, layer toggles, basemap rows and window exactly', ()=>{
 const stack=stackWithChoices();
 const filter={relations:new Set(['born in','lived in']),standing:new Set(['factual']),window:null};
 const saved=roundTrip(api.views.capturePlaceView({viewState:camera,filter,stack,window:{from:'1900-01-01',to:null}}));
 assert.deepEqual(saved.viewport,{x:2.35,y:48.85,zoom:11,pitch:40,bearing:-20});
 assert.deepEqual(saved.relations,['born in','lived in']);
 assert.deepEqual(saved.standing,['factual']);
 assert.deepEqual(saved.window,{from:'1900-01-01',to:null});
 const plan=api.views.restorePlaceView(saved);
 assert.deepEqual(plan.viewState,camera);
 assert.deepEqual([...plan.filter.relations].sort(),['born in','lived in']);
 assert.deepEqual([...plan.filter.standing],['factual']);
 assert.equal(plan.filter.window,null,'the shared window is carried by the view, not the filter');
 for(const id of Object.keys(stack.layers))assert.deepEqual(plan.stack.layers[id],stack.layers[id],`row ${id}`);
 assert.equal(plan.stack.terrainVisible,true);
 assert.deepEqual(plan.window,{from:'1900-01-01',to:null});
 assert.doesNotThrow(()=>api.material.validatePlaceView(saved));
});

test('an untilted camera and open layers stay out of the record', ()=>{
 const view=api.views.capturePlaceView({viewState:{latitude:20,longitude:0,zoom:1},filter:openFilter,stack:api.basemap.defaultBasemapStack(),window:null});
 assert.equal('pitch' in view.viewport,false);
 assert.equal('bearing' in view.viewport,false);
 assert.equal(view.relations,undefined);
 assert.equal(view.standing,undefined);
 assert.equal(view.window,null);
});

test('an absent record restores today\'s defaults: every layer on, the offline ground only, no window', ()=>{
 const plan=api.views.restorePlaceView({viewport:{x:0,y:20,zoom:1},window:null});
 assert.equal(plan.filter.relations,null);
 assert.equal(plan.filter.standing,null);
 assert.deepEqual(plan.stack,api.basemap.defaultBasemapStack());
 assert.equal(plan.window,null);
 assert.deepEqual(plan.viewState,{latitude:20,longitude:0,zoom:1,pitch:0,bearing:0});
});

test('a captured camera is wrapped and clamped into the globe the material validates', ()=>{
 const view=api.views.capturePlaceView({viewState:{latitude:120,longitude:370,zoom:3},filter:openFilter,stack:api.basemap.defaultBasemapStack(),window:null});
 assert.equal(view.viewport.x,10);
 assert.equal(view.viewport.y,90);
 assert.doesNotThrow(()=>api.material.validatePlaceView(roundTrip(view)));
});

test('a restore never grants a live source: restored rows draw nothing until the owner allows them', ()=>{
 const restored=api.views.restorePlaceView(roundTrip(api.views.capturePlaceView({viewState:camera,filter:openFilter,stack:stackWithChoices(),window:null})));
 // the view kept the live rows on, and that is all a restore sets
 assert.equal(restored.stack.layers['osm-street'].visible,true);
 const ownerOff={offlineOnly:true,hasPolicy:true,optedIn:false};
 const plan=api.basemap.composeBasemapPlan(restored.stack,ownerOff,{});
 assert.deepEqual(plan.rasters,[],'no live imagery is requested');
 assert.equal(plan.terrain,null,'no terrain is requested');
 const policyOnly={offlineOnly:false,hasPolicy:true,optedIn:false};
 assert.deepEqual(api.basemap.composeBasemapPlan(restored.stack,policyOnly,{}).rasters,[],'a policy alone does not open the gate');
});

test('the restore path reaches no live-source switch, and the view module keeps no browser storage', ()=>{
 const views=read(resolve(engine,'src/placeViews.ts'));
 assert.doesNotMatch(code(views),/requestLiveAction|optIn|optOut|allowed|grantLive/);
 assert.doesNotMatch(views,/localStorage|sessionStorage/);
 const map=read(resolve(canvasDir,'PsychogeographicMap.tsx'));
 const from=map.indexOf('placeViewRestoreRef.current = (target');
 const to=map.indexOf('useEffect(() => {\n    onRegisterPlaceViewRestore',from);
 assert.ok(from>0&&to>from,'the restore body is located');
 assert.doesNotMatch(code(map.slice(from,to)),/grantLive|requestLiveAction|optIn|tileRefreshOptedIn\s*=/);
 const host=read(resolve(engine,'src/researchInstruments.tsx'));
 const apply=host.slice(host.indexOf('const applyPlaceView='),host.indexOf('const removePlaceView='));
 assert.ok(apply.length>200,'the host restore is located');
 assert.doesNotMatch(code(apply),/optIn|optOut|requestLiveAction|\.allowed\s*=|allowed:/);
});

test('a view is named in one to 160 characters, and at most 32 are kept', ()=>{
 assert.match(api.views.placeViewNameProblem('   ',{}),/Name the view first/);
 assert.match(api.views.placeViewNameProblem('x'.repeat(161),{}),/at most 160/);
 assert.equal(api.views.placeViewNameProblem('x'.repeat(160),{}),null);
 const full=Object.fromEntries(Array.from({length:32},(_,i)=>[`v${i}`,{}]));
 assert.match(api.views.placeViewNameProblem('new',full),/at most 32/);
 assert.equal(api.views.placeViewNameProblem('v3',full),null,'an existing name is replaced, not added');
});

test('a material with place views is admitted closed and bounded; one without them is unchanged', ()=>{
 assert.doesNotThrow(()=>api.material.validateResearchMaterial(roundTrip(api.material.emptyResearchMaterial()),ids));
 const named=api.views.capturePlaceView({viewState:camera,filter:{relations:new Set(['born in']),standing:null,window:null},stack:stackWithChoices(),window:{from:'1900',to:null}});
 const withViews={...api.material.emptyResearchMaterial(),placeViews:{'Paris at dusk':named}};
 assert.doesNotThrow(()=>api.material.validateResearchMaterial(roundTrip(withViews),ids));
 const refused=[
  {...named,extra:1},
  {viewport:{...named.viewport,roll:1},window:null},
  {...named,viewport:{...named.viewport,x:200}},
  {...named,viewport:{...named.viewport,pitch:86}},
  {...named,standing:['canonical']},
  {...named,basemap:{...named.basemap,layers:{...named.basemap.layers,'bing-aerial':{visible:true,opacity:1}}}},
  {...named,basemap:{...named.basemap,layers:{'osm-street':{visible:true,opacity:1.5}}}},
  {...named,window:{from:'x'.repeat(65),to:null}},
  {...named,window:{from:null,to:null,axis:1}},
 ];
 for(const view of refused)assert.throws(()=>api.material.validateResearchMaterial({...withViews,placeViews:{v:view}},ids),undefined,JSON.stringify(view).slice(0,140));
 const many=Object.fromEntries(Array.from({length:33},(_,i)=>[`v${i}`,{viewport:{x:0,y:0,zoom:1},window:null}]));
 assert.throws(()=>api.material.validateResearchMaterial({...api.material.emptyResearchMaterial(),placeViews:many},ids),undefined,'33 views');
 // a name is 1 to 160 UTF-16 units: 80 emoji (160 units) are admitted, 81 are refused
 const place={viewport:{x:0,y:0,zoom:1},window:null};
 assert.doesNotThrow(()=>api.material.validateResearchMaterial({...api.material.emptyResearchMaterial(),placeViews:{['\u{1F600}'.repeat(80)]:place}},ids));
 assert.throws(()=>api.material.validateResearchMaterial({...api.material.emptyResearchMaterial(),placeViews:{['\u{1F600}'.repeat(81)]:place}},ids));
});

test('saving or removing a place view touches only placeViews, and a refused save leaves the Scene as it was', ()=>{
 const scene={id:'scene-1',name:'Scene',entities:[{id:'e1',name:'Object'}],research:{...api.material.emptyResearchMaterial(),
  namedViews:{'canvas view':{viewport:{x:1,y:2,zoom:3},selectedRefs:[],frameOrder:[]}}}};
 const before=JSON.stringify(scene);
 const view=api.views.capturePlaceView({viewState:camera,filter:openFilter,stack:stackWithChoices(),window:null});
 api.material.applyResearchMaterial(scene,{type:'view-save',name:'Paris',place:view});
 assert.deepEqual(Object.keys(scene.research.placeViews),['Paris']);
 assert.deepEqual(scene.research.namedViews,JSON.parse(before).research.namedViews,'the canvas views are untouched');
 assert.deepEqual(scene.entities,JSON.parse(before).entities);
 const saved=JSON.stringify(scene);
 assert.throws(()=>api.material.applyResearchMaterial(scene,{type:'view-save',name:'   ',place:view}),/Invalid view name/);
 assert.equal(JSON.stringify(scene),saved,'a blank name writes nothing');
 assert.throws(()=>api.material.applyResearchMaterial(scene,{type:'view-save',name:'bad',place:{...view,extra:1}}));
 assert.equal(JSON.stringify(scene),saved,'a view the bounds refuse writes nothing');
 api.material.applyResearchMaterial(scene,{type:'view-remove',name:'Paris',scope:'place'});
 assert.equal(scene.research.placeViews,undefined,'the last place view leaves no empty record');
 assert.deepEqual(scene.entities,JSON.parse(before).entities,'the Scene is intact after a delete');
 assert.ok(scene.research.namedViews['canvas view'],'a canvas view is not removed by a place delete');
 api.material.applyResearchMaterial(scene,{type:'view-remove',name:'canvas view'});
 assert.equal(scene.research.namedViews['canvas view'],undefined,'a remove without a scope still removes the canvas view');
});

test('the kernel holds the same closed lists the app does, and admits the same record', ()=>{
 const kernel=read(kernelSource);
 const list=(name)=>{
  const match=kernel.match(new RegExp(`const ${name}: &\\[&str\\] = &\\[([\\s\\S]*?)\\];`));
  assert.ok(match,`${name} is declared`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(entry=>entry[1]);
 };
 assert.deepEqual(list('BASEMAP_LAYER_IDS'),[api.sources.OFFLINE_GROUND_ID,...api.sources.LIVE_BASEMAP_SOURCES.map(source=>source.id)]);
 assert.deepEqual(list('PLACE_STANDINGS'),['factual','mythic','owner-vocabulary']);
 assert.match(kernel,/"connectors",\s*"placeViews",/,'the top-level keys admit placeViews');
 assert.match(kernel,/fn place_views_are_admitted_bounded_and_closed\(\)/);
});

test('the Places host saves and goes to a view through the material path, and the map restore is registered', ()=>{
 const host=read(resolve(engine,'src/researchInstruments.tsx'));
 assert.match(host,/type:'view-save',name,place:record/);
 assert.match(host,/type:'view-remove',name,scope:'place'/);
 assert.match(host,/onRegisterPlaceViewRestore=\{restore=>\{restoreViewOnMap=restore;\}\}/);
 assert.match(host,/aria-label="Saved place views"/);
 const map=read(resolve(canvasDir,'PsychogeographicMap.tsx'));
 assert.match(map,/onRegisterPlaceViewRestore\?: \(restore: \(target: PlaceViewRestoreTarget\) => void\) => void;/);
});

test('the place-view styles are scoped under the instrument and read the instrument tokens', ()=>{
 const css=read(resolve(engine,'src/researchInstrumentStyles.css'));
 const rules=css.split('\n').filter(line=>line.includes('research-places-view-'));
 assert.ok(rules.length>=2);
 for(const rule of rules)assert.match(rule,/^:where\(\.research-instrument\) \.research-places-view-/);
 assert.doesNotMatch(rules.join('\n'),/#[0-9a-f]{3,8}\b/i,'tokens only, no raw colours');
});
