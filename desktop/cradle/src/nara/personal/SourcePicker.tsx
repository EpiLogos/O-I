import {useState} from 'react';
import {listFiles,readFile} from '../../files/client';
import type {KernelTransportStatus,NativeDirectory,NativeFileReading,CentralLocation} from '../../kernel/types';
/** Metadata navigation remains useful without a model. File contents are read
 * only after the person explicitly selects one; never fed into dialogue here. */
export function SourcePicker({transport,onChoose,onOpen}:{transport:KernelTransportStatus;onChoose:(source:NativeFileReading)=>void;onOpen:(location:CentralLocation)=>Promise<void>}){
 const [path,setPath]=useState('Control/user'),[directory,setDirectory]=useState<NativeDirectory>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const run=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Source unavailable');}finally{setBusy(false);}};
 return <details className="nara-personal-sources"><summary>Choose from my existing files</summary>
 <p>Browse first; select one saved source deliberately. This does not add its contents to Nara or change its native access policy.</p>
 <form onSubmit={e=>{e.preventDefault();void run(async()=>setDirectory(await listFiles(transport,path,true)));}}><label>Source folder<input aria-label="Personal source folder" value={path} onChange={e=>setPath(e.target.value)}/></label><button disabled={busy||!path.trim()}>Browse</button></form>
 {error&&<p role="alert">{error}</p>}
 {directory&&<ul aria-label="Existing Central sources">{directory.entries.map(entry=><li key={entry.location.ref}><span>{entry.name}</span>{entry.kind==='directory'?<button type="button" disabled={busy||!entry.retrieval_allowed} onClick={()=>void run(async()=>{setPath(entry.location.path);setDirectory(await listFiles(transport,entry.location.path,true));})}>Open folder</button>:entry.kind==='file'?<><button type="button" disabled={busy||!entry.retrieval_allowed} onClick={()=>void run(async()=>onChoose(await readFile(transport,entry.location)))}>Select source</button><button type="button" disabled={busy||!entry.retrieval_allowed} onClick={()=>void run(()=>onOpen(entry.location))}>Read / edit</button></>:null}{!entry.retrieval_allowed&&<span>Withheld by Central</span>}</li>)}</ul>}
 </details>;
}
