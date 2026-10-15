/** The Scene-material law for saved Places views (lane-4 T20), kept after the frame's Places map retired (T-PLACES-ONTO-ATLAS;
 * FOUNDATION §4 "Places is the Archetypal-Earth atlas, alone"). No surface writes a place view any more — Places is the shell's Earth
 * atlas — but a Scene saved before may hold them, and the material still admits them closed and bounded, and refuses anything else,
 * exactly as the kernel does. The map's capture and restore of a view retired with the map; what moved to the atlas is named in
 * desktop/cradle/docs/world-shell/wayfinder/tickets/T-PLACES-ONTO-ATLAS.md (T20).
 *
 * Pure proof through the esbuild-in-tmp pattern: the material module and the basemap registry it validates against, plus the kernel's
 * validator read from its Rust source.
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
  const entries={material:resolve(engine,'src/researchMaterial.ts'),sources:resolve(canvasDir,'basemapSources.ts')};
  const contents=Object.entries(entries).map(([name,file])=>`export * as ${name} from ${JSON.stringify(file)};`).join('\n');
  await build({stdin:{contents,resolveDir:engine},tsconfig:engine+'/tsconfig.json',bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning'});
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const read=(file)=>readFileSync(file,'utf8');
const roundTrip=(value)=>JSON.parse(JSON.stringify(value));
const ids=new Set();
/** A place view as the retired map saved one: camera with pitch and bearing, a relation layer, basemap rows, a window. */
const named={viewport:{x:2.35,y:48.85,zoom:11,pitch:40,bearing:-20},relations:['born in'],
 basemap:{terrainVisible:true,layers:{'offline-ground':{visible:true,opacity:0.8},'osm-street':{visible:true,opacity:0.4},'esri-imagery':{visible:true,opacity:1}}},
 window:{from:'1900',to:null}};

test('a material with place views is admitted closed and bounded; one without them is unchanged', ()=>{
 assert.doesNotThrow(()=>api.material.validateResearchMaterial(roundTrip(api.material.emptyResearchMaterial()),ids));
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
 const place={viewport:{x:0,y:0,zoom:1},window:null};
 assert.doesNotThrow(()=>api.material.validateResearchMaterial({...api.material.emptyResearchMaterial(),placeViews:{['\u{1F600}'.repeat(80)]:place}},ids));
 assert.throws(()=>api.material.validateResearchMaterial({...api.material.emptyResearchMaterial(),placeViews:{['\u{1F600}'.repeat(81)]:place}},ids));
});

test('removing a saved place view touches only placeViews, and a refused save leaves the Scene as it was', ()=>{
 const scene={id:'scene-1',name:'Scene',entities:[{id:'e1',name:'Object'}],research:{...api.material.emptyResearchMaterial(),
  namedViews:{'canvas view':{viewport:{x:1,y:2,zoom:3},selectedRefs:[],frameOrder:[]}}}};
 const before=JSON.stringify(scene);
 api.material.applyResearchMaterial(scene,{type:'place-view-save',name:'Paris',place:named});
 assert.deepEqual(Object.keys(scene.research.placeViews),['Paris']);
 assert.deepEqual(scene.research.namedViews,JSON.parse(before).research.namedViews,'the canvas views are untouched');
 const saved=JSON.stringify(scene);
 assert.throws(()=>api.material.applyResearchMaterial(scene,{type:'place-view-save',name:'   ',place:named}),/Invalid view name/);
 assert.equal(JSON.stringify(scene),saved,'a blank name writes nothing');
 assert.throws(()=>api.material.applyResearchMaterial(scene,{type:'place-view-save',name:'bad',place:{...named,extra:1}}));
 assert.equal(JSON.stringify(scene),saved,'a view the bounds refuse writes nothing');
 api.material.applyResearchMaterial(scene,{type:'place-view-remove',name:'Paris'});
 assert.equal(scene.research.placeViews,undefined,'the last place view leaves no empty record');
 assert.deepEqual(scene.entities,JSON.parse(before).entities,'the Scene is intact after a delete');
 assert.ok(scene.research.namedViews['canvas view'],'a canvas view is not removed by a place delete');
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

test('no Places view is written from the frame any more: Places is the shell\'s Earth atlas', ()=>{
 const instruments=read(resolve(engine,'src/researchInstruments.tsx'));
 assert.doesNotMatch(instruments,/place-view-save|place-layers-set|place-tour-save|PsychogeographicMap/);
 assert.match(instruments,/if\(selected==='m4'\)\{message\(PLACES_MOVED\)/,'asked for, the Places lens says where Places went');
});
