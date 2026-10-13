// lane-1 B4: honest drift on saved views. A named view keeps the refs it held
// when a member is removed; applying it reports the departed member once and
// the view still applies. Ported shape: the dead model's viewDrift
// (desktop/cradle/src/techne/m0m5/canvas/view.ts:142-149).
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
let temporary;
test.before(async()=>{
 temporary=await mkdtemp(join(tmpdir(),'oi-view-drift-'));
 const out=join(temporary,'view-drift.mjs');
 await build({
  stdin:{contents:"export * from './src/viewDrift.ts';export * from './src/researchMaterial.ts';",resolveDir:engine},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
});
test.after(()=>rm(temporary,{recursive:true,force:true}));

/** Three real occurrences, saved into one named view over all three. */
function sceneWithView(){
 const scene={entities:[],research:api.emptyResearchMaterial()};
 const refs=['Alpha','Beta','Gamma'].map(title=>{
  api.applyResearchMaterial(scene,{type:'create-card',kind:'note',position:{x:0,y:0},title});
  return scene.entities.at(-1).id;
 });
 api.applyResearchMaterial(scene,{type:'view-save',name:'Overview',viewport:{x:1,y:2,zoom:1},selectedRefs:refs,frameOrder:[]});
 return {scene,refs};
}

test('removing a member keeps its ref in the saved view (tombstone) and the material still validates', ()=>{
 const {scene,refs:[alpha,beta,gamma]}=sceneWithView();
 api.pruneResearchOccurrence(scene,beta);
 assert.deepEqual(scene.research.namedViews.Overview.selectedRefs,[alpha,beta,gamma]);
 assert.doesNotThrow(()=>api.validateResearchMaterial(scene.research,new Set([alpha,gamma])));
});

test('viewDrift reports exactly the members the Scene no longer places, once each, in saved order', ()=>{
 const view={selectedRefs:['a','b','c','b']};
 assert.deepEqual(api.viewDrift(view,new Set(['a','c'])).departed,['b']);
 assert.deepEqual(api.viewDrift(view,new Set(['a','b','c'])).departed,[]);
 assert.deepEqual(api.viewDrift(view,new Set()).departed,['a','b','c']);
});

test('the notice names the departed member in one sentence and is absent when nothing left', ()=>{
 assert.equal(api.departedNotice('Overview',[],()=>undefined),null);
 assert.equal(
  api.departedNotice('Overview',['b'],ref=>ref==='b'?'Beta':undefined),
  'View "Overview" applied. Since saving, a member has left the Scene: Beta.',
 );
 assert.match(api.departedNotice('Overview',['x'],()=>undefined),/: a removed card\.$/);
 assert.match(api.departedNotice('Overview',['a','b','c','d'],()=>'Card'),/4 members have left the Scene: Card, Card, Card and 1 more\.$/);
});

test('re-applying after a removal restores the remaining members and names only the departed one', ()=>{
 const {scene,refs:[alpha,beta,gamma]}=sceneWithView();
 scene.entities=scene.entities.filter(entity=>entity.id!==beta);
 api.pruneResearchOccurrence(scene,beta);
 const view=scene.research.namedViews.Overview;
 const present=new Set(scene.entities.map(entity=>entity.id));
 const {departed}=api.viewDrift(view,present);
 assert.deepEqual(departed,[beta]);
 const kept=view.selectedRefs.filter(ref=>present.has(ref));
 assert.deepEqual(kept,[alpha,gamma]);
 assert.equal(api.departedNotice('Overview',departed,ref=>ref===beta?'Beta':undefined),'View "Overview" applied. Since saving, a member has left the Scene: Beta.');
});
