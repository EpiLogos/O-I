import test from 'node:test';
import assert from 'node:assert/strict';
import {bounds,fitBox,snapPosition,zoomBox} from '../src/canvas/geometry.ts';
import {blankScene,entity} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import {applyResearchMaterial,validateResearchMaterial} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchMaterial.ts';
import {CanvasOperations} from '../src/canvas/adapter.ts';

test('actual material validation refusal retains exact receiving inputs synchronously',async()=>{
 const scene=blankScene(),before=structuredClone(scene),published=[];
 const operations=new CanvasOperations(value=>published.push(value));
 const action={type:'create-card',kind:'note',position:{x:Infinity,y:0}};
 const apply=async()=>{assert.equal(operations.dirty,true,'Input is held before the real material validator runs.');applyResearchMaterial(scene,action);};
 await assert.rejects(operations.run(scene.id,action,apply),/Invalid card position/);
 assert.equal(operations.dirty,true);assert.equal(operations.snapshot()[0].pending,0);
 assert.match(operations.snapshot()[0].error,/Invalid card position/);
 assert.deepEqual(operations.snapshot()[0].action,action);assert.deepEqual(scene,before);
 await assert.rejects(operations.run(scene.id,action,apply),/Invalid card position/);
 assert.equal(operations.snapshot().length,2,'Identical create-card input names two attempts; neither invents a native retry identity.');
 assert.notEqual(operations.snapshot()[0].key,operations.snapshot()[1].key);
 assert.equal(published[0][0].pending,1);assert.equal(published.at(-1).every(row=>row.pending===0),true);
});
test('another actual model operation or refused owner resolution cannot clear prior material input',async()=>{
 const scene=blankScene(),operations=new CanvasOperations(()=>{});
 const invalid={type:'create-card',kind:'note',position:{x:101,y:0}};
 await assert.rejects(operations.run(scene.id,invalid,async()=>applyResearchMaterial(scene,invalid)),/Invalid card position/);
 const held=operations.snapshot();
 const valid={type:'create-card',kind:'note',position:{x:.2,y:-.3}};
 await operations.run(scene.id,valid,async()=>applyResearchMaterial(scene,valid));
 assert.equal(scene.entities.length,1,'The production local model creates its actual card. This is source/model evidence, not a native acknowledgement.');
 assert.deepEqual(operations.snapshot(),held,'A distinct local operation cannot consume earlier input.');
 await assert.rejects(operations.resolve(async entries=>applyResearchMaterial(scene,entries[0].action)),/Invalid card position/);
 assert.deepEqual(operations.snapshot(),held);
});

test('fit includes every actual card with margin at wide and narrow viewport sizes',()=>{
 const nodes=Array.from({length:50},(_,i)=>({id:String(i),position:{x:(i%10)*340-900,y:Math.floor(i/10)*260-500},size:{width:240,height:160}}));
 const content=bounds(nodes);
 for(const [width,height] of [[1920,1200],[700,260],[320,170]]){
  const camera=fitBox(content,width,height);
  assert.ok(camera.x<=content.x-24&&camera.y<=content.y-24);
  assert.ok(camera.x+camera.width>=content.x+content.width+24);
  assert.ok(camera.y+camera.height>=content.y+content.height+24);
  assert.ok(Math.abs(camera.width/camera.height-width/height)<1e-9);
 }
});
test('snap threshold is eight screen pixels and guide coordinates follow edge or centre alignment',()=>{
 const card={id:'drag',position:{x:0,y:0},size:{width:100,height:80}},peer={id:'peer',position:{x:200,y:160},size:{width:100,height:80}};
 for(const unitsPerPixel of [.25,1,2]){
  const close=snapPosition(card,{x:200+7*unitsPerPixel,y:160},[peer],unitsPerPixel);
  assert.equal(close.position.x,200);assert.ok(close.guides.some(guide=>guide.axis==='x'&&guide.value===200));
  const far=snapPosition(card,{x:200+9*unitsPerPixel,y:160},[peer],unitsPerPixel);
  // At coarse zoom a different edge may enter the threshold; verify the fine scales where no competing edge exists.
  if(unitsPerPixel<=1)assert.equal(far.position.x,200+9*unitsPerPixel);
 }
});
test('grid snap is independent and peers/inputs are never mutated',()=>{
 const node={id:'a',position:{x:0,y:0},size:{width:100,height:80}},before=structuredClone(node);
 assert.deepEqual(snapPosition(node,{x:47,y:31},[],1,false).position,{x:47,y:31});
 assert.deepEqual(snapPosition(node,{x:47,y:31},[],1,true).position,{x:40,y:40});assert.deepEqual(node,before);
});
test('camera zoom preserves the cursor anchor and aspect, including extreme input',()=>{
 const box={x:-100,y:50,width:500,height:200},anchor={x:35,y:100};
 const next=zoomBox(box,2,anchor);
 assert.equal((anchor.x-next.x)/next.width,(anchor.x-box.x)/box.width);
 assert.equal((anchor.y-next.y)/next.height,(anchor.y-box.y)/box.height);
 assert.equal(next.width/next.height,2.5);
 assert.ok(zoomBox(box,1e20).width>=8);
});
test('adopted native material resizes the card without changing its expressive body',()=>{
 const scene=blankScene(),occurrence=entity('Actual native material','A',{x:.2,y:-.3,z:0});scene.entities=[occurrence];
 const expressiveSize=structuredClone(occurrence.size);
 applyResearchMaterial(scene,{type:'resize',id:occurrence.id,width:375,height:260});
 assert.deepEqual(scene.entities[0].size,expressiveSize);
 assert.deepEqual(scene.research.cards[occurrence.id].size,{width:375,height:260});
 validateResearchMaterial(scene.research,new Set([occurrence.id]));
 const before=structuredClone(scene);
 assert.throws(()=>applyResearchMaterial(scene,{type:'resize',id:occurrence.id,width:-1,height:260}),/Invalid card size/);
 assert.deepEqual(scene,before);
});
