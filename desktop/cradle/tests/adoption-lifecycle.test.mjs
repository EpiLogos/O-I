import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AdoptionController} from '../src/configuration/adoptionController.ts';
import {createAdoptionNative} from '../src/configuration/adoptionNative.ts';
const clone = structuredClone;
function harness(options = {}) {
  const calls = []; let now = 100; let journal = options.journal;
  const discovery = {schema:'oi.setup/v1',basis:'native-basis',target:'linux/x86_64',bound_ground:null,suggested_ground:'/test/Central',selected_ground:null,ground:{outcome:'new'},desktop:{state:'absent'},warnings:[],products:[],choices:[{id:'0/1/2',title:'Existing tools',description:'Retain this World',products:[],hosted:false},{id:'5/0',title:'Read',description:'Hosted',products:[],hosted:true}]};
  const native = {async request(request) {
    calls.push(clone(request));
    if (request.action === 'status') return {schema:'oi.setup/v1',journal,disposition:journal?'outcome_unknown':undefined};
    if (request.action === 'discover') return {schema:'oi.setup/v1',discovery};
    if (request.action === 'prepare_desktop') return {schema:'oi.setup/v1',bundle:'/native/staging/Desktop.zip',sha256:'a'.repeat(64)};
    if (request.action === 'plan') return {schema:'oi.setup/v1',plan:{schema:'oi.adoption-plan/v1',engagement_contract:'native/v1',selection:clone(request.selection),discovery,steps:[{title:'Retain Central',effects:['Bind only after review'],operation:{kind:'bind_ground',path:'/test/Central'}}],blocked:options.blocked??[],notices:[],review_token:'reviewed-native-token',created_at_unix_ms:100,expires_at_unix_ms:200}};
    if (request.action === 'apply') {
      if (options.wait) await options.wait;
      journal = {schema:'oi.adoption-journal/v1',plan:clone(request.plan),records:[{state:options.partial?'applied':'verified'}]};
      if (options.lost) throw Error('socket closed after dispatch');
      if (options.reply) return options.reply(request, journal);
      return {schema:'oi.setup/v1',journal,disposition:options.partial?'partially_applied':'verified'};
    }
    if (request.action === 'recheck') return options.readback ?? {schema:'oi.setup/v1',journal:{...journal,records:journal.records.map(()=>({state:'verified'}))},disposition:'verified'};
    throw Error('unexpected action');
  }};
  const controller = new AdoptionController(native, () => now);
  return {controller,native,calls,discovery,options,setTime:n=>{now=n},count:action=>calls.filter(c=>c.action===action).length};
}
async function review(h) {await h.controller.start(); await h.controller.plan(); assert.equal(h.controller.getSnapshot().step,'review');}
test('first discovery and strict-mode remount perform reads, not installation',async()=>{
  const h=harness();await Promise.all([h.controller.start(),h.controller.start()]);assert.equal(h.count('status'),1);assert.equal(h.count('discover'),1);assert.equal(h.count('apply'),0);assert.equal(h.controller.getSnapshot().selection.ground,'/test/Central');
});
test('plan preserves Central and independent Desktop/partial composition choices',async()=>{
  const h=harness();await h.controller.start();h.controller.select({ground:'/existing/root',composition:'custom',products:['central'],desktop:'remove',remove_products:[]});await h.controller.plan();assert.deepEqual(h.calls.find(r=>r.action==='plan').selection,{ground:'/existing/root',composition:'custom',products:['central'],desktop:'remove',remove_products:[]});assert.equal(h.count('apply'),0);h.controller.back();assert.equal(h.controller.getSnapshot().selection.desktop,'remove');
});
test('changing selection invalidates review rather than sending a stale plan',async()=>{
  const h=harness();await review(h);h.controller.select({ground:'/different'});await h.controller.apply();assert.equal(h.count('apply'),0);assert.equal(h.controller.getSnapshot().plan,undefined);
});
test('expiry, clock regression and refused native plans cannot apply',async()=>{
  for(const time of [99,200,201]) {const h=harness();await review(h);h.setTime(time);await h.controller.apply();assert.equal(h.count('apply'),0);}
  const h=harness({blocked:['Native owner unavailable']});await review(h);await h.controller.apply();assert.equal(h.count('apply'),0);
});
test('duplicate click is one native write; close cannot cancel a dispatched install',async()=>{
  let done;const wait=new Promise(r=>done=r);const h=harness({wait});await review(h);const first=h.controller.apply();await h.controller.apply();assert.equal(h.count('apply'),1);assert.equal(h.controller.canClose(),false);assert.equal(h.controller.back(),false);done();await first;assert.equal(h.controller.getSnapshot().disposition,'verified');assert.equal(h.controller.canClose(),true);
});
test('lost reply preserves unknown across reentry, blocks writes, and rechecks reads only',async()=>{
  const h=harness({lost:true});await review(h);await h.controller.apply();assert.equal(h.controller.getSnapshot().unresolved,true);assert.equal(h.controller.back(),false);await h.controller.plan();await h.controller.apply();await h.controller.start();assert.equal(h.count('apply'),1);assert.equal(h.count('plan'),1);await h.controller.recheck();assert.equal(h.controller.getSnapshot().disposition,'verified');assert.equal(h.controller.getSnapshot().unresolved,false);assert.equal(h.count('apply'),1);
});
test('partial apply without verified readback does not offer replay',async()=>{
  const h=harness({partial:true});await review(h);await h.controller.apply();assert.equal(h.controller.getSnapshot().unresolved,true);await h.controller.plan();assert.equal(h.count('plan'),1);await h.controller.recheck();assert.equal(h.controller.back(),true);assert.equal(h.count('apply'),1);
});
test('native external-edit refusal before write returns to fresh review',async()=>{
  const h=harness({reply:()=>({schema:'oi.setup/v1',disposition:'not_applied',write_started:false,reason:'Composition changed'})});await review(h);await h.controller.apply();assert.equal(h.controller.getSnapshot().unresolved,false);assert.match(h.controller.getSnapshot().error,/changed/);assert.equal(h.controller.back(),true);
});
test('missing, contradictory, foreign and invented success replies stay unknown',async()=>{
  const replies=[()=>({schema:'oi.setup/v1',disposition:'verified'}),()=>({schema:'oi.setup/v1',disposition:'not_applied'}),()=>({schema:'oi.setup/v1',disposition:'hosted_entry'}),()=>({schema:'oi.setup/v1',disposition:'all_good'}),(_r,j)=>({schema:'oi.setup/v1',disposition:'verified',journal:{...j,records:[{state:'unknown'}]}}),(_r,j)=>({schema:'oi.setup/v1',disposition:'verified',journal:{...j,plan:{...j.plan,review_token:'foreign'}}})];
  for(const reply of replies){const h=harness({reply});await review(h);await h.controller.apply();assert.equal(h.controller.getSnapshot().unresolved,true);assert.equal(h.controller.getSnapshot().disposition,'outcome_unknown');await h.controller.apply();assert.equal(h.count('apply'),1);}
});
test('foreign journal cannot resolve this lost reply',async()=>{
  const h=harness({lost:true});await review(h);await h.controller.apply();h.options.readback={schema:'oi.setup/v1',disposition:'verified',journal:{schema:'oi.adoption-journal/v1',plan:{...h.controller.getSnapshot().plan,review_token:'another'},records:[{state:'verified'}]}};await h.controller.recheck();assert.equal(h.controller.getSnapshot().unresolved,true);assert.match(h.controller.getSnapshot().error,/no longer names/);
});
test('process restart recovers the native unknown journal without invocation',async()=>{
  const h=harness({lost:true});await review(h);await h.controller.apply();const next=new AdoptionController(h.native,()=>100);await next.start();assert.equal(next.getSnapshot().unresolved,true);await next.apply();assert.equal(h.count('apply'),1);
});
test('Desktop preparation is explicit staging, not installation',async()=>{
  const h=harness();await review(h);await h.controller.prepareDesktop();assert.equal(h.controller.getSnapshot().plan,undefined);assert.equal(h.controller.getSnapshot().selection.bundle_sha256,'a'.repeat(64));assert.equal(h.count('apply'),0);
});
test('hosted reading can only finish the hosted no-local-effect plan',async()=>{
  const h=harness({reply:()=>({schema:'oi.setup/v1',disposition:'hosted_entry'})});await h.controller.start();h.controller.select({composition:'5/0'});await h.controller.plan();await h.controller.apply();assert.equal(h.controller.getSnapshot().disposition,'hosted_entry');assert.equal(h.controller.getSnapshot().unresolved,false);
});
test('production adapter uses fixed kernel operation and disconnected handler fails',async()=>{
  const calls=[];const native=createAdoptionNative(async op=>{calls.push(op);return {outcome:{result:'setup_reading',data:{schema:'oi.setup/v1'}}}});await native.request({action:'status'});assert.deepEqual(calls,[{op:'setup',request:{action:'status'}}]);await assert.rejects(createAdoptionNative(async()=>({outcome:null,error:'disconnected'})).request({action:'status'}),/disconnected/);await assert.rejects(createAdoptionNative(async()=>({outcome:{result:'other'}})).request({action:'status'}),/unavailable/);
});
