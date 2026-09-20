from pathlib import Path
root=Path('.')
def edit(path,old,new):
 p=root/path;s=p.read_text();assert s.count(old)==1,(path,old,s.count(old));p.write_text(s.replace(old,new))
def write(path,s):
 p=root/path;p.parent.mkdir(parents=True,exist_ok=True);assert not p.exists();p.write_text(s)
b='desktop/cradle/'
edit(b+'kernel/src/agency.rs','("agent-session-scope", None) |','("agent-session-scope", None) |\n            ("agent-session-skills", None) |')
edit(b+'kernel/src/agent_definition.rs','    Roster,','    Roster,\n    Scope,\n    Skills,')
edit(b+'kernel/src/agent_definition.rs','        Request::Roster => owner(client, "agent-profile.roster", input),','''        Request::Roster => owner(client, "agent-profile.roster", input),
        Request::Scope => aikit.direct_agent(cwd, "agent-session-scope", None),
        Request::Skills => aikit.direct_agent(cwd, "agent-session-skills", None),''')
edit(b+'kernel/src/agent_definition.rs','''                validate_prepared(&prepared, None, request_id)?;
                verify_attachment(aikit, cwd, &prepared)?;''','''                validate_preparation(&prepared, None, request_id, true)?;
                if prepared["prepared"] == true {
                    verify_attachment(aikit, cwd, &prepared)?;
                } else {
                    verify_scope(aikit, cwd, &prepared)?;
                }''')
edit(b+'kernel/src/agent_definition.rs','''    if value["schema"] != "aikit.direct-agent-session/v1"
        || value["prepared"] != true''','''    validate_preparation(value, profile, request_id, false)
}
fn validate_preparation(value: &Value, profile: Option<&str>, request_id: &str, allow_partial: bool) -> Result<(), String> {
    let legitimate_partial = allow_partial && value["prepared"] == false && value["resume_preparation_allowed"] == true;
    if value["schema"] != "aikit.direct-agent-session/v1"
        || (value["prepared"] != true && !legitimate_partial)''')
edit(b+'kernel/src/agent_definition.rs','''fn verify_attachment(aikit: &agency::Client, cwd: &Path, prepared: &Value) -> Result<(), String> {
    let scope''','''fn verify_scope(aikit: &agency::Client, cwd: &Path, prepared: &Value) -> Result<(), String> {
    let scope''')
edit(b+'kernel/src/agent_definition.rs','''    let rows = aikit.read_project(''','''    Ok(())
}
fn verify_attachment(aikit: &agency::Client, cwd: &Path, prepared: &Value) -> Result<(), String> {
    verify_scope(aikit, cwd, prepared)?;
    let rows = aikit.read_project(''')
write(b+'src/agency/nativeAgentReadiness.ts','''/** Read-only native prerequisites. A catalogue row is not activation evidence. */
export interface NativeAgentScope {
 schema: "aikit.direct-agent-scope/v1"; project_ref: string;
 world_readiness: {ready: boolean; world_ref?: string; owner?: string; action?: string; reason?: string};
 execution_authority_granted: false; provider_started: false;
}
export interface NativeAgentSkill {ref: string; name: string; description: string; revision: unknown; source: unknown; eligible: boolean; reason_code: string | null}
function object(v: unknown): Record<string,unknown> {
 if (!v || typeof v !== "object" || Array.isArray(v)) throw Error("Unreadable native prerequisite response");
 return v as Record<string,unknown>;
}
export function readAgentScope(value: unknown): NativeAgentScope {
 const v=object(value), w=object(v.world_readiness);
 if(v.schema!=="aikit.direct-agent-scope/v1" || typeof v.project_ref!=="string" || !v.project_ref
   || v.execution_authority_granted!==false || v.provider_started!==false || typeof w.ready!=="boolean"
   || (w.ready && (typeof w.world_ref!=="string" || !w.world_ref))) throw Error("Native World readiness is absent or incompatible; no launch is implied");
 return value as NativeAgentScope;
}
export function readAgentSkills(value: unknown): NativeAgentSkill[] {
 const v=object(value);
 if(v.schema!=="aikit.direct-agent-skills/v1" || v.activation_performed!==false
   || v.brokered_child_activation_observed!==false || !Array.isArray(v.rows) || v.rows.length>10000) throw Error("Native effective Skill discovery is unavailable");
 const seen=new Set<string>();
 return v.rows.map(value=>{
  const r=object(value);
  if(typeof r.ref!=="string" || !r.ref.startsWith("skill/") || r.ref.length>1024 || seen.has(r.ref)
    || typeof r.name!=="string" || typeof r.description!=="string" || typeof r.eligible!=="boolean"
    || (r.reason_code!==null && typeof r.reason_code!=="string")) throw Error("Malformed or duplicate native Skill reading");
  seen.add(r.ref);return r as unknown as NativeAgentSkill;
 });
}
''')
edit(b+'src/agency/nativeAgent.ts','export interface AgentDraftInput','import {readAgentScope,readAgentSkills,type NativeAgentScope,type NativeAgentSkill} from "./nativeAgentReadiness.ts";\nexport interface AgentDraftInput')
edit(b+'src/agency/nativeAgent.ts',' | {action: "roster"}',' | {action: "roster" | "scope" | "skills"}')
edit(b+'src/agency/nativeAgent.ts',' busy: boolean; error?: string;',' world?: NativeAgentScope; skills?: NativeAgentSkill[]; readinessError?: string; readinessPending?: boolean;\n busy: boolean; error?: string;')
edit(b+'src/agency/nativeAgent.ts',' private generation = 0;',' private generation = 0;\n private readinessGeneration = 0;')
edit(b+'src/agency/nativeAgent.ts',' refresh = async () => {',''' refreshReadiness = async () => {
  const generation=++this.readinessGeneration;
  this.set({readinessPending:true,world:undefined,skills:undefined,readinessError:undefined});
  const results=await Promise.allSettled([this.owner({action:"scope"}),this.owner({action:"skills"})]);
  if(generation!==this.readinessGeneration)return;
  const errors:string[]=[]; let world:NativeAgentScope|undefined,skills:NativeAgentSkill[]|undefined;
  try {if(results[0].status==="rejected")throw results[0].reason;world=readAgentScope(results[0].value);}catch(e){errors.push(String(e));}
  try {if(results[1].status==="rejected")throw results[1].reason;skills=readAgentSkills(results[1].value);}catch(e){errors.push(String(e));}
  this.set({world,skills,readinessPending:false,readinessError:errors.length?errors.join("; "):undefined});
 };
 refresh = async () => {''')
edit(b+'src/agency/nativeAgent.ts','''  this.set({busy:true,error:undefined});
  try {
   const review = validateReview(await this.owner({action:"propose"''','''  if (draft.skillRefs.some(ref=>!this.state.skills?.some(row=>row.ref===ref&&row.eligible))) {
   this.set({error:"A selected Skill is not currently eligible. Re-read the native catalogue and explicitly repair or remove that selection."});return;
  }
  this.set({busy:true,error:undefined});
  try {
   const review = validateReview(await this.owner({action:"propose"''')
edit(b+'src/agency/nativeAgent.ts','''   if (review.accepted || review.profile.name !== draft.name || review.profile.intent_provenance?.intent_expression !== draft.purpose)''','''   if (review.accepted || review.profile.name !== draft.name || review.profile.intent_provenance?.intent_expression !== draft.purpose
       || JSON.stringify(review.profile.skill_refs??[])!==JSON.stringify(draft.skillRefs))''')
edit(b+'src/agency/nativeAgent.ts','''export function validatePrepared(value: unknown, review: NativeReview, requestId: string): NativePrepared {
 const p = record(value);''','''export function validatePrepared(value: unknown, review: NativeReview, requestId: string): NativePrepared {
 const p=validatePreparationBasis(value,review,requestId);
 if(p.prepared!==true)throw Error("Native session preparation is not complete");
 return value as NativePrepared;
}
export function validatePartialPreparation(value: unknown, review: NativeReview, requestId: string): void {
 const p=validatePreparationBasis(value,review,requestId);
 if(p.prepared!==false||p.resume_preparation_allowed!==true)throw Error("Native preparation is not explicitly continuable");
}
function validatePreparationBasis(value: unknown, review: NativeReview, requestId: string): Record<string,unknown> {
 const p = record(value);''')
edit(b+'src/agency/nativeAgent.ts','p.schema !== "aikit.direct-agent-session/v1" || p.prepared !== true || p.provider_started !== false','p.schema !== "aikit.direct-agent-session/v1" || p.provider_started !== false')
edit(b+'src/agency/nativeAgent.ts',''' return value as NativePrepared;
}
export class NativeAgentController''',''' return p;
}
export class NativeAgentController''')
edit(b+'src/agency/nativeAgent.ts','''   } else this.set({prepared:validatePrepared(result,review,requestId),unknown:undefined});''','''   } else if(record(result).prepared===false) {
    validatePartialPreparation(result,review,requestId);
    this.set({unknown:undefined,prepared:undefined,error:"Native preparation is incomplete. Continue explicitly using this same retained request; no provider was started."});
   } else this.set({prepared:validatePrepared(result,review,requestId),unknown:undefined});''')
edit(b+'src/agency/agentSetup.ts','export interface AgentSetupTarget {project?:string;reason:string;','''export type AgentSetupTopic="world"|"acceptance"|"harness"|"credentials"|"skills";
export interface AgentSetupDestination {owner:"central"|"ai-kit"|"actuation";topic:AgentSetupTopic;nativeAction?:string;settingRef?:string}
export interface AgentSetupTarget {project?:string;destination?:AgentSetupDestination;reason:string;''')
edit(b+'src/agency/agentSetup.ts',' target=next;announce();',' target={...next,destination:next.destination??{owner:"ai-kit",topic:"harness"}};announce();')
edit(b+'src/agency/AgentSetupReturn.tsx','<p className="oi-note">{target.reason}</p>','''<p className="oi-note">{target.reason}</p><p className="oi-note" data-agent-setup-target={target.destination?.topic}>Native destination: {target.destination?.owner} → {target.destination?.topic}{target.destination?.nativeAction&&<> · <code>{target.destination.nativeAction}</code></>}</p>''')
edit(b+'src/workspace/settings/v2/SettingsHome.tsx','export function SettingsHome({census}: {census?: CompositionReading}) {','export function SettingsHome({census,target}: {census?: CompositionReading;target?: {owner:string;topic:string;settingRef?:string}}) {')
edit(b+'src/workspace/settings/v2/SettingsHome.tsx','  const [query, setQuery] = useState("");','''  const [query, setQuery] = useState("");
  useEffect(()=>{
    if(!target)return;
    setPanel({kind:"owner",ownerRef:target.owner});
    // Filter actual owner disclosures. No setting or credential is fabricated.
    setQuery(`@owner:${target.owner}${target.settingRef?` ${target.settingRef}`:target.topic==="credentials"?" @secret":""}`);
  },[target]);''')
edit(b+'src/workspace/settings/v2/SettingsPageV2.tsx','agentSetupSnapshot()?"system":"settings"','"settings"')
edit(b+'src/workspace/settings/v2/SettingsPageV2.tsx','''  useEffect(()=>{const target=()=>setView("system");window.addEventListener(AGENT_SETUP_EVENT,target);return()=>window.removeEventListener(AGENT_SETUP_EVENT,target);},[]);''','''  const [agentTarget,setAgentTarget]=useState(agentSetupSnapshot()?.destination);
  useEffect(()=>{const target=()=>{setAgentTarget(agentSetupSnapshot()?.destination);setView("settings");};window.addEventListener(AGENT_SETUP_EVENT,target);return()=>window.removeEventListener(AGENT_SETUP_EVENT,target);},[]);''')
edit(b+'src/workspace/settings/v2/SettingsPageV2.tsx','<SettingsHome census={reading}/>','<SettingsHome census={reading} target={agentTarget}/>')
edit(b+'src/agency/NativeAgentLauncher.tsx',' useEffect(()=>{void controller.refresh();},[controller]);',''' const refresh=async()=>{await controller.refresh();await controller.refreshReadiness();};
 useEffect(()=>{void refresh();},[controller]);''')
edit(b+'src/agency/NativeAgentLauncher.tsx','onClick={()=>void controller.refresh()}>Read native roster','onClick={()=>void refresh()}>Read native roster')
edit(b+'src/agency/NativeAgentLauncher.tsx','''   {draft.skillRefs.length>0&&<p className="oi-note">Selected native Skills: {draft.skillRefs.join(", ")}</p>}''','''   <fieldset className="oi-section" disabled={state.readinessPending} aria-label="Native effective Skills"><legend>Skills for this Agent</legend>
    {state.skills?.length===0&&<p className="oi-note">No native Skills are currently disclosed for this scope.</p>}
    {state.skills?.map(skill=><label key={skill.ref} className="oi-field"><input type="checkbox" aria-label={`Skill ${skill.name}`} checked={draft.skillRefs.includes(skill.ref)} disabled={!skill.eligible&&!draft.skillRefs.includes(skill.ref)} onChange={e=>controller.edit({skillRefs:e.target.checked?[...draft.skillRefs,skill.ref]:draft.skillRefs.filter(ref=>ref!==skill.ref)})}/>{skill.name} <span className="oi-note">{skill.description}{!skill.eligible&&` — unavailable: ${skill.reason_code??"native eligibility not established"}`}</span></label>)}
    {draft.skillRefs.filter(ref=>!state.skills?.some(row=>row.ref===ref)).map(ref=><label key={ref}><input type="checkbox" checked onChange={()=>controller.edit({skillRefs:draft.skillRefs.filter(r=>r!==ref)})}/>Unavailable selection: {ref}</label>)}
    <p className="oi-note">Discovery is not activation. Exact effective bytes are checked at preparation and sent to the parent session. Brokered children require separate admission.</p>
   </fieldset>''')
edit(b+'src/agency/NativeAgentLauncher.tsx','disabled={state.busy||!!state.unknown} onClick={()=>void controller.prepare()}','disabled={state.busy||!!state.unknown||state.world?.world_readiness.ready!==true} onClick={()=>void controller.prepare()}')
edit(b+'src/agency/NativeAgentLauncher.tsx','  {(state.error||openError)&&','''  {state.world&&<p className="oi-note" role="status">{state.world.world_readiness.ready?`Native World: ${state.world.world_readiness.world_ref}`:state.world.world_readiness.reason??"A native World declaration is required before session preparation."}</p>}
  {state.readinessError&&<p className="oi-note" role="status">{state.readinessError}</p>}
  {state.world?.world_readiness.ready===false&&<button className="oi-action" onClick={()=>openAgentSetup({project,destination:{owner:"central",topic:"world",nativeAction:state.world?.world_readiness.action},reason:state.world?.world_readiness.reason??"Review the native World declaration",refresh})}>Review native World setup</button>}
  {(state.error||openError)&&''')
edit(b+'src/agency/NativeAgentLauncher.tsx','openAgentSetup({project,reason:state.error??openError??"Agent, harness or credential setup",refresh:()=>controller.refresh()})','openAgentSetup({project,destination:review&&!review.accepted?{owner:"central",topic:"acceptance",nativeAction:"agent-profile.accept"}:{owner:"ai-kit",topic:"harness"},reason:state.error??openError??"Agent, harness or credential setup",refresh})')
edit(b+'src/agent/chat/AgentChat.tsx','openAgentSetup({project:state.project||undefined,reason:','openAgentSetup({project:state.project||undefined,destination:{owner:"ai-kit",topic:"harness"},reason:')
edit(b+'tests/agent-native-creation-browser.tsx'," if(request.action==='roster')",""" if(request.action==='scope')return {schema:'aikit.direct-agent-scope/v1',project_ref:'control:root',world_readiness:{ready:true,world_ref:'control:root'},provider_started:false,execution_authority_granted:false};
 if(request.action==='skills')return {schema:'aikit.direct-agent-skills/v1',rows:[{ref:'skill/test/reader',name:'Native reader',description:'Reads the selected source.',revision:'r1',source:null,eligible:true,reason_code:null},{ref:'skill/test/disabled',name:'Disabled native skill',description:'Unavailable source.',revision:'r1',source:null,eligible:false,reason_code:'skill.disabled'}],activation_performed:false,brokered_child_activation_observed:false};
 if(request.action==='roster')""")
edit(b+'tests/agent-native-creation-browser.tsx',"if(request.action==='propose'){stored=true;return review();}","if(request.action==='propose'){stored=true;Object.assign(profile,{skill_refs:request.skill_refs});return review();}")
edit(b+'tests/agent-native-creation-browser.mjs',"const checkbox=page.getByRole('checkbox');await checkbox.check();","const checkbox=page.getByRole('checkbox',{name:/I choose the disclosed native scope/});await checkbox.check();\n await page.getByRole('checkbox',{name:'Skill Native reader',exact:true}).check();\n assert.equal(await page.getByRole('checkbox',{name:'Skill Disabled native skill',exact:true}).isDisabled(),true);")
edit(b+'tests/agent-native-creation-browser.mjs',"c=>c.action!=='roster'","c=>!['roster','scope','skills'].includes(c.action)")
edit(b+'tests/agent-native-creation-browser.mjs',"checks.push('Native proposal is reviewed before any acceptance or session preparation.');","assert.deepEqual(await page.evaluate(()=>window.creation.calls.find(c=>c.action==='propose').skill_refs),['skill/test/reader']);\n checks.push('The actual native Skill catalogue constrains selectable context; selected references survive proposal and exact review before any acceptance or launch.');")
