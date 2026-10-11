import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve, sep} from 'node:path';

// Real Node WebStorage, persisted to the caller's owned OS temporary file.
// Production authoring modules are compiled in memory; no app build is emitted.
const storageArg=process.execArgv.find(value=>value.startsWith('--localstorage-file='));
assert.ok(storageArg,'run with --experimental-webstorage --localstorage-file=<owned OS temporary file>');
const storageFile=resolve(storageArg.slice('--localstorage-file='.length));
assert.ok(storageFile.startsWith(resolve(tmpdir())+sep),'tests require an owned OS temporary storage file');
assert.equal(typeof localStorage.getItem,'function');
const root=new URL('../../../',import.meta.url),compiler=new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href;
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText}}`)}`,import.meta.url);
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{preserveRecoveryLibraryCopies},{readLibraryDetailed,saveToLibrary,STORAGE_KEY},{clone,validateJourney,blankJourney},{applyNativeGlyphChanges}]=await Promise.all([
 import(new URL('recoveryLibrary.ts',author)),import(new URL('store.ts',author)),import(new URL('model.ts',author)),import(new URL('hostEditor.ts',author)),
]);
const evidence='/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/native-recovery-conflict-reading-2026-10-08.json';
const receipt=JSON.parse(await readFile(evidence,'utf8'));
const draft=receipt.calls.find(call=>call.request.request.kind==='draft');
assert.equal(draft.status,200);assert.equal(draft.body.ok,true);assert.equal(draft.body.outcome.result,'expression_recovery');
assert.equal(draft.body.outcome.data.state,'ready');
const recovered=validateJourney(draft.body.outcome.data.record.value);
assert.equal(recovered.scenes[0].entities[0].sequence.steps[0].hold,2.35);
const edited=()=>applyNativeGlyphChanges(recovered,recovered.scenes[0].id,[{kind:'step-timing',entity_id:recovered.scenes[0].entities[0].id,step_id:recovered.scenes[0].entities[0].sequence.steps[0].id,hold:2.45}]);
const withoutForkMetadata=value=>{const copy=clone(value);delete copy.id;delete copy.updatedAt;return copy;};
beforeEach(()=>localStorage.clear());

test('real rich Glyph edit is retained as full ordinary Library fork before owner adoption',()=>{
 const local=edited(),original=clone(local),foreign=blankJourney();foreign.id='foreign-definition';foreign.ownerMaterial={unrecognised:['retain','verbatim']};
 saveToLibrary(foreign);saveToLibrary(local);
 const result=preserveRecoveryLibraryCopies(recovered),library=readLibraryDetailed();
 assert.equal(result.created_ids.length,1);assert.deepEqual(result.copy_ids,result.created_ids);
 const copy=library.journeys.find(row=>row.id===result.copy_ids[0]);
 assert.notEqual(copy.id,recovered.id);assert.equal(copy.name,local.name);
 assert.deepEqual(withoutForkMetadata(copy),withoutForkMetadata(local));
 assert.deepEqual(library.journeys.find(row=>row.id===local.id),original);
 assert.deepEqual(library.journeys.find(row=>row.id===foreign.id),foreign);
 assert.equal(copy.scenes[0].entities[0].sequence.steps[0].hold,2.45);
 assert.equal(copy.scenes[0].parameterRacks.racks.length,2);
 assert.deepEqual(copy.savedScenes,local.savedScenes);
 assert.deepEqual(copy.scenes[0].entities.map(row=>row.sequence.steps.map(step=>[step.id,step.layers,step.source,step.objectState])),local.scenes[0].entities.map(row=>row.sequence.steps.map(step=>[step.id,step.layers,step.source,step.objectState])));
 assert.deepEqual(recovered,validateJourney(draft.body.outcome.data.record.value));
});

test('same full authoring version ignores only top updatedAt and object key order',()=>{
 const local=clone(recovered);local.updatedAt='2000-01-01T00:00:00.000Z';
 const reordered=Object.fromEntries(Object.entries(local).reverse());saveToLibrary(reordered);
 const before=localStorage.getItem(STORAGE_KEY);
 assert.deepEqual(preserveRecoveryLibraryCopies(recovered),{copy_ids:[],created_ids:[]});
 assert.equal(localStorage.getItem(STORAGE_KEY),before);
});

test('repeated recovery reuses the exact equivalent copy without growing Library',()=>{
 saveToLibrary(edited());const first=preserveRecoveryLibraryCopies(recovered),before=localStorage.getItem(STORAGE_KEY);
 const next=preserveRecoveryLibraryCopies(recovered);
 assert.deepEqual(next,{copy_ids:first.copy_ids,created_ids:[]});assert.equal(localStorage.getItem(STORAGE_KEY),before);
 // Nested metadata is material; only the top timestamp is excluded.
 const changed=edited();changed.scenes[0].sourceMetadata={updatedAt:'different-source-time'};saveToLibrary(changed);
 const third=preserveRecoveryLibraryCopies(recovered);assert.equal(third.created_ids.length,1);assert.notEqual(third.copy_ids[0],first.copy_ids[0]);
});

test('all distinct same-ID definitions survive, while duplicate identical definitions reuse one copy',()=>{
 const first=edited(),second=edited();second.description+=' second authored definition';
 localStorage.setItem(STORAGE_KEY,JSON.stringify([first,second,clone(first)]));
 const result=preserveRecoveryLibraryCopies(recovered),after=readLibraryDetailed();
 assert.equal(result.created_ids.length,2);assert.equal(after.raw.length,5);
 assert.equal(after.journeys.filter(row=>row.id===recovered.id).length,3);
 assert.deepEqual(after.raw.slice(-3),[first,second,first]);
});

test('saved Scene-only divergence and maximum-length name remain complete valid data',()=>{
 const local=clone(recovered);local.name='x'.repeat(160);local.savedScenes[local.scenes[0].id].name+=' retained snapshot';saveToLibrary(local);
 const result=preserveRecoveryLibraryCopies(recovered),copy=readLibraryDetailed().journeys.find(row=>row.id===result.copy_ids[0]);
 assert.equal(copy.name.length,160);assert.equal(copy.name,local.name);
 assert.deepEqual(withoutForkMetadata(copy),withoutForkMetadata(local));validateJourney(copy);
});

test('distinct full names sharing a long prefix retain distinct forks through ordinary recovered Library save',()=>{
 const first=clone(recovered),second=clone(recovered);first.name='x'.repeat(159)+'A';second.name='x'.repeat(159)+'B';
 localStorage.setItem(STORAGE_KEY,JSON.stringify([first,second]));
 const result=preserveRecoveryLibraryCopies(recovered);
 assert.equal(result.created_ids.length,2,'distinct full authored names must retain separate copies');
 saveToLibrary(recovered);
 const remaining=readLibraryDetailed();
 assert.equal(remaining.journeys.filter(row=>result.copy_ids.includes(row.id)).length,2);
 assert.equal(remaining.journeys.filter(row=>row.id===recovered.id).length,1);
 const copies=remaining.journeys.filter(row=>result.copy_ids.includes(row.id));
 assert.deepEqual(copies.map(row=>row.name).sort(),[first.name,second.name].sort());
 for(const original of [first,second])assert.deepEqual(withoutForkMetadata(copies.find(row=>row.name===original.name)),withoutForkMetadata(original));
});

test('invalid or blocked Library retains exact raw bytes and refuses adoption',()=>{
 for(const raw of [JSON.stringify([edited(),{schema:'future-library-owner',id:recovered.id,payload:['keep']}]),'{broken',JSON.stringify({not:'an array'})]){
  localStorage.setItem(STORAGE_KEY,raw);
  assert.throws(()=>preserveRecoveryLibraryCopies(recovered),/unreadable material/);
  assert.equal(localStorage.getItem(STORAGE_KEY),raw);
 }
});

test('invalid incoming recovery makes no Library mutation',()=>{
 saveToLibrary(edited());const before=localStorage.getItem(STORAGE_KEY),invalid=clone(recovered);invalid.scenes[0].entities[0].sequence.steps[0].hold=Infinity;
 assert.throws(()=>preserveRecoveryLibraryCopies(invalid),/Non-finite/);assert.equal(localStorage.getItem(STORAGE_KEY),before);
});

test('actual durable WebStorage survives a second process with the complete retained Library',()=>{
 saveToLibrary(edited());preserveRecoveryLibraryCopies(recovered);
 const expected=createHash('sha256').update(localStorage.getItem(STORAGE_KEY)).digest('hex');
 const child=spawnSync(process.execPath,['--experimental-webstorage',`--localstorage-file=${storageFile}`,'--input-type=module','-e',`import {createHash} from 'node:crypto';const raw=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(!raw)throw Error('Library absent');console.log(createHash('sha256').update(raw).digest('hex'));`],{encoding:'utf8',timeout:10000});
 assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),expected);
});
