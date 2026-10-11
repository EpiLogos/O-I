import test from 'node:test'
import assert from 'node:assert/strict'
import { validateMachine, machineBasis, connectionBasis } from './machines.ts'
import { eligibleProofs, authorityAllowsTrigger, routineBasis, scheduleFromInput } from './routines.ts'

const declaration={label:'test-cell',endpoint:'localhost:7777',credential_ref:'keychain://workcell-connection/test-cell',operations:['status'],note:null}
const operations=['status','discover','plan','prepare','inspect','recover','observe','expose','collect','release','reconcile','system']
test('remote setup validates native label, endpoint, secret-reference and operation semantics',()=>{
  assert.deepEqual(validateMachine(declaration,operations,[]),{})
  assert.deepEqual(validateMachine({...declaration,endpoint:'[::1]:7777'},operations,[]),{})
  for(const label of ['grants',' bad','a/b',''])assert.ok(validateMachine({...declaration,label},operations,[]).label)
  for(const endpoint of ['host','host:0','host:65536','host:1.5','host :7777'])assert.ok(validateMachine({...declaration,endpoint},operations,[]).endpoint)
  assert.ok(validateMachine({...declaration,credential_ref:'unqualified-reference'},operations,[]).credential_ref)
  assert.ok(validateMachine({...declaration,operations:['ssh']},operations,[]).operations)
  assert.ok(validateMachine(declaration,operations,[declaration]).label)
})
test('machine basis detects setup drift without depending on read order',()=>{
  const second={...declaration,label:'second',operations:['status','prepare']}
  assert.equal(machineBasis([declaration,second]),machineBasis([{...second,operations:['prepare','status']},declaration]))
  assert.notEqual(machineBasis([declaration]),machineBasis([{...declaration,endpoint:'localhost:8888'}]))
  assert.notEqual(connectionBasis(),connectionBasis({connection_ref:'connection/test-cell',label:'test-cell',endpoint:'localhost:7777',state:'disconnected',last_reconciled_at_unix_ms:1,granted_operations:[]}))
})
const authority={authority_ref:'authority:test',granted:true,unattended:false,action_refs:['action:test']}
test('manual and unattended triggers use the native authority rule',()=>{
  assert.equal(authorityAllowsTrigger(authority,{kind:'manual'}),true)
  assert.equal(authorityAllowsTrigger(authority,{kind:'event',event_ref:'event:test'}),false)
  assert.equal(authorityAllowsTrigger({...authority,unattended:true},{schema:'aikit.time-schedule/v1',schedule_ref:'schedule/test',schedule:{kind:'daily',time:'06:00'}}),true)
  assert.equal(authorityAllowsTrigger({...authority,granted:false,unattended:true},{kind:'manual'}),false)
})
test('proof selection preserves exact Method identity and revision',()=>{
  const options={proofs:[{title:'Verified run',document:{proof_ref:'proof:test',method:'method/test',method_revision:'revision:1'}}]}
  assert.equal(eligibleProofs(options,'method/test','revision:1').length,1)
  assert.equal(eligibleProofs(options,'method/other').length,0)
  assert.equal(eligibleProofs(options,'method/test','revision:2').length,0)
})
test('routine conflicts track durable native state, not shifting occurrence horizons',()=>{
  const routine={routine:'routine/test',revision:'revision:1',method:'method/test',method_revision:'revision:1',state:'enabled',trigger:{kind:'schedule',schedule_ref:'schedule/test'},proof:{proof_ref:'proof:test'},authority,scheduler:{provider:'provider:aikit-gateway',observed_state:'active'}}
  assert.equal(routineBasis({...routine,next_occurrences:{occurrences:[1]}}),routineBasis({...routine,next_occurrences:{occurrences:[2]}}))
  assert.notEqual(routineBasis(routine),routineBasis({...routine,state:'disabled'}))
})

test('schedule entry preserves the native grammar and exact millisecond intervals',()=>{
 assert.deepEqual(scheduleFromInput('daily','23:59'),{kind:'daily',time:'23:59'})
 assert.deepEqual(scheduleFromInput('every','0.75'),{kind:'every',interval_ms:750})
 assert.deepEqual(scheduleFromInput('every','1.001'),{kind:'every',interval_ms:1001})
 assert.deepEqual(scheduleFromInput('cron','0 6 * * *'),{kind:'cron',expression:'0 6 * * *'})
 assert.deepEqual(scheduleFromInput('once','2026-10-09T06:00:00+01:00'),{kind:'once',rfc3339:'2026-10-09T06:00:00+01:00'})
 for(const [kind,value] of [['daily','25:00'],['every','12x'],['every','0'],['every','0.0001'],['cron','0 6 * *'],['once','2026-02-30T06:00:00Z'],['once','2026-10-09T24:00:00Z'],['once','2026-10-09T06:00:00']])assert.throws(()=>scheduleFromInput(kind,value))
})
