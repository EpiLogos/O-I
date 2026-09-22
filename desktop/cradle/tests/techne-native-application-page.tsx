/** Actual retained app host over the real temporary kernel. This page supplies
 * only the outer mount; the imported production app and native relay are intact. */
import {createRoot} from 'react-dom/client';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {PointCloudHost} from '../src/expressions/PointCloudHost';
import '@epilogos/oi-design-system/tokens.css';
import '@epilogos/oi-design-system/desktop.css';
window.__OI_KERNEL_BRIDGE__=new URLSearchParams(location.search).get('bridge')??'';
const events:string[]=[];
const summons:{kind:string;subject?:unknown}[]=[];
window.addEventListener('oi:techne-summon',event=>{const detail=(event as CustomEvent).detail;events.push(detail.kind);summons.push({kind:detail.kind,subject:detail.subject});});
Object.assign(window,{__TECHNE_HOST_PROOF__:{events,summons}});
createRoot(document.getElementById('root')!).render(<KernelProvider><main style={{height:'100vh',width:'100vw',display:'flex'}}><PointCloudHost mode="techne"/></main></KernelProvider>);
