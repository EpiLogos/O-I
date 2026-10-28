import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {libraryHTML,ownerKeptRemovalText,ownerKeptRemovedText} from '../build/expressions.js';
import {keptDraftSections,draftValue} from '../build/draftStorage.js';
import {listKeptDrafts,setOwnerQuarantineTransport} from '../build/recovery.js';
import {blankJourney} from '../build/model.js';

// T-REVIEW-6 (3a): quarantined drafts have a reader. The Library lists each with its name, reason and time, and offers
// Export JSON and Restore as copy. The two Library pages (the instrument and the standalone page) both wire the actions.
const base={saved:[],featured:[],starters:[],section:'collection',errors:[],legacy:false,cover:()=>undefined,standalone:true};
const row={id:'draft|j1|abc123',key:'j1',name:'Field <study>',reason:'Unreadable draft: Unexpected token',when:'09:05:07'};

test('T-REVIEW-6: quarantined drafts are listed with name, reason, time, and both actions', ()=>{
 const html=libraryHTML({...base,quarantine:{rows:[row],unreadable:[]}});
 assert.match(html,/data-scope="quarantine"/);
 assert.match(html,/Field &lt;study&gt;/,'the name is escaped, never injected');
 assert.match(html,/Unreadable draft: Unexpected token/,'the reason is shown');
 assert.match(html,/09:05:07/,'the time is shown');
 assert.match(html,/data-action="export-quarantine" data-id="draft\|j1\|abc123"/);
 assert.match(html,/data-action="restore-quarantine" data-id="draft\|j1\|abc123"/);
 assert.match(html,/Export JSON/);
 assert.match(html,/Restore as copy/);
});

test('T-REVIEW-6: no quarantine section when nothing is quarantined; unreadable entries are named, never hidden', ()=>{
 assert.doesNotMatch(libraryHTML({...base}),/data-scope="quarantine"/);
 const html=libraryHTML({...base,quarantine:{rows:[],unreadable:['stray']}});
 assert.match(html,/data-scope="quarantine"/);
 assert.match(html,/1 stored entry could not be read/);
 assert.match(html,/stray/);
});

test('T-REVIEW-6: a refusal message from a restore is shown in the section', ()=>{
 const html=libraryHTML({...base,quarantine:{rows:[row],unreadable:[],message:'This quarantined draft cannot be restored: n must be a number'}});
 assert.match(html,/role="status"[^>]*>[^<]*cannot be restored: n must be a number/);
});

test('T-REVIEW-6: the instrument and the standalone Library both wire the two quarantine actions', ()=>{
 for(const file of ['../src/app.ts','../src/library.ts']){
  const source=fs.readFileSync(new URL(file,import.meta.url),'utf8');
  assert.ok(source.includes("'export-quarantine'"),`${file} exports a quarantined draft`);
  assert.ok(source.includes("'restore-quarantine'"),`${file} restores a quarantined draft as a copy`);
  // O-I #763: and the native owner's kept drafts: Restore as copy, and Remove (Clear), which only a confirmation sends.
  assert.ok(source.includes("'restore-owner-kept'"),`${file} restores an owner's kept draft as a copy`);
  assert.ok(source.includes("'remove-owner-kept'"),`${file} removes an owner's kept draft`);
  assert.ok(source.includes('ownerKeptRemovalText('),`${file} confirms a removal in the one wording`);
 }
});

// O-I #763: the DLW never shows the instrument's own Library. The frame stands on the shell's devices ('devices', framePresentation.ts
// wantedPresentation at every size), and there its Library… hands the summon to the shell (app.ts openLibrary → presentedChrome.ts
// summon), which opens the Library's own page (library.html, through summonedEditors.tsx → LibraryHost). That page drew the browser's
// quarantine but not the native owner's kept drafts, so a draft the owner kept had no Restore and no Remove on screen. The page now
// lists every Expression whose kept drafts the owner holds, each in its own section under its title; both actions carry the Expression.
const KEPT_AT=Date.parse('2026-10-28T09:05:07Z');
const keptEntry=(digit,name,draftId)=>({id:digit.repeat(64),draft_id:draftId,reason:'Superseded by the saved copy after an unclean exit.',kept_at_unix_ms:KEPT_AT,
 text:JSON.stringify(draftValue({...blankJourney(),name}))});

test('O-I #763: the Library page draws one kept-drafts section per Expression, under its heading, and both actions name the Expression', ()=>{
 const row=(digit,name)=>({id:digit.repeat(64),name,reason:'Superseded',when:'09:05:07',draftId:'expression:a'});
 const html=libraryHTML({...base,ownerQuarantine:[
  {expressionRef:'expression:a',heading:'Kept drafts of “Morning”',rows:[row('a','Morning <draft>')]},
  {expressionRef:'expression:b',heading:'Kept drafts of “Evening”',rows:[row('b','Evening')],message:'Restored as a Library copy: Evening'},
 ]});
 assert.equal((html.match(/data-scope="owner-quarantine"/g)??[]).length,2);
 assert.match(html,/<h2>Kept drafts of “Morning”<\/h2>/);
 assert.match(html,/Morning &lt;draft&gt;/,'the name is escaped, never injected');
 assert.match(html,new RegExp(`data-action="restore-owner-kept" data-id="${'a'.repeat(64)}" data-ref="expression:a"`));
 assert.match(html,new RegExp(`data-action="remove-owner-kept" data-id="${'b'.repeat(64)}" data-ref="expression:b"`));
 assert.match(html,/data-ref="expression:b"[^]*role="status"[^>]*>Restored as a Library copy: Evening|role="status"[^>]*>Restored as a Library copy: Evening[^]*data-ref="expression:b"/);
 // The instrument's own Library keeps its one section for the open Expression, as before: its heading, and no Expression on the actions.
 const one=libraryHTML({...base,ownerQuarantine:{rows:[row('c','Open draft')]}});
 assert.match(one,/<h2>Kept drafts of this Expression<\/h2>/);
 assert.match(one,new RegExp(`data-action="remove-owner-kept" data-id="${'c'.repeat(64)}">`));
});

test('O-I #763: kept-draft sections come from the owner\'s listing: titled by the works list, a message in its own section, an unreadable one named', ()=>{
 const now=new Date('2026-10-28T12:00:00Z');
 const sections=keptDraftSections([
  {expressionRef:'expression:a',reading:{revision:4,entries:[keptEntry('a','Morning sketch','expression:a')]}},
  {expressionRef:'expression:gone',reading:{revision:2,entries:[keptEntry('b','Lost title','expression:gone')]}},
  {expressionRef:'expression:c',reading:{revision:null,entries:[],unreadable:'Its record does not validate.'}},
 ],new Map([['expression:a','Morning']]),{ref:'expression:a',text:'Removed. 0 kept drafts remain.'},now);
 assert.deepEqual(sections.map(s=>[s.expressionRef,s.heading,s.rows.length,s.message??null]),[
  ['expression:a','Kept drafts of “Morning”',1,'Removed. 0 kept drafts remain.'],
  ['expression:gone','Kept drafts of “Lost title”',1,null],
  ['expression:c','Kept drafts of “expression:c”',0,null],
 ],'a work the list does not name is titled by its newest kept draft, else by its ref');
 assert.equal(sections[0].rows[0].name,'Morning sketch');
 assert.equal(sections[0].rows[0].id,'a'.repeat(64));
 assert.match(sections[2].error,/^The native owner cannot read the kept drafts of this Expression, so none are listed and none were removed or overwritten\. Its record does not validate\.$/);
});

test('O-I #763: every Expression\'s kept drafts are read from one owner listing; an Expression keeping none is not read', async ()=>{
 const sent=[];
 const record=(ref,entries)=>({id:ref,scope:'expressions',kind:'draft_quarantine',revision:3,value:{schema:'oi.draft-quarantine/v1',expression_ref:ref,entries}});
 setOwnerQuarantineTransport(async request=>{
  sent.push([request.operation,request.scope,request.kind,request.id??null]);
  if(request.operation==='list')return {schema:'oi.expression-recovery/v1',state:'listed',records:[
   {id:'expression:a',scope:'expressions',kind:'draft_quarantine',revision:3,entries:1},
   {id:'expression:empty',scope:'expressions',kind:'draft_quarantine',revision:5,entries:0}]};
  return {schema:'oi.expression-recovery/v1',state:'ready',record:record(request.id,[keptEntry('a','Morning sketch','expression:a')])};
 });
 try{
  const kept=await listKeptDrafts('expressions');
  assert.deepEqual(sent,[['list','expressions','draft_quarantine',null],['read','expressions','draft_quarantine','expression:a']]);
  assert.deepEqual(kept.map(k=>[k.expressionRef,k.reading.revision,k.reading.entries.map(e=>e.id)]),[['expression:a',3,['a'.repeat(64)]]]);
  setOwnerQuarantineTransport(async ()=>({state:'refused'}));
  await assert.rejects(listKeptDrafts('expressions'),/The native owner returned an invalid listing of kept drafts/);
 }finally{setOwnerQuarantineTransport();}
});

test('O-I #763: a removal is confirmed in one wording, and its answer counts what remains', ()=>{
 assert.equal(ownerKeptRemovalText({name:'Morning sketch',reason:'Superseded'}),'The kept copy "Morning sketch" (Superseded) is removed from this Expression\'s quarantine in the native owner. Nothing else is removed: the saved copy and the open Expression stay as they are.');
 assert.equal(ownerKeptRemovedText(1),'Removed. 1 kept draft remains.');
 assert.equal(ownerKeptRemovedText(0),'Removed. 0 kept drafts remain.');
});

test('code-reading: the Library page reads every Expression\'s kept drafts when it opens, and sends Remove only after its confirmation', ()=>{
 const page=fs.readFileSync(new URL('../src/library.ts',import.meta.url),'utf8');
 assert.match(page,/listKeptDrafts\(/,'the page asks the owner for every Expression\'s kept drafts');
 assert.match(page,/ownerQuarantine:kept/,'and draws them in the Library');
 const remove=page.slice(page.indexOf("case 'remove-owner-kept'"),page.indexOf('break;',page.indexOf("case 'remove-owner-kept'")));
 assert.ok(remove.indexOf('confirmed(')>=0&&remove.indexOf('confirmed(')<remove.indexOf('removeOwnerKeptDraft('),'Remove is sent only after the confirmation');
 assert.match(remove,/el\.dataset\.ref/,'Remove acts on the Expression the row names');
});

// O-I #763: the Library's own page never armed the kernel host channel (kernelExpressions.ts installKernelExpressions, which app.ts calls at
// boot), so each owner read it sent waited for an answer nothing received: its kept drafts, its kernel-held and native sections and its
// collections all stood at "not announced" in the DLW, whose LibraryHost relays that channel for exactly these reads. Found by the headless
// run of the page against the real owner (scratchpad b763b native-acceptance.mjs); the page now arms it before it reads anything.
test('code-reading: the Library page arms the kernel host channel before it reads the owner', ()=>{
 const page=fs.readFileSync(new URL('../src/library.ts',import.meta.url),'utf8');
 assert.match(page,/^installKernelExpressions\(\);$/m,'the page arms the channel at boot');
 const boot=page.slice(page.indexOf('\ninstallKernelExpressions();'));
 for(const read of ['refreshKept();','refreshBins();','renderLibrary();'])assert.ok(boot.includes(read),`${read} follows the arming`);
 // The collections' index is asked through nativeExpressionRequest, which refuses until the host's announce arrives: it waits for the
 // channel as the kernel-held and native sections do (libraryScopes.ts), instead of failing once at boot and never asking again.
 const bins=page.slice(page.indexOf('function refreshBins('),page.indexOf('\n}',page.indexOf('function refreshBins(')));
 assert.match(bins,/if\(!kernelExpressionsAvailable\(\)&&attempt<\d+\)\{setTimeout\(\(\)=>refreshBins\(attempt\+1\),\d+\);return;\}/);
});
