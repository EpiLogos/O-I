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

/** A minimal EventTarget-compatible fake so gesture-end detection can be
 * exercised without a DOM (node:test runs under plain Node). */
class FakeWindow {
 constructor(){this.listeners=new Map();}
 addEventListener(type,listener,options){
  const capture=typeof options==='object'?!!options?.capture:!!options;
  const key=`${type}:${capture}`;
  const set=this.listeners.get(key)??new Set();set.add(listener);this.listeners.set(key,set);
 }
 removeEventListener(type,listener,options){
  const capture=typeof options==='object'?!!options?.capture:!!options;
  const key=`${type}:${capture}`;
  this.listeners.get(key)?.delete(listener);
 }
 dispatch(type,capture=true){
  const key=`${type}:${capture}`;
  for(const listener of [...(this.listeners.get(key)??[])])listener({type});
 }
}

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-canvas-gesture-'));
 const out=join(temporary,'canvas-gesture.mjs');
 await build({
  stdin:{contents:"export * from './canvasGesture.ts';",resolveDir:join(engine,'src')},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
 test.after(()=>rm(temporary,{recursive:true,force:true}));
});

test('N preview moves produce zero commits until the gesture ends, then exactly one commit with the final position',async()=>{
 const win=new FakeWindow();
 const commits=[];
 let renders=0;
 const gesture=api.createGestureTransaction({
  commit:async(id,value)=>{commits.push([id,value]);},
  onChange:()=>{renders++;},
  eventTarget:win,
  scheduleMacrotask:fn=>fn(), // synchronous for a deterministic assertion
});
 gesture.preview('n1',{x:1,y:1});
 gesture.preview('n1',{x:2,y:2});
 gesture.preview('n1',{x:3,y:3});
 assert.equal(commits.length,0,'no commit before the gesture ends');
 assert.equal(renders,3,'every preview still triggers a re-render, just no native write');
 win.dispatch('pointerup');
 await sleep(0);
 assert.deepEqual(commits,[['n1',{x:3,y:3}]],'exactly one commit, carrying the final previewed position');
});

test('two nodes moved within one gesture each commit exactly once',async()=>{
 const win=new FakeWindow();
 const commits=[];
 const gesture=api.createGestureTransaction({
  commit:async(id,value)=>{commits.push([id,value]);},
  onChange:()=>{},
  eventTarget:win,
  scheduleMacrotask:fn=>fn(),
 });
 gesture.preview('a',{x:1,y:1});
 gesture.preview('b',{x:5,y:5});
 gesture.preview('a',{x:2,y:2});
 gesture.preview('b',{x:6,y:6});
 win.dispatch('pointerup');
 await sleep(0);
 assert.equal(commits.length,2);
 assert.deepEqual(commits.sort((x,y)=>x[0].localeCompare(y[0])),[['a',{x:2,y:2}],['b',{x:6,y:6}]]);
});

test('a failing commit drops the preview and re-renders before the rejection settles',async()=>{
 const win=new FakeWindow();
 let renderCountAtFailure=null;
 const errors=[];
 const gesture=api.createGestureTransaction({
  commit:async()=>{throw new Error('conflict')},
  onChange:()=>{renderCountAtFailure=gesture.previewValue('n1');},
  onError:(id,error)=>{errors.push([id,error.message]);},
  eventTarget:win,
  scheduleMacrotask:fn=>fn(),
 });
 gesture.preview('n1',{x:9,y:9});
 win.dispatch('pointerup');
 await sleep(0);
 assert.equal(gesture.previewValue('n1'),undefined,'preview is dropped so the render falls back to native state');
 assert.deepEqual(errors,[['n1','conflict']],'the error message is preserved for the host to surface');
});

test('idle fallback commits once when no pointer event ever ends the gesture (e.g. keyboard-driven moves)',async()=>{
 const win=new FakeWindow();
 const commits=[];
 const gesture=api.createGestureTransaction({
  commit:async(id,value)=>{commits.push([id,value]);},
  onChange:()=>{},
  eventTarget:win,
  idleMs:5,
 });
 gesture.preview('kb',{x:1,y:1});
 await sleep(2);
 gesture.preview('kb',{x:2,y:2}); // resets the idle timer; still no pointer event
 await sleep(40);
 assert.deepEqual(commits,[['kb',{x:2,y:2}]],'exactly one commit, once the moves go idle');
});

test('bypassing the helper and committing on every preview call — the OLD per-move adapter behaviour — produces N commits, which is exactly the defect this helper repairs',async()=>{
 const commits=[];
 const oldOnMoveNode=(id,position)=>{commits.push([id,position]);}; // one commit per pointer move, no batching
 for(const position of [{x:1,y:1},{x:2,y:2},{x:3,y:3},{x:4,y:4}])oldOnMoveNode('n1',position);
 assert.equal(commits.length,4,'documenting the before state: the vendored Canvas fires onMoveNode on every pointer move, and the old adapter committed every one of them');
});

test('withGesturePreviews overlays only nodes with an active preview, without mutating the source list',()=>{
 const nodes=[{id:'a',position:{x:0,y:0},size:{width:10,height:10}},{id:'b',position:{x:5,y:5},size:{width:20,height:20}}];
 const before=JSON.parse(JSON.stringify(nodes));
 const overlaid=api.withGesturePreviews(nodes,id=>id==='a'?{x:99,y:99}:undefined,()=>undefined);
 assert.deepEqual(overlaid[0].position,{x:99,y:99});
 assert.deepEqual(overlaid[1],nodes[1],'node without a preview is returned as-is');
 assert.deepEqual(nodes,before,'the source node list is never mutated');
});
