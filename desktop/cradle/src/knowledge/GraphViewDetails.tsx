import {useMemo,useState} from 'react';
import type {GraphReading} from './graph';
import type {GraphFilters} from './filters';
import {MAX_EMPHASIS_GROUPS,EMPHASIS_DEFAULT_COLOUR,emphasizeGraph} from './graphEmphasis';

/** Optional view operations live behind one disclosure rather than adding a
 * new permanent panel. Neither operation writes a source or changes topology. */
export function GraphViewDetails({reading,filters,onChange}:{reading:GraphReading;filters:GraphFilters;onChange:(value:GraphFilters)=>void}) {
  const [label,setLabel]=useState(''),[color,setColor]=useState(EMPHASIS_DEFAULT_COLOUR);
  const [formationQuery,setFormationQuery]=useState(''),[limit,setLimit]=useState(40);
  const groups=filters.emphasis??[],collapsed=filters.collapsed??[];
  const nodeLabels=useMemo(()=>new Map(reading.nodes.map(node=>[node.ref,node.label])),[reading.nodes]);
  const formationRows=useMemo(()=>{
    const seen=new Set<string>(),needle=formationQuery.toLocaleLowerCase();
    return (reading.formations??[]).filter(formation=>{
      if(seen.has(formation.ref)||!nodeLabels.has(formation.ref))return false;
      seen.add(formation.ref);
      return !needle||[formation.ref,nodeLabels.get(formation.ref)!].some(value=>value.toLocaleLowerCase().includes(needle));
    });
  },[reading.formations,nodeLabels,formationQuery]);
  const emphasized=useMemo(()=>emphasizeGraph(reading.nodes,groups),[reading.nodes,groups]);
  const add=()=>{
    if(!label.trim()||groups.length>=MAX_EMPHASIS_GROUPS)return;
    onChange({...filters,emphasis:[...groups,{id:`view-group:${crypto.randomUUID()}`,label:label.trim(),color,text:filters.text,kinds:[...filters.kinds],tags:[...filters.tags],enabled:true}]});
    setLabel('');
  };
  return <>
    <details className="knowledge-emphasis-controls"><summary>Emphasis groups · {groups.length}</summary>
      <p className="knowledge-filter-help">Mark subjects using the current name, kind and tag filters. Groups change appearance, not meaning. Earlier groups take precedence.</p>
      <label>Group name<input aria-label="Emphasis group name" maxLength={80} value={label} onChange={event=>setLabel(event.target.value)}/></label>
      <label className="knowledge-filter-check">Colour<input aria-label="Emphasis group colour" type="color" value={color} onChange={event=>setColor(event.target.value)}/></label>
      <button type="button" className="oi-action" disabled={!label.trim()||groups.length>=MAX_EMPHASIS_GROUPS} onClick={add}>Add emphasis group</button>
      <ol aria-label="Emphasis groups">{groups.map((group,index)=><li key={group.id}>
        <label className="knowledge-filter-check"><input type="checkbox" aria-label={`Enable emphasis ${group.label}`} checked={group.enabled} onChange={event=>onChange({...filters,emphasis:groups.map(item=>item.id===group.id?{...item,enabled:event.target.checked}:item)})}/><span className="knowledge-emphasis-swatch" style={{backgroundColor:group.color}} aria-hidden="true"/>{group.label}</label>
        {index>0&&<button type="button" className="oi-tool" aria-label={`Move emphasis ${group.label} earlier`} onClick={()=>{const next=[...groups];[next[index-1],next[index]]=[next[index],next[index-1]];onChange({...filters,emphasis:next});}}>↑</button>}
        <button type="button" className="oi-tool" aria-label={`Remove emphasis ${group.label}`} onClick={()=>onChange({...filters,emphasis:groups.filter(item=>item.id!==group.id)})}>×</button>
      </li>)}</ol>
      {!!groups.length&&<p className="knowledge-filter-help">{emphasized.size} admitted subjects have emphasis. Hidden subjects stay hidden.</p>}
    </details>
    {!!reading.formations?.length&&<details className="knowledge-formation-controls"><summary>Constellation disclosure · {collapsed.length} folded</summary>
      <p className="knowledge-filter-help">Fold a whole to its existing reference. Other open wholes and the selected subject remain visible. Hidden connections are not replaced by invented whole-to-whole lines.</p>
      <label>Find a constellation<input aria-label="Find constellation to fold" type="search" value={formationQuery} onChange={event=>{setFormationQuery(event.target.value);setLimit(40);}}/></label>
      <ul aria-label="Constellation disclosure">{formationRows.slice(0,limit).map(formation=>{
        const folded=collapsed.includes(formation.ref);
        return <li key={formation.ref}><span>{nodeLabels.get(formation.ref)}</span><button type="button" className="oi-action" aria-expanded={!folded} aria-label={`${folded?'Expand':'Collapse'} constellation ${nodeLabels.get(formation.ref)}`} disabled={!folded&&collapsed.length>=256} onClick={()=>onChange({...filters,collapsed:folded?collapsed.filter(ref=>ref!==formation.ref):[...collapsed,formation.ref]})}>{folded?'Expand':'Collapse'}</button></li>;
      })}</ul>
      {formationRows.length>limit&&<button type="button" className="oi-action" onClick={()=>setLimit(value=>value+40)}>Show more constellations</button>}
      {!!collapsed.length&&<button type="button" className="oi-action" onClick={()=>onChange({...filters,collapsed:[]})}>Expand all</button>}
    </details>}
  </>;
}
