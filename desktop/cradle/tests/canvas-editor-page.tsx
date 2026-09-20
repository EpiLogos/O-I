import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EditorView} from '@codemirror/view';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {FileSurface} from '../src/files/FileSurface';
import {ContextTray} from '../src/context/ContextTray';
import {PreparedContextView} from '../src/context/PreparedContextView';
import {useEncounterSession} from '../src/encounter/session';
import {ContextPlane} from '../src/agent/planes/ContextPlane';
import '@epilogos/oi-design-system/tokens.css';
import '../src/agent/agent.css';
const binding={id:'sample',kind:'file' as const,ref:'central:source:sample.md',title:'sample.md',project:'demo',location:{root:'central',path:'Work/demo/sample.md',ref:'central:source:sample.md'}};
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
 return <aside aria-label="Agent Context" style={{width:'310px',overflow:'auto',padding:'16px',boxSizing:'border-box'}}>{withAgent?<ContextPlane subject={subject} historyAvailable={false} accompanying={{project:'demo',ref:'agent-session/test',space:'session-space/test'}} session={session}/>:<PreparedContextView project="demo"/>}</aside>;
}
function App(){const [withAgent,setWithAgent]=useState(!location.search.includes('noagent'));return <KernelProvider><button id="toggle-agent" onClick={()=>setWithAgent(x=>!x)}>Toggle companion</button><main style={{display:'flex',height:'calc(100vh - 36px)',minHeight:0}}><div data-binding-id="sample" style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}><FileSurface binding={binding}/></div><Probe withAgent={withAgent}/></main><ContextTray bindings={{sample:binding}} accompanying={withAgent?{project:'demo',ref:'agent-session/test',space:'session-space/test'}:undefined}/></KernelProvider>;}
createRoot(document.getElementById('root')!).render(<App/>);
