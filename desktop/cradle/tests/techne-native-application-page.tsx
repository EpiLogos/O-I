/** Actual retained app host over the real temporary kernel. This page supplies
 * only the outer mount; the imported production app and native relay are intact. */
import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {KernelProvider,useKernel} from '../src/kernel/KernelProvider';
import {VisualsProvider} from '../src/visuals/ParticleExpression';
import {PointCloudHost} from '../src/expressions/PointCloudHost';
import {SituationProvider} from '../src/context/SituationContext';
import {buildSituationFrame} from '../src/context/situation';
import {freshLayout} from '../src/surface/types';
import {publishLens,readLens} from '../src/workspace/lens';
import type {Workspace,WorldRef} from '../src/workspace/store';
import '@epilogos/oi-design-system/tokens.css';
import '@epilogos/oi-design-system/desktop.css';
window.__OI_KERNEL_BRIDGE__=new URLSearchParams(location.search).get('bridge')??'';
const events:string[]=[];
const summons:{kind:string;subject?:unknown}[]=[];
window.addEventListener('oi:techne-summon',event=>{const detail=(event as CustomEvent).detail;events.push(detail.kind);summons.push({kind:detail.kind,subject:detail.subject});});
const proof={events,summons,readLens:()=>readLens().on};
Object.assign(window,{__TECHNE_HOST_PROOF__:proof});
// A controlled presentation choice, not a native world/person/current fixture.
// The kernel snapshot, asset read, real PointCloudHost and imported app are actual.
const startupWorld=new URLSearchParams(location.search).get('startupWorld');
if(startupWorld==='epi-logos'||startupWorld==='central')publishLens(startupWorld!=='epi-logos');
function ControlledSituationHost(){
 const kernel=useKernel();
 const [workspace]=useState<Workspace>(()=>({id:'native-parent-startup',name:'Controlled startup',writing:'',layout:{...freshLayout(),mode:'expressions'},context:{world:startupWorld as WorldRef}}));
 const situation=buildSituationFrame({workspace,snapshot:kernel.snapshot});
 return <SituationProvider value={situation}>
  <button type="button" data-parent-lens="on" onClick={()=>publishLens(true)}>Publish global lens on</button>
  <button type="button" data-parent-lens="off" onClick={()=>publishLens(false)}>Publish global lens off</button>
  <span data-parent-world={situation.workspace.world} data-global-lens-at-mount={String(startupWorld!=='epi-logos')}/>
  <PointCloudHost mode="expressions"/>
 </SituationProvider>;
}
createRoot(document.getElementById('root')!).render(<KernelProvider><VisualsProvider><main style={{height:'100vh',width:'100vw',display:'flex'}}>{startupWorld==='epi-logos'||startupWorld==='central'?<ControlledSituationHost/>:<PointCloudHost mode="techne"/>}</main></VisualsProvider></KernelProvider>);
