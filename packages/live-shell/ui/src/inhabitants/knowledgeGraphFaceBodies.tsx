// The knowledge graph family's face bodies (T-KNOWLEDGE-GRAPH-DEVICE; DEVICE-SEMANTICS-LOCK §8.1): the wiki constellation's
// own controls on the Device side. Each body reads the open surface's handle (knowledgeGraphHandle.ts, published by
// KnowledgeSurface) and calls the same acts the surface's panel calls (knowledgeGraphFaceActions.ts). No body keeps a
// store, and the controls the body draws are the ones the open view's filter state reports.
//
// With no graph open, a body names that and keeps no state. The bodies re-render on the surface's own publishes, never on
// a poll.

import {useSyncExternalStore} from 'react'
import {knowledgeGraphSurface, subscribeKnowledgeGraph} from '../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle'
import type {KnowledgeGraphSurface} from '../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle'
import {
  DEPTH_RANGE, KNOWLEDGE_CONTEXTS, KNOWLEDGE_DIRECTIONS, KNOWLEDGE_LABELS, KNOWLEDGE_SCOPES, TEXT_LIMIT, ZOOM_RANGE,
  fitView, setFilters, setZoom, toggleMember,
} from './knowledgeGraphFaceActions'
import './knowledgeGraphFaceBodies.css'

/** The three knowledge faces whose bodies this module supplies (knowledgeGraphFamilyManifest.ts). */
export const KNOWLEDGE_FACE_IDS = ['knowledge-scope', 'knowledge-filters', 'knowledge-display'] as const
export type KnowledgeFaceId = (typeof KNOWLEDGE_FACE_IDS)[number]

export function isKnowledgeFaceId(id: string): id is KnowledgeFaceId {
  return (KNOWLEDGE_FACE_IDS as readonly string[]).includes(id)
}

/** The body of one knowledge face, as the rack docks it when the face is expanded. */
export function KnowledgeFaceBody({faceId}: {faceId: KnowledgeFaceId}) {
  const surface = useKnowledgeGraph()
  return (
    <div className="knowledge-face" data-knowledge-face={faceId} data-mounted={surface ? 'yes' : 'no'}>
      {surface ? <FaceControls faceId={faceId} surface={surface}/> : <NotOpen/>}
    </div>
  )
}

/** The open surface's handle, re-read on each publish. */
function useKnowledgeGraph(): KnowledgeGraphSurface | null {
  return useSyncExternalStore(subscribeKnowledgeGraph, knowledgeGraphSurface, knowledgeGraphSurface)
}

function NotOpen() {
  return <p className="knowledge-face-note" role="status">
    The knowledge graph is not open in this session. Open a graph in the centre and its controls stand here; nothing is held.
  </p>
}

function FaceControls({faceId, surface}: {faceId: KnowledgeFaceId; surface: KnowledgeGraphSurface}) {
  switch (faceId) {
    case 'knowledge-scope': return <ScopeFace surface={surface}/>
    case 'knowledge-filters': return <FiltersFace surface={surface}/>
    case 'knowledge-display': return <DisplayFace surface={surface}/>
  }
}

const SCOPE_LABELS: Readonly<Record<(typeof KNOWLEDGE_SCOPES)[number], string>> = {field: 'Available field', local: 'Selected subject'}
const DIRECTION_LABELS: Readonly<Record<(typeof KNOWLEDGE_DIRECTIONS)[number], string>> = {
  both: 'Both directions', outgoing: 'Outgoing', incoming: 'Incoming / backlinks',
}
const CONTEXT_LABELS: Readonly<Record<(typeof KNOWLEDGE_CONTEXTS)[number], string>> = {
  structure: 'Keep disclosed structure', matches: 'Matches only (partial formations)',
}
const LABEL_LABELS: Readonly<Record<(typeof KNOWLEDGE_LABELS)[number], string>> = {
  automatic: 'At useful zoom', all: 'All visible subjects', focus: 'Focused subjects',
}

/** A checkbox row: the panel's own label, checked from the view's state. */
function Check({label, checked, onChange}: {label: string; checked: boolean; onChange: (on: boolean) => void}) {
  return <label className="knowledge-face-check">
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/>{label}
  </label>
}

function ScopeFace({surface}: {surface: KnowledgeGraphSurface}) {
  const f = surface.filters;
  return <div className="knowledge-face-group" data-knowledge-group="scope">
    <label>Scope
      <select aria-label="Graph scope" value={f.scope} onChange={event => setFilters(surface, {scope: event.target.value as 'field' | 'local'})}>
        {KNOWLEDGE_SCOPES.map(scope => <option key={scope} value={scope}>{SCOPE_LABELS[scope]}</option>)}
      </select>
    </label>
    <label>Depth
      <input type="number" aria-label="Graph depth" min={DEPTH_RANGE.min} max={DEPTH_RANGE.max} value={f.depth}
        disabled={f.scope !== 'local'}
        onChange={event => setFilters(surface, {depth: Math.max(DEPTH_RANGE.min, Math.min(DEPTH_RANGE.max, Number(event.target.value)))})}/>
    </label>
    <label>Follow relations
      <select aria-label="Graph relation direction" value={f.direction} onChange={event => setFilters(surface, {direction: event.target.value as 'both' | 'outgoing' | 'incoming'})}>
        {KNOWLEDGE_DIRECTIONS.map(direction => <option key={direction} value={direction}>{DIRECTION_LABELS[direction]}</option>)}
      </select>
    </label>
    <Check label="Include my available Shared Field" checked={f.shared} onChange={shared => setFilters(surface, {shared})}/>
    <Check label="Show unresolved link markers" checked={f.unresolved} onChange={unresolved => setFilters(surface, {unresolved})}/>
  </div>;
}

function FiltersFace({surface}: {surface: KnowledgeGraphSurface}) {
  const f = surface.filters;
  const domains = surface.domains;
  return <div className="knowledge-face-group" data-knowledge-group="filters">
    <label>Find in this reading
      <input type="search" aria-label="Filter graph subjects" value={f.text} maxLength={TEXT_LIMIT}
        onChange={event => setFilters(surface, {text: event.target.value})} placeholder="Name, alias or reference"/>
    </label>
    {!domains && <p className="knowledge-face-note" role="status">The graph is still reading its subjects; the kinds and relations stand once it has.</p>}
    {domains && <details data-knowledge-control="kinds" open>
      <summary>Subject kinds · {f.kinds.length || 'all'}</summary>
      {domains.kinds.map(kind => <Check key={kind} label={kind} checked={f.kinds.includes(kind)} onChange={() => toggleMember(surface, 'kinds', kind)}/>)}
    </details>}
    {domains && <details data-knowledge-control="relations" open>
      <summary>Relation types · {f.relations.length || 'all'}</summary>
      {domains.relations.map(relation => <Check key={relation} label={relation} checked={f.relations.includes(relation)} onChange={() => toggleMember(surface, 'relations', relation)}/>)}
    </details>}
    <Check label="Include subjects with no disclosed relations" checked={f.isolated} onChange={isolated => setFilters(surface, {isolated})}/>
    <label>Constellation context
      <select aria-label="Graph constellation context" value={f.context} onChange={event => setFilters(surface, {context: event.target.value as 'structure' | 'matches'})}>
        {KNOWLEDGE_CONTEXTS.map(context => <option key={context} value={context}>{CONTEXT_LABELS[context]}</option>)}
      </select>
    </label>
  </div>;
}

function DisplayFace({surface}: {surface: KnowledgeGraphSurface}) {
  const f = surface.filters;
  const zoom = Math.round(surface.zoom * 100) / 100;
  return <div className="knowledge-face-group" data-knowledge-group="display">
    <label>Labels
      <select aria-label="Graph labels" value={f.labels} onChange={event => setFilters(surface, {labels: event.target.value as 'automatic' | 'all' | 'focus'})}>
        {KNOWLEDGE_LABELS.map(labels => <option key={labels} value={labels}>{LABEL_LABELS[labels]}</option>)}
      </select>
    </label>
    <Check label="Show relation direction" checked={f.arrows} onChange={arrows => setFilters(surface, {arrows})}/>
    <label>Zoom
      <input type="number" aria-label="Graph zoom" min={ZOOM_RANGE.min} max={ZOOM_RANGE.max} step={0.05} value={zoom}
        onChange={event => setZoom(surface, Math.max(ZOOM_RANGE.min, Math.min(ZOOM_RANGE.max, Number(event.target.value))))}/>
    </label>
    <button type="button" className="knowledge-face-action" onClick={() => fitView(surface)}>Fit graph to view</button>
  </div>;
}
