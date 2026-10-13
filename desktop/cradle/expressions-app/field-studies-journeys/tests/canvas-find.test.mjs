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
 const temporary=await mkdtemp(join(tmpdir(),'oi-canvas-find-'));
 const out=join(temporary,'canvas-find.mjs');
 await build({
  stdin:{contents:"export * from './canvasFind';",resolveDir:join(engine,'src')},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
 test.after(()=>rm(temporary,{recursive:true,force:true}));
});

/** A Blocknote note body, as the native document stores it. */
const note=text=>JSON.stringify([{id:'b1',type:'paragraph',props:{},content:[{type:'text',text,styles:{}}],children:[]}]);
const box=(id,x,y,width=200,height=140)=>({id,type:'note',title:id,content:'',position:{x,y},size:{width,height}});

/** A Canvas with four occurrences, two saved frames (one intact, one with a
 * member that is no longer on the Canvas) and one object whose caption is its label. */
function fixture(){
 const nodes=[
  {...box('n1',0,0),title:'Quartz',content:note('Vein of quartz near the ridge')},
  {...box('n2',300,0),title:'Sticky caption',type:'sticky'},
  {...box('n3',0,300),title:'Image',type:'image',caption:'Survey photograph east face'},
  {...box('n4',600,600),title:'Far note',content:note('Summit cairn')},
 ];
 const occurrences=new Map([['n1','occ-1'],['n2','occ-2'],['n3','occ-3'],['n4','occ-4']]);
 const frames={
  intro:{label:'Intro',z:2,memberRefs:['occ-1','occ-2']},
  ridge:{label:'Ridge walk',z:1,memberRefs:['occ-3','occ-4']},
  broken:{label:'Broken',z:3,memberRefs:['occ-1','occ-gone']},
 };
 return {canvas:{key:'canvas-a',sceneId:'scene-1',nodes,occurrences,title:'Canvas',hiddenCount:0,edges:[]},frames};
}

test('targets: every occurrence once, then frames in saved z order; a partial frame is never a target', ()=>{
 const {canvas,frames}=fixture();
 const targets=api.canvasFindTargets(canvas,frames);
 assert.deepEqual(targets.map(t=>t.key),['occurrence:n1','occurrence:n2','occurrence:n3','occurrence:n4','frame:ridge','frame:intro']);
 const ridge=targets.find(t=>t.key==='frame:ridge');
 assert.deepEqual(ridge.node_ids,['n3','n4']);
 assert.equal(ridge.kind,'frame');
});

test('search corpus: note text, card captions and frame titles are all found; a frame never gains an entity ref', ()=>{
 const {canvas,frames}=fixture();
 const targets=api.canvasFindTargets(canvas,frames);
 assert.deepEqual(api.findCanvasTargets(targets,'quartz').map(t=>t.key),['occurrence:n1']);
 assert.deepEqual(api.findCanvasTargets(targets,'east face').map(t=>t.key),['occurrence:n3']);
 assert.deepEqual(api.findCanvasTargets(targets,'sticky caption').map(t=>t.key),['occurrence:n2']);
 assert.deepEqual(api.findCanvasTargets(targets,'ridge walk').map(t=>t.key),['frame:ridge']);
 assert.deepEqual(api.findCanvasTargets(targets,'ridge').map(t=>t.key),['occurrence:n1','frame:ridge']);
});

test('query: case and compatibility forms fold, every word must match, a blank query finds nothing', ()=>{
 const {canvas,frames}=fixture();
 const targets=api.canvasFindTargets(canvas,frames);
 assert.deepEqual(api.findCanvasTargets(targets,'  QUARTZ  ').map(t=>t.key),['occurrence:n1']);
 assert.deepEqual(api.findCanvasTargets(targets,'ｑｕａｒｔｚ').map(t=>t.key),['occurrence:n1']);
 assert.deepEqual(api.findCanvasTargets(targets,'vein ridge').map(t=>t.key),['occurrence:n1']);
 assert.deepEqual(api.findCanvasTargets(targets,'vein summit'),[]);
 assert.deepEqual(api.findCanvasTargets(targets,'   '),[]);
 assert.deepEqual(api.findCanvasTargets(targets,'nothing here'),[]);
});

test('next and previous cycle the matches, wrapping at both ends; with no current match the first or last is taken', ()=>{
 const hits=[{key:'a'},{key:'b'},{key:'c'}];
 assert.equal(api.cycleCanvasFindTarget(hits,'a',1).key,'b');
 assert.equal(api.cycleCanvasFindTarget(hits,'c',1).key,'a');
 assert.equal(api.cycleCanvasFindTarget(hits,'a',-1).key,'c');
 assert.equal(api.cycleCanvasFindTarget(hits,undefined,1).key,'a');
 assert.equal(api.cycleCanvasFindTarget(hits,undefined,-1).key,'c');
 assert.equal(api.cycleCanvasFindTarget([],undefined,1),undefined);
});

test('a found target resolves only while its native card and frame are unchanged', ()=>{
 const {canvas,frames}=fixture();
 const target=api.canvasFindTargets(canvas,frames).find(t=>t.key==='frame:ridge');
 assert.ok(api.resolveCanvasFindTarget(target,canvas,frames));
 const moved={...canvas,key:'canvas-b'};
 assert.equal(api.resolveCanvasFindTarget(target,moved,frames),undefined);
 const renamed={...frames,ridge:{...frames.ridge,label:'Renamed'}};
 assert.equal(api.resolveCanvasFindTarget(target,canvas,renamed),undefined);
});

test('camera: a card keeps the caller zoom and is centred; a frame zooms out only as far as it must fit', ()=>{
 const {canvas,frames}=fixture();
 const targets=api.canvasFindTargets(canvas,frames);
 const extent={width:1000,height:700};
 const card=targets.find(t=>t.key==='occurrence:n4');
 const cardCam=api.canvasFindCamera(card,canvas,extent,1.5);
 assert.equal(cardCam.zoom,1.5);
 // The card's centre lands on the pane's centre.
 assert.equal(cardCam.x+(600+100)*1.5,extent.width/2);
 assert.equal(cardCam.y+(600+70)*1.5,extent.height/2);

 const ridge=targets.find(t=>t.key==='frame:ridge');
 const frameCam=api.canvasFindCamera(ridge,canvas,extent,2);
 const bounds={left:0,top:300,right:800,bottom:740};
 assert.ok(frameCam.zoom<2, 'a frame wider than the pane is fitted, not left at the caller zoom');
 const screenRight=bounds.right*frameCam.zoom+frameCam.x;
 const screenBottom=bounds.bottom*frameCam.zoom+frameCam.y;
 assert.ok(screenRight<=extent.width-48+1e-6&&screenBottom<=extent.height-48+1e-6,'the frame fits inside the margin');
});

test('camera refuses an unread viewport or changed members rather than guessing', ()=>{
 const {canvas,frames}=fixture();
 const card=api.canvasFindTargets(canvas,frames).find(t=>t.key==='occurrence:n1');
 assert.throws(()=>api.canvasFindCamera(card,canvas,{width:0,height:700},1),/actual Canvas viewport/);
 assert.throws(()=>api.canvasFindCamera({...card,node_ids:['missing']},canvas,{width:800,height:600},1),/changed/);
});
