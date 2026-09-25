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
  export {routineList,actionMessage,nextOccurrenceTimes} from './src/contributions/automations/client';
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
