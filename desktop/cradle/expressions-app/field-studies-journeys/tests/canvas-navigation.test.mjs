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
 const temporary=await mkdtemp(join(tmpdir(),'oi-canvas-navigation-'));
 const out=join(temporary,'canvas-navigation.mjs');
 await build({
  stdin:{contents:"export * from './navigationGeometry';",resolveDir:join(engine,'..','vendor/research-canvas/packages/canvas/src/canvas')},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
 test.after(()=>rm(temporary,{recursive:true,force:true}));
});

/** Deterministic scatter: 50 cards across roughly 4000 x 3000 flow units. */
function scatter(count=50){
 let seed=7;const next=()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
 return Array.from({length:count},(_,index)=>({x:Math.round(next()*4000-2000),y:Math.round(next()*3000-1500),width:180,height:120,index}));
}

const WINDOWS=[{width:1280,height:800},{width:800,height:600},{width:390,height:844},{width:2560,height:1440}];
const WIDE={minZoom:0.05,maxZoom:2};
const XYFLOW={minZoom:0.5,maxZoom:2};

test('fit-all frames every scattered card fully inside the pane with margin', ()=>{
 const cards=scatter();
 for(const pane of WINDOWS){
  const fit=api.fitViewport(cards,pane,WIDE);
  assert.ok(fit, 'a fit exists for non-empty content');
  assert.equal(fit.clamped,false,`not clamped at ${pane.width}x${pane.height}`);
  const {zoom,x,y}=fit.viewport;
  for(const card of cards){
   const left=card.x*zoom+x,right=(card.x+card.width)*zoom+x;
   const top=card.y*zoom+y,bottom=(card.y+card.height)*zoom+y;
   assert.ok(left>=api.FIT_MARGIN_PX-1e-6,`left edge clear of margin at ${pane.width}x${pane.height}`);
   assert.ok(top>=api.FIT_MARGIN_PX-1e-6,`top edge clear of margin at ${pane.width}x${pane.height}`);
   assert.ok(right<=pane.width-api.FIT_MARGIN_PX+1e-6,`right edge clear of margin at ${pane.width}x${pane.height}`);
   assert.ok(bottom<=pane.height-api.FIT_MARGIN_PX+1e-6,`bottom edge clear of margin at ${pane.width}x${pane.height}`);
  }
 }
});

test('fit reports a clamp honestly when the xyflow zoom floor stops it short', ()=>{
 const cards=scatter();
 const fit=api.fitViewport(cards,{width:800,height:600},XYFLOW);
 assert.equal(fit.clamped,true);
 assert.equal(fit.viewport.zoom,0.5);
});

test('fit of one card and of a small selection stays within the zoom limits', ()=>{
 const single=api.fitViewport([{x:0,y:0,width:10,height:10}],{width:1000,height:700},XYFLOW);
 assert.equal(single.viewport.zoom,2,'a tiny card fits at the ceiling, not beyond it');
 assert.equal(single.clamped,true);
 const pair=api.fitViewport([{x:0,y:0,width:200,height:140},{x:300,y:0,width:200,height:140}],{width:1000,height:700},XYFLOW);
 assert.equal(pair.clamped,false);
});

test('fit of nothing or into an empty pane yields no viewport', ()=>{
 assert.equal(api.fitViewport([],{width:800,height:600},WIDE),null);
 assert.equal(api.fitViewport(scatter(3),{width:0,height:600},WIDE),null);
});

test('zoomTo keeps the centre of the pane fixed in flow space', ()=>{
 const pane={width:900,height:500};
 const before={x:-120,y:40,zoom:0.8};
 const centreBefore={x:(pane.width/2-before.x)/before.zoom,y:(pane.height/2-before.y)/before.zoom};
 const after=api.zoomTo(before,1.6,pane,WIDE);
 assert.equal(after.zoom,1.6);
 const centreAfter={x:(pane.width/2-after.x)/after.zoom,y:(pane.height/2-after.y)/after.zoom};
 assert.ok(Math.abs(centreAfter.x-centreBefore.x)<1e-9);
 assert.ok(Math.abs(centreAfter.y-centreBefore.y)<1e-9);
});

test('zoomTo clamps to the limits', ()=>{
 const pane={width:900,height:500};
 assert.equal(api.zoomTo({x:0,y:0,zoom:1},100,pane,XYFLOW).zoom,2);
 assert.equal(api.zoomTo({x:0,y:0,zoom:1},0.01,pane,XYFLOW).zoom,0.5);
});

test('zoom readout is a whole percentage', ()=>{
 assert.equal(api.zoomPercent(1),'100%');
 assert.equal(api.zoomPercent(0.5),'50%');
 assert.equal(api.zoomPercent(1.2),'120%');
 assert.equal(api.zoomPercent(0.333),'33%');
});

test('a dragged card settles onto a neighbour centre within the threshold and reports its guide', ()=>{
 const others=[{ref:'neighbour',box:{x:250,y:0,width:100,height:100}}];
 const dragged={x:246,y:500,width:100,height:100};
 const outcome=api.snapDraggedBox(dragged,others,1,'dragged');
 assert.deepEqual(outcome.topLeft,{x:250,y:500});
 assert.deepEqual(outcome.guides,[{axis:'x',at:300}]);
 assert.deepEqual({x:outcome.box.x,y:outcome.box.y},{x:250,y:500});
});

test('no snap and no guide outside the threshold', ()=>{
 const others=[{ref:'neighbour',box:{x:250,y:0,width:100,height:100}}];
 const outcome=api.snapDraggedBox({x:230,y:500,width:100,height:100},others,1,'dragged');
 assert.deepEqual(outcome.topLeft,{x:230,y:500});
 assert.deepEqual(outcome.guides,[]);
});

test('the dragged card never snaps to itself', ()=>{
 const same={x:246,y:500,width:100,height:100};
 const outcome=api.snapDraggedBox(same,[{ref:'dragged',box:{x:246,y:500,width:100,height:100}}],1,'dragged');
 assert.deepEqual(outcome.guides,[]);
 assert.deepEqual(outcome.topLeft,{x:246,y:500});
});

test('the snap threshold is 8 screen pixels divided by zoom', ()=>{
 const others=[{ref:'neighbour',box:{x:250,y:0,width:100,height:100}}];
 const dragged={x:240,y:500,width:100,height:100};
 // centre 290 vs neighbour centre 300: a 10 flow-unit gap.
 assert.deepEqual(api.snapDraggedBox(dragged,others,0.5,'dragged').guides,[{axis:'x',at:300}],'zoomed out: 16 units reach');
 assert.deepEqual(api.snapDraggedBox(dragged,others,2,'dragged').guides,[],'zoomed in: 4 units reach');
});

test('grid snapping composes after alignment: a guided axis keeps the guide value', ()=>{
 const aligned={topLeft:{x:250,y:503},box:{x:250,y:503,width:100,height:100},guides:[{axis:'x',at:300}]};
 assert.deepEqual(api.keepGuidedAxes(aligned,{x:248,y:500}),{x:250,y:500});
 const free={topLeft:{x:247,y:503},box:{x:247,y:503,width:100,height:100},guides:[]};
 assert.deepEqual(api.keepGuidedAxes(free,{x:248,y:500}),{x:248,y:500});
});

test('a guide renders as a viewport segment spanning the cards on its line', ()=>{
 const boxes=[
  {x:250,y:0,width:100,height:100},
  {x:250,y:500,width:100,height:100},
  {x:500,y:200,width:100,height:100},
 ];
 const viewport={x:100,y:20,zoom:0.5};
 const [segment]=api.guideSegments([{axis:'x',at:300}],boxes,viewport);
 assert.equal(segment.x1,250);
 assert.equal(segment.x2,250);
 assert.equal(segment.y1,0.5*0+20);
 assert.equal(segment.y2,0.5*600+20);
});

test('a horizontal guide spans the cards on its row', ()=>{
 const boxes=[{x:0,y:100,width:80,height:40},{x:300,y:100,width:50,height:40},{x:0,y:400,width:80,height:40}];
 const [segment]=api.guideSegments([{axis:'y',at:120}],boxes,{x:10,y:0,zoom:1});
 assert.equal(segment.y1,120);
 assert.equal(segment.y2,120);
 assert.equal(segment.x1,10);
 assert.equal(segment.x2,10+350);
});

test('a guide with no card on its line produces no segment', ()=>{
 assert.deepEqual(api.guideSegments([{axis:'x',at:999}],[{x:0,y:0,width:10,height:10}],{x:0,y:0,zoom:1}),[]);
});

test('the one shared zoom range is 0.05 to 2, and fit-all of 50 cards never clamps inside it', ()=>{
 assert.deepEqual(api.CANVAS_ZOOM_LIMITS,{minZoom:0.05,maxZoom:2});
 const cards=scatter();
 for(const pane of WINDOWS){
  assert.equal(api.fitViewport(cards,pane,api.CANVAS_ZOOM_LIMITS).clamped,false,`fit-all at ${pane.width}x${pane.height}`);
 }
});

test('a fit that needs less than the floor still reports the clamp honestly', ()=>{
 const tall=[{x:0,y:0,width:200,height:140},{x:0,y:200000,width:200,height:140}];
 const fit=api.fitViewport(tall,{width:800,height:600},api.CANVAS_ZOOM_LIMITS);
 assert.equal(fit.clamped,true);
 assert.equal(fit.viewport.zoom,0.05);
});

test('camera durations are zero under reduced motion and untouched otherwise; absent matchMedia is no preference', ()=>{
 const previous=globalThis.matchMedia;
 try{
  delete globalThis.matchMedia;
  assert.equal(api.prefersReducedMotion(),false);
  assert.equal(api.cameraDuration(500),500);
  globalThis.matchMedia=(query)=>({matches:query==='(prefers-reduced-motion: reduce)'});
  assert.equal(api.prefersReducedMotion(),true);
  assert.equal(api.cameraDuration(500),0);
  assert.equal(api.cameraDuration(350),0);
  globalThis.matchMedia=()=>({matches:false});
  assert.equal(api.cameraDuration(500),500);
 }finally{
  if(previous===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=previous;
 }
});

test('a guide spans a card whose edge, not its centre, lies on the line', ()=>{
 const boxes=[{x:250,y:0,width:100,height:100},{x:150,y:400,width:100,height:100}];
 const [segment]=api.guideSegments([{axis:'x',at:250}],boxes,{x:0,y:0,zoom:1});
 assert.equal(segment.y1,0);
 assert.equal(segment.y2,500);
});

test('a dragged card aligns its left edge to a neighbour left edge when that is the closest line', ()=>{
 const others=[{ref:'neighbour',box:{x:250,y:0,width:100,height:100}}];
 // Dragged centre 306 is 6 from the neighbour centre 300; its left edge 246 is 4 from the neighbour left edge 250.
 const outcome=api.snapDraggedBox({x:246,y:500,width:120,height:100},others,1,'dragged');
 assert.deepEqual(outcome.guides,[{axis:'x',at:250}]);
 assert.equal(outcome.topLeft.x,250);
});

test('a dragged card aligns its right edge to a neighbour right edge', ()=>{
 const others=[{ref:'neighbour',box:{x:250,y:0,width:100,height:100}}];
 // Centre 292 is 8 from 300 (within 8); right edge 352 is 2 from 350 and wins.
 const outcome=api.snapDraggedBox({x:232,y:500,width:120,height:100},others,1,'dragged');
 assert.deepEqual(outcome.guides,[{axis:'x',at:350}]);
 assert.equal(outcome.topLeft.x,230);
});
