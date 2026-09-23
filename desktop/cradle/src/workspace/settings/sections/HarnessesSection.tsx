/** Harness capability first; installation and detection are secondary facts. */
import {useEffect,useState} from "react";
import type {HarnessRow,ProviderRow} from "../../../configuration/harnessSource";
import {ModelChip} from "../../../agent/chat/ComposerChips";
import {harnessName as connectionHarnessName,type ConnectionFacts} from "../../../agent/chat/harness";
import {encounter,type EncounterStatus} from "../../../encounter/client";
import {useEncounterSession,type EncounterSessionHandle} from "../../../encounter/session";
import {connectionLabel} from "../../../encounter/nativeModel";
import {useKernel} from "../../../kernel/KernelProvider";
import {useActiveEncounter} from "../../activeEncounter";
import {adapterNeeded,harnessEffect,harnessItems,harnessName,notFound,readyHarnesses} from "../sectionModel";
import {expect,loadSuite,plain,refreshAll,stageDefaultConnection,type SettingsSnapshot} from "../settingsData";
import {currentConnection} from "../changeModel";
import {connectionVerification,DEFAULT_MODEL_UNAVAILABLE} from "../harnessCapabilities";
import {Group,Missing,Reading,Row,Unreadable} from "../rows";

export function folderOf(row:HarnessRow):string|null {
 const first=row.config_dir?.split(" (")[0]?.split(" and ")[0]?.trim();
 return first&&first.startsWith("/")?first:null;
}
export function connectionFor(data:SettingsSnapshot,row:HarnessRow):string|null {
 const providers=data.suite.state==="ok"&&data.suite.value.harness.providers.state==="ok"?data.suite.value.harness.providers.rows:[];
 const names=[row.client,row.harness].filter(Boolean);
 return providers.find(provider=>names.includes(provider.id))?.id??providers.find(provider=>names.some(name=>provider.id.startsWith(`${name}-`)))?.id??null;
}

/** Prefer launch facts; a missing display name never becomes a transport id. */
function providerName(provider:ConnectionFacts):string {
 return connectionHarnessName(provider)??(provider.label&&provider.label!==provider.id&&!/^(?:\S+:\/\/|provider[/:])/.test(provider.label)?provider.label:"Configured harness");
}

function DetectionCard({row}:{row:HarnessRow}) {
 const [busy,setBusy]=useState(false),[note,setNote]=useState<string|null>(null);
 const folder=folderOf(row);
 const install=async()=>{
  setBusy(true);setNote(null);
  try{await expect({op:"client_install",client:row.client},"client_installed");await loadSuite();setNote("Installed. "+(harnessEffect(row)??""));}
  catch(cause){setNote(`Not installed: ${plain(cause)}`);}finally{setBusy(false);}
 };
 return <section className="settings-card settings-harness" data-harness-card={row.client} data-installed={row.installed?"true":"false"}>
  <h3>{harnessName(row.harness)}</h3>
  <p>{row.installed?"Installed · detected":"Detected · not installed"}</p>
  {harnessItems(row)&&<p>{harnessItems(row)}</p>}
  {harnessEffect(row)&&<p className="settings-card-strong" data-harness-effect>{harnessEffect(row)}</p>}
  <div className="settings-card-actions">
   {!row.installed&&<button type="button" className="settings-button" disabled={busy} data-harness-install onClick={()=>void install()}>{busy?"Installing…":"Install"}</button>}
   {folder&&<button type="button" className="settings-button" onClick={()=>void expect({op:"settings_reveal",path:folder},"settings_revealed").catch(cause=>setNote(plain(cause)))}>Open folder</button>}
  </div>
  {note&&<p className="settings-card-note" role="status">{note}</p>}
 </section>;
}

function CurrentChat({session}:{session:EncounterSessionHandle|undefined}) {
 const kernel=useKernel();
 const [checking,setChecking]=useState(false),[verification,setVerification]=useState<{summary:string;connected:boolean;at:number}>();
 const state=session?.state,status=state?.status;
 useEffect(()=>{setVerification(undefined);},[state?.key,status?.native_session_id,status?.provider?.id]);
 const facts=status?.provider?{...state?.providers.find(provider=>provider.id===status.provider?.id),...status.provider}:undefined;
 const verify=async()=>{
  if(!state)return;
  setChecking(true);
  try{
   const read=await encounter<EncounterStatus>(kernel.transport,state.project,{action:"status",agent_session:state.agentSession});
   setVerification({...connectionVerification(read),at:Date.now()});
  }catch(cause){setVerification({connected:false,summary:`Connection could not be verified: ${plain(cause)}`,at:Date.now()});}
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
   {verification&&<p className="settings-card-note" role="status" data-connection-verified={verification.connected}>{verification.summary} Checked {new Date(verification.at).toLocaleTimeString()}. No model turn was sent.</p>}
   <Row title="Model for this chat" description="Changes this session only; the harness confirms the selection.">
    <ModelChip model={session.state.model} actions={{refresh:session.actions.readModel,select:session.actions.selectModel}} disabled={session.state.pending||status?.state==="TurnInFlight"||status?.state==="InterruptRequested"}/>
   </Row>
   {state?.error&&<p className="settings-inline-error" role="alert">{state.error}</p>}
  </>:<p className="settings-muted">No chat is selected. The default below decides which harness a new chat starts with.</p>}
 </section>;
}

function CapabilityCard({provider,data,session}:{provider:ProviderRow;data:SettingsSnapshot;session?:EncounterSessionHandle}) {
 const facts={...provider,...session?.state.providers.find(row=>row.id===provider.id)};
 const name=providerName(facts),current=session?.state.status?.provider?.id===provider.id;
 const applied=currentConnection(data)===provider.id,staged=data.stagedDefault===provider.id;
 const openAction=session?.state.reading?.actions?.find(action=>action.ref==="aikit.encounter.open");
 const canConnect=!!session&&!session.state.pending&&openAction?.enabled===true;
 return <section className="settings-card settings-harness" data-settings-row={`harness:${provider.id}`} data-harness-connection={provider.id}>
  <h3>{name}</h3>
  <p>{current?"Selected for this chat":applied?"Default for new chats":"Available for chats"}{facts.sandboxed&&<span className="settings-chip">Sandboxed</span>}</p>
  {provider.label&&provider.label!==provider.id&&provider.label!==name&&<p className="settings-muted">{provider.label}</p>}
  <div className="settings-card-actions">
   {applied&&!data.stagedDefault?<span className="settings-chip" data-harness-default>Default for new chats</span>
    :staged?<span className="settings-chip">Default change ready to review</span>
    :<button type="button" className="settings-button" data-harness-set-default onClick={()=>stageDefaultConnection(applied?null:provider.id)}>Set as default</button>}
   {!current&&session&&<button type="button" className="settings-button" disabled={!canConnect} title={openAction?.reason??undefined} onClick={()=>void session.actions.connect(provider.id)}>Use in this chat</button>}
  </div>
  {!current&&session&&!canConnect&&<p className="settings-muted">{openAction?.reason??"The owner has not enabled changing this chat's harness."}</p>}
  {!current&&<p className="settings-muted">Connection verification is available when a chat is running on this harness.</p>}
 </section>;
}

export function HarnessesSection({data}:{data:SettingsSnapshot}) {
 const active=useActiveEncounter(),session=useEncounterSession(active);
 if(data.suite.state==="reading")return <Reading/>;
 if(data.suite.state==="failed")return <Unreadable error={data.suite.error} onRetry={()=>void refreshAll()}/>;
 const reading=data.suite.value,providers=reading.harness.providers;
 const ready=readyHarnesses(reading),needing=adapterNeeded(reading),missing=notFound(reading);
 const current=currentConnection(data);
 const defaultProvider=providers.state==="ok"?providers.rows.find(provider=>provider.id===current):undefined;
 return <div className="settings-harnesses" data-harness-panel>
  <CurrentChat key={`${session?.state.key??"none"}:${session?.state.status?.native_session_id??"none"}`} session={session}/>
  <Group title="New chats" id="new-chats">
   <p className="settings-muted">{defaultProvider?`New chats currently start with ${providerName(defaultProvider)}.`:"No default harness is available."} Existing chats keep their own harness.</p>
   {data.stagedDefault&&<p className="settings-card-note" role="status">The default change is staged. Review and apply it below to confirm.</p>}
   {providers.state==="failed"?<Unreadable error={providers.error} onRetry={()=>void loadSuite()}/>:providers.rows.length?<div className="settings-cards">{providers.rows.map(provider=><CapabilityCard key={provider.id} provider={provider} data={data} session={session}/>)}</div>:<p className="settings-muted">No encounter harness is configured.</p>}
   <Row title="Default model" description="For future chats"><span className="settings-muted">Resolved when the chat starts</span></Row>
   <Missing>{DEFAULT_MODEL_UNAVAILABLE}</Missing>
  </Group>
  <Group title="Installation and detection" count={ready.length+needing.length+missing.length} collapsible defaultOpen={false} id="detection">
   {reading.harness.harnesses.state==="failed"?<Unreadable error={reading.harness.harnesses.error} onRetry={()=>void loadSuite()}/>:<>
    <div className="settings-cards">{ready.map(row=><DetectionCard key={row.client} row={row}/>)}</div>
    <ul className="settings-name-list" data-harness-adapter-needed>{needing.map(row=><li key={row.client}><strong>{harnessName(row.harness)}</strong> <span className="settings-muted">Detected · adapter needed</span></li>)}</ul>
    <ul className="settings-name-list" data-harness-not-found>{missing.map(row=><li key={row.client}><strong>{harnessName(row.harness)}</strong> <span className="settings-muted">Not on this machine</span></li>)}</ul>
   </>}
  </Group>
 </div>;
}
