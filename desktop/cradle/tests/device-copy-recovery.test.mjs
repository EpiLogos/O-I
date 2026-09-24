/** Production migration against Node's real disk-backed Web Storage. This is
 * device-record behaviour, not browser/native UI or source authority evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('legacy copy becomes only an acknowledged unverified detached draft and refusals preserve original',()=>{
 const directory=mkdtempSync(join(tmpdir(),'oi-device-recovery-'));
 try{
 const code=`
 import assert from 'node:assert/strict';
 import {hasLegacyDeviceCopy,recoverLegacyDeviceCopy} from './src/files/legacyRecovery.ts';
 import {readUnplacedDraft,DRAFT_KEY} from './src/flow/unplacedDrafts.ts';
 const ref='native:old-source',key='oi-cradle.file-last-reading.v1:'+ref;
 const original={content:'Unverified previous words',revision:'forged-browser-revision',location:{root:'/never-import',path:'private.md'},operations:{write:{available:true}}};
 localStorage.setItem(key,JSON.stringify(original));
 assert.equal(hasLegacyDeviceCopy(ref),true);
 assert.throws(()=>recoverLegacyDeviceCopy(ref,false),/does not permit/);assert.deepEqual(JSON.parse(localStorage.getItem(key)),original);
 const id=recoverLegacyDeviceCopy(ref,true);assert.match(id,/^device-recovery:/);assert.ok(!id.includes(ref));
 const draft=readUnplacedDraft(id);assert.equal(draft.text,original.content);assert.equal(draft.unverified_recovery,true);assert.deepEqual(Object.keys(draft).sort(),['at','text','unverified_recovery']);assert.equal(localStorage.getItem(key),null);assert.ok(localStorage.getItem(DRAFT_KEY(id)));
 localStorage.setItem(key,'malformed');assert.throws(()=>recoverLegacyDeviceCopy(ref,true));assert.equal(localStorage.getItem(key),'malformed');
 localStorage.setItem(key,JSON.stringify({content:'€'.repeat(3*1024*1024)}));assert.throws(()=>recoverLegacyDeviceCopy(ref,true),/8 MiB/);assert.ok(localStorage.getItem(key));
 `;
 execFileSync(process.execPath,['--experimental-webstorage',`--localstorage-file=${join(directory,'storage')}`,'--experimental-strip-types','--import','./tests/ts-register.mjs','--input-type=module','-e',code],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
 }finally{rmSync(directory,{recursive:true,force:true});}
});
