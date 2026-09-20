/** Controlled contracts over the existing C0 fixtures and production source
 * adapters. D/bridge evidence only: no machine, installed owner or H claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SetupFlowController, settingsOf, requestKey, validateRequest} from '../src/configuration/setupFlowController.ts';
import {createSetupNative} from '../src/configuration/setupNative.ts';
const fixture = name => JSON.parse(readFileSync(new URL(`../../../suite/configuration/cases/${name}.json`, import.meta.url), 'utf8'));
const contributions = ['contribution-ai-kit', 'contribution-oi'].map(name => fixture(name).contribution);
const partial = fixture('changeset-partial-apply');
const original = partial.lifecycle[0].changeset;
const model = structuredClone(original.requested[0]);
const verify = structuredClone(original.requested[1]);
const mounts = contributions.map(document => ({owner_ref: document.owner.owner_ref, document, availability: document.availability, composition: {standing:'in_composition'}}));
const settings = settingsOf(mounts);
const deferred = () => {let resolve, reject; const promise = new Promise((yes,no) => {resolve=yes;reject=no;}); return {promise,resolve,reject};};
function harness(requests = [model], options = {}) {
  const calls = [];
  let rows = requests.map(request => ({schema:'oi.config-resolution/v1',setting_ref:request.setting_ref,scope:request.scope,desired:null,native:{declared:{value:'old'},effective:{value:'old'},active:{value:'old'}},native_reading:{reading_digest:'fixture',observed_at_unix_ms:0},reconciliation:{status:'unknown',reason:null}}));
  const source = {
    kind:'fixture', label:'Controlled C0 fixtures',
    async readRegistry(){calls.push(['registry']); return {mounts:structuredClone(mounts),observed_at_unix_ms:0,composition:{requested_mode:null,install_mode:null,present_positions:[0,2],warnings:[]}};},
    async readResolutions(pairs){calls.push(['read',structuredClone(pairs)]); if(options.readError) throw Error('read unavailable'); return structuredClone(rows.filter(row => pairs.some(pair => requestKey(pair)===requestKey(row))));},
    async holdDesired(request){calls.push(['hold',structuredClone(request)]); if(options.holdErrorAt===calls.filter(call=>call[0]==='hold').length) throw Error('hold failed'); rows=rows.map(row=>requestKey(row)===requestKey(request)?{...row,desired:{value:request.value,secret_reference:request.secret_reference}}:row);},
    async plan(requests){calls.push(['plan',structuredClone(requests)]); if(options.planDeferred) return options.planDeferred.promise; return {plans:requests.map((request,index)=>({schema:'oi.config-plan/v1',plan_id:`plan-${index}`,plan_digest:`digest-${requestKey(request)}`,setting_ref:request.setting_ref,scope:request.scope,changes:[],expected_effect:settings[request.setting_ref].effect,expires_at_unix_ms:Date.now()+60_000})),errors:[]};},
    async apply(plans){calls.push(['apply',structuredClone(plans)]); if(options.applyDeferred) await options.applyDeferred.promise; if(options.applyUnknown) throw Error('lost reply'); if(options.failReadback) options.readError=true; return options.partial ? structuredClone(original) : {...structuredClone(original),requested:structuredClone(requests),operations:original.operations.filter(op=>requests.some(request=>requestKey(request)===requestKey(op))).map(op=>({...op,status:'verified',error:null})),status:'verified'};},
    async receipts(){calls.push(['receipts']); if(options.receiptError) throw Error('receipt read failed');return [];},
  };
  const controller = new SetupFlowController(source, structuredClone(requests), settings);
  return {controller,source,calls,options,rows:()=>rows,setRows:next=>{rows=next;},count:verb=>calls.filter(call=>call[0]===verb).length};
}
async function reviewed(h){await h.controller.start(true); assert.equal(h.controller.getSnapshot().step,'review');assert.equal(h.controller.canApply(),true);}
async function apply(h){h.controller.authorise(true);await h.controller.apply();}

test('discovery, edits, Back and Cancel do not write; draft survives', async()=>{
  const h=harness(); await h.controller.start();h.controller.continueToSettings();
  h.controller.setRequests([{...model,value:'opus'}]);h.controller.back();h.controller.cancel();
  assert.equal(h.controller.getSnapshot().requests[0].value,'opus');assert.equal(h.count('hold'),0);assert.equal(h.count('apply'),0);
});
test('StrictMode/re-entry starts one read/plan and never applies',async()=>{
  const h=harness();await Promise.all([h.controller.start(true),h.controller.start(true)]);await h.controller.start(true);
  assert.equal(h.count('registry'),1);assert.equal(h.count('plan'),1);assert.equal(h.count('apply'),0);
});
test('Cancel drops late planning response without discarding edited draft',async()=>{
  const waiting=deferred(),h=harness([model],{planDeferred:waiting});await h.controller.start();h.controller.continueToSettings();
  const pending=h.controller.plan();await new Promise(resolve=>setImmediate(resolve));h.controller.back();h.controller.setRequests([{...model,value:'opus'}]);
  waiting.resolve({plans:[],errors:[]});await pending;
  assert.equal(h.controller.getSnapshot().bundle,null);assert.equal(h.controller.getSnapshot().requests[0].value,'opus');assert.equal(h.count('apply'),0);
});
test('editing invalidates a reviewed plan and consent',async()=>{const h=harness();await reviewed(h);h.controller.authorise(true);h.controller.setRequests([{...model,value:'opus'}]);await h.controller.apply();assert.equal(h.count('apply'),0);assert.equal(h.controller.getSnapshot().bundle,null);});
test('incomplete/refused plan cannot silently apply its successful subset',async()=>{
  const h=harness([model,verify]);await reviewed(h);h.controller.getSnapshot().bundle.errors.push({schema:'oi.config-error/v1',error_code:'owner_unavailable',message:'controlled refusal'});await apply(h);assert.equal(h.count('hold'),0);assert.equal(h.count('apply'),0);
});
test('foreign scope, duplicate digest and expiry block apply',async()=>{
  for(const mutate of [bundle=>{bundle.plans[0].scope={scope_kind:'world',scope_ref:null};},bundle=>{bundle.plans[1].plan_digest=bundle.plans[0].plan_digest;},bundle=>{bundle.plans[0].expires_at_unix_ms=Date.now()-1;}]){
    const h=harness([model,verify]);await reviewed(h);mutate(h.controller.getSnapshot().bundle);await apply(h);assert.equal(h.count('hold'),0);assert.equal(h.count('apply'),0);
  }
});
test('double click is one authorised hold/apply/readback, with no implicit restart',async()=>{
  const wait=deferred(),h=harness([model],{applyDeferred:wait});await reviewed(h);h.controller.authorise(true);const pending=h.controller.apply();h.controller.authorise(true);const duplicate=h.controller.apply();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(h.controller.cancel(),false);wait.resolve();await Promise.all([pending,duplicate]);
  assert.equal(h.count('hold'),1);assert.equal(h.count('apply'),1);assert.equal(h.controller.getSnapshot().changeset.status,'verified');assert.equal(h.controller.getSnapshot().resolutions[0].native.active.value,'old');
  assert.deepEqual(h.calls.filter(call=>['hold','apply','receipts'].includes(call[0])).map(call=>call[0]),['hold','apply','receipts']);
});
test('native drift after review blocks all writes; freshness alone does not',async()=>{
  const h=harness();await reviewed(h);h.setRows(h.rows().map(row=>({...row,native:{...row.native,effective:{value:'external edit'}}})));await apply(h);assert.equal(h.count('hold'),0);assert.match(h.controller.getSnapshot().error,/changed after review/);
  const fresh=harness();await reviewed(fresh);fresh.setRows(fresh.rows().map(row=>({...row,native_reading:{reading_digest:'new',observed_at_unix_ms:42},native:{...row.native,effective:{value:'old',provenance:{observed_at_unix_ms:42}}}})));await apply(fresh);assert.equal(fresh.count('apply'),1);
});
test('partial intent hold is disclosed and does not invoke native apply',async()=>{
  const h=harness([model,verify],{holdErrorAt:2});await reviewed(h);await apply(h);assert.equal(h.count('apply'),0);assert.equal(h.controller.getSnapshot().held.length,1);assert.equal(h.controller.getSnapshot().outcomeUnknown,false);assert.equal(h.controller.retryableRequests().length,2);
});
test('receipt failure does not erase applied result or offer write retry',async()=>{
  const h=harness([model],{receiptError:true});await reviewed(h);await apply(h);assert.equal(h.controller.getSnapshot().changeset.status,'verified');assert.match(h.controller.getSnapshot().warnings.join(' '),/Receipt history/);assert.equal(h.controller.retryableRequests().length,0);await h.controller.readback();assert.equal(h.count('apply'),1);
});
test('failed post-apply readback retries reads only and keeps native result',async()=>{
  const h=harness([model],{failReadback:true});await reviewed(h);await apply(h);assert.equal(h.controller.getSnapshot().changeset.status,'verified');assert.equal(h.controller.getSnapshot().readbackComplete,false);h.options.readError=false;await h.controller.readback();assert.equal(h.controller.getSnapshot().readbackComplete,true);assert.equal(h.count('apply'),1);
});
test('existing partial-apply fixture retries only the explicit failed pair',async()=>{
  const h=harness([model,verify],{partial:true});await reviewed(h);await apply(h);assert.deepEqual(h.controller.retryableRequests(),[verify]);h.controller.prepareRetry();assert.deepEqual(h.controller.getSnapshot().requests,[verify]);assert.deepEqual(h.controller.getSnapshot().previousChangesets,[original.changeset_id]);await h.controller.plan();assert.deepEqual(h.calls.filter(call=>call[0]==='plan').at(-1)[1],[verify]);assert.equal(h.count('apply'),1);
});
test('missing readback scope blocks retry; same setting in another scope stays distinct',async()=>{
  const h=harness([model,verify],{partial:true});await reviewed(h);await apply(h);h.setRows(h.rows().filter(row=>row.setting_ref===model.setting_ref));await h.controller.readback();assert.equal(h.controller.getSnapshot().readbackComplete,false);assert.deepEqual(h.controller.retryableRequests(),[]);
  assert.notEqual(requestKey(model),requestKey({...model,scope:{scope_kind:'project',scope_ref:'another'}}));
});
test('lost apply response is unknown, never a failed write to replay',async()=>{
  const h=harness([model],{applyUnknown:true});await reviewed(h);await apply(h);assert.equal(h.controller.getSnapshot().outcomeUnknown,true);assert.deepEqual(h.controller.retryableRequests(),[]);h.controller.prepareRetry();await h.controller.plan();await h.controller.readback();assert.equal(h.count('apply'),1);assert.equal(h.count('plan'),1);
});
test('secret material is not retained or sent; sensitive non-secret specs refuse ordinary values',async()=>{
  const ref='ai-kit:providers:credentials.anthropic';
  const h=harness([{setting_ref:ref,scope:{scope_kind:'world',scope_ref:null},value:'DO-NOT-RETAIN',secret_reference:{ref:'aikit:credentials:anthropic-key'}}]);
  assert.equal(JSON.stringify(h.controller.getSnapshot()).includes('DO-NOT-RETAIN'),false);await reviewed(h);await apply(h);assert.equal(JSON.stringify(h.calls).includes('DO-NOT-RETAIN'),false);
  assert.match(validateRequest({...model,value:'literal'}, {...settings[model.setting_ref],sensitive:true}),/ordinary settings/);
});
test('read-only, absent and unknown composition cannot become mutable settings',async()=>{
  const request={setting_ref:'oi:composition:managed-root',scope:{scope_kind:'machine',scope_ref:null},value:'/new'};
  const h=harness([request]);await h.controller.start(true);assert.equal(h.count('plan'),0);assert.match(h.controller.getSnapshot().error,/Read-only/);
  for(const standing of ['absent','unknown']) {const h=harness();const read=h.source.readRegistry;h.source.readRegistry=async()=>{const reading=await read();reading.mounts[0].composition.standing=standing;return reading;};await h.controller.start(true);assert.equal(h.count('plan'),0);}
});
test('number validation does not truncate decimals or coerce blank to zero',()=>{
  const setting={...settings[model.setting_ref],value_schema:{type:'integer',minimum:0,maximum:10}};
  for(const value of ['',1.2,Infinity,-1,11]) assert.ok(validateRequest({...model,value},setting));
  assert.equal(validateRequest({...model,value:0},setting),null);
});
test('native picker/first action use public operations and preserve source identity',async()=>{
  const calls=[];const native=createSetupNative(async op=>{calls.push(op);return {outcome:op.op==='files_list'?{result:'directory_read',directory:{location:{path:'/ground'},entries:[]}}:op.op==='sources_list'?{result:'sources_listed',listing:{sources:[]}}:{result:'source_opened',buffer:{source_ref:op.source_ref,content:'owner source'}}};});
  await native.listDirectory('/ground');await native.listSources();await native.openSource('central:source:1');
  assert.deepEqual(calls,[{op:'files_list',path:'/ground',fresh:true},{op:'sources_list'},{op:'source_open',source_ref:'central:source:1'}]);
  await assert.rejects(createSetupNative(async()=>({outcome:{result:'source_opened',buffer:{source_ref:'other'}}})).openSource('wanted'),/does not match/);
  await assert.rejects(createSetupNative(async()=>({outcome:null,error:'disconnected'})).listSources(),/unavailable/);
});
test('production live source forwards plan, desired and apply through real typed handlers; disconnected handler cannot pass',async()=>{
  const {createLiveConfigPlaneSource} = await import('../src/configuration/liveSource.ts');
  const h=harness();const wire=[];
  const live=createLiveConfigPlaneSource(async op=>{
    wire.push(structuredClone(op));
    if(op.op==='config_registry_read') return {outcome:{result:'config_registry_reading',reading:await h.source.readRegistry()}};
    if(op.op==='config_resolutions_read') return {outcome:{result:'config_resolutions',resolutions:await h.source.readResolutions(op.pairs)}};
    if(op.op==='config_plan') return {outcome:{result:'config_planned',...await h.source.plan(op.requests)}};
    if(op.op==='config_desired_hold'){await h.source.holdDesired(op.request);return {outcome:{result:'config_desired_held',entry:{}}};}
    if(op.op==='config_apply') return {outcome:{result:'config_applied',changeset:await h.source.apply([])}};
    if(op.op==='config_receipts') return {outcome:{result:'config_receipts',document:{receipts:[]}}};
    throw Error(`Unexpected operation ${op.op}`);
  });
  const controller=new SetupFlowController(live,[model],settings);await controller.start(true);controller.authorise(true);await controller.apply();
  assert.equal(controller.getSnapshot().changeset.status,'verified');
  assert.deepEqual(wire.filter(op=>op.op==='config_apply')[0].requests,[{...model,secret_reference:null}]);
  assert.equal(wire.filter(op=>op.op==='config_apply').length,1);
  const disconnected=new SetupFlowController(createLiveConfigPlaneSource(async()=>({outcome:null,error:'disconnected'})),[model],settings);await disconnected.start(true);disconnected.authorise(true);await disconnected.apply();assert.equal(disconnected.canApply(),false);assert.match(disconnected.getSnapshot().error,/Discovery/);
});
