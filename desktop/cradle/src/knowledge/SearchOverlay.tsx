import { useEffect, useRef, useState } from "react";
import { useKernel } from "../kernel/KernelProvider";
import type { KnowledgeAddress, KnowledgeHit } from "../kernel/types";
import { knowledge } from "./client";
import {OwnerActions} from "./OwnerActions";
import {graphAddress,type GraphNode} from "./graph";
import { searchLeaderLabel } from "./leader";
import "./knowledge.css";

export function SearchOverlay({project,onClose,onOpen,leader,onLeaderChange,shortcutError}: {leader:boolean;onLeaderChange:(shift:boolean)=>void;shortcutError?:string;project?:string;onClose:()=>void;onOpen:(address:KnowledgeAddress,title:string,project?:string)=>Promise<void>}) {
  const {transport}=useKernel(); const dialog=useRef<HTMLDialogElement>(null);
  const [query,setQuery]=useState(""); const [hits,setHits]=useState<KnowledgeHit[]>([]);
  const [selected,setSelected]=useState(0);
  const [rows,setRows]=useState<{reference:string;kind:GraphNode["kind"];label:string;owner:string;provenance:string[];actions:string[]}[]>([]);
  const [resolutionAbsences,setResolutionAbsences]=useState<string[]>([]);
  const [absences,setAbsences]=useState<string[]>([]); const [error,setError]=useState<string>();
  const [busy,setBusy]=useState(false); const [detail,setDetail]=useState<unknown>();
  // An invoked Action has an owner-side effect (knowledge/open records one
  // familiarity observation), and the owner's resolution reads that back.
  // Re-resolving is how the aperture stays the owner's answer rather than a
  // stale snapshot; the rows return in the owner's own stable order, so each
  // row keeps the dispatch outcome the reader is looking at.
  const [generation,setGeneration]=useState(0);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;
    const field=previous instanceof HTMLTextAreaElement||previous instanceof HTMLInputElement?previous:null;
    const caret=field&&field.selectionStart!==null?{start:field.selectionStart,end:field.selectionEnd,direction:field.selectionDirection}:null;
    const selection=window.getSelection();const ranges=selection?Array.from({length:selection.rangeCount},(_,i)=>selection.getRangeAt(i).cloneRange()):[];
    const modal=dialog.current;modal?.showModal();return()=>{modal?.close();if(previous?.isConnected){previous.focus({preventScroll:true});if(field&&caret)field.setSelectionRange(caret.start,caret.end,caret.direction??undefined);else if(ranges.length){const current=window.getSelection();current?.removeAllRanges();for(const range of ranges)if(range.startContainer.isConnected)current?.addRange(range);}}};},[]);
  useEffect(()=>{
    let active=true;setBusy(true);setError(undefined);setHits([]);setRows([]);setAbsences([]);setResolutionAbsences([]);setSelected(0);
    const timer=setTimeout(()=>{void Promise.allSettled([
      knowledge<{hits:KnowledgeHit[];absences:string[]}>(transport,project,{action:"search",query}),
      knowledge<{rows:typeof rows;absences:string[]}>(transport,project,{action:"resolve",query}),
    ]).then(([search,resolution])=>{if(!active)return;
      if(search.status==="fulfilled"){setHits(search.value.hits);setAbsences(search.value.absences);}else setError(String(search.reason));
      if(resolution.status==="fulfilled"){setRows(resolution.value.rows);setResolutionAbsences(resolution.value.absences);}else setResolutionAbsences([String(resolution.reason)]);
      setBusy(false);
    });},180);
    return()=>{active=false;clearTimeout(timer);};
  },[query,project,transport,generation]);
  const openRow=async(index:number)=>{const row=rows[index];if(!row)return;try{await onOpen(graphAddress({ref:row.reference,kind:row.kind,label:row.label,native_owner:row.owner,provenance:{source:row.owner,detail:row.provenance},actions:row.actions}),row.label,project);onClose();}catch(e){setError(String(e));}};
  const accept=()=>{if(busy)return;if(selected<hits.length&&hits[selected])void open(hits[selected]);else void openRow(selected-hits.length);};
  const navigate=(delta:number)=>{const count=hits.length+rows.length;if(!count)return;setSelected(current=>{const next=(current+delta+count)%count;dialog.current?.querySelector(`[data-search-index="${next}"]`)?.scrollIntoView({block:"nearest"});return next;});};
  const open=async(hit:KnowledgeHit)=>{setError(undefined);try{await onOpen(hit.address,hit.label,project);onClose();}catch(e){setError(String(e));}};
  return <dialog ref={dialog} className="search-aperture" aria-label="Search Central" onKeyDownCapture={e=>{if(e.nativeEvent.isComposing)return;if((e.key==="ArrowDown"||e.key==="ArrowUp")&&e.target instanceof HTMLInputElement){e.preventDefault();navigate(e.key==="ArrowDown"?1:-1);}if(e.key==="Escape"){e.preventDefault();e.stopPropagation();onClose();}}} onCancel={e=>{e.preventDefault();onClose();}}>
    <form onSubmit={e=>{e.preventDefault();accept();}}><input spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" autoFocus aria-label="Search or resolve" type="search" onKeyDown={e=>{if(e.key==="Enter"&&e.nativeEvent.isComposing)e.preventDefault();}} aria-controls="knowledge-search-results" aria-activedescendant={hits.length+rows.length?`knowledge-search-${selected}`:undefined} value={query} onChange={e=>{setQuery(e.target.value);setSelected(0);}} placeholder={`Search ${project ?? "Central"}`} /><button type="button" onClick={onClose}>Esc</button></form>
    <header><span>AIKit · {project ?? "Central"}</span><button onClick={()=>{void knowledge(transport,project,{action:"history"}).then(setDetail).catch(e=>setError(String(e)));}}>History</button></header>
    <label className="search-shortcut">Shortcut <select aria-label="Search shortcut" value={String(leader)} onChange={e=>onLeaderChange(e.target.value==="true")}><option value="false">{searchLeaderLabel(false)}</option><option value="true">{searchLeaderLabel(true)}</option></select></label>
    {shortcutError&&<p role="alert">{shortcutError}</p>}
    {busy&&<p role="status">Resolving…</p>}{error&&<p role="alert">{error}</p>}
    <div id="knowledge-search-results"><ul aria-label="Search results" aria-busy={busy}>{hits.map((hit,index)=><li key={hit.resource} id={`knowledge-search-${index}`} data-search-index={index} aria-current={selected===index?"true":undefined} data-selected={selected===index}><button disabled={busy} onClick={()=>void open(hit)}><strong>{hit.label}</strong><small>{hit.kind} · {hit.snippet}</small></button><button aria-label={`Explain ${hit.label}`} onClick={()=>{void knowledge(transport,project,{action:"explain",address:hit.address}).then(setDetail).catch(e=>setError(String(e)));}}>Explain</button></li>)}</ul>
    <section aria-label="Owner resolution results"><header>Owner resolution</header><div role="list">{rows.map((row,index)=><div role="listitem" className="search-resolution-row" key={`${row.reference}:${index}`} id={`knowledge-search-${hits.length+index}`} data-search-index={hits.length+index} aria-current={selected===hits.length+index?"true":undefined} data-selected={selected===hits.length+index}><button disabled={busy} onClick={()=>void openRow(index)}><strong>{row.label}</strong><small>{row.kind} · {row.owner}</small></button><OwnerActions node={{ref:row.reference,actions:row.actions}} transport={transport} project={project} onDispatched={()=>setGeneration(n=>n+1)}/><details><summary>Provenance</summary><p>{row.reference}</p>{row.provenance.map((detail,i)=><p key={i}>{detail}</p>)}</details></div>)}</div></section></div>
    <p>Query completions are not exposed by the current kernel.</p>
    {resolutionAbsences.length>0&&<details><summary>Resolution provider messages ({resolutionAbsences.length})</summary>{resolutionAbsences.map((absence,i)=><p key={i}>{absence}</p>)}</details>}
    {!busy&&!hits.length&&!rows.length&&!error&&<p>No results in the available native sources.</p>}
    {absences.length>0&&<details><summary>Unavailable sources ({absences.length})</summary>{absences.map(a=><p key={a}>{a}</p>)}</details>}
    {detail!==undefined&&<details open><summary>Owner evidence</summary><pre>{JSON.stringify(detail,null,2)}</pre></details>}
  </dialog>;
}
