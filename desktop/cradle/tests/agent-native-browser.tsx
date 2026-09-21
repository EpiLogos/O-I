/** Test-only entry. Imports production presenters/controllers; never a discovered provider. */
import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ChatComposer} from '../src/agent/chat/ChatComposer';
import {NativeModelController,type NativeModelState} from '../src/encounter/nativeModel';
const calls:unknown[]=[];
let loseAck=false;
let model='test/a';
let readonly=false;
function reading(){return {agent_session:'agent-session/browser',native_session_id:'native-browser',model_observation:{current_model_id:model,available_models:[{modelId:'test/a',name:'Model A'},{modelId:'test/b',name:'Model B'}],standing:'controlled-provider-report'},model_controls:{model_selection:!readonly,reasoning_effort_selection:false,reason:readonly?'This harness has launch-time selection only.':undefined},standing:'controlled-provider-report'};}
function App(){
 const [draft,setDraft]=useState('A source-dependent draft that must survive configuration.');
 const [state,setState]=useState<NativeModelState>({phase:'unread'});
 const [status,setStatus]=useState<any>({state:'Resident',native_session_id:'native-browser',provider:{id:'controlled',label:'Controlled test harness'}});
 const controller=useMemo(()=>new NativeModelController('agent-session/browser',async request=>{calls.push(request);if(request.action==='model-select'){model=request.provider_model_id;if(loseAck)throw Error('wire closed after write');return {...reading(),selected:true,inference_observed:false};}return reading();},setState),[]);
 const actions=useMemo(()=>({refresh:()=>controller.refresh(),select:(model:string,effort?:string)=>controller.select(model,effort)}),[controller]);
 React.useEffect(()=>controller.observe(status),[controller,status]);
 (window as any).controlled={calls,loseAck:()=>{loseAck=true;},readonly:async()=>{readonly=true;await controller.refresh();},disconnect:()=>setStatus({...status,state:'FutureUnknownState'}),modelState:()=>controller.snapshot()};
 return <ChatComposer reading={{permissions:[]} as any} draft={draft} onDraft={setDraft} pending={false} busy={false} editable promptAllowed={false} cancelAllowed={false} permissionAllowed={false} onSend={()=>{throw Error('No live model exists in this test');}} onCancel={()=>{}} onPermission={()=>{}} tools={{pickFiles:async()=>{}}} draftFailed={false} onRecover={()=>{}} paged={false} onLatest={()=>{}} connection={{status,providers:[{id:'controlled',label:'Controlled test harness'}],onProvider:()=>{},onReconnect:()=>{},openAllowed:false,model:state,modelActions:actions,onRefreshProviders:()=>calls.push({read:'providers'})}}/>;
}
createRoot(document.getElementById('root')!).render(<App/>);
