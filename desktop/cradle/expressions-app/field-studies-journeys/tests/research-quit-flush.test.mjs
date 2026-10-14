// lane-1 B1 (quit and lens-switch flush): a gesture still holding a preview when its Scene is left is committed, never dropped.
// Behaviour: the gesture transaction's flushNow commits a held preview at once, and dispose afterwards has nothing left to drop.
// Source: the instrument's unmount flushes before it disposes, and the page's pagehide flushes too (and is detached on destroy).
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');
const researchSource=fs.readFileSync(new URL('../src/researchInstruments.tsx',import.meta.url),'utf8');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-research-quit-'));
 const out=join(temporary,'canvas-gesture.mjs');
 await build({
  stdin:{contents:"export * from './canvasGesture.ts';",resolveDir:join(engine,'src')},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
 test.after(()=>rm(temporary,{recursive:true,force:true}));
});

test('flushNow commits a held preview at once, and dispose afterwards drops nothing', async()=>{
 const commits=[];
 // A held drag: no pointerup has come, so no end listener and no idle timer will ever commit it.
 const gesture=api.createGestureTransaction({commit:async(id,value)=>{commits.push([id,value]);},onChange:()=>{},
  eventTarget:{addEventListener(){},removeEventListener(){}},scheduleMacrotask:fn=>fn(),idleMs:10_000});
 gesture.preview('n1',{x:1,y:1},true);
 gesture.preview('n1',{x:3,y:4},true);
 assert.equal(commits.length,0,'a held preview is not committed by the gesture itself');
 await gesture.flushNow();
 assert.deepEqual(commits,[['n1',{x:3,y:4}]],'a leave commits the final held value exactly once');
 gesture.dispose();
 assert.equal(commits.length,1,'nothing is left pending for dispose to drop');
 await gesture.flushNow();
 assert.equal(commits.length,1,'a second flush with no preview commits nothing');
});

test('the instrument flushes held gestures before it disposes them, on every leave', ()=>{
 const unmountAt=researchSource.indexOf('function unmount(){');
 assert.ok(unmountAt>0,'unmount exists');
 const unmountLine=researchSource.slice(unmountAt,researchSource.indexOf('\n',unmountAt));
 const flushAt=unmountLine.indexOf('flushGestures()'),disposeAt=unmountLine.indexOf('disposeGestures()');
 assert.ok(flushAt>0&&disposeAt>flushAt,'unmount flushes held gestures before it disposes them');
 // unmount is the one leave path for a lens switch, a reload (load) and close/destroy: each reaches it.
 assert.match(researchSource,/async function load\([^)]*\)\{[\s\S]*?unmount\(\);/,'a reload leaves through unmount');
 assert.match(researchSource,/close\(\)\{flushPlaceLayers\(\);\+\+epoch;lens=null;unmount\(\);/,'close leaves through unmount');
 assert.match(researchSource,/destroy\(\)\{[\s\S]*?unmount\(\);/,'destroy leaves through unmount');
});

test('flushGestures covers the move, resize and group-move gestures and adds no timer', ()=>{
 const start=researchSource.indexOf('function flushGestures(){');
 assert.ok(start>0,'flushGestures exists');
 const body=researchSource.slice(start,researchSource.indexOf('\n',start));
 assert.match(body,/state\.moveGesture\?\.flushNow\(\)/);
 assert.match(body,/state\.resizeGesture\?\.flushNow\(\)/);
 assert.match(body,/state\.groupMoveGesture\?\.flushNow\(\)/);
 assert.doesNotMatch(body,/setTimeout|setInterval/,'the flush adds no schedule of its own');
});

test('the page going away flushes too, and destroy detaches that listener', ()=>{
 assert.match(researchSource,/const quitGestures=\(\)=>flushGestures\(\);\s*window\.addEventListener\('pagehide',quitGestures\);/,'pagehide flushes held gestures');
 assert.match(researchSource,/window\.removeEventListener\('pagehide',quitGestures\);/,'destroy detaches the pagehide flush');
});
