import {useState} from 'react';
import {listFiles,readFile,fileOperation,type FileMutation} from '../../files/client';
import type {KernelTransportStatus,NativeFileReading} from '../../kernel/types';
import {createHumanNote} from './ground';
// Unsaved prose is private application memory. It is never browser persistence,
// telemetry, agent context or an automatically created empty source file.
const drafts=new Map<string,{name:string;text:string}>();
export function OwnWords({id,transport,onSaved}:{id:string;transport:KernelTransportStatus;onSaved:(source:NativeFileReading)=>void}){
 const [draft,setDraft]=useState(drafts.get(id)??{name:'about-me.md',text:''}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const change=(next:typeof draft)=>{drafts.set(id,next);setDraft(next);};
 const save=async()=>{if(busy)return;setBusy(true);setError('');try{
  const parent=await listFiles(transport,'Control/user',true);
  const returned=await createHumanNote(parent,draft.name,draft.text,{read:location=>readFile(transport,location),write:(location,revision,content)=>fileOperation<FileMutation>(transport,location,{action:'write',expected_revision:revision,content})});
  drafts.delete(id);setDraft({name:draft.name,text:''});onSaved(returned);
 }catch(e){setError(e instanceof Error?e.message:'Your draft remains here; native save was not confirmed');}finally{setBusy(false);}};
 return <details><summary>Start in my own words</summary><p>A name, what matters to you, and anything you choose to share can remain ordinary writing in Central. Dates, birth time, location and assessments are optional; unknown is not replaced with a guess.</p><label>New note in Control/user<input aria-label="Personal note filename" value={draft.name} onChange={e=>change({...draft,name:e.target.value})}/></label><label>What I want to write<textarea aria-label="Personal note" value={draft.text} maxLength={65536} onChange={e=>change({...draft,text:e.target.value})} rows={6}/></label><p>This uses your existing Central access policy. Saving creates only your chosen note, not an identity assessment, model prompt or public edition. Existing files are never overwritten here.</p><button type="button" disabled={busy||!draft.text.trim()} onClick={()=>void save()}>Save my words to Central</button><button type="button" disabled={busy} onClick={()=>{drafts.delete(id);setDraft({name:draft.name,text:''});}}>Discard this unsaved draft</button>{error&&<p role="alert">{error}</p>}</details>;
}
