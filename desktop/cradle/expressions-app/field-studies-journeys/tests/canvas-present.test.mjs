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
 const temporary=await mkdtemp(join(tmpdir(),'oi-canvas-present-'));
 const out=join(temporary,'canvas-present.mjs');
 await build({
  stdin:{contents:"export * from './canvasPresent';export * from './canvasFind';",resolveDir:join(engine,'src')},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
 test.after(()=>rm(temporary,{recursive:true,force:true}));
});

const WINDOWS=[{width:1280,height:800},{width:800,height:600},{width:390,height:844}];
/** The Canvas fit margin (navigationGeometry FIT_MARGIN_PX), per side. */
const MARGIN=48;
const box=(x,y,width=200,height=140)=>({x,y,width,height});

test('step model: starts on the first frame, moves one frame at a time and clamps at both ends (no wrap)', ()=>{
 let index=0;
 index=api.presentStep(index,3,1);assert.equal(index,1);
 index=api.presentStep(index,3,1);assert.equal(index,2);
 index=api.presentStep(index,3,1);assert.equal(index,2,'the last frame stays on screen');
 index=api.presentStep(index,3,-1);assert.equal(index,1);
 index=api.presentStep(index,3,-1);assert.equal(index,0);
 index=api.presentStep(index,3,-1);assert.equal(index,0,'the first frame stays on screen');
 assert.equal(api.presentStep(0,0,1),0,'an empty presentation has no step');
});

test('frame order: frames only, in the find corpus order (z ascending), occurrences are never steps', ()=>{
 const canvas={key:'c',title:'',hiddenCount:0,edges:[],nodes:[
  {id:'n1',title:'A',type:'note',content:'',position:{x:0,y:0},size:{width:200,height:140}},
  {id:'n2',title:'B',type:'note',content:'',position:{x:400,y:0},size:{width:200,height:140}},
  {id:'n3',title:'C',type:'note',content:'',position:{x:0,y:400},size:{width:200,height:140}},
 ],occurrences:new Map([['n1','o1'],['n2','o2'],['n3','o3']])};
 const frames={
  second:{label:'Second',z:2,memberRefs:['o3']},
  first:{label:'First',z:1,memberRefs:['o1','o2']},
 };
 const targets=api.canvasFindTargets(canvas,frames);
 const boxes=new Map(canvas.nodes.map(node=>[node.id,box(node.position.x,node.position.y,node.size.width,node.size.height)]));
 const steps=api.presentFrames(targets,id=>boxes.get(id));
 assert.deepEqual(steps.map(step=>step.label),['First','Second']);
 assert.deepEqual(steps[0].boxes.map(b=>b.x),[0,400]);
});

test('frame order: a frame with a member not on the loaded Canvas is skipped, never presented partially', ()=>{
 const targets=[
  {key:'frame:whole',canvas_key:'c',kind:'frame',ref:'whole',label:'Whole',text:'',node_ids:['n1','n2']},
  {key:'frame:partial',canvas_key:'c',kind:'frame',ref:'partial',label:'Partial',text:'',node_ids:['n1','missing']},
 ];
 const boxes=new Map([['n1',box(0,0)],['n2',box(300,0)]]);
 const steps=api.presentFrames(targets,id=>boxes.get(id));
 assert.deepEqual(steps.map(step=>step.ref),['whole']);
});

test('camera: each frame fits its bounds inside the pane margin, at every window size', ()=>{
 const frame=[box(0,0),box(900,700)];
 for(const pane of WINDOWS){
  const viewport=api.presentViewport(frame,pane);
  assert.ok(viewport,`a camera exists at ${pane.width}x${pane.height}`);
  const left=0*viewport.zoom+viewport.x,right=1100*viewport.zoom+viewport.x;
  const top=0*viewport.zoom+viewport.y,bottom=840*viewport.zoom+viewport.y;
  assert.ok(left>=MARGIN-1e-6,`left clear at ${pane.width}`);
  assert.ok(top>=MARGIN-1e-6,`top clear at ${pane.width}`);
  assert.ok(right<=pane.width-MARGIN+1e-6,`right clear at ${pane.width}`);
  assert.ok(bottom<=pane.height-MARGIN+1e-6,`bottom clear at ${pane.height}`);
  assert.ok(viewport.zoom>0&&viewport.zoom<=2);
 }
});

test('camera: a small frame is capped at the Canvas zoom ceiling, and an unsized pane has no camera', ()=>{
 const small=api.presentViewport([box(0,0,40,30)],{width:1280,height:800});
 assert.equal(small.zoom,2);
 assert.equal(api.presentViewport([box(0,0)],{width:0,height:0}),undefined);
});
