/** The agents on this machine are the census (the World Model's agents, O-I #1003): one card per agent, whether it starts, with
 * AIKit's client facts (installed, its folder, sign-in) as that card's detail, never as rows of their own. */
import {Refusal, refusalWords} from "../../../shared/Refusal";
import {useEffect,useState} from "react";
import {shapeHarnessClients,type HarnessRow,type ProviderRow} from "../../../configuration/harnessSource";
import {agentName,censusConnections,useCensus,type CensusAgent} from "../../../agency/census";
import {ModelChip} from "../../../agent/chat/ComposerChips";
import {encounter,encounterProvision,type EncounterStatus} from "../../../encounter/client";
import {useEncounterSession,type EncounterSessionHandle} from "../../../encounter/session";
import {connectionLabel} from "../../../encounter/nativeModel";
import {useKernel} from "../../../kernel/KernelProvider";
import {useScope,scopeProject} from "../../scope";
import {chatProvisionTarget} from "../../../agent/chat/firstSend";
import {modelChoices} from "../../../agent/chat/modelPresentation";
import {useActiveEncounter} from "../../activeEncounter";
import {harnessEffect,harnessItems} from "../sectionModel";
import {expect,loadSuite,plain,refreshAll,defaultScope,resolutionKey,watchPair,type SettingsSnapshot} from "../settingsData";
import {settingRowId,stageSetting,stagedChanges,undoChange} from "../changeModel";
import {connectionVerification,connectionNames,providerName,MODEL_DEFAULT_SETTING,modelDefaults,modelDefaultChoice} from "../harnessCapabilities";
import {Group,Missing,Reading,Row,Unreadable} from "../rows";
import {HarnessAuth} from "../AuthLogin";
import {ModelCatalogue} from "./ModelCatalogue";
import {useSettingsNav} from "../settingsNav";

export function folderOf(row:HarnessRow):string|null {
 const first=row.config_dir?.split(" (")[0]?.split(" and ")[0]?.trim();
 return first&&first.startsWith("/")?first:null;
}

/** AIKit's facts on one agent, as detail on its census card: whether AIKit's client is installed into it, its folder, sign-in. */
function AikitClientDetail({row}:{row:HarnessRow}) {
 const [busy,setBusy]=useState(false),[note,setNote]=useState<string|null>(null);
 const folder=folderOf(row);
 const install=async()=>{
  setBusy(true);setNote(null);
  try{await expect({op:"client_install",client:row.client},"client_installed");await loadSuite();setNote("Installed. "+(harnessEffect(row)??""));}
  catch(cause){setNote(refusalWords("Not installed.",cause));}finally{setBusy(false);}
 };
 return <div className="settings-harness-aikit" data-settings-row={`harness-install:${row.client}`} data-harness-card={row.client} data-installed={row.installed?"true":"false"}>
  <p className="settings-muted">AIKit: {row.installed?"installed":"not installed"}{harnessItems(row)?` · ${harnessItems(row)}`:""}</p>
  {harnessEffect(row)&&<p className="settings-card-strong" data-harness-effect>{harnessEffect(row)}</p>}
  <div className="settings-card-actions">
   {!row.installed&&<button type="button" className="settings-button" disabled={busy} data-harness-install onClick={()=>void install()}>{busy?"Installing…":"Install AIKit"}</button>}
   {folder&&<button type="button" className="settings-button" onClick={()=>void expect({op:"settings_reveal",path:folder},"settings_revealed").catch(cause=>setNote(refusalWords("Couldn't open the folder.",cause)))}>Open folder</button>}
  </div>
  {note&&<p className="settings-card-note" role="status">{note}</p>}
  <HarnessAuth harness={row.client}/>
 </div>;
}

function CurrentChat({session}:{session:EncounterSessionHandle|undefined}) {
 const kernel=useKernel();
 const [checking,setChecking]=useState(false),[verification,setVerification]=useState<{summary:string;cause?:unknown;connected:boolean;at:number}>();
 const state=session?.state,status=state?.status;
 useEffect(()=>{setVerification(undefined);},[state?.key,status?.native_session_id,status?.provider?.id]);
 const facts=status?.provider?{...state?.providers.find(provider=>provider.id===status.provider?.id),...status.provider}:undefined;
 const verify=async()=>{
  if(!state)return;
  setChecking(true);
  try{
   const read=await encounter<EncounterStatus>(kernel.transport,state.project,{action:"status",agent_session:state.agentSession});
   setVerification({...connectionVerification(read),at:Date.now()});
  }catch(cause){setVerification({connected:false,summary:"The connection could not be verified.",cause,at:Date.now()});}
  finally{setChecking(false);}
 };
 return <section className="settings-card settings-harness-current" aria-label="Current chat" data-current-chat-harness>
  <h3>Current chat</h3>
  {session?<>
   <p><strong>{facts?providerName(facts):"No harness connected"}</strong> · {connectionLabel(status)}</p>
   <div className="settings-card-actions">
    <button type="button" className="settings-button" disabled={checking} data-harness-verify onClick={()=>void verify()}>{checking?"Verifying…":"Verify connection"}</button>
    {state?.resume&&<button type="button" className="settings-button" disabled={state.pending} onClick={()=>void session.actions.reconnect(state.resume!.provider)}>Resume this chat</button>}
   </div>
   {verification&&(verification.cause===undefined
    ?<p className="settings-card-note" role="status" data-connection-verified={verification.connected}>{verification.summary} Checked {new Date(verification.at).toLocaleTimeString()}. No model turn was sent.</p>
    :<Refusal className="settings-card-note" role="status" data-connection-verified={verification.connected} said={verification.summary} error={verification.cause}><p>Checked {new Date(verification.at).toLocaleTimeString()}. No model turn was sent.</p></Refusal>)}
   <Row id="model:current" title="Model for this chat" description="Changes this session only; the harness confirms the selection.">
    <ModelChip project={session.state.project||undefined} model={session.state.model} actions={{refresh:session.actions.readModel,select:session.actions.selectModel}} disabled={session.state.pending||status?.state==="TurnInFlight"||status?.state==="InterruptRequested"}/>
   </Row>
   {state?.error&&<Refusal className="settings-inline-error" said="The chat connection reported a problem." error={state.error}/>}
  </>:<p className="settings-muted">No chat is selected. A new chat talks to the agent chosen in its composer.</p>}
 </section>;
}

/** One census agent: whether it starts on this machine (its version, or why not), using it in the current chat, and AIKit's detail. */
function AgentCard({agent,session}:{agent:CensusAgent;session?:EncounterSessionHandle}) {
 const name=agentName(agent);
 const client=agent.aikit?shapeHarnessClients({clients:[agent.aikit]})[0]:undefined;
 const current=session?.state.status?.provider?.id===agent.slug;
 const openAction=session?.state.reading?.actions?.find(action=>action.ref==="aikit.encounter.open");
 const canConnect=!!session&&!session.state.pending&&openAction?.enabled===true;
 return <section className="settings-card settings-harness" data-settings-row={`agent:${agent.slug}`} data-census-agent={agent.slug} data-starts={agent.starts?"true":"false"}>
  <h3>{name}</h3>
  <p>{current?"Selected for this chat":agent.starts?`Starts on this machine${agent.version?` · ${agent.version}`:""}`:"Doesn't start on this machine"}</p>
  {!agent.starts&&agent.why&&<p className="settings-muted" data-census-why>{agent.why}</p>}
  {agent.executable&&<p className="settings-muted"><code>{agent.executable}</code></p>}
  {agent.starts&&!current&&session&&<div className="settings-card-actions">
   <button type="button" className="settings-button" disabled={!canConnect} title={openAction?.reason??undefined} onClick={()=>void session.actions.connect(agent.slug)}>Use in this chat</button>
  </div>}
  {agent.starts&&!current&&session&&!canConnect&&<p className="settings-muted">{openAction?.reason??"The owner has not enabled changing this chat's agent."}</p>}
  {client&&<AikitClientDetail row={client}/>}
 </section>;
}

function DefaultModels({data,session,providers}:{data:SettingsSnapshot;session?:EncounterSessionHandle;providers:ProviderRow[]}) {
 const entry=data.registry.state==="ok"?data.registry.value.index[MODEL_DEFAULT_SETTING]:undefined;
 const scope=entry?defaultScope(entry.setting):undefined;
 useEffect(()=>{if(entry&&scope)void watchPair(entry.setting.setting_ref,scope);},[entry?.setting.setting_ref]);
 const resolution=scope?data.resolutions[resolutionKey(MODEL_DEFAULT_SETTING,scope)]:undefined;
 const table=modelDefaults(resolution?.desired?.value??resolution?.native.effective?.value??resolution?.native.declared?.value);
 const change=scope?stagedChanges(data).find(row=>row.requestKey===resolutionKey(MODEL_DEFAULT_SETTING,scope)):undefined;
 const observation=session?.state.model.reading?.model_observation;
 const selected=session?.state.status?.provider?.id;
 const names=connectionNames(providers);
 const [error,setError]=useState<string>();
 const stage=(provider:string,id:string)=>{
  if(!entry||!scope)return;
  const next={...table};
  if(id){const chosen=modelDefaultChoice(observation,id);if(!chosen){setError("The harness no longer advertises that model. Refresh the chat connection and try again.");return;}next[provider]=chosen;}else delete next[provider];
  setError(undefined);
  void stageSetting({setting_ref:MODEL_DEFAULT_SETTING,scope,value:next,secret_reference:null}).catch(cause=>setError(plain(cause)));
 };
 if(data.registry.state==="reading"||entry&&!resolution)return <Reading/>;
 if(!entry)return <Missing>The installed AIKit does not expose launch-model defaults. Update AIKit to configure the model for future chats.</Missing>;
 return <div role="group" aria-label="Default models for new chats" data-default-models data-settings-row={settingRowId(MODEL_DEFAULT_SETTING)}>
  {providers.length>0&&<p className="settings-muted">New chats open on the saved model. Choices come from what a live chat on that harness advertises.</p>}
  {providers.map(provider=>{
   const saved=table[provider.id],options=selected===provider.id?modelChoices(observation?.available_models??[]):[];
   const rpc=provider.protocol==="pi-rpc"||provider.protocol==="prime-rpc";
   const available=options.length>0&&(!rpc||!!observation?.native_provider);
   return <Row key={provider.id} id={`model:${provider.id}`} title={`${names.get(provider.id)} default model`} changed={!!change} onUndo={change?()=>void undoChange(change):undefined} description={available?"Confirmed by the harness when each new chat opens.":"Start a chat on this harness to read its models."}>
    <select className="settings-select" aria-label={`Default model for ${names.get(provider.id)}`} value={saved?.model_id??""} disabled={!entry.setting.writable||(!available&&!saved)} onChange={event=>stage(provider.id,event.target.value)}>
     <option value="">Harness default</option>
     {saved&&!options.some(option=>option.modelId===saved.model_id)&&<option value={saved.model_id}>{saved.model_name??"Saved model"}</option>}
     {available&&options.map(option=><option key={option.modelId} value={option.modelId}>{option.name}</option>)}
    </select>
   </Row>;
  })}
  {change&&<p role="status" className="settings-card-note">Model default change ready to review and apply.</p>}
  {error&&<Refusal className="settings-inline-error" said="This change wasn't staged." error={error}/>}
 </div>;
}
export function HarnessesSection({data}:{data:SettingsSnapshot}) {
 const kernel=useKernel(),scope=useScope();
 const nav=useSettingsNav();
 const active=useActiveEncounter();
 const [prepared,setPrepared]=useState<typeof active>(),[starting,setStarting]=useState(false),[startError,setStartError]=useState<string>();
 const session=useEncounterSession(prepared??active);
 useEffect(()=>{setPrepared(undefined);},[active?.ref]);
 const start=async()=>{
  setStarting(true);setStartError(undefined);
  try{
   const result=await encounterProvision(kernel.transport,chatProvisionTarget(scopeProject(scope)));
   const binding={ref:result.agent_session,project:result.project,space:result.space};
   setPrepared(binding);
   window.dispatchEvent(new CustomEvent("oi:agent-session-prepared",{detail:{...binding,title:"New conversation"}}));
  }catch(cause){setStartError(plain(cause));}finally{setStarting(false);}
 };
 const census=useCensus(kernel.transport);
 if(data.suite.state==="reading")return <Reading/>;
 if(data.suite.state==="failed")return <Unreadable error={data.suite.error} onRetry={()=>void refreshAll()}/>;
 const providers=data.suite.value.harness.providers;
 // The model defaults are kept per census agent, each with AIKit's provider facts for it when AIKit has some.
 const agents=censusConnections(census,providers.state==="ok"?providers.rows:[]).map(row=>({id:row.id,label:row.label,...(row.protocol?{protocol:row.protocol}:{})}));
 return <div className="settings-harnesses" data-harness-panel>
  <CurrentChat key={`${session?.state.key??"none"}:${session?.state.status?.native_session_id??"none"}`} session={session}/>
  <Group title="Agents on this machine" id="agents" reveal={nav.focusRow?.startsWith("agent:")||nav.focusRow?.startsWith("harness-install:")?nav.focusSeq:undefined}>
   {census.state==="reading"?<Reading/>
    :census.state==="unavailable"?<Unreadable error={census.why} onRetry={()=>void refreshAll()}/>
    :census.agents.length?<div className="settings-cards">{census.agents.map(agent=><AgentCard key={agent.slug} agent={agent} session={session}/>)}</div>
    :<p className="settings-muted">Actuation detects no agent harness on this machine.</p>}
  </Group>
  <Group title="New chats" id="new-chats">
   <DefaultModels data={data} session={session} providers={agents}/>
   <button type="button" className="settings-button" disabled={starting||stagedChanges(data).some(row=>row.requestKey.startsWith(MODEL_DEFAULT_SETTING))} onClick={()=>void start()}>{starting?"Starting chat…":session?"Start a new chat to verify defaults":"Start a chat to read models"}</button>
   {agents.length>0&&<p className="settings-muted">Opens a chat with the first agent on this machine that starts, without sending a message.</p>}
   {startError&&<Refusal className="settings-inline-error" said="Couldn't start a chat." error={startError}/>}
  </Group>
  <ModelCatalogue data={data}/>
 </div>;
}

