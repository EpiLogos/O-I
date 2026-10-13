import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {blankJourney,blankScene,clone,validateJourney} from '../build/model.js';
import {recoveryOffer,planRecoveryChoice,draftCopy,readUncleanExit,markSessionOpen,markSessionClosed,offerClock,SESSION_MARK_KEY,writeRecord,loadRecord,removeRecord,listQuarantine,quarantine} from '../build/draftStorage.js';

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

test('restore draft opens the draft and removes nothing', ()=>{
 const saved=expression('e1','Saved',T0),draft=expression('e1','Saved',T1,2);
 const plan=planRecoveryChoice('restore-draft',draft,saved,new Date(2026,9,13,9,8));
 assert.equal(material(plan.open),material(draft));
 assert.equal(plan.removeDraft,false);assert.equal(plan.quarantineDraft,false);assert.equal(plan.copy,undefined);
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
 s.setItem(SESSION_MARK_KEY,'{broken');
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
