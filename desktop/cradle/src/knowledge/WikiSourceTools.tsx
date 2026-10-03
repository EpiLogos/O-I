import {useState} from 'react';
import {useKernel} from '../kernel/KernelProvider';
import type {KnowledgeReading} from '../kernel/types';
import {SourceSurface} from '../surface/SourceSurface';
import type {SurfaceBinding} from '../surface/types';
import {NativeOwnerFailure,nativeFailureReading,throwNativeFailure} from '../kernel/nativeFailure';
import {RawDisclosure} from '../shared/contributionPresentation';

/** Source editing uses the same native buffer, CodeMirror suite and CAS save as
 * a file opened elsewhere. It is not a Markdown-only copy of the editor. */
export function WikiSourceTools({reading,binding,onReturn}:{reading:KnowledgeReading;binding:SurfaceBinding;onReturn:()=>Promise<void>}) {
  const kernel=useKernel();
  const [editing,setEditing]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState<string>();
  const held=kernel.snapshot.buffers[reading.resource];
  const nativeFailure=nativeFailureReading(error);
  const open=async()=>{
    setPending(true);setError(undefined);
    try{
      // Never overwrite a retained dirty buffer merely to change presentation.
      if(!held){
        const outcome=await kernel.apply({op:'source_open',source_ref:reading.resource,project:binding.project});
        if(outcome?.result!=='source_opened')throwNativeFailure(kernel.lastOpError());
        if(outcome?.result!=='source_opened'||outcome.buffer.source_ref!==reading.resource)throw new Error(kernel.lastOpError()??'The source owner did not return an editable buffer for this exact source.');
      }
      setEditing(true);
    }catch(reason){setError(reason instanceof NativeOwnerFailure?JSON.stringify(reason.reading):reason instanceof Error?reason.message:String(reason));}
    finally{setPending(false);}
  };
  const close=async()=>{
    setPending(true);setError(undefined);
    try{await onReturn();setEditing(false);}catch(reason){setError(String(reason));}
    finally{setPending(false);}
  };
  return <section className="wiki-source-tools" aria-label="Source editing">
    <button type="button" className="oi-action" disabled={pending} onClick={()=>void(editing?close():open())}>{pending?'Reading source…':editing?'Return to reading':'Edit source'}</button>
    {held?.dirty&&<span role="status">A source draft is retained{editing?'':'; this reader shows the saved revision'}.</span>}
    {error&&<p role="alert">{nativeFailure?new NativeOwnerFailure(nativeFailure).message:error}</p>}
    {nativeFailure&&<RawDisclosure value={nativeFailure} label="Inspect the native source reading failure"/>}
    {editing&&<div className="wiki-source-editor"><SourceSurface key={reading.resource} binding={{...binding,kind:'source',ref:reading.resource,title:binding.title}}/></div>}
  </section>;
}
