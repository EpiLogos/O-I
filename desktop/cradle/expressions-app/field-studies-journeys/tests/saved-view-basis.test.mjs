// lane-1 D2: a saved view names the subject it was composed against. Applying it from a Scene that reads another
// subject says so in the same one status sentence B4 already writes; a view without a basis (saved before the basis
// existed) and a Scene whose subject is unknown behave exactly as they did.
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
 temporary=await mkdtemp(join(tmpdir(),'oi-saved-view-basis-'));
 const out=join(temporary,'view-drift.mjs');
 await build({
  stdin:{contents:"export * from './src/viewDrift.ts';export * from './src/researchMaterial.ts';",resolveDir:engine},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
});
test.after(()=>rm(temporary,{recursive:true,force:true}));

const labels=ref=>ref==='b'?'Beta':undefined;
const basisOne={subject_ref:'expr:one',binding_ref:'scene:one'};
const basisTwo={subject_ref:'expr:two',binding_ref:'scene:two'};

test('a view without a basis gives exactly the B4 notice it gave before', ()=>{
 assert.equal(api.viewNotice('Overview',{},[],labels,{subject_ref:'subject:one'}),null);
 assert.equal(api.viewNotice('Overview',{},['b'],labels,{subject_ref:'subject:one'}),api.departedNotice('Overview',['b'],labels));
 assert.equal(api.viewNotice('Overview',{},['b'],labels,undefined),api.departedNotice('Overview',['b'],labels));
});

test('applying from the same subject applies cleanly with no basis sentence', ()=>{
 const view={basis:{subject_ref:'subject:one'}};
 assert.equal(api.viewNotice('Overview',view,[],labels,{subject_ref:'subject:one'}),null);
 assert.equal(api.viewNotice('Overview',view,['b'],labels,{subject_ref:'subject:one'}),api.departedNotice('Overview',['b'],labels));
});

test('applying against a different subject names both bases in one sentence', ()=>{
 const view={basis:{subject_ref:'subject:one'}};
 assert.equal(
  api.viewNotice('Overview',view,[],labels,{subject_ref:'subject:two'}),
  'View "Overview" was saved against subject:one; this Scene reads subject:two.',
 );
 assert.equal(
  api.viewNotice('Overview',view,['b'],labels,{subject_ref:'subject:two'}),
  'View "Overview" was saved against subject:one; this Scene reads subject:two, and since saving a member has left the Scene: Beta.',
 );
});

test('a Scene whose subject is unknown makes no basis claim', ()=>{
 assert.equal(api.viewNotice('Overview',{basis:{subject_ref:'subject:one'}},[],labels,null),null);
});

test('the B4 departed notice keeps its wording', ()=>{
 assert.equal(api.departedNotice('Overview',['b'],labels),'View "Overview" applied. Since saving, a member has left the Scene: Beta.');
 assert.equal(api.departedNotice('Overview',[],labels),null);
});

test('view-save stores the basis when given, and a view saved without one keeps exactly its legacy shape', ()=>{
 const scene={entities:[],research:api.emptyResearchMaterial()};
 api.applyResearchMaterial(scene,{type:'create-card',kind:'note',position:{x:0,y:0},title:'Alpha'});
 const id=scene.entities.at(-1).id;
 api.applyResearchMaterial(scene,{type:'view-save',name:'Bound',viewport:{x:1,y:2,zoom:1},selectedRefs:[id],frameOrder:[],basis:basisOne});
 api.applyResearchMaterial(scene,{type:'view-save',name:'Legacy',viewport:{x:1,y:2,zoom:1},selectedRefs:[id],frameOrder:[]});
 assert.deepEqual(scene.research.namedViews.Bound.basis,basisOne);
 assert.deepEqual(Object.keys(scene.research.namedViews.Legacy).sort(),['frameOrder','selectedRefs','viewport']);
 assert.doesNotThrow(()=>api.validateResearchMaterial(JSON.parse(JSON.stringify(scene.research)),new Set([id])));
});

test('the basis is closed: an unknown key, a missing ref or a non-object basis is refused', ()=>{
 assert.doesNotThrow(()=>api.validateViewBasis(basisOne));
 for(const bad of [{...basisOne,revision:3},{subject_ref:'expr:one'},{subject_ref:'',binding_ref:'scene:one'},{subject_ref:'expr:one',binding_ref:7},'expr:one',null]){
  assert.throws(()=>api.validateViewBasis(bad));
 }
});

test('the saved basis and the current Scene basis decide the notice: same subject is silent across bindings; a different subject is named', ()=>{
 const view={basis:basisOne,selectedRefs:[]};
 assert.equal(api.viewNotice('Bound',view,[],labels,{subject_ref:'expr:one',binding_ref:'scene:elsewhere'}),null);
 assert.equal(
  api.viewNotice('Bound',view,[],labels,basisTwo),
  'View "Bound" was saved against expr:one; this Scene reads expr:two.',
 );
});
