import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {blankJourney,blankScene,clone,validateJourney} from '../build/model.js';
import {supersededDraft,recoveryDiff,recoveryDiffLines,settleHostedDraft,mergeTakeIntoDraft,basisSuperseded,draftValue,splitDraftValue,quarantineNotice} from '../build/draftStorage.js';
import {draftStatusLine} from '../build/draftSchedule.js';
import {recoveryOffer,planRecoveryChoice,draftCopy,readUncleanExit,markSessionOpen,markSessionClosed,offerClock,SESSION_MARK_KEY,TAB_INSTANCE_KEY,tabInstance,recordBootExit,bootWasUnclean,writeRecord,loadRecord,removeRecord,listQuarantine,quarantine,quarantinedCopy,quarantinedName,encodeSlot} from '../build/draftStorage.js';

// lane-3 E19: after an unclean exit, the draft and the last saved copy are both kept and the owner chooses.
const T0='2026-10-13T09:00:00.000Z',T1='2026-10-13T09:05:00.000Z',T2='2026-10-13T09:07:30.000Z';
function expression(id,name,updatedAt,scenes=1){
 const j=blankJourney();j.id=id;j.name=name;j.updatedAt=updatedAt;
 for(let i=1;i<scenes;i++)j.scenes.push(blankScene());
 return validateJourney(j);
}
const material=j=>{const c=clone(j);delete c.updatedAt;return JSON.stringify(c);};
function sessionStore(){const map=new Map();return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>{map.set(k,v);}};}

test('a clean exit offers nothing, even when the draft has edits the saved copy lacks', ()=>{
 const saved=expression('e1','Saved',T0),draft=expression('e1','Saved',T1,2);
 const offer=recoveryOffer({draft,saved,uncleanExit:false});
 assert.equal(offer.offer,false);
 assert.match(offer.reason,/closed cleanly/);
});

test('an unclean exit with a newer, different draft offers the choice, naming both timestamps', ()=>{
 const saved=expression('e1','Saved',T0),draft=expression('e1','Saved',T1,2);
 const offer=recoveryOffer({draft,saved,uncleanExit:true});
 assert.equal(offer.offer,true);
 assert.equal(offer.draftId,'e1');assert.equal(offer.draftAt,T1);assert.equal(offer.savedAt,T0);
});

test('no offer when the draft matches the saved copy, ignoring only the top timestamp', ()=>{
 const saved=expression('e1','Saved',T0),draft=clone(saved);draft.updatedAt=T1;
 assert.equal(recoveryOffer({draft,saved,uncleanExit:true}).offer,false);
 assert.match(recoveryOffer({draft,saved,uncleanExit:true}).reason,/matches/);
});

test('no offer when the saved copy is newer, or the two are different expressions, or one side is missing', ()=>{
 const saved=expression('e1','Saved',T2),draft=expression('e1','Draft',T1,2);
 assert.match(recoveryOffer({draft,saved,uncleanExit:true}).reason,/saved copy is newer/);
 assert.match(recoveryOffer({draft:expression('e2','Other',T1,2),saved,uncleanExit:true}).reason,/different expressions/);
 assert.match(recoveryOffer({draft,uncleanExit:true}).reason,/no draft and saved copy/);
});

// T-REVIEW-6 (2): restoring the draft used to keep nothing of the saved side, so the next autosave replaced the saved copy.
// The saved copy is now preserved as its own named Library copy before the draft becomes the working copy.
test('restore draft keeps the saved copy as its own named Library copy first, then opens the draft and removes nothing', ()=>{
 const saved=expression('e1','Saved',T0),draft=expression('e1','Saved',T1,2);
 const plan=planRecoveryChoice('restore-draft',draft,saved,new Date(2026,9,13,9,8));
 assert.equal(material(plan.open),material(draft));
 assert.equal(plan.removeDraft,false);assert.equal(plan.quarantineDraft,false);
 assert.ok(plan.copy,'the saved copy is preserved before the draft becomes the working copy');
 assert.notEqual(plan.copy.id,'e1','a new identity, so later autosaves of the draft cannot replace it');
 const body=j=>{const c=clone(j);delete c.id;delete c.name;delete c.updatedAt;return JSON.stringify(c);};
 assert.equal(body(plan.copy),body(saved),'the saved material is kept exactly');
 assert.match(plan.copy.name,/^Saved · saved before recovery 09:08$/);
});

test('keep saved opens the saved copy and sends the draft to quarantine, not to deletion', ()=>{
 const saved=expression('e1','Saved',T0),draft=expression('e1','Saved',T1,2);
 const plan=planRecoveryChoice('keep-saved',draft,saved,new Date());
 assert.equal(material(plan.open),material(saved));
 assert.equal(plan.quarantineDraft,true,'the draft is kept in quarantine first');
 assert.equal(plan.removeDraft,true);
});

test('keep both opens the saved copy and adds the draft as a Library copy with a new identity', ()=>{
 const saved=expression('e1','Saved',T0),draft=expression('e1','Saved',T1,2);
 const at=new Date(2026,9,13,9,8);
 const plan=planRecoveryChoice('keep-both',draft,saved,at);
 assert.equal(material(plan.open),material(saved));
 assert.ok(plan.copy,'a copy is produced');
 assert.notEqual(plan.copy.id,'e1');
 assert.equal(plan.copy.scenes.length,2,'the copy holds the draft material');
 assert.match(plan.copy.name,/^Saved · recovered draft 09:08$/);
 assert.equal(plan.removeDraft,true);
});

test('a long name is cut so the copy still names its origin within the 160-character limit', ()=>{
 const draft=expression('e1','x'.repeat(160),T1,2);
 const copy=draftCopy(draft,new Date(2026,9,13,9,8));
 assert.ok(copy.name.length<=160);assert.match(copy.name,/recovered draft 09:08$/);
});

test('the session mark: absent is clean, open is unclean, closed is clean, and an unreadable mark counts as unclean', ()=>{
 const s=sessionStore();
 assert.equal(readUncleanExit(s),false,'first run is clean');
 markSessionOpen(s,new Date());
 assert.equal(readUncleanExit(s),true,'a page that opened and never closed');
 markSessionClosed(s,new Date());
 assert.equal(readUncleanExit(s),false,'a page that quit cleanly');
 s.setItem(SESSION_MARK_KEY+'.shared','{broken');
 assert.equal(readUncleanExit(s),true,'an unreadable mark cannot prove a clean exit');
});

test('offer clock names hh:mm:ss today and the date otherwise', ()=>{
 const now=new Date(2026,9,13,12,0,0);
 assert.equal(offerClock(new Date(2026,9,13,9,5,7).toISOString(),now),'09:05:07');
 assert.equal(offerClock(new Date(2026,9,12,9,5,7).toISOString(),now),'2026-10-12 09:05:07');
 assert.equal(offerClock('not a time',now),'unknown time');
});

// End to end over in-memory stores: a session writes drafts and the saved copy, the page dies
// before its quit flush, the next boot offers the choice, and every choice keeps both sides.
function library(){const rows=[];return {rows,save(j){const i=rows.findIndex(r=>r.id===j.id);if(i>=0)rows[i]=clone(j);else rows.push(clone(j));},find(id){return rows.find(r=>r.id===id);}};}
for(const choice of ['restore-draft','keep-saved','keep-both']){
 test(`after a crash, choosing ${choice} keeps the saved copy and the draft`, async()=>{
  const session=sessionStore(),lib=library(),draftsStore=new Map(),quarantineStore=new Map();
  const draftLayout={store:{get:async k=>draftsStore.get(k),put:async(k,v)=>{draftsStore.set(k,v);},delete:async k=>{draftsStore.delete(k);},keys:async p=>[...draftsStore.keys()].filter(k=>k.startsWith(p))},quarantine:{get:async k=>quarantineStore.get(k),put:async(k,v)=>{quarantineStore.set(k,v);},delete:async k=>{quarantineStore.delete(k);},keys:async p=>[...quarantineStore.keys()].filter(k=>k.startsWith(p))},prefix:'',paired:true,source:'draft'};
  // Session one: the saved copy, then a later draft with edits, then a crash (no quit flush).
  const saved=expression('e1','Saved',T0),draft=expression('e1','Saved',T1,2);
  lib.save(saved);markSessionOpen(session,new Date(2026,9,13,9,0));
  await writeRecord(draftLayout,draft.id,JSON.stringify(draft),new Date());
  // Session two: boot.
  assert.equal(readUncleanExit(session),true);
  const storedDraft=(await loadRecord(draftLayout,'e1',validateJourney,new Date())).value;
  const offer=recoveryOffer({draft:storedDraft,saved:lib.find('e1'),uncleanExit:true});
  assert.equal(offer.offer,true);
  const plan=planRecoveryChoice(choice,storedDraft,lib.find('e1'),new Date(2026,9,13,9,8));
  // Carry out the plan the way applyRecoveryPlan does: copy saved first, then quarantine, then remove.
  if(plan.copy)lib.save(plan.copy);
  if(plan.quarantineDraft)await quarantine(draftLayout.quarantine,'draft','e1',JSON.stringify(storedDraft),'Superseded by the saved copy',new Date());
  if(plan.removeDraft)await removeRecord(draftLayout,'e1',new Date());
  // Nothing is lost: the saved copy is never overwritten, and the draft survives exactly as its choice promises.
  assert.equal(material(lib.find('e1')),material(saved),'the saved copy is never overwritten');
  const draftRaw=JSON.stringify(storedDraft);
  const quarantined=(await listQuarantine(draftLayout.quarantine)).records.map(r=>r.raw);
  const stillInDrafts=(await loadRecord(draftLayout,'e1',validateJourney,new Date())).value!==undefined;
  if(choice==='restore-draft')assert.equal(stillInDrafts,true,'restore keeps the draft as the working copy');
  if(choice==='keep-saved'){assert.ok(quarantined.includes(draftRaw),'keep saved keeps the draft verbatim in quarantine');assert.equal(stillInDrafts,false);}
  if(choice==='keep-both'){
   const copy=lib.rows.find(r=>r.id!=='e1');
   assert.ok(copy,'keep both adds the draft as a Library copy');
   assert.equal(copy.scenes.length,storedDraft.scenes.length,'the copy holds the draft scenes');
   assert.equal(stillInDrafts,false,'the copy now holds the draft, so the draft row is cleared');
  }
  // The page then opens the plan's document.
  assert.equal(material(plan.open),choice==='restore-draft'?material(storedDraft):material(saved));
  // A clean quit after the choice leaves no prompt on the next boot.
  markSessionClosed(session,new Date());
  assert.equal(readUncleanExit(session),false);
 });
}

test('the boot path is wired to the choice and the session mark, and offers nothing silently', ()=>{
 const source=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 assert.ok(source.includes('recoveryOffer({draft,saved,uncleanExit})'),'the offer is decided from the draft and saved copy');
 assert.ok(source.includes('await askRecoveryChoice(draft,offer)'),'the owner chooses');
 assert.ok(source.includes('await applyRecoveryPlan(plan,draft)'),'the choice is carried out with its quarantine and copy steps');
 assert.ok(/markSessionClosed\(localStorage/.test(source),'quit marks a clean exit only after the flush settles');
 assert.ok(/pending\(\)===0/.test(source),'the mark waits for pending writes to reach zero');
 assert.ok(/markClean&&draftSchedule\.pending\(\)===0/.test(source),'only pagehide marks the exit clean');
});

// lane-3 E19b: the session mark is per tab. The origin store is shared by every tab; a tab's own id lives in its sessionStorage.
function markStore(){const map=new Map();return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>{map.set(k,v);},removeItem:k=>{map.delete(k);}};}
test('E19b: each tab has its own id, kept across a reload of that tab; a page with no tab store shares one fixed id', ()=>{
 const a=markStore(),b=markStore();
 const idA=tabInstance(a),idB=tabInstance(b);
 assert.notEqual(idA,idB,'two tabs have two ids');
 assert.match(idA,/^[A-Za-z0-9-]{8,64}$/,'the id is a bounded token');
 assert.equal(tabInstance(a),idA,'a reload of the same tab keeps its id');
 assert.equal(a.map.get(TAB_INSTANCE_KEY),idA,'the id is kept in the tab store');
 assert.equal(tabInstance(undefined),'shared','no tab store means the one shared id');
 const denied={getItem:()=>{throw new Error('denied');},setItem:()=>{throw new Error('denied');}};
 assert.equal(tabInstance(denied),'shared','a denied tab store never throws');
});
test('E19b: a second tab never reads the first tab\'s open mark, and a clean exit of one tab leaves the other\'s mark standing', ()=>{
 const origin=markStore(),a=markStore(),b=markStore();
 const idA=tabInstance(a),idB=tabInstance(b);
 markSessionOpen(origin,new Date(),idA);
 assert.equal(readUncleanExit(origin,idB),false,'tab B is not offered tab A\'s draft');
 assert.equal(readUncleanExit(origin,idA),true,'tab A still reads its own open mark');
 markSessionOpen(origin,new Date(),idB);
 markSessionClosed(origin,new Date(),idB);
 assert.equal(readUncleanExit(origin,idA),true,'closing tab B never clears tab A\'s mark');
 assert.equal(readUncleanExit(origin,idB),false,'tab B closed cleanly');
});
test('E19b: a reload of the same tab after a crash is still offered the choice', ()=>{
 const origin=markStore(),a=markStore();
 markSessionOpen(origin,new Date(),tabInstance(a));
 // The page dies with no quit flush; the tab reloads and keeps its id.
 assert.equal(readUncleanExit(origin,tabInstance(a)),true);
});
test('E19b: a clean exit removes the tab mark, so a closed tab leaves nothing behind', ()=>{
 const origin=markStore(),a=markStore(),id=tabInstance(a);
 markSessionOpen(origin,new Date(),id);markSessionClosed(origin,new Date(),id);
 assert.equal(origin.map.size,0,'no mark is left for a closed tab');
 assert.equal(readUncleanExit(origin,id),false);
});
test('E19b: one origin-wide mark from an earlier build is adopted by the first tab to boot only', ()=>{
 const origin=markStore();
 origin.setItem(SESSION_MARK_KEY,JSON.stringify({state:'open',at:new Date().toISOString()}));
 const a=markStore(),b=markStore();
 assert.equal(readUncleanExit(origin,tabInstance(a)),true,'the first tab adopts the earlier unclean mark');
 markSessionOpen(origin,new Date(),tabInstance(a));
 assert.equal(readUncleanExit(origin,tabInstance(b)),false,'a later tab is not offered it once the first tab has retired it');
});
test('E19b: the boot records its own reading of the mark for the hosted open', ()=>{
 recordBootExit(true);assert.equal(bootWasUnclean(),true);
 recordBootExit(false);assert.equal(bootWasUnclean(),false);
});
// The hosted open (E19b-a): after an unclean boot, a draft newer than the checkpoint's acknowledged basis is offered, and each choice keeps both sides.
for(const choice of ['restore-draft','keep-saved','keep-both']){
 test(`E19b-a: after an unclean boot, a hosted draft newer than its checkpoint is offered; choosing ${choice} keeps both sides`, ()=>{
  const saved=expression('e2','Checkpoint basis',T0),draft=expression('e2','Checkpoint basis',T1,2);
  recordBootExit(true);
  const offer=recoveryOffer({draft,saved,uncleanExit:bootWasUnclean()});
  assert.equal(offer.offer,true,'the newer draft is offered, not adopted silently');
  assert.equal(offer.draftAt,T1);assert.equal(offer.savedAt,T0);
  const plan=planRecoveryChoice(choice,draft,saved,new Date(2026,9,13,9,8));
  if(choice==='restore-draft'){
   assert.equal(material(plan.open),material(draft),'restore opens the draft');
   assert.equal(plan.removeDraft,false);assert.equal(plan.quarantineDraft,false);
  }else{
   assert.equal(material(plan.open),material(saved),'the checkpoint basis is opened');
   assert.equal(plan.removeDraft,true,'the native draft leaves only after its copy is kept');
  }
  if(choice==='keep-saved')assert.equal(plan.quarantineDraft,true,'the draft is kept verbatim in quarantine');
  if(choice==='keep-both'){assert.ok(plan.copy,'the draft becomes a Library copy');assert.notEqual(plan.copy.id,draft.id);assert.equal(plan.copy.scenes.length,draft.scenes.length);}
  recordBootExit(false);
 });
}
test('E19b-a: a hosted draft that matches its checkpoint, or a clean boot, is never offered', ()=>{
 const saved=expression('e3','Same',T0),draft=validateJourney({...clone(saved),updatedAt:T1});
 assert.equal(recoveryOffer({draft,saved,uncleanExit:true}).offer,false,'a draft with the same material is not an offer');
 const newer=expression('e3','Changed',T1,2);
 assert.equal(recoveryOffer({draft:newer,saved,uncleanExit:false}).offer,false,'a clean boot offers nothing');
});
test('E19b: the native open settles its recovery through the same plan, before adoption, and the boot takes its mark before the hosted gate', ()=>{
 const nw=fs.readFileSync(new URL('../src/nativeWorkspace.ts',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 assert.equal(nw.match(/await settleRecovery\(found,current\)/g)?.length,2,'follow and open both settle the recovery');
 const settle=nw.slice(nw.indexOf('const settleRecovery='),nw.indexOf('// Following (host open-expression'));
 assert.ok(settle.includes('await settleHostedDraft(draftId,{journey:found.journey,basis:draftRowBasis(row),text:draftRowText(row)},saved,'),'the hosted decision is the one settleHostedDraft owns, ordered by the recorded base');
 assert.ok(!settle.includes('await applyRecoveryPlan(plan,found.journey)'),'nativeWorkspace no longer applies its own plan');
 const hosted=fs.readFileSync(new URL('../src/draftStorage.ts',import.meta.url),'utf8');
 const owner=hosted.slice(hosted.indexOf('export async function settleHostedDraft('),hosted.indexOf('export const SESSION_MARK_KEY'));
 assert.ok(owner.indexOf('await owners.keepDraft(')<owner.indexOf('await owners.markDraftKept('),'the draft is kept before its native row is marked kept');
 assert.ok(!owner.includes('removeNativeDraft')&&!settle.includes('removeDraft('),'the hosted native row is never removed by recovery');
 assert.ok(owner.indexOf('owners.requireAdoption()')<owner.indexOf('await owners.markDraftKept('),'a choice retains everything before it is marked');
 assert.ok(owner.includes('if(supersededDraft({draft,saved,checkpoint}))'),'a draft superseded by its base is decided before any offer');
 assert.ok(app.includes('chooseRecovery:request=>askRecoveryChoice(request.draft,{...request.offer,revision:request.revision})'),'the owner is asked with the kernel revision named');
 assert.ok(app.indexOf('recordBootExit(uncleanExit)')<app.indexOf("if(!window.__JOURNEY__&&!qs.has('journey')&&!qsExpression)"),'a hosted boot records its mark too');
 assert.ok(app.includes('let uncleanExit=false;try{uncleanExit=readUncleanExit(localStorage);markSessionOpen(localStorage,new Date());}catch'),'one reading of the tab mark, before this page marks itself open');
});

// T-REVIEW-6 (3a): a quarantined draft restores as a new Library copy only when it validates now; a refusal names the reason.
test('T-REVIEW-6: a quarantined draft restores as a new Library copy only when it validates; otherwise the refusal names the reason', ()=>{
 const good=expression('e9','Quarantined',T1,2);
 const copy=quarantinedCopy(JSON.stringify(good),new Date(2026,9,13,10,30));
 assert.notEqual(copy.id,'e9');
 assert.match(copy.name,/^Quarantined · restored draft 10:30$/);
 assert.equal(copy.scenes.length,2,'the copy holds the quarantined material');
 assert.equal(quarantinedCopy(encodeSlot(3,JSON.stringify(good)),new Date(2026,9,13,10,31)).scenes.length,2,'a kept slot envelope is unwrapped');
 assert.throws(()=>quarantinedCopy(JSON.stringify({...good,scenes:'nope'}),new Date()),/cannot be restored: .+/);
 assert.throws(()=>quarantinedCopy('not json',new Date()),/cannot be restored/);
 assert.equal(quarantinedName(JSON.stringify(good),'fallback'),'Quarantined','the listing names the draft');
 assert.equal(quarantinedName('not json','fallback'),'fallback','an unreadable draft is listed by its key');
});

// T-REVIEW-6 (1, 4, 5c): the boot holds the draft while the owner decides; quit writes the clean mark before its flush;
// deleting one saved copy cancels the backup only when that copy is the open document. These are wiring pins on app.ts.
test('T-REVIEW-6: the recovery choice holds the draft from the dialog until its plan is kept, and a held draft is never written', ()=>{
 const source=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 const boot=source.slice(source.indexOf('if(draft&&saved&&offer.offer){'),source.indexOf('else if(draft&&(!initial.updatedAt'));
 assert.ok(boot.includes('recoveryOfferOpen=true'),'the draft is held');
 assert.ok(boot.indexOf('recoveryOfferOpen=true')<boot.indexOf('await askRecoveryChoice(draft,offer)'),'held before the dialog opens');
 assert.ok(boot.indexOf('await applyRecoveryPlan(plan,draft)')<boot.indexOf('recoveryOfferOpen=false'),'released only after the plan is kept');
 assert.ok(/!recoveryOfferOpen\)await persistDraft\(previous\)/.test(source),'a departing write cannot replace the held draft');
 assert.ok(/held:\(\)=>recoveryOfferOpen/.test(source),'the schedule reads the hold');
});

test('T-REVIEW-6: quit returns at once while a recovery choice is open, and writes the clean mark before its asynchronous flush', ()=>{
 const source=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('function quitDraft('),source.indexOf("window.addEventListener('pagehide'"));
 const flush=body.indexOf("flushNow('quit')"),sync=body.indexOf('markSessionClosed(localStorage');
 assert.ok(body.indexOf('if(recoveryOfferOpen)return')>=0&&body.indexOf('if(recoveryOfferOpen)return')<flush,'a held draft returns before any write');
 assert.ok(sync>=0&&flush>=0&&sync<flush,'an idle exit is marked in the handler, before an unload can cut the flush short');
});

test('T-REVIEW-6: deleting a saved copy cancels the backup only when that copy is the open document', ()=>{
 const source=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 const line=source.split('\n').find(l=>l.includes("case 'delete-saved':"));
 assert.ok(line,'delete-saved is wired');
 assert.ok(line.includes('if(store.document.id===id)draftSchedule.cancel()'),'cancel only for the open document');
 assert.ok(!/;draftSchedule\.cancel\(\);/.test(line),'no unconditional cancel for another saved copy');
});

// lane-3 E19: a draft at the saved copy's time, or older, is never offered and never adopted silently. Its saved copy is the basis.
test('E19: a draft at the same time as its saved copy is not offered; it is superseded, not adopted', ()=>{
 const saved=expression('e4','Saved',T1),draft=expression('e4','Saved',T1,2);
 const offer=recoveryOffer({draft,saved,uncleanExit:true});
 assert.equal(offer.offer,false);
 assert.match(offer.reason,/not newer/);
 assert.equal(supersededDraft({draft,saved}),true);
});
test('E19: superseded means different and not newer; a newer draft is never superseded, and the same material is nothing to keep', ()=>{
 const saved=expression('e4','Saved',T1);
 assert.equal(supersededDraft({draft:expression('e4','Saved',T0,2),saved}),true,'an older draft is superseded');
 assert.equal(supersededDraft({draft:expression('e4','Saved',T2,2),saved}),false,'a newer draft is offered or adopted, never superseded');
 assert.equal(supersededDraft({draft:clone(saved),saved}),false,'the same material is nothing to keep');
 assert.equal(supersededDraft({saved}),false,'no draft');
 assert.equal(supersededDraft({draft:expression('e5','Other',T0,2),saved}),false,'a different expression');
});
test('E19: the diff names each scene that changed by duration, transition, name and addition', ()=>{
 const saved=expression('e5','Saved',T0,2);
 const draft=clone(saved);draft.updatedAt=T1;
 draft.scenes[0].duration=saved.scenes[0].duration+1;
 draft.scenes[1].transition=saved.scenes[1].transition+0.5;
 draft.scenes[1].name='Renamed scene';
 draft.scenes.push(blankScene());
 const diff=recoveryDiff(validateJourney(draft),saved);
 assert.deepEqual([diff.scenesAdded,diff.scenesRemoved,diff.durations,diff.transitions,diff.renamed,diff.contents,diff.other],[1,0,1,1,1,0,false]);
 assert.deepEqual(recoveryDiffLines(diff),['1 scene added in the draft','Durations changed in 1 scene','Transitions changed in 1 scene','1 scene renamed']);
});
test('E19: a changed scene parameter is named as a content change; a change to the expression alone is named as details', ()=>{
 const saved=expression('e6','Saved',T0,1);
 const moved=clone(saved);moved.updatedAt=T1;moved.scenes[0].field.params.count+=1000;
 const diff=recoveryDiff(validateJourney(moved),saved);
 assert.equal(diff.contents,1);
 assert.deepEqual(recoveryDiffLines(diff),['Scene contents changed in 1 scene']);
 const details=clone(saved);details.updatedAt=T1;details.name='Renamed expression';
 const other=recoveryDiff(validateJourney(details),saved);
 assert.equal(other.other,true);
 assert.deepEqual(recoveryDiffLines(other),['Expression details changed']);
});
test('E19: after an unclean exit, a superseded draft is not offered: the saved copy opens and the draft is kept verbatim in quarantine', async()=>{
 const session=sessionStore(),lib=library(),drafts=new Map(),quarantineStore=new Map();
 const keyStore=map=>({get:async k=>map.get(k),put:async(k,v)=>{map.set(k,v);},delete:async k=>{map.delete(k);},keys:async p=>[...map.keys()].filter(k=>k.startsWith(p))});
 const layout={store:keyStore(drafts),quarantine:keyStore(quarantineStore),prefix:'',paired:false,source:'draft'};
 const saved=expression('e7','Saved',T1),older=expression('e7','Saved',T0,2);
 lib.save(saved);markSessionOpen(session,new Date(2026,9,13,9,0));
 await writeRecord(layout,'e7',JSON.stringify(older),new Date());
 assert.equal(readUncleanExit(session),true);
 const stored=(await loadRecord(layout,'e7',validateJourney,new Date())).value;
 assert.equal(supersededDraft({draft:stored,saved:lib.find('e7')}),true);
 const rawStored=drafts.get('e7');
 await quarantine(layout.quarantine,'draft','e7',rawStored,'Not newer than the saved copy, so the saved copy was opened. The draft is kept here verbatim.',new Date());
 await removeRecord(layout,'e7',new Date());
 assert.equal(material(lib.find('e7')),material(saved),'the saved copy is opened and never replaced');
 assert.equal((await loadRecord(layout,'e7',validateJourney,new Date())).value,undefined,'the live draft is gone');
 const kept=(await listQuarantine(layout.quarantine)).records;
 assert.equal(kept.length,1);assert.equal(kept[0].raw,rawStored,'kept verbatim');
 assert.match(kept[0].reason,/Not newer than the saved copy/);
 markSessionClosed(session,new Date());assert.equal(readUncleanExit(session),false);
});
test('E19: the boot decides a superseded draft before any silent adoption, and the dialog and status name the diff', ()=>{
 const app=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 const superseded=app.indexOf('else if(draft&&saved&&!hostedRecovery()&&supersededDraft({draft,saved}))'),adopt=app.indexOf('else if(draft&&(!initial.updatedAt');
 assert.ok(superseded>0&&adopt>superseded,'the superseded branch comes before the silent adoption');
 assert.ok(app.includes('saved&&!hostedRecovery()&&supersededDraft'),'the browser-only superseded rule never runs against a native draft');
 assert.ok(app.includes("quarantineReason:'Not newer than the saved copy"),'the quarantined draft says why it was kept');
 assert.ok(app.includes('recoveryDiffLines(offer.diff)'),'the choice dialog names what changed');
 assert.match(app,/Restored draft, not yet saved: \$\{recoveryDiffLines\(offer\.diff\)\.join\('; '\)\}/,'a restored draft says it is not yet saved');
});

// lane-3 E19 (hosted, data safety): settleHostedDraft runs with injected owners, so every branch of the native settle is exercised as written.
// A native draft row carries the checkpoint revision it was edited from (its basis). Order is by that base, never by a regenerated time.
const basisOf=(revision,edited,superseded)=>({schema:'oi.draft-basis/v1',revision,edited,...(superseded?{superseded:true}:{})});
const hostedRow=(journey,basis)=>({journey,basis,text:JSON.stringify(basis?{...journey,draftBasis:basis}:journey)});
function hostedOwners(overrides={}){
 const calls=[];
 const {choice='keep-saved',...rest}=overrides;
 const owners={hosted:true,uncleanBoot:true,settled:new Set(),revision:7,
  chooseRecovery:async request=>{calls.push({call:'choose',request});return choice;},
  requireAdoption:()=>{calls.push({call:'adopt'});},
  keepDraft:async(plan,draft,text)=>{calls.push({call:'keep',plan,draft,text});},
  markDraftKept:async(draft,basis)=>{calls.push({call:'mark',draft,basis});},
  ...rest};
 return {owners,calls,names:()=>calls.map(c=>c.call)};
}
test('E19 hosted: a draft at its base with no later edits is kept aside with its notice, and the checkpoint opens, after a clean or an unclean boot', async()=>{
 const saved=expression('h1','Checkpoint',T1),draft=expression('h1','Checkpoint',T0,2);
 for(const uncleanBoot of [true,false]){
  const {owners,calls,names}=hostedOwners({uncleanBoot});
  const out=await settleHostedDraft('h1',hostedRow(draft,basisOf(7,false)),saved,owners);
  assert.equal(out.kind,'checkpoint','the checkpoint is what opens');
  assert.equal(material(out.journey),material(saved),'the saved basis is adopted');
  assert.deepEqual(names(),['keep','adopt'],'kept first; the native row is neither removed nor marked');
  assert.equal(calls[0].draft,draft,'the draft kept is the draft as found');
  assert.equal(calls[0].text,hostedRow(draft,basisOf(7,false)).text,'the verbatim native text is what is kept');
  assert.equal(calls[0].plan.quarantineDraft,true);assert.equal(calls[0].plan.removeDraft,false);
  assert.match(calls[0].plan.quarantineReason,/No edits after its base/);
  assert.equal(names().includes('choose'),false,'a superseded draft is never offered');
  assert.equal(owners.settled.has('h1'),true);
  assert.match(out.kept,/^An older draft of this Expression was kept aside \(not opened\); the saved version opened\./,'the notice shows');
  assert.match(out.kept,/Its native draft record is kept/,'the native kept copy is named');
  assert.match(out.kept,/Library quarantine of this browser/,'the webview kept copy is named');
 }
});
test('E19 hosted: a draft whose base is behind the checkpoint, with no edits after it, is superseded by the checkpoint', async()=>{
 const saved=expression('h1b','Checkpoint',T1),draft=expression('h1b','Checkpoint',T0,2);
 const {owners,names}=hostedOwners();
 const out=await settleHostedDraft('h1b',hostedRow(draft,basisOf(5,false)),saved,owners);
 assert.equal(out.kind,'checkpoint');
 assert.deepEqual(names(),['keep','adopt']);
});
test('E19 hosted: a draft newer than its base is OFFERED even when the checkpoint conversion came later, and is never quarantined by itself', async()=>{
 const saved=expression('h5','Checkpoint',T2),newer=expression('h5','Checkpoint',T0,2);
 const restore=hostedOwners({choice:'restore-draft'});
 const out=await settleHostedDraft('h5',hostedRow(newer,basisOf(7,true)),saved,restore.owners);
 assert.deepEqual(restore.names(),['choose','adopt'],'the draft is offered through the dialog');
 assert.equal(restore.calls[0].request.offer.offer,true);
 assert.equal(restore.names().includes('keep'),false,'nothing is kept aside without a choice');
 assert.equal(out.kind,'draft','restore adopts the draft as found');
 assert.equal(out.kept,undefined);
 const kept=hostedOwners({choice:'keep-saved'});
 const chosen=await settleHostedDraft('h5',hostedRow(newer,basisOf(7,true)),saved,kept.owners);
 assert.match(chosen.kept,/^The draft was kept aside \(not opened\); the saved version opened\./,'a choice to keep the saved version shows its notice');
});
test('E19 hosted: a draft with no recorded base is unknown: offered on an unclean exit, never silently quarantined, and adopted as found after a clean one', async()=>{
 const saved=expression('h6','Checkpoint',T1),older=expression('h6','Checkpoint',T0,2);
 const unclean=hostedOwners({choice:'restore-draft'});
 const out=await settleHostedDraft('h6',hostedRow(older,undefined),saved,unclean.owners);
 assert.deepEqual(unclean.names(),['choose','adopt'],'an old draft is offered, not quarantined');
 assert.equal(out.kind,'draft');
 assert.equal(out.kept,undefined);
 const clean=hostedOwners({uncleanBoot:false});
 assert.equal((await settleHostedDraft('h6',hostedRow(older,undefined),saved,clean.owners)).kind,'draft','a clean boot adopts it as found and never quarantines it');
 assert.deepEqual(clean.names(),[]);
});
test('E19 hosted: the native draft row is marked kept only after its copy is confirmed; a failed keep holds the draft and names it, and nothing is adopted', async()=>{
 const saved=expression('h4','Checkpoint',T1),older=expression('h4','Checkpoint',T0,2);
 let refuse=true;
 const made=hostedOwners();
 made.owners.keepDraft=async(plan,draft,text)=>{made.calls.push({call:'keep',plan,draft,text});if(refuse)throw new Error('quarantine store refused');};
 await assert.rejects(settleHostedDraft('h4',hostedRow(older,basisOf(7,false)),saved,made.owners),err=>{
  assert.match(err.message,/The draft "Checkpoint" could not be kept in quarantine/,'the draft is named');
  assert.match(err.message,/It stays held for the next open/,'the hold is named');
  assert.match(err.message,/quarantine store refused/,'the cause is named');
  return true;
 });
 assert.equal(made.names().includes('mark'),false,'the native row is not marked kept');
 assert.equal(made.names().includes('adopt'),false,'nothing is adopted');
 assert.equal(made.owners.settled.has('h4'),false,'the draft is not settled, so the next open tries again');
 refuse=false;
 assert.equal((await settleHostedDraft('h4',hostedRow(older,basisOf(7,false)),saved,made.owners)).kind,'checkpoint');
 assert.deepEqual(made.names(),['keep','keep','adopt'],'the retry keeps again (idempotent by digest) and only then opens the checkpoint');
});
test('E19 hosted: a choice keeps both sides, marks its native row kept and never removes it; a restore adopts; a clean boot adopts the draft', async()=>{
 const saved=expression('h2','Checkpoint',T0),newer=expression('h2','Checkpoint',T1,2);
 for(const choice of ['restore-draft','keep-saved','keep-both']){
  const {owners,calls,names}=hostedOwners({choice});
  const out=await settleHostedDraft('h2',hostedRow(newer,basisOf(7,true)),saved,owners);
  assert.equal(calls[0].call,'choose','the owner is asked first');
  const asked=calls[0].request;
  assert.equal(asked.draft,newer);assert.equal(asked.saved,saved);assert.equal(asked.revision,7,'the kernel revision is named');
  assert.equal(asked.offer.offer,true);assert.equal(asked.offer.draftAt,T1);assert.equal(asked.offer.savedAt,T0);assert.ok(asked.offer.diff,'the offer carries its diff');
  if(choice==='restore-draft'){
   assert.equal(out.kind,'draft','restore adopts the draft as found');
   assert.deepEqual(names(),['choose','adopt']);
   assert.equal(owners.settled.has('h2'),true);
  }else{
   assert.equal(out.kind,'checkpoint');
   assert.equal(material(out.journey),material(saved));
   assert.deepEqual(names(),['choose','adopt','keep','adopt','mark'],'kept, then marked kept: the native row stays');
   assert.equal(calls.find(c=>c.call==='keep').plan.removeDraft,false,'the native row is never removed');
   assert.deepEqual(calls.find(c=>c.call==='mark').basis,basisOf(7,true),'the row is marked with the basis it was edited from');
   if(choice==='keep-saved'){assert.equal(calls.find(c=>c.call==='keep').plan.quarantineDraft,true,'the draft is kept verbatim');assert.match(out.kept,/was kept aside/,'the choice names its kept copy');}
   if(choice==='keep-both'){assert.ok(calls.find(c=>c.call==='keep').plan.copy,'the draft becomes a Library copy');assert.equal(out.kept,undefined,'a Library copy needs no quarantine notice');}
  }
 }
 const clean=hostedOwners({uncleanBoot:false});
 assert.equal((await settleHostedDraft('h2',hostedRow(newer,basisOf(7,true)),saved,clean.owners)).kind,'draft','a clean boot offers nothing and adopts the newer draft');
 assert.deepEqual(clean.names(),[]);
});
test('E19 hosted: a row the owner marked kept is superseded on every later open: kept again verbatim, never offered or adopted', async()=>{
 const saved=expression('h7','Checkpoint',T0),draft=expression('h7','Checkpoint',T1,2);
 for(const uncleanBoot of [true,false]){
  const {owners,names}=hostedOwners({uncleanBoot});
  const out=await settleHostedDraft('h7',hostedRow(draft,basisOf(7,true,true)),saved,owners);
  assert.deepEqual(names(),['keep','adopt'],'kept again, never offered');
  assert.equal(out.kind,'checkpoint');
  assert.match(out.kept,/kept aside/);
 }
});
test('E19 base: the basis rides under one reserved key and never reaches the Journey; an invalid or absent basis is unknown', ()=>{
 const j=expression('b1','Base',T0,2);
 const stored=draftValue(j,basisOf(7,true));
 assert.deepEqual(stored.draftBasis,basisOf(7,true));
 const {journey,basis}=splitDraftValue(stored);
 assert.deepEqual(basis,basisOf(7,true));
 assert.equal('draftBasis' in journey,false,'the Journey carries no basis');
 assert.equal(material(journey),material(j));
 assert.equal(splitDraftValue(draftValue(j)).basis,undefined,'no basis recorded is unknown');
 assert.equal(splitDraftValue({...draftValue(j),draftBasis:{schema:'oi.draft-basis/v1',revision:-1,edited:true}}).basis,undefined,'an invalid basis is unknown');
 assert.equal(basisSuperseded(basisOf(5,false),7),true,'no edits after an older base is superseded');
 assert.equal(basisSuperseded(basisOf(7,false),7),true,'no edits at the checkpoint base is superseded');
 assert.equal(basisSuperseded(basisOf(7,true),7),false,'edits after the base are never superseded');
 assert.equal(basisSuperseded(basisOf(8,false),7),false,'a base ahead of the checkpoint is not superseded');
 assert.equal(basisSuperseded(basisOf(7,true,true),3),true,'a row the owner kept stays kept');
 assert.equal(basisSuperseded(undefined,7),false,'an unknown basis is never superseded');
});
test('E19 notice: a kept draft names what happened and where the kept copy is; the frame carries it to its next status and the browser shows a toast', ()=>{
 const nw=fs.readFileSync(new URL('../src/nativeWorkspace.ts',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 assert.match(quarantineNotice('superseded',true),/^An older draft of this Expression was kept aside \(not opened\); the saved version opened\. Its native draft record is kept/);
 assert.match(quarantineNotice('superseded',false),/A verbatim copy is in the Library quarantine of this browser\.$/);
 assert.ok(nw.includes("notice=keptNotice?`${text} ${keptNotice}`:text;keptNotice='';"),'the notice rides the next status line, and is never dropped');
 assert.ok(nw.includes('if(settled.kept)keptNotice=settled.kept;'),'the settle sets the notice');
 assert.ok(app.includes("toast(quarantineNotice('superseded',false),9000)"),'the browser superseded quarantine is never silent');
 assert.ok(app.includes("toast(quarantineNotice('chosen',false),9000)"),'the browser keep-saved choice is never silent');
});
test('E19 write: every draft write records its base; a kept native row is not overwritten by a write that adds no edits', ()=>{
 const nw=fs.readFileSync(new URL('../src/nativeWorkspace.ts',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 assert.ok(nw.includes('draftBasis(journey,{revision:view.document.revision,journey:view.journey})'),'the basis is the checkpoint revision the frame stood on');
 assert.ok(nw.includes('if(heldDrafts.has(journey.id)&&!basis?.edited)return;'),'a held native row is not replaced by a write that adds no edits');
 assert.ok(app.includes('const persistDraft=(journey:Journey)=>nativeWorkspace?nativeWorkspace.persistDraft(journey):writeDraft(journey);'),'the frame writes through the basis rule');
 assert.ok(/async function flushDraft\(\)\{[\s\S]*?await persistDraft\(draft\)/.test(app),'the backup flush writes through the basis rule');
});

test('E19 take: merging a take advances the draft time, so a draft with merged samples is newer and offered; the older-or-equal rule is unchanged', ()=>{
 const saved=expression('t1','Saved',T0,1);
 const draft=clone(saved);
 const track={id:'take-count',bind:'field.params.count',points:[{time:0,value:1000},{time:1,value:2000}]};
 assert.equal(mergeTakeIntoDraft(draft,{sceneId:draft.scenes[0].id,start:0,elapsed:1,tracks:[track]},new Date(Date.parse(T1))),true);
 assert.equal(draft.updatedAt,T1,'the merged samples advance the draft time');
 assert.equal(draft.scenes[0].propertyTracks.length,1,'the samples are in the draft');
 const offer=recoveryOffer({draft,saved,uncleanExit:true});
 assert.equal(offer.offer,true,'a draft with merged samples is newer, so it is offered');
 assert.equal(supersededDraft({draft,saved}),false);
 const sameTime=clone(saved);sameTime.scenes[0].field.params.count+=5;
 assert.equal(recoveryOffer({draft:sameTime,saved,uncleanExit:true}).offer,false,'a same-time draft without a merge is still not offered');
 assert.equal(supersededDraft({draft:sameTime,saved}),true,'and is still superseded');
 assert.equal(mergeTakeIntoDraft(clone(saved),{sceneId:'missing',start:0,elapsed:1,tracks:[]},new Date()),false,'an absent scene merges nothing');
});
test('E17 status: a draft record that did not land never reads as a draft backup', ()=>{
 assert.equal(draftStatusLine('library-copy',new Date(2026,9,13,9,7),'browser'),'Draft not recorded; a Library copy was saved');
 const app=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 assert.ok(app.includes("draftStatusLine('library-copy',new Date(),'browser')"),'the browser fallback names the Library copy');
 assert.ok(!app.includes("draftStatusLine('backed-up',new Date(),'browser')"),'no browser status claims a draft backup when only the Library copy landed');
 assert.ok(app.includes('mergeTakeIntoDraft(draft,propertyTake,new Date())'),'the take merge advances the draft time');
});
test('E19: the choice dialog names what changed in a style rule that uses tokens only', ()=>{
 const css=fs.readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const rules=css.split('\n').filter(line=>line.startsWith('.recovery-diff'));
 assert.equal(rules.length,3,'the list, its items and their markers are styled');
 assert.ok(rules.every(rule=>!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(rule)),'no literal colours');
});
