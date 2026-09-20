import test from 'node:test';
import assert from 'node:assert/strict';
import {options,checkProviderBasis,providerTurn} from './local-shell-acceptance.mjs';
const basis=()=>({status:{resident:true,native_session_id:'native-test',state:'ready',provider:{id:'live-configured'}},view:{draft:{revision:7,text:''},permissions:[],actions:[{ref:'aikit.encounter.prompt',enabled:true}]}});
test('local acceptance defaults to facts; live writes require explicit consent',async()=>{
 assert.deepEqual(options([]),{command:'facts'});assert.throws(()=>options(['facts','--unknown']));assert.throws(()=>options(['facts','--out']));
 let calls=0;await assert.rejects(()=>providerTurn({},()=>{calls++;},{}),/consent/);assert.equal(calls,0);
});
test('live provider basis refuses dirty draft, active turn, missing owner and fixtures',()=>{
 for(const mutate of [b=>b.view.draft.text='personal draft',b=>b.status.resident=false,b=>b.status.provider.id='wrong',b=>b.view.permissions.push({id:'p'}),b=>b.view.actions.push({ref:'aikit.encounter.cancel',enabled:true})]){
  const b=basis();mutate(b);assert.throws(()=>checkProviderBasis(b.status,b.view,'live-configured'));
 }
 const b=basis();assert.throws(()=>checkProviderBasis(b.status,b.view,'fixture-provider'));checkProviderBasis(b.status,b.view,'live-configured');
});
test('protocol-control unit test: one CAS prompt, exact fresh nonce, same native session',async()=>{
 const b=basis(),calls=[],record={};let nonce;
 await providerTurn({'consent-test-turn':true,session:'dedicated-test',provider:'live-configured'},async r=>{
  calls.push(r.action);if(r.action==='status')return b.status;
  if(r.action==='draft'){assert.equal(r.basis,7);nonce=r.text.match(/OI_SHELL_[a-f0-9]+/)[0];return {revision:8,text:r.text};}
  if(r.action==='prompt'){assert.equal(r.draft_revision,8);return {draft:{revision:9,text:''}};}
  return nonce?{...b.view,blocks:[{kind:'assistant',text:nonce}]}:b.view;
 },record);
 assert.equal(record.provider.observed,true);assert.equal(calls.filter(x=>x==='prompt').length,1);assert.ok(!calls.includes('cancel'));
});
test('uncertain transport is preserved and never automatically replayed or cancelled',async()=>{
 const b=basis(),record={},calls=[];
 await assert.rejects(()=>providerTurn({'consent-test-turn':true,session:'test',provider:'live-configured'},async r=>{
  calls.push(r.action);if(r.action==='status')return b.status;if(r.action==='view')return b.view;if(r.action==='draft')return {revision:8};throw Error('connection lost');
 },record),/connection lost/);
 assert.equal(record.provider.submitted,'uncertain');assert.equal(calls.filter(x=>x==='prompt').length,1);assert.ok(!calls.includes('cancel'));
});
