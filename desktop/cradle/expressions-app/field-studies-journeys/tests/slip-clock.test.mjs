import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldStudies,validateJourney,clone} from '../build/model.js';
import {retimeScene,rollSceneSeam,slipScene,splitScene,initialiseSceneSaves} from '../build/sceneWorkflow.js';

// E06b: a slipped scene's entry offset stays inside its own length. Every op that shortens a scene
// (trim, roll, split's left half) clamps the offset to the scene's last millisecond; an absent offset
// stays absent. Run after the bundle is emitted: this suite imports the build/ modules.

// Eight scenes of 14 s, as scene-moves.test.mjs builds them.
function fixture(){const j=fieldStudies();j.scenes.forEach((s,i)=>{s.transition=1+(i%3)*.5;s.duration=14;});return initialiseSceneSaves(clone(j));}
const LAST_INSTANT=.001;

test('trim below the offset clamps it to the scene\'s last millisecond; a valid offset is kept exactly',()=>{
 const j=fixture();const s=j.scenes[0];
 slipScene(j,s.id,10);
 retimeScene(j,s.id,{duration:6});
 assert.ok(Math.abs(j.scenes[0].entryOffset-(6-LAST_INSTANT))<1e-12,'clamped to 6 - 0.001');
 assert.ok(j.scenes[0].entryOffset<j.scenes[0].duration,'inside its scene');
 const k=fixture();slipScene(k,k.scenes[0].id,3);
 retimeScene(k,k.scenes[0].id,{duration:10});
 assert.equal(k.scenes[0].entryOffset,3,'still valid: untouched');
});

test('an absent offset stays absent through a trim: no key is added',()=>{
 const j=fixture();
 retimeScene(j,j.scenes[1].id,{duration:5});
 assert.equal('entryOffset' in j.scenes[1],false);
});

test('roll: the left shrinking below its offset clamps it; the right growing keeps its offset',()=>{
 const j=fixture();
 slipScene(j,j.scenes[0].id,10);
 rollSceneSeam(j,j.scenes[0].id,-8);
 assert.equal(j.scenes[0].duration,6);
 assert.ok(Math.abs(j.scenes[0].entryOffset-(6-LAST_INSTANT))<1e-12,'left clamped');
 assert.equal('entryOffset' in j.scenes[1],false,'the right, growing, gained no key');
});

test('roll: the right shrinking below its offset clamps it; the left growing keeps its offset',()=>{
 const j=fixture();
 slipScene(j,j.scenes[1].id,10);
 rollSceneSeam(j,j.scenes[0].id,12);
 assert.equal(j.scenes[1].duration,2);
 assert.ok(Math.abs(j.scenes[1].entryOffset-(2-LAST_INSTANT))<1e-12,'right clamped');
 const k=fixture();slipScene(k,k.scenes[0].id,10);
 rollSceneSeam(k,k.scenes[0].id,-2);
 assert.equal(k.scenes[0].entryOffset,10,'left still longer than its offset: untouched');
});

test('split: the left half shorter than its offset clamps it; the right still has no offset',()=>{
 const j=fixture();
 slipScene(j,j.scenes[2].id,4);
 splitScene(j,j.scenes[2].id,2,'clock-split');
 assert.ok(Math.abs(j.scenes[2].entryOffset-(2-LAST_INSTANT))<1e-12,'left clamped to its new length');
 assert.equal('entryOffset' in j.scenes[3],false);
 const k=fixture();slipScene(k,k.scenes[2].id,4);
 splitScene(k,k.scenes[2].id,6,'clock-split-2');
 assert.equal(k.scenes[2].entryOffset,4,'left still longer than its offset: untouched');
});

test('a clamped document still validates, so the clamp never produces a refused journey',()=>{
 const j=fixture();
 slipScene(j,j.scenes[0].id,10);retimeScene(j,j.scenes[0].id,{duration:4});
 slipScene(j,j.scenes[3].id,9);rollSceneSeam(j,j.scenes[3].id,-8);
 assert.doesNotThrow(()=>validateJourney(clone(j)));
});

// E06c: the engine reads the same evolution point as the tracks. The render config carries the entry offset as the
// entity sequence clock shift; the exported config never does, and an unslipped scene's render config is unchanged.
test('E06c: the render config shifts the entity sequence clock by the entry offset; export never carries it',async()=>{
 const {toRenderConfig,toNativeConfig,nativeExport}=await import('../build/nativeBridge.js');
 const j=fixture();const s=j.scenes[0];
 assert.deepEqual(toRenderConfig(s),toNativeConfig(s));
 assert.equal('sequenceOffsetS' in toRenderConfig(s),false);
 slipScene(j,s.id,3.5);
 assert.equal(toRenderConfig(s).sequenceOffsetS,3.5);
 assert.equal('sequenceOffsetS' in nativeExport(s).config,false);
});
