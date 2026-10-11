import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeRequest, ChangeSetDocument, ConfigResolution, ContributionMount, PlanBundle, ScopeAddress, SettingsAdapter, SettingsRequest } from './adapter'
import { unavailableSettingsAdapter } from './adapter'
import { acknowledgeDrafts, allowedScope, basisChanged, categories, categoryOf, createDraft, displayValue, draftOwnerChanged, editableValue, initialScope, isSensitiveSetting, rawValue, searchSettings, settingHelp, settingKey, tableRepresentation } from './model'
import type { CategoryId, Draft, SettingEntry } from './model'
import { ReadOnlyValue, SettingControl } from './controls'
import { AppearancePreferences, CredentialPreferences } from './OwnerPreferences'
import { ProfilePreferences } from './ProfilePreferences'
import { ProductPreferences } from './ProductPreferences'
import { HarnessPreferences } from './HarnessPreferences'
import { MachinePreferences } from './MachinePreferences'
import { AutomationPreferences } from './AutomationPreferences'
import './preferences.css'

const unavailable = unavailableSettingsAdapter()
interface Props { adapter?: SettingsAdapter; request?: SettingsRequest | null; onReturn?: () => void; active?: boolean; initialDrafts?: { setting_ref: string; scope: ScopeAddress; raw: unknown }[] }
type Review = { bundle: PlanBundle; submitted: Record<string, Draft>; epoch?: string }

export function SettingsWorkspace({ adapter = unavailable, request, onReturn, active = true, initialDrafts }: Props) {
  const [mounts, setMounts] = useState<ContributionMount[]>([])
  const [readings, setReadings] = useState<Record<string, ConfigResolution>>({})
  const [scopes, setScopes] = useState<Record<string, ScopeAddress>>({})
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [category, setCategory] = useState<CategoryId>('agents')
  const [visited,setVisited]=useState<Set<CategoryId>>(()=>new Set(['agents']))
  const [pageFocus,setPageFocus]=useState<'machines'|'automations'|'products'|null>(null)
  const [operationScope,setOperationScope]=useState<ScopeAddress|null>(null)
  useEffect(()=>{setVisited(old=>old.has(category)?old:new Set([...old,category]))},[category])
  const [query, setQuery] = useState('')
  const [searchIndex, setSearchIndex] = useState(0)
  const [showInfo, setShowInfo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  const [result, setResult] = useState<ChangeSetDocument | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [landing, setLanding] = useState(0)
  const [resetTarget, setResetTarget] = useState<{ entry: SettingEntry; scope: ScopeAddress; digest: string | null } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const navigationRef = useRef<HTMLElement>(null)
  useEffect(()=>{
    navigationRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({block:'nearest',inline:'nearest'})
  },[category,query,loading])
  const cardRefs = useRef(new Map<string, HTMLElement>())
  const generation = useRef(0)
  const activeAdapter = useRef(adapter)
  activeAdapter.current = adapter
  const draftsRef=useRef(drafts);draftsRef.current=drafts
  const busyRef=useRef(busy);busyRef.current=busy
  const reviewRef = useRef<HTMLElement>(null)
  const seeded = useRef(false)
  const id = useId()
  const entries = useMemo(() => mounts.flatMap(mount => (mount.document?.sections.flatMap(section => section.settings) ?? []).map(spec => ({ spec, owner: mount.owner_ref, available: mount.availability.state === 'available' || mount.availability.state === 'degraded', reason: mount.availability.reason }))), [mounts])
  const visibleCategories = categories.filter(c => ['agents','profiles','connections','appearance','execution','automations','products'].includes(c.id) || entries.some(e => categoryOf(e) === c.id))
  const visibleEntries = entries.filter(e => categoryOf(e) === category).sort((a,b) => Number(!a.spec.writable) - Number(!b.spec.writable))
  const results = query.trim() ? searchSettings(entries, query) : []
  const contextualResults=query.trim()?(adapter.pointOfUseEntries??[]).filter(entry=>query.toLowerCase().trim().split(/\s+/).every(word=>`${entry.title} ${entry.description} ${entry.setting_ref} ${entry.synonyms??''}`.toLowerCase().includes(word))):[]
  const pageResults=query.trim()?[{id:'execution' as const,title:'Remote machines',description:'Add a machine, choose its control endpoint and stored credential reference, then connect.',words:'remote machine environment workcell endpoint connection execution start work'},{id:'automations' as const,title:'Automations',description:'Create a routine from a verified Method, manage its allowed actions, and read returned runs.',words:'automation routine cron schedule timer event subscribe subscription remote agent background history'},{id:'products' as const,title:'Installed products',description:'Manage installed products and their available maintenance actions.',words:'install installed products extensions update updates version maintenance service'}].filter(page=>query.toLowerCase().trim().split(/\s+/).every(word=>`${page.title} ${page.description} ${page.words}`.toLowerCase().includes(word))):[]
  const draftEntries = Object.entries(drafts)
  const invalid = draftEntries.some(([, draft]) => draft.error !== null)

  useEffect(() => {
    const epoch = ++generation.current
    setLoading(true); setProblem(null); setNotice(null); setResult(null); setReview(null); setReadings({}); setBusy(false); setResetTarget(null)
    adapter.readRegistry().then(reading => {
      if (generation.current !== epoch) return
      setMounts(reading.mounts)
      const discovered = reading.mounts.flatMap(m => m.document?.sections.flatMap(section => section.settings) ?? [])
      setScopes(existing => Object.fromEntries(discovered.flatMap(spec => {
        const previous = existing[spec.setting_ref]
        const scope = previous && allowedScope(spec, previous) ? previous : initialScope(spec, adapter.scopeChoices ?? [])
        return scope ? [[spec.setting_ref, scope]] : []
      })))
    }).catch(error => { if (generation.current === epoch) setProblem(String(error.message ?? error)) })
      .finally(() => { if (generation.current === epoch) setLoading(false) })
    return () => { ++generation.current }
  }, [adapter, adapter.ownerEpoch])

  useEffect(() => {
    if (loading) return
    let cancelled = false
    const pairs = Object.entries(scopes).map(([setting_ref, scope]) => ({ setting_ref, scope }))
    if (!pairs.length) return
    adapter.readResolutions(pairs).then(resolutions => {
      if (cancelled) return
      setReadings(existing => ({ ...existing, ...Object.fromEntries(resolutions.map(r => [settingKey(r.setting_ref, r.scope), r])) }))
    }).catch(error => { if (!cancelled) setProblem(`Reading failed: ${error.message ?? error}`) })
    return () => { cancelled = true }
  }, [adapter, adapter.ownerEpoch, scopes, loading])

  useEffect(() => {
    if (seeded.current || !initialDrafts?.length || !entries.length) return
    if (initialDrafts.some(d => !readings[settingKey(d.setting_ref, d.scope)])) return
    seeded.current = true
    setDrafts(old => ({ ...old, ...Object.fromEntries(initialDrafts.flatMap(d => {
      const entry = entries.find(e => e.spec.setting_ref === d.setting_ref)
      return entry ? [[settingKey(d.setting_ref, d.scope), {...createDraft(entry.spec, d.raw, readings[settingKey(d.setting_ref, d.scope)]),ownerEpoch:adapter.ownerEpoch}]] : []
    })) }))
  }, [initialDrafts, entries, readings])

  useEffect(() => {
    if (!request) return
    if(request.page){setCategory(request.page==='machines'?'execution':'automations');setOperationScope(request.scope);setSelected(null);setQuery('');setLanding(value=>value+1);return}
    if(!entries.length)return
    const entry = entries.find(e => e.spec.setting_ref === request.setting_ref)
    if (!entry) { setProblem(`This product did not contribute ${request.setting_ref}.`); return }
    if (!allowedScope(entry.spec, request.scope)) { setProblem('This setting does not support the requested scope. No substitute scope was selected.'); return }
    setCategory(categoryOf(entry)); setScopes(old => ({ ...old, [request.setting_ref]: request.scope })); setSelected(request.setting_ref); setQuery(''); setLanding(n => n + 1)
  }, [request?.requestId, entries])

  useEffect(() => {
    if(query||!active)return
    if(!selected&&(pageFocus||request?.page)){const page=pageFocus??request?.page;const target=document.querySelector<HTMLElement>(`[aria-label="${page==='machines'?'Remote machines':page==='products'?'Installed products and operations':'Automations'}"]`);if(target?.getClientRects().length){target.scrollIntoView({block:'nearest'});target.focus({preventScroll:true})}return}
    if(!selected)return
    const element = cardRefs.current.get(selected)
    element?.scrollIntoView({ block: 'nearest' }); element?.focus({ preventScroll: true })
  }, [landing, active, visited])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (draftEntries.length) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [draftEntries.length])

  useEffect(() => { if (review || resetTarget || result) { reviewRef.current?.scrollIntoView({ block: 'nearest' }); reviewRef.current?.focus({ preventScroll: true }) } }, [review, resetTarget, result])
  function isCurrent(epoch: number, source: SettingsAdapter) { return generation.current === epoch && activeAdapter.current === source }
  function guard(epoch: number, source: SettingsAdapter) { if (!isCurrent(epoch, source)) throw new Error('The native connection changed. This response belongs to the previous connection; your local drafts are retained.') }

  async function stageProfile(requests: ChangeRequest[]) {
    if(busyRef.current)throw new Error('Finish the current settings operation before staging a profile.')
    const source=adapter,epoch=generation.current
    const keys=new Set<string>()
    const targets=requests.map(request=>{
      const entry=entries.find(value=>value.spec.setting_ref===request.setting_ref)
      if(!entry||!entry.available||!entry.spec.writable||isSensitiveSetting(entry.spec)||request.secret_reference)throw new Error(`${request.setting_ref} cannot be staged through this settings editor. Secret bindings use their credential owner.`)
      if(!allowedScope(entry.spec,request.scope))throw new Error(`${request.setting_ref} does not allow the profile’s scope.`)
      const key=settingKey(request.setting_ref,request.scope)
      if(keys.has(key))throw new Error('The profile repeats a setting at the same scope.')
      if(drafts[key])throw new Error('This profile overlaps an existing local draft. Review or undo that draft before using the profile.')
      keys.add(key);return {entry,request,key}
    })
    const readings=await source.readResolutions(requests.map(({setting_ref,scope})=>({setting_ref,scope})))
    guard(epoch,source)
    const next=Object.fromEntries(targets.map(({entry,request,key})=>{
      const reading=readings.find(value=>settingKey(value.setting_ref,value.scope)===key)
      if(!reading)throw new Error(`The owner did not read ${request.setting_ref} at the profile’s scope.`)
      const draft={...createDraft(entry.spec,rawValue(entry.spec,request.value),reading),ownerEpoch:source.ownerEpoch}
      if(draft.error)throw new Error(`${entry.spec.title}: ${draft.error}`)
      return [key,draft]
    }))
    if(busyRef.current||Object.keys(next).some(key=>draftsRef.current[key]))throw new Error('Settings activity changed while reading the profile. Your drafts are retained; finish that activity before trying again.')
    setReadings(old=>({...old,...Object.fromEntries(readings.map(value=>[settingKey(value.setting_ref,value.scope),value]))}))
    setScopes(old=>({...old,...Object.fromEntries(requests.map(value=>[value.setting_ref,value.scope]))}))
    setDrafts(old=>({...old,...next}));setReview(null);setResult(null)
  }

  function edit(entry: SettingEntry, scope: ScopeAddress, raw: unknown) {
    const key = settingKey(entry.spec.setting_ref, scope)
    setDrafts(previous => ({ ...previous, [key]: {...createDraft(entry.spec, raw, readings[key], previous[key]),ownerEpoch:previous[key] ? previous[key].ownerEpoch : adapter.ownerEpoch} }))
    setReview(null); setResult(null); setNotice(null)
  }
  function openEntry(entry: SettingEntry) { setCategory(categoryOf(entry)); setSelected(entry.spec.setting_ref); setQuery(''); setLanding(n => n + 1) }
  async function refresh(pairs: { setting_ref: string; scope: ScopeAddress }[], epoch = generation.current, source = adapter) {
    const latest = await source.readResolutions(pairs)
    guard(epoch, source)
    setReadings(existing => ({ ...existing, ...Object.fromEntries(latest.map(r => [settingKey(r.setting_ref, r.scope), r])) }))
    return latest
  }
  async function plan() {
    const epoch = generation.current; const source = adapter
    setBusy(true); setProblem(null); setNotice(null)
    try {
      const submitted = { ...drafts }
      if(Object.values(submitted).some(draft=>draftOwnerChanged(draft,source.ownerEpoch)))throw new Error('These drafts belong to the previous native owner or access context. Inspect and explicitly rebase them before review.')
      const requests = Object.entries(submitted).map(([key, draft]) => { const [setting_ref, scope_kind, scope_ref] = JSON.parse(key); return { setting_ref, scope: { scope_kind, scope_ref } as ScopeAddress, value: draft.value } })
      const latest = await refresh(requests, epoch, source)
      if (requests.some(r => !latest.find(l => settingKey(l.setting_ref, l.scope) === settingKey(r.setting_ref, r.scope)))) throw new Error('The owner did not return a resolution for every draft. The drafts are retained.')
      if (latest.some(r => basisChanged(submitted[settingKey(r.setting_ref, r.scope)], r))) throw new Error('The native basis changed. Inspect the current values, then explicitly rebase your draft before reviewing again.')
      const basis = requests.map(r => ({ setting_ref: r.setting_ref, scope: r.scope, reading_digest: submitted[settingKey(r.setting_ref, r.scope)].basis }))
      guard(epoch, source)
      const bundle = await source.plan(requests, basis)
      guard(epoch, source)
      setReview({ bundle, submitted, epoch: source.ownerEpoch })
    } catch (error) { if (isCurrent(epoch, source)) setProblem(error instanceof Error ? error.message : String(error)) }
    finally { if (isCurrent(epoch, source)) setBusy(false) }
  }
  async function apply() {
    if (!review || !adapter.canApply) return
    const epoch = generation.current; const source = adapter
    setBusy(true); setProblem(null)
    try {
      if (review.epoch !== adapter.ownerEpoch) throw new Error('The native owner connection changed. Review the retained drafts again.')
      const pairs = review.bundle.plans.map(p => ({ setting_ref: p.setting_ref, scope: p.scope }))
      const latest = await refresh(pairs, epoch, source)
      if (latest.length !== pairs.length || latest.some(r => basisChanged(review.submitted[settingKey(r.setting_ref, r.scope)], r))) throw new Error('The native basis changed after review. No apply was sent. Your drafts are retained.')
      guard(epoch, source)
      const response = await source.apply(review.bundle.plans)
      guard(epoch, source)
      setResult(response)
      const acknowledged = response.operations.filter(o => o.status === 'applied' || o.status === 'verified').map(o => settingKey(o.setting_ref, o.scope))
      setDrafts(current => acknowledgeDrafts(current, review.submitted, acknowledged))
      setReview(null)
      setNotice(adapter.simulated ? 'Development response only. No native configuration was persisted.' : 'The native response is acknowledged. Until read-back completes, values shown are the previous reading.')
      await refresh(pairs, epoch, source)
      setNotice(adapter.simulated ? 'Development response only. No native configuration was persisted.' : 'Native response received. Effective and observed values below come from the new reading.')
    } catch (error) { if (isCurrent(epoch, source)) setProblem(error instanceof Error ? error.message : String(error)) }
    finally { if (isCurrent(epoch, source)) setBusy(false) }
  }
  async function reset(target: NonNullable<typeof resetTarget>) {
    const { entry, scope, digest } = target
    const epoch = generation.current; const source = adapter
    if (!source.reset) return
    setBusy(true); setProblem(null)
    try {
      const key = settingKey(entry.spec.setting_ref, scope)
      const latest = await refresh([{ setting_ref: entry.spec.setting_ref, scope }], epoch, source)
      if ((latest[0]?.native_reading?.reading_digest ?? null) !== digest) throw new Error('The native basis changed. Inspect the new reading before resetting.')
      guard(epoch, source)
      const response = await source.reset({ setting_ref: entry.spec.setting_ref, scope, reading_digest: digest })
      guard(epoch, source)
      setResult(response); setResetTarget(null)
      if (response.operations.some(o => o.status === 'applied' || o.status === 'verified')) setDrafts(old => { const next = { ...old }; delete next[key]; return next })
      await refresh([{ setting_ref: entry.spec.setting_ref, scope }], epoch, source)
      setNotice(adapter.simulated ? 'Development reset response. No native override was removed.' : 'Native reset response received; resolution has been read again.')
    } catch (error) { if (isCurrent(epoch, source)) setProblem(error instanceof Error ? error.message : String(error)) }
    finally { if (isCurrent(epoch, source)) setBusy(false) }
  }

  const focusEntry = category==='automations'||category==='execution'&&!selected?undefined:entries.find(e => e.spec.setting_ref === selected) ?? visibleEntries[0]
  const focusScope = focusEntry && scopes[focusEntry.spec.setting_ref]
  const focusReading = focusEntry && focusScope ? readings[settingKey(focusEntry.spec.setting_ref, focusScope)] : undefined
  const focusDraft = focusEntry && focusScope ? drafts[settingKey(focusEntry.spec.setting_ref, focusScope)] : undefined
  const groups = [...new Set(visibleEntries.map(e => `${e.owner}|${e.spec.section_ref}`))]
  const chooseCategory = (next: CategoryId) => { setCategory(next); setQuery(''); setSelected(null) }
  const openPage = (next:CategoryId) => {chooseCategory(next);setPageFocus(next==='execution'?'machines':next==='products'?'products':'automations');setLanding(value=>value+1)}
  const chooseScope = (next: ScopeAddress | null) => {
    if (!focusEntry) return
    setScopes(old => {
      const updated = { ...old }
      for (const entry of visibleEntries) {
        if (next && allowedScope(entry.spec, next)) updated[entry.spec.setting_ref] = next
        else if (!next && entry.spec.setting_ref === focusEntry.spec.setting_ref) delete updated[entry.spec.setting_ref]
      }
      return updated
    }); setReview(null)
  }
  const row = (entry: SettingEntry) => {
    const spec = entry.spec; const scope = scopes[spec.setting_ref]; const key = scope && settingKey(spec.setting_ref, scope)
    const reading = key ? readings[key] : undefined; const draft = key ? drafts[key] : undefined
    const errorId = `${id}-${spec.setting_ref.replace(/[^a-z0-9]/gi, '-')}`
    const writable = spec.writable && spec.operations.plan && spec.operations.apply && entry.available && !!scope && !isSensitiveSetting(spec)
    const stale = !!draft && (!!reading && basisChanged(draft, reading) || draftOwnerChanged(draft,adapter.ownerEpoch))
    const effective = reading?.native?.effective
    const origin = reading?.native?.declared ? 'Override at this scope' : effective ? 'Inherited / resolved by owner' : adapter.kind === 'unavailable' ? 'Awaiting native connection' : 'Not read'
    return <article key={spec.setting_ref} tabIndex={-1} ref={el => { if (el) cardRefs.current.set(spec.setting_ref, el); else cardRefs.current.delete(spec.setting_ref) }} className={`preference-row ${draft ? 'is-changed' : ''} ${selected === spec.setting_ref ? 'is-selected' : ''}`} aria-label={spec.title} onFocusCapture={() => setSelected(spec.setting_ref)} onPointerDown={() => setSelected(spec.setting_ref)}>
      <div className="preference-label"><h3>{spec.title}</h3><span className="preference-origin">{origin}{scope && focusScope && (scope.scope_kind !== focusScope.scope_kind || scope.scope_ref !== focusScope.scope_ref) && ` · ${scopeWord(scope)}`}</span></div>
      <div className="preference-value">{writable && reading && (draft || editableValue(reading)!==undefined && editableValue(reading)!==null) ? <SettingControl spec={spec} raw={draft?.raw ?? rawValue(spec, editableValue(reading))} representation={draft?.representation ?? tableRepresentation(spec, editableValue(reading) ?? spec.default)} onChange={raw => edit(entry, scope!, raw)} adapter={adapter} disabled={busy} errorId={draft?.error ? errorId : undefined} /> : <ReadOnlyValue spec={spec} value={effective?.value} />}{writable&&reading&&!draft&&(editableValue(reading)===undefined||editableValue(reading)===null)&&<button type="button" disabled={busy} onClick={()=>edit(entry,scope!,rawValue(spec,spec.default))}>Set an override…</button>}{isSensitiveSetting(spec) && <button type="button" disabled={!adapter.navigate} onClick={() => adapter.navigate?.({ kind:'credentials',native_ref:String(spec.native_ref),setting_ref:spec.setting_ref,scope })}>Manage credentials…</button>}{draft && <button className="preference-undo" type="button" disabled={busy} onClick={() => {setDrafts(old=>{const next={...old};delete next[key!];return next});setReview(null)}}>Undo</button>}</div>
      {draft?.error && <p className="settings-field-error" id={errorId} role="alert">{draft.error}</p>}
      {stale && <div className="settings-alert" role="alert">The native reading or owner context changed. Your draft is retained.<button type="button" disabled={busy||!reading} onClick={() => {setDrafts(old=>({...old,[key!]:{...old[key!],basis:reading?.native_reading?.reading_digest??null,ownerEpoch:adapter.ownerEpoch,version:old[key!].version+1}}));setReview(null);setProblem(null)}}>Keep draft on current basis</button></div>}
      <details className="preference-inspection"><summary>Details{draft && ' · local draft'}{stale && ' · conflict'}</summary><p>{spec.description}</p><div className="preference-detail-actions"><ScopeControl entry={entry} scope={scope} adapter={adapter} onChange={next=>{setScopes(old=>{const updated={...old};if(next)updated[spec.setting_ref]=next;else delete updated[spec.setting_ref];return updated});setReview(null)}} disabled={busy}/>{spec.operations.reset && <button type="button" disabled={busy||!adapter.reset||!scope||!reading||!entry.available} title={!adapter.reset?'The native reset operation is not connected.':undefined} onClick={()=>setResetTarget({entry,scope:scope!,digest:reading?.native_reading?.reading_digest??null})}>Restore inheritance / default…</button>}</div><dl><dt>Native identity</dt><dd>{spec.setting_ref}</dd><dt>Owner / location</dt><dd>{entry.owner} · {String(spec.native_ref)}</dd><dt>Configured preference</dt><dd>{reading?.desired?displayValue(reading.desired.value,isSensitiveSetting(spec)):'No desired preference reported'}</dd><dt>Declared override</dt><dd>{displayValue(reading?.native?.declared?.value,isSensitiveSetting(spec))}</dd><dt>Effective resolution</dt><dd>{displayValue(effective?.value,isSensitiveSetting(spec))} · {provenance(effective?.provenance)}</dd><dt>Observed runtime</dt><dd>{displayValue(reading?.native?.active?.value,isSensitiveSetting(spec))}</dd><dt>Native staged change</dt><dd>{displayValue(reading?.native?.staged?.value,isSensitiveSetting(spec))}{reading?.native?.staged&&` · ${reading.native.staged.stage_state} · ${reading.native.staged.stage_ref??'No stage reference reported'}`}</dd><dt>Proposed override</dt><dd>{draft?displayValue(draft.value,isSensitiveSetting(spec)):'No local draft'}</dd><dt>Applies</dt><dd>{spec.effect.summary}</dd><dt>Native default</dt><dd>{spec.default!==undefined?displayValue(spec.default,isSensitiveSetting(spec)):spec.default_semantics==='computed'?'Computed by owner':'No literal default contributed'}</dd><dt>Reconciliation</dt><dd>{reading?.reconciliation.status??'Not read'} · {reading?.reconciliation.reason??''}</dd><dt>Reading basis</dt><dd>{reading?.native_reading?.reading_digest??'Not reported'}</dd>{!entry.available&&<><dt>Connection</dt><dd>{entry.reason??'Owner unavailable'}</dd></>}</dl></details>
    </article>
  }
  return <section className="settings-workspace" aria-label="Settings" onKeyDown={event => {
    if ((event.metaKey||event.ctrlKey)&&event.key==='f'){event.preventDefault();searchRef.current?.focus()}
    if(event.key==='Escape'&&query){event.preventDefault();event.stopPropagation();setQuery('');searchRef.current?.focus()}
    else if(event.key==='Escape'&&!review&&!resetTarget&&!result&&onReturn){event.preventDefault();onReturn()}
  }}>
    <header className="settings-header"><h1>Preferences</h1><div className="settings-search"><span aria-hidden="true">⌕</span><input ref={searchRef} aria-label="Search settings" type="search" value={query} onChange={e=>{setQuery(e.target.value);setSearchIndex(0)}} placeholder="Search preferences" aria-controls={query?`${id}-results`:undefined} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setSearchIndex(i=>Math.max(0,Math.min(i+1,results.length+contextualResults.length+pageResults.length-1)))}if(e.key==='ArrowUp'){e.preventDefault();setSearchIndex(i=>Math.max(i-1,0))}if(e.key==='Enter'){const local=results[searchIndex],contextual=contextualResults[searchIndex-results.length],page=pageResults[searchIndex-results.length-contextualResults.length];if(local){e.preventDefault();openEntry(local)}else if(contextual&&adapter.navigate){e.preventDefault();adapter.navigate({...contextual.destination,setting_ref:contextual.setting_ref,scope:contextual.scope})}else if(page){e.preventDefault();openPage(page.id)}}}}/><kbd>⌘ F</kbd></div>{onReturn&&<button type="button" className="settings-back" onClick={onReturn}>← {request?.returnLabel??'Back to work'}</button>}</header>
    {adapter.simulated&&<div className="settings-source development" role="status"><strong>Development scenario</strong> · {adapter.label} · simulated responses, no native writes</div>}
    <div className="settings-body"><nav ref={navigationRef} className="preference-navigation" aria-label="Settings categories"><span className="preference-nav-heading">Preferences</span>{visibleCategories.filter(c=>c.id!=='products'&&c.id!=='inspection').map(c=><button key={c.id} type="button" aria-current={category===c.id&&!query?'page':undefined} onClick={()=>chooseCategory(c.id)}>{c.title}</button>)}{visibleCategories.some(c=>c.id==='products'||c.id==='inspection')&&<span className="preference-nav-heading">System</span>}{visibleCategories.filter(c=>c.id==='products'||c.id==='inspection').map(c=><button key={c.id} type="button" aria-current={category===c.id&&!query?'page':undefined} onClick={()=>chooseCategory(c.id)}>{c.title}</button>)}<div className="preference-nav-foot"><span className={`preference-dot ${adapter.kind==='unavailable'?'is-off':''}`}/>{adapter.kind==='unavailable'?'Native connection pending':adapter.simulated?'Development specimen':'Native configuration'}</div></nav>
    <div className="preference-content"><main className="settings-editor" aria-busy={busy||loading}>
      {problem&&<div className="settings-alert" role="alert">{problem}<button type="button" aria-label="Dismiss error" onClick={()=>setProblem(null)}>×</button></div>}{notice&&<div className="settings-notice" role="status">{notice}</div>}
      {loading&&<div className="settings-reading" role="status">Reading native preferences…<span/><span/><span/></div>}{!!query&&<><div className="settings-category-intro"><h2>Search results</h2><span>{results.length+contextualResults.length+pageResults.length} matches</span></div><div id={`${id}-results`}>{results.map((entry,index)=><button className={`settings-search-result ${index===searchIndex?'is-highlighted':''}`} type="button" key={entry.spec.setting_ref} onClick={()=>openEntry(entry)}><strong>{entry.spec.title}</strong><span>{categories.find(c=>c.id===categoryOf(entry))?.title} · {scopes[entry.spec.setting_ref]?scopeWord(scopes[entry.spec.setting_ref]):'Choose scope'}</span><small>{settingHelp(entry.spec)}</small></button>)}{contextualResults.map((entry,index)=><button className={`settings-search-result ${index+results.length===searchIndex?'is-highlighted':''}`} type="button" disabled={!adapter.navigate} key={entry.setting_ref} onClick={()=>adapter.navigate?.({...entry.destination,setting_ref:entry.setting_ref,scope:entry.scope})}><strong>{entry.title}</strong><span>Open working editor · {scopeWord(entry.scope)}</span><small>{entry.description}</small></button>)}{pageResults.map((page,index)=><button type="button" className={`settings-search-result ${index+results.length+contextualResults.length===searchIndex?'is-highlighted':''}`} key={page.id} onClick={()=>openPage(page.id)}><strong>{page.title}</strong><span>Open working controls</span><small>{page.description}</small></button>)}{!results.length&&!contextualResults.length&&!pageResults.length&&<p>No contributed setting matches “{query}”.</p>}</div></> }<div hidden={loading||!!query}>
        <div className="settings-category-intro"><h2>{categories.find(c=>c.id===category)?.title}</h2><p>{categories.find(c=>c.id===category)?.purpose}</p></div>
        {focusEntry&&<div className="preference-scope-bar"><ScopeControl entry={focusEntry} scope={focusScope} adapter={adapter} onChange={chooseScope} disabled={busy}/><span>{focusDraft?'Local changes retained at this scope':focusScope?scopeWord(focusScope):'Choose a native subject'}</span></div>}
        {adapter.kind==='unavailable'&&category!=='appearance'&&<div className="preference-connection-note" role="status">Native connection pending.{import.meta.env.DEV&&entries.length>0&&` Development source inventory: ${entries.length} descriptors from the installed suite census.`} Current values and changes require the receiving native adapter.</div>}
        {visited.has('appearance')&&<div hidden={category!=='appearance'}><AppearancePreferences adapter={adapter}/></div>}
        {visited.has('agents')&&<div hidden={category!=='agents'}><HarnessPreferences adapter={adapter}/></div>}
        {visited.has('connections')&&<div hidden={category!=='connections'}><CredentialPreferences adapter={adapter}/></div>}
        {visited.has('profiles')&&<div hidden={category!=='profiles'}><ProfilePreferences adapter={adapter} isSensitive={ref=>{const entry=entries.find(value=>value.spec.setting_ref===ref);return !entry||isSensitiveSetting(entry.spec)}} drafts={draftEntries.flatMap(([key,draft])=>{if(draft.error||draftOwnerChanged(draft,adapter.ownerEpoch))return [];const [setting_ref,scope_kind,scope_ref]=JSON.parse(key);return [{setting_ref,scope:{scope_kind,scope_ref},value:draft.value}]})} onStage={stageProfile}/></div>}
        {visited.has('products')&&<div hidden={category!=='products'}><ProductPreferences adapter={adapter}/></div>}
        {visited.has('execution')&&<div hidden={category!=='execution'}><MachinePreferences adapter={adapter} requestedScope={request?.page==='machines'?request.scope:null}/></div>}
        {visited.has('automations')&&<div hidden={category!=='automations'}><AutomationPreferences adapter={adapter} scope={operationScope} scopeRequestId={request?.page==='automations'?request.requestId:undefined}/></div>}
        {groups.filter(group=>visibleEntries.some(e=>e.spec.writable&&`${e.owner}|${e.spec.section_ref}`===group)).map(group=>{const [owner,section]=group.split('|');return <section className="preference-group" key={group} aria-label={`${owner} ${section}`}><h3 className="preference-group-title">{groupWord(owner,section)} <span>{ownerWord(owner)}</span></h3>{visibleEntries.filter(e=>e.spec.writable&&e.owner===owner&&e.spec.section_ref===section).map(row)}</section>})}
        {visibleEntries.some(e=>!e.spec.writable)&&<details className="preference-inspection" key={`${category}:${selected??''}`} open={visibleEntries.some(e=>!e.spec.writable&&e.spec.setting_ref===selected)}><summary>{inspectionLabel(category)}</summary>{groups.filter(group=>visibleEntries.some(e=>!e.spec.writable&&`${e.owner}|${e.spec.section_ref}`===group)).map(group=>{const [owner,section]=group.split('|');return <section className="preference-group" key={group}><h3 className="preference-group-title">{groupWord(owner,section)} <span>{ownerWord(owner)}</span></h3>{visibleEntries.filter(e=>!e.spec.writable&&e.owner===owner&&e.spec.section_ref===section).map(row)}</section>})}</details>}
        {!entries.length&&category!=='appearance'&&<p className="settings-muted">The owner has not contributed any settings.</p>}{mounts.filter(m=>!m.document).map(m=><div className="settings-empty" key={m.owner_ref}><h3>{ownerWord(m.owner_ref)}</h3><p>{m.error??m.availability.reason??'Contribution unavailable'}</p></div>)}
      </div>
      {resetTarget&&<section ref={reviewRef} tabIndex={-1} className="settings-review" aria-label="Confirm native reset"><h3>Restore {resetTarget.entry.spec.title}</h3><p>{scopeWord(resetTarget.scope)}</p><p>The native owner removes this scope’s override and resolves inheritance or its default.</p><button type="button" disabled={busy} onClick={()=>reset(resetTarget)}>Restore through owner</button><button type="button" disabled={busy} onClick={()=>setResetTarget(null)}>Cancel</button></section>}
      {review&&<section ref={reviewRef} tabIndex={-1} className="settings-review" aria-label="Review native changes"><h3>Review changes</h3>{review.bundle.plans.map(p=><div key={p.plan_digest}><strong>{entries.find(e=>e.spec.setting_ref===p.setting_ref)?.spec.title??p.setting_ref}</strong><p>{scopeWord(p.scope)}</p>{p.changes.map((change,i)=><p key={i}>{change.summary}</p>)}<p>{p.expected_effect.summary}</p><details><summary>Owner plan</summary><pre>{JSON.stringify(p,null,2)}</pre></details></div>)}{review.bundle.errors.map((error,index)=><p className="settings-field-error" role="alert" key={index}>{error.error_code}: {error.message}</p>)}<button type="button" disabled={busy||!adapter.canApply||!!review.bundle.errors.length||!review.bundle.plans.length} onClick={apply}>{adapter.simulated?'Simulate reviewed Apply':'Apply reviewed plans'}</button><button type="button" disabled={busy} onClick={()=>setReview(null)}>Back to editing</button>{!adapter.canApply&&<p>{adapter.applyUnavailableReason??'Protected native Apply is not connected.'}</p>}</section>}
      {result&&<section ref={reviewRef} tabIndex={-1} className="settings-result" aria-label="Native application result"><h3>{adapter.simulated?'Simulated':'Native'} result · {result.status}</h3>{result.status!=='applied'&&<p role="status">Application has not been acknowledged. Unapplied drafts remain available for review.</p>}{result.operations.map((operation,index)=><p key={index}>{operation.setting_ref}: {operation.status}{operation.error&&` · ${operation.error.message}`}</p>)}<button type="button" onClick={()=>setResult(null)}>Close result</button><details><summary>Acknowledgement</summary><pre>{JSON.stringify(result,null,2)}</pre></details></section>}
    </main>
    {showInfo&&focusEntry&&!query&&<aside className="preference-help" aria-label="Selected preference help"><div><h3>{focusEntry.spec.title}</h3><p>{settingHelp(focusEntry.spec)}</p></div><div className="preference-help-values"><span><b>Effective</b> {displayValue(focusReading?.native?.effective?.value,isSensitiveSetting(focusEntry.spec))}</span><span><b>From</b> {focusReading?.native?.effective?ownerWord(focusEntry.owner):'Awaiting owner reading'}</span><span><b>Applies</b> {timing(focusEntry.spec.effect.kind)} · {focusEntry.spec.effect.summary}</span>{focusDraft&&<span><b>Draft</b> {displayValue(focusDraft.value,isSensitiveSetting(focusEntry.spec))} · not applied</span>}</div></aside>}
    </div></div>
    <footer className="settings-footer"><button className="settings-info-toggle" type="button" aria-expanded={showInfo} onClick={()=>setShowInfo(on=>!on)}>ⓘ Info</button><span>{draftEntries.length?`${draftEntries.length} local change${draftEntries.length===1?'':'s'}${invalid?' · Fix invalid values':''}`:''}</span>{draftEntries.length>0&&<button type="button" disabled={invalid||busy||loading||adapter.kind==='unavailable'} onClick={plan}>{busy?'Waiting for owner…':'Review changes…'}</button>}<small>{adapter.simulated?'Development only':adapter.kind==='unavailable'?(import.meta.env.DEV&&entries.length?'Source census · 7 October 2026':'Native connection pending'):adapter.label}</small></footer>
  </section>
}

function inspectionLabel(category:CategoryId):string{return ({agents:'Available model catalogue',connections:'Connection details',products:'Installation details',permissions:'Access policy details',execution:'Service and environment details'} as Partial<Record<CategoryId,string>>)[category]??'Native configuration details'}
function ownerWord(owner:string):string{return ({'ai-kit':'AIKit','software-factory':'Software Factory','central':'Central','oi':'O:I','quaternal-logic':'Quaternal Logic','workcell':'Workcell','actuation':'Actuation'} as Record<string,string>)[owner]??owner}
function groupWord(owner:string,section:string):string{return ({'ai-kit:resolution':'Working practices','ai-kit:skills':'Available capabilities','ai-kit:models':'Models','ai-kit:local-services':'Local service elections','central:skills':'Standing methods','software-factory:telemetry':'Telemetry search','software-factory:binding':'Project binding','workcell:processes-services':'Declared services','central:policy':'Ground policies'} as Record<string,string>)[`${owner}:${section}`]??section.replace(/[-_]/g,' ')}
function scopeWord(scope:ScopeAddress):string{return scope.scope_ref?`${scope.scope_kind} · ${scope.scope_ref}`:({'machine':'This machine','world':'World','ground':'Ground'} as Record<string,string>)[scope.scope_kind]??scope.scope_kind}

function provenance(value: unknown): string {
  if (!value) return 'Source not reported'
  if (typeof value === 'string') return value
  return Object.entries(value as Record<string, unknown>).filter(([,v]) => v !== null && v !== undefined).map(([k,v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ') || 'Source not reported'
}
function timing(kind: string): string {
  return ({ 'value-change': 'At next owner resolution', 'restart-required': 'Restart required', 'session-restart-required': 'New sessions', 'provider-reconnect-required': 'Reconnect required', 'material-effect': 'Material change', 'none': 'Read only', 'pending': 'Pending', 'unknown': 'Timing not reported' } as Record<string,string>)[kind] ?? kind
}
function ScopeControl({ entry, scope, adapter, onChange, disabled }: { entry: SettingEntry; scope?: ScopeAddress; adapter: SettingsAdapter; onChange: (s: ScopeAddress | null) => void; disabled: boolean }) {
  const [subject, setSubject] = useState('')
  const [kind, setKind] = useState(scope?.scope_kind ?? entry.spec.allowed_scopes[0]?.scope_kind)
  const remembered = useRef<Partial<Record<ScopeAddress['scope_kind'], ScopeAddress>>>({})
  useEffect(() => { if (scope) { remembered.current[scope.scope_kind] = scope; setKind(scope.scope_kind); setSubject(scope.scope_ref ?? '') } }, [scope])
  const options = adapter.scopeChoices?.filter(c => allowedScope(entry.spec, c.address)) ?? []
  const supported = entry.spec.allowed_scopes
  const kinds = [...new Set(supported.map(s => s.scope_kind))]
  const proposed = kind ? { scope_kind: kind, scope_ref: subject.trim() } : null
  const permittedSubject = proposed && allowedScope(entry.spec, proposed)
  return <div className="settings-scope"><label>Applies to<select disabled={disabled} aria-label={`${entry.spec.title} scope`} value={kind ?? ''} onChange={e => {
    const nextKind = e.target.value as ScopeAddress['scope_kind']; setKind(nextKind); setSubject('')
    const exact = supported.find(s => s.scope_kind === nextKind)?.scope_ref
    if (exact !== null && exact !== undefined) onChange({ scope_kind: nextKind, scope_ref: exact })
    else if (['world','ground','machine'].includes(nextKind)) onChange({ scope_kind: nextKind, scope_ref: null })
    else if (remembered.current[nextKind] && allowedScope(entry.spec, remembered.current[nextKind]!)) onChange(remembered.current[nextKind]!)
    else onChange(null)
  }}>{kinds.map(k => <option value={k} key={k}>{scopeWord({scope_kind:k,scope_ref:null})}</option>)}</select></label>{kind && !['world','ground','machine'].includes(kind) && <div><input aria-label={`${entry.spec.title} scope subject`} disabled={disabled} list={`${entry.spec.setting_ref}-subjects`} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Native subject reference" /><datalist id={`${entry.spec.setting_ref}-subjects`}>{[...options.filter(o => o.address.scope_kind === kind),...supported.filter(s => s.scope_kind === kind && s.scope_ref).map(s => ({address:s,title:s.scope_ref!}))].map(o => <option key={o.address.scope_ref} value={o.address.scope_ref ?? ''}>{o.title}</option>)}</datalist><button type="button" disabled={disabled || !permittedSubject} onClick={() => { if (proposed && allowedScope(entry.spec, proposed)) onChange(proposed) }}>Read scope</button>{subject && !permittedSubject && <small>This subject is not permitted by the native descriptor.</small>}</div>}</div>
}
