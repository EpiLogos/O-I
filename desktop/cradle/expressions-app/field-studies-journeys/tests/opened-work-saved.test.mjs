// Lane D (PATH §7, 16 Oct): an opened, untouched native work is saved; a switch back to it after its owner moved reads the owner's
// current basis; and the frame answers the host's open, so its refusal reaches the shell's ask.
//
// Seen natively by the lead (m4 build, 16 Oct 00:39) and headless on the real ground (lane D's stack, scripted door trace): Technē's
// door asked Scene "O I" in the central register's Expression; the frame toasted "revision_conflict: the native Expression changed;
// inspect its current basis before trying again", the row stayed "asking for O I…", and after 30 s the pane said the frame "gave the
// shell no reason". The Studio read "edited since save" over a work the frame's own scene bar called Saved. Measured (a frame probe of
// prepareCompositionEdit over the open work): the only change the frame held for a work it had just opened was `composition_set`
// carrying the shared settings the frame gives every work it loads (app.ts initialiseBelts → initialiseShared) — absent from the
// native basis when the owner holds none. That false edit was kept in the work's draft (basis edited: true); when the owner's
// revision moved (the door's focus edit), the reopen saw "local edits" and refused instead of reading the owner's current document.
//
// Channels: SCRIPTED over the real modules (the build's kernelDocumentBridge, kernelComposition, nativeWorking, draftStorage,
// recovery, sharedSettings, sourceState, sceneWorkflow) with a fake owner port; SOURCE TEXT for app.ts (the load's initialisation,
// and the open's answer to the host), which is one bundle not importable alone. The window on screen: UNVERIFIED (the lead's native
// pass).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {kernelDocumentToJourney} from '../build/kernelDocumentBridge.js';
import {prepareCompositionEdit} from '../build/kernelComposition.js';
import {NativeWorking} from '../build/nativeWorking.js';
import {initialiseShared} from '../build/sharedSettings.js';
import {initialiseSources} from '../build/sourceState.js';
import {initialiseSceneSaves} from '../build/sceneWorkflow.js';
import {draftBasis,recoveryOffer,supersededDraft} from '../build/draftStorage.js';
import {acceptWorkingRecoveryBasis,checkpointReading} from '../build/recovery.js';
import {clone} from '../build/model.js';

const E='expression:techne-m0.central.dd19f55a16862f362d32617854728b2a';
const S1=E+':scene:o-i',S2=E+':scene:overview';
/** A wiki register's native Expression as the owner holds it: two Scenes, generated members, and no presentation (no shared settings). */
function wikiDocument(revision=3){
 const entities=Object.fromEntries(['o-i','central'].map(name=>{const ref=`${E}:entity:${name}`;return [ref,{entity_ref:ref,title:name,subject:{subject_ref:`central:wiki:project:${name}`,native_owner:'ai-kit'},parameters:{glyph:{value:name[0].toUpperCase()}}}];}));
 const refs=Object.keys(entities);
 return {schema:'oi.expression/v1',expression_ref:E,revision,title:'Central — wiki local whole',entities,
  scenes:[{scene_ref:S1,title:'O I',revision:1,entity_refs:[refs[0]]},{scene_ref:S2,title:'Central — wiki overview',revision:1,entity_refs:refs}],
  relations:{},selection:{scene_ref:S1,entity_ref:null},provenance:[],profiles:[],refinements:[],representations:[],collections:[]};
}
/** The work the frame holds once it has loaded a view: app.ts applyJourney → initialiseSceneSaves(initialiseBelts(view.journey)),
 * initialiseBelts being initialiseShared, initialiseSources and a toolbelt for a Scene that has none (every converted Scene has one). */
function loaded(view){
 const journey=clone(view.journey);
 initialiseShared(journey);initialiseSources(journey);
 for(const scene of journey.scenes)assert.ok(scene.toolbelt,'a converted Scene carries its toolbelt, so initialiseBelts leaves it');
 return initialiseSceneSaves(journey);
}
const owner=(expression)=>new NativeWorking({expression,file:async()=>{throw new Error('no file operation');},checkpoint:async()=>{},mint:()=>'expression:unused'});

test('source: the frame loads every work through initialiseBelts — shared settings and the source migration — as this test mirrors', async()=>{
 const app=await readFile(new URL('../src/app.ts',import.meta.url),'utf8');
 assert.match(app,/function initialiseBelts\(j:Journey\)\{initialiseShared\(j\);initialiseSources\(j\);for\(const s of \[\.\.\.j\.scenes,\.\.\.Object\.values\(j\.savedScenes\?\?\{\}\)\]\)if\(!s\.toolbelt\)/);
 assert.match(app,/store\.acknowledge\(initialiseSceneSaves\(initialiseBelts\(j\)\),acknowledgement\);else store\.change\('Open expression',\(\)=>\{store\.document=clone\(initialiseSceneSaves\(initialiseBelts\(j\)\)\);\}\)/);
});

test('an opened, untouched work holds no edit: the Studio reads saved, and the draft kept on leaving is not edited', ()=>{
 const view=kernelDocumentToJourney(wikiDocument());
 const work=loaded(view);
 assert.deepEqual(prepareCompositionEdit(view,work).changes,[],'no composition change — before lane D: [composition_set] with the frame\'s own shared settings');
 assert.equal(draftBasis(work,{revision:view.document.revision,journey:view.journey}).edited,false,'before lane D: edited, so an unclean exit offered it for recovery');
 const offer=recoveryOffer({draft:work,saved:view.journey,uncleanExit:true,checkpoint:{revision:view.document.revision,basis:draftBasis(work,{revision:3,journey:view.journey})}});
 assert.equal(offer.offer,false,'nothing to recover');
 assert.equal(supersededDraft({draft:work,saved:view.journey,checkpoint:{revision:3,basis:{schema:'oi.draft-basis/v1',revision:3,edited:false}}}),false,'and nothing to set aside');
});

test('a real edit is still an edit, and carries the frame\'s shared settings with it so the owner\'s document holds them', ()=>{
 const view=kernelDocumentToJourney(wikiDocument());
 const shared=clone(loaded(view));shared.shared.values['field.params.timeScale']=0.5;
 const changes=prepareCompositionEdit(view,shared).changes;
 assert.deepEqual(changes.map(change=>change.change),['composition_set']);
 assert.equal(changes[0].presentation.shared.values['field.params.timeScale'],0.5);
 const renamed=clone(loaded(view));renamed.name='Renamed here';
 assert.deepEqual(prepareCompositionEdit(view,renamed).changes.map(change=>change.change),['rename','composition_set'],'the defaults travel with the first real change');
 assert.equal(draftBasis(renamed,{revision:3,journey:view.journey}).edited,true);
});

test('the owner\'s own shared settings are read as the owner holds them', ()=>{
 const document=wikiDocument();
 const own=initialiseShared(clone(kernelDocumentToJourney(wikiDocument()).journey)).shared;
 own.values['field.params.timeScale']=2;
 document.presentation={schema:'oi.journey-properties/v1',description:'',loop:true,shared:own};
 const view=kernelDocumentToJourney(document);
 assert.equal(view.journey.shared.values['field.params.timeScale'],2);
 assert.deepEqual(prepareCompositionEdit(view,loaded(view)).changes,[]);
 const reverted=clone(loaded(view));reverted.shared.values['field.params.timeScale']=1;
 assert.deepEqual(prepareCompositionEdit(view,reverted).changes.map(change=>change.change),['composition_set'],'a change to the owner\'s own settings is an edit');
});

test('a switch back to an untouched work after its owner moved reads the owner\'s current basis — no revision conflict', async()=>{
 // The checkpoint and draft a frame kept when it left the work at revision 3; the door's focus edit has since moved the owner to 4.
 const before=kernelDocumentToJourney(wikiDocument(3));
 const draft=loaded(before);
 const record={schema:'oi.native-working/v1',draft_id:draft.id,view:before};
 const calls=[],checkpoints=[];
 const work=new NativeWorking({
  expression:async request=>{calls.push(request.operation);
   if(request.operation==='open')return {state:'revision_conflict',expression_ref:E,expected_revision:3,current_revision:4};
   if(request.operation==='inspect')return {state:'ready',document:wikiDocument(4)};
   throw new Error('unexpected owner operation '+request.operation);},
  file:async()=>{throw new Error('no file operation');},
  checkpoint:async(id,value)=>{checkpoints.push([id,value.view.document.revision]);},
  mint:()=>'expression:unused'});
 const view=await work.reopenCheckpoint(record,draft);
 assert.equal(view.document.revision,4,'the owner\'s current revision — before lane D: "revision_conflict: the native Expression changed; inspect its current basis before trying again"');
 assert.deepEqual(calls,['open','inspect'],'the stale document is offered once; the owner refuses it, and its current document is read — never written over');
 assert.deepEqual(checkpoints,[[draft.id,4]],'the working checkpoint moves to the owner\'s basis');
});

test('a work with real local edits still refuses a moved owner: the edits are kept, never rebased', async()=>{
 const before=kernelDocumentToJourney(wikiDocument(3));
 const draft=loaded(before);draft.name='Renamed here';
 const work=owner(async request=>request.operation==='open'?{state:'revision_conflict',expression_ref:E,current_revision:4}:{state:'ready',document:wikiDocument(4)});
 await assert.rejects(work.reopenCheckpoint({schema:'oi.native-working/v1',draft_id:draft.id,view:before},draft),/revision_conflict/);
});

test('the saved copy a set-aside draft opens on is the same work as its checkpoint — never "differs from its actual owner reading"', async()=>{
 const stored=kernelDocumentToJourney(wikiDocument(3));
 const raw={schema:'oi.native-working/v1',draft_id:stored.journey.id,view:stored};
 await new Promise(resolve=>setTimeout(resolve,5)); // a later read re-converts the view at a later time
 const {record}=checkpointReading(raw,null);
 // The superseded path: the draft is set aside and the saved copy (the record's view) opens on the checkpoint record alone.
 const recovered={record,journey:record.view.journey,recoveryRecords:[{kind:'checkpoint',scope:'expressions',id:E,revision:1,value:raw}]};
 assert.throws(()=>acceptWorkingRecoveryBasis(recovered,()=>true),error=>!/differs from its actual owner reading/.test(error.message)&&/exact native recovery record that was read/.test(error.message),
  'the material check passes, and the receiving act goes on to its read receipts — before lane D every re-conversion stamped its own time, and the saved copy "differed"');
});

test('source: the frame answers the host\'s open — ok once it stands on the work, or refused in its status line\'s words', async()=>{
 const app=await readFile(new URL('../src/app.ts',import.meta.url),'utf8');
 assert.match(app,/d\.command==='open-expression'&&typeof d\.ref==='string'\)answerHostOpen\(d\.req,\(d as \{refresh\?:unknown\}\)\.refresh===true&&kernelExpressionsAvailable\(\)\?refreshHostExpression\(d\.ref,d\.recovery\):openHostExpression\(d\.ref,d\.recovery\)\)/);
 assert.match(app,/d\.command==='refresh-expression'&&typeof d\.ref==='string'\)answerHostOpen\(d\.req,refreshHostExpression\(d\.ref,d\.recovery\)\)/);
 assert.match(app,/window\.parent\.postMessage\(stageReplyMessage\(Number\(req\),ok\?\{ok:true\}:\{ok:false,error:reason\}\),'\*'\)/,'the answer is a stage reply by the open\'s req');
 assert.match(app,/const reason=typeof outcome==='string'\?outcome:nativeState\?\.text\|\|/,'in the words the native status line holds (or a superseded open\'s own)');
});
