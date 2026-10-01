import type {KnowledgeHit} from "../kernel/types";
import {subjectLabel,isInternalReference} from "../../../../shared-field/presentation-text.mjs";

export const searchHitTitle=(hit:Pick<KnowledgeHit,"label">,index?:number):string=>subjectLabel(hit,`Unnamed result${index===undefined?"":` ${index+1}`}`);
export const searchKindLabel=(kind:string):string=>({"knowledge-source":"Source","wiki-node":"Knowledge page","wiki-space":"Wiki collection",file:"File",source:"Source",flow:"Flow",skill:"Skill","knowledge-subject":"Subject",participant:"Participant",agent:"Agent"})[kind]??"Subject";
export const searchOwnerLabel=(owner:string):string=>({central:"Central",aikit:"AIKit","shared-field":"Shared field"})[owner]??(/^provider[/:]/.test(owner)?"Knowledge source":subjectLabel(owner,"Native source"));
export const searchHitDescription=(hit:Pick<KnowledgeHit,"kind"|"snippet">):string=>`${searchKindLabel(hit.kind)}${hit.snippet&&!isInternalReference(hit.snippet)?` · ${hit.snippet}`:""}`;

export function SearchReadingFailure({error,label="Search reading unavailable"}:{error:string;label?:string}) {
 return <div><p role="alert">{label}. Retry the search to read the current sources.</p><details><summary>Reading details</summary><p>{error}</p></details></div>;
}

/** The opening and explaining closures keep the exact admitted address. */
export function NativeSearchHit({hit,index,selected,onSelect,onOpen,onExplain}:{hit:KnowledgeHit;index:number;selected:boolean;onSelect:()=>void;onOpen:()=>void;onExplain:()=>void}) {
 const title=searchHitTitle(hit,index);
 return <>
  <button className="search-result" id={`knowledge-search-${index}`} data-resource-ref={hit.resource} aria-current={selected?"true":undefined}
    onFocus={onSelect} onPointerMove={onSelect} onClick={onOpen}>
   <span className="search-result-kind" aria-hidden="true">↗</span><span className="search-result-copy"><strong>{title}</strong><small>{searchHitDescription(hit)}</small></span>
  </button>
  <button className="search-row-more" aria-label={`Explain ${title}`} onClick={onExplain}>Explain</button>
 </>;
}
