/** Controlled browser host; imports the actual launcher/controller, never shipped. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {NativeAgentLauncher} from '../src/agency/NativeAgentLauncher';
import {NativeAgentController} from '../src/agency/nativeAgent';
import {AgentSetupReturn} from '../src/agency/AgentSetupReturn';
const calls:any[]=[];let accepted=false,stored=false,lose=false,open:any;
const profile={ref:'agent-profile:browser',revision:'r1',agent_ref:'agent:browser',name:'Reading colleague',purpose:'Read the permitted source.',intent_provenance:{intent_expression:'Read the permitted source.'}};
function review(){return {schema:'central.agent-profile-review/v1',profile,scope_ref:'control:root',content_digest:'sha256:test-browser',accepted,execution_authority_granted:false,acceptance:accepted?{schema:'central.agent-profile-acceptance/v1',acceptance_ref:'acceptance:browser',profile_ref:profile.ref,agent_ref:profile.agent_ref,profile_revision:profile.revision,content_digest:'sha256:test-browser',scope_ref:'control:root'}:null};}
const controller=new NativeAgentController(async request=>{
 calls.push(request);
 if(request.action==='roster')return {schema:'central.agent-profile-roster/v1',scope_ref:'control:root',profiles:stored?[review()]:[],execution_authority_granted:false};
 if(request.action==='propose'){stored=true;return review();}
 if(request.action==='accept'){accepted=true;if(lose)throw Error('controlled lost acceptance reply');return review();}
 if(request.action==='review')return review();
 if(request.action==='prepare')return {schema:'aikit.direct-agent-session/v1',profile_ref:profile.ref,profile_revision:profile.revision,request_id:request.request_id,agent_ref:profile.agent_ref,agent_session:'agent-session/browser-created',space:'session-space/browser-created',project_ref:'control:root',acceptance_ref:'acceptance:browser',prepared:true,provider_started:false,execution_authority_granted:false,brokered_child_context:'not established'};
 throw Error('Unexpected native request');
});
(window as any).creation={calls,loseAcceptance:()=>{lose=true;},state:controller.snapshot,opened:()=>open};
function App(){return <KernelProvider><NativeAgentLauncher controller={controller} onChoose={row=>{open=row;}}/><AgentSetupReturn/></KernelProvider>;}
createRoot(document.getElementById('root')!).render(<App/>);
