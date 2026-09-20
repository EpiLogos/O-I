import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EditorView} from '@codemirror/view';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {FileSurface} from '../src/files/FileSurface';
import {FlowSurface} from '../src/flow/FlowSurface';
import {ContextTray} from '../src/context/ContextTray';
import {PreparedContextView} from '../src/context/PreparedContextView';
import {useEncounterSession} from '../src/encounter/session';
import {ContextPlane} from '../src/agent/planes/ContextPlane';
import '@epilogos/oi-design-system/tokens.css';
import '@epilogos/oi-design-system/desktop.css';
import '../src/cradle.css';
import '../src/agent/agent.css';
const sample={id:'sample',kind:'file' as const,ref:'central:source:sample.md',title:'sample.md',project:'demo',location:{root:'central',path:'Work/demo/sample.md',ref:'central:source:sample.md'}};
const flowBinding={id:'flow',kind:'flow' as const,ref:'central:source:flow.html',title:'Flow.html',project:'demo',location:{root:'central',path:'Work/demo/flow.html',ref:'central:source:flow.html'}};
const binding=location.search.includes('flow')?flowBinding:sample;
// Only fixture controls live here. FileSurface, editor, Context, owner client and
// the session CAS/send machine are the actual production implementations.
function Probe({withAgent}:{withAgent:boolean}){
 const session=useEncounterSession(withAgent?{project:'demo',ref:'agent-session/test',space:'session-space/test'}:undefined);
 const subject={ref:binding.ref,title:binding.title,project:'demo',kind:'file'};
 useEffect(()=>{window.canvasTest={
  select(start:number,end:number){const host=document.querySelector('.cm-content');const editor=host?EditorView.findFromDOM(host as HTMLElement):null;if(!editor)throw new Error('Editor not mounted');editor.dispatch({selection:{anchor:start,head:end}});editor.focus();},
  document(){return (document.querySelector('.text-editor-host') as any)?.__oiDocument?.();},
  change(text:string){session?.actions.change(text);},
  async send(){await session?.actions.send();},
  session(){return session?.state;},
 };},[session]);
 return <aside className="agent-layer" aria-label="Agent Context" style={{width:'310px',overflow:'auto',padding:'16px',boxSizing:'border-box'}}>{withAgent?<ContextPlane subject={subject} historyAvailable={false} accompanying={{project:'demo',ref:'agent-session/test',space:'session-space/test'}} session={session}/>:<PreparedContextView project="demo"/>}</aside>;
}
function App(){const [withAgent,setWithAgent]=useState(!location.search.includes('noagent'));return <KernelProvider><button id="toggle-agent" onClick={()=>setWithAgent(x=>!x)}>Toggle companion</button><main style={{display:'flex',height:'calc(100vh - 36px)',minHeight:0}}><div data-binding-id={binding.id} style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}><>{binding.kind==="flow"?<FlowSurface binding={binding}/>:<FileSurface binding={binding}/>}</></div><Probe withAgent={withAgent}/></main><ContextTray bindings={{[binding.id]:binding}} accompanying={withAgent?{project:'demo',ref:'agent-session/test',space:'session-space/test'}:undefined}/></KernelProvider>;}
createRoot(document.getElementById('root')!).render(<App/>);
