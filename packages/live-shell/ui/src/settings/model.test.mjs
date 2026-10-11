import test from 'node:test'
import assert from 'node:assert/strict'
import { acknowledgeDrafts, allowedScope, basisChanged, categoryOf, createDraft, draftOwnerChanged, initialScope, rawValue, searchSettings, settingKey, validateDraft } from './model.ts'
import { readFileSync } from 'node:fs'
const nativeSettings=JSON.parse(readFileSync(new URL('./native-inventory.capture.json',import.meta.url),'utf8')).settings

const scope = { scope_kind:'project',scope_ref:'actual-project' }
const spec = { setting_ref:'software-factory:telemetry:watch-interval-seconds',title:'Watch interval',description:'Interval between telemetry reads, in seconds',section_ref:'telemetry',native_ref:'software-factory:telemetry-config',value_schema:{type:'number',minimum:0.5,maximum:60},allowed_scopes:[{scope_kind:'project',scope_ref:null}] }
const resolution = {setting_ref:spec.setting_ref,scope,native_reading:{reading_digest:'native-a'}}
test('exact numeric entry rejects trailing text, incomplete notation, overflow and out-of-range values',()=>{
  for(const input of ['12x','1e','', 'Infinity','1e999','0.49','60.1']) assert.ok(validateDraft(spec,input).error,input)
  assert.deepEqual(validateDraft(spec,'0.75'),{value:0.75,error:null})
  assert.deepEqual(validateDraft(spec,'1e1'),{value:10,error:null})
})
test('integer settings preserve exactness instead of parseInt truncation',()=>{
  const integer={...spec,value_schema:{type:'integer'}}
  for(const input of ['1.1','9007199254740993','13abc','1.0000000000000001','9007199254740991.1']) assert.ok(validateDraft(integer,input).error)
  assert.equal(validateDraft(integer,'42').value,42)
  assert.equal(validateDraft(integer,'1.2e1').value,12)
})
test('non-singular scopes require an actual subject; no project is fabricated',()=>{
  assert.equal(initialScope(spec,[]),null)
  assert.deepEqual(initialScope(spec,[{address:scope}]),scope)
  assert.equal(allowedScope(spec,{scope_kind:'machine',scope_ref:null}),false)
  assert.equal(allowedScope(spec,{scope_kind:'project',scope_ref:null}),false)
  assert.equal(allowedScope({...spec,allowed_scopes:[{scope_kind:'project',scope_ref:'allowed'}]},scope),false)
})
test('search reaches exact native settings through familiar task synonyms',()=>{
  const entries=[{spec,owner:'software-factory',available:true,reason:null}]
  assert.equal(searchSettings(entries,'polling frequency')[0].spec.setting_ref,spec.setting_ref)
  assert.equal(searchSettings(entries,'watch-interval-seconds').length,1)
  assert.equal(searchSettings(entries,'api credential').length,0)
})
test('scope keys keep drafts for two subjects separate',()=>{
  assert.notEqual(settingKey(spec.setting_ref,scope),settingKey(spec.setting_ref,{...scope,scope_ref:'other'}))
})
test('editing against a new reading preserves the original draft basis',()=>{
  const first=createDraft(spec,'2',resolution)
  const edited=createDraft(spec,'3',{...resolution,native_reading:{reading_digest:'native-b'}},first)
  assert.equal(edited.basis,'native-a')
  assert.equal(edited.version,2)
  assert.equal(basisChanged(edited,{...resolution,native_reading:{reading_digest:'native-b'}}),true)
})
test('acknowledgement clears only the submitted version and successful scope',()=>{
  const a=settingKey(spec.setting_ref,scope),b=settingKey(spec.setting_ref,{...scope,scope_ref:'other'})
  const submitted={[a]:createDraft(spec,'2',resolution),[b]:createDraft(spec,'3',resolution)}
  const newer={...submitted,[a]:{...submitted[a],version:2,raw:'4',value:4}}
  const retained=acknowledgeDrafts(newer,submitted,[a])
  assert.equal(retained[a].value,4);assert.ok(retained[b])
  const acknowledged=acknowledgeDrafts(submitted,submitted,[a])
  assert.equal(acknowledged[a],undefined);assert.ok(acknowledged[b])
})
test('native two-column table representation round-trips without a JSON editor',()=>{
  const table={...spec,value_schema:{type:'table',columns:[{name:'capability',type:'scalar'},{name:'enabled',type:'boolean'}]}}
  const raw=rawValue(table,{'real-capability':false})
  assert.deepEqual(raw,[{capability:'real-capability',enabled:false}])
  assert.deepEqual({...validateDraft(table,raw,'map').value},{'real-capability':false})
  assert.ok(validateDraft(table,[...raw,...raw],'map').error)
  assert.ok(validateDraft(table,[{capability:'',enabled:true}]).error)
})
test('numeric collections keep native numbers and native table representation',()=>{
  const table={...spec,value_schema:{type:'table',columns:[{name:'key',type:'scalar'},{name:'amount',type:'number'}]}}
  assert.deepEqual(validateDraft(table,[{key:'limit',amount:'3.5'}]).value,[{key:'limit',amount:3.5}])
  assert.deepEqual({...validateDraft(table,[{key:'limit',amount:'3.5'}],'map').value},{limit:3.5})
  assert.deepEqual(validateDraft(table,[{key:'limit',amount:'3.5'}],'record').value,{key:'limit',amount:3.5})
  assert.deepEqual(validateDraft({...spec,value_schema:{type:'list',items:{type:'integer'}}},['2']).value,[2])
})
test('secret schema never admits a material value as a configuration draft',()=>{
  assert.equal(validateDraft({...spec,value_schema:{type:'secret'}},'non-secret-specimen').value,undefined)
  assert.match(validateDraft({...spec,value_schema:{type:'secret'}},'non-secret-specimen').error,/credential editor/)
})
test('the source census has unique native identities and every setting has a placement',()=>{
  assert.equal(nativeSettings.length,50)
  assert.equal(new Set(nativeSettings.map(s=>s.setting_ref)).size,50)
  for(const spec of nativeSettings)assert.ok(categoryOf({spec,owner:spec.owner_ref,available:false,reason:null}),spec.setting_ref)
  for(const ref of ['ai-kit:local-services:decision.provider','ai-kit:local-services:now.redis'])assert.equal(categoryOf({spec:nativeSettings.find(s=>s.setting_ref===ref)}),'execution')
})
test('captured native capability schema round trips actual map value types',()=>{
  const spec=nativeSettings.find(s=>s.setting_ref==='ai-kit:skills:skills.capabilities')
  const value={'skill/personal/ralph-tui-create-beads-rust':false}
  assert.deepEqual({...validateDraft(spec,rawValue(spec,value),'map').value},value)
})
test('captured Central standing schema uses the native active/retired vocabulary',()=>{
  const spec=nativeSettings.find(s=>s.setting_ref==='central:skills:central.skills')
  assert.equal(validateDraft(spec,[{skill:'engineering-methodology',standing:'active'}]).error,null)
  assert.equal(validateDraft(spec,[{skill:'engineering-methodology',standing:'retired'}]).error,null)
  assert.ok(validateDraft(spec,[{skill:'engineering-methodology',standing:'enabled'}]).error)
})
test('captured service table preserves nested arguments and readiness without string coercion',()=>{
  const spec=nativeSettings.find(s=>s.setting_ref==='workcell:processes-services:services.declared')
  const row=Object.fromEntries(spec.value_schema.columns.map(c=>[c.name,c.type==='list'?'["--read-only"]':c.type==='table'?'{"probe":"read"}':'source-test']))
  const result=validateDraft(spec,[row])
  assert.equal(result.error,null)
  assert.deepEqual(result.value[0].args,['--read-only'])
  assert.deepEqual(result.value[0].readiness,{probe:'read'})
})
test('captured Factory numbers enforce the real descriptor limits',()=>{
  const spec=nativeSettings.find(s=>s.setting_ref==='software-factory:telemetry:search-timeout-seconds')
  assert.equal(spec.title,'Delegated search subprocess budget (seconds)')
  assert.equal(validateDraft(spec,'5').value,5)
  assert.equal(validateDraft(spec,'600').value,600)
  assert.ok(validateDraft(spec,'4.999').error)
  assert.ok(validateDraft(spec,'600.001').error)
})
test('owner epoch changes require explicit rebase, including initially unqualified drafts',()=>{
  const draft=createDraft(spec,'2',resolution)
  assert.equal(draftOwnerChanged(draft,'qualified-native-owner'),true)
  assert.equal(draftOwnerChanged({...draft,ownerEpoch:'native-a'},'native-a'),false)
  assert.equal(draftOwnerChanged({...draft,ownerEpoch:'native-a'},'native-b'),true)
})
