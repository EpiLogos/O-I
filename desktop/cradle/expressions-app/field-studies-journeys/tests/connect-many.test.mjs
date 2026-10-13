import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

// B2 / Import .canvas: connections are written as ONE native edit. app.ts is a DOM entry that
// cannot load under node, so the act and the importer are read from source (typescript AST),
// as app-wiring does. The gates below pin the properties the brief requires: a single owner
// edit, refusal before any write that names the missing end, refs returned in input order,
// and the importer going through connectMany rather than one connect per edge.
const require=createRequire(import.meta.url);
const ts=require('../../node_modules/typescript');
const appSource=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const researchSource=fs.readFileSync(new URL('../src/researchInstruments.tsx',import.meta.url),'utf8');
const sf=ts.createSourceFile('app.ts',appSource,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
const rf=ts.createSourceFile('researchInstruments.tsx',researchSource,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TSX);
const walk=(node,visit)=>{visit(node);ts.forEachChild(node,child=>walk(child,visit));};
const calleeName=call=>ts.isPropertyAccessExpression(call.expression)?call.expression.name.text:ts.isIdentifier(call.expression)?call.expression.text:null;
const propertyNamed=(file,name)=>{let found=null;walk(file,n=>{if(!found&&ts.isPropertyAssignment(n)&&n.name.getText(file)===name)found=n;});return found;};
const functionNamed=(file,name)=>{let found=null;walk(file,n=>{if(!found&&ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n;});return found;};
const callsWithin=(node,name)=>{const found=[];walk(node,n=>{if(ts.isCallExpression(n)&&calleeName(n)===name)found.push(n);});return found;};
const inLoop=(node,boundary)=>{for(let p=node.parent;p&&p!==boundary;p=p.parent)if(ts.isForStatement(p)||ts.isForOfStatement(p)||ts.isForInStatement(p)||ts.isWhileStatement(p)||(ts.isCallExpression(p)&&['forEach','map','reduce','some','every','flatMap'].includes(calleeName(p))))return true;return false;};
const connectMany=propertyNamed(sf,'connectMany');

test('the research host exposes connectMany as one act beside connect', ()=>{
 assert.ok(connectMany,'app.ts defines connectMany on the research host');
 assert.ok(ts.isArrowFunction(connectMany.initializer)||ts.isFunctionExpression(connectMany.initializer),'connectMany is a function');
 assert.ok(propertyNamed(sf,'connect'),'the single connect act remains for the one-connection gesture');
 assert.match(researchSource,/connectMany\?:\(sceneId:string,inputs:/,'the host type declares connectMany');
});

test('connectMany writes every relation with exactly one native edit, never one per connection', ()=>{
 const edits=callsWithin(connectMany.initializer,'edit');
 assert.equal(edits.length,1,'one nativeWorkspace.edit call');
 assert.equal(inLoop(edits[0],connectMany.initializer),false,'the edit is not inside a loop or per-item callback');
 assert.match(edits[0].getText(sf),/nativeWorkspace(!|\?)?\.edit\(changes,/,'the edit carries the whole change list, named as one act');
});

test('connectMany refuses before any write and names the end that has no native occurrence', ()=>{
 const body=connectMany.initializer.body.getText(sf);
 const firstThrow=body.search(/\bthrow new Error\(/);
 const edit=body.search(/nativeWorkspace(!|\?)?\.edit\(/);
 assert.ok(firstThrow>=0&&edit>firstThrow,'every refusal is thrown before the edit');
 assert.match(body,/no native occurrence in this Scene\. Nothing was connected/,'the refusal names the missing end and says nothing was connected');
 assert.match(body,/inputs\.forEach|for\s*\(const \[?index|inputs\.some|inputs\.map/,'every input is checked, not only the first');
});

test('connectMany returns the minted binding refs in input order', ()=>{
 const body=connectMany.initializer.body.getText(sf);
 assert.match(body,/const refs=inputs\.map\(/,'refs are minted per input in order');
 assert.match(body,/return refs;/,'the refs are returned as minted');
});

// E15/E16: the sides are part of the act's one edit (its third argument): saved with the relations and
// recorded as the same undo step. No separate labelled change or separate save follows the relations.
test('connector sides ride the same act: applied inside the one edit, saved with the relations, no separate change', ()=>{
 const body=connectMany.initializer.body;
 const edit=callsWithin(body,'edit')[0];
 assert.equal(edit.arguments.length,3,'the edit takes its act label and the sides');
 assert.ok(callsWithin(edit.arguments[2],'applyConnectorRecord').length>=1,'the sides are written through applyConnectorRecord inside the act');
 assert.equal(callsWithin(body,'changed').length,0,'no separate labelled change: the sides are not a second undo step');
 assert.equal(callsWithin(body,'commitResearch').length,0,'no separate save follows the relations');
});

test('the Import .canvas wiring makes one connectMany call and no per-edge connect', ()=>{
 const importer=functionNamed(rf,'importCanvasFile')??null;
 const importerText=researchSource.slice(researchSource.indexOf('const importCanvasFile'),researchSource.indexOf('// B3 — the selection'));
 assert.ok(importerText.length>200,'the importer is found');
 assert.match(importerText,/host\.connectMany/,'the importer connects through connectMany');
 assert.doesNotMatch(importerText,/\bconnect\(sceneId/,'no per-edge connect call remains in the importer');
 assert.doesNotMatch(importerText,/\bconnector\(sceneId/,'no per-edge connector call remains in the importer');
 assert.equal((importerText.match(/host\.connectMany/g)??[]).length,1,'one connectMany call');
 assert.equal(importer,null,'importCanvasFile is a local closure, not a top-level function');
});

test('the importer refuses every connection when any end lacks a native occurrence', ()=>{
 const importerText=researchSource.slice(researchSource.indexOf('const importCanvasFile'),researchSource.indexOf('// B3 — the selection'));
 assert.match(importerText,/missing\s*=|\.some\(|\.filter\(/,'the ends are checked before the act');
 assert.match(importerText,/an end has no native occurrence/,'the refusal names the missing end');
});

test('B2: a drag-made connection takes the same one-write path as an import, and refuses as the single connect act does', () => {
 const drag=researchSource.slice(researchSource.indexOf('onConnectNodes='),researchSource.indexOf('onReconnectEdge='));
 assert.match(drag,/host\.connectMany\(sceneId,\[/, 'the drag connects through connectMany when the host offers it');
 assert.ok(drag.indexOf('host.connectMany')<drag.indexOf('host.connect!('), 'the per-call connect is only the fallback');
 const many=appSource.slice(appSource.indexOf('connectMany:async'),appSource.indexOf('connectMany:async')+1200);
 assert.match(many,/if\(!input\.label\?\.trim\(\)\)\{assertConnectionMembers\(/, 'an unlabelled (drag) input refuses through assertConnectionMembers');
});
