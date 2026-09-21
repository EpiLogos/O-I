import {useState} from 'react';
import {GraphViewDetails} from './GraphViewDetails';
import type {GraphReading} from './graph';
import {defaultGraphFilters, type GraphFilters as FilterState, type FilteredGraph, type SavedGraphView} from './filters';

type Props = {reading: GraphReading; filters: FilterState; result: FilteredGraph; selected?: string; onChange: (filters: FilterState) => void; saved: SavedGraphView[]; onSave: (views: SavedGraphView[]) => void};
export function GraphFilters({reading, filters, result, selected, onChange, saved, onSave}: Props) {
  const [name, setName] = useState('');
  const change = (patch: Partial<FilterState>) => onChange({...filters, ...patch});
  const toggle = (key: 'kinds' | 'relations' | 'families' | 'tags', value: string) => change({[key]: filters[key].includes(value) ? filters[key].filter(item => item !== value) : [...filters[key], value]});
  const kinds = [...new Set(reading.nodes.map(node => node.kind))].sort();
  const relations = [...new Set(reading.edges.map(edge => edge.relation))].sort();
  const families = [...new Set(reading.edges.map(edge => edge.family ?? 'native-semantic'))].sort();
  const tags = [...new Set(reading.nodes.flatMap(node => node.tags ?? []))].sort();
  const active = Boolean(filters.shared || filters.text || filters.scope === 'local' || filters.kinds.length || filters.relations.length || filters.families.length || filters.tags.length || !filters.isolated || filters.context !== 'structure' || filters.collapsed.length);
  const save = () => {const title = name.trim().slice(0,80); if (!title) return; onSave([...saved.filter(view => view.name !== title), {name: title, filters: {...filters}}].slice(-12)); setName('');};
  return <div className="knowledge-filter-panel">
    <details className="knowledge-filter-controls">
      <summary>Filter graph{active ? ' · active' : ''}</summary>
      <label>Find in this reading<input type="search" aria-label="Filter graph subjects" value={filters.text} onChange={event => change({text: event.target.value})} placeholder="Name, alias or reference"/></label>
      <div className="knowledge-filter-row">
        <label>Scope<select aria-label="Graph scope" value={filters.scope} onChange={event => change({scope: event.target.value as FilterState['scope']})}><option value="field">Available field</option><option value="local">Selected subject</option></select></label>
        <label>Depth<input aria-label="Graph depth" type="number" min={0} max={8} value={filters.depth} disabled={filters.scope !== 'local'} onChange={event => change({depth: Math.max(0,Math.min(8,Number(event.target.value)))})}/></label>
      </div>
      {filters.scope === 'local' && !selected && <p role="status">Select a subject to explore its local graph.</p>}
      <label className="knowledge-filter-check"><input type="checkbox" checked={filters.shared} onChange={event=>change({shared:event.target.checked})}/>Include my available Shared Field</label>
      <label>Follow relations<select aria-label="Graph relation direction" value={filters.direction} onChange={event => change({direction: event.target.value as FilterState['direction']})}><option value="both">Both directions</option><option value="outgoing">Outgoing</option><option value="incoming">Incoming / backlinks</option></select></label>
      <details><summary>Subject kinds · {filters.kinds.length || 'all'}</summary>{kinds.map(kind => <label key={kind} className="knowledge-filter-check"><input type="checkbox" checked={filters.kinds.includes(kind)} onChange={() => toggle('kinds',kind)}/>{kind}</label>)}</details>
      <details><summary>Relation types · {filters.relations.length || 'all'}</summary>{relations.map(relation => <label key={relation} className="knowledge-filter-check"><input type="checkbox" checked={filters.relations.includes(relation)} onChange={() => toggle('relations',relation)}/>{relation}</label>)}</details>
      <details><summary>Relationship layers · {filters.families.length || 'all'}</summary>{families.map(family => <label key={family} className="knowledge-filter-check"><input type="checkbox" checked={filters.families.includes(family)} onChange={() => toggle('families',family)}/>{family}</label>)}</details>
      {tags.length > 0 && <details><summary>Tags · {filters.tags.length || 'all'}</summary>{tags.map(tag => <label key={tag} className="knowledge-filter-check"><input type="checkbox" checked={filters.tags.includes(tag)} onChange={() => toggle('tags',tag)}/>{tag}</label>)}</details>}
      <label className="knowledge-filter-check"><input type="checkbox" checked={filters.isolated} onChange={event => change({isolated:event.target.checked})}/>Include subjects with no disclosed relations</label>
      <label>Constellation context<select aria-label="Graph constellation context" value={filters.context} onChange={event => change({context:event.target.value as FilterState['context']})}><option value="structure">Keep disclosed structure</option><option value="matches">Matches only (partial formations)</option></select></label>
      <label>Labels<select aria-label="Graph labels" value={filters.labels} onChange={event => change({labels:event.target.value as FilterState['labels']})}><option value="automatic">At useful zoom</option><option value="all">All visible subjects</option><option value="focus">Focused subjects</option></select></label>
      <label className="knowledge-filter-check"><input type="checkbox" checked={filters.arrows} onChange={event => change({arrows:event.target.checked})}/>Show relation direction</label>
      <GraphViewDetails reading={reading} filters={filters} onChange={onChange}/>
      <div className="knowledge-filter-row"><input aria-label="Saved graph view name" placeholder="Name this view" maxLength={80} value={name} onChange={event=>setName(event.target.value)}/><button type="button" className="oi-action" disabled={!name.trim()} onClick={save}>Save view</button></div>
      {saved.length > 0 && <ul aria-label="Saved graph views">{saved.map(view => <li key={view.name}><button type="button" className="oi-action" onClick={()=>onChange({...view.filters})}>{view.name}</button><button type="button" className="oi-tool" aria-label={`Remove view ${view.name}`} onClick={()=>onSave(saved.filter(item=>item.name!==view.name))}>×</button></li>)}</ul>}
      <button type="button" className="oi-action" onClick={()=>onChange({...defaultGraphFilters(),emphasis:filters.emphasis})}>Clear filters</button>
    </details>
    <div className="knowledge-filter-summary" role="status">{result.counts.matched} matches{result.counts.context > 0 && ` + ${result.counts.context} context`} · {result.counts.displayed} of {result.counts.admitted} disclosed subjects</div>
    {active && <div className="knowledge-filter-chips" aria-label="Applied graph filters">
      {filters.shared && <button onClick={()=>change({shared:false})}>Shared Field ×</button>}
      {filters.text && <button onClick={()=>change({text:''})} aria-label="Remove text filter">{filters.text} ×</button>}
      {filters.scope === 'local' && <button onClick={()=>change({scope:'field'})}>Local · {filters.depth} {filters.depth === 1 ? 'hop' : 'hops'} ×</button>}
      {(['kinds','relations','families','tags'] as const).flatMap(key=>filters[key].map(value=><button key={`${key}:${value}`} onClick={()=>toggle(key,value)} aria-label={`Remove ${key} filter ${value}`}>{value} ×</button>))}
      {!filters.isolated && <button onClick={()=>change({isolated:true})}>Connected only ×</button>}
      {filters.context === 'matches' && <button onClick={()=>change({context:'structure'})}>Matches only ×</button>}
    </div>}
    {!!filters.emphasis?.length&&<div className="knowledge-emphasis-legend" aria-label="Graph emphasis legend">{filters.emphasis.filter(group=>group.enabled).map(group=><span key={group.id}><i style={{backgroundColor:group.color}} aria-hidden="true"/>{group.label}</span>)}</div>}
    {result.collapsedFormations.length>0&&<p className="knowledge-filter-summary">{result.collapsedFormations.length} folded wholes · {result.collapsedSubjects.size} subjects and {result.foldedEdges} incident connections hidden by folding. Membership is unchanged.</p>}
    {result.partialFormations.length > 0 && <p className="knowledge-filter-summary">{result.partialFormations.length} partially displayed {result.partialFormations.length === 1 ? 'constellation' : 'constellations'}; membership is unchanged.</p>}
    {reading.truncated && <p className="knowledge-filter-summary">This is a bounded reading, not the complete source field.</p>}
  </div>;
}
