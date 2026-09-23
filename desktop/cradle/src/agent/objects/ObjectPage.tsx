import {Fragment,useCallback,useEffect,useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {Glyph} from "../../workspace/Glyph";
import {objectKindOf,openIntent,openObject,type ObjectReading,type ObjectRef} from "./registry";
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
 const [reading,setReading]=useState<ObjectReading>();
 const [error,setError]=useState<string>();
 const [loading,setLoading]=useState(false);
 const read=useCallback(async()=>{
  if(!def)return;
  setLoading(true);setError(undefined);
  try{setReading(await def.read(object,{transport:kernel.transport}));}
  catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
  finally{setLoading(false);}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[def,object.kind,object.ref,object.project,kernel.transport]);
 useEffect(()=>{void read();},[read]);
 const title=reading?.title??object.title;
 return <article className="object-page" aria-label={`${def?.label??"Object"}: ${title}`} data-object-kind={object.kind} data-object-ref={object.ref}>
  <header className="object-head">
   {onBack&&<button type="button" className="oi-action object-back" onClick={onBack}><Glyph name="back" size={12}/>Back</button>}
   <div className="object-heading">
    <p className="object-kind">{reading?.kindLabel??def?.label??object.kind}</p>
    <h1 className="object-title">{title}</h1>
    {reading?.state&&<p className="object-state">{reading.state}</p>}
   </div>
   <button type="button" className="oi-action object-popout" title="Open this page in its own window" onClick={()=>openObject(object,{popOut:true})}><Glyph name="external" size={12}/>Pop out</button>
  </header>
  {!def&&<p className="object-note" role="status">No page is registered for this kind of object ({object.kind}). Its reference is {object.ref}.</p>}
  {def&&loading&&!reading&&<p className="object-note" role="status">Reading {def.label.toLowerCase()}…</p>}
  {error&&<p className="object-error" role="alert">Couldn&apos;t read this {def?.label.toLowerCase()??"object"}: {error} <button type="button" className="oi-action" onClick={()=>void read()}>Retry</button></p>}
  {reading&&<>
   <dl className="object-fields">
    {reading.fields.map(field=><Fragment key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></Fragment>)}
    {reading.relations&&reading.relations.length>0&&<><dt>Relations</dt><dd><ul className="object-relations">{reading.relations.map((relation,index)=><li key={index}><span className="object-relation-label">{relation.label}</span>{relation.object?<button type="button" className="object-link" title="Open — ⌥-click pops it out" onClick={event=>openObject(relation.object!,openIntent(event))}>{relation.object.title}</button>:<span>{relation.text}</span>}</li>)}</ul></dd></>}
   </dl>
   {reading.raw!==undefined&&<details className="object-raw"><summary>Show raw</summary><pre>{typeof reading.raw==="string"?reading.raw:JSON.stringify(reading.raw,null,1)}</pre></details>}
   {reading.content!==undefined&&<div className="object-content">{reading.content}</div>}
  </>}
 </article>;
}
