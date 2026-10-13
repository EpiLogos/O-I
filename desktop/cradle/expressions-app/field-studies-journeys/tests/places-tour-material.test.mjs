/** Places tours in the Scene — lane-4 T25–T26 saved per Scene through the native material path, as named views are.
 *
 * Covers: a saved tour is kept under its trimmed name, reads back closed and is admitted by the material validator; a
 * refused save (33 stops, a forbidden temporal key on a stop, an unknown key, a blank or reserved name, a 17th tour)
 * writes nothing; removing a tour touches only placeTours and the last removal leaves no empty record; the undo labels
 * name both actions; a binding is written as withStopBinding plus a save, and when the journey no longer holds the beat
 * the saved stop stays intact and the read is unbound; the Places host saves and removes through host.material; the
 * kernel admits the same closed record and holds the same bounds (read from its Rust source).
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
const kernelSource=resolve(engine,'../../kernel/src/expression_scene.rs');
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-tour-material-'));
 try{
  const out=join(temporary,'places-tour-material.mjs');
  const entries={
   tours:resolve(engine,'src/placeTours.ts'),
   material:resolve(engine,'src/researchMaterial.ts'),
   labels:resolve(engine,'src/undoLabels.ts'),
   beats:resolve(engine,'../../src/techne/m0m5/journey/beats.ts'),
  };
  const contents=Object.entries(entries).map(([name,file])=>`export * as ${name} from ${JSON.stringify(file)};`).join('\n');
  await build({stdin:{contents,resolveDir:engine},tsconfig:engine+'/tsconfig.json',bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning'});
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const roundTrip=(value)=>JSON.parse(JSON.stringify(value));
const ids=new Set(['e1']);
const paris={latitude:48.85,longitude:2.35,zoom:11,pitch:40,bearing:-20};
const lyon={latitude:45.76,longitude:4.84,zoom:12.5};
const rome={latitude:41.9,longitude:12.5,zoom:9,pitch:0,bearing:0};
const sceneRef='oi.expression:expr:1:scene:arrival';

function threeStopTour(){
 let tour={stops:[]};
 tour=api.tours.appendTourStop(tour,api.tours.captureTourStop({viewState:paris,placeRef:null,caption:'Arrive by the river',holdMs:4000})).record;
 tour=api.tours.appendTourStop(tour,api.tours.captureTourStop({viewState:lyon,placeRef:null,caption:'The confluence',holdMs:2500})).record;
 tour=api.tours.appendTourStop(tour,api.tours.captureTourStop({viewState:rome,placeRef:null,caption:null,holdMs:0})).record;
 return tour;
}
function freshScene(){
 return {id:'scene-1',name:'Scene',entities:[{id:'e1',name:'Object'}],research:{...api.material.emptyResearchMaterial(),
  namedViews:{'canvas view':{viewport:{x:1,y:2,zoom:3},selectedRefs:[],frameOrder:[]}},
  placeViews:{Paris:{viewport:{x:2.35,y:48.85,zoom:11},window:null}}}};
}

test('a saved tour is kept per Scene under its trimmed name, reads back closed and passes the material validator', ()=>{
 const scene=freshScene();
 api.material.applyResearchMaterial(scene,{type:'place-tour-save',name:'  Paris walk  ',tour:threeStopTour()});
 assert.deepEqual(Object.keys(scene.research.placeTours),['Paris walk']);
 const saved=roundTrip(scene.research);
 assert.doesNotThrow(()=>api.material.validateResearchMaterial(saved,ids));
 assert.deepEqual(saved.placeTours['Paris walk'],threeStopTour());
 assert.equal(api.tours.placeTourProblem(saved.placeTours['Paris walk']),null);
});

test('a refused tour save writes nothing: the bounds, the forbidden keys and the name rules refuse by name', ()=>{
 const scene=freshScene();
 api.material.applyResearchMaterial(scene,{type:'place-tour-save',name:'Paris walk',tour:threeStopTour()});
 const before=JSON.stringify(scene);
 const stop=threeStopTour().stops[0];
 const refused=[
  ['33 stops',{stops:Array.from({length:33},()=>stop)}],
  ['a stop carrying a window',{stops:[{...stop,window:{from:'1900',to:null}}]}],
  ['a stop carrying a temporal key',{stops:[{...stop,temporal:{from:'1900',to:null}}]}],
  ['a stop carrying a route id',{stops:[{...stop,route_id:'r1'}]}],
  ['an empty tour',{stops:[]}],
  ['a caption of 281 characters',{stops:[{...stop,caption:'x'.repeat(281)}]}],
 ];
 for(const [what,tour] of refused){
  assert.throws(()=>api.material.applyResearchMaterial(scene,{type:'place-tour-save',name:'Next',tour}),undefined,what);
  assert.equal(JSON.stringify(scene),before,`${what} writes nothing`);
 }
 assert.throws(()=>api.material.applyResearchMaterial(scene,{type:'place-tour-save',name:'   ',tour:threeStopTour()}),/Name the tour first/);
 assert.throws(()=>api.material.applyResearchMaterial(scene,{type:'place-tour-save',name:'constructor',tour:threeStopTour()}),/reserved/);
 assert.equal(JSON.stringify(scene),before,'a blank or reserved name writes nothing');
 for(let i=1;i<api.tours.TOUR_LIMIT;i++)api.material.applyResearchMaterial(scene,{type:'place-tour-save',name:`t${i}`,tour:threeStopTour()});
 assert.throws(()=>api.material.applyResearchMaterial(scene,{type:'place-tour-save',name:'one more',tour:threeStopTour()}),/at most 16/);
 assert.equal(Object.keys(scene.research.placeTours).length,api.tours.TOUR_LIMIT);
 api.material.applyResearchMaterial(scene,{type:'place-tour-save',name:'t1',tour:threeStopTour()});
 assert.equal(Object.keys(scene.research.placeTours).length,api.tours.TOUR_LIMIT,'re-saving an existing name is not a new tour');
});

test('removing a tour touches only placeTours; the last removal leaves no empty record', ()=>{
 const scene=freshScene();
 api.material.applyResearchMaterial(scene,{type:'place-tour-save',name:'Walk',tour:threeStopTour()});
 assert.ok(scene.research.placeTours?.Walk,'the tour is saved before it is removed');
 const withTour=roundTrip(scene);
 api.material.applyResearchMaterial(scene,{type:'place-tour-remove',name:'Walk'});
 assert.equal(scene.research.placeTours,undefined,'the last tour leaves no empty record');
 assert.deepEqual(scene.research.placeViews,withTour.research.placeViews,'place views are untouched');
 assert.deepEqual(scene.research.namedViews,withTour.research.namedViews,'canvas views are untouched');
 assert.deepEqual(scene.entities,withTour.entities);
});

test('the undo history names the two tour actions', ()=>{
 assert.equal(api.labels.researchMaterialLabel({type:'place-tour-save'}),'Save place tour');
 assert.equal(api.labels.researchMaterialLabel({type:'place-tour-remove'}),'Remove place tour');
});

test('a binding is written as withStopBinding plus a save; when the journey no longer holds the beat the saved stop stays intact', ()=>{
 const reading=(scenes)=>({subject:{subject_ref:'subject:pilgrim'},temporal:[],spatial:[],provenance:[],
  expressions:scenes,disclosure:{instruments:[]}});
 const beat=api.beats.beats(reading([{expression_ref:'expr:1',revision:'2',scene_ref:sceneRef}])).beats[0];
 const scene=freshScene();
 api.material.applyResearchMaterial(scene,{type:'place-tour-save',name:'Walk',tour:threeStopTour()});
 const bound=api.tours.withStopBinding(scene.research.placeTours.Walk,1,{expression_ref:beat.expression_ref,scene_ref:beat.scene_ref});
 api.material.applyResearchMaterial(scene,{type:'place-tour-save',name:'Walk',tour:bound});
 assert.deepEqual(scene.research.placeTours.Walk.stops[1].binding,{expression_ref:'expr:1',scene_ref:sceneRef});
 assert.equal('binding' in scene.research.placeTours.Walk.stops[0],false,'the other stops keep no binding');
 const saved=JSON.stringify(scene.research.placeTours);
 // the journey deletes the beat: the read is unbound, and the saved stop is the same bytes
 const states=api.tours.resolveTourBindings(scene.research.placeTours.Walk,api.beats.beats(reading([])).beats);
 assert.equal(states[1].state,'unbound');
 assert.equal(JSON.stringify(scene.research.placeTours),saved,'the read never writes the stop');
 // clearing the binding is a save with no binding key left behind
 const cleared=api.tours.withStopBinding(scene.research.placeTours.Walk,1,null);
 api.material.applyResearchMaterial(scene,{type:'place-tour-save',name:'Walk',tour:cleared});
 assert.equal('binding' in scene.research.placeTours.Walk.stops[1],false);
});

test('the Places host saves, removes and binds tours through host.material, and the kernel admits the same record', ()=>{
 const host=readFileSync(resolve(engine,'src/researchInstruments.tsx'),'utf8');
 assert.match(host,/type:'place-tour-save',name,tour/);
 assert.match(host,/type:'place-tour-remove',name/);
 assert.match(host,/withStopBinding\(/);
 const kernel=readFileSync(kernelSource,'utf8');
 assert.match(kernel,/"timelineViews",\s*"placeTours",/);
 assert.match(kernel,/fn place_tour\(/);
 assert.match(kernel,/fn place_tours_are_admitted_bounded_and_closed\(\)/);
 assert.match(kernel,new RegExp(`const TOUR_STOP_LIMIT: usize = ${api.tours.TOUR_STOP_LIMIT};`));
 assert.match(kernel,new RegExp(`const TOUR_CAPTION_MAX: usize = ${api.tours.TOUR_CAPTION_MAX};`));
 assert.match(kernel,new RegExp(`const TOUR_HOLD_MAX_MS: f64 = ${api.tours.TOUR_HOLD_MAX_MS}\\.0;`));
});
