// lane-1 B2: Obsidian `.canvas` interchange. A composed scene exports as the
// documented JSON Canvas; a hand-authored canvas parses with named refusals and
// plans an import in the Scene's own vocabulary. Semantic relations always carry
// their native identity; degradations are named in the export header.
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
 temporary=await mkdtemp(join(tmpdir(),'oi-obsidian-canvas-'));
 const out=join(temporary,'obsidian-canvas.mjs');
 await build({
  stdin:{contents:"export * from './src/obsidianCanvas.ts';export * from './src/researchMaterial.ts';export {researchMaterialLabel} from './src/undoLabels.ts';",resolveDir:engine},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
});
test.after(()=>rm(temporary,{recursive:true,force:true}));

/** A composed scene: two note cards and a link card in one frame, a sticky outside it, one semantic relation with sides. */
function fixture(){
 return {
  nodes:[
   {id:'n1',kind:'note',title:'Alpha',text:'Alpha body',x:100,y:200,width:240,height:160},
   {id:'n2',kind:'note',title:'Beta',x:400,y:200,width:240,height:160},
   {id:'e1',kind:'embed',title:'Source',url:'https://example.org/source',x:100,y:420,width:240,height:160},
   {id:'s1',kind:'sticky',title:'Loose sticky',x:900,y:900,width:160,height:120},
  ],
  edges:[{id:'rel-1',fromNode:'n1',toNode:'n2',fromSide:'right',toSide:'left',relationKind:'supports'}],
  frames:[{id:'f1',label:'Frame 1',title:'Pair',memberIds:['n1','n2']}],
 };
}

test('an exported canvas places every card, frame and connection where the lens drew it', ()=>{
 const {document,json,dropped}=api.exportObsidianCanvas(fixture());
 const reparsed=api.parseObsidianCanvas(json);
 assert.equal(reparsed.nodes.length,5);
 const byId=Object.fromEntries(document.nodes.map(node=>[node.id,node]));
 assert.deepEqual([byId.n1.x,byId.n1.y,byId.n1.width,byId.n1.height],[100,200,240,160]);
 assert.equal(byId.n1.type,'text');
 assert.match(byId.n1.text,/Alpha body/);
 assert.equal(byId.e1.type,'link');
 assert.equal(byId.e1.url,'https://example.org/source');
 const group=document.nodes.find(node=>node.type==='group');
 assert.equal(group.label,'Pair');
 for(const member of [byId.n1,byId.n2])assert.ok(member.x>=group.x&&member.y>=group.y&&member.x+member.width<=group.x+group.width&&member.y+member.height<=group.y+group.height,member.id);
 assert.equal(byId.s1.type,'text');
 assert.ok(dropped.some(line=>/sticky colour keys/.test(line)));
});

test('a semantic relation exports as an edge with its sides and native identity, never as a plain edge', ()=>{
 const {document}=api.exportObsidianCanvas(fixture());
 assert.equal(document.edges.length,1);
 const [edge]=document.edges;
 assert.equal(edge.fromNode,'n1');
 assert.equal(edge.toNode,'n2');
 assert.equal(edge.fromSide,'right');
 assert.equal(edge.toSide,'left');
 assert.deepEqual(edge.oi,{relation:'rel-1',kind:'supports'});
 assert.match(edge.label,/rel-1/);
});

test('a relation whose card is not exported is named in the header and left out', ()=>{
 const input=fixture();
 input.edges.push({id:'rel-2',fromNode:'n1',toNode:'missing',relationKind:'cites'});
 const {document,dropped}=api.exportObsidianCanvas(input);
 assert.equal(document.edges.length,1);
 assert.ok(dropped.some(line=>/relation whose card is not exported/.test(line)));
 assert.equal(document.oi.format,'oi.canvas-export/v1');
});

test('an exported file reads back with its nodes, positions and sides intact', ()=>{
 const {json,document}=api.exportObsidianCanvas(fixture());
 const back=api.parseObsidianCanvas(json);
 assert.deepEqual(back.nodes.map(node=>node.id),document.nodes.map(node=>node.id));
 assert.deepEqual(back.edges[0].fromSide,'right');
});

test('invalid JSON is refused at validation with a named error', ()=>{
 assert.throws(()=>api.parseObsidianCanvas('{"nodes": [}'),{name:'ObsidianCanvasError',message:/^Invalid \.canvas file: the file is not valid JSON/});
 assert.throws(()=>api.parseObsidianCanvas('[]'),/Invalid \.canvas file: the top level must be an object/);
});

test('an unknown node type, a missing coordinate and a dangling edge are each refused by name', ()=>{
 assert.throws(()=>api.parseObsidianCanvas(JSON.stringify({nodes:[{id:'a',type:'picture',x:0,y:0,width:1,height:1}]})),/node "a" has unknown type "picture"/);
 assert.throws(()=>api.parseObsidianCanvas(JSON.stringify({nodes:[{id:'a',type:'text',text:'t',y:0,width:1,height:1}]})),/node "a" needs a numeric x/);
 assert.throws(()=>api.parseObsidianCanvas(JSON.stringify({nodes:[{id:'a',type:'text',text:'t',x:0,y:0,width:1,height:1}],edges:[{id:'e',fromNode:'a',toNode:'zz'}]})),/edge "e" ends at toNode "zz"/);
 assert.throws(()=>api.parseObsidianCanvas(JSON.stringify({nodes:[{id:'a',type:'link',url:'javascript:alert(1)',x:0,y:0,width:1,height:1}]})),/link node "a" needs an http or https url/);
});

test('a hand-authored canvas plans an import: text nodes become note cards, a group becomes a frame, connections are named as not imported', ()=>{
 const text=JSON.stringify({
  nodes:[
   {id:'t1',type:'text',text:'First line\nsecond',x:10,y:20,width:200,height:100},
   {id:'t2',type:'text',text:'Second card',x:260,y:20,width:200,height:100},
   {id:'g1',type:'group',label:'Cluster',x:0,y:0,width:500,height:200},
   {id:'l1',type:'link',url:'https://example.org/x',x:10,y:300,width:200,height:100},
  ],
  edges:[{id:'e1',fromNode:'t1',toNode:'t2'}],
 });
 const plan=api.planObsidianImport(api.parseObsidianCanvas(text));
 const byKey=Object.fromEntries(plan.cards.map(card=>[card.key,card]));
 assert.deepEqual([byKey.t1.kind,byKey.t1.title,byKey.t1.x,byKey.t1.y],['note','First line',10,20]);
 assert.equal(byKey.l1.kind,'embed');
 assert.equal(plan.frames.length,1);
 assert.deepEqual(plan.frames[0].memberKeys,['t1','t2']);
 assert.equal(plan.frames[0].title,'Cluster');
 assert.deepEqual(plan.edges.map(edge=>[edge.fromKey,edge.toKey,edge.relationKind]),[['t1','t2','connection']]);
 assert.deepEqual(plan.skipped,[]);
});

test('a connection whose end is a frame or a missing card is named as not imported, with its reason', ()=>{
 const text=JSON.stringify({
  nodes:[
   {id:'t1',type:'text',text:'One',x:0,y:0,width:100,height:50},
   {id:'g1',type:'group',label:'Box',x:-10,y:-10,width:200,height:100},
  ],
  edges:[{id:'e1',fromNode:'t1',toNode:'g1',label:'contains'}],
 });
 const plan=api.planObsidianImport(api.parseObsidianCanvas(text));
 assert.equal(plan.edges.length,0);
 assert.ok(plan.skipped.some(line=>/"contains".*not imported: a frame is not a connection end/.test(line)),plan.skipped.join(' | '));
});

// B2 — the import is one material batch: one working copy, one validation, one commit, one undo label.
function sceneOf(){return {entities:[],research:api.emptyResearchMaterial()};}

test('a batch is one change: cards, content, sizes and a frame over them all land together, labelled for undo', ()=>{
 const scene=sceneOf();
 const a='research-a',b='research-b';
 api.applyResearchMaterial(scene,{type:'batch',label:'Import .canvas',actions:[
  {type:'create-card',id:a,kind:'note',position:{x:0,y:0},title:'Alpha'},
  {type:'card-content',id:a,content:api.noteBlocksFromText('Alpha body')},
  {type:'resize',id:a,width:240,height:160},
  {type:'create-card',id:b,kind:'embed',position:{x:1,y:1},title:'Source',url:'https://example.org/source'},
  {type:'frame-save',id:'frame-1',label:'Pair',memberRefs:[a,b]},
  {type:'frame-title',id:'frame-1',title:'Pair'},
 ]});
 assert.deepEqual(scene.entities.map(entity=>entity.id),[a,b]);
 assert.equal(scene.research.cards[a].content,api.noteBlocksFromText('Alpha body'));
 assert.deepEqual(scene.research.cards[a].size,{width:240,height:160});
 assert.equal(scene.research.cards[b].url,'https://example.org/source');
 assert.deepEqual(scene.research.frames['frame-1'].memberRefs,[a,b]);
 assert.equal(scene.research.frames['frame-1'].title,'Pair');
 assert.equal(api.researchMaterialLabel({type:'batch',label:'Import .canvas',actions:[]}),'Import .canvas');
});

test('a refused step refuses the whole batch and leaves the Scene exactly as it was', ()=>{
 const scene=sceneOf();
 api.applyResearchMaterial(scene,{type:'create-card',kind:'note',position:{x:0,y:0},title:'Kept'});
 const before=JSON.stringify(scene);
 assert.throws(()=>api.applyResearchMaterial(scene,{type:'batch',label:'Import .canvas',actions:[
  {type:'create-card',id:'research-new',kind:'note',position:{x:0,y:0},title:'New'},
  {type:'frame-save',id:'frame-x',label:'Bad',memberRefs:['no-such-card']},
 ]}),/Frame member is missing/);
 assert.equal(JSON.stringify(scene),before);
});

test('a batch never nests, is never empty, and needs its label; a caller-minted card id is validated', ()=>{
 const scene=sceneOf();
 assert.throws(()=>api.applyResearchMaterial(scene,{type:'batch',label:'x',actions:[{type:'batch',label:'y',actions:[]}]}),/cannot hold another batch/);
 assert.throws(()=>api.applyResearchMaterial(scene,{type:'batch',label:'x',actions:[]}),/one to 256 changes/);
 assert.throws(()=>api.applyResearchMaterial(scene,{type:'batch',label:' ',actions:[{type:'create-card',kind:'note',position:{x:0,y:0},title:'t'}]}),/Invalid batch label/);
 assert.throws(()=>api.applyResearchMaterial(scene,{type:'create-card',id:'bad id!',kind:'note',position:{x:0,y:0},title:'t'}),/Invalid card id/);
 assert.equal(scene.entities.length,0);
});
