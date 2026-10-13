import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {libraryHTML} from '../build/expressions.js';

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
 }
});
