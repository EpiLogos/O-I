// lane-1 A2: sticky, shape and text objects on the Research Canvas. The kinds,
// palette keys and defaults are closed vocabularies; each object is an
// occurrence whose presentation survives serialize -> validate, and every
// unknown kind or key is refused with the existing closed-key error.
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
 temporary=await mkdtemp(join(tmpdir(),'oi-canvas-shapes-'));
 const out=join(temporary,'canvas-shapes.mjs');
 await build({
  stdin:{contents:"export * from './src/canvasShapes.ts';export * from './src/researchMaterial.ts';",resolveDir:engine},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
});
test.after(()=>rm(temporary,{recursive:true,force:true}));

/** A working Scene with no occurrences yet; the material actions are the only writer. */
function blankScene(){return {entities:[],research:api.emptyResearchMaterial()};}
const ids=scene=>new Set(scene.entities.map(entity=>entity.id));
/** The record as it travels: JSON out and back, the way a saved Scene is read. */
const wire=scene=>JSON.parse(JSON.stringify(scene.research));

test('kinds, palette keys and geometries are closed keys, never colour values', ()=>{
 for(const kind of ['sticky','shape','text'])assert.ok(api.isCanvasObjectKind(kind),kind);
 for(const bad of ['note','image','frame','#f1e4bf',undefined,null])assert.equal(api.isCanvasObjectKind(bad),false,String(bad));
 for(const key of ['amber','sage','sky','rose','stone'])assert.ok(api.isPaletteKey(key),key);
 for(const bad of ['#ffaa00','red','Amber','']) assert.equal(api.isPaletteKey(bad),false,bad);
 assert.ok(api.isShapeFill('none'));
 assert.equal(api.isShapeFill('rectangle'),false);
 assert.deepEqual([...api.SHAPE_GEOMETRIES],['rectangle','ellipse','diamond']);
});

test('the one picker offers five choices, each with a bounded default size and a named label', ()=>{
 assert.deepEqual([...api.CANVAS_TOOL_CHOICES],['sticky','rectangle','ellipse','diamond','text']);
 for(const choice of api.CANVAS_TOOL_CHOICES){
  const spec=api.CANVAS_TOOL_SPEC[choice];
  assert.ok(spec.label.length>0&&spec.label.length<=160,choice);
  for(const dimension of [spec.size.width,spec.size.height])assert.ok(dimension>=40&&dimension<=40000,choice);
  assert.ok(api.CANVAS_TOOL_GLYPHS[choice].length>0,choice);
  if(choice==='sticky')assert.equal(spec.kind,'sticky');
  else if(choice==='text')assert.equal(spec.kind,'text');
  else {assert.equal(spec.kind,'shape');assert.equal(spec.geometry,choice);}
 }
});

test('every kind is created as an occurrence, styled, labelled, framed and survives serialize -> validate', ()=>{
 const scene=blankScene();
 api.CANVAS_TOOL_CHOICES.forEach((choice,index)=>{
  const spec=api.CANVAS_TOOL_SPEC[choice];
  api.applyResearchMaterial(scene,{type:'create-card',kind:spec.kind,geometry:spec.geometry,title:spec.label,position:{x:.1*index,y:.1}});
 });
 assert.equal(scene.entities.length,5);
 const [sticky,rectangle,ellipse,diamond,text]=scene.entities.map(entity=>entity.id);
 // style and label through the same actions the inspector uses
 api.applyResearchMaterial(scene,{type:'card-style',id:sticky,patch:{palette:'sage'}});
 api.applyResearchMaterial(scene,{type:'card-caption',id:sticky,caption:'Check the field'});
 api.applyResearchMaterial(scene,{type:'card-style',id:ellipse,patch:{fill:'sky'}});
 api.applyResearchMaterial(scene,{type:'card-caption',id:text,caption:'A note on the stage'});
 // frame two objects together: membership is presentation over occurrences that exist
 api.applyResearchMaterial(scene,{type:'frame-save',id:'frame-a2',label:'Group',memberRefs:[rectangle,diamond]});
 // the same record a saved Scene carries
 const saved=wire(scene);
 api.validateResearchMaterial(saved,ids(scene));
 assert.equal(saved.cards[sticky].type,'sticky');
 assert.equal(saved.cards[sticky].palette,'sage');
 assert.equal(saved.cards[sticky].caption,'Check the field');
 assert.equal(saved.cards[rectangle].type,'shape');
 assert.equal(saved.cards[rectangle].shape,'rectangle');
 assert.equal(saved.cards[rectangle].fill,'none');
 assert.equal(saved.cards[ellipse].shape,'ellipse');
 assert.equal(saved.cards[ellipse].fill,'sky');
 assert.equal(saved.cards[diamond].shape,'diamond');
 assert.equal(saved.cards[text].type,'text');
 assert.deepEqual(saved.frames['frame-a2'].memberRefs,[rectangle,diamond]);
 // a second round trip is a fixed point
 assert.deepEqual(wire({research:saved}),saved);
});

test('a duplicated object keeps its kind and style; a removed object leaves no frame trace', ()=>{
 const scene=blankScene();
 api.applyResearchMaterial(scene,{type:'create-card',kind:'shape',geometry:'diamond',title:'Diamond',position:{x:0,y:0}});
 const [diamond]=scene.entities.map(entity=>entity.id);
 api.applyResearchMaterial(scene,{type:'card-style',id:diamond,patch:{fill:'rose'}});
 api.applyResearchMaterial(scene,{type:'duplicate',id:diamond});
 const copy=scene.entities.find(entity=>entity.id!==diamond).id;
 assert.equal(scene.research.cards[copy].shape,'diamond');
 assert.equal(scene.research.cards[copy].fill,'rose');
 api.applyResearchMaterial(scene,{type:'frame-save',id:'f',label:'Pair',memberRefs:[diamond,copy]});
 api.pruneResearchOccurrence(scene,diamond);
 assert.equal(scene.research.cards[diamond],undefined);
 assert.deepEqual(scene.research.frames.f.memberRefs,[copy]);
 api.validateResearchMaterial(wire(scene),ids(scene));
});

test('validation refuses unknown kinds and unknown keys with the closed-key errors', ()=>{
 const scene=blankScene();
 api.applyResearchMaterial(scene,{type:'create-card',kind:'sticky',position:{x:0,y:0}});
 api.applyResearchMaterial(scene,{type:'create-card',kind:'shape',geometry:'ellipse',position:{x:.1,y:0}});
 api.applyResearchMaterial(scene,{type:'create-card',kind:'text',position:{x:.2,y:0}});
 const [sticky,ellipse,text]=scene.entities.map(entity=>entity.id);
 const refused=(mutate,message)=>{
  const record=wire(scene);mutate(record);
  assert.throws(()=>api.validateResearchMaterial(record,ids(scene)),message);
 };
 refused(record=>{record.cards[sticky].type='frame';},/Unknown research card kind/);
 refused(record=>{record.cards[sticky].roll=1;},/Unknown research presentation field/);
 refused(record=>{record.cards[sticky].palette='#ffaa00';},/Invalid sticky colour/);
 refused(record=>{record.cards[text].palette='sage';},/Invalid sticky colour/);
 refused(record=>{delete record.cards[ellipse].shape;},/Invalid shape/);
 refused(record=>{record.cards[ellipse].shape='hexagon';},/Invalid shape/);
 refused(record=>{record.cards[ellipse].fill='#ffaa00';},/Invalid shape/);
 refused(record=>{record.cards[text].shape='rectangle';},/Only shape cards carry a geometry or fill/);
 refused(record=>{record.cards[sticky].size={width:10,height:180};},/Invalid card display size/);
 refused(record=>{record.cards[sticky].size={width:220,height:180,depth:1};},/Unknown research presentation field/);
});

test('an unlabelled object shows no text on the stage; a labelled one shows its caption; other cards pass through', ()=>{
 const card=(overrides)=>({type:'note',...overrides});
 const cards={
  s:card({type:'sticky',palette:'sky',caption:'Plan'}),
  p:card({type:'sticky'}),
  e:card({type:'shape',shape:'ellipse',fill:'none'}),
  d:card({type:'shape',shape:'diamond',fill:'rose'}),
  t:card({type:'text'}),
  n:card({type:'note'}),
 };
 const nodes=Object.keys(cards).map(id=>({id,type:'note',title:id.toUpperCase(),bgColour:undefined}));
 const mapped=api.canvasObjectNodes(nodes,id=>cards[id]);
 const byId=Object.fromEntries(mapped.map(node=>[node.id,node]));
 assert.equal(byId.s.type,'sticky');
 assert.equal(byId.s.title,'Plan');
 assert.equal(byId.s.bgColour,'var(--canvas-object-sky)');
 assert.equal(byId.p.title,'');
 assert.equal(byId.p.bgColour,'var(--canvas-object-amber)');
 assert.equal(byId.e.type,'ellipse');
 assert.equal(byId.e.bgColour,undefined);
 assert.equal(byId.d.type,'diamond');
 assert.equal(byId.d.bgColour,'var(--canvas-object-rose)');
 assert.equal(byId.t.type,'text');
 assert.equal(byId.n,nodes[5]);
 // the mapper never mutates the rendered input
 assert.equal(nodes[0].type,'note');
});

// Review-3 fix (A2b): a canvas object never renders its tool name as a stage text formation.
test('stickies, shapes and text objects are a quiet disc on the stage, like notes', async()=>{
 const {applyResearchMaterial}=await import('../build/researchMaterial.js');
 const {fieldStudies,clone}=await import('../build/model.js');
 for(const [kind,geometry] of [['sticky'],['shape','ellipse'],['text']]){
  const scene=clone(fieldStudies().scenes[0]);
  applyResearchMaterial(scene,{type:'create-card',kind,...(geometry?{geometry}:{}),position:{x:0,y:0}});
  const e=scene.entities.at(-1);
  assert.equal(e.shape,'disc',kind);assert.equal(e.text,'',kind);
  assert.ok(e.sequence.steps.every(step=>step.shape==='disc'&&step.text===''),kind);
 }
});
