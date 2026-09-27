// Following a kernel Expression (Factory Live, host open-expression, the boot
// `?expression=` deep link): the frame stands on the opened document, a clean
// refresh re-reads and never commits, edits are kept and the newer revision
// disclosed, and an act-performed Expression is read-through.
// Compiles the pure module on the fly: `node --test tests/native-follow.test.mjs`.
import test from 'node:test';import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'oi-follow-test-'));
await build({absWorkingDir:root,entryPoints:['src/nativeFollow.ts'],bundle:true,format:'esm',platform:'node',target:'es2022',outfile:path.join(out,'nativeFollow.mjs'),logLevel:'silent'});
const f=await import(pathToFileURL(path.join(out,'nativeFollow.mjs')).href);
test.after(()=>fs.rmSync(out,{recursive:true,force:true}));
const run='expression:run-1';

test('a frame not standing on the reference follows it (boot deep link, open-expression)',()=>{
 assert.deepEqual(f.refreshStep({openRef:null,reference:run,kernelRevision:47,edited:false,pending:false}),{kind:'follow'});
 assert.deepEqual(f.refreshStep({openRef:'expression:local-draft',reference:run,localRevision:3,kernelRevision:47,edited:true,pending:false}),{kind:'follow'},'a local draft never stands in for the requested Expression');
});

test('a clean refresh adopts the newer kernel revision and never commits',()=>{
 assert.deepEqual(f.refreshStep({openRef:run,reference:run,localRevision:46,kernelRevision:47,edited:false,pending:false}),{kind:'adopt'});
 assert.deepEqual(f.refreshStep({openRef:run,reference:run,localRevision:47,kernelRevision:47,edited:false,pending:false}),{kind:'current'});
 assert.deepEqual(f.refreshStep({openRef:run,reference:run,localRevision:47,kernelRevision:47,edited:true,pending:false}),{kind:'current'},'nothing moved: edits stay as they are');
});

test('local edits are kept and the newer revision is disclosed, not committed',()=>{
 assert.deepEqual(f.refreshStep({openRef:run,reference:run,localRevision:46,kernelRevision:48,edited:true,pending:false}),{kind:'disclose',localRevision:46,kernelRevision:48});
 assert.deepEqual(f.refreshStep({openRef:run,reference:run,localRevision:46,kernelRevision:48,edited:false,pending:true}).kind,'disclose');
});

test('conversion bookkeeping is not an edit; a real composition change after load is',()=>{
 assert.equal(f.hasLocalEdits(5,5,3),false,'no store change since the native view loaded');
 assert.equal(f.hasLocalEdits(5,6,0),false,'a store change with no composition difference');
 assert.equal(f.hasLocalEdits(5,6,1),true);
});

test('a running or held act makes the Expression read-through; ended acts do not',()=>{
 assert.equal(f.performedByLiveAct([{expression_ref:run,phase:'running'}],run),true);
 assert.equal(f.performedByLiveAct([{expression_ref:run,phase:'held'}],run),true);
 assert.equal(f.performedByLiveAct([{expression_ref:run,phase:'completed'},{expression_ref:'expression:other',phase:'running'}],run),false);
});

test('opening a native Expression closes the entry gate and presents its current Scene',()=>{
 const view={startSceneId:'scene-live',journey:{scenes:[{id:'scene-intro'},{id:'scene-live'}]}};
 assert.deepEqual(f.presentAdoption(view),{closeEntryGate:true,sceneId:'scene-live'});
 assert.deepEqual(f.presentAdoption({startSceneId:null,journey:{scenes:[{id:'scene-intro'}]}}),{closeEntryGate:true,sceneId:'scene-intro'});
 assert.deepEqual(f.presentAdoption({startSceneId:'gone',journey:{scenes:[{id:'scene-intro'}]}}).sceneId,'scene-intro');
 assert.throws(()=>f.presentAdoption({startSceneId:null,journey:{scenes:[]}}),/no Scene/);
});

test('set-aside unsaved work gets its own recovery identity',()=>{
 const id=f.retainedDraftId('expression:run-1',1790000000000);
 assert.equal(id,'expression:run-1.unsaved-1790000000000');
 assert.match(id,/^[a-zA-Z0-9_.:-]{1,160}$/);
 assert.notEqual(id,'expression:run-1');
});

test('a read-through (act-performed) Expression opens no authoring panel over the stage',()=>{
 assert.deepEqual(f.followedPanels(true),{sequence:false,inspector:false});
 assert.deepEqual(f.followedPanels(false),{sequence:null,inspector:null},'an ordinary open leaves the panels as the person had them');
});
