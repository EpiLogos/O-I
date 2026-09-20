import {createElement,useEffect,useId,useMemo,useRef,useState,type ReactNode} from 'react';
import type {KnowledgeReading,KernelTransportStatus} from '../kernel/types';
import type {SurfaceBinding} from '../surface/types';
import {registerPageObservation} from '../context/ComponentSelection';
import {knowledge} from './client';
import {wikiDocument,nodeText,occurrenceFor,resolveWikiAnchor,safeExternalLink,sourceSlice,type MarkdownNode,type WikiAnchor,type WikiNavigate,type WikiOccurrence} from './wikiDocument';
import './wikiReader.css';

type Props = {reading:KnowledgeReading;onNavigate?:WikiNavigate;anchor?:WikiAnchor;transport?:KernelTransportStatus;project?:string;binding?:SurfaceBinding;onSelectSource?:(reading:KnowledgeReading,anchor:WikiAnchor)=>void};
/** One reader for the native Markdown facet. No parser, resolver, raw HTML
 * injection, source write or ambient Agent disclosure lives in this component. */
export function WikiReader({reading,onNavigate,anchor,transport,project,binding,onSelectSource}:Props) {
  const root=useRef<HTMLDivElement>(null),prefix=useId().replace(/:/g,'');
  const [notice,setNotice]=useState<string>(),[preview,setPreview]=useState<{occurrence:WikiOccurrence;reading?:KnowledgeReading;error?:string}>();
  const [selection,setSelection]=useState<{text:string;start:number;end:number;bounds:DOMRect}>();
  const request=useRef<AbortController>();
  const parsed=useMemo(()=>{try{return {document:wikiDocument(reading)};}catch(error){return {error:String(error)};}},[reading]);
  const document=parsed.document;
  const prefixId=(id:string)=>`${prefix}-${id}`;
  useEffect(()=>{setPreview(undefined);setSelection(undefined);request.current?.abort();return()=>request.current?.abort();},[reading.resource,reading.revision]);
  useEffect(()=>{
    setNotice(undefined);
    if(!document||!anchor||!root.current)return;
    const resolved=resolveWikiAnchor(document,anchor);
    if(resolved.issue){setNotice(resolved.issue);return;}
    if(resolved.id){const target=root.current.querySelector<HTMLElement>(`[data-wiki-anchor="${CSS.escape(resolved.id)}"]`);
      if(target){target.scrollIntoView({block:'start'});target.focus({preventScroll:true});}
      else setNotice('The exact linked passage is no longer present at its recorded position.');}
  },[document,anchor]);
  const showPreview=(occurrence:WikiOccurrence)=>{
    if(!transport||!occurrence.target||occurrence.state!=='resolved')return;
    request.current?.abort();const stop=new AbortController();request.current=stop;setPreview({occurrence});
    void knowledge<KnowledgeReading>(transport,project,{action:'read',address:occurrence.target},{signal:stop.signal}).then(value=>{if(!stop.signal.aborted)setPreview({occurrence,reading:value});},error=>{if(!stop.signal.aborted)setPreview({occurrence,error:String(error)});});
  };
  const follow=(occurrence:WikiOccurrence,label:string)=>{
    if(occurrence.state!=='resolved'||!occurrence.target){setNotice(occurrence.state==='ambiguous'?'This link has several native candidates; disambiguate the source link.':'This link is unresolved in the available source field.');return;}
    const fragment=occurrence.evidence?.fragment;
    onNavigate?.(occurrence.target,label,{fragment:fragment??undefined});
  };
  const pick=()=>{
    const selected=window.getSelection();if(!selected?.rangeCount||selected.isCollapsed||!root.current){setSelection(undefined);return;}
    const range=selected.getRangeAt(0),text=selected.toString().trim();
    if(!text||text.length>12000||!root.current.contains(range.commonAncestorContainer)){setSelection(undefined);return;}
    const element=range.commonAncestorContainer instanceof Element?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
    const block=element?.closest<HTMLElement>('[data-wiki-start]');
    if(!block||!root.current.contains(block)){setSelection(undefined);return;}
    setSelection({text,start:Number(block.dataset.wikiStart),end:Number(block.dataset.wikiEnd),bounds:range.getBoundingClientRect()});
  };
  const addContext=()=>{
    if(!selection||!transport||!binding||!document)return;
    const chosen=selection,basis=reading;
    const raw=sourceSlice(basis.content??'',chosen.start,chosen.end);
    const observationKey=registerPageObservation(chosen.text,async()=>{
      const current=await knowledge<KnowledgeReading>(transport,project,{action:'read',address:{kind:'source',value:basis.resource}},{fresh:true});
      return current.revision===basis.revision&&sourceSlice(current.content??'',chosen.start,chosen.end)===raw;
    });
    window.dispatchEvent(new CustomEvent('oi:context-candidate',{detail:{bindingId:binding.id,kind:'element',documentId:`wiki:${reading.resource}@${reading.revision??'unknown'}`,nodeRef:reading.resource,workingCopy:false,text:chosen.text,sourceRef:reading.resource,revision:reading.revision,observationKey,selector:`markdown:bytes:${chosen.start}-${chosen.end}; quote=${JSON.stringify(chosen.text)}`,role:'text',bounds:{x:chosen.bounds.x,y:chosen.bounds.y,width:chosen.bounds.width,height:chosen.bounds.height}}}));
    setSelection(undefined);
  };
  const render=(node:MarkdownNode,index:number,inHead=false):ReactNode=>{
    const children=(node.children??[]).map((child,i)=>render(child,i,inHead||node.kind==='table-head'));
    const attrs=node.attributes??{},props={key:`${node.kind}:${node.start_byte}:${index}`,'data-wiki-start':node.start_byte,'data-wiki-end':node.end_byte,'data-wiki-anchor':typeof attrs.id==='string'?attrs.id:`wiki-span-${node.start_byte}`,id:prefixId(typeof attrs.id==='string'?attrs.id:`span-${node.kind}-${node.start_byte}-${index}`),tabIndex:-1};
    switch(node.kind){
      case 'text': return <span {...props}>{node.text}</span>;
      case 'paragraph': return <p {...props}>{children}</p>;
      case 'heading': return createElement(`h${Math.max(1,Math.min(6,Number(attrs.level)||2))}`,props,children);
      case 'blockquote': return <blockquote {...props}>{children}</blockquote>;
      case 'list': return attrs.start!==undefined?<ol {...props} start={Number(attrs.start)}>{children}</ol>:<ul {...props}>{children}</ul>;
      case 'item': return <li {...props}>{children}</li>;
      case 'strong': return <strong {...props}>{children}</strong>;
      case 'emphasis': return <em {...props}>{children}</em>;
      case 'strikethrough': return <del {...props}>{children}</del>;
      case 'code': return <code {...props}>{node.text}</code>;
      case 'code-block': return <pre {...props}><code>{children}</code></pre>;
      case 'table': return <div {...props} className="wiki-table"><table>{children}</table></div>;
      case 'table-head': return <thead key={props.key}><tr>{children}</tr></thead>;
      case 'table-row': return <tbody key={props.key}><tr>{children}</tr></tbody>;
      case 'table-cell': return inHead?<th {...props}>{children}</th>:<td {...props}>{children}</td>;
      case 'task': return <input key={props.key} type="checkbox" checked={attrs.checked===true} readOnly aria-label={attrs.checked?'Completed item':'Incomplete item'}/>;
      case 'rule': return <hr {...props}/>;
      case 'soft-break': return '\n';
      case 'hard-break': return <br key={props.key}/>;
      case 'raw-html': return <code {...props} className="wiki-literal-html">{node.text??children}</code>;
      case 'footnote': return <aside {...props} aria-label={`Footnote ${String(attrs.label??'')}`}>{children}</aside>;
      case 'footnote-reference': return <sup {...props}>{node.text}</sup>;
      case 'image':
      case 'link': {
        const occurrence=document&&occurrenceFor(document,node),destination=typeof attrs.destination==='string'?attrs.destination:'';
        const external=occurrence?.state==='external'?safeExternalLink(destination):undefined;
        // Remote images are an explicit open, not a tracking request on page read.
        if(external)return <a {...props} tabIndex={0} href={external} target="_blank" rel="noopener noreferrer">{node.kind==='image'?`Image: ${nodeText(node)||destination}`:children}<span className="wiki-link-mark" aria-label="external link">↗</span></a>;
        const label=nodeText(node)||destination;
        return <button {...props} type="button" role="link" tabIndex={0} className="wiki-inline-link" data-link-state={occurrence?.state??'unresolved'} data-target-ref={occurrence?.target?.value} data-occurrence-ref={occurrence?.reference} title={destination} onClick={()=>occurrence?follow(occurrence,label):setNotice('This link has no native resolution in the current reading.')} onMouseEnter={()=>occurrence&&showPreview(occurrence)} onFocus={()=>occurrence&&showPreview(occurrence)}>{node.kind==='image'?'Image: ':''}{children.length?children:label}{occurrence?.state!=='resolved'&&<span className="wiki-link-mark">?</span>}</button>;
      }
      default:return <span {...props}>{node.text}{children}</span>;
    }
  };
  if(parsed.error)return <><p role="alert">{parsed.error}</p><pre className="knowledge-prose">{reading.content}</pre></>;
  if(!document)return <div className="knowledge-prose">{reading.content??'The owner returned no content body.'}</div>;
  return <div className="wiki-reader" ref={root} onMouseUp={pick} onKeyUp={event=>{if(event.shiftKey)pick();if(event.key==='Escape'){setPreview(undefined);setSelection(undefined);request.current?.abort();}}} data-source-ref={reading.resource} data-source-revision={reading.revision}>
    <div className="wiki-reader-tools">
      {document.selectors.some(item=>item.kind==='heading')&&<details><summary>On this page</summary><nav aria-label="Page outline">{document.selectors.filter(item=>item.kind==='heading').map(item=><a key={item.id} href={`#${prefixId(item.id)}`} onClick={event=>{event.preventDefault();root.current?.querySelector<HTMLElement>(`[data-wiki-anchor="${CSS.escape(item.id)}"]`)?.scrollIntoView({block:'start'});}}>{item.keys[0]}</a>)}</nav></details>}
      {document.syntax.tags?.length>0&&<div aria-label="Source tags" className="wiki-tags">{document.syntax.tags.map(tag=><span key={tag}>#{tag}</span>)}</div>}
    </div>
    {notice&&<p role="status">{notice}</p>}
    {document.syntax.warnings?.map((warning,index)=><p role="status" key={index}>{warning}</p>)}
    <div className="wiki-prose">{document.syntax.blocks.map((node,i)=>render(node,i))}</div>
    {selection&&<div className="wiki-selection-tools" role="toolbar" aria-label="Selected passage"><span>{selection.text.slice(0,72)}</span>{binding&&transport&&<button type="button" className="oi-action" onMouseDown={event=>event.preventDefault()} onClick={addContext}>Add to Context</button>}{onSelectSource&&<button type="button" className="oi-action" onClick={()=>{onSelectSource(reading,{revision:reading.revision,start_byte:selection.start,end_byte:selection.end});setSelection(undefined);}}>Add to constellation</button>}</div>}
    {preview&&<aside className="wiki-link-preview" aria-label="Link preview"><header><strong>{preview.reading?.resource??preview.occurrence.target?.value}</strong><button type="button" className="oi-tool" aria-label="Close link preview" onClick={()=>{request.current?.abort();setPreview(undefined);}}>×</button></header>{preview.error?<p role="status">{preview.error}</p>:preview.reading?<p>{preview.reading.content?.slice(0,800)??'No source body was returned.'}</p>:<p role="status">Reading linked source…</p>}<button type="button" className="oi-action" onClick={()=>follow(preview.occurrence,preview.reading?.resource??'Linked source')}>Open linked source</button></aside>}
    <details className="wiki-backlinks" open><summary>Backlinks · {document.incoming.length}</summary>{document.incoming.map((item,index)=><div key={item.reference??`${item.from}:${index}`}><button type="button" className="oi-action" onClick={()=>onNavigate?.(item.address,item.label,{revision:item.evidence.source_revision,start_byte:item.evidence.anchor?.start_byte,end_byte:item.evidence.anchor?.end_byte})}>{item.label}</button><blockquote>{item.evidence.raw_token??item.relation}</blockquote></div>)}{!document.incoming.length&&<p>{document.relations_available?'No backlinks in this reading.':'Backlinks are unavailable from this owner reading.'}</p>}{document.relations_truncated&&<p role="status">The native relation reading is bounded; further backlinks may exist.</p>}</details>
  </div>;
}
