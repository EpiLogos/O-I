import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldStudies,validateJourney,clone} from '../build/model.js';
import {retimeScene,rollSceneSeam,slipScene,splitScene,initialiseSceneSaves} from '../build/sceneWorkflow.js';

// E06b, changed on purpose by O-I #747 content anchoring (DLW build ruling 2026-11-06: only Slip moves the content under fixed
// edges): an end edge never moves a scene's entry, so a trim, a roll's left side or a split's left half that ends a slipped scene
// before its entry keeps the entry, a valid start into the evolution (model.ts); a start edge moves the entry with it. An absent
// offset stays absent. Run after the bundle is emitted: this suite imports the build/ modules.

// Eight scenes of 14 s, as scene-moves.test.mjs builds them.
function fixture(){const j=fieldStudies();j.scenes.forEach((s,i)=>{s.transition=1+(i%3)*.5;s.duration=14;});return initialiseSceneSaves(clone(j));}

test('trim below the offset keeps it: the end edge does not move the content; a valid offset is kept exactly',()=>{
 const j=fixture();const s=j.scenes[0];
 slipScene(j,s.id,10);
 retimeScene(j,s.id,{duration:6});
 assert.equal(j.scenes[0].entryOffset,10,'the entry stays where it was, past the new end');
 const k=fixture();slipScene(k,k.scenes[0].id,3);
 retimeScene(k,k.scenes[0].id,{duration:10});
 assert.equal(k.scenes[0].entryOffset,3,'still valid: untouched');
});

test('an absent offset stays absent through a trim: no key is added',()=>{
 const j=fixture();
 retimeScene(j,j.scenes[1].id,{duration:5});
 assert.equal('entryOffset' in j.scenes[1],false);
});

test('roll: the left shrinking below its offset keeps it; the right growing reaches back into its own content',()=>{
 const j=fixture();
 slipScene(j,j.scenes[0].id,10);slipScene(j,j.scenes[1].id,8);
 rollSceneSeam(j,j.scenes[0].id,-8);
 assert.equal(j.scenes[0].duration,6);
 assert.equal(j.scenes[0].entryOffset,10,'left keeps its entry');
 assert.equal('entryOffset' in j.scenes[1],false,'the right, growing back to its content\'s start, has no offset left');
});

test('roll: the right shrinking moves its entry with its start edge; the left growing keeps its offset',()=>{
 const j=fixture();
 slipScene(j,j.scenes[1].id,10);
 rollSceneSeam(j,j.scenes[0].id,12);
 assert.equal(j.scenes[1].duration,2);
 assert.equal(j.scenes[1].entryOffset,22,'right enters its content 12 s later');
 const k=fixture();slipScene(k,k.scenes[0].id,10);slipScene(k,k.scenes[1].id,3);
 rollSceneSeam(k,k.scenes[0].id,-2);
 assert.equal(k.scenes[0].entryOffset,10,'left: untouched');
 assert.equal(k.scenes[1].entryOffset,1,'right: 2 s earlier into its content');
});

test('split: the left half shorter than its offset keeps it; the right still has no offset',()=>{
 const j=fixture();
 slipScene(j,j.scenes[2].id,4);
 splitScene(j,j.scenes[2].id,2,'clock-split');
 assert.equal(j.scenes[2].entryOffset,4,'left keeps its entry');
 assert.equal('entryOffset' in j.scenes[3],false);
 const k=fixture();slipScene(k,k.scenes[2].id,4);
 splitScene(k,k.scenes[2].id,6,'clock-split-2');
 assert.equal(k.scenes[2].entryOffset,4,'left still longer than its offset: untouched');
});

test('a document with entries past their scenes\' ends still validates, so anchoring never produces a refused journey',()=>{
 const j=fixture();
 slipScene(j,j.scenes[0].id,10);retimeScene(j,j.scenes[0].id,{duration:4});
 slipScene(j,j.scenes[3].id,9);slipScene(j,j.scenes[4].id,8);rollSceneSeam(j,j.scenes[3].id,-8);
 assert.deepEqual([j.scenes[3].duration,j.scenes[3].entryOffset],[6,9]);
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
