/** One law, two validators (O-I #760): a recorded walk's stop and a kept Places view are judged by the frame's material law
 * (placeTourRecord.ts placeTourProblem, researchMaterial.ts validatePlaceView and validateResearchMaterial) and by the kernel's
 * (desktop/cradle/kernel/src/expression_scene.rs place_tour_stop, place_view). Both judge the same case list
 * (kernel/tests/fixtures/place-material-parity.json): each case is admitted by both or refused by both. The kernel's unit test
 * place_material_parity_cases_are_judged_as_the_frame_judges_them reads the same file, so a field one validator admits and the other
 * refuses turns one of the two tests red.
 *
 * A stop keeps a place, a moment (a window, the shared window's shape) and a thing (its owner's ref); a view keeps the camera, the
 * window and the atlas's filter in force (the atlas's own filter query, projections/atlas/src/shell/filter.ts filterQuery).
 *
 * Pure proof through the esbuild-in-tmp pattern (places-views.test.mjs).
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
const cases=JSON.parse(readFileSync(resolve(engine,'../../kernel/tests/fixtures/place-material-parity.json'),'utf8'));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-place-parity-'));
 try{
  const out=join(temporary,'place-parity.mjs');
  const entries={material:resolve(engine,'src/researchMaterial.ts'),tours:resolve(engine,'src/placeTourRecord.ts')};
  const contents=Object.entries(entries).map(([name,file])=>`export * as ${name} from ${JSON.stringify(file)};`).join('\n');
  await build({stdin:{contents,resolveDir:engine},tsconfig:engine+'/tsconfig.json',bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning'});
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const ids=new Set();
const laid=(base,over)=>({...structuredClone(base),...structuredClone(over)});
/** The frame's verdict on one stop, by both of its doors: the tour law alone, and the whole Scene material that carries the tour. */
function stopVerdict(stop){
 const law=api.tours.placeTourProblem({stops:[stop]})===null;
 let material=true;
 try{api.material.validateResearchMaterial({...api.material.emptyResearchMaterial(),placeTours:{Walk:{stops:[stop]}}},ids);}catch{material=false;}
 assert.equal(law,material,`the tour law and the material agree on ${JSON.stringify(stop).slice(0,120)}`);
 return law;
}
function viewVerdict(view){
 try{api.material.validateResearchMaterial({...api.material.emptyResearchMaterial(),placeViews:{View:view}},ids);return true;}catch{return false;}
}

test('the frame admits every stop the parity cases admit and refuses every stop they refuse', ()=>{
 const {base,admitted,refused}=cases.tour_stop;
 for(const row of admitted)assert.equal(stopVerdict(laid(base,row.with)),true,`admitted by the kernel, refused by the frame: ${row.what}`);
 for(const row of refused)assert.equal(stopVerdict(laid(base,row.with)),false,`refused by the kernel, admitted by the frame: ${row.what}`);
});

test('the frame admits every kept view the parity cases admit and refuses every view they refuse', ()=>{
 const {base,admitted,refused}=cases.place_view;
 for(const row of admitted)assert.equal(viewVerdict(laid(base,row.with)),true,`admitted by the kernel, refused by the frame: ${row.what}`);
 for(const row of refused)assert.equal(viewVerdict(laid(base,row.with)),false,`refused by the kernel, admitted by the frame: ${row.what}`);
});

test('the kernel reads the same case list, and a moment holds the shared window\'s shape', ()=>{
 const kernel=readFileSync(kernelSource,'utf8');
 assert.match(kernel,/include_str!\("\.\.\/tests\/fixtures\/place-material-parity\.json"\)/,'the kernel\'s test reads this file');
 assert.match(kernel,/fn place_material_parity_cases_are_judged_as_the_frame_judges_them\(\)/);
 assert.ok(cases.tour_stop.admitted.length>=8&&cases.tour_stop.refused.length>=12&&cases.place_view.refused.length>=8,'the list covers the new fields');
 // A moment is a window as the shared window holds one (techne/contract.ts DisclosureSession.time_window): from and to, each a string or null.
 const moment={from:'1900-01-01T00:00:00Z',to:null};
 const view={...cases.place_view.base,window:moment};
 assert.equal(viewVerdict(view),true,'a view\'s window');
 assert.equal(stopVerdict({...cases.tour_stop.base,moment}),true,'is a stop\'s moment');
});
