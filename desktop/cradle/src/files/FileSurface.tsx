import {Loading} from "../shared/Loading";
import {useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {NativeFileReading} from "../kernel/types";
import type {SurfaceBinding} from "../surface/types";
import {readDraft,writeDraft,clearSavedDraft,type HeldDraft} from "../workspace/drafts";
import {readFile,fileOperation,type FileMutation,type FileHistory,type FilePreview} from "./client";
import {detectFormat} from "../material/detect";
import {MaterialSurface} from "../material/MaterialSurface";

/** All writes/history belong to Central. Local storage retains unsaved typing.
 * FND-04: every non-plain-text format delegates entirely to the material
 * renderer — chosen here, before any owner round trip, from the
 * location's extension. HTML/Markdown are text-safe and keep this exact
 * editor as their "Source" view (via `forceSource`, which is how
 * `MaterialSurface`'s own toggle mounts it without recursing back into
 * the material renderer); image/pdf/unsupported binary have no source
 * text to show at all. */
export function FileSurface({binding,forceSource}:{binding:SurfaceBinding;forceSource?:boolean}) {
  const format=detectFormat({path:binding.location?.path});
  if(!forceSource&&format!=="text"){
    return <MaterialSurface binding={binding} format={format}/>;
  }
  const {transport}=useKernel();
  const [reading,setReading]=useState<NativeFileReading>();
  const [draft,setDraft]=useState<HeldDraft>();const held=useRef(draft);held.current=draft;
  const [error,setError]=useState<string>();const [pending,setPending]=useState(false);
  const [history,setHistory]=useState<FileHistory>();const [preview,setPreview]=useState<FilePreview>();
  const body=useRef<HTMLTextAreaElement>(null);const scroll=useRef<HTMLDivElement>(null);const scrollKey=`oi-cradle.file-scroll:${binding.id}`;
  const caretKey=`oi-cradle.file-caret:${binding.id}`;
  const dirty=!!draft&&draft.content!==draft.saved_content;
  const conflict=!!reading&&!!draft&&reading.revision!==draft.base_revision&&dirty;
  const writable=reading?.operations?.write.available===true;
  const read=async(preserve=true)=>{
    if(!binding.location)throw new Error("The saved file location is unavailable");
    const value=await readFile(transport,binding.location);setReading(value);
    const local=preserve?(held.current??readDraft(binding.ref!)):undefined;
    if(!local||local.content===local.saved_content){setDraft({content:value.content,saved_content:value.content,base_revision:value.revision});}
    else setDraft(local);
    return value;
  };
  useEffect(()=>{
    let live=true;setPending(true);setError(undefined);
    if(!binding.location){setError("The saved file location is unavailable");setPending(false);return;}
    void readFile(transport,binding.location).then(value=>{
      if(!live)return;setReading(value);setDraft(readDraft(binding.ref!)??{content:value.content,saved_content:value.content,base_revision:value.revision});
      requestAnimationFrame(()=>{try{if(body.current){if(scroll.current)scroll.current.scrollTop=Number(localStorage.getItem(scrollKey)??0); const caret=JSON.parse(localStorage.getItem(caretKey)??"null"); if(caret && Number.isInteger(caret.start) && Number.isInteger(caret.end)) body.current.setSelectionRange(caret.start,caret.end,caret.direction);}}catch{}});
    }).catch(error=>{if(live)setError(String(error));}).finally(()=>{if(live)setPending(false);});
    const sync=(event:StorageEvent)=>{if(event.key===`oi-cradle.draft.v1:${binding.ref}`){const saved=readDraft(binding.ref!);if(saved)setDraft(saved);}};
    window.addEventListener('storage',sync);return()=>{live=false;window.removeEventListener('storage',sync);};
  },[binding.ref]);
  const perform=async(run:()=>Promise<void>)=>{setPending(true);setError(undefined);try{await run();}catch(error){setError(String(error));}finally{setPending(false);}};
  const change=(content:string)=>{if(!draft)return;const next={...draft,content};setDraft(next);try{writeDraft(binding.ref!,next);}catch{setError("Typing remains open, but this device could not retain the draft. Keep this view open.");}};
  const save=()=>perform(async()=>{
    if(!draft||!binding.location)return;
    const result=await fileOperation<FileMutation>(transport,binding.location,{action:"write",expected_revision:draft.base_revision,content:draft.content});
    if(result.outcome==="conflict"){setReading(result.current);setError("The file changed. Your draft is retained; compare the current file before applying it.");return;}
    clearSavedDraft(binding.ref!,draft.content);held.current=undefined;await read(false);setHistory(undefined);setPreview(undefined);
  });
  const loadHistory=(before?:number)=>perform(async()=>{const next=await fileOperation<FileHistory>(transport,binding.location!,{action:"history",limit:30,before});setHistory(previous=>before&&previous?{...next,entries:[...previous.entries,...next.entries]}:next);});
  const compare=(revision:string)=>perform(async()=>{setPreview(await fileOperation<FilePreview>(transport,binding.location!,{action:"recovery_preview",expected_revision:reading!.revision,revision}));});
  const restore=()=>perform(async()=>{
    if(!preview||dirty)return;
    const result=await fileOperation<FileMutation>(transport,binding.location!,{action:"restore",expected_revision:preview.expected_revision,revision:preview.revision});
    if(result.outcome==="conflict"){setReading(result.current);setError("The file changed after this preview. Read and compare it again.");return;}
    held.current=undefined;await read(false);setPreview(undefined);setHistory(undefined);
  });
  return <section className="native-file-surface" aria-label={`File ${binding.title}`} aria-busy={pending}>
    <header className="source-status"><span className="source-location">Central / {binding.location?.path}</span><span className="source-clean-marker">{error&&reading?"Last reading · Read only":dirty?"Unsaved":writable?"Saved":"Read only"}</span><button onClick={()=>void perform(async()=>{await read();})} disabled={pending}>Refresh</button>{reading?.operations?.history.available&&<button onClick={()=>void loadHistory()} disabled={pending}>History</button>}{writable&&<button onClick={()=>void save()} disabled={pending||!dirty||conflict}>Save</button>}</header>
    {error&&<p role="alert" className="source-note">{error}</p>}
    {pending&&!reading&&<Loading label="Reading file…" scope="surface"/>}
    {conflict&&<section className="file-conflict" aria-label="File conflict"><p>Current file differs from your draft’s basis.</p><textarea readOnly aria-label="Current file" value={reading!.content}/><button disabled={pending} onClick={()=>{const next={...draft!,base_revision:reading!.revision,saved_content:reading!.content};setDraft(next);try{writeDraft(binding.ref!,next);}catch{setError("Could not retain the updated draft basis.");}}}>Use current revision as draft basis</button></section>}
    {history&&<section className="file-history" aria-label="File history"><button onClick={()=>{setHistory(undefined);setPreview(undefined);}}>Close history</button>{history.entries.length===0&&<p>No changes recorded by Central.</p>}{history.entries.map(entry=><div key={entry.cursor}><span>{entry.actor} · {entry.actor_kind}</span><button onClick={()=>void compare(entry.previous_revision)} disabled={pending}>Compare before change {entry.cursor}</button><button onClick={()=>void compare(entry.revision)} disabled={pending}>Compare change {entry.cursor}</button></div>)}{history.more&&<button disabled={pending} onClick={()=>void loadHistory(history.next_before??undefined)}>Earlier changes</button>}</section>}
    {preview&&<section className="file-recovery" aria-label="File recovery preview"><label>Current<textarea aria-label="Current recovery basis" readOnly value={preview.current_content}/></label><label>Recovery<textarea aria-label="Recovery content" readOnly value={preview.content}/></label><button disabled={pending||dirty||!reading?.operations?.restore.available} onClick={()=>void restore()}>Restore this revision</button>{dirty&&<p>Save or resolve the open draft before restoring a revision.</p>}<button onClick={()=>setPreview(undefined)}>Close preview</button></section>}
    {reading&&draft&&<div className="source-editor-scroll" ref={scroll} onScroll={event=>{try{localStorage.setItem(scrollKey,String(event.currentTarget.scrollTop));}catch{}}}><div className="source-editor-body"><div className="source-gutter" aria-hidden="true">{Array.from({length:Math.max(1,draft.content.split("\n").length)},(_,i)=><span key={i}>{i+1}</span>)}</div><textarea ref={body} className="source-textarea" aria-label={`${writable?"Editing":"Reading"} ${binding.title}`} readOnly={!writable||pending} value={draft.content} onChange={event=>change(event.target.value)} spellCheck={false} onSelect={event=>{const el=event.currentTarget;try{localStorage.setItem(caretKey,JSON.stringify({start:el.selectionStart,end:el.selectionEnd,direction:el.selectionDirection}));}catch{}}}/></div></div>}
    {reading&&draft&&<div className="source-editor-foot"><span className="source-foot-revision" title={reading.revision}>{reading.revision?`Rev …${reading.revision.slice(-12)}`:"Rev —"}</span><span>UTF-8 · LF</span></div>}
  </section>;
}
