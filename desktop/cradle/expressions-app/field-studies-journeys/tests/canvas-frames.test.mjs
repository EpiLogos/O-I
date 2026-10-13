// lane-1 A9: frame headings on the Research Canvas. A frame's title is the
// owner's own text, drawn at its top edge; an untitled frame draws nothing. The
// title is a closed, trimmed, bounded record, and clearing it leaves no trace.
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
 temporary=await mkdtemp(join(tmpdir(),'oi-canvas-frames-'));
 const out=join(temporary,'canvas-frames.mjs');
 await build({
  stdin:{contents:"export * from './src/canvasFrames.ts';export * from './src/researchMaterial.ts';",resolveDir:engine},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
});
test.after(()=>rm(temporary,{recursive:true,force:true}));

/** A working Scene with two occurrences a and b, and the research material the frame actions write. */
function sceneWithTwo(){
 return {
  entities:[
   {id:'a',name:'A',position:{x:0,y:0,z:0},size:{x:.6,y:.4},text:'',sequence:{steps:[]}},
   {id:'b',name:'B',position:{x:1,y:0,z:0},size:{x:.6,y:.4},text:'',sequence:{steps:[]}},
  ],
  research:api.emptyResearchMaterial(),
 };
}
const wire=scene=>JSON.parse(JSON.stringify(scene.research));
function frameAfter(scene,label){
 api.applyResearchMaterial(scene,{type:'frame-save',id:'f1',label,memberRefs:['a','b']});
 return scene;
}

test('a frame title is trimmed, bounded and cleared when blank', ()=>{
 assert.equal(api.frameTitleRecord('  Évora — the walls  '),'Évora — the walls');
 for(const blank of ['','   ','\n\t']) assert.equal(api.frameTitleRecord(blank),null,JSON.stringify(blank));
 // the bound is UTF-16 units, the record's own measure: 80 emoji are 160 units and fit, one more unit would not
 const emoji='😀'.repeat(81);
 const capped=api.frameTitleRecord(emoji);
 assert.ok(capped.length<=api.FRAME_TITLE_MAX,'capped to the bound');
 assert.equal(capped,'😀'.repeat(80));
 assert.equal(api.FRAME_TITLE_MAX,160);
});

test('frame-title sets, retitles and clears the heading; the label is never the heading', ()=>{
 const scene=frameAfter(sceneWithTwo(),'Frame 1');
 assert.equal(scene.research.frames.f1.title,undefined,'an untitled frame stores no title');
 api.applyResearchMaterial(scene,{type:'frame-title',id:'f1',title:'  Walls  '});
 assert.equal(scene.research.frames.f1.title,'Walls');
 assert.equal(scene.research.frames.f1.label,'Frame 1','the list label is untouched');
 api.applyResearchMaterial(scene,{type:'frame-title',id:'f1',title:'Walls, north'});
 assert.equal(scene.research.frames.f1.title,'Walls, north');
 // clearing removes the key entirely: no empty string, no trace
 api.applyResearchMaterial(scene,{type:'frame-title',id:'f1',title:'   '});
 assert.equal('title' in scene.research.frames.f1,false);
 assert.deepEqual(Object.keys(scene.research.frames.f1).sort(),['label','memberRefs','z']);
});

test('re-grouping or re-labelling keeps the heading and the order', ()=>{
 const scene=frameAfter(sceneWithTwo(),'Frame 1');
 api.applyResearchMaterial(scene,{type:'frame-title',id:'f1',title:'Walls'});
 api.applyResearchMaterial(scene,{type:'frame-order',id:'f1',direction:'front'});
 const z=scene.research.frames.f1.z;
 api.applyResearchMaterial(scene,{type:'frame-save',id:'f1',label:'Renamed',memberRefs:['a']});
 assert.equal(scene.research.frames.f1.title,'Walls','a re-save keeps the heading');
 assert.equal(scene.research.frames.f1.z,z,'a re-save keeps the order');
 assert.equal(scene.research.frames.f1.label,'Renamed');
});

test('a title on a missing frame is refused; a refused title leaves the Scene intact', ()=>{
 const scene=frameAfter(sceneWithTwo(),'Frame 1');
 const before=JSON.stringify(wire(scene));
 assert.throws(()=>api.applyResearchMaterial(scene,{type:'frame-title',id:'missing',title:'x'}),/Frame is missing/);
 assert.equal(JSON.stringify(wire(scene)),before);
});

test('the validator admits a titled frame and refuses a closed-key or bounded violation', ()=>{
 const ids=new Set(['a','b']);
 const with_=frame=>({schema:'oi.research-scene/v1',cards:{},strokes:[],views:{},timeline:{},frames:{f1:frame}});
 assert.doesNotThrow(()=>api.validateResearchMaterial(with_({label:'Frame 1',title:'Walls',memberRefs:['a'],z:0}),ids));
 for(const refused of [
  {label:'Frame 1',title:'   ',memberRefs:['a'],z:0},
  {label:'Frame 1',title:'x'.repeat(161),memberRefs:['a'],z:0},
  {label:'Frame 1',title:3,memberRefs:['a'],z:0},
  {label:'Frame 1',heading:'Walls',memberRefs:['a'],z:0},
 ]) assert.throws(()=>api.validateResearchMaterial(with_(refused),ids),/Invalid frame|Unknown research presentation field/,JSON.stringify(refused));
});

test('frame headings sit at the members top edge in screen space, and an untitled frame draws no caption', ()=>{
 const frames={
  f1:{title:'Walls',memberRefs:['a','b'],z:1},
  f2:{memberRefs:['a'],z:0},
  f3:{title:'   ',memberRefs:['b'],z:2},
  f4:{title:'Gone',memberRefs:['missing'],z:3},
 };
 const boxes={a:{x:10,y:20,width:100,height:50},b:{x:130,y:5,width:60,height:40}};
 const headings=api.frameHeadings(frames,ref=>boxes[ref],{x:100,y:50,zoom:2});
 // f4 has no member on the stage, so no heading; the rest come back back-to-front by frame order
 assert.deepEqual(headings.map(h=>h.id),['f2','f1','f3']);
 const f1=headings.find(h=>h.id==='f1');
 // f1 spans x 10..190 and y 5..70 in flow units: its top-left is (10,5) at zoom 2 plus the pan
 assert.equal(f1.left,10*2+100);
 assert.equal(f1.top,5*2+50);
 assert.equal(f1.width,(190-10)*2);
 assert.equal(f1.title,'Walls');
 assert.equal(f1.hit,false);
 // untitled frames carry no caption: their hit strip is the only affordance
 const f2=headings.find(h=>h.id==='f2');
 assert.equal(f2.title,'');
 assert.equal(f2.hit,true);
 const f3=headings.find(h=>h.id==='f3');
 assert.equal(f3.title,'','a blank title is no title');
 assert.equal(f3.hit,true);
});

test('frame headings are empty when no frame has a member on the stage', ()=>{
 assert.deepEqual(api.frameHeadings({f1:{title:'Walls',memberRefs:['a'],z:0}},()=>undefined,{x:0,y:0,zoom:1}),[]);
 assert.deepEqual(api.frameHeadings({},()=>undefined,{x:0,y:0,zoom:1}),[]);
});
