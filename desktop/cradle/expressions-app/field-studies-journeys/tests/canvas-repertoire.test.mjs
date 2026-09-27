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
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-canvas-repertoire-'));
 const out=join(temporary,'canvas-repertoire.mjs');
 await build({
  stdin:{contents:"export * from './canvasRepertoire.ts';",resolveDir:join(engine,'src')},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
 test.after(()=>rm(temporary,{recursive:true,force:true}));
});

function nodes(){
 return [
  {id:'a',position:{x:0,y:0},size:{width:80,height:60}},
  {id:'b',position:{x:200,y:0},size:{width:80,height:60}},
  {id:'c',position:{x:400,y:0},size:{width:80,height:60}},
 ];
}

test('lassoHitScreen selects exactly the node rectangles whose centre falls inside the drawn rectangle',()=>{
 const nodeRects=[
  {id:'a',rect:{x:0,y:0,width:40,height:40}},
  {id:'b',rect:{x:200,y:0,width:40,height:40}},
  {id:'c',rect:{x:400,y:0,width:40,height:40}},
 ];
 const hits=api.lassoHitScreen(nodeRects,{x:-10,y:-10,width:260,height:100});
 assert.deepEqual(hits.sort(),['a','b']);
 assert.deepEqual(api.lassoHitScreen(nodeRects,{x:1000,y:1000,width:10,height:10}),[],'a lasso that misses every node selects nothing');
});

test('nudge moves only the selected refs, by exactly one axis-step, leaving the rest untouched',()=>{
 const overrides=api.nudge(nodes(),['a','c'],'right',10);
 assert.deepEqual(overrides.a,{x:10,y:0});
 assert.deepEqual(overrides.c,{x:410,y:0});
 assert.equal(overrides.b,undefined,'an unselected node gets no override at all');
});

test('translateSelection applies one shared delta to every selected ref',()=>{
 const overrides=api.translateSelection(nodes(),['a','b'],{x:5,y:-5});
 assert.deepEqual(overrides.a,{x:5,y:-5});
 assert.deepEqual(overrides.b,{x:205,y:-5});
 assert.equal(overrides.c,undefined);
});

test('align needs two or more selected nodes and aligns to the selection bounding box',()=>{
 assert.deepEqual(api.align(nodes(),['a'],'left'),{},'a single node cannot align to anything');
 const left=api.align(nodes(),['a','b','c'],'left');
 assert.equal(left.a.x,0);assert.equal(left.b.x,0);assert.equal(left.c.x,0);
});

test('distribute needs three or more selected nodes and preserves the off-axis coordinate',()=>{
 assert.deepEqual(api.distribute(nodes(),['a','b'],'h'),{},'two nodes cannot distribute');
 const distributed=api.distribute(nodes(),['a','b','c'],'h');
 assert.equal(distributed.b.x,200,'the middle node already sits at the even midpoint');
 assert.equal(distributed.a.y,0);assert.equal(distributed.b.y,0);assert.equal(distributed.c.y,0);
});

test('snapToGrid rounds to the nearest grid line within threshold, and leaves a position alone outside it',()=>{
 assert.deepEqual(api.snapToGrid({x:97,y:3},20,10),{x:100,y:0});
 assert.deepEqual(api.snapToGrid({x:150,y:150},20,2),{x:150,y:150},'outside the threshold, the position is returned unchanged');
});

test('semanticZoomLevel/labelsForZoom are the same presentation-only thresholds the m0m5 model defines',()=>{
 assert.equal(api.semanticZoomLevel(0.5),'constellation');
 assert.equal(api.semanticZoomLevel(1.0),'named');
 assert.equal(api.semanticZoomLevel(2.0),'detailed');
 assert.deepEqual(api.labelsForZoom('constellation'),{nodeLabels:false,relationLabels:false});
});

test('trackModifiers reads live shift/ctrl/cmd state from keydown/keyup and clears on blur',()=>{
 const listeners=new Map();
 const fakeWindow={
  addEventListener:(type,fn)=>{const set=listeners.get(type)??new Set();set.add(fn);listeners.set(type,set);},
  removeEventListener:(type,fn)=>{listeners.get(type)?.delete(fn);},
 };
 const dispatch=(type,event)=>{for(const fn of [...(listeners.get(type)??[])])fn(event);};
 const {state,dispose}=api.trackModifiers(fakeWindow);
 assert.deepEqual(state,{shift:false,extend:false});
 dispatch('keydown',{key:'Shift'});
 assert.equal(state.shift,true);
 dispatch('keydown',{key:'Meta'});
 assert.equal(state.extend,true);
 dispatch('keyup',{key:'Shift'});
 assert.equal(state.shift,false);
 dispatch('keydown',{key:'Control'});
 assert.equal(state.extend,true);
 dispatch('blur',{});
 assert.deepEqual(state,{shift:false,extend:false},'a window blur clears any key that never reported keyup');
 dispose();
 assert.equal(listeners.get('keydown').size,0,'dispose detaches every listener it attached');
});
