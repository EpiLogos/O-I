import { useEffect, useId, useRef, useState } from 'react'
import { agentController, dayRead, readAgency, readAgentCard, type AgencyReading, type CardField, type DayReading, type HumanAgentCard, type KernelReceipt, type NativeReview } from '@epilogos/expressions-boundary/cradle'
import { useWorkspace } from '../shell/workspace'
import { NativePreparedContext, type NativePreparedContextProps } from './NativePreparedContext'

type ContextTab = 'agents' | 'context' | 'receipts'
function Field({ label, field }: { label: string; field: CardField | null | undefined }) {
  if (!field) return null
  return <section className="native-agent-field"><h4>{label}</h4>{field.text && <p>{field.text}</p>}{field.items?.length ? <ul>{field.items.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}</ul> : null}{field.state === 'unavailable' && <p className="native-error">This owner reading is unavailable.</p>}</section>
}
function Receipt({ receipt }: { receipt: KernelReceipt }) {
  const fields = ['expression_ref', 'scene_ref', 'source_ref', 'subject_ref', 'project_ref', 'revision', 'operation', 'status', 'reason'].flatMap(key => {
    const value = receipt[key]
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? [{ key, value: String(value) }] : []
  })
  return <li className="native-receipt"><div><strong>{receipt.event}</strong><span title={`${receipt.schema} · version ${receipt.version}`}>#{receipt.seq}</span></div>{fields.length > 0 && <dl>{fields.map(({ key, value }) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{value}</dd></div>)}</dl>}</li>
}

/** Read surfaces over the existing native owners. Agency and Day reads never
 * commission work; reading an Agent card requires selecting its disclosed ref. */
export function NativeContextPanel({ project = 'O-I', preparedContext }: { project?: string; preparedContext?: NativePreparedContextProps }) {
  const id = useId()
  const { transport, reading, selectedSource, receipts, selectSource, workspaceId, accessEpoch, sourceError, sourceReadingCurrent } = useWorkspace()
  const scopeKey = `${workspaceId}|${accessEpoch}|${project}|${JSON.stringify(transport)}`
  const currentScope = useRef(scopeKey)
  currentScope.current = scopeKey
  const [tab, setTab] = useState<ContextTab>('context')
  const [refresh, setRefresh] = useState(0)
  const [agency, setAgency] = useState<AgencyReading | null>(null)
  const [agencyError, setAgencyError] = useState<string | null>(null)
  const [agencyLoading, setAgencyLoading] = useState(false)
  const [rosterScope, setRosterScope] = useState<'project' | 'central'>('project')
  const [profiles, setProfiles] = useState<readonly NativeReview[]>([])
  const [rosterScopeRef, setRosterScopeRef] = useState<string | null>(null)
  const [rosterError, setRosterError] = useState<string | null>(null)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [card, setCard] = useState<HumanAgentCard | null>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [cardLoading, setCardLoading] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [day, setDay] = useState<DayReading | null>(null)
  const [dayError, setDayError] = useState<string | null>(null)
  const [dayLoading, setDayLoading] = useState(false)
  const cardEpoch = useRef(0)

  useEffect(() => {
    ++cardEpoch.current
    setAgency(null); setCard(null); setSelectedAgent(null); setDay(null); setProfiles([]); setRosterScopeRef(null)
    setCardError(null); setCardLoading(false)
    return () => { ++cardEpoch.current }
  }, [transport, project, scopeKey])
  useEffect(() => {
    if (tab !== 'agents') return
    let live = true
    const origin = scopeKey
    const belongs = () => live && currentScope.current === origin
    setAgencyError(null)
    if (transport.kind === 'unavailable') { setAgencyLoading(false); return }
    setAgencyLoading(true)
    void readAgency(transport, project).then(result => {
      if (!belongs()) return
      if ('error' in result) { setAgencyError(result.error) }
      else setAgency(result.reading)
    }).catch(reason => {
      if (belongs()) { setAgencyError(reason instanceof Error ? reason.message : String(reason)) }
    }).finally(() => { if (belongs()) setAgencyLoading(false) })
    return () => { live = false }
  }, [transport, project, tab, refresh, scopeKey])
  useEffect(() => {
    if (tab !== 'agents') return
    let live = true
    const origin = scopeKey
    const belongs = () => live && currentScope.current === origin
    setProfiles([]); setRosterScopeRef(null); setRosterError(null)
    ++cardEpoch.current; setCard(null); setCardError(null); setSelectedAgent(null); setCardLoading(false)
    if (transport.kind === 'unavailable') { setRosterLoading(false); return }
    const controller = agentController(transport, rosterScope === 'project' ? project : undefined)
    setRosterLoading(true)
    void controller.refresh().then(() => {
      if (!belongs()) return
      const state = controller.snapshot()
      if (state.error) setRosterError(state.error)
      else { setProfiles(state.profiles); setRosterScopeRef(state.scopeRef ?? null) }
    }).catch(reason => {
      if (belongs()) setRosterError(reason instanceof Error ? reason.message : String(reason))
    }).finally(() => { if (belongs()) setRosterLoading(false) })
    return () => { live = false; ++cardEpoch.current }
  }, [transport, project, rosterScope, tab, refresh, scopeKey])
  useEffect(() => {
    if (tab !== 'context') return
    let live = true
    const origin = scopeKey
    const belongs = () => live && currentScope.current === origin
    setDayError(null)
    if (transport.kind === 'unavailable') { setDayLoading(false); return }
    setDayLoading(true)
    void dayRead(transport).then(value => { if (belongs()) setDay(value) }).catch(reason => {
      if (belongs()) { setDayError(reason instanceof Error ? reason.message : String(reason)) }
    }).finally(() => { if (belongs()) setDayLoading(false) })
    return () => { live = false }
  }, [transport, tab, refresh, scopeKey])
  async function selectAgent(agentRef: string, worldRef: string | null = rosterScopeRef) {
    if (transport.kind === 'unavailable') return
    const epoch = ++cardEpoch.current
    const origin = scopeKey
    setSelectedAgent(agentRef); setCard(null); setCardError(null); setCardLoading(true)
    try {
      const value = await readAgentCard(transport, agentRef, worldRef)
      if (cardEpoch.current === epoch && currentScope.current === origin) setCard(value)
    } catch (reason) {
      if (cardEpoch.current === epoch && currentScope.current === origin) setCardError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (cardEpoch.current === epoch && currentScope.current === origin) setCardLoading(false)
    }
  }
  const sourcePreview = selectedSource?.content.slice(0, 32000)
  const dayPreview = day?.content.slice(0, 6000)
  return <section className="native-context-panel" aria-label="Native context">
    <div className="native-context-header"><div className="native-context-tabs" role="tablist" aria-label="Native work context">{(['agents', 'context', 'receipts'] as const).map(value => <button key={value} type="button" role="tab" id={`${id}-${value}-tab`} aria-selected={tab === value} aria-controls={`${id}-${value}-panel`} onClick={() => setTab(value)}>{value === 'agents' ? 'Agents' : value === 'context' ? 'Context' : 'Receipts'}{value === 'receipts' && receipts.length > 0 && <span className="native-receipt-count">{receipts.length}</span>}</button>)}</div>{tab !== 'receipts' && <button type="button" aria-label={`Refresh ${tab}`} title="Read the current native owner" onClick={() => setRefresh(value => value + 1)} disabled={transport.kind === 'unavailable' || (tab === 'agents' ? agencyLoading : dayLoading)}>↻</button>}</div>
    <div className="native-context-content" role="tabpanel" id={`${id}-${tab}-panel`} aria-labelledby={`${id}-${tab}-tab`}>
      {transport.kind === 'unavailable' && <p className="native-error" role="status">{transport.reason}</p>}
      {tab === 'agents' && <div className="native-agency">
        <label className="native-agent-scope">Agent profiles<select aria-label="Agent profile scope" value={rosterScope} onChange={event => setRosterScope(event.target.value as 'project' | 'central')}><option value="project">{project}</option><option value="central">Central</option></select></label>
        {rosterLoading && <p className="native-empty" role="status">Reading native Agent profiles…</p>}
        {rosterError && <p className="native-error" role="alert">{rosterError}</p>}
        {!rosterLoading && !rosterError && transport.kind !== 'unavailable' && !profiles.length && <p className="native-empty">No Agent profiles are disclosed in this scope.</p>}
        {profiles.length > 0 && <ul className="native-agent-list native-profile-list">{profiles.map(row => <li key={row.profile.ref}><button type="button" className={selectedAgent === row.profile.agent_ref ? 'selected' : undefined} title={`${row.profile.agent_ref} · ${row.profile.revision}`} onClick={() => void selectAgent(row.profile.agent_ref)}><strong>{row.profile.name ?? row.profile.agent_ref}</strong>{row.profile.purpose && <span>{row.profile.purpose}</span>}</button></li>)}</ul>}
        <h3>Participating sessions</h3>
        {agencyLoading && <p className="native-empty" role="status">Reading agent participation…</p>}
        {agencyError && <p className="native-error" role="alert">{agencyError}</p>}
        {agency && <><p className="native-context-meta" title={agency.projectRef}>{project} · {agency.rows.length} participating sessions{agency.observedAtUnixMs !== undefined && <span> · read {new Date(agency.observedAtUnixMs).toLocaleTimeString()}</span>}</p><ul className="native-agent-list">{agency.rows.map(row => <li key={`${row.spaceRef}:${row.sessionRef}`}><button type="button" disabled={!row.agentRef} className={selectedAgent === row.agentRef ? 'selected' : undefined} title={row.agentRef ?? 'This session has no disclosed Agent card reference'} onClick={() => row.agentRef && void selectAgent(row.agentRef)}><strong>{row.spaceLabel ?? row.spaceRef}</strong><span>{row.purpose ?? row.sessionRef}</span></button></li>)}</ul>{!agency.rows.length && <p className="native-empty">No participating sessions are disclosed by this owner.</p>}</>}
        {cardLoading && <p className="native-empty" role="status">Reading Agent card…</p>}
        {cardError && <p className="native-error" role="alert">{cardError}</p>}
        {card && <article className="native-agent-card"><h3 title={`${card.identity.agent_ref} · ${card.identity.revision}`}>{card.identity.name}</h3>{card.why_im_here.role && <p className="native-context-meta">{card.why_im_here.role}</p>}<Field label="Purpose" field={card.why_im_here} /><Field label="Capabilities" field={card.what_i_can_do} /><Field label="Current work" field={card.currently} /><details><summary>Participation and repertoire</summary><Field label="Participation" field={card.where_i_participate} /><Field label="Working practice" field={card.how_i_work} /><Field label="Repertoire" field={card.what_i_carry} />{card.citizenship.summary && <p>{card.citizenship.summary}</p>}</details></article>}
      </div>}
      {tab === 'context' && <div className="native-work-context">{sourceError && <p className="native-error" role="alert">{sourceError}</p>}
        {preparedContext && <NativePreparedContext {...preparedContext}/>}
        {reading && <section className="native-expression-context"><h3>{reading.document?.name ?? 'Expression'}</h3><dl>{reading.sceneName && <div><dt>Scene</dt><dd>{reading.sceneName}</dd></div>}{reading.sceneState && <div><dt>State</dt><dd>{reading.sceneState}</dd></div>}{reading.nativeScene && <><div><dt>Expression</dt><dd>{reading.nativeScene.expression_ref}</dd></div><div><dt>Scene reference</dt><dd>{reading.nativeScene.scene_ref}</dd></div><div><dt>Revision</dt><dd>{reading.nativeScene.revision}</dd></div></>}{reading.selection?.length ? <div><dt>Selection</dt><dd>{reading.selection.map(item => item.name ?? item.id).join(', ')}</dd></div> : null}</dl></section>}
        {selectedSource && <section className="native-source-context"><div className="native-context-section-header"><h3 title={selectedSource.location.ref}>{selectedSource.location.path}</h3><button type="button" onClick={() => selectSource(null)} title="Clear the displayed source" aria-label="Clear source preview">×</button></div><p className="native-context-meta">{selectedSource.byte_len.toLocaleString()} bytes · {selectedSource.revision}{!sourceReadingCurrent && <span> · revalidating native reading</span>}</p><pre className="native-source-preview">{sourcePreview}</pre>{selectedSource.content.length > 32000 && <p className="native-context-meta">Showing the first 32,000 characters of this native reading.</p>}</section>}
        {!reading && !selectedSource && <p className="native-empty">Select a work or a Central source to inspect its context.</p>}
        <section className="native-day-context"><h3>Day</h3>{dayLoading && <p className="native-empty" role="status">Reading Day…</p>}{dayError && <p className="native-error" role="alert">{dayError}</p>}{day && <><p title={day.day_ref}>{day.temporal.civil_date}{day.temporal.lifecycle ? ` · ${day.temporal.lifecycle}` : ''}</p>{day.document_state === 'uninitialised' ? <p className="native-empty">This Day has no authored document yet.</p> : day.content && <details><summary>Day writing</summary><pre className="native-source-preview">{dayPreview}</pre>{day.content.length > 6000 && <p className="native-context-meta">Showing the first 6,000 characters of this Day reading.</p>}</details>}</>}</section>
      </div>}
      {tab === 'receipts' && <div className="native-receipts"><p className="native-context-meta">Recent native owner receipts</p>{receipts.length ? <ol>{[...receipts].reverse().map((receipt, index) => <Receipt key={`${receipt.schema}:${receipt.seq}:${index}`} receipt={receipt} />)}</ol> : <p className="native-empty">No owner receipts have been received in this shell session.</p>}</div>}
    </div>
  </section>
}
