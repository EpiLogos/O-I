/** Test-only mount; no fake owner payloads or production fixture injection. */
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KernelProvider,useKernel} from '../src/kernel/KernelProvider';
import {WorldNavigator} from '../src/surfaces/navigator/WorldNavigator';
import {SourceSurface} from '../src/surface/SourceSurface';
import {readFile} from '../src/files/client';
import type {CentralLocation} from '../src/kernel/types';
import type {SurfaceBinding} from '../src/surface/types';
import type {ProjectNavigation} from '../src/workspace/store';
import '../src/receiving/receiving.css';
window.__OI_KERNEL_BRIDGE__=new URLSearchParams(location.search).get('bridge')!;
function Page(){
 const kernel=useKernel();const [source,setSource]=useState<SurfaceBinding>();
 const [error,setError]=useState('');const [files,setFiles]=useState(false);
 const [navigation,setNavigation]=useState<Record<string,ProjectNavigation>>({});
 const [front,setFront]=useState<'ground'|'source'>('ground');
 async function openFile(location:CentralLocation){
  const reading=await readFile(kernel.transport,location);
  if(!reading.source)throw new Error('This test requires a native source, not a replacement document');
  const result=await kernel.apply({op:'source_open',project:reading.project?.name??null,source_ref:reading.source.ref});
  if(result?.result!=='source_opened')throw new Error(kernel.lastOpError()??'Native source did not open');
  setSource({id:reading.source.ref,kind:'source',ref:reading.source.ref,title:reading.location.path,project:reading.project?.name});setFront('source');
 }
 return <><p>Controlled ground, real source operations; not installed Mac acceptance.</p><div style={{display:'grid',gridTemplateColumns:'360px 1fr',height:'94vh'}}>
 <WorldNavigator mode="base" onMode={()=>{}} onOpenEncounter={async()=>{throw new Error('No test models')}} centralFiles={files} onCentralFilesChange={setFiles} workspaceSelector={null} projectNavigation={navigation} onNavigationChange={(ref,change)=>setNavigation(n=>({...n,[ref]:{...n[ref],...change}}))} onOpenFile={openFile} onOpenWiki={async()=>{throw new Error('Not a Wiki fixture')}} onMessage={setError}/>
 <main><button onClick={()=>setFront('ground')}>Back to Central ground</button><button disabled={!source} onClick={()=>setFront('source')}>Return to exact open source</button>{error&&<p role="alert">{error}</p>}
 <section hidden={front!=='ground'}><h1>Central native source walk</h1><p>Navigation leaves the existing source host mounted.</p></section>
 {source&&<section hidden={front!=='source'}><SourceSurface key={source.ref} binding={source}/></section>}
 </main></div></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><KernelProvider><Page/></KernelProvider></React.StrictMode>);
