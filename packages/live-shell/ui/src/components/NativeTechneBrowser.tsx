import {useEffect, useRef, useState} from 'react';
import type {HostedTechneLens} from '@epilogos/expressions-boundary';
import {useWorkspace} from '../shell/workspace';
import {captureTechneInstrumentOpen, currentTechneInstrumentOpen, TECHNE_INSTRUMENT_OPEN, type TechneInstrumentEvent} from '../native/techneInstrumentOpen';
import './NativeTechneBrowser.css';

export const NATIVE_TECHNE_DEFINITIONS: readonly {id: 'graph' | HostedTechneLens; title: string; icon: string; purpose: string}[] = [
  {id:'graph',title:'Graph',icon:'⌘',purpose:'Explore the selected subject and its disclosed relationships.'},
  {id:'canvas',title:'Canvas',icon:'▧',purpose:'Construct, connect and arrange native source occurrences.'},
  {id:'timeline',title:'Timeline',icon:'↔',purpose:'Explore source dates, periods and their qualified time window.'},
  {id:'journey',title:'Journey',icon:'▸',purpose:'Compose and navigate the work’s native Scenes and passages.'},
  {id:'place',title:'Places',icon:'⌖',purpose:'Explore disclosed locations, imagery and temporal facets.'},
  {id:'palace',title:'Palace',icon:'▦',purpose:'Compose regions, contained Expressions and their guided path.'},
];

/** Reusable instrument choices in the existing Browser. All five field
 * editors use the retained application; Graph uses its exact subject/Return
 * route. This component has no document, renderer or native save store. */
export function NativeTechneBrowser({query, onOpenGraph, openingGraph, graphError}: {
  query: string; onOpenGraph: () => Promise<void>; openingGraph: boolean; graphError: string | null;
}) {
  const workspace = useWorkspace(), current = useRef(workspace); current.current = workspace;
  const live = useRef(true);
  const [selected, setSelected] = useState<(typeof NATIVE_TECHNE_DEFINITIONS)[number]['id']>('graph');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {live.current=true; return () => {live.current=false};}, []);
  const definition = NATIVE_TECHNE_DEFINITIONS.find(item => item.id === selected)!;
  const choices = NATIVE_TECHNE_DEFINITIONS.filter(item => `${item.title} ${item.purpose}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const reading = workspace.editorReading;
  const available = workspace.mode !== 'audio' && workspace.accessReady && !!reading && !reading.standing.pending;
  async function open(id = selected) {
    setNotice(null); setError(null);
    if (id === 'graph') {await onOpenGraph(); return;}
    try {
      const captured = captureTechneInstrumentOpen(current.current,id);
      const detail: TechneInstrumentEvent = {...captured,complete: result => {
        if (!live.current || !currentTechneInstrumentOpen(captured,current.current)) return;
        if (result.state === 'refused') setError(result.reason);
        else setNotice(`${NATIVE_TECHNE_DEFINITIONS.find(item=>item.id===result.lens)?.title ?? 'Instrument'} requested in the current work.`);
      }};
      current.current.setMode('techne');
      window.dispatchEvent(new CustomEvent(TECHNE_INSTRUMENT_OPEN,{detail}));
      if (!detail.handled) throw Error('The retained application has no available instrument receiver');
    } catch (cause) {if (live.current) setError(cause instanceof Error ? cause.message : String(cause));}
  }
  return <section className="native-techne-browser" aria-label="Knowledge instruments">
    <h3>Instruments</h3>
    <ul>{choices.map(item=><li key={item.id}><button type="button" className="world-work-row" aria-pressed={selected===item.id}
      onClick={()=>{setSelected(item.id);setNotice(null);setError(null)}} onDoubleClick={()=>{setSelected(item.id);void open(item.id)}} title={item.purpose}>
      <span aria-hidden="true">{item.icon}</span><span>{item.title}</span></button></li>)}</ul>
    {!choices.length&&<p className="native-empty">No instruments match this search.</p>}
    <div className="native-techne-device" aria-label={`${definition.title} instrument`}>
      <header><span aria-hidden="true">{definition.icon}</span><strong>{definition.title}</strong></header>
      <p>{definition.purpose}</p>
      {reading&&<p className="native-techne-target">{reading.scene.name}{reading.selection.entity_ids.length===1 ? ` · ${reading.scene.entities.find(entity=>entity.id===reading.selection.entity_ids[0])?.name ?? 'Selected source'}` : reading.selection.entity_ids.length>1 ? ` · ${reading.selection.entity_ids.length} selected` : ''}</p>}
      <button type="button" disabled={!available||openingGraph} onClick={()=>void open()}>{openingGraph&&selected==='graph'?'Reading subject…':`Open ${definition.title}`}</button>
      {!available&&<p className="native-empty">Open an available native work to use its instruments.</p>}
      {notice&&<p role="status">{notice}</p>}
      {(error||graphError)&&<p className="native-error" role="alert">{error??graphError}</p>}
    </div>
  </section>;
}
