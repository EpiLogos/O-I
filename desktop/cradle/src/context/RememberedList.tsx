import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import type {NativeDirectory} from "../kernel/types";
/** Remembered notes, read (the U3.3 named open, queue cell D): a register's
 * remembered ground is plain owner files, listed through the owner's
 * `central.files.list` route and read verbatim through `central.files.read`.
 * A register that holds no remembered directory renders honest absence —
 * that refusal IS the ground's truth about nothing remembered — and any
 * other owner refusal renders in the owner's own words. Read-only: nothing
 * here recognises, promotes or edits a note; the remember control lives in
 * the context tray, and recognition stays the human owner's separate act. */
export function RememberedList({path,label}:{path:string;label:string}) {
 const kernel=useKernel();
 const [entries,setEntries]=useState<NativeDirectory>();
 const [absent,setAbsent]=useState(false);
 const [error,setError]=useState<string>();
 const [openRef,setOpenRef]=useState<string>();
 const [note,setNote]=useState<{ref:string;text:string}>();
 const [readError,setReadError]=useState<string>();
 const [pending,setPending]=useState(false);
 useEffect(()=>{
  let live=true;setPending(true);setAbsent(false);setError(undefined);
  void kernelOp(kernel.transport,{op:"files_list",path}).then(result=>{
   if(result.error||result.outcome?.result!=="directory_read")throw new Error(result.error??"the listing did not serve");
   if(live){setEntries(result.outcome.directory);setError(undefined);}
  }).catch(reason=>{
   if(!live)return;
   const message=String(reason);
   // The owner refuses a listing of a directory that does not exist: that
   // exact refusal is what "nothing remembered" looks like in the ground.
   if(/No such file or directory/i.test(message)){setAbsent(true);setEntries(undefined);setError(undefined);}
   else setError(message);
  }).finally(()=>{if(live)setPending(false);});
  return()=>{live=false;};
 },[path,kernel.transport]);
 const read=async(entry:{name:string;location:{ref:string}})=>{
  setOpenRef(entry.name);setNote(undefined);setReadError(undefined);
  try{
   const response=await kernelOp(kernel.transport,{op:"invoke_action",invocation:{action:"central.files.read",target_ref:entry.location.ref,input:{location:entry.location,encoding:"utf-8"}}});
   if(response.outcome?.result!=="action_dispatched")throw new Error(response.error??"the kernel returned no dispatch outcome");
   const dispatch=response.outcome.dispatch as {state?:string;data?:{content?:string};message?:string};
   if(dispatch.state!=="invoked")throw new Error(dispatch.message??`the owner did not read the note (${dispatch.state??"unknown state"})`);
   setNote({ref:entry.location.ref,text:dispatch.data?.content??""});
  }catch(reason){setReadError(String(reason));}
 };
 return <div className="project-remembered" data-remembered-list={label} aria-busy={pending}>
  {error?<p className="project-availability" role="status">{error}</p>
   :absent?<p className="project-availability" data-remembered-absent="true">Nothing remembered here yet.</p>
   :!entries?null
   :<details className="remembered-disclosure">
    <summary>Remembered ({entries.entries.length})</summary>
    {entries.entries.length?entries.entries.map(entry=><div key={entry.location.ref} className="remembered-row" data-remembered-row={entry.name}>
     <button onClick={()=>void read(entry)}>{entry.name}</button>
     {openRef===entry.name&&(readError?<p role="alert">{readError}</p>:note&&note.ref===entry.location.ref?<pre data-remembered-note={note.ref}>{note.text}</pre>:null)}
    </div>):<p className="project-availability" data-remembered-absent="true">The register holds no notes.</p>}
   </details>}
 </div>;
}
