/** Two real native Central roots and Node's actual file-backed Web Storage.
 * No substituted recognition, source reading or storage implementation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {qualifyDraftOwner,readDraft,writeDraft,clearSavedDraft,writeDraftIntent,acknowledgeDraft,readDurableDraft,draftStorageKey} from '../src/workspace/drafts.ts';

test('actual owner identity partitions drafts, replacement and later continuation',{skip:process.env.OI_NATIVE_RETAINED_FILES!=='1',timeout:90000},async()=>{
 const ctrl=process.env.OI_CENTRAL_CTRL_BIN,fixtureBase=process.env.OI_NATIVE_TEST_ROOT;
 assert.ok(ctrl);assert.ok(fixtureBase,'an explicit native-test fixture field is required');
 assert.equal(typeof localStorage.setItem,'function','use the actual file-backed Web Storage flag');
 await mkdir(fixtureBase,{recursive:true});const scratch=await mkdtemp(join(fixtureBase,'draft-owners-'));
 const a=join(scratch,'A'),b=join(scratch,'B'),ref='central:source:control:root:Control/user/draft-owner-proof.md';
 const action=(root,name,input)=>{const result=JSON.parse(execFileSync(ctrl,['--root',root,'--json','action','run',name,JSON.stringify(input)],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024}));assert.equal(result.ok,true,JSON.stringify(result));return result.data;};
 const initialize=async root=>{action(root,'central.init',{});await mkdir(join(root,'Control/user'),{recursive:true});await writeFile(join(root,'Control/user/draft-owner-proof.md'),'The same real source bytes in two independent native roots.\n');};
 const recognize=root=>action(root,'central.recognize',{path:root});
 const keys=[];const legacyKey=`oi-cradle.draft.v1:${ref}`,legacyBefore=localStorage.getItem(legacyKey);
 try{
  await initialize(a);await initialize(b);
  const first=action(a,'projectcentral.source.read',{source_ref:ref}),second=action(b,'projectcentral.source.read',{source_ref:ref});
  assert.equal(first.source.ref,second.source.ref);assert.equal(typeof first.content,"string");assert.equal(first.content,second.content);assert.equal(first.revision.revision,second.revision.revision);
  const recognitionA=recognize(a),recognitionB=recognize(b);
  const ownerA=qualifyDraftOwner(a,recognitionA),ownerB=qualifyDraftOwner(b,recognitionB);assert.ok(ownerA);assert.ok(ownerB);
  assert.equal(qualifyDraftOwner(a,recognitionB),undefined,'another actual recognition is not authority for this root');
  assert.equal(qualifyDraftOwner(undefined,recognitionA),undefined);assert.equal(qualifyDraftOwner(a,undefined),undefined);
  const draftA={content:'A retained contribution',base_revision:first.revision.revision,saved_content:first.content};
  const draftB={content:'B independently retained contribution',base_revision:second.revision.revision,saved_content:second.content};
  localStorage.setItem(legacyKey,JSON.stringify({content:'Unqualified old device material',base_revision:first.revision.revision,saved_content:first.content}));
  const legacyBytes=localStorage.getItem(legacyKey);
  assert.equal(readDraft(ownerA,ref),null,'legacy text is not automatically adopted by a recognized root');
  assert.throws(()=>writeDraft(undefined,ref,draftA),/owner has not been recognized/);assert.equal(readDraft(undefined,ref),null);
  writeDraft(ownerA,ref,draftA);keys.push(draftStorageKey(ownerA,ref));
  assert.equal(readDraft(ownerB,ref),null);writeDraft(ownerB,ref,draftB);keys.push(draftStorageKey(ownerB,ref));
  assert.deepEqual(readDraft(ownerA,ref),draftA);assert.deepEqual(readDraft(ownerB,ref),draftB);
  await rename(a,a+'-previous');await initialize(a);
  const replacement=qualifyDraftOwner(a,recognize(a));assert.ok(replacement);assert.notEqual(replacement.inode,ownerA.inode);
  assert.equal(readDraft(replacement,ref),null,'same path and source bytes cannot restore the previous directory owner');
  writeDraft(replacement,ref,{...draftA,content:'Replacement owner contribution'});keys.push(draftStorageKey(replacement,ref));
  clearSavedDraft(ownerA,ref,draftA.content);assert.equal(readDraft(ownerA,ref),null);
  assert.equal(readDraft(replacement,ref).content,'Replacement owner contribution','an old completion cannot clear replacement work');
  assert.deepEqual(readDraft(ownerB,ref),draftB);assert.equal(localStorage.getItem(legacyKey),legacyBytes);
  writeDraftIntent(ownerB,ref,draftB);assert.equal(readDurableDraft(ownerB,ref).acknowledged,false);
  acknowledgeDraft(ownerB,ref,draftB);assert.equal(readDurableDraft(ownerB,ref).acknowledged,true);
  // A fresh Node body reopens the same real storage file, without tool effects.
  const storageArg=process.execArgv.find(arg=>arg.startsWith('--localstorage-file='));assert.ok(storageArg);
  const code=`const m=await import(${JSON.stringify(new URL('../src/workspace/drafts.ts',import.meta.url).href)});process.stdout.write(JSON.stringify(m.readDraft(${JSON.stringify(ownerB)},${JSON.stringify(ref)})));`;
  const later=JSON.parse(execFileSync(process.execPath,['--experimental-webstorage',storageArg,'--experimental-strip-types','--input-type=module','-e',code],{encoding:'utf8',timeout:10000,maxBuffer:65536}));assert.deepEqual(later,draftB);
 }finally{for(const key of keys)if(key)localStorage.removeItem(key);if(legacyBefore===null)localStorage.removeItem(legacyKey);else localStorage.setItem(legacyKey,legacyBefore);await rm(scratch,{recursive:true,force:true});}
});
