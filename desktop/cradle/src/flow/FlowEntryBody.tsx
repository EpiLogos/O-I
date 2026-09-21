import {createElement,useMemo,type ReactNode} from "react";
import type {QlDocEntry} from "./instance";

/** Recover the rich entry/note/media reading from the canvas-completion lane
 * (#411, 5325400), without its competing selection state. Reconstruct passive
 * React elements, not arbitrary innerHTML: no source handlers, native bridge,
 * page styles, global IDs, custom elements or automatic remote media. Source
 * HTML and every original collection remain untouched by this reader. */
const tags=new Set("p div span h1 h2 h3 h4 h5 h6 strong em b i u s del mark code pre blockquote ul ol li br hr table thead tbody tfoot tr th td dl dt dd sup sub a img".split(" "));
const discard=new Set("script style iframe object embed link meta base template form input button textarea select svg math applet video audio source".split(" "));
const text=(value:unknown)=>typeof value==="string"?value:"";
function record(value:unknown):Record<string,unknown>|undefined{return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:undefined;}
export function passiveImage(value:unknown):string|undefined {
 const url=text(value);
 return /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[A-Za-z0-9+/=\r\n]+$/i.test(url)?url:undefined;
}
function passiveLink(value:string):string|undefined {
 if(/[\u0000-\u0020\u007f]/.test(value)||! /^(?:https?:|mailto:|#)/i.test(value))return;
 try{const url=new URL(value,location.href);return ["http:","https:","mailto:"].includes(url.protocol)?value:undefined;}catch{return;}
}
function parseRich(html:string):ReactNode[] {
 const template=document.createElement("template");template.innerHTML=html;
 const render=(node:Node,key:number):ReactNode=>{
  if(node.nodeType===Node.TEXT_NODE)return node.textContent;
  if(node.nodeType!==Node.ELEMENT_NODE)return null;
  const element=node as Element,tag=element.tagName.toLowerCase();
  if(discard.has(tag))return null;
  const children=Array.from(element.childNodes,render);
  if(!tags.has(tag))return createElement("span",{key},children);
  const props:Record<string,unknown>={key};
  for(const name of ["title","lang","dir","data-fixture-id"]){const value=element.getAttribute(name);if(value)props[name]=value;}
  for(const [name,prop] of [["colspan","colSpan"],["rowspan","rowSpan"],["start","start"]]){const value=element.getAttribute(name);if(value&&/^\d{1,3}$/.test(value))props[prop]=Number(value);}
  if(tag==="a"){const href=passiveLink(element.getAttribute("href")??"");if(href){props.href=href;props.target="_blank";props.rel="noopener noreferrer";}}
  if(tag==="img"){const src=passiveImage(element.getAttribute("src"));if(!src)return createElement("span",{key,className:"oi-note"},element.getAttribute("alt")||"Image retained in source; open its material view");return createElement("img",{...props,src,alt:element.getAttribute("alt")??"",loading:"lazy"});}
  return createElement(tag,props,...(tag==="br"||tag==="hr"?[]:children));
 };
 return Array.from(template.content.childNodes,render);
}
export function FlowRichBody({html}:{html:string}){const nodes=useMemo(()=>parseRich(html),[html]);return <>{nodes}</>;}
function anchorState(entry:QlDocEntry|undefined,anchor:string):"current"|"stale"|"ambiguous" {
 if(!entry)return "stale";
 const template=document.createElement("template");template.innerHTML=entry.html;
 const body=template.content.textContent??"";const first=body.indexOf(anchor);
 return first<0?"stale":body.indexOf(anchor,first+1)>=0?"ambiguous":"current";
}
export function FlowEntryBody({entry,entries,notes,media}:{entry:QlDocEntry;entries:QlDocEntry[];notes:unknown[];media:unknown[]}){
 const target=entry.replyTo?entries.find(other=>other.id===entry.replyTo?.entryId):undefined;
 const replyState=entry.replyTo?.anchor?anchorState(target,entry.replyTo.anchor):target?"current":"stale";
 const ownNotes=notes.map(record).filter((note):note is Record<string,unknown>=>!!note&&note.entryId===entry.id);
 const ownMedia=media.map(record).filter((item):item is Record<string,unknown>=>!!item&&item.entry===entry.id);
 return <li className="flow-thread-entry" data-flow-entry={entry.id}>
  <header><span className="flow-thread-who" data-flow-author={entry.author}>{entry.author}</span><time className="flow-thread-when">{entry.at}</time></header>
  <div className="flow-thread-body"><FlowRichBody html={entry.html}/></div>
  {entry.replyTo&&<p className="flow-thread-reply oi-note" data-reply-state={replyState}>Answers {target?`entry ${entries.indexOf(target)+1}`:"an unavailable entry"}{entry.replyTo.anchor&&<> at “{entry.replyTo.anchor}”</>}{replyState!=="current"&&` — ${replyState} anchor; review`}</p>}
  {ownMedia.length>0&&<ul className="flow-thread-media">{ownMedia.map((item,index)=><li key={text(item.id)||index} data-media-id={text(item.id)}>{passiveImage(item.data)?<img src={passiveImage(item.data)} alt={text(item.name)||"Attached image"} loading="lazy"/>:<p className="oi-note">{text(item.name)||text(item.mime)||"Media"} — retained in the document's material view</p>}{text(item.caption)&&<FlowRichBody html={text(item.caption)}/>}</li>)}</ul>}
  {ownNotes.length>0&&<ul className="flow-thread-notes">{ownNotes.map((note,index)=>{const anchor=text(note.anchor);const state=anchor?anchorState(entry,anchor):"whole-entry";return <li key={text(note.id)||index} data-note-id={text(note.id)} data-note-anchor-state={state}>
   <small>{text(note.author)||"F"}{text(note.timing)&&` · ${text(note.timing)}`}</small>{anchor&&<p className="oi-note">“{anchor}”{state!=="current"&&` — ${state} anchor; review`}</p>}<FlowRichBody html={text(note.text)}/>
   {Array.isArray(note.replies)&&note.replies.map((value,index)=>{const reply=record(value);return reply?<div key={text(reply.id)||index} className="flow-thread-note-reply"><small>{text(reply.author)||"F"}</small><FlowRichBody html={text(reply.text)}/></div>:null;})}
  </li>;})}</ul>}
 </li>;
}
