import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {DocumentStore} from '../build/store.js';
import {fieldStudies,SCENE_DURATION_MIN,SCENE_DURATION_MAX,SCENE_TRANSITION_MIN,SCENE_TRANSITION_MAX} from '../build/model.js';
import {initialiseSceneSaves,sceneSaveState,moveScene,retimeScene,applyTimelineMove,SceneContentMutationError} from '../build/sceneWorkflow.js';
import * as timeline from '../build/journeyTimelineLayout.js';

// E02b, E03 and E15d: the scene timeline ops the app delegates to are pure and
// tested directly. app.ts is a DOM entry that cannot load under node, so its
// wiring is read from source (typescript AST), as undo-wiring does.
const require=createRequire(import.meta.url);
const ts=require('../../node_modules/typescript');
const appSource=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const layoutSource=fs.readFileSync(new URL('../src/journeyTimelineLayout.ts',import.meta.url),'utf8');

test('a retimed or moved clip keeps its save; a content edit does not', ()=>{
 const j=initialiseSceneSaves(fieldStudies());
 const first=j.scenes[0],second=j.scenes[1];
 assert.equal(sceneSaveState(j,first),'Saved');
 retimeScene(j,first.id,{duration:first.duration+5,transition:SCENE_TRANSITION_MIN+.5});
 assert.equal(sceneSaveState(j,j.scenes.find(s=>s.id===first.id)),'Saved');
 moveScene(j,second.id,0);
 assert.equal(sceneSaveState(j,j.scenes.find(s=>s.id===second.id)),'Saved');
 j.scenes.find(s=>s.id===second.id).character='An edited character.';
 assert.equal(sceneSaveState(j,j.scenes.find(s=>s.id===second.id)),'Edited since save');
});

test('a timeline op is one labelled step, and a refused op leaves no step and no change', ()=>{
 const store=new DocumentStore(fieldStudies());
 const [first,second]=store.document.scenes.map(s=>s.id);
 store.change('Reorder scenes',d=>moveScene(d,second,0));
 assert.equal(store.undoStack.length,1);
 assert.equal(store.undoLabel(),'Reorder scenes');
 assert.equal(store.document.scenes[0].id,second);
 assert.equal(store.undo(),true);
 assert.equal(store.document.scenes[0].id,first);

 const before=JSON.stringify(store.document);
 assert.throws(()=>store.change('Trim scene 1',d=>retimeScene(d,first,{duration:SCENE_DURATION_MAX+1})),/lasts/);
 assert.equal(JSON.stringify(store.document),before);
 assert.equal(store.undoStack.length,0);
 assert.equal(store.undoLabel(),null);
});

test('the guarded move refuses any timeline move that would change a scene, and records nothing', ()=>{
 const store=new DocumentStore(fieldStudies());
 const before=JSON.stringify(store.document);
 assert.throws(()=>store.change('Reorder scenes',d=>applyTimelineMove(d,scenes=>{scenes[0].character='changed by a move';})),SceneContentMutationError);
 assert.equal(JSON.stringify(store.document),before);
 assert.equal(store.undoStack.length,0);
});

test('the Hold and Transition bounds are the model\'s, and the timeline layout re-exports them', ()=>{
 assert.deepEqual([SCENE_DURATION_MIN,SCENE_DURATION_MAX,SCENE_TRANSITION_MIN,SCENE_TRANSITION_MAX],[1,3600,0,30]);
 assert.equal(timeline.SCENE_DURATION_MIN,SCENE_DURATION_MIN);
 assert.equal(timeline.SCENE_DURATION_MAX,SCENE_DURATION_MAX);
 assert.doesNotMatch(layoutSource,/const SCENE_DURATION_(MIN|MAX)\s*=/);
 assert.match(layoutSource,/import \{SCENE_DURATION_MIN,SCENE_DURATION_MAX\} from '\.\/model';/);
});

// Source gates over app.ts. The AST carries parents, so a gate can ask what encloses a call.
const sf=ts.createSourceFile('app.ts',appSource,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
const lineOf=node=>sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1;
const walk=(node,visit)=>{visit(node);ts.forEachChild(node,child=>walk(child,visit));};
const calleeName=call=>ts.isPropertyAccessExpression(call.expression)?call.expression.name.text:ts.isIdentifier(call.expression)?call.expression.text:null;
const enclosingCall=(node,name)=>{for(let p=node.parent;p;p=p.parent)if(ts.isCallExpression(p)&&calleeName(p)===name)return p;return null;};
const enclosingFunctionName=node=>{for(let p=node.parent;p;p=p.parent)if(ts.isFunctionDeclaration(p))return p.name?.text??null;return null;};
const callsNamed=name=>{const found=[];walk(sf,n=>{if(ts.isCallExpression(n)&&calleeName(n)===name)found.push(n);});return found;};

test('every scene timeline write in app.ts goes through the guarded model op', ()=>{
 const splices=[];walk(sf,n=>{if(ts.isCallExpression(n)&&calleeName(n)==='splice'&&n.expression.getText(sf).includes('scenes'))splices.push(n);});
 assert.ok(splices.length>=1);
 for(const call of splices)assert.ok(enclosingCall(call,'applyTimelineMove'),`scenes.splice at app.ts:${lineOf(call)} bypasses applyTimelineMove`);
 // A write to a Scene's own length or transition: a receiver that is a Scene, not a step, lane or CSS style.
 const writes=[];walk(sf,n=>{if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(n.left)&&['duration','transition'].includes(n.left.name.text)&&['s','scene()','target'].includes(n.left.expression.getText(sf)))writes.push(n);});
 // Only the property take extends a scene's length, and that is a recording, not a timeline move. The draft's take merge now lives in
 // draftStorage.mergeTakeIntoDraft (E19), so app.ts keeps the finished take's write and the merge's write is checked where it lives.
 assert.equal(writes.length,1,'app.ts keeps the property take finish write');
 for(const write of writes)assert.match(write.right.getText(sf),/^Math\.max\(/,`app.ts:${lineOf(write)} writes a timeline fact directly`);
 const draftStorage=fs.readFileSync(new URL('../src/draftStorage.ts',import.meta.url),'utf8');
 assert.ok(draftStorage.includes('scene.duration=Math.max(scene.duration,end);'),'the draft take merge is the other take write, and it extends a scene only by a take');
});

test('the timeline moves, retimes, removals and duplicates each run inside one labelled change', ()=>{
 for(const name of ['moveScene','removeScene','nextSceneFrom','applyTimelineMove']){
  const found=callsNamed(name);
  assert.ok(found.length>=1,`${name} is not used by app.ts`);
  for(const call of found)assert.ok(enclosingCall(call,'changed'),`${name} at app.ts:${lineOf(call)} is outside a labelled change`);
 }
 const retimes=callsNamed('retimeScene');
 // Four: the trim and the Scene inspector's duration/transition, the journey's pace save (lane-5 T3), which retimes each paced beat inside its own labelled change,
 // and the host's pace command (lane W4, journeyEdit), the same labelled retime.
 assert.equal(retimes.length,4);
 for(const call of retimes){
  const inChange=!!enclosingCall(call,'changed'),inHold=enclosingFunctionName(call)==='applyBinding';
  assert.ok(inChange||inHold,`retimeScene at app.ts:${lineOf(call)} is not labelled`);
 }
 assert.match(appSource,/function sceneTimingLabel\(path:string\):string\|undefined\{return path==='duration'\?'Hold':path==='transition'\?'Transition':undefined;\}/);
 assert.match(appSource,/store\.begin\(bindingEditLabel\(sceneTimingLabel\(path\)\?\?PARAMETERS/);
});

test('the scene controls address their Scene by ref, never by the index it stood at', ()=>{
 const cases=new Map();walk(sf,n=>{if(ts.isCaseClause(n)&&ts.isStringLiteral(n.expression))cases.set(n.expression.text,n);});
 for(const name of ['move-scene-left','move-scene-right','duplicate-scene','delete-scene']){
  const clause=cases.get(name);
  assert.ok(clause,`no case for ${name}`);
  const text=clause.getText(sf);
  assert.doesNotMatch(text,/dataset\.index/,`${name} still reads an index`);
  assert.match(text,/dataset\.sceneId|scene\(\)\.id/,`${name} does not address a scene ref`);
 }
 assert.match(appSource,/ib\('move-scene-left','arrowLeft','Move scene earlier',`data-scene-id="\$\{esc\(s\.id\)\}"`\)/);
 assert.match(appSource,/ib\('move-scene-right','arrowRight','Move scene later',`data-scene-id="\$\{esc\(s\.id\)\}"`\)/);
 assert.match(appSource,/ib\('delete-scene','trash','Delete scene',`data-scene-id="\$\{esc\(s\.id\)\}"`\)/);
 assert.doesNotMatch(appSource,/data-scene-index|sceneDragIndex/);
 assert.match(appSource,/let sceneDragId=''/);
});
