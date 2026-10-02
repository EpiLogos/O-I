import test from 'node:test';
import assert from 'node:assert/strict';
import {blankJourney,blankScene,entity,clone,validateJourney} from '../build/model.js';
import {appendFormationState} from '../build/formationAuthoring.js';
import {syncHeldState} from '../build/workspacePreferences.js';
import {foldObjectState} from '../build/foldState.js';
import {applyChain,CHAIN_PRESETS} from '../build/nativeFeatures.js';
import {toNativeConfig,nativeSnapshotToJourney} from '../build/nativeBridge.js';

const ascii=text=>({kind:'ascii',ascii:{text,fontFamily:'monospace'}});
const layered=()=>{const e=entity('Layered artwork','O');e.layers=[{id:'front',text:'O',z:.25,source:ascii('###')},{id:'back',text:'I',z:-.25}];return e;};

test('adding a source preserves old artwork and fits a square source envelope at the same area',()=>{
 const e=layered();e.size={x:2,y:.5};e.sequence.enabled=false;
 const index=appendFormationState(e,'',ascii('########'),{});
 assert.equal(index,1);assert.deepEqual(e.sequence.steps[1].layers,[]);
 assert.deepEqual(e.sequence.steps[0].layers.map(l=>l.text),['O','I']);
 assert.deepEqual(e.sequence.steps[0].objectState.size,{x:2,y:.5});
 assert.deepEqual(e.sequence.steps[1].objectState.size,{x:1,y:1});
 assert.equal(e.sequence.steps[1].objectState.normalized,true);
 syncHeldState(e,1);assert.deepEqual(e.layers,[]);assert.equal(e.source.ascii.text,'########');
 syncHeldState(e,0);assert.equal(e.layers.length,2);assert.deepEqual(e.size,{x:2,y:.5});
});

test('locked formations and full sequences refuse additions without changing data',()=>{
 const e=layered();e.locked=true;let before=clone(e);
 assert.throws(()=>appendFormationState(e,'I',undefined,{}),/unlocked/);assert.deepEqual(e,before);
 e.locked=false;while(e.sequence.steps.length<32)e.sequence.steps.push({...clone(e.sequence.steps[0]),id:'state-'+e.sequence.steps.length});before=clone(e);
 assert.throws(()=>appendFormationState(e,'I',undefined,{}),/32 states/);assert.deepEqual(e,before);
});

test('native export and reopen retain source bodies and explicit ordinary-state overrides',()=>{
 const j=blankJourney(),s=j.scenes[0],e=layered();s.entities=[e];
 appendFormationState(e,'',ascii('####'),{});e.sequence.enabled=true;
 const reopened=nativeSnapshotToJourney(toNativeConfig(s)).scenes[0].entities[0];
 assert.equal(reopened.sequence.steps[0].layers[0].source.ascii.text,'###');
 assert.deepEqual(reopened.sequence.steps[1].layers,[]);
 assert.equal(reopened.sequence.steps[1].source.ascii.text,'####');
 assert.deepEqual(validateJourney(JSON.parse(JSON.stringify(j))),JSON.parse(JSON.stringify(j)));
});

test('folding ordinary and layered artwork into an earlier layered sequence keeps each source body',()=>{
 const j=blankJourney(),to=j.scenes[0],from=blankScene();j.scenes.push(from);
 const target=layered(),ordinary=entity('A glyph','WW'),source=layered();source.id='source-artwork';
 to.entities=[target];from.entities=[ordinary,source];
 foldObjectState(j,from.id,ordinary.id,0,to.id,target.id,'seconds');
 foldObjectState(j,from.id,source.id,0,to.id,target.id,'seconds');
 assert.deepEqual(target.sequence.steps[1].layers,[]);
 assert.equal(target.sequence.steps[2].layers[0].source.ascii.text,'###');
 assert.notEqual(target.sequence.steps[0].layers[0].id,target.sequence.steps[2].layers[0].id);
 assert.deepEqual(validateJourney(JSON.parse(JSON.stringify(j))),JSON.parse(JSON.stringify(j)));
});

test('a glyph chain replaces a layered shape through ordinary sequence states',()=>{
 const e=layered();applyChain(e,CHAIN_PRESETS[0].id);
 assert.ok(e.sequence.steps.length>1);assert.ok(e.sequence.steps.every(k=>Array.isArray(k.layers)&&k.layers.length===0));
});

test('imports refuse ambiguous layer-source identities and malformed state sources',()=>{
 const j=blankJourney(),e=layered();j.scenes[0].entities=[e];
 e.sequence.steps.push({...clone(e.sequence.steps[0]),id:'second',layers:[{id:'front',text:'O',z:0,source:ascii('DIFFERENT')}]});
 assert.throws(()=>validateJourney(j),/Invalid state layer/);
 e.sequence.steps[1].layers[0].id='new-body';e.sequence.steps[1].layers[0].source={kind:'image',image:{dataUrl:'https://unembedded.invalid/image.png'}};
 assert.throws(()=>validateJourney(j));
});
