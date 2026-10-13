import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {bindingEditLabel,historyTitle,historyToast,researchMaterialLabel} from '../build/undoLabels.js';
import {DocumentStore} from '../build/store.js';
import {fieldStudies} from '../build/model.js';

// E15b: labelled undo wiring. The label helpers and the one store are tested
// directly. app.ts is a DOM entry that cannot load under node, so its wiring is
// read from source: every edit that reaches the one history names itself.
const require=createRequire(import.meta.url);
const ts=require('../../node_modules/typescript');
const appSource=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');

test('a parameter edit is named by the parameter it sets', ()=>{
 assert.equal(bindingEditLabel('Frequency'),'Set frequency');
 assert.equal(bindingEditLabel('RGB'),'Set RGB');
 assert.equal(bindingEditLabel(' Glyph '),'Set glyph');
 assert.equal(bindingEditLabel(undefined),'Set value');
 assert.equal(bindingEditLabel(''),'Set value');
});

test('a research material action is named by the card, view or frame it changes', ()=>{
 assert.equal(researchMaterialLabel({type:'resize'}),'Resize card');
 assert.equal(researchMaterialLabel({type:'frame-remove'}),'Remove frame');
 assert.equal(researchMaterialLabel({type:'view-save'}),'Save view');
});

test('the Undo and Redo toast names the edit it reversed in the app voice', ()=>{
 assert.equal(historyToast('undo','Trim scene 3'),'Undone: Trim scene 3.');
 assert.equal(historyToast('redo','Reorder scenes'),'Redone: Reorder scenes.');
 assert.equal(historyToast('undo',null),'Nothing to undo.');
 assert.equal(historyToast('redo',null),'Nothing to redo.');
});

test('the Undo and Redo control names its step, and falls back to its verb', ()=>{
 assert.equal(historyTitle('undo','Move object'),'Undo Move object');
 assert.equal(historyTitle('redo','Rename scene'),'Redo Rename scene');
 assert.equal(historyTitle('undo',null),'Undo');
 assert.equal(historyTitle('redo',null),'Redo');
});

test('the history reports the label of the step it would undo and redo', ()=>{
 const store=new DocumentStore(fieldStudies());
 assert.equal(store.undoLabel(),null);
 store.change('Trim scene 3',d=>{d.scenes[0].duration+=1;});
 store.change('Rename expression',d=>{d.name=`${d.name} (renamed)`;});
 assert.equal(store.undoLabel(),'Rename expression');
 assert.equal(store.undo(),true);
 assert.equal(store.undoLabel(),'Trim scene 3');
 assert.equal(store.redoLabel(),'Rename expression');
 assert.equal(store.redo(),true);
 assert.equal(store.undoLabel(),'Rename expression');
 assert.equal(store.redoLabel(),null);
});

test('a gesture takes its label from its first begin, and one gesture is one step', ()=>{
 const store=new DocumentStore(fieldStudies());
 store.begin('Move object');
 store.begin('Set value');
 store.document.scenes[0].duration+=2;
 store.touch();
 store.finish();
 assert.equal(store.undoStack.length,1);
 assert.equal(store.undoLabel(),'Move object');
});

test('a failed labelled edit leaves no step and no label behind', ()=>{
 const store=new DocumentStore(fieldStudies());
 assert.throws(()=>store.change('Trim scene 3',()=>{throw new Error('refused');}),/refused/);
 assert.equal(store.undoStack.length,0);
 assert.equal(store.undoLabel(),null);
});

// The law a gate can check: every edit that reaches the one history names itself.
const literalText=node=>(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateExpression(node))?node.getText():null;
const sf=ts.createSourceFile('app.ts',appSource,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
const calls={changed:[],storeChange:[],storeBegin:[],storeReplace:[]};
(function visit(node){
 if(ts.isCallExpression(node)){
  const callee=node.expression;
  if(ts.isIdentifier(callee)&&callee.text==='changed')calls.changed.push(node);
  if(ts.isPropertyAccessExpression(callee)&&ts.isIdentifier(callee.expression)&&callee.expression.text==='store'){
   const name=callee.name.text;
   if(name==='change')calls.storeChange.push(node);
   if(name==='begin')calls.storeBegin.push(node);
   if(name==='replace')calls.storeReplace.push(node);
  }
 }
 ts.forEachChild(node,visit);
})(sf);

test('every changed() edit passes its render flag and its label', ()=>{
 assert.ok(calls.changed.length>=90,`found ${calls.changed.length} changed() edits`);
 for(const call of calls.changed){
  const at=sf.getLineAndCharacterOfPosition(call.getStart(sf)).line+1;
  assert.equal(call.arguments.length,3,`changed() at app.ts:${at} must pass render and label`);
  assert.ok(literalText(call.arguments[2])||ts.isIdentifier(call.arguments[2])||ts.isCallExpression(call.arguments[2]),`changed() at app.ts:${at} has no label`);
 }
});

test('every store.change and store.begin names its gesture, and nothing replaces the document unlabelled', ()=>{
 assert.equal(calls.storeReplace.length,0,'store.replace() records a step named "Replace document"');
 for(const call of calls.storeChange){
  const at=sf.getLineAndCharacterOfPosition(call.getStart(sf)).line+1;
  assert.equal(call.arguments.length,2,`store.change at app.ts:${at} needs a label`);
  assert.ok(literalText(call.arguments[0])||ts.isIdentifier(call.arguments[0]),`store.change at app.ts:${at} needs a label`);
 }
 for(const call of calls.storeBegin){
  const at=sf.getLineAndCharacterOfPosition(call.getStart(sf)).line+1;
  assert.equal(call.arguments.length,1,`store.begin at app.ts:${at} needs a gesture label`);
 }
});

test('no edit in app.ts falls back to the store default label', ()=>{
 const literals=[];
 (function visit(node){if(ts.isStringLiteral(node))literals.push(node.text);ts.forEachChild(node,visit);})(sf);
 assert.equal(literals.includes('Edit'),false);
});

// E15d: a host commit, a flush and a research commit are Saves, and a Save is one recorded checkpoint.
test('every native commit in app.ts is a recorded Save, not a bare commit', ()=>{
 const bare=[];
 (function visit(node){if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='commit'&&node.expression.expression.getText(sf).includes('nativeWorkspace'))bare.push(node);ts.forEachChild(node,visit);})(sf);
 assert.equal(bare.length,0,`an unrecorded nativeWorkspace.commit() remains at app.ts:${bare.map(n=>sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1).join(',')}`);
 const helper=[];
 (function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='commitNativeRecorded')helper.push(node);ts.forEachChild(node,visit);})(sf);
 assert.equal(helper.length,1);
 const body=helper[0].getText(sf);
 for(const part of ['kernelSaveAnchor','commitRecorded','attachKernelCheckpoint'])assert.ok(body.includes(part),`commitNativeRecorded does not ${part}`);
 const uses=[];
 (function visit(node){if(ts.isIdentifier(node)&&node.text==='commitNativeRecorded'&&node.parent!==helper[0]&&!(ts.isFunctionDeclaration(node.parent)))uses.push(node);ts.forEachChild(node,visit);})(sf);
 assert.ok(uses.length>=3,`commitNativeRecorded is used ${uses.length} times; the host commit, flush and research commit must all use it`);
});

// E15d: a host editor change names its step, and the app passes that label through to the history.
test('every host editor change names its step, and the app passes the label through', ()=>{
 const hostSource=fs.readFileSync(new URL('../src/hostEditor.ts',import.meta.url),'utf8');
 assert.match(hostSource,/change\(label: string, mutate: \(\) => void\): void;/);
 const hs=ts.createSourceFile('hostEditor.ts',hostSource,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
 const changes=[];
 (function visit(node){if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='change'&&node.expression.expression.getText(hs)==='options')changes.push(node);ts.forEachChild(node,visit);})(hs);
 assert.equal(changes.length,2);
 for(const call of changes){
  const at=hs.getLineAndCharacterOfPosition(call.getStart(hs)).line+1;
  assert.ok(literalText(call.arguments[0]),`options.change at hostEditor.ts:${at} has no label`);
 }
 assert.match(appSource,/change:\(label,mutate\)=>changed\(mutate,true,label\)/);
});
