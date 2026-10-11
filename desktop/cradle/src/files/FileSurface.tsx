import {TextEditor,EditorCommands,type EditorHandle} from "../editor/lazy";
import {Loading} from "../shared/Loading";
import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode, lazy, Suspense} from "react";
// Material rendering (markdown, page expression, media frames) loads with the first non-text file, not at startup.
const MaterialSurface=lazy(()=>import("../material/MaterialSurface").then((module)=>({default:module.MaterialSurface})));
import {useKernel} from "../kernel/KernelProvider";
import type {NativeFileReading} from "../kernel/types";
import type {SurfaceBinding} from "../surface/types";
import {readDraft,writeDraft,clearSavedDraft,type HeldDraft} from "../workspace/drafts";
import {lastFileReading,fileOperation,type FileMutation,type FileHistory,type FilePreview} from "./client";
import {acquireFileReading,acquireFilePreview,peekFileReading,peekFileState,invalidateFile,captureFileResourceAccess,subscribeResources,fileResourceHostGeneration} from "./resources";
import {detectFormat} from "../material/detect";
import {EditorButton,EditorFrame} from "../editor/EditorChrome";
import {hasLegacyDeviceCopy,recoverLegacyDeviceCopy} from "./legacyRecovery";
import {registerDocumentCheckpoint} from "../document/frame";

/** All writes/history belong to Central. Local storage retains unsaved typing.
 * FND-04: every non-plain-text format delegates entirely to the material
 * renderer — chosen here, before any owner round trip, from the
 * location's extension. HTML/Markdown are text-safe and keep this exact
 * editor as their "Source" view (via `forceSource`, which is how
 * `MaterialSurface`'s own toggle mounts it without recursing back into
 * the material renderer); image/pdf/unsupported binary have no source
 * text to show at all. */
export function FileSurface({binding,forceSource,leadingTools,onView}:{binding:SurfaceBinding;forceSource?:boolean;leadingTools?:ReactNode;onView?:(view:NonNullable<SurfaceBinding["view"]>)=>void}) {
  const format=detectFormat({path:binding.location?.path});
  if(!forceSource&&format!=="text"){
    return <Suspense fallback={null}><MaterialSurface binding={binding} format={format} onView={onView}/></Suspense>;
  }
  const {transport}=useKernel();
  const ownerEpoch=useSyncExternalStore(subscribeResources,fileResourceHostGeneration,fileResourceHostGeneration);
  const subject=JSON.stringify([binding.ref,binding.location,transport,ownerEpoch]);
  const currentSubject=useRef(subject);currentSubject.current=subject;
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const capture=()=>{const access=captureFileResourceAccess(transport);return()=>{if(!mounted.current||currentSubject.current!==subject||!access.current())throw Error("The originating file subject or native access epoch has retired");};};
  const ownerIO=async<T,>(run:()=>Promise<T>):Promise<T>=>{const current=capture();current();const result=await run();current();return result;};
  const readGeneration=useRef(0);
  const draftSubject=JSON.stringify([binding.ref,binding.location]);
  const [readingState,setReadingState]=useState<{subject:string;value:NativeFileReading}>();
  const reading=readingState?.subject===draftSubject?readingState.value:undefined;
  const setReading=(value:NativeFileReading|undefined)=>setReadingState(value?{subject:draftSubject,value}:undefined);
  const [draftState,setDraftState]=useState<HeldDraft>();
  const held=useRef<HeldDraft|undefined>(undefined);
  const heldOwner=useRef<{subject:string;ref?:string}|undefined>(undefined);
  const draft=heldOwner.current?.subject===draftSubject?draftState:undefined;
  const currentHeld=()=>heldOwner.current?.subject===draftSubject?held.current:undefined;
  const setDraft=(next:HeldDraft)=>{
    // A rebound presenter must secure the earlier person's typing under its
    // original canonical identity before accepting a different source.
    const previous=held.current,owner=heldOwner.current;
    if(owner&&owner.subject!==draftSubject&&previous&&previous.content!==previous.saved_content){
      if(!owner.ref)throw Error("The previous dirty file lost its source identity. Keep this view open.");
      writeDraft(owner.ref,previous);
    }
    held.current=next;heldOwner.current={subject:draftSubject,ref:binding.ref};setDraftState(next);
  };
  useEffect(()=>registerDocumentCheckpoint(binding.id,async()=>{
    const copy=held.current;
    if(!copy||copy.content===copy.saved_content)return;
    const ref=heldOwner.current?.ref;
    if(!ref)throw Error("This dirty file has no retained native source identity. Keep its view open.");
    // Local securing remains possible during service loss. Native saving is
    // separately fenced by subject, owner access and the actual CAS basis.
    writeDraft(ref,copy);
  }),[binding.id]);
  const [legacyRecoverable,setLegacyRecoverable]=useState(false);
  const [error,setError]=useState<string>();const [pending,setPending]=useState(false);
  // First-presentation latch (the same inactive-tab law the material
  // renderer holds): an editor that mounted CONCEALED — a restart-restored
  // inactive tab — defers its seed and its owner revalidation until the
  // person actually presents it. The latch only ever turns on, so a live
  // editor's concealment never defers anything.
  const [presentedNow,setPresentedNow]=useState(true);
  const shellRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const wrapper=shellRef.current?.closest('.surface-retained');
    if(!wrapper)return;
    const sync=()=>setPresentedNow(!wrapper.hasAttribute('hidden'));
    sync();
    const observer=new MutationObserver(sync);
    observer.observe(wrapper,{attributes:true,attributeFilter:['hidden']});
    return()=>observer.disconnect();
  },[]);
  const [historyState,setHistoryState]=useState<{subject:string;value:FileHistory}>();
  const [previewState,setPreviewState]=useState<{subject:string;value:FilePreview}>();
  const history=historyState?.subject===draftSubject?historyState.value:undefined;
  const preview=previewState?.subject===draftSubject?previewState.value:undefined;
  const setHistory=(value:FileHistory|undefined)=>setHistoryState(value?{subject:draftSubject,value}:undefined);
  const setPreview=(value:FilePreview|undefined)=>setPreviewState(value?{subject:draftSubject,value}:undefined);
  const recordHistory=(pin:NonNullable<NonNullable<SurfaceBinding["view"]>["fileHistory"]>)=>{restoredHistory.current=JSON.stringify([subject,pin]);onView?.({...binding.view,fileHistory:pin});};
  const restoredHistory=useRef<string|undefined>(undefined);
  const body=useRef<EditorHandle>(null);const scroll=useRef<HTMLDivElement>(null);const scrollKey=`oi-cradle.file-scroll:${binding.id}`;
  const caretKey=`oi-cradle.file-caret:${binding.id}`;
  const [caret,setCaret]=useState({line:1,column:1,selected:false});
  const dirty=!!draft&&draft.content!==draft.saved_content;
  const conflict=!!reading&&!!draft&&reading.revision!==draft.base_revision&&dirty;
  const writable=reading?.operations?.write.available===true;
  // The scroll/caret restore used after both the seeded open and a fresh
  // read — the same localStorage view state, applied once the editor exists.
  const restoreView=()=>{requestAnimationFrame(()=>{try{if(body.current){if(scroll.current)scroll.current.scrollTop=Number(localStorage.getItem(scrollKey)??0);const caret=JSON.parse(localStorage.getItem(caretKey)??"null");if(caret&&Number.isInteger(caret.start)&&Number.isInteger(caret.end))body.current.setSelectionRange(caret.start,caret.end,caret.direction);}}catch{}});};
  const recover=async(reason:unknown,live=()=>true)=>{
    if(!live())return;
    setError(String(reason));setLegacyRecoverable(false);
    if(!binding.location)return;
    try{
      const recovery=await ownerIO(()=>lastFileReading(transport,binding.location!));if(!live())return;
      const retained=recovery.retained?.reading;
      if(retained){setReading(retained);setDraft(currentHeld()??readDraft(binding.ref!)??{content:retained.content,saved_content:retained.content,base_revision:retained.revision});}
      setLegacyRecoverable(recovery.migration_allowed&&!!binding.ref&&hasLegacyDeviceCopy(binding.ref));
    }catch(error){if(live())setError(`${String(reason)} · ${String(error)}`);}
  };
  const read=async(preserve=true)=>{
    if(!binding.location)throw new Error("The saved file location is unavailable");
    const current=capture(),generation=++readGeneration.current;
    const live=()=>{try{current();return generation===readGeneration.current;}catch{return false;}};
    // A re-read is revalidation: invalidate first so the shared seam goes to
    // the owner instead of answering from the entry (its last reading stays
    // resident for peers), then acquire through it.
    invalidateFile(binding.location);
    const value=await acquireFileReading(transport,binding.location).catch(async error=>{await recover(error,live);throw error;});current();if(!live())throw Error("A newer file reading superseded this request");setReading(value);setLegacyRecoverable(false);setError(undefined);
    const local=preserve?(currentHeld()??readDraft(binding.ref!)):undefined;
    if(!local||local.content===local.saved_content){setDraft({content:value.content,saved_content:value.content,base_revision:value.revision});}
    else setDraft(local);
    window.dispatchEvent(new CustomEvent("oi:file-reading-changed",{detail:{ref:binding.ref,reading:value}}));
    window.dispatchEvent(new CustomEvent("oi:file-draft-changed",{detail:{ref:binding.ref}}));
    return value;
  };
  useEffect(()=>{
    let active=true;setPending(true);setError(undefined);setLegacyRecoverable(false);
    // Inactive-tab deferral (WORKSPACE-CONTINUITY): while concealed this
    // editor holds every owner I/O — the seed and the forced revalidation —
    // until first presentation, which re-runs this effect exactly as a
    // fresh open.
    if(!presentedNow){setPending(false);return;}
    if(!binding.location){setError("The saved file location is unavailable");setPending(false);return;}
    let current:()=>void;let qualified=false;
    try{current=capture();qualified=!!captureFileResourceAccess(transport).access;}catch(error){setError(String(error));setPending(false);return;}
    const live=()=>{try{current();return active;}catch{return false;}};
    // Cache-first open (WF2): show the resident reading immediately —
    // presentation only, never authority — then keep today's owner
    // revalidation in the background exactly as this effect always did.
    // The seed keeps the document readable while the check runs (drafting
    // continues on the seeded basis; the CAS still guards the write), so
    // only the not-yet-established round trip stays pending.
    const resident=peekFileReading(binding.location);
    if(resident&&binding.ref){
      setReading(resident);setDraft(readDraft(binding.ref)??{content:resident.content,saved_content:resident.content,base_revision:resident.revision});restoreView();
      setPending(false);
    }
    // Force the owner round trip through the shared seam: the entry the seed
    // came from must not answer the revalidation too. When the open path's
    // read is genuinely still in flight this joins it instead of reloading —
    // one owner round trip for admission, renderer and editor.
    if(!qualified)invalidateFile(binding.location);
    let checking=true;
    void acquireFileReading(transport,binding.location).then(value=>{
      if(!live())return;setReading(value);setDraft(currentHeld()??readDraft(binding.ref!)??{content:value.content,saved_content:value.content,base_revision:value.revision});
      restoreView();
    }).catch(error=>recover(error,live)).finally(()=>{checking=false;if(live())setPending(false);});
    const sync=(event:StorageEvent)=>{if(event.key===`oi-cradle.draft.v1:${binding.ref}`){const saved=readDraft(binding.ref!);if(saved)setDraft(saved);}};
    // A file changed outside the app is picked up when the window comes back to
    // the person, so re-reading is not a control they have to find. The held
    // draft is preserved; only the canonical layer is refreshed.
    const reread=()=>{if(!live()||!document.hasFocus())return;void read(true).catch(()=>{/* read performs native recovery */});};
    const unsubscribe=subscribeResources(()=>{
      if(checking||!live()||peekFileState(binding.location!)?.status!=="loading")return;
      checking=true;
      void acquireFileReading(transport,binding.location!).then(value=>{
        if(!live())return;setReading(value);setError(undefined);
        const local=currentHeld()??readDraft(binding.ref!);
        if(!local||local.content===local.saved_content)setDraft({content:value.content,saved_content:value.content,base_revision:value.revision});
      }).catch(error=>recover(error,live)).finally(()=>{checking=false;});
    });
    window.addEventListener('focus',reread);
    document.addEventListener('visibilitychange',reread);
    window.addEventListener('storage',sync);
    return()=>{active=false;unsubscribe();window.removeEventListener('focus',reread);document.removeEventListener('visibilitychange',reread);window.removeEventListener('storage',sync);};
  },[subject,presentedNow]);
  const perform=async(run:()=>Promise<void>)=>{let current:()=>void;try{current=capture();}catch(error){setError(String(error));return;}setPending(true);setError(undefined);try{await run();current();}catch(error){try{current();setError(String(error));}catch{/* Retired work cannot replace the new subject's result. */}}finally{try{current();setPending(false);}catch{}}};
  const change=(content:string)=>{if(!draft)return;const next={...draft,content};held.current=next;setDraft(next);try{writeDraft(binding.ref!,next);window.dispatchEvent(new CustomEvent("oi:file-draft-changed",{detail:{ref:binding.ref}}));}catch{setError("Typing remains open, but this device could not retain the draft. Keep this view open.");}};
  // ⌘S reaches save() twice for one keystroke — TextEditor's CodeMirror
  // `Mod-s` keymap AND the scroll pane's onKeyDown both call it. A second
  // write launched with the same base revision would land as a conflict
  // against the first write's own advance (visible on large files), so a
  // save already in flight is never re-entered.
  const savingRef=useRef(false);
  const save=()=>perform(async()=>{
    if(savingRef.current||!draft||!binding.location)return;
    savingRef.current=true;
    try{
      const submitted=draft;
      const result=await ownerIO(()=>fileOperation<FileMutation>(transport,binding.location!,{action:"write",expected_revision:submitted.base_revision,content:submitted.content}));
      if(result.outcome==="conflict"){setReading(result.current);setError("The file changed. Your draft is retained; compare the current file before applying it.");return;}
      clearSavedDraft(binding.ref!,submitted.content);const changed=held.current?.content!==submitted.content;if(!changed)held.current=undefined;await read(changed);setHistory(undefined);setPreview(undefined);recordHistory({open:false});
    }finally{savingRef.current=false;}
  });
  const loadHistory=(before?:number)=>perform(async()=>{const next=await ownerIO(()=>fileOperation<FileHistory>(transport,binding.location!,{action:"history",limit:30,before}));setHistory(before&&history?{...next,entries:[...history.entries,...next.entries]}:next);recordHistory({...binding.view?.fileHistory,open:true});});
  const compare=(revision:string)=>perform(async()=>{
    if(!reading||!binding.location)return;
    const expectedRevision=reading.revision;
    setPreview(await ownerIO(()=>acquireFilePreview(transport,binding.location!,expectedRevision,revision)));
    recordHistory({open:true,revision,expectedRevision});
  });
  useEffect(()=>{
    const pin=binding.view?.fileHistory;
    if(!reading||!binding.location||!pin?.open)return;
    const key=JSON.stringify([subject,pin]);
    if(restoredHistory.current===key)return;
    restoredHistory.current=key;
    void perform(async()=>{
      setHistory(await ownerIO(()=>fileOperation<FileHistory>(transport,binding.location!,{action:"history",limit:30})));
      if(pin.revision&&pin.expectedRevision)setPreview(await ownerIO(()=>acquireFilePreview(transport,binding.location!,pin.expectedRevision!,pin.revision!)));
    });
  },[subject,!!reading,binding.view?.fileHistory?.open,binding.view?.fileHistory?.revision,binding.view?.fileHistory?.expectedRevision]);
  const restore=()=>perform(async()=>{
    if(!preview||dirty)return;
    const result=await ownerIO(()=>fileOperation<FileMutation>(transport,binding.location!,{action:"restore",expected_revision:preview.expected_revision,revision:preview.revision}));
    if(result.outcome==="conflict"){setReading(result.current);setError("The file changed after this preview. Read and compare it again.");return;}
    held.current=undefined;await read(false);setPreview(undefined);setHistory(undefined);recordHistory({open:false});
  });
  const recoverDeviceCopy=()=>perform(async()=>{
    if(!binding.location||!binding.ref)return;
    const recovery=await ownerIO(()=>lastFileReading(transport,binding.location!));
    if(!recovery.migration_allowed){setLegacyRecoverable(false);throw Error(recovery.reason);}
    const id=recoverLegacyDeviceCopy(binding.ref,true);setLegacyRecoverable(false);
    window.dispatchEvent(new CustomEvent("oi:recover-device-copy",{detail:{id,title:"Recovered device copy"}}));
  });
  const updateCaret=()=>{const el=body.current;if(!el)return;const before=el.value.slice(0,el.selectionStart),lines=before.split("\n");setCaret({line:lines.length,column:(lines[lines.length-1]?.length??0)+1,selected:el.selectionStart!==el.selectionEnd});try{localStorage.setItem(caretKey,JSON.stringify({start:el.selectionStart,end:el.selectionEnd,direction:el.selectionDirection}));}catch{}};
  const extension=binding.location?.path.split(".").pop()?.toLowerCase();const markdown=extension==="md"||extension==="markdown";const json=extension==="json";
  const formatJson=()=>{if(!draft)return;try{change(`${JSON.stringify(JSON.parse(draft.content),null,2)}\n`);setError(undefined);}catch{setError("JSON could not be formatted because it is not valid.");}};
  return <div ref={shellRef} style={{display:"contents"}}><EditorFrame className="native-file-surface" label={`File ${binding.title}`}
    toolbar={<>{leadingTools}<EditorCommands editor={body} markdown={markdown} readOnly={!writable||pending}/>{json&&<EditorButton onClick={formatJson} disabled={!writable}>Format JSON</EditorButton>}</>}
    footer={<><span className="editor-path" title={`Central / ${binding.location?.path}`}>Central / {binding.location?.path}</span>{reading&&<span>Ln {caret.line}, Col {caret.column}</span>}<span>{error&&reading?"Last reading":dirty?"Unsaved":writable?"Saved":"Read only"}</span>{reading?.operations?.history.available&&<button onClick={()=>void loadHistory()} disabled={pending}>History</button>}{writable&&<button onClick={()=>void save()} disabled={pending||!dirty||conflict}>Save ⌘S</button>}</>}
  >
    {error&&<p role="alert" className="source-note">{error}</p>}
    {legacyRecoverable&&<p className="source-note">A previous device copy remains. Recover it as a separate, unverified draft. <button disabled={pending} onClick={()=>void recoverDeviceCopy()}>Recover previous device copy</button></p>}
    {pending&&!reading&&<Loading label="Reading file…" scope="surface"/>}
    {conflict&&<section className="file-conflict" aria-label="File conflict"><p>Current file differs from your draft’s basis.</p><textarea readOnly aria-label="Current file" value={reading!.content}/><button disabled={pending} onClick={()=>{const next={...draft!,base_revision:reading!.revision,saved_content:reading!.content};setDraft(next);try{writeDraft(binding.ref!,next);window.dispatchEvent(new CustomEvent("oi:file-draft-changed",{detail:{ref:binding.ref}}));}catch{setError("Could not retain the updated draft basis.");}}}>Use current revision as draft basis</button></section>}
    {history&&<section className="file-history" aria-label="File history"><button onClick={()=>{setHistory(undefined);setPreview(undefined);recordHistory({open:false});}}>Close history</button>{history.entries.length===0&&<p>No changes recorded by Central.</p>}{history.entries.map(entry=><div key={entry.cursor}><span>{entry.actor} · {entry.actor_kind}</span><button onClick={()=>void compare(entry.previous_revision)} disabled={pending}>Compare before change {entry.cursor}</button><button onClick={()=>void compare(entry.revision)} disabled={pending}>Compare change {entry.cursor}</button></div>)}{history.more&&<button disabled={pending} onClick={()=>void loadHistory(history.next_before??undefined)}>Earlier changes</button>}</section>}
    {preview&&<section className="file-recovery" aria-label="File recovery preview"><label>Current<textarea aria-label="Current recovery basis" readOnly value={preview.current_content}/></label><label>Recovery<textarea aria-label="Recovery content" readOnly value={preview.content}/></label><button disabled={pending||dirty||!reading?.operations?.restore.available} onClick={()=>void restore()}>Restore this revision</button>{dirty&&<p>Save or resolve the open draft before restoring a revision.</p>}<button onClick={()=>{setPreview(undefined);recordHistory({open:true});}}>Close preview</button></section>}
    {reading&&draft&&<div className="source-editor-scroll" ref={scroll} onScroll={event=>{try{localStorage.setItem(scrollKey,String(event.currentTarget.scrollTop));}catch{}}} onKeyDown={event=>{if((event.metaKey||event.ctrlKey)&&event.code==="KeyS"){event.preventDefault();void save();}}}><div className="source-editor-body"><TextEditor ref={body} binding={binding} sourceRevision={draft.base_revision} workingCopy={dirty} aria-label={`${writable?"Editing":"Reading"} ${binding.title}`} readOnly={!writable||pending} value={draft.content} onChange={change} onSelect={updateCaret} onSave={()=>void save()}/></div></div>}

  </EditorFrame></div>;
}
