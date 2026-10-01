import {createElement,useEffect,useId,useMemo,useRef,useState,type ReactNode} from 'react';
import type {KnowledgeReading,KernelTransportStatus} from '../kernel/types';
import type {SurfaceBinding} from '../surface/types';
import {registerPageObservation} from '../context/ComponentSelection';
import {knowledge} from './client';
import {wikiDocument,nodeText,occurrenceFor,resolveWikiAnchor,safeExternalLink,sourceSlice,type MarkdownNode,type WikiAnchor,type WikiNavigate,type WikiOccurrence} from './wikiDocument';
import {WikiSourceTools} from './WikiSourceTools';
// @ts-ignore -- one renderer-neutral presentation policy, owned by SharedField.
import {isInternalReference,subjectLabel} from '../../../../shared-field/presentation-text.mjs';
import './wikiReader.css';

type Props = {reading:KnowledgeReading;onNavigate?:WikiNavigate;anchor?:WikiAnchor;transport?:KernelTransportStatus;project?:string;binding?:SurfaceBinding;onSelectSource?:(reading:KnowledgeReading,anchor:WikiAnchor,text:string)=>void|Promise<void>;previewOnly?:boolean};
/** A preview names what its actual native document or authored link names.
 * Missing titles stay explicit; source addresses never become display names. */
export function wikiReadingTitle(reading:KnowledgeReading|undefined,label?:string):string {
  let document;
  try{document=reading&&wikiDocument(reading);}catch{/* A failed facet cannot supply a title. */}
  return subjectLabel({title:document?.syntax.properties.title},subjectLabel({label:document?.syntax.headings[0]?nodeText(document.syntax.headings[0]):label},subjectLabel({label},'Untitled linked source')));
}
export function WikiReadingPreview({reading,label,error,onOpen,onClose}:{reading?:KnowledgeReading;label?:string;error?:string;onOpen:(title:string)=>void;onClose:()=>void}) {
  const title=wikiReadingTitle(reading,label);
  return <aside className="wiki-link-preview" aria-label="Link preview" data-preview-source-ref={reading?.resource}>
    <header><strong>{title}</strong><button type="button" className="oi-tool" aria-label="Close link preview" onClick={onClose}>×</button></header>
    {error?<><p role="status">The linked source could not be read. Open it to retry.</p><details className="oi-disclosure"><summary>Inspect preview failure</summary><p>{error}</p></details></>:reading?<WikiReader reading={reading} previewOnly/>:<p role="status">Reading linked source…</p>}
    {reading&&<details className="oi-disclosure"><summary>Inspect preview source</summary><dl><dt>Reference</dt><dd>{reading.resource}</dd><dt>Revision</dt><dd>{reading.revision??'Not supplied'}</dd><dt>Provider</dt><dd>{reading.provider}</dd></dl></details>}
    <button type="button" className="oi-action" onClick={()=>onOpen(title)}>Open linked source</button>
  </aside>;
}
/** One reader for the native Markdown facet. No parser, resolver, raw HTML
 * injection, source write or ambient Agent disclosure lives in this component. */
export function WikiReader(props:Props) {
  const [revalidated,setRevalidated]=useState<KnowledgeReading>();
  const {onNavigate,anchor,transport,project,binding,onSelectSource,previewOnly}=props;
  const reading=revalidated?.resource===props.reading.resource&&revalidated.revision!==props.reading.revision?revalidated:props.reading;
  useEffect(()=>setRevalidated(undefined),[props.reading]);
  const reread=async()=>{
    if(!transport)return;
    const current=await knowledge<KnowledgeReading>(transport,project,{action:'read',address:{kind:'source',value:props.reading.resource}},{fresh:true});
    if(current.resource!==props.reading.resource)throw new Error('Source refresh returned a different identity.');
    setRevalidated(current);
  };
  const root=useRef<HTMLDivElement>(null),prefix=useId().replace(/:/g,'');
  const [notice,setNotice]=useState<string>(),[preview,setPreview]=useState<{occurrence:WikiOccurrence;label:string;reading?:KnowledgeReading;error?:string}>();
  const [selection,setSelection]=useState<{text:string;start:number;end:number;bounds:DOMRect}>();
  const [selectionBusy,setSelectionBusy]=useState(false);
  const selectForConstruction=async()=>{
    if(!selection||!onSelectSource)return;
    setSelectionBusy(true);setNotice(undefined);
    try{await onSelectSource(reading,{revision:reading.revision,start_byte:selection.start,end_byte:selection.end},selection.text);setSelection(undefined);}
    catch(error){setNotice(error instanceof Error?error.message:String(error));}
    finally{setSelectionBusy(false);}
  };
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
  const showPreview=(occurrence:WikiOccurrence,label:string)=>{
    if(!transport||!occurrence.target||occurrence.state!=='resolved')return;
    request.current?.abort();const stop=new AbortController();request.current=stop;setPreview({occurrence,label});
    void knowledge<KnowledgeReading>(transport,project,{action:'read',address:occurrence.target},{signal:stop.signal}).then(value=>{if(!stop.signal.aborted)setPreview({occurrence,label,reading:value});},error=>{if(!stop.signal.aborted)setPreview({occurrence,label,error:String(error)});});
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
    const nearest=(node:Node)=>(node instanceof Element?node:node.parentElement)?.closest<HTMLElement>('[data-wiki-start]');
    const first=nearest(range.startContainer),last=nearest(range.endContainer);
    if(!first||!last||!root.current.contains(first)||!root.current.contains(last)){setSelection(undefined);return;}
    // Native enclosing spans plus the rendered quote, not invented UTF-16
    // character offsets into Markdown. Multi-paragraph selections stay usable.
    const start=Math.min(Number(first.dataset.wikiStart),Number(last.dataset.wikiStart));
    const end=Math.max(Number(first.dataset.wikiEnd),Number(last.dataset.wikiEnd));
    setSelection({text,start,end,bounds:range.getBoundingClientRect()});
  };
  const addContext=()=>{
    if(!selection||!transport||!binding||!document||!reading.revision)return;
    const chosen=selection,basis=reading;
    const raw=sourceSlice(basis.content??'',chosen.start,chosen.end);
    const observationKey=registerPageObservation(chosen.text,async()=>{
      const current=await knowledge<KnowledgeReading>(transport,project,{action:'read',address:{kind:'source',value:basis.resource}},{fresh:true});
      return current.resource===basis.resource&&current.revision===basis.revision&&sourceSlice(current.content??'',chosen.start,chosen.end)===raw;
    });
    window.dispatchEvent(new CustomEvent('oi:context-candidate',{detail:{bindingId:binding.id,kind:'element',documentId:`wiki:${reading.resource}@${reading.revision}`,nodeRef:reading.resource,workingCopy:false,text:chosen.text,sourceRef:reading.resource,revision:reading.revision,observationKey,selector:`markdown:bytes:${chosen.start}-${chosen.end}; quote=${JSON.stringify(chosen.text)}`,role:'text',bounds:{x:chosen.bounds.x,y:chosen.bounds.y,width:chosen.bounds.width,height:chosen.bounds.height}}}));
    setSelection(undefined);
  };
  const render=(node:MarkdownNode,index:number,inHead=false):ReactNode=>{
    const children=(node.children??[]).map((child,i)=>render(child,i,inHead||node.kind==='table-head'));
    const attrs=node.attributes??{},key=`${node.kind}:${node.start_byte}:${index}`,props={'data-wiki-start':node.start_byte,'data-wiki-end':node.end_byte,'data-wiki-anchor':typeof attrs.id==='string'?attrs.id:`wiki-span-${node.start_byte}`,id:prefixId(typeof attrs.id==='string'?attrs.id:`span-${node.kind}-${node.start_byte}-${index}`),tabIndex:-1};
    switch(node.kind){
      case 'text': return <span key={key} {...props}>{node.text}</span>;
      case 'paragraph': return <p key={key} {...props}>{children}</p>;
      case 'heading': return createElement(`h${Math.max(1,Math.min(6,Number(attrs.level)||2))}`,{key,...props},children);
      case 'blockquote': return <blockquote key={key} {...props}>{children}</blockquote>;
      case 'list': return attrs.start!==undefined?<ol key={key} {...props} start={Number(attrs.start)}>{children}</ol>:<ul key={key} {...props}>{children}</ul>;
      case 'item': return <li key={key} {...props}>{children}</li>;
      case 'strong': return <strong key={key} {...props}>{children}</strong>;
      case 'emphasis': return <em key={key} {...props}>{children}</em>;
      case 'strikethrough': return <del key={key} {...props}>{children}</del>;
      case 'code': return <code key={key} {...props}>{node.text}</code>;
      case 'code-block': return <pre key={key} {...props}><code>{children}</code></pre>;
      case 'table': return <div key={key} {...props} className="wiki-table"><table>{children}</table></div>;
      case 'table-head': return <thead key={key}><tr>{children}</tr></thead>;
      case 'table-row': return <tbody key={key}><tr>{children}</tr></tbody>;
      case 'table-cell': return inHead?<th key={key} {...props}>{children}</th>:<td key={key} {...props}>{children}</td>;
      case 'task': return <input key={key} type="checkbox" checked={attrs.checked===true} readOnly aria-label={attrs.checked?'Completed item':'Incomplete item'}/>;
      case 'rule': return <hr key={key} {...props}/>;
      case 'soft-break': return '\n';
      case 'hard-break': return <br key={key}/>;
      case 'raw-html': return <code key={key} {...props} className="wiki-literal-html">{node.text??children}</code>;
      case 'footnote': return <aside key={key} {...props} aria-label={`Footnote ${String(attrs.label??'')}`}>{children}</aside>;
      case 'footnote-reference': return <sup key={key} {...props}>{node.text}</sup>;
      case 'image':
      case 'link': {
        const occurrence=document&&occurrenceFor(document,node),destination=typeof attrs.destination==='string'?attrs.destination:'';
        const external=occurrence?.state==='external'?safeExternalLink(destination):undefined;
        // Remote images are an explicit open, not a tracking request on page read.
        if(external)return <a key={key} {...props} tabIndex={0} href={external} target="_blank" rel="noopener noreferrer">{node.kind==='image'?`Image: ${nodeText(node)||destination}`:children}<span className="wiki-link-mark" aria-label="external link">↗</span></a>;
        const authored=nodeText(node),label=subjectLabel(authored,'Linked source'),content=isInternalReference(authored)?label:children.length?children:label;
        if(previewOnly)return <span key={key} {...props}>{node.kind==='image'?'Image: ':''}{content}</span>;
        return <button key={key} {...props} type="button" role="link" tabIndex={0} className="wiki-inline-link" data-link-state={occurrence?.state??'unresolved'} data-target-ref={occurrence?.target?.value} data-occurrence-ref={occurrence?.reference} title={label} data-link-destination={destination} onClick={()=>occurrence?follow(occurrence,label):setNotice('This link has no native resolution in the current reading.')} onMouseEnter={()=>occurrence&&showPreview(occurrence,label)} onFocus={()=>occurrence&&showPreview(occurrence,label)}>{node.kind==='image'?'Image: ':''}{content}{occurrence?.state!=='resolved'&&<span className="wiki-link-mark">?</span>}</button>;
      }
      default:return <span key={key} {...props}>{node.text}{children}</span>;
    }
  };
  if(parsed.error)return <><p role="alert">This source's formatted reading is unavailable. Refresh to read it again.</p><details className="oi-disclosure"><summary>Inspect exact source and reading failure</summary><p>{parsed.error}</p><pre className="knowledge-prose">{reading.content}</pre></details></>;
  if(!document)return <><p className="knowledge-muted">No formatted preview is available for this source. Open it to read its material.</p><details className="oi-disclosure"><summary>Inspect exact source</summary><pre className="knowledge-prose">{reading.content??'The owner returned no content body.'}</pre></details></>;
  // Preview complete native blocks, never a substring of Markdown syntax.
  // The full reader remains the same source/revision and supplies onward links.
  if(previewOnly){
    const blocks:MarkdownNode[]=[];let characters=0;
    for(const block of document.syntax.blocks){const length=nodeText(block).length;if(blocks.length>=4||characters+length>1200)break;blocks.push(block);characters+=length;}
    return <div className="wiki-prose" data-source-ref={reading.resource} data-source-revision={reading.revision} data-wiki-preview>{blocks.length?blocks.map((node,i)=>render(node,i)):<p>The first source section is too long for a preview. Open the linked source to read it.</p>}{blocks.length<document.syntax.blocks.length&&<p className="knowledge-muted">More content is available in the linked source.</p>}</div>;
  }
  return <div className="wiki-reader" ref={root} onMouseUp={pick} onKeyUp={event=>{if(event.shiftKey)pick();if(event.key==='Escape'){setPreview(undefined);setSelection(undefined);request.current?.abort();}}} data-source-ref={reading.resource} data-source-revision={reading.revision}>
    <div className="wiki-reader-tools">
      {document.selectors.some(item=>item.kind==='heading')&&<details><summary>On this page</summary><nav aria-label="Page outline">{document.selectors.filter(item=>item.kind==='heading').map(item=><a key={item.id} href={`#${prefixId(item.id)}`} onClick={event=>{event.preventDefault();root.current?.querySelector<HTMLElement>(`[data-wiki-anchor="${CSS.escape(item.id)}"]`)?.scrollIntoView({block:'start'});}}>{item.keys[0]}</a>)}</nav></details>}
      {document.syntax.tags?.length>0&&<div aria-label="Source tags" className="wiki-tags">{document.syntax.tags.map(tag=><span key={tag}>#{tag}</span>)}</div>}
    </div>
    {binding&&transport&&<WikiSourceTools key={reading.resource} reading={reading} binding={binding} onReturn={reread}/>}
    {notice&&<p role="status">{notice}</p>}
    {document.syntax.warnings?.map((warning,index)=><p role="status" key={index}>{warning}</p>)}
    <div className="wiki-prose">{document.syntax.blocks.map((node,i)=>render(node,i))}</div>
    {selection&&<div className="wiki-selection-tools" role="toolbar" aria-label="Selected passage"><span>{selection.text.slice(0,72)}</span>{binding&&transport&&<button type="button" className="oi-action" disabled={!reading.revision} title={!reading.revision?'The owner must supply a source revision before context disclosure':undefined} onMouseDown={event=>event.preventDefault()} onClick={addContext}>Add to Context</button>}{onSelectSource&&<button type="button" className="oi-action" disabled={!reading.revision||selectionBusy} onClick={()=>void selectForConstruction()}>Add to constellation</button>}</div>}
    {preview&&<WikiReadingPreview reading={preview.reading} label={preview.label} error={preview.error} onClose={()=>{request.current?.abort();setPreview(undefined);}} onOpen={title=>follow(preview.occurrence,title)}/>}
    <details className="wiki-backlinks" open><summary>Backlinks · {document.incoming.length}</summary>{document.incoming.map((item,index)=><div key={item.reference??`${item.from}:${index}`}><button type="button" className="oi-action" onClick={()=>onNavigate?.(item.address,subjectLabel(item.label,`Unnamed referring source ${index+1}`),{revision:item.evidence.source_revision,start_byte:item.evidence.anchor?.start_byte,end_byte:item.evidence.anchor?.end_byte})}>{subjectLabel(item.label,`Unnamed referring source ${index+1}`)}</button><details className="oi-disclosure"><summary>Inspect backlink source</summary><blockquote>{item.evidence.raw_token??item.relation}</blockquote><p>{item.from}</p></details></div>)}{!document.incoming.length&&<p>{document.relations_available?'No backlinks in this reading.':'Backlinks are unavailable from this owner reading.'}</p>}{document.relations_truncated&&<p role="status">The native relation reading is bounded; further backlinks may exist.</p>}</details>
  </div>;
}
