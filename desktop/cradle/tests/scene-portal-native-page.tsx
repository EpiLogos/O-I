/** Only a production owner mount. All Scene/source/Surface data is native. */
import {createRoot} from 'react-dom/client';
import {CradleFrame} from '../src/CradleFrame';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {VisualsProvider} from '../src/visuals/ParticleExpression';
import {ExpressionStageProvider} from '../src/stage/ExpressionStage';
import {ExpressionProvider} from '../src/shared/Expression';
import {resolveScenePortal} from '../src/expressions/scenePortal';
import '@epilogos/oi-design-system/tokens.css';
import '@epilogos/oi-design-system/desktop.css';
import '../src/rest.css';
import '../src/cradle.css';
const url=new URLSearchParams(location.search).get('bridge')!;
window.__OI_KERNEL_BRIDGE__=url;
Object.assign(window,{__SCENE_PORTAL_OWNER_PROOF__:{
 activate:async(pointer:unknown)=>{
  const portal=await resolveScenePortal({kind:'bridge',url},pointer);
  await new Promise<void>((resolve,reject)=>window.dispatchEvent(new CustomEvent('oi:open-scene-source',{detail:{target:portal.target,portal,complete:(error?:string)=>error?reject(Error(error)):resolve()}})));
 }
}});
createRoot(document.getElementById('root')!).render(<KernelProvider><VisualsProvider><ExpressionStageProvider><ExpressionProvider><CradleFrame/></ExpressionProvider></ExpressionStageProvider></VisualsProvider></KernelProvider>);
