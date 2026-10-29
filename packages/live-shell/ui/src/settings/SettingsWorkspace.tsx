// The Settings window (manual §10.10): the catalogue design `settings:window` draws the window, its pages down the left and the page beside
// them, on the binding composed here from the readings and presses the window's own code makes (ported from the parked port 7cba70d10). The
// engine is the window's, unchanged in what it reads and writes: the owners' contributed settings (config_registry_read, read when Settings
// first opens), their resolutions at each setting's scope (config_resolutions_read), your local changes keyed by setting and scope, Review
// (the owners' plans, config_plan_reviewed, on the reading basis you edited on), Apply (config_apply_reviewed, read back after) and Reset
// (config_reset on the reading digest). The pages' own readings and presses are windowPages.ts's hooks, each read once its page opens.
// The design's page is the host's (deviceHost.tsx): the window's category follows it, and a contextual request turns it. An owner's
// acknowledgement is said on the status bar's Info line (deviceHost.tsx sayOnInfoLine), as the host says a refusal.
import { useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ChangeRequest, ChangeSetDocument, ConfigResolution, ContributionMount, PlanBundle, ScopeAddress, SettingsAdapter, SettingsRequest } from './adapter'
import { unavailableSettingsAdapter } from './adapter'
import { acknowledgeDrafts, allowedScope, basisChanged, categoryOf, createDraft, draftOwnerChanged, initialScope, isSensitiveSetting, rawValue, settingKey } from './model'
import type { CategoryId, Draft, SettingEntry } from './model'
import type { DesignBinding, Standing, Value, ValueChange } from '../frame/devices/designed'
import { HostedDevice, hostState, sayOnInfoLine, setHostPage } from '../frame/devices/deviceHost'
import { design as windowDesign, searchResults } from '../inhabitants/catalogue/panels/settings__window'
import { SETTINGS_LOCAL_KEYS, SETTINGS_WINDOW_ID, SETTINGS_WINDOW_WIRING, searchStep, windowCoreValues } from './windowValues'
import { useAppearancePage, useAutomationsPage, useCredentialsPage, useHarnessPage, useMachinesPage, useProductsPage, useProfilesPage, useSetupPage, type Act, type PagePart } from './windowPages'
import { themeOwned } from './presentationSetting'
import { chatDefaultOwned } from './chatDefaultSetting'
import { configPlansOf, ownedRef, withOwnerAnswers, withOwnerPlans, type OwnedSetting } from './ownedSettings'
import { ShellConfigContext } from '../shell/useSet'
import '../inhabitants/catalogue/panels/panels.css'
import './preferences.css'

/** The design's pages and the categories the window files settings under (model.ts categories; settings__window.tsx PAGES). */
const PAGE_OF: Readonly<Record<CategoryId, string>> = {agents: 'harnesses', skills: 'skills', profiles: 'profiles', permissions: 'permissions', connections: 'credentials',
  execution: 'machines', automations: 'automations', telemetry: 'telemetry', library: 'library', appearance: 'appearance', products: 'products', inspection: 'system'}
const CATEGORY_OF: Readonly<Record<string, CategoryId>> = Object.fromEntries(Object.entries(PAGE_OF).map(([category, page]) => [page, category as CategoryId]))
/** The scope the Applies to chooser sets, with the page's category it applies to. */
const scopeOf = (value: Value | undefined): {scope: ScopeAddress; category?: string} | null => {
  if (typeof value !== 'string') return null
  try {
    const s = JSON.parse(value) as {kind?: unknown; ref?: unknown; category?: unknown}
    return typeof s.kind === 'string' ? {scope: {scope_kind: s.kind, scope_ref: typeof s.ref === 'string' && s.ref ? s.ref : null} as ScopeAddress, ...(typeof s.category === 'string' ? {category: s.category} : {})} : null
  } catch { return null }
}
/** The page Settings opens on: Setup the first time the DLW opens, on a world with no ground yet (manual §10.11, the host's `onboarding`),
 * else Harnesses & models. */
const firstPage = (onboarding: boolean | undefined) => (onboarding ? 'setup' : 'harnesses')

const unavailable = unavailableSettingsAdapter()
interface Props { adapter?: SettingsAdapter; request?: SettingsRequest | null; onReturn?: () => void; active?: boolean; initialDrafts?: { setting_ref: string; scope: ScopeAddress; raw: unknown }[] }
type Review = { bundle: PlanBundle; submitted: Record<string, Draft>; epoch?: string }

export function SettingsWorkspace({ adapter = unavailable, request, onReturn, active = true, initialDrafts }: Props) {
  const [mounts, setMounts] = useState<ContributionMount[]>([])
  const [readings, setReadings] = useState<Record<string, ConfigResolution>>({})
  const [scopes, setScopes] = useState<Record<string, ScopeAddress>>({})
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  // The page the design shows is the host's (deviceHost.tsx setHostPage); the window's category follows it, and a page is read once opened.
  // A press inside the window re-reads the host's page (the design turns it in the press's own handler, before this one hears the click).
  const onboarding = useContext(ShellConfigContext)?.onboarding
  const [, setPageTick] = useState(() => { if (hostState(SETTINGS_WINDOW_ID).page === null) setHostPage(SETTINGS_WINDOW_ID, firstPage(onboarding)); return 0 })
  const page = hostState(SETTINGS_WINDOW_ID).page ?? firstPage(onboarding)
  const category: CategoryId = CATEGORY_OF[page] ?? 'agents'
  const setCategory = (next: CategoryId) => { setHostPage(SETTINGS_WINDOW_ID, PAGE_OF[next]); setPageTick(n => n + 1) }
  const [visited,setVisited]=useState<Set<CategoryId>>(()=>new Set(['agents']))
  // Setup files no settings under a category: it is read once its page has opened.
  const [setupOpened, setSetupOpened] = useState(page === 'setup')
  useEffect(() => { if (page === 'setup') setSetupOpened(true) }, [page])
  const [operationScope,setOperationScope]=useState<ScopeAddress|null>(null)
  useEffect(()=>{setVisited(old=>old.has(category)?old:new Set([...old,category]))},[category])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  // The plans an Apply answered: they stay beside the owners' answer (§10.10 "Each owner answers in the same table").
  const [answered, setAnswered] = useState<PlanBundle | null>(null)
  const [result, setResult] = useState<ChangeSetDocument | null>(null)
  const [registryRead, setRegistryRead] = useState(0)
  // The window's own keys (SETTINGS_WINDOW_WIRING.local): the search's mark, the scope, the setting a press opened, the open form and its fields.
  const [holds, setHolds] = useState<Record<string, Value>>({})
  const hold = (key: string, value: Value | undefined) => setHolds(was => { const next = {...was}; if (value === undefined) delete next[key]; else next[key] = value; return next })
  const setSelected = (ref: string | null) => hold('focus', ref ?? undefined)
  const root = useRef<HTMLElement>(null)
  const refocusSearch = useRef(false)
  const generation = useRef(0)
  const activeAdapter = useRef(adapter)
  activeAdapter.current = adapter
  const draftsRef=useRef(drafts);draftsRef.current=drafts
  const busyRef=useRef(busy);busyRef.current=busy
  const seeded = useRef(false)
  const entries = useMemo(() => mounts.flatMap(mount => (mount.document?.sections.flatMap(section => section.settings) ?? []).map(spec => ({ spec, owner: mount.owner_ref, available: mount.availability.state === 'available' || mount.availability.state === 'degraded', reason: mount.availability.reason }))), [mounts])
  const draftEntries = Object.entries(drafts)

  // Preferences are read when they are first opened — or first asked for, by a contextual entry's request — never at boot: the
  // panel stands mounted, hidden, for the whole session (panels/settings.tsx), and its registry and resolutions cost the owner
  // 4–68 s (measured 15 Oct). Once opened, they are read as before: again for each new adapter or owner epoch, or on Read again.
  const [wanted, setWanted] = useState(active || !!request)
  useEffect(() => { if (!wanted && (active || request)) setWanted(true) }, [active, request, wanted])

  useEffect(() => {
    if (!wanted) return
    const epoch = ++generation.current
    setLoading(true); setProblem(null); setResult(null); setReview(null); setAnswered(null); setReadings({}); setBusy(false)
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
  }, [adapter, adapter.ownerEpoch, wanted, registryRead])

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
    if(request.page==='setup'){setHostPage(SETTINGS_WINDOW_ID,'setup');if(request.folder){hold('setupStep','projects');hold('folder',request.folder);hold('make',undefined);hold('wiki',undefined);hold('where',undefined)}setPageTick(n=>n+1);setSelected(null);setQuery('');return}
    if(request.page){setCategory(request.page==='machines'?'execution':'automations');setOperationScope(request.scope);setSelected(null);setQuery('');return}
    if(!entries.length)return
    const entry = entries.find(e => e.spec.setting_ref === request.setting_ref)
    if (!entry) { setProblem(`This product did not contribute ${request.setting_ref}.`); return }
    if (!allowedScope(entry.spec, request.scope)) { setProblem('This setting does not support the requested scope. No substitute scope was selected.'); return }
    setCategory(categoryOf(entry)); setScopes(old => ({ ...old, [request.setting_ref]: request.scope })); setSelected(request.setting_ref); setQuery('')
  }, [request?.requestId, entries])

  // A local change, or an open form, is not lost to a reload without asking (the window's and MachinePreferences.tsx's guard).
  const formOpen = typeof holds.adding === 'string'
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (draftEntries.length || formOpen) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [draftEntries.length, formOpen])

  // Opened without a contextual request, the window takes the caret in Search (the window's search field took it on opening).
  useEffect(() => { if (active && !request) root.current?.querySelector<HTMLInputElement>('.st-search input')?.focus() }, [active])
  // A search sent with Enter redraws its field: the caret goes back to it, so ↑/↓ and Enter carry on through the results.
  useEffect(() => {
    if (!refocusSearch.current) return
    refocusSearch.current = false
    const field = root.current?.querySelector<HTMLInputElement>('.st-search input')
    field?.focus()
    field?.setSelectionRange(field.value.length, field.value.length)
  }, [query])

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
    setDrafts(old=>({...old,...next}));setReview(null);setAnswered(null);setResult(null)
  }

  function edit(entry: SettingEntry, scope: ScopeAddress, raw: unknown) {
    const key = settingKey(entry.spec.setting_ref, scope)
    setDrafts(previous => ({ ...previous, [key]: {...createDraft(entry.spec, raw, allReadings[key], previous[key]),ownerEpoch:previous[key] ? previous[key].ownerEpoch : adapter.ownerEpoch} }))
    setReview(null); setAnswered(null); setResult(null)
  }
  async function refresh(pairs: { setting_ref: string; scope: ScopeAddress }[], epoch = generation.current, source = adapter) {
    const latest = await source.readResolutions(pairs)
    guard(epoch, source)
    setReadings(existing => ({ ...existing, ...Object.fromEntries(latest.map(r => [settingKey(r.setting_ref, r.scope), r])) }))
    return latest
  }
  async function plan() {
    const epoch = generation.current; const source = adapter
    setBusy(true); setProblem(null)
    try {
      const submitted = { ...drafts }
      if(Object.values(submitted).some(draft=>draftOwnerChanged(draft,source.ownerEpoch)))throw new Error('These drafts belong to the previous native owner or access context. Inspect and explicitly rebase them before review.')
      // The configuration plane plans its owners' changes; each owned setting's own owner plans its change (ownedSettings.ts).
      const ownedKeys = new Map(owned.map(o => [settingKey(ownedRef(o), o.scope), o]))
      const requests = Object.entries(submitted).filter(([key]) => !ownedKeys.has(key)).map(([key, draft]) => { const [setting_ref, scope_kind, scope_ref] = JSON.parse(key); return { setting_ref, scope: { scope_kind, scope_ref } as ScopeAddress, value: draft.value } })
      let configBundle: PlanBundle | null = null
      if (requests.length) {
        const latest = await refresh(requests, epoch, source)
        if (requests.some(r => !latest.find(l => settingKey(l.setting_ref, l.scope) === settingKey(r.setting_ref, r.scope)))) throw new Error('The owner did not return a resolution for every draft. The drafts are retained.')
        if (latest.some(r => basisChanged(submitted[settingKey(r.setting_ref, r.scope)], r))) throw new Error('The native basis changed. Inspect the current values, then explicitly rebase your draft before reviewing again.')
        const basis = requests.map(r => ({ setting_ref: r.setting_ref, scope: r.scope, reading_digest: submitted[settingKey(r.setting_ref, r.scope)].basis }))
        guard(epoch, source)
        configBundle = await source.plan(requests, basis)
        guard(epoch, source)
      }
      const ownedPlans = []
      for (const [key, o] of ownedKeys) {
        if (!submitted[key]) continue
        ownedPlans.push(await o.plan(submitted[key]))
        guard(epoch, source)
      }
      setReview({ bundle: withOwnerPlans(configBundle, ownedPlans), submitted, epoch: source.ownerEpoch }); setAnswered(null); setResult(null)
    } catch (error) { if (isCurrent(epoch, source)) setProblem(error instanceof Error ? error.message : String(error)); throw error }
    finally { if (isCurrent(epoch, source)) setBusy(false) }
  }
  async function apply(): Promise<string> {
    const ownedRefs = new Set(owned.map(ownedRef)), cfg = review ? configPlansOf(review.bundle.plans, ownedRefs) : []
    if (!review || (cfg.length && !adapter.canApply)) throw new Error('Nothing is planned: press Review changes first.')
    const epoch = generation.current; const source = adapter
    setBusy(true); setProblem(null)
    try {
      if (review.epoch !== adapter.ownerEpoch) throw new Error('The native owner connection changed. Review the retained drafts again.')
      const pairs = cfg.map(p => ({ setting_ref: p.setting_ref, scope: p.scope }))
      let response: ChangeSetDocument | null = null
      if (pairs.length) {
        const latest = await refresh(pairs, epoch, source)
        if (latest.length !== pairs.length || latest.some(r => basisChanged(review.submitted[settingKey(r.setting_ref, r.scope)], r))) throw new Error('The native basis changed after review. No apply was sent. Your drafts are retained.')
        guard(epoch, source)
        response = await source.apply(cfg)
        guard(epoch, source)
      }
      // Each owned setting's owner applies its plan, read again first; its answer stands in the same table (ownedSettings.ts).
      const answers = []
      for (const plan of review.bundle.plans) {
        const o = owned.find(candidate => ownedRef(candidate) === plan.setting_ref)
        if (!o) continue
        answers.push(await o.apply(plan))
        guard(epoch, source)
      }
      const answered = answers.length || !response ? withOwnerAnswers(response, answers) : response
      setResult(answered); setAnswered(review.bundle)
      const acknowledged = answered.operations.filter(o => o.status === 'applied' || o.status === 'verified').map(o => settingKey(o.setting_ref, o.scope))
      setDrafts(current => acknowledgeDrafts(current, review.submitted, acknowledged))
      setReview(null)
      if (pairs.length) await refresh(pairs, epoch, source)
      return adapter.simulated && pairs.length ? 'Development response only. No native configuration was persisted.'
        : answered.status === 'applied' ? 'Native response received. Effective and observed values come from the new reading.'
          : 'Application has not been acknowledged for every change. Unapplied drafts remain available for review.'
    } catch (error) { if (isCurrent(epoch, source)) setProblem(error instanceof Error ? error.message : String(error)); throw error }
    finally { if (isCurrent(epoch, source)) setBusy(false) }
  }
  async function reset(target: { entry: SettingEntry; scope: ScopeAddress; digest: string | null }): Promise<string> {
    const { entry, scope, digest } = target
    const epoch = generation.current; const source = adapter
    if (!source.reset) throw new Error('The native reset operation is not connected.')
    setBusy(true); setProblem(null)
    try {
      const key = settingKey(entry.spec.setting_ref, scope)
      const latest = await refresh([{ setting_ref: entry.spec.setting_ref, scope }], epoch, source)
      if ((latest[0]?.native_reading?.reading_digest ?? null) !== digest) throw new Error('The native basis changed. Inspect the new reading before resetting.')
      guard(epoch, source)
      const response = await source.reset({ setting_ref: entry.spec.setting_ref, scope, reading_digest: digest })
      guard(epoch, source)
      setResult(response); setAnswered(null)
      const done = response.operations.some(o => o.status === 'applied' || o.status === 'verified')
      if (done) setDrafts(old => { const next = { ...old }; delete next[key]; return next })
      await refresh([{ setting_ref: entry.spec.setting_ref, scope }], epoch, source)
      // A reset the owner refused stays on its control in the owner's words; its answer stands in the Review table as well.
      if (!done) throw new Error(response.operations.find(o => o.error)?.error?.message ?? `The owner answered ${response.status}: the override stays.`)
      return adapter.simulated ? 'Development reset response. No native override was removed.' : 'Native reset response received; resolution has been read again.'
    } catch (error) { if (isCurrent(epoch, source)) setProblem(error instanceof Error ? error.message : String(error)); throw error }
    finally { if (isCurrent(epoch, source)) setBusy(false) }
  }

  // ── the pages (windowPages.ts), each read once its page opens ─────────────────────────────────────────────────────────────────────
  const heldRef = useRef(holds)
  heldRef.current = holds
  const held = useMemo(() => (key: string) => heldRef.current[key], [])
  const done = useMemo(() => (keys: readonly string[]) => setHolds(was => { const next = {...was}; for (const key of keys) delete next[key]; return next }), [])
  const sensitive = useMemo(() => (ref: string) => { const entry = entries.find(value => value.spec.setting_ref === ref); return !entry || isSensitiveSetting(entry.spec) }, [entries])
  const validDrafts = useMemo((): ChangeRequest[] => draftEntries.flatMap(([key, draft]) => {
    if (draft.error || draftOwnerChanged(draft, adapter.ownerEpoch)) return []
    const [setting_ref, scope_kind, scope_ref] = JSON.parse(key)
    // A profile keeps the configuration owners' settings; an owned setting (the theme, the chat default: ownedSettings.ts) is never profiled.
    if (!entries.some(entry => entry.spec.setting_ref === setting_ref)) return []
    return [{ setting_ref, scope: { scope_kind, scope_ref } as ScopeAddress, value: draft.value }]
  }), [draftEntries, adapter.ownerEpoch, entries])
  const requestProject = operationScope?.scope_kind === 'project' ? operationScope.scope_ref ?? null : null
  const context = typeof holds.context === 'string' ? holds.context || null : requestProject
  const harness = useHarnessPage(adapter, wanted && visited.has('agents'))
  const credentials = useCredentialsPage(adapter, wanted && visited.has('connections'), held, done)
  const appearance = useAppearancePage(adapter, wanted && visited.has('appearance'))
  // The owned settings: the owners outside the configuration plane, once each one's reading stands (ownedSettings.ts) — the presentation
  // owner's theme and O:I's chat default. Their entries stand first among the owners' settings, their readings as resolutions; their
  // changes are drafts like every other, and plan() and apply() take each to its own owner. An owner's new reading reaches its page only
  // while the adapter that read it is the window's.
  const owned = useMemo((): OwnedSetting[] => {
    const current = <T,>(set: (value: T) => void) => (value: T) => { if (activeAdapter.current === adapter) set(value) }
    return [
      ...(appearance.reading ? [themeOwned(adapter, appearance.reading, appearance.library, current(appearance.set))] : []),
      ...(harness.reading && adapter.harnesses ? chatDefaultOwned(adapter.harnesses, harness.reading, current(harness.set)) : []),
    ]
  }, [adapter, appearance.reading, appearance.library, appearance.set, harness.reading, harness.set])
  const allEntries = useMemo(() => [...owned.map(o => o.entry), ...entries], [entries, owned])
  const allScopes = useMemo(() => ({ ...scopes, ...Object.fromEntries(owned.map(o => [ownedRef(o), o.scope])) }), [scopes, owned])
  const allReadings = useMemo(() => ({ ...readings, ...Object.fromEntries(owned.map(o => [settingKey(ownedRef(o), o.scope), o.reading])) }), [readings, owned])
  const profiles = useProfilesPage(adapter, wanted && visited.has('profiles'), held, validDrafts, stageProfile, sensitive, done)
  const machines = useMachinesPage(adapter, wanted && visited.has('execution'), held, request?.page === 'machines' ? request.scope : null, done)
  const automations = useAutomationsPage(adapter, wanted && visited.has('automations'), held, context, typeof holds.show === 'string' ? holds.show : 'routines',
    typeof holds.routine === 'string' ? holds.routine : null, done)
  const products = useProductsPage(adapter, wanted && (visited.has('products') || visited.has('inspection')))
  const setup = useSetupPage(adapter, wanted && setupOpened, held, done, [holds.folder, holds.make, holds.wiki, holds.where, holds.credential, holds.reference,
    holds.groundFolder, holds.groundName, holds.birthName, holds.birthDate])
  const parts: readonly PagePart[] = [harness, credentials, appearance, profiles, machines, automations, products, setup]

  // ── the window's own presses ────────────────────────────────────────────────────────────────────────────────────────────────────
  const entryOf = (ref: string) => allEntries.find(entry => entry.spec.setting_ref === ref)
  const own: Record<string, Act> = {
    plan: async () => { await plan() },
    apply: async () => apply(),
    reset: async ref => {
      const mine = owned.find(o => ownedRef(o) === String(ref))
      if (mine) {
        if (!mine.reset) throw new Error(mine.noReset ?? 'Its owner keeps no wider value to return to.')
        const said = await mine.reset()
        setDrafts(old => { const next = { ...old }; delete next[settingKey(ownedRef(mine), mine.scope)]; return next })
        return said
      }
      const entry = entryOf(String(ref)), scope = entry ? scopes[entry.spec.setting_ref] : undefined
      if (!entry || !scope) throw new Error(`${String(ref)} has no scope to reset at.`)
      if (!adapter.reset) throw new Error('The native reset operation is not connected.')
      const reading = readings[settingKey(entry.spec.setting_ref, scope)]
      if (!reading) throw new Error('Read the setting before resetting it.')
      return reset({ entry, scope, digest: reading.native_reading?.reading_digest ?? null })
    },
    keep: async ref => {
      const entry = entryOf(String(ref)), scope = entry ? allScopes[entry.spec.setting_ref] : undefined, key = entry && scope ? settingKey(entry.spec.setting_ref, scope) : null
      const reading = key ? allReadings[key] : undefined
      if (!key || !drafts[key] || !reading) throw new Error('Keep: there is no local change on a current reading to keep.')
      setDrafts(old => ({ ...old, [key]: { ...old[key], basis: reading.native_reading?.reading_digest ?? null, ownerEpoch: adapter.ownerEpoch, version: old[key].version + 1 } }))
      setReview(null); setProblem(null)
    },
    discard: async () => { setDrafts({}); setReview(null); setAnswered(null); setResult(null) },
    returnToWork: async () => { if (!onReturn) throw new Error('Settings was not opened from a piece of work: press Esc to close it.'); onReturn() },
    reread: async () => {
      setRegistryRead(n => n + 1)
      await Promise.all(parts.map(part => part.reread()))
    },
    openElsewhere: async ref => {
      const target = (adapter.pointOfUseEntries ?? []).find(entry => entry.setting_ref === ref)
      if (!target || !adapter.navigate) throw new Error('Its editor stands beside its instrument, and this window reaches no other place from here (SettingsAdapter.navigate).')
      adapter.navigate({ ...target.destination, setting_ref: target.setting_ref, scope: target.scope })
    },
  }
  const ownWhy: Record<string, string> = {}
  if (!draftEntries.length) ownWhy.plan = 'You have no local changes.'
  // A change the owner's schema refuses is said on its own field, and nothing is planned until it is valid (the old Review's guard).
  const invalid = draftEntries.find(([, draft]) => draft.error !== null)
  if (invalid) ownWhy.plan = `A local change is not valid yet: ${invalid[1].error}`
  if (adapter.kind === 'unavailable' && draftEntries.length) ownWhy.plan = adapter.applyUnavailableReason ?? adapter.label
  if (busy) ownWhy.plan = 'Waiting for the owner…'
  if (!adapter.navigate) ownWhy.openElsewhere = 'Its editor stands beside its instrument, and this window reaches no other place from here (SettingsAdapter.navigate).'
  if (!onReturn) ownWhy.returnToWork = 'Settings was not opened from a piece of work.'
  // A path setting's Choose… goes to the system's own picker (SettingsAdapter.pickResource), then stands as your local change.
  for (const entry of entries) if (entry.spec.value_schema.type === 'path') {
    own[`pick:${entry.spec.setting_ref}`] = async () => {
      if (!adapter.pickResource) throw new Error('No system picker is connected (SettingsAdapter.pickResource).')
      const scope = scopes[entry.spec.setting_ref], picked = await adapter.pickResource(entry.spec)
      if (picked !== null && scope) edit(entry, scope, picked)
    }
    if (!adapter.pickResource) ownWhy[`pick:${entry.spec.setting_ref}`] = 'No system picker is connected (SettingsAdapter.pickResource).'
  }

  // ── the binding ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const binding = useMemo((): DesignBinding => {
    const values: Record<string, Value> = windowCoreValues({adapter, mounts, entries: allEntries, readings: allReadings, scopes: allScopes, drafts, review: review?.bundle ?? null, answered, result, loading, query})
    for (const part of parts) Object.assign(values, part.values)
    for (const [key, value] of Object.entries(holds)) if (key !== 'search' && key !== 'scope') values[key] = value
    if (onReturn) values.back = request?.returnLabel ?? 'Back to work'
    const acts: Record<string, Act> = { ...own }
    const why: Record<string, string> = { ...ownWhy }
    const standing: Record<string, Standing> = {}
    for (const part of parts) { Object.assign(acts, part.acts); Object.assign(why, part.why); for (const [key, words] of Object.entries(part.refused)) standing[key] = { refused: words } }
    for (const [key, words] of Object.entries(SETTINGS_WINDOW_WIRING.refused)) why[key] = words
    // A Review that holds only owned settings' plans needs no protected configuration Apply: their owners apply them.
    const themeOnly = !!review && review.bundle.plans.length > 0 && !configPlansOf(review.bundle.plans, new Set(owned.map(ownedRef))).length
    if (!adapter.canApply && !themeOnly) why.apply = adapter.applyUnavailableReason ?? 'Protected native Apply is not connected.'
    else if (!review) why.apply = answered ? 'Applied: each owner\'s answer stands in the table.' : 'Nothing is planned: press Review changes… first.'
    else if (review.bundle.errors.length) why.apply = review.bundle.errors.map(error => `${error.error_code}: ${error.message}`).join(' ')
    for (const [key, words] of Object.entries(why)) standing[key] = { ...standing[key], disabled: words }
    // What the owners did not answer while reading stands on Read again, in their words.
    if (problem) standing.reread = { refused: problem }
    for (const entry of allEntries) {
      const scope = allScopes[entry.spec.setting_ref], draft = scope ? drafts[settingKey(entry.spec.setting_ref, scope)] : undefined
      if (draft?.error) standing[`draft:${entry.spec.setting_ref}`] = { refused: draft.error }
    }
    // A Reset its owner has none of stands in place, dimmed, with the owner's reason, on its own row (§10.10 "An act its owner cannot take
    // stays in place, dimmed"): the same standing map, keyed by the row as its draft is.
    for (const o of owned) if (o.noReset) standing[`reset:${ownedRef(o)}`] = { disabled: o.noReset }
    // The window's own keys go to its hands at once, never to an owner: the search, the scope, the open forms, and your local changes.
    const local: Record<string, (value: Value | undefined) => void> = {}
    for (const key of SETTINGS_LOCAL_KEYS) local[key] = value => { hold(key, value); setPageTick(n => n + 1) }
    local.search = value => { setQuery(typeof value === 'string' ? value : ''); hold('hit', undefined); setPageTick(n => n + 1) }
    local.scope = value => {
      const chosen = scopeOf(value)
      if (!chosen) return
      // Applies to sets the scope of the page's settings that allow it (the old scope bar's chooseScope).
      setScopes(old => { const updated = { ...old }; for (const entry of entries) if ((!chosen.category || categoryOf(entry) === chosen.category) && allowedScope(entry.spec, chosen.scope)) updated[entry.spec.setting_ref] = chosen.scope; return updated })
      setReview(null)
    }
    for (const entry of allEntries) local[`draft:${entry.spec.setting_ref}`] = value => {
      const scope = allScopes[entry.spec.setting_ref]
      if (!scope) return
      if (value === undefined) { const key = settingKey(entry.spec.setting_ref, scope); setDrafts(old => { const next = { ...old }; delete next[key]; return next }); setReview(null); setAnswered(null); return }
      const schema = entry.spec.value_schema
      // A choice is the owner's own value, whatever its type (controls.tsx chose by index); a list or a table arrives as JSON.
      const raw = schema.type === 'enum' ? schema.options.find(option => String(option.value) === String(value))?.value ?? value
        : (schema.type === 'table' || schema.type === 'list') && typeof value === 'string' ? (() => { try { return JSON.parse(value) as unknown } catch { return value } })() : value
      edit(entry, scope, raw)
    }
    return {
      id: SETTINGS_WINDOW_ID, values, standing, local,
      ...(loading ? { waiting: ['settings'] } : {}),
      writes: key => key in acts || key in why,
      write: async (changes: readonly ValueChange[]) => {
        for (const change of changes) {
          if (why[change.key]) throw new Error(why[change.key])
          const act = acts[change.key]
          if (!act) throw new Error(`${change.key}: a reading — its owner reports it, and nothing here changes it.`)
          const said = await act(change.value)
          // The owner's acknowledgement, in its words, on the status bar's Info line (the pages said it under their controls).
          if (said) sayOnInfoLine(root.current, 'Settings', said)
        }
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the engine's own functions read the state named here
  }, [adapter, mounts, allEntries, allReadings, allScopes, owned, drafts, review, answered, result, loading, query, holds, problem, busy, onReturn, request?.returnLabel, ...parts])

  // ↑/↓ move the mark through the search's results and Enter opens the one marked; Enter on a changed search sends it first.
  function searchKey(event: KeyboardEvent<HTMLElement>) {
    const field = event.target as HTMLInputElement
    if (!field.closest?.('.st-search') || !['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return false
    if (event.key === 'Enter' && field.value !== query) { refocusSearch.current = true; return true }
    const results = searchResults(binding.values)
    const step = searchStep(results.length, typeof holds.hit === 'number' ? holds.hit : 0, event.key)
    if (!step) return true
    event.preventDefault()
    if ('hit' in step) { hold('hit', step.hit); return true }
    const found = results[step.open]!
    if (found.kind === 'elsewhere') { void own.openElsewhere(found.ref ?? '').catch(cause => sayOnInfoLine(root.current, 'Settings: refused', cause instanceof Error ? cause.message : String(cause))) }
    else { setHostPage(SETTINGS_WINDOW_ID, found.page!); if (found.ref) hold('focus', found.ref) }
    setQuery(''); hold('hit', undefined); setPageTick(n => n + 1)
    return true
  }

  return <section ref={root} className="settings-workspace settings-window-design" aria-label="Settings" onClick={() => setPageTick(n => n + 1)} onKeyDown={event => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'f') { event.preventDefault(); event.currentTarget.querySelector<HTMLInputElement>('.st-search input')?.focus(); return }
    if (searchKey(event)) return
    if (event.key === 'Escape' && query) { event.preventDefault(); event.stopPropagation(); setQuery('') }
    else if (event.key === 'Escape' && onReturn) { event.preventDefault(); onReturn() }
  }}>
    <HostedDevice designed={windowDesign} binding={binding} view="full" nav={{}} title="Settings" />
  </section>
}
