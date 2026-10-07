import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

const temporary=await mkdtemp(join(tmpdir(),'oi-knowledge-automations-'));
await build({stdin:{contents:`
  import {createElement} from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {KnowledgeStatusContent,readKnowledgeStatus} from './src/knowledge/KnowledgeStatus';
  export {readKnowledgeStatus};
  export {routineList,actionMessage,nextOccurrenceTimes,scheduleRecord,authorityRecord,createRefusal,createReceiptMessage} from './src/contributions/automations/client';
  export function render(value){return renderToStaticMarkup(createElement(KnowledgeStatusContent,{reading:readKnowledgeStatus(value)}));}
`,resolveDir:resolve('.')},bundle:true,platform:'node',format:'cjs',jsx:'automatic',logLevel:'error',outfile:join(temporary,'production.cjs')});
const production=createRequire(import.meta.url)(join(temporary,'production.cjs'));
test.after(()=>rm(temporary,{recursive:true,force:true}));

test('source status preserves native unavailable coverage and authored-link counts in the production renderer',()=>{
  const html=production.render({sources:[{provider:'provider/source-pool/bkmr-stores',available:false,detail:'books: read snapshot exceeded its five second budget'}],project_map:false,notes:['Work/O-I source pool: live filesystem search'],absences:['Work/Other: anchor unavailable'],authored_pending:[{project:'Work/O-I',unresolved_targets:2,occurrences:3}]});
  assert.match(html,/bkmr stores/);assert.match(html,/Unavailable/);assert.match(html,/five second budget/);
  assert.match(html,/Work\/Other: anchor unavailable/);assert.match(html,/2.*unresolved targets across.*3.*links/);
  assert.doesNotMatch(html,/<pre>|"sources":/);
});
test('malformed owner status cannot become a successful empty status',()=>{
  assert.throws(()=>production.readKnowledgeStatus({}),/unreadable/);
  assert.throws(()=>production.readKnowledgeStatus({sources:[{available:true}],project_map:true}),/unreadable/);
});
test('routine lists require native timer reconciliation instead of silently inventing an empty collection',()=>{
  assert.throws(()=>production.routineList({routines:[]}),/did not disclose/);
  assert.deepEqual(production.routineList({routines:[],foreign_reconciliation:{providers:[]}}),{routines:[],foreign_reconciliation:{providers:[]}});
});
test('routine return text never upgrades admitted, failed or unreturned work into successful execution',()=>{
  assert.match(production.actionMessage({admission:'applied'}),/no execution outcome/);
  assert.equal(production.actionMessage({outcome:{status:'failed',detail:'Connection unavailable'}}),'Run failed. Connection unavailable');
  assert.match(production.actionMessage({outcome:{status:'unreturned',detail:''}}),/no completed return/);
  assert.equal(production.actionMessage({state:'disabled'}),'Routine disabled.');
});
test('structured owner receipt detail is not dumped into the human run result',()=>{
  const text=production.actionMessage({outcome:{status:'completed',detail:JSON.stringify({receipt:'/private/native/receipt.json',result:{closed:3}})}});
  assert.equal(text,'Run completed.');assert.doesNotMatch(text,/private|receipt|\{/);
});
test('schedule display uses only returned native instants and labels UTC explicitly',()=>{
  assert.deepEqual(production.nextOccurrenceTimes({occurrences:[{due_unix_ms:0},{due_unix_ms:'tomorrow'},{due_unix_ms:NaN}]}),['1970-01-01 00:00:00 UTC']);
  assert.deepEqual(production.nextOccurrenceTimes({}),[]);
});
test('schedule records carry the native contract and refuse malformed shapes in native words',()=>{
  assert.deepEqual(production.scheduleRecord('Daily demo',{kind:'daily',time:'09:00'}),{schema:'aikit.time-schedule/v1',schedule_ref:'schedule/daily-demo',schedule:{kind:'daily',time:'09:00'}});
  assert.throws(()=>production.scheduleRecord('x',{kind:'daily',time:'25:00'}),/hh:mm/);
  assert.throws(()=>production.scheduleRecord('x',{kind:'cron',expression:'0 9 * *'}),/exactly 5 fields/);
  assert.throws(()=>production.scheduleRecord('x',{kind:'every',interval_ms:0}),/positive/);
  assert.throws(()=>production.scheduleRecord('x',{kind:'once'}),/exactly one/);
  assert.throws(()=>production.scheduleRecord('x',{kind:'once',rfc3339:'2026-10-07T09:00:00Z',due_unix_ms:1}),/exactly one/);
});
test('authority records are structured — no raw JSON in the surface — and refuse the empty cases',()=>{
  assert.deepEqual(production.authorityRecord({authority_ref:'authority/a',revision:'',action_refs:' act/a, action/b ',granted:true,unattended:false}),{authority_ref:'authority/a',action_refs:['act/a','action/b'],granted:true,unattended:false});
  assert.deepEqual(production.authorityRecord({authority_ref:'authority/a',revision:' rev/2 ',action_refs:'act/a',granted:false,unattended:true}),{authority_ref:'authority/a',revision:'rev/2',action_refs:['act/a'],granted:false,unattended:true});
  assert.throws(()=>production.authorityRecord({authority_ref:'',action_refs:'act/a',granted:true,unattended:false}),/authority reference/);
  assert.throws(()=>production.authorityRecord({authority_ref:'authority/a',action_refs:' , ',granted:true,unattended:false}),/at least one canonical Method Action/);
});
test('the proof gate refuses before any native ask, and never upgrades to a creation claim',()=>{
  assert.match(production.createRefusal({name:'',method:'skill/x',proof:'{}'}),/needs a name/);
  assert.match(production.createRefusal({name:'a',method:'',proof:'{}'}),/needs a Method/);
  assert.match(production.createRefusal({name:'a',method:'skill/x',proof:''}),/cannot be created without proof/);
  assert.match(production.createRefusal({name:'a',method:'skill/x',proof:'not json'}),/not readable JSON/);
  assert.equal(production.createRefusal({name:'a',method:'skill/x',proof:'@/tmp/basis.json'}),undefined);
  assert.equal(production.createRefusal({name:'a',method:'skill/x',proof:'{"proof_ref":"proof/a"}'}),undefined);
});
test('create and adoption receipts speak in owner words, never bare JSON',()=>{
  assert.equal(production.createReceiptMessage({routine:'routine/daily-demo',state:'draft',note:'created in Draft; enable it with `aikit routine enable`'}),'Created routine/daily-demo in Draft. created in Draft; enable it with `aikit routine enable`');
  assert.throws(()=>production.createReceiptMessage({state:'draft'}),/did not return a Routine creation receipt/);
  assert.match(production.actionMessage({routine:'routine/a',state:'enabled',note:'enabled and bound'}),/Routine enabled\. enabled and bound/);
  assert.match(production.actionMessage({routine:'routine/a',state:'disabled',method_revision:'rev/2',note:'reproven'}),/Reproven at rev\/2\. reproven/);
  assert.equal(production.actionMessage({state:'disabled'}),'Routine disabled.');
});
