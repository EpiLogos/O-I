/** Explicit non-secret development specimens copied from native schemas, never auto-bound. */
import type { ChangeRequest, ChangeSetDocument, ConfigResolution, ContributionMount, PlanDocument, ScopeAddress, SettingSpec, SettingsAdapter } from './adapter'
import { displayValue, settingKey } from './model'
import { sourceSettings } from './catalogue'

export const scenarioNames = ['ready','loading','inherited','overridden','dirty','invalid','immediate','restart','pending','acknowledged','refused','failed','conflict','absent-product','unavailable-connection'] as const
export type DevelopmentScenario = typeof scenarioNames[number]
const machine: ScopeAddress = { scope_kind: 'machine', scope_ref: null }
export const specimenProject: ScopeAddress = { scope_kind: 'project', scope_ref: 'settings-specimen' }
// Reuse the current native descriptor capture verbatim; specimens supply values only.
function nativeSpecs(refs: string[]): SettingSpec[] {
  return refs.map(ref=>{const setting=sourceSettings.find(s=>s.setting_ref===ref);if(!setting)throw new Error(`Native specimen descriptor absent: ${ref}`);return setting})
}
export const agentSpecs=nativeSpecs([
  'ai-kit:resolution:resolution.profiles','ai-kit:skills:skills.capabilities',
  'ai-kit:resolution:skill-sets.default','ai-kit:models:models.default',
  'ai-kit:permissions:permissions.default-mode','ai-kit:models:models.credentials',
  'ai-kit:models:models.candidates',
])
export const telemetrySpecs=nativeSpecs([
  'software-factory:telemetry:search-limit-default','software-factory:telemetry:search-timeout-seconds',
  'software-factory:telemetry:watch-interval-seconds',
])

function mount(owner_ref: string, specs: SettingSpec[]): ContributionMount {
  return { owner_ref, availability:{state:'available',reason:null},error:null,document:{schema:'oi.configuration-contribution/v1',contract_revision:'development-specimen',owner:{owner_ref,owner_kind:'product',contribution_command:[]},sections:[...new Set(specs.map(s=>s.section_ref))].map(id=>({id,title:id,settings:specs.filter(s=>s.section_ref===id)})),operations:{transport:'development-only',validate:{availability:'available'},plan:{availability:'available'},apply:{availability:'available'},reset:{availability:'available'}},availability:{state:'available',reason:null}} }
}
export function developmentDrafts(scenario: DevelopmentScenario) {
  if (scenario === 'dirty' || scenario === 'invalid') return [{ setting_ref: telemetrySpecs[0].setting_ref,scope:specimenProject,raw:scenario === 'invalid' ? '12x' : '42' }]
  if (['pending','acknowledged','refused','failed','conflict','immediate'].includes(scenario)) return [{setting_ref:telemetrySpecs[2].setting_ref,scope:specimenProject,raw:'0.75'}]
  if (scenario === 'restart') return [{setting_ref:agentSpecs[0].setting_ref,scope:machine,raw:'specimen-profile-revised'}]
  return []
}
export function createDevelopmentSettingsAdapter(scenario: DevelopmentScenario): SettingsAdapter {
  const all = [...agentSpecs,...telemetrySpecs]
  const values = new Map<string,unknown>(); const resetKeys = new Set<string>(); let reads = 0; let revision = 1
  const requested = new Map<string,ChangeRequest>()
  const defaults: Record<string, unknown> = {
    [agentSpecs[0].setting_ref]:'specimen-profile', [agentSpecs[1].setting_ref]:{'specimen-capability':true},[agentSpecs[2].setting_ref]:['specimen-skill-set'],[agentSpecs[3].setting_ref]:{'specimen-harness':'specimen-model'},[agentSpecs[4].setting_ref]:{'specimen-harness':'default'},[agentSpecs[6].setting_ref]:'specimen-model',
    [telemetrySpecs[0].setting_ref]:20,[telemetrySpecs[1].setting_ref]:30,[telemetrySpecs[2].setting_ref]:1,
  }
  const resolution = (setting_ref:string,scope:ScopeAddress): ConfigResolution => {
    const key = settingKey(setting_ref,scope); const value=values.has(key)?values.get(key):defaults[setting_ref]
    const inherited = !values.has(key) && (resetKeys.has(key) || scenario === 'inherited' || scenario === 'ready')
    return {schema:'oi.config-resolution/v1',setting_ref,scope,desired:null,native:{...(!inherited?{declared:{value,provenance:{owner_ref:'development-specimen',path:'specimen://scope-override'}}}:{}),effective:{value,provenance:{owner_ref:'development-specimen',path:inherited?'specimen://inherited-native-source':'specimen://scope-override'}},active:{value:setting_ref===agentSpecs[0].setting_ref?'specimen-profile-previous':defaults[setting_ref],provenance:{owner_ref:'development-specimen',path:'specimen://observed-runtime'}}},native_reading:{reading_digest:`specimen-reading-${revision}`,observed_at_unix_ms:0},reconciliation:{status:setting_ref===agentSpecs[2].setting_ref?'unknown':'satisfied',reason:setting_ref===agentSpecs[2].setting_ref?'Native v2 disclosure axis is absent':null}}
  }
  const changeset = (plans:PlanDocument[],reset=false):ChangeSetDocument => ({schema:'oi.config-changeset/v1',changeset_id:`development-${scenario}-${revision}`,created_at_unix_ms:0,requested:plans.map(p=>requested.get(p.plan_digest)!).filter(Boolean),operations:plans.map((p,i)=>({op_id:`development-op-${i}`,depends_on:[],owner_ref:'development-specimen',setting_ref:p.setting_ref,scope:p.scope,kind:reset?'reset':'apply',plan_digest:p.plan_digest,status:scenario==='failed'?'failed':scenario==='pending'?'validated':'applied',receipt_ref:null,error:scenario==='failed'?{code:'owner_unavailable',message:'Development specimen: owner disconnected during apply.'}:null})),verification:null,status:scenario==='failed'?'failed':scenario==='pending'?'validated':'applied'})
  return { kind:'development',simulated:true,label:`${scenario} · AIKit and Factory native schema specimens`,ownerEpoch:`development-${scenario}`,canApply:true,
    scopeChoices:[{address:specimenProject,title:'Development specimen project'}],
    choices:(_s,column,row) => column==='harness'?[{value:'specimen-harness',title:'Specimen harness'}]:column==='mode'&&row.harness==='specimen-harness'?[{value:'default',title:'Default (advertised specimen)'}]:null,
    readRegistry:async()=>{ if(scenario==='loading') await new Promise(()=>{}); const mounts=[mount('ai-kit',agentSpecs),mount('software-factory',telemetrySpecs)]; if(scenario==='absent-product') mounts[1]={owner_ref:'software-factory',document:null,availability:{state:'unavailable',reason:'Development specimen: product is not installed.'},error:null}; if(scenario==='unavailable-connection') mounts[0].availability={state:'unavailable',reason:'Development specimen: native connection unavailable.'}; return {mounts,observed_at_unix_ms:0,composition:null} },
    readResolutions:async pairs=>{ reads++; if(scenario==='conflict'&&reads===2) revision++; return pairs.map(p=>resolution(p.setting_ref,p.scope)) },
    plan:async requests=> { if(scenario==='refused')return {plans:[],errors:[{schema:'oi.config-error/v1',error_code:'not_authorised',message:'Development specimen: native owner refused this change.',retryable:false}]}; const plans=requests.map((request,i):PlanDocument=>{const digest=`development-plan-${revision}-${i}`;requested.set(digest,request);return {schema:'oi.config-plan/v1',plan_id:digest,plan_digest:digest,setting_ref:request.setting_ref,scope:request.scope,changes:[{summary:`Proposed ${displayValue(request.value)} · development simulation`}],expected_effect:all.find(s=>s.setting_ref===request.setting_ref)!.effect} }); return {plans,errors:[]} },
    apply:async plans=>{ const response=changeset(plans); if(response.status==='applied'){for(const p of plans){const key=settingKey(p.setting_ref,p.scope);values.set(key,requested.get(p.plan_digest)?.value);resetKeys.delete(key)}revision++} return response },
    reset:async basis=>{if(scenario==='refused')throw new Error('Development specimen: native owner refused this reset.');const p:PlanDocument={schema:'oi.config-plan/v1',plan_id:'development-reset',plan_digest:'development-reset',setting_ref:basis.setting_ref,scope:basis.scope,changes:[{summary:'Remove specimen override'}],expected_effect:all.find(s=>s.setting_ref===basis.setting_ref)!.effect};const response=changeset([p],true);if(response.status==='applied'){const key=settingKey(basis.setting_ref,basis.scope);values.delete(key);resetKeys.add(key);revision++}return response},
  }
}
