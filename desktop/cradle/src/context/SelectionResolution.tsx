import {useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {knowledge} from "../knowledge/client";
import {normalizeResolution} from "../knowledge/SearchOverlay";
import type {KnowledgeAddress,KnowledgeReading} from "../kernel/types";

type Resolution=ReturnType<typeof normalizeResolution>;
/** The same native Resolve / Explain services as universal Search. Resolving
 * an expression never fetches source bodies, alters preparation, or invokes
 * its candidate Actions. The person can inspect the result before any act. */
export function SelectionResolution({project,expression}:{project?:string;expression:string}) {
 const {transport}=useKernel();const epoch=useRef(0);
 const [result,setResult]=useState<Resolution>();const [error,setError]=useState<string>();
 const [busy,setBusy]=useState(false);const [explanation,setExplanation]=useState<KnowledgeReading>();
 useEffect(()=>{epoch.current++;setResult(undefined);setError(undefined);setExplanation(undefined);setBusy(false);return()=>{epoch.current++;};},[project,expression,transport]);
 const resolve=async()=>{
  const request=++epoch.current;setBusy(true);setError(undefined);setExplanation(undefined);
  try{const value=await knowledge<unknown>(transport,project,{action:"resolve",query:expression});if(epoch.current===request)setResult(normalizeResolution(value));}
  catch(e){if(epoch.current===request)setError(String(e));}finally{if(epoch.current===request)setBusy(false);}
 };
 const explain=async(address:KnowledgeAddress)=>{
  const request=++epoch.current;setBusy(true);setError(undefined);
  try{const value=await knowledge<KnowledgeReading>(transport,project,{action:"explain",address});if(epoch.current===request)setExplanation(value);}
  catch(e){if(epoch.current===request)setError(String(e));}finally{if(epoch.current===request)setBusy(false);}
 };
 const count=(result?.hits.length??0)+(result?.rows.length??0);
 return <div className="context-resolution">
  <button type="button" className="oi-action" disabled={busy||!expression.trim()} onClick={()=>void resolve()}>{busy?"Resolving…":"Resolve expression"}</button>
  {error&&<p role="alert" className="oi-note">{error}</p>}
  {result&&<><p className="oi-note">{count} resolved references · preparation is unchanged</p>
   <ul>{result.hits.slice(0,8).map((hit,index)=><li key={`${hit.resource}:${index}`}><span title={hit.resource}>{hit.label}</span> <small>{hit.provider}</small> <button type="button" className="oi-action" disabled={busy} onClick={()=>void explain(hit.address)}>Explain</button></li>)}
   {result.rows.slice(0,Math.max(0,8-result.hits.length)).map((row,index)=><li key={`${row.reference}:${index}`} title={row.reference}>{row.label} <small>{row.owner}</small></li>)}</ul>
   {count>8&&<p className="oi-note">Showing 8 of {count} references.</p>}
   {result.absences.map((absence,index)=><p className="oi-note" key={index}>{absence}</p>)}
  </>}
  {explanation&&<p className="oi-note">{explanation.why_selected??"The owner supplied no selection explanation."}</p>}
 </div>;
}
