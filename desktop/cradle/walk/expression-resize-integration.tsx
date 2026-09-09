/** Isolated S layout integration. Actual production components and state engine;
 * no owner transport, fake session, mocked handler, or substituted renderer. */
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {ExpressionProvider,useExpressionOverlay} from '../src/shared/Expression';
import {DesktopShell} from '../src/workspace/DesktopShell';
import {Workbench} from '../src/surface/Workbench';
import {executeFrameAction} from '../src/surface/registry';
import type {LayoutState} from '../src/surface/types';
import '../src/cradle.css';
import '@epilogos/oi-design-system/tokens.css';

const initial:LayoutState={surfaces:{},closedStack:[],focusedGroupId:'g1',agencyDepth:'panel',rightDepth:'panel',leftWidth:240,rightWidth:300,root:{type:'split',id:'sp1',dir:'h',weights:[1,1],children:[{type:'group',id:'g1',tabs:[],pinned:[],active:null,emptySlot:true},{type:'group',id:'g2',tabs:[],pinned:[],active:null,emptySlot:true}]}};
function Shell(){
 const [layout,setLayout]=useState(initial),overlay=useExpressionOverlay();
 useEffect(()=>{(window as any).resizeIntegration={inspect:()=>overlay?.inspect(),layout:()=>layout};},[overlay,layout]);
 const execute=(ref:string,arg?:Parameters<typeof executeFrameAction>[2])=>setLayout(s=>executeFrameAction(s,ref,arg));
 const workspace={id:'resize-integration',name:'Resize integration',layout,writing:''};
 return <DesktopShell layout={layout} setLayout={setLayout} workspace={workspace} workspaces={[workspace]} activate={()=>{}} create={()=>{}} rename={()=>{}} onRecover={()=>{}} onToggleNavigator={()=>{}} onCloseNavigator={()=>{}} native={false} arrangementActions={null} subject={{title:'',context:null}} right={<></>} namingRequest={null} onNamingHandled={()=>{}} error={null} navigator={()=>null}>
  <Workbench workspaceName={workspace.name} state={layout} execute={execute} menuOpen={false} nativeWindows={false} onView={()=>{}} openBindingMenu={()=>{}} openFrameMenu={()=>{}} openSource={()=>{}} openKnowledge={async()=>{}}/>
 </DesktopShell>;
}
createRoot(document.getElementById('root')!).render(<KernelProvider><ExpressionProvider><Shell/></ExpressionProvider></KernelProvider>);
