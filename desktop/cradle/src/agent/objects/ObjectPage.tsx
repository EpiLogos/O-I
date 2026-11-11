import {Fragment,useCallback,useEffect,useRef,useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {Glyph} from "../../workspace/Glyph";
import {escapedJson,escapedText,oneLineText} from "../../shared/plainText";
import {objectKindOf,openIntent,openObject,type ObjectReading,type ObjectRef,type ObjectKindDef} from "./registry";
import {subjectLabel,isInternalReference} from "../../../../../shared-field/presentation-text.mjs";
import "./objects.css";

/**
 * One object's page (10-SIDEBARS §4.7): labelled fields first — what it is,
 * its state, who changed it and when, its relations — then its content, and
 * verbatim material only behind "Show raw". The page reads its object from
 * the registered kind each time it mounts; a refused read says what could
 * not be read and offers Retry. `onBack` shows ← back (full-page modes);
 * "Pop out" (or ⌥-click on a relation) asks the frame for its own window.
 */
export function ObjectPage({object,onBack}:{object:ObjectRef;onBack?:()=>void}) {
 const kernel=useKernel();
 const def=objectKindOf(object.kind);
 const key=JSON.stringify([object.kind,object.ref,object.project]);
 const [held,setHeld]=useState<{key:string;reading?:ObjectReading;error?:string}>();
 const reading=held?.key===key?held.reading:undefined;
 const error=held?.key===key?held.error:undefined;
 const epoch=useRef(0);
 const [loading,setLoading]=useState(false);
 const read=useCallback(async()=>{
  if(!def)return;
  const request=++epoch.current;
  setLoading(true);setHeld(current=>current?.key===key?{key,reading:current.reading}:undefined);
  try{const next=await def.read(object,{transport:kernel.transport});if(epoch.current===request)setHeld({key,reading:next});}
  catch(reason){if(epoch.current===request)setHeld({key,error:reason instanceof Error?reason.message:String(reason)});}
  finally{if(epoch.current===request)setLoading(false);}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[def,object.kind,object.ref,object.project,kernel.transport]);
 useEffect(()=>{void read();return()=>{++epoch.current;};},[read]);
 return <ObjectPageReading object={object} def={def} reading={reading} error={error} loading={loading} onBack={onBack} onRetry={()=>void read()}/>;
}

/** One present owner reading; identities remain bound to the opening operation. */
/** A relation's words as drawn: one plain line (be2l ruling 8). */
const shownText=(text:string|undefined)=>text===undefined?undefined:oneLineText(text);
export function ObjectPageReading({object,def,reading,error,loading,onBack,onRetry}:{object:ObjectRef;def?:ObjectKindDef;reading?:ObjectReading;error?:string;loading?:boolean;onBack?:()=>void;onRetry?:()=>void}) {
 // The title, the kind's label, the state and a related object's name are the owner's words (be2n ruling 4; DLW build ruling 2026-11-11):
 // each is drawn on one plain line, and one that shows nothing gives way: the title to the opening object's, then to the page's own word.
 const title=oneLineText(subjectLabel(reading,""))||oneLineText(subjectLabel(object,""))||"Unnamed object";
 const kindLabel=shownText(reading?.kindLabel)||def?.label||"Object",state=shownText(reading?.state);
 return <article className="object-page" aria-label={`${def?.label??"Object"}: ${title}`} data-object-kind={object.kind} data-object-ref={object.ref}>
  <header className="object-head">
   {onBack&&<button type="button" className="oi-action object-back" onClick={onBack}><Glyph name="back" size={12}/>Back</button>}
   <div className="object-heading">
    <p className="object-kind">{kindLabel}</p>
    <h1 className="object-title">{title}</h1>
    {state&&<p className="object-state">{state}</p>}
   </div>
   <button type="button" className="oi-action object-popout" title="Open this page in its own window" onClick={()=>openObject(object,{popOut:true})}><Glyph name="external" size={12}/>Pop out</button>
  </header>
  {!def&&<><p className="object-note" role="status">This kind of object has no registered page yet.</p><details className="object-raw"><summary>Source and identity</summary><dl><dt>Kind</dt><dd>{oneLineText(object.kind)}</dd><dt>Reference</dt><dd>{oneLineText(object.ref)}</dd></dl></details></>}
  {def&&loading&&!reading&&<p className="object-note" role="status">Reading {def.label.toLowerCase()}…</p>}
  {def&&loading&&reading&&<p className="object-note" role="status">Refreshing this reading…</p>}
  {error&&<div className="object-error"><p role="alert">Couldn&apos;t read this {def?.label.toLowerCase()??"object"}. <button type="button" className="oi-action" onClick={onRetry}>Retry</button></p><details><summary>Reading details</summary><p>{oneLineText(error)}</p><p>{oneLineText(object.ref)}</p></details></div>}
  {reading&&<>
   <dl className="object-fields">
    {reading.fields.map(field=>{const label=oneLineText(field.label),value=typeof field.value==="string"?oneLineText(field.value):field.value;return <Fragment key={field.label}><dt>{label}</dt><dd>{isInternalReference(value)?<details><summary>Inspect {label.toLowerCase()}</summary>{value}</details>:value}</dd></Fragment>;})}
    {reading.relations&&reading.relations.length>0&&<><dt>Relations</dt><dd><ul className="object-relations">{reading.relations.map((relation,index)=><li key={index}><span className="object-relation-label">{oneLineText(relation.label)}</span>{relation.object?<button type="button" className="object-link" data-object-ref={relation.object.ref} title="Open — ⌥-click pops it out" onClick={event=>openObject(relation.object!,openIntent(event))}>{oneLineText(subjectLabel(relation.object,`Unnamed related object ${index+1}`))||`Unnamed related object ${index+1}`}</button>:isInternalReference(shownText(relation.text))?<details><summary>Inspect related source {index+1}</summary>{shownText(relation.text)}</details>:<span>{shownText(relation.text)}</span>}</li>)}</ul></dd></>}
   </dl>
   {reading.raw!==undefined&&<details className="object-raw"><summary>Show raw</summary><pre>{typeof reading.raw==="string"?escapedText(reading.raw):escapedJson(reading.raw,1)}</pre></details>}
   {reading.content!==undefined&&<div className="object-content">{reading.content}</div>}
  </>}
 </article>;
}
