import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasBasis,assertCanvasBasis,bindResearchHost} from '../src/canvas/adapter.ts';

// Address fixtures exercise guards only. They make no native mutation/receipt/saving claims.
const nativeReading=()=>({document:{expression_ref:'expression:canvas-fixture',revision:9},bindings:{sceneA:{scene_ref:'scene:exact-A'},sceneB:{scene_ref:'scene:exact-B'}}});
test('captured gesture refuses native revision, expression, and Scene replacement',()=>{
 let reading=nativeReading();const source={nativeView:()=>reading};const basis=canvasBasis(source,'sceneA');
 assertCanvasBasis(source,basis);
 reading={...reading,document:{...reading.document,revision:10}};
 assert.throws(()=>assertCanvasBasis(source,basis),/changed during this gesture/);
 assertCanvasBasis(source,basis,false);
 reading={...reading,document:{...reading.document,expression_ref:'expression:another'}};
 assert.throws(()=>assertCanvasBasis(source,basis,false),/changed during this gesture/);
 reading=nativeReading();reading.bindings.sceneA.scene_ref='scene:replacement';
 assert.throws(()=>assertCanvasBasis(source,basis,false),/changed during this gesture/);
});
test('pinned receiver keeps the exact native address and refuses foreign requests without invoking owner',async()=>{
 let ownerReads=0;const reading=nativeReading();const source={nativeView:()=>reading,sceneId:()=> 'sceneB',read:()=>{ownerReads++;throw Error('No live owner is supplied to this guard test.');}};
 const bound=bindResearchHost(source,'sceneA',{});
 assert.equal(bound.sceneId(),'sceneA');assert.equal(bound.moveMany,undefined);assert.equal(bound.transformBlueprint,undefined);
 await assert.rejects(bound.read({expression_ref:reading.document.expression_ref,revision:9,scene_ref:'scene:exact-B'}),/stale or different/);
 await assert.rejects(bound.read({expression_ref:reading.document.expression_ref,revision:8,scene_ref:'scene:exact-A'}),/stale or different/);
 assert.equal(ownerReads,0);
 assert.throws(()=>bound.select('sceneB',null),/another Scene/);
});
test('unavailable native binding stays unavailable rather than binding a similarly named scene',()=>{
 const source={nativeView:()=>nativeReading()};assert.throws(()=>canvasBasis(source,'named-like-A'),/no retained native/);
});
