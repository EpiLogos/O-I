// Settings (manual §10.10, settings:window): the window ⌘, opens, after Live's Settings: its pages down the left, the page beside them.
// It holds what the owners of your world let you set: the harnesses and models new conversations start with, the credentials they
// reach providers through, the profiles you keep, the machines a workcell carries work to, the routines that run verified Methods,
// the look of the window, the installed products, and each owner's System reading (what it declares, what is in effect, what is
// active, what waits staged). The window stands on no chain, so it has Full only. One design with pages, not a design for each page:
// the pages share one search, one scope, one set of local changes and one review, as the shell's window does (settings/
// SettingsWorkspace.tsx, whose behaviour this design carries).
//
// Owners, keyed on their paths. Every reading arrives through the shell's SettingsAdapter (settings/adapter.ts) over kernel ops:
//   source      {kind: native | development | unavailable, label, simulated?}  the adapter itself (SettingsAdapter kind, label,
//               simulated). A development adapter answers with simulated responses and writes nothing native.
//   settings    [{ref, category, owner, section, title, kind, options?, columns?, rows?, effective?, from, timing, writable, range?}]
//               every owner's contributed setting at the chosen scope: config_registry_read (each owner's
//               oi.configuration-contribution/v1: setting_ref, section_ref, title, value_schema, operations, effect.kind) with
//               config_resolutions_read (the native effective value; declared at this scope → from 'here', else 'inherited';
//               'unread' before a reading). category is the page the shell files it under (settings/model.ts categoryOf). kind:
//               choice | toggle | number | text | path | list | table | secret. A secret's effective value is its reference.
//   scopes      [{kind, ref, title}]  the subjects a setting can apply to (SettingsAdapter.scopeChoices); `scope` is the chosen one.
//   conflicts   [ref]  drafts whose owner reading or owner connection changed since you made them (model.ts basisChanged,
//               draftOwnerChanged).
//   elsewhere   [{ref, title, where}]  settings whose editor stands beside its instrument (SettingsAdapter.pointOfUseEntries);
//               search finds them and opens them there.
//   plans       [{ref, title, scope, changes: [text], effect}]  the owners' plans for your local changes (config_plan_reviewed).
//   result      {status, operations: [{ref, status, message?}]}  the owners' answer to Apply or Reset (config_apply_reviewed,
//               config_reset).
// Harnesses & models (HarnessSource, desktop/cradle/src/configuration/harnessSource.ts, over harness_status and model_catalogue):
//   providers   [{id, label}]  configured providers; heldDefault the saved chat default (absent: the configured order);
//               effectiveDefault {provider, rule: owner-choice | pi-row | first-configured}.
//   harnesses   [{client, harness, installed, detection, reason?, capability, effect?, folder?, gap?}]  one per harness client:
//               detected or why not, the owner's own effect words, the configuration folder, an adapter gap's missing contract.
//   routes      [{model, name, routes: [{provider, key, standing?}]}]  the catalogue's declared routes (model_catalogue
//               declared_routes: provider, credential_required as key); standing (unproven | observed | usable) is AIKit's model
//               field (`aikit model-catalogue show`), which model_catalogue does not carry yet.
// Credentials:
//   credentials [{credential, provider, reference?, revoked, verifiedAt?, verdict?}]  AIKit's binding metadata (credential_list:
//               credential_ref, provider_ref, declared_secret_ref, revoked, last verification; credential_verify's verdict working |
//               refused | unreachable). No material enters these values.
//   found       number  candidate keys credential_discover finds on this machine (presence only).
//   secretRefs  [{ref, scheme, usedBy: [ref]}]  Workcell's recorded references (`workcell system --json` keys.references:
//               workcell.secret-reference-inventory/v1 credential_ref, scheme, observed_in).
//   projections [{name, to, credential, purpose?, scope?, by?}]  Workcell's projection ledger (`workcell secret projections`).
//   outside     number  credentials `workcell secret scan` finds outside a secret store (location and presence only).
// Profiles:     profiles [{ref, title, active, settings: [{ref, title, secret?}]}]  O:I's named profiles (profile_list, profile_read).
// Machines:     machines [{label, endpoint, credential?, expects: [op], note?}]  Workcell's declarations (`workcell machine list`);
//               connections [{label, state, protocol?, remote?, granted: [op], reconciled?, detail?}]  its receipts (`workcell
//               connections list`: connected | disconnected | refused | incompatible).
// Automations (AIKit, kernel op `routine`): routines [{ref, name, state, when?, next?, method, revision?, verified?, unattended?}];
//               methods [{method, revision, runs}]; timers [{name, provider, when?}]; history [{at, routine, outcome, delivery?}];
//               options {proofs, triggers, authorities, profiles: [{ref, title}]} for a new routine (RoutineAuthoringSource.options);
//               contexts [{ref, title}] the work contexts routines are read in: this AIKit home, or a project (the routine op's
//               `project`); `context` is the chosen one.
// Appearance:   theme {saved, observed?} (presentation_read, presentation_observe: light | dark | system, or a library theme's id);
//               themes [{id, name}] the library; imported [{id, name}]; visualLayer, welcome (the renderer's retained store).
// Products:     products [{id, version?, state, reason?, actions: [{ref, title, runnable, why?}], observed?, digest?,
//               degraded: [{subject, state, reason}], obligations: [text]}] (system_composition_read); ran {product, title, ok, rows?}.
// System:       system [{id, version?, digest?, observed?, contract?, settings: [{section, key, title, mutable, path?, drift: {state,
//               between?}, declared?, effective?, active?, staged?}]}]  each owner's System settings disclosure
//               (oi.product-settings-disclosure/v2 through system_composition_read; `ctrl system --json` for Central).
//
// Settings the shell holds: search, scope, focus (the setting a contextual entry or a press opened), show (Automations: routines |
//   methods | timers | history), context (Automations' work context), routine, product, owner (System's owner), axes ('disclosure' | 'configuration'), adding (the open
//   form: machine | credential | routine | profile), rotating (the credential whose reference you replace), new.* (the open form's
//   fields), chatDefault (a provider chosen, not yet applied), themeDraft, and a local change for each setting as draft:<ref> (a JSON
//   string for a list or a table).
// Acts, each on its own key, with their owners:
//   plan (config_plan_reviewed) · apply (config_apply_reviewed) · reset <ref> (config_reset) · keep <ref> (re-bases a draft on the
//   current reading) · discard (drops every local change) · applyDefault, restoreDefault (HarnessSource) · install <client>
//   (client_install) · reveal <client> (settings_reveal) · signIn <client> (the conversation's connection control,
//   harness_auth_describe) · discover (credential_discover) · verify <credential> (credential_verify) · rotate <credential> with
//   new.reference (credential_rotate) · revoke <credential> (credential_revoke) · setup with new.credential, new.reference
//   (credential_setup) · useProfile <ref> (profile_use_plan: stages its settings as local changes) · saveProfile with new.name
//   (profile_create, profile_edit) · importProfile (the shell's file picker, then the same) · runNow <ref>, disableRoutine <ref>
//   (kernel `routine`) · applyTheme (theme_apply) · revertTheme (theme_revert) · removeTheme <id> (theme_remove) · importTheme (file
//   picker, then theme_import) · run <product>:<action> (product_action_run) · reread (system_composition_read): all exist.
//   enterKey <credential>: a write-only key goes to the native host's own secure field, never through these values; it stands
//   disabled until the host qualifies its credential capability (SettingsAdapter.canEnterCredentialMaterial).
//   scan (`workcell secret scan`) · revokeProjection <name> (`workcell secret revoke-projection`): no kernel route.
//   addMachine with new.label, new.endpoint, new.credential, new.note (`workcell machine add`) · connect <label> (`workcell connect
//   --connection`) · disconnect <label> (`workcell connections disconnect`) · removeMachine <label> (`workcell machine remove`):
//   RemoteMachinesSource has no native binding and the kernel no route.
//   enableRoutine <ref>, reprove <ref>, createRoutine (new.name, new.method, new.proof, new.trigger, new.authority, new.profile):
//   RoutineAuthoringSource, no native binding yet.
//   The host stands each act without an owner disabled, with that reason.
// A key the owner has not reported is absent: its cell draws "—", and the page names the missing reading.
import {useState, type ReactNode} from 'react'
import {Action, Chooser, Lamp, Radio, Readout, TextField, Toggle, type LightState, type Option, type Tone} from '../../sdk/panel'
import {NONE, boolOf, has, json, numOf, st, strOf, type DesignedDevice, type Value, type ViewProps} from './design'
import './settings__window.css'

type V = ViewProps['v']
type Rec = Record<string, unknown>
const rec = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x)
const txt = (x: unknown): string | undefined => (typeof x === 'string' && x !== '' ? x : undefined)
const list = (v: V, key: string): Rec[] | undefined => (has(v, key) ? json<unknown[]>(v, key, []).filter(rec) : undefined)
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])

// ---------------------------------------------------------------- the pages

/** The pages, in the window's order, each with the category the shell files settings under (settings/model.ts categories). A page
 * marked `contributed` shows only when an owner contributes a setting to it, as in the shell. */
const PAGES = [
  {id: 'harnesses', label: 'Harnesses & models', category: 'agents', group: 'Preferences'},
  {id: 'skills', label: 'Skills & methods', category: 'skills', group: 'Preferences', contributed: true},
  {id: 'profiles', label: 'Profiles', category: 'profiles', group: 'Preferences'},
  {id: 'permissions', label: 'Permissions', category: 'permissions', group: 'Preferences', contributed: true},
  {id: 'credentials', label: 'Credentials', category: 'connections', group: 'Preferences'},
  {id: 'machines', label: 'Machines & services', category: 'execution', group: 'Preferences'},
  {id: 'automations', label: 'Automations', category: 'automations', group: 'Preferences'},
  {id: 'telemetry', label: 'Search & telemetry', category: 'telemetry', group: 'Preferences', contributed: true},
  {id: 'library', label: 'Sources & libraries', category: 'library', group: 'Preferences', contributed: true},
  {id: 'appearance', label: 'Appearance', category: 'appearance', group: 'Preferences'},
  {id: 'products', label: 'Products & updates', category: 'products', group: 'System'},
  {id: 'system', label: 'System', category: 'inspection', group: 'System'},
] as const
type PageId = typeof PAGES[number]['id'] | 'review'
const pageOf = (p: ViewProps): PageId => (p.page === 'review' || PAGES.some(x => x.id === p.page) ? p.page as PageId : 'harnesses')
const pageOfCategory = (c: string): PageId => PAGES.find(x => x.category === c)?.id ?? 'system'

const OWNER: Readonly<Record<string, string>> = {'ai-kit': 'AIKit', 'software-factory': 'Factory', central: 'Central', oi: 'O:I', 'quaternal-logic': 'Quaternal Logic',
  workcell: 'Workcell', actuation: 'Actuation'}
const ownerWord = (o: string | undefined) => (o ? OWNER[o] ?? o : NONE)
const TIMING: Readonly<Record<string, string>> = {'value-change': 'next resolution', 'restart-required': 'restart', 'session-restart-required': 'new sessions',
  'provider-reconnect-required': 'reconnect', 'material-effect': 'material change', none: 'read only', pending: 'pending', unknown: NONE}

// ---------------------------------------------------------------- the owners' settings, as rows

interface Column {readonly name: string; readonly type: string; readonly choices?: readonly string[]}
interface Setting {
  readonly ref: string; readonly category: string; readonly owner?: string; readonly section?: string; readonly title: string; readonly kind: string
  readonly options?: readonly string[]; readonly columns?: readonly Column[]; readonly rows?: readonly Rec[]; readonly effective?: Value
  readonly from?: string; readonly timing?: string; readonly writable: boolean; readonly range?: string
}
function settingsOf(v: V): Setting[] | undefined {
  const raw = list(v, 'settings')
  return raw?.flatMap(s => (txt(s.ref) && txt(s.title) ? [{
    ref: s.ref as string, category: txt(s.category) ?? 'inspection', owner: txt(s.owner), section: txt(s.section), title: s.title as string, kind: txt(s.kind) ?? 'text',
    options: strs(s.options), columns: Array.isArray(s.columns) ? s.columns.filter(rec).flatMap(c => (txt(c.name) ? [{name: c.name as string, type: txt(c.type) ?? 'text', choices: strs(c.choices)}] : [])) : undefined,
    rows: Array.isArray(s.rows) ? s.rows.filter(rec) : undefined,
    effective: typeof s.effective === 'string' || typeof s.effective === 'number' || typeof s.effective === 'boolean' ? s.effective : undefined,
    from: txt(s.from), timing: txt(s.timing), writable: s.writable === true, range: txt(s.range)}] : []))
}
const draftKey = (ref: string) => `draft:${ref}`
const draftsOf = (v: V) => Object.keys(v).filter(k => k.startsWith('draft:') && has(v, k))
const conflictsOf = (v: V) => strs(json<unknown>(v, 'conflicts', []))
/** The rows a table or list setting holds: your local change where you made one, else the owner's. */
function rowsOf(v: V, s: Setting): Rec[] {
  const d = v[draftKey(s.ref)]
  if (typeof d === 'string') { const parsed = json<unknown>({x: d}, 'x', null); if (Array.isArray(parsed)) return parsed.map(r => (rec(r) ? r : {item: r})) }
  return [...(s.rows ?? [])]
}

/** The widths of a table's columns (px; undefined takes what is left): a table keeps to the page's width. */
const Cols = ({w}: {w: readonly (number | undefined)[]}) => <colgroup>{w.map((x, i) => <col key={i} style={x === undefined ? undefined : {width: x}} />)}</colgroup>

/** A page of a long list, with ‹ › to turn it: nothing in the window scrolls. */
function usePaged<T>(items: readonly T[], size: number): [readonly T[], ReactNode] {
  const [at, setAt] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / size)), page = Math.min(at, pages - 1)
  const pager = pages > 1 ? <span className="st-pager" data-i={`Pages|${items.length} in all. ‹ and › turn the page.`}>
    <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setAt(page - 1)}>‹</button>{page + 1} / {pages}
    <button type="button" aria-label="Next page" disabled={page === pages - 1} onClick={() => setAt(page + 1)}>›</button></span> : null
  return [items.slice(page * size, page * size + size), pager]
}

/** The control a setting's value takes, by its kind, holding your local change where you made one. */
function ValueCell({p, s}: {p: ViewProps; s: Setting}) {
  const key = draftKey(s.ref), d = p.v[key], open = strOf(p.v, 'focus') === s.ref
  const now = d ?? s.effective
  const edit = s.writable ? (x: Value) => p.set(key, x) : undefined
  if (s.kind === 'secret') return <button type="button" className="st-link st-ref" data-i={`${s.title}|A secret shows its reference only; its material stays with the credential owner. Press to open Credentials.`}
    onClick={() => { p.setPage('credentials'); p.set('focus', s.ref) }}>{s.effective === undefined ? NONE : String(s.effective)}</button>
  if (s.kind === 'table' || s.kind === 'list') {
    const n = has(p.v, key) || s.rows ? rowsOf(p.v, s).length : undefined
    return <button type="button" className="st-link" aria-expanded={open} data-i={`${s.title}|${s.writable ? 'Opens its entries under the row.' : 'Shows its entries under the row.'}`}
      onClick={() => p.set('focus', open ? undefined : s.ref)}>{n === undefined ? NONE : `${n} ${n === 1 ? 'entry' : 'entries'}`} {open ? '▾' : '▸'}</button>
  }
  if (!s.writable) return <span className="st-plain">{now === undefined ? NONE : String(now)}</span>
  if (s.kind === 'toggle') return <Toggle {...st(p, key)} label={now === true ? 'On' : 'Off'} does={s.title} on={now === true} unknown={now === undefined} onChange={edit} />
  if (s.kind === 'choice') return <Chooser {...st(p, key)} does={s.title} value={now === undefined ? '' : String(now)} options={(s.options ?? []).map(o => ({value: o, label: o}))} onChange={edit} />
  return <span className="st-field">
    <TextField {...st(p, key)} does={`${s.title}${s.range ? `: ${s.range}` : ''}.`} value={now === undefined ? '' : String(now)} placeholder={now === undefined ? NONE : undefined}
      onChange={x => edit?.(s.kind === 'number' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : x)} />
    {s.kind === 'path' && <Action {...st(p, `pick:${s.ref}`)} label="Choose…" does="Choose a file or folder with the system's own picker." onPress={() => p.set(`pick:${s.ref}`, true)} />}
  </span>
}

/** A table or list setting's entries, under its row: each column a control, × to take an entry out, + to add one. */
function Entries({p, s}: {p: ViewProps; s: Setting}) {
  const rows = rowsOf(p.v, s), cols = s.columns?.length ? s.columns : [{name: 'item', type: 'text'}]
  const write = (next: Rec[]) => p.set(draftKey(s.ref), JSON.stringify(s.columns?.length ? next : next.map(r => r.item)))
  const cell = (r: Rec, i: number, c: Column) => {
    const at = r[c.name], set = (x: unknown) => write(rows.map((row, j) => (j === i ? {...row, [c.name]: x} : row)))
    if (!s.writable) return <span className="st-plain">{at === undefined ? NONE : typeof at === 'object' ? JSON.stringify(at) : String(at)}</span>
    if (c.type === 'boolean') return <Toggle label={at === true ? 'On' : 'Off'} on={at === true} onChange={set} />
    if (c.choices?.length) return <Chooser does={c.name} value={String(at ?? '')} options={c.choices.map(o => ({value: o, label: o}))} onChange={set} />
    return <TextField does={c.name} value={at === undefined ? '' : String(at)} onChange={set} />
  }
  const grid = {gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr)) 18px`}
  return <tr className="st-sub"><td /><td colSpan={4}>
    <div className="st-entries" style={grid}>
      {cols.map(c => <span key={c.name} className="st-entries-head">{c.name}</span>)}<span />
      {rows.map((r, i) => [...cols.map(c => <span key={`${i}:${c.name}`}>{cell(r, i, c)}</span>),
        <span key={`${i}:x`}>{s.writable && <button type="button" className="st-x" aria-label={`Take out entry ${i + 1}`} data-i="Take out|Takes this entry out of your local change."
          onClick={() => write(rows.filter((_, j) => j !== i))}>×</button>}</span>])}
    </div>
    {!rows.length && <span className="st-none">No entries at this scope.</span>}
    {s.writable && <button type="button" className="st-link" onClick={() => write([...rows, Object.fromEntries(cols.map(c => [c.name, c.type === 'boolean' ? true : '']))])}>+ Add entry</button>}
  </td></tr>
}

/** The owners' settings filed under a category: the setting and its owner, its value, where the value comes from, when a change
 * applies, and Reset where this scope overrides it. Writable first; the read-only beneath them. */
function OwnerRows({p, category, size, title, children}: {p: ViewProps; category: string; size: number; title?: string; children?: ReactNode}) {
  const all = settingsOf(p.v), mine = (all ?? []).filter(s => s.category === category).sort((a, b) => Number(b.writable) - Number(a.writable))
  const conflicts = conflictsOf(p.v), focus = strOf(p.v, 'focus')
  const [shown, pager] = usePaged(mine, size)
  if (all !== undefined && !mine.length && !children) return null
  return <section className="st-sec">
    <h4>{title ?? 'Owner settings'}<small>{all === undefined ? 'no reading of the owners\' settings' : `${mine.length} at ${scopeWord(p.v)}`}</small>{pager}</h4>
    {children}
    {all === undefined || !mine.length ? null : <table className="st-tbl">
      <Cols w={[undefined, 190, 70, 96, 64]} />
      <thead><tr><th>Setting</th><th>Value</th><th>From</th><th>Applies</th><th /></tr></thead>
      <tbody>{shown.map(s => {
        const draft = has(p.v, draftKey(s.ref)), conflict = conflicts.includes(s.ref)
        return [<tr key={s.ref} data-draft={draft ? 'true' : undefined} data-focus={focus === s.ref ? 'true' : undefined} data-read={s.writable ? undefined : 'true'}>
          <td><b>{s.title}</b><small>{ownerWord(s.owner)}{s.section ? ` · ${s.section}` : ''}</small></td>
          <td><ValueCell p={p} s={s} /></td>
          <td data-i={`From|${s.from === 'here' ? 'This scope overrides the value.' : s.from === 'inherited' ? 'The owner resolves it from a wider scope or its default.' : 'Not read yet.'}`}>
            {s.from === 'here' ? 'this scope' : s.from === 'inherited' ? 'inherited' : NONE}</td>
          <td>{TIMING[s.timing ?? 'unknown'] ?? s.timing}</td>
          <td className="st-acts">
            {conflict && <Action {...st(p, 'keep')} label="Keep" does="The owner's reading changed since your change. Keep your change on the current reading." onPress={() => p.set('keep', s.ref)} />}
            {s.from === 'here' && s.writable && <Action {...st(p, 'reset')} hold label="Reset" does="The owner removes this scope's override and resolves the value again." onPress={() => p.set('reset', s.ref)} />}
          </td>
        </tr>, focus === s.ref && (s.kind === 'table' || s.kind === 'list') ? <Entries key={`${s.ref}:rows`} p={p} s={s} /> : null]
      })}</tbody>
    </table>}
  </section>
}

const scopeWord = (v: V) => { const s = json<Rec | null>(v, 'scope', null); return s ? (txt(s.title) ?? (txt(s.ref) ? `${s.kind} · ${s.ref}` : txt(s.kind) ?? NONE)) : NONE }
function ScopeBar({p}: {p: ViewProps}) {
  const scopes = list(p.v, 'scopes') ?? [], now = json<Rec | null>(p.v, 'scope', null)
  const opt = (s: Rec) => `${txt(s.kind) ?? ''}|${txt(s.ref) ?? ''}`
  return <Chooser {...st(p, 'scope')} label="Applies to" does="The scope the settings below are read and changed at: this machine, a world, a project or a workcell."
    value={now ? opt(now) : ''} options={scopes.map(s => ({value: opt(s), label: txt(s.title) ?? opt(s)}))}
    onChange={x => { const s = scopes.find(c => opt(c) === x); if (s) p.set('scope', JSON.stringify(s)) }} />
}

// ---------------------------------------------------------------- Harnesses & models

const RULE: Readonly<Record<string, string>> = {'owner-choice': 'your saved choice', 'pi-row': 'the pi provider row', 'first-configured': 'the first configured provider'}
function HarnessesPage({p}: {p: ViewProps}) {
  const v = p.v, providers = list(v, 'providers'), harnesses = list(v, 'harnesses'), routes = list(v, 'routes')
  const eff = json<Rec | null>(v, 'effectiveDefault', null), held = strOf(v, 'heldDefault'), chosen = strOf(v, 'chatDefault')
  const label = (id: string | undefined) => (id ? txt(providers?.find(r => r.id === id)?.label) ?? id : undefined)
  const [shownRoutes, pager] = usePaged(routes ?? [], 2), routesOpen = strOf(v, 'focus') === 'routes'
  return <>
    <OwnerRows p={p} category="agents" size={2} title="New conversations">
      <div className="st-line">
        <Chooser {...st(p, 'chatDefault')} label="Default provider" does="The provider a new chat starts with. A conversation keeps its own once it starts."
          value={chosen ?? held ?? ''} options={[{value: '', label: 'Configured order'}, ...(providers ?? []).flatMap(r => (txt(r.id) ? [{value: r.id as string, label: txt(r.label) ?? r.id as string}] : []))]}
          onChange={x => p.set('chatDefault', x)} />
        <Readout label="in effect" does="The provider new chats use now, and the rule that chose it." value={eff ? `${label(txt(eff.provider)) ?? NONE} · ${RULE[txt(eff.rule) ?? ''] ?? NONE}` : undefined} />
        {chosen !== undefined && <>
          <Action {...st(p, 'applyDefault')} label="Apply" does="Saves the provider you chose as the default for new chats." onPress={() => p.set('applyDefault', chosen)} />
          <Action label="Undo" does="Drops the provider you chose; nothing was saved." onPress={() => p.set('chatDefault', undefined)} />
        </>}
        {held !== undefined && chosen === undefined && <Action {...st(p, 'restoreDefault')} label="Configured order" does="Removes your saved choice: new chats follow the configured order again." onPress={() => p.set('restoreDefault', true)} />}
      </div>
    </OwnerRows>
    <section className="st-sec">
      <h4>Harnesses<small>{harnesses ? `${harnesses.filter(h => h.installed === true).length} of ${harnesses.length} installed` : 'no reading of the harnesses'}</small></h4>
      {harnesses && <table className="st-tbl">
        <Cols w={[118, 50, 128, 64, undefined, 150]} />
        <thead><tr><th>Harness</th><th>Installed</th><th>Detected</th><th>Capability</th><th>After a change</th><th /></tr></thead>
        <tbody>{harnesses.map(h => {
          const client = txt(h.client) ?? '', gap = rec(h.gap) ? h.gap : undefined
          return <tr key={client} data-read={h.installed === true ? undefined : 'true'}>
            <td><b>{txt(h.harness) ?? client}</b>{gap && <i className="st-why" data-i={`Adapter gap|${txt(gap.contract) ?? 'A contract is missing.'}${txt(gap.skill) ? ` Its authoring skill: ${gap.skill}.` : ''}`}>!</i>}</td>
            <td>{h.installed === true ? 'yes' : h.installed === false ? 'no' : NONE}</td>
            <td data-i={txt(h.reason) ? `Detection|${h.reason}` : undefined}>{h.detection === 'detected' ? 'yes' : txt(h.reason) ?? txt(h.detection) ?? NONE}</td>
            <td>{txt(h.capability) ?? NONE}</td>
            <td className="st-dim" data-i={txt(h.effect) ? `After a change|${h.effect}` : undefined}>{txt(h.effect) ?? NONE}</td>
            <td className="st-acts">
              {h.installed === false && <Action {...st(p, 'install')} label="Install" does="The native owner installs this harness client. Read detection again before you start work." onPress={() => p.set('install', client)} />}
              {txt(h.folder) && <Action {...st(p, 'reveal')} label="Folder" does={`Shows its configuration folder in Finder: ${h.folder}.`} onPress={() => p.set('reveal', client)} />}
              <Action {...st(p, 'signIn')} label="Sign in…" does="Opens this harness's connection beside the conversation, where you sign in and verify it." onPress={() => p.set('signIn', client)} />
            </td>
          </tr>
        })}</tbody>
      </table>}
    </section>
    <section className="st-sec">
      <h4><button type="button" className="st-link st-open" aria-expanded={routesOpen} onClick={() => p.set('focus', routesOpen ? undefined : 'routes')}>Model routes {routesOpen ? '▾' : '▸'}</button>
        <small>{routes ? `${routes.length} models in the catalogue` : 'no reading of the catalogue'}</small>{routesOpen && pager}</h4>
      {routes && routesOpen && <table className="st-tbl">
        <Cols w={[200, undefined, 150]} />
        <thead><tr><th>Model</th><th>Routes</th><th>Standing</th></tr></thead>
        <tbody>{shownRoutes.map(m => {
          const rs = Array.isArray(m.routes) ? m.routes.filter(rec) : []
          return <tr key={txt(m.model) ?? ''}>
            <td data-i={`${txt(m.name) ?? NONE}|${txt(m.model) ?? ''}`}><b>{txt(m.name) ?? txt(m.model) ?? NONE}</b></td>
            <td>{rs.length ? rs.map(r => `${txt(r.provider) ?? NONE}${r.key === true ? ' · key' : ''}`).join(', ') : NONE}</td>
            <td data-i="Standing|Each route's standing in AIKit's model field: unproven, observed or usable.">{rs.some(r => txt(r.standing)) ? rs.map(r => txt(r.standing) ?? NONE).join(', ') : NONE}</td>
          </tr>
        })}</tbody>
      </table>}
    </section>
  </>
}

// ---------------------------------------------------------------- Credentials

const VERDICT: Readonly<Record<string, Tone>> = {working: 'green', refused: 'stall', unreachable: 'stall'}
function CredentialsPage({p}: {p: ViewProps}) {
  const v = p.v, creds = list(v, 'credentials'), refs = list(v, 'secretRefs'), projections = list(v, 'projections')
  const adding = strOf(v, 'adding') === 'credential', rotating = strOf(v, 'rotating'), found = numOf(v, 'found')
  return <>
    <section className="st-sec">
      <h4>Provider connections<small>AIKit · {creds ? `${creds.length} bound` : 'no reading of the bindings'}</small>
        <span className="st-head-acts">
          <Action {...st(p, 'discover')} label="Discover" does="Looks for keys already on this machine, reporting where they are and never what they hold. Discovery changes nothing." onPress={() => p.set('discover', true)} />
          <Readout label="found" does="Keys discovery found on this machine." value={found} />
          <Action label="Add binding…" does="Binds a provider to a stored secret reference." onPress={() => p.set('adding', adding ? undefined : 'credential')} />
        </span></h4>
      {creds && <table className="st-tbl">
        <Cols w={[80, undefined, 46, 104, 176]} />
        <thead><tr><th>Provider</th><th>Reference</th><th>State</th><th>Verified</th><th /></tr></thead>
        <tbody>{creds.flatMap(c => {
          const id = txt(c.credential) ?? '', verdict = txt(c.verdict)
          const row = <tr key={id} data-read={c.revoked === true ? 'true' : undefined} data-focus={strOf(v, 'focus') === id ? 'true' : undefined}>
            <td data-i={`${txt(c.provider) ?? id}|The binding ${id}.`}><b>{txt(c.provider) ?? id}</b></td>
            <td className="st-ref">{txt(c.reference) ?? NONE}</td>
            <td>{c.revoked === true ? 'revoked' : c.revoked === false ? 'bound' : NONE}</td>
            <td><span data-st={verdict ? VERDICT[verdict] : undefined}>{verdict ?? NONE}</span>{txt(c.verifiedAt) ? <small>{c.verifiedAt as string}</small> : null}</td>
            <td className="st-acts">
              <Action {...st(p, 'verify')} label="Verify" does="One live check against the provider with the bound key. The verdict: working, refused or unreachable." onPress={() => p.set('verify', id)} />
              <Action label="Rotate…" does="Replaces the key's reference or material. The binding keeps its name." onPress={() => p.set('rotating', rotating === id ? undefined : id)} />
              <Action {...st(p, 'revoke')} hold label="Revoke" does="Marks the binding revoked, so nothing resolves or dispatches through it. The stored secret is kept." onPress={() => p.set('revoke', id)} />
            </td>
          </tr>
          return rotating === id ? [row, <tr key={`${id}:rotate`} className="st-sub"><td colSpan={5}><div className="st-form">
            <TextField label="New reference" does="A keychain:// or secret-service:// reference. Never the key itself." value={strOf(v, 'new.reference') ?? ''} placeholder="keychain://…" onChange={x => p.set('new.reference', x)} />
            <Action {...st(p, 'rotate')} label="Send" does="Sends the new reference to the credential owner." onPress={() => p.set('rotate', id)} />
            <Action {...st(p, 'enterKey')} label="Enter key…" does="Opens the native host's own secure field for a new key. The key goes to the credential owner and never through the window." onPress={() => p.set('enterKey', id)} />
            <Action label="Cancel" does="Keeps the binding as it is." onPress={() => p.set('rotating', undefined)} />
          </div></td></tr>] : [row]
        })}
        {adding && <tr className="st-sub"><td colSpan={5}><div className="st-form">
          <TextField label="Binding" does="The native credential identity to bind." value={strOf(v, 'new.credential') ?? ''} placeholder="ai-kit:credential:…" onChange={x => p.set('new.credential', x)} />
          <TextField label="Reference" does="A stored secret reference. Never the key itself." value={strOf(v, 'new.reference') ?? ''} placeholder="keychain://…" onChange={x => p.set('new.reference', x)} />
          <Action {...st(p, 'setup')} label="Bind" does="Sends the binding to the credential owner. Providers may need to reconnect." onPress={() => p.set('setup', strOf(v, 'new.credential') ?? true)} />
          <Action label="Cancel" does="Binds nothing." onPress={() => p.set('adding', undefined)} />
        </div></td></tr>}
        </tbody>
      </table>}
    </section>
    <section className="st-sec">
      <h4>Workcell secrets<small>references and projections only</small>
        <span className="st-head-acts">
          <Action {...st(p, 'scan')} label="Scan" does="Finds credential material outside a secret store (environment, shell files, known auth files), reporting where it is, never what it holds." onPress={() => p.set('scan', true)} />
          <Readout label="outside a store" does="Credentials the last scan found outside a secret store." value={numOf(v, 'outside')} tone={(numOf(v, 'outside') ?? 0) > 0 ? 'stall' : undefined} />
        </span></h4>
      <div className="st-cols">
        <table className="st-tbl">
          <Cols w={[undefined, 112]} />
          <thead><tr><th>Reference</th><th>Used by</th></tr></thead>
          <tbody>{refs === undefined ? <tr><td colSpan={2} className="st-none">No reading of the references.</td></tr>
            : refs.length === 0 ? <tr><td colSpan={2} className="st-none">No reference is recorded.</td></tr>
            : refs.map(r => <tr key={txt(r.ref) ?? ''}><td className="st-ref" data-i={`Reference|${txt(r.ref) ?? NONE}, in ${txt(r.scheme) ?? 'its store'}.`}>{txt(r.ref) ?? NONE}</td>
              <td className="st-dim" data-i={`Used by|${strs(r.usedBy).join(', ') || NONE}`}>{strs(r.usedBy).join(', ') || NONE}</td></tr>)}</tbody>
        </table>
        <table className="st-tbl">
          <Cols w={[undefined, 64, 70, 60]} />
          <thead><tr><th>Projection</th><th>To</th><th>Purpose</th><th /></tr></thead>
          <tbody>{projections === undefined ? <tr><td colSpan={4} className="st-none">No reading of the projections.</td></tr>
            : projections.length === 0 ? <tr><td colSpan={4} className="st-none">Nothing is projected.</td></tr>
            : projections.map(r => <tr key={txt(r.name) ?? ''}>
              <td data-i={`${txt(r.name) ?? NONE}|Projects ${txt(r.credential) ?? NONE}${txt(r.scope) ? `, scope ${r.scope}` : ''}${txt(r.by) ? `, recorded by ${r.by}` : ''}.`}><b>{txt(r.name) ?? NONE}</b></td><td>{txt(r.to) ?? NONE}</td><td className="st-dim">{txt(r.purpose) ?? NONE}</td>
              <td className="st-acts"><Action {...st(p, 'revokeProjection')} hold label="Revoke" does="Revokes the projection at its origin. The target loses it at its next use." onPress={() => p.set('revokeProjection', txt(r.name) ?? true)} /></td>
            </tr>)}</tbody>
        </table>
      </div>
    </section>
    <OwnerRows p={p} category="connections" size={2} title="Credential settings" />
  </>
}

// ---------------------------------------------------------------- Profiles

function ProfilesPage({p}: {p: ViewProps}) {
  const v = p.v, profiles = list(v, 'profiles'), naming = strOf(v, 'adding') === 'profile', drafts = draftsOf(v).length
  return <>
    <section className="st-sec">
      <h4>Named profiles<small>O:I · a named set of settings; Use stages them as local changes</small>
        <span className="st-head-acts">
          <Action label="New from changes…" does="Saves your valid local changes as a named profile." onPress={() => p.set('adding', naming ? undefined : 'profile')} disabled={drafts ? undefined : 'You have no local changes to save.'} />
          <Action {...st(p, 'importProfile')} label="Import…" does="Imports an O:I profile file (oi.profile/v1, under 1 MiB)." onPress={() => p.set('importProfile', true)} />
        </span></h4>
      <table className="st-tbl">
        <Cols w={[170, undefined, 60]} />
        <thead><tr><th>Profile</th><th>Settings</th><th /></tr></thead>
        <tbody>
          {profiles === undefined ? <tr><td colSpan={3} className="st-none">No reading of the profiles.</td></tr>
            : profiles.length === 0 ? <tr><td colSpan={3} className="st-none">No profile is saved.</td></tr>
            : profiles.map(r => {
              const set = Array.isArray(r.settings) ? r.settings.filter(rec) : []
              return <tr key={txt(r.ref) ?? ''} data-focus={r.active === true ? 'true' : undefined}>
                <td><b>{txt(r.title) ?? txt(r.ref) ?? NONE}</b><small>{r.active === true ? 'active' : txt(r.ref) ?? ''}</small></td>
                <td className="st-dim">{set.length ? `${set.length}: ${set.slice(0, 3).map(s => `${txt(s.title) ?? txt(s.ref)}${s.secret === true ? ' (reference)' : ''}`).join(', ')}${set.length > 3 ? '…' : ''}` : NONE}</td>
                <td className="st-acts"><Action {...st(p, 'useProfile')} label="Use…" does="Stages the profile's settings as local changes. Review them before you apply." onPress={() => p.set('useProfile', txt(r.ref) ?? true)} /></td>
              </tr>
            })}
          {naming && <tr className="st-sub"><td colSpan={3}><div className="st-form">
            <TextField label="Name" does="The profile's name." value={strOf(v, 'new.name') ?? ''} onChange={x => p.set('new.name', x)} />
            <Readout label="changes" does="The local changes the profile keeps." value={drafts} />
            <Action {...st(p, 'saveProfile')} label="Save profile" does="The profile owner keeps your valid local changes under this name." onPress={() => p.set('saveProfile', strOf(v, 'new.name') ?? true)} />
            <Action label="Cancel" does="Saves nothing." onPress={() => p.set('adding', undefined)} />
          </div></td></tr>}
        </tbody>
      </table>
    </section>
    <OwnerRows p={p} category="profiles" size={3} title="AIKit profile" />
  </>
}

// ---------------------------------------------------------------- Machines & services

const CONN_TONE: Readonly<Record<string, Tone>> = {connected: 'green', refused: 'stall', incompatible: 'stall'}
function MachinesPage({p}: {p: ViewProps}) {
  const v = p.v, machines = list(v, 'machines'), conns = list(v, 'connections'), adding = strOf(v, 'adding') === 'machine'
  const connOf = (label: string) => conns?.find(c => c.label === label)
  const loose = (conns ?? []).filter(c => !machines?.some(m => m.label === c.label))
  return <>
    <section className="st-sec">
      <h4>Remote machines<small>Workcell · Connect uses the saved reference and grants nothing on the remote machine</small>
        <span className="st-head-acts"><Action label="Add machine…" does="Declares a machine this workcell can carry work to." onPress={() => p.set('adding', adding ? undefined : 'machine')} /></span></h4>
      <table className="st-tbl">
        <Cols w={[128, undefined, 50, 122, 206]} />
        <thead><tr><th>Machine</th><th>Credential</th><th>Expects</th><th>State</th><th /></tr></thead>
        <tbody>
          {machines === undefined ? <tr><td colSpan={5} className="st-none">No reading of the machines.</td></tr>
            : machines.length === 0 ? <tr><td colSpan={5} className="st-none">No remote machine is declared.</td></tr>
            : machines.map(m => {
              const label = txt(m.label) ?? '', c = connOf(label), state = txt(c?.state)
              return <tr key={label}>
                <td><b>{label}</b><small>{txt(m.endpoint) ?? NONE}</small></td>
                <td className="st-ref">{txt(m.credential) ?? NONE}</td>
                <td>{strs(m.expects).length || NONE}</td>
                <td data-i={`${state ?? 'Connection'}|${[txt(c?.detail), c ? `Granted: ${strs(c.granted).join(', ') || 'nothing'}.` : undefined, txt(c?.reconciled) ? `Reconciled ${c!.reconciled}.` : undefined].filter(Boolean).join(' ') || 'No connection receipt.'}`}>
                  <span data-st={state ? CONN_TONE[state] : undefined}>{state ?? (conns ? 'not connected' : NONE)}</span>{c ? <small>{strs(c.granted).length} granted</small> : null}</td>
                <td className="st-acts">
                  <Action {...st(p, 'connect')} label={state === 'connected' ? 'Reconnect' : 'Connect'} does="A fresh handshake with the machine, using the saved credential reference." onPress={() => p.set('connect', label)} />
                  {state === 'connected' && <Action {...st(p, 'disconnect')} hold label="Disconnect" does="Marks the connection disconnected. Its receipt is kept." onPress={() => p.set('disconnect', label)} />}
                  <Action {...st(p, 'removeMachine')} hold label="Remove" does="Removes this workcell's declaration. It revokes no remote grant and deletes no work." onPress={() => p.set('removeMachine', label)} />
                </td>
              </tr>
            })}
          {adding && <tr className="st-sub"><td colSpan={5}><div className="st-form">
            <TextField label="Label" does="Letters, digits, dots, hyphens or underscores. 'grants' is reserved." value={strOf(v, 'new.label') ?? ''} onChange={x => p.set('new.label', x)} />
            <TextField label="Endpoint" does="HOST:PORT. Brackets round an IPv6 host." value={strOf(v, 'new.endpoint') ?? ''} placeholder="host:7777" onChange={x => p.set('new.endpoint', x)} />
            <TextField label="Credential" does="A keychain:// or linux-secret-service:// reference. Never a token." value={strOf(v, 'new.credential') ?? ''} placeholder="keychain://…" onChange={x => p.set('new.credential', x)} />
            <TextField label="Note" does="Optional." value={strOf(v, 'new.note') ?? ''} onChange={x => p.set('new.note', x)} />
            <Action {...st(p, 'addMachine')} label="Save" does="Saves the declaration in this workcell. It contacts nothing." onPress={() => p.set('addMachine', strOf(v, 'new.label') ?? true)} />
            <Action label="Cancel" does="Declares nothing." onPress={() => p.set('adding', undefined)} />
          </div></td></tr>}
        </tbody>
      </table>
      {loose.length > 0 && <p className="st-note" data-i="Connections without a declaration|Receipts of connections this workcell holds with no machine declared for them.">Also connected, undeclared: {loose.map(c => `${txt(c.label) ?? NONE} (${txt(c.state) ?? NONE})`).join(', ')}</p>}
    </section>
    <OwnerRows p={p} category="execution" size={3} title="Services and local elections" />
  </>
}

// ---------------------------------------------------------------- Automations

const SHOW_AUTO: readonly Option<string>[] = [{value: 'routines', label: 'Routines', does: 'Your routines, each with its state and when it next runs.'},
  {value: 'methods', label: 'Methods', does: 'The Methods you can make a routine from: those with a verified run.'},
  {value: 'timers', label: 'Timers', does: 'Harness timers that stay with their provider until you adopt them with a proven Method.'},
  {value: 'history', label: 'History', does: 'Each invocation and its delivery.'}]
const ROUTINE_TONE: Readonly<Record<string, Tone>> = {enabled: 'green', disabled: 'stall'}
function AutomationsPage({p}: {p: ViewProps}) {
  const v = p.v, show = strOf(v, 'show') ?? 'routines', creating = strOf(v, 'adding') === 'routine'
  const routines = list(v, 'routines'), methods = list(v, 'methods'), timers = list(v, 'timers'), history = list(v, 'history')
  const chosen = routines?.find(r => r.ref === strOf(v, 'routine')), options = json<Rec | null>(v, 'options', null)
  const opts = (key: string, id: string) => (Array.isArray(options?.[key]) ? (options![key] as unknown[]).filter(rec).flatMap(o => (txt(o[id]) ? [{value: o[id] as string, label: txt(o.title) ?? o[id] as string}] : [])) : [])
  const [shown, pager] = usePaged(show === 'methods' ? methods ?? [] : show === 'timers' ? timers ?? [] : show === 'history' ? history ?? [] : routines ?? [], 6)
  const none = (what: string) => <tr><td colSpan={7} className="st-none">{what}</td></tr>
  return <>
    <section className="st-sec">
      <h4>Automations<small>AIKit · verified Methods that run on a schedule or an event; schedules keep Central's civil time</small>{pager}
        <span className="st-head-acts">
          <Action label="Create routine…" does="Makes a routine from a Method that has been run and verified. It starts as a Draft." onPress={() => p.set('adding', creating ? undefined : 'routine')} />
        </span></h4>
      <div className="st-line">
        <Chooser {...st(p, 'context')} label="Work context" does="The work context the routines are read and made in: this AIKit home, or a project. A routine you are making stays in its context."
          value={strOf(v, 'context') ?? ''} options={(list(v, 'contexts') ?? []).flatMap(c => (typeof c.ref === 'string' ? [{value: c.ref, label: txt(c.title) ?? c.ref}] : []))} onChange={x => p.set('context', x)} />
        <Radio {...st(p, 'show')} label="Show" does="What the page lists." value={show} options={SHOW_AUTO} onChange={x => p.set('show', x)} />
      </div>
      {creating && <div className="st-form st-form--grid">
        <TextField label="Name" does="The routine's name." value={strOf(v, 'new.name') ?? ''} onChange={x => p.set('new.name', x)} />
        <Chooser label="Method" does="A Method with a verified run in this work context." value={strOf(v, 'new.method') ?? ''} options={(methods ?? []).flatMap(m => (txt(m.method) ? [{value: m.method as string, label: `${m.method}${txt(m.revision) ? ` @${m.revision}` : ''}`}] : []))} onChange={x => p.set('new.method', x)} />
        <Chooser label="Verified run" does="The proof: a successful, verified run of that exact Method revision." value={strOf(v, 'new.proof') ?? ''} options={opts('proofs', 'ref')} onChange={x => p.set('new.proof', x)} />
        <Chooser label="When" does="A schedule Central's time policy admits, or an event its connector admits." value={strOf(v, 'new.trigger') ?? ''} options={opts('triggers', 'ref')} onChange={x => p.set('new.trigger', x)} />
        <Chooser label="Authority" does="The authority receipt it runs under. Unattended work needs an unattended grant." value={strOf(v, 'new.authority') ?? ''} options={opts('authorities', 'ref')} onChange={x => p.set('new.authority', x)} />
        <Chooser label="Agent profile" does="The AIKit profile it composes with, or none." value={strOf(v, 'new.profile') ?? ''} options={[{value: '', label: 'No override'}, ...opts('profiles', 'ref')]} onChange={x => p.set('new.profile', x)} />
        <Action {...st(p, 'createRoutine')} label="Create" does="AIKit checks the Method revision and its verification, and keeps the routine as a Draft. Enabling it is a separate act." onPress={() => p.set('createRoutine', strOf(v, 'new.name') ?? true)} />
        <Action label="Cancel" does="Creates nothing." onPress={() => p.set('adding', undefined)} />
      </div>}
      <table className="st-tbl">
        {show === 'methods' ? <>
          <Cols w={[undefined, 70, 90, 60]} /><thead><tr><th>Method</th><th>Revision</th><th>Verified runs</th><th /></tr></thead>
          <tbody>{methods === undefined ? none('No reading of the Methods.') : methods.length === 0 ? none('No Method has a verified run here.') : shown.map(m => <tr key={txt(m.method) ?? ''}>
            <td><b>{txt(m.method) ?? NONE}</b></td><td>{txt(m.revision) ?? NONE}</td><td>{typeof m.runs === 'number' ? m.runs : NONE}</td>
            <td className="st-acts"><Action label="Use…" does="Starts a routine from this Method." onPress={() => { p.set('adding', 'routine'); p.set('new.method', txt(m.method)) }} /></td></tr>)}</tbody>
        </> : show === 'timers' ? <>
          <Cols w={[undefined, 110, 110]} /><thead><tr><th>Timer</th><th>Provider</th><th>When</th></tr></thead>
          <tbody>{timers === undefined ? none('No reading of the harness timers.') : timers.length === 0 ? none('No harness timer was found.') : shown.map((t, i) => <tr key={i}>
            <td><b>{txt(t.name) ?? 'Unnamed timer'}</b></td><td>{txt(t.provider) ?? NONE}</td><td>{txt(t.when) ?? NONE}</td></tr>)}</tbody>
        </> : show === 'history' ? <>
          <Cols w={[90, undefined, 90, 130]} /><thead><tr><th>At</th><th>Routine</th><th>Outcome</th><th>Delivery</th></tr></thead>
          <tbody>{history === undefined ? none('No reading of the run history.') : history.length === 0 ? none('No invocation has been admitted.') : shown.map((h, i) => <tr key={i}>
            <td>{txt(h.at) ?? NONE}</td><td><b>{txt(h.routine) ?? NONE}</b></td><td>{txt(h.outcome) ?? NONE}</td><td className="st-dim">{txt(h.delivery) ?? NONE}</td></tr>)}</tbody>
        </> : <>
          <Cols w={[undefined, 62, 100, 70, 150, 70]} /><thead><tr><th>Routine</th><th>State</th><th>When</th><th>Next</th><th>Method</th><th>Unattended</th></tr></thead>
          <tbody>{routines === undefined ? none('No reading of the routines.') : routines.length === 0 ? none('No routine in this AIKit home.') : shown.map(r => {
            const ref = txt(r.ref) ?? '', state = txt(r.state)
            return <tr key={ref} data-focus={chosen?.ref === ref ? 'true' : undefined} className="st-pick" onClick={() => p.set('routine', ref)}>
              <td><b>{txt(r.name) ?? ref}</b></td><td><span data-st={state ? ROUTINE_TONE[state] : undefined}>{state ?? NONE}</span></td>
              <td>{txt(r.when) ?? NONE}</td><td>{txt(r.next) ?? NONE}</td>
              <td>{txt(r.method) ?? NONE}{txt(r.revision) ? <small>@{r.revision as string}{r.verified === false ? ' · reprove' : ''}</small> : null}</td>
              <td>{r.unattended === true ? 'yes' : r.unattended === false ? 'no' : NONE}</td>
            </tr>
          })}</tbody>
        </>}
      </table>
      {show === 'routines' && chosen && <div className="st-form">
        <b className="st-chosen">{txt(chosen.name) ?? NONE}</b>
        <Action {...st(p, 'enableRoutine')} label="Enable" does="Enables the routine under a current authority receipt." onPress={() => p.set('enableRoutine', txt(chosen.ref) ?? true)} disabled={txt(chosen.state) === 'enabled' ? 'It is enabled.' : undefined} />
        <Action {...st(p, 'runNow')} hold label="Run now" does="Runs the verified Method with its authority. It may take the actions its receipt names." onPress={() => p.set('runNow', txt(chosen.ref) ?? true)} disabled={txt(chosen.state) !== 'enabled' ? 'Only an enabled routine runs.' : undefined} />
        <Action {...st(p, 'disableRoutine')} hold label="Disable" does="Stops future runs. A run already dispatched goes on." onPress={() => p.set('disableRoutine', txt(chosen.ref) ?? true)} disabled={txt(chosen.state) === 'disabled' ? 'It is disabled.' : undefined} />
        <Action {...st(p, 'reprove')} label="Reprove" does="The Method changed: prove its current revision with a verified run, then enable the routine again." onPress={() => p.set('reprove', txt(chosen.ref) ?? true)} disabled={chosen.verified === false ? undefined : 'Its Method revision is verified.'} />
      </div>}
    </section>
  </>
}

// ---------------------------------------------------------------- Appearance

const THEMES: readonly Option<string>[] = [{value: 'light', label: 'Light'}, {value: 'dark', label: 'Dark'}, {value: 'system', label: 'Follow system'}]
function AppearancePage({p}: {p: ViewProps}) {
  const v = p.v, theme = json<Rec | null>(v, 'theme', null), draft = strOf(v, 'themeDraft'), library = list(v, 'themes'), imported = list(v, 'imported')
  const saved = txt(theme?.saved), now = draft ?? saved ?? ''
  const name = (id: string | undefined) => (id ? THEMES.find(t => t.value === id)?.label ?? txt(library?.find(t => t.id === id)?.name) ?? txt(imported?.find(t => t.id === id)?.name) ?? id : undefined)
  const toggle = (key: string, label: string, does: string) => { const on = boolOf(v, key); return <Toggle {...st(p, key)} label={label} does={does} on={on === true} unknown={on === undefined} onChange={x => p.set(key, x)} /> }
  return <>
    <section className="st-sec">
      <h4>Theme<small>O:I presentation · scene, glyph, material and musical controls stay in their editors</small></h4>
      <div className="st-line">
        <Radio {...st(p, 'themeDraft')} label="Appearance" does="Light, Dark, or the system's." value={THEMES.some(t => t.value === now) ? now : ''} options={THEMES} onChange={x => p.set('themeDraft', x)} />
        <Chooser {...st(p, 'themeDraft')} label="Library theme" does="A theme from the library, or one you imported." value={THEMES.some(t => t.value === now) ? '' : now}
          options={[...(library ?? []), ...(imported ?? [])].flatMap(t => (txt(t.id) ? [{value: t.id as string, label: txt(t.name) ?? t.id as string}] : []))} onChange={x => p.set('themeDraft', x)} />
        <Readout label="saved" does="The appearance the presentation owner keeps." value={name(saved)} />
        <Readout label="drawn" does="What the window draws now, once the owner acknowledged the change." value={name(txt(theme?.observed))} />
        <Action {...st(p, 'applyTheme')} label="Apply" does="The presentation owner saves the appearance; the window redraws in it." onPress={() => p.set('applyTheme', draft ?? true)} disabled={draft === undefined || draft === saved ? 'Choose a different appearance first.' : undefined} />
        <Action {...st(p, 'revertTheme')} label="Revert" does="Returns to the appearance saved before the last one." onPress={() => p.set('revertTheme', true)} />
      </div>
    </section>
    <section className="st-sec">
      <h4>Imported themes<small>VS Code themes, converted and checked on import</small>
        <span className="st-head-acts"><Action {...st(p, 'importTheme')} label="Import…" does="Imports a VS Code theme file. It is converted and checked before the owner keeps it." onPress={() => p.set('importTheme', true)} /></span></h4>
      <div className="st-chips">{imported === undefined ? <span className="st-none">No reading of the imported themes.</span> : imported.length === 0 ? <span className="st-none">None imported.</span>
        : imported.map(t => <span key={txt(t.id) ?? ''} className="st-chip">{txt(t.name) ?? NONE}
          <Action {...st(p, 'removeTheme')} hold label="Remove" does="The presentation owner removes this imported theme." onPress={() => p.set('removeTheme', txt(t.id) ?? true)} /></span>)}</div>
    </section>
    <section className="st-sec">
      <h4>Opening<small>this installation</small></h4>
      <div className="st-line">
        {toggle('visualLayer', 'Visual layer', 'Shows the retained visual layer in this installation.')}
        {toggle('welcome', 'Welcome scene', 'Shows the welcome scene when the application opens.')}
      </div>
    </section>
    <OwnerRows p={p} category="appearance" size={3} />
  </>
}

// ---------------------------------------------------------------- Products & updates

const STATE_TONE: Readonly<Record<string, Tone>> = {available: 'green', degraded: 'accent', unavailable: 'stall'}
function ProductsPage({p}: {p: ViewProps}) {
  const v = p.v, products = list(v, 'products'), chosen = products?.find(r => r.id === strOf(v, 'product')) ?? products?.[0], ran = json<Rec | null>(v, 'ran', null)
  return <>
    <section className="st-sec">
      <h4>Installed products<small>{products ? `${products.length} owners` : 'no reading of the products'}</small>
        <span className="st-head-acts"><Action {...st(p, 'reread')} label="Read again" does="Reads every product's System disclosure again." onPress={() => p.set('reread', true)} /></span></h4>
      {products && <table className="st-tbl">
        <Cols w={[110, 64, 90, undefined]} />
        <thead><tr><th>Product</th><th>Version</th><th>State</th><th>Operations</th></tr></thead>
        <tbody>{products.map(r => {
          const id = txt(r.id) ?? '', state = txt(r.state), acts = Array.isArray(r.actions) ? r.actions.filter(rec) : []
          return <tr key={id} className="st-pick" data-focus={chosen?.id === id ? 'true' : undefined} onClick={() => p.set('product', id)}>
            <td><b>{ownerWord(id)}</b></td><td>{txt(r.version) ?? NONE}</td>
            <td data-i={txt(r.reason) ? `${state ?? NONE}|${r.reason}` : undefined}><span data-st={state ? STATE_TONE[state] : undefined}>{state ?? NONE}</span></td>
            <td className="st-acts st-acts--left">{acts.length ? acts.slice(0, 3).map(a => <Action key={txt(a.ref) ?? ''} {...st(p, 'run')} label={txt(a.title) ?? NONE}
              does={a.runnable === true ? `Runs ${txt(a.title)} through ${ownerWord(id)}.` : txt(a.why) ?? 'Choose its subject where you use it.'}
              onPress={() => p.set('run', `${id}:${txt(a.ref) ?? ''}`)} disabled={a.runnable === true ? undefined : txt(a.why) ?? 'Choose its subject where you use it.'} />) : <span className="st-dim">none here</span>}</td>
          </tr>
        })}</tbody>
      </table>}
    </section>
    {chosen && <section className="st-sec">
      <h4>{ownerWord(txt(chosen.id))}<small>observed {txt(chosen.observed) ?? NONE} · digest {txt(chosen.digest)?.slice(0, 12) ?? NONE}</small></h4>
      <div className="st-cols">
        <ul className="st-list" aria-label="Degradations">{Array.isArray(chosen.degraded) && chosen.degraded.length
          ? chosen.degraded.filter(rec).map((d, i) => <li key={i}><b>{txt(d.subject) ?? NONE}</b><span data-st={STATE_TONE[txt(d.state) ?? '']}>{txt(d.state) ?? NONE}</span><em>{txt(d.reason) ?? ''}</em></li>)
          : <li className="st-none">{Array.isArray(chosen.degraded) ? 'Nothing degraded.' : 'No reading of its health.'}</li>}</ul>
        <ul className="st-list" aria-label="Known gaps">{strs(chosen.obligations).length ? strs(chosen.obligations).map((o, i) => <li key={i}><em>{o}</em></li>)
          : <li className="st-none">No known gap.</li>}</ul>
      </div>
      {ran && <p className="st-note" data-st={ran.ok === true ? 'green' : 'stall'}>{txt(ran.title) ?? NONE}: {ran.ok === true ? 'the owner reports success' : 'the owner reports a problem'}
        {Array.isArray(ran.rows) ? ` · ${(ran.rows as unknown[]).filter(Array.isArray).map(r => `${String((r as unknown[])[0])} ${String((r as unknown[])[1])}`).join(' · ')}` : ''}</p>}
    </section>}
    <OwnerRows p={p} category="products" size={3} title="Installation" />
  </>
}

// ---------------------------------------------------------------- System: the four axes

/** An axis's value in a few words: a reason where the owner says it cannot read, a count for a list, the value itself for a scalar. */
function axisWord(x: unknown): {word: string; why?: string; faint?: boolean} {
  if (x === undefined || x === null) return {word: NONE, faint: true}
  if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return {word: String(x)}
  if (Array.isArray(x)) return {word: `${x.length}`}
  if (rec(x)) {
    if (txt(x.state) === 'unavailable') return {word: 'unavailable', why: txt(x.reason), faint: true}
    const keys = Object.keys(x)
    if (!keys.length) return {word: 'none', faint: true}
    const arr = keys.find(k => Array.isArray(x[k]))
    if (arr) { const n = (x[arr] as unknown[]).length; return {word: `${n} ${arr}`} }
    if (keys.length === 1) { const only = x[keys[0]!]; return typeof only === 'object' ? {word: keys[0]!} : {word: String(only)} }
    if (txt(x.state)) return {word: x.state as string}
    return {word: `${keys.length} fields`}
  }
  return {word: NONE, faint: true}
}
const AXES = ['declared', 'effective', 'active', 'staged'] as const
function SystemPage({p}: {p: ViewProps}) {
  const v = p.v, owners = list(v, 'system'), axes = strOf(v, 'axes') ?? 'disclosure'
  const owner = owners?.find(o => o.id === strOf(v, 'owner')) ?? owners?.[0]
  const rows = owner && Array.isArray(owner.settings) ? owner.settings.filter(rec) : []
  const [shown, pager] = usePaged(rows, 9)
  const drifted = rows.filter(r => rec(r.drift) && r.drift.state !== 'none').length
  return <>
    <section className="st-sec">
      <h4>{axes === 'configuration' ? 'Configuration' : 'Disclosure'}<small>{axes === 'configuration' ? 'the owners\' read-only configuration' : owner ? `${ownerWord(txt(owner.id))} ${txt(owner.version) ?? ''} · digest ${txt(owner.digest)?.slice(0, 12) ?? NONE} · ${txt(owner.observed) ?? NONE}` : 'no reading of the System disclosures'}</small>
        {axes === 'disclosure' && pager}
        <span className="st-head-acts">
          <Radio {...st(p, 'axes')} does="Each owner's System reading on four axes, or the read-only settings the owners contribute." value={axes}
            options={[{value: 'disclosure', label: 'Four axes'}, {value: 'configuration', label: 'Configuration'}]} onChange={x => p.set('axes', x)} />
          {axes === 'disclosure' && <Chooser {...st(p, 'owner')} does="Whose System reading the table shows." value={txt(owner?.id) ?? ''}
            options={(owners ?? []).flatMap(o => (txt(o.id) ? [{value: o.id as string, label: ownerWord(o.id as string)}] : []))} onChange={x => p.set('owner', x)} />}
          {axes === 'disclosure' && <Readout label="drift" does="Settings whose two named axes disagree." value={owner ? drifted : undefined} tone={drifted ? 'stall' : 'green'} />}
        </span></h4>
      {axes === 'disclosure' && owner && <table className="st-tbl st-axes">
        <Cols w={[undefined, 72, 72, 72, 72, 76]} />
        <thead><tr><th>Setting</th>{AXES.map(a => <th key={a}>{a}</th>)}<th>Drift</th></tr></thead>
        <tbody>{shown.map(r => {
          const drift = rec(r.drift) ? r.drift : undefined, ds = txt(drift?.state)
          return <tr key={txt(r.key) ?? ''}>
            <td data-i={`${txt(r.title) ?? NONE}|${txt(r.path) ? `Read with ${r.path}.` : 'No native command reads it alone.'}${r.mutable === true ? ' The owner lets you change it.' : ''}`}>
              <b>{txt(r.title) ?? NONE}{r.mutable === true && <i className="st-mut">✎</i>}</b><small>{txt(r.section) ?? ''}</small></td>
            {AXES.map(a => { const w = axisWord(r[a]); return <td key={a} data-faint={w.faint ? 'true' : undefined} data-i={w.why ? `${a}|${w.why}` : undefined}>{w.word}</td> })}
            <td><span data-st={ds === 'none' ? undefined : 'stall'}>{ds === 'none' ? 'none' : ds ? `${ds}${Array.isArray(drift?.between) ? ` · ${strs(drift!.between).join(' ≠ ')}` : ''}` : NONE}</span></td>
          </tr>
        })}</tbody>
      </table>}
    </section>
    {axes === 'configuration' && <OwnerRows p={p} category="inspection" size={10} title="Read-only configuration" />}
  </>
}

// ---------------------------------------------------------------- the owners' settings pages, search, review

function OwnerPage({p, category}: {p: ViewProps; category: string}) {
  return <><div className="st-scope"><ScopeBar p={p} /></div><OwnerRows p={p} category={category} size={11} /></>
}

function Results({p}: {p: ViewProps}) {
  const q = (strOf(p.v, 'search') ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean)
  const hit = (s: string) => q.every(w => s.toLowerCase().includes(w))
  const settings = (settingsOf(p.v) ?? []).filter(s => hit(`${s.title} ${s.ref} ${ownerWord(s.owner)} ${s.section ?? ''}`))
  const pages = PAGES.filter(x => hit(x.label))
  const elsewhere = (list(p.v, 'elsewhere') ?? []).filter(e => hit(`${txt(e.title) ?? ''} ${txt(e.ref) ?? ''}`))
  const [shown, pager] = usePaged([...pages.map(x => ({kind: 'page' as const, x})), ...settings.map(x => ({kind: 'setting' as const, x})), ...elsewhere.map(x => ({kind: 'elsewhere' as const, x}))], 12)
  const go = (page: PageId, focus?: string) => { p.setPage(page); p.set('focus', focus); p.set('search', '') }
  return <section className="st-sec">
    <h4>Search<small>{shown.length ? `${pages.length + settings.length + elsewhere.length} found` : 'nothing found'}</small>{pager}</h4>
    <table className="st-tbl"><Cols w={[undefined, 200]} /><tbody>{shown.map((r, i) => r.kind === 'page'
      ? <tr key={`p${i}`} className="st-pick" onClick={() => go(r.x.id)}><td><b>{r.x.label}</b></td><td className="st-dim">page</td></tr>
      : r.kind === 'setting'
        ? <tr key={r.x.ref} className="st-pick" onClick={() => go(pageOfCategory(r.x.category), r.x.ref)}><td><b>{r.x.title}</b><small>{ownerWord(r.x.owner)}</small></td>
          <td className="st-dim">{PAGES.find(x => x.category === r.x.category)?.label ?? NONE}</td></tr>
        : <tr key={`e${i}`} className="st-pick" onClick={() => p.set('openElsewhere', txt(r.x.ref) ?? true)}><td><b>{txt(r.x.title) ?? NONE}</b></td><td className="st-dim">beside {txt(r.x.where) ?? 'its instrument'} ▸</td></tr>)}</tbody></table>
  </section>
}

const PLAN_TONE: Readonly<Record<string, Tone>> = {applied: 'green', verified: 'green', refused: 'stall', failed: 'stall'}
function ReviewPage({p}: {p: ViewProps}) {
  const plans = list(p.v, 'plans'), result = json<Rec | null>(p.v, 'result', null), ops = result && Array.isArray(result.operations) ? result.operations.filter(rec) : []
  return <section className="st-sec">
    <h4>Review changes<small>{plans ? `${plans.length} planned by their owners` : 'the owners have not planned your changes'}</small>
      <span className="st-head-acts">
        <Action {...st(p, 'apply')} label="Apply" does="Each owner applies the plan it reviewed, then reads the settings again." onPress={() => p.set('apply', true)} disabled={plans?.length ? undefined : 'Nothing is planned.'} />
        <Action label="Back" does="Back to your changes. They stay as they are." onPress={() => p.setPage('harnesses')} />
      </span></h4>
    {plans && <table className="st-tbl">
      <Cols w={result ? [170, 90, undefined, 84, 104] : [170, 90, undefined, 84]} />
      <thead><tr><th>Setting</th><th>At</th><th>Change</th><th>Applies</th>{result && <th>Answer</th>}</tr></thead>
      <tbody>{plans.map(r => {
        const op = ops.find(o => o.ref === r.ref), s = txt(op?.status)
        return <tr key={txt(r.ref) ?? ''}><td><b>{txt(r.title) ?? txt(r.ref) ?? NONE}</b></td><td>{txt(r.scope) ?? NONE}</td><td className="st-dim">{strs(r.changes).join(' · ') || NONE}</td>
          <td>{TIMING[txt(r.effect) ?? 'unknown'] ?? txt(r.effect)}</td>
          {result && <td data-i={txt(op?.message) ? `${s ?? NONE}|${op!.message}` : undefined}><span data-st={s ? PLAN_TONE[s] : undefined}>{s ?? 'not acknowledged'}</span></td>}</tr>
      })}</tbody>
    </table>}
  </section>
}

// ---------------------------------------------------------------- the window

function Window({p}: {p: ViewProps}) {
  const v = p.v, page = pageOf(p), src = json<Rec | null>(v, 'source', null), settings = settingsOf(v), drafts = draftsOf(v).length
  const searching = (strOf(v, 'search') ?? '').trim() !== ''
  const shown = PAGES.filter(x => !('contributed' in x) || settings?.some(s => s.category === x.category))
  const lamp: LightState = src ? (txt(src.kind) === 'native' ? 'lit' : 'dark') : 'unknown'
  const nav = (group: string) => <>
    <span className="st-nav-group">{group}</span>
    {shown.filter(x => x.group === group).map(x => {
      const n = settings ? draftsOf(v).filter(k => settings.find(s => draftKey(s.ref) === k)?.category === x.category).length : 0
      return <button key={x.id} type="button" aria-current={page === x.id && !searching ? 'page' : undefined} onClick={() => { p.setPage(x.id); p.set('search', '') }}>
        {x.label}{n > 0 && <i data-i={`${x.label}|${n} local ${n === 1 ? 'change' : 'changes'} on this page.`}>{n}</i>}</button>
    })}
  </>
  const body = searching ? <Results p={p} /> : page === 'review' ? <ReviewPage p={p} /> : page === 'harnesses' ? <HarnessesPage p={p} /> : page === 'credentials' ? <CredentialsPage p={p} />
    : page === 'profiles' ? <ProfilesPage p={p} /> : page === 'machines' ? <MachinesPage p={p} /> : page === 'automations' ? <AutomationsPage p={p} />
      : page === 'appearance' ? <AppearancePage p={p} /> : page === 'products' ? <ProductsPage p={p} /> : page === 'system' ? <SystemPage p={p} />
        : <OwnerPage p={p} category={PAGES.find(x => x.id === page)!.category} />
  return <div className="ref-pane-body st-window">
    <header className="st-top">
      <b>Settings</b>
      <span className="st-search"><TextField does="Searches every page, every owner's setting, and the settings that stand beside their instrument. ⌘F." value={strOf(v, 'search') ?? ''}
        placeholder="⌕ Search settings" onChange={x => p.set('search', x)} /></span>
      <span className="st-source" data-i={`Owners|${src ? (txt(src.kind) === 'native' ? 'Read and written through the native owners.' : txt(src.kind) === 'development' ? 'A development adapter: simulated answers, nothing native written.' : 'No native connection: nothing is read or written.') : 'No reading of the connection.'}`}>
        <Lamp state={lamp} tone="green" />{src ? txt(src.label) ?? NONE : NONE}{src?.simulated === true && <em>simulated</em>}</span>
    </header>
    <div className="st-main">
      <nav className="st-nav" aria-label="Settings pages">{nav('Preferences')}{nav('System')}</nav>
      <main className="st-page" aria-label={searching ? 'Search' : PAGES.find(x => x.id === page)?.label ?? 'Review changes'}>{body}</main>
    </div>
    <footer className="st-foot">
      <span>{drafts ? `${drafts} local ${drafts === 1 ? 'change' : 'changes'}` : 'No local changes'}{conflictsOf(v).length ? ` · ${conflictsOf(v).length} to keep or drop` : ''}</span>
      {drafts > 0 && <Action label="Discard" does="Drops every local change. Nothing was written." onPress={() => p.set('discard', true)} />}
      <Action {...st(p, 'plan')} label="Review changes…" does="Each owner plans your local changes. You read the plans before anything is applied."
        onPress={() => { p.set('plan', true); p.setPage('review') }} disabled={drafts ? undefined : 'You have no local changes.'} />
    </footer>
  </div>
}

// ---------------------------------------------------------------- the sample readings

const dump = (x: unknown) => JSON.stringify(x)
// The owners' settings on this Mac (settings/native-inventory.capture.json), at the machine scope.
const SETTINGS = [
  {ref: 'ai-kit:models:models.default', category: 'agents', owner: 'ai-kit', section: 'models', title: 'Default model per harness', kind: 'table', writable: true, from: 'here', timing: 'session-restart-required',
    columns: [{name: 'harness', type: 'text', choices: ['claude-code', 'codex', 'pi']}, {name: 'model', type: 'text', choices: ['claude-opus-5-5', 'claude-sonnet-5', 'gpt-5.5-codex']}],
    rows: [{harness: 'claude-code', model: 'claude-opus-5-5'}, {harness: 'pi', model: 'claude-sonnet-5'}]},
  {ref: 'ai-kit:models:models.candidates', category: 'agents', owner: 'ai-kit', section: 'models', title: 'Model candidates', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: 'aikit:roster/default'},
  {ref: 'ai-kit:resolution:resolution.profiles', category: 'profiles', owner: 'ai-kit', section: 'resolution', title: 'Native profile selection', kind: 'choice', options: ['core', 'core-development', 'documentation'], writable: true, from: 'inherited', timing: 'session-restart-required', effective: 'core-development'},
  {ref: 'ai-kit:models:models.credentials', category: 'connections', owner: 'ai-kit', section: 'models', title: 'Provider credential reference', kind: 'secret', writable: false, from: 'inherited', timing: 'provider-reconnect-required', effective: 'keychain://aikit/anthropic'},
  {ref: 'ai-kit:local-services:decision.provider', category: 'execution', owner: 'ai-kit', section: 'local-services', title: 'Decision provider election', kind: 'path', writable: true, from: 'here', timing: 'value-change', effective: 'service:kev-decision/personal-workcell'},
  {ref: 'ai-kit:local-services:now.redis', category: 'execution', owner: 'ai-kit', section: 'local-services', title: 'Redis NOW election', kind: 'path', writable: true, from: 'inherited', timing: 'value-change', effective: 'service:redis-now/personal-workcell'},
  {ref: 'workcell:processes-services:services.declared', category: 'execution', owner: 'workcell', section: 'processes-services', title: 'Declared logical services', kind: 'table', writable: true, from: 'inherited', timing: 'value-change',
    columns: [{name: 'logical_ref', type: 'text'}, {name: 'endpoint', type: 'text'}], rows: [{logical_ref: 'service:kev-decision/personal-workcell', endpoint: 'http://127.0.0.1:8019'}, {logical_ref: 'service:redis-now/personal-workcell', endpoint: 'redis://127.0.0.1:6381'}]},
  {ref: 'ai-kit:resolution:skill-sets.default', category: 'skills', owner: 'ai-kit', section: 'resolution', title: 'Default skill-sets', kind: 'list', writable: true, from: 'inherited', timing: 'value-change', rows: [{item: 'central:core-development'}, {item: 'central:documentation'}]},
  {ref: 'ai-kit:skills:skills.capabilities', category: 'skills', owner: 'ai-kit', section: 'skills', title: 'Capability toggles', kind: 'table', writable: true, from: 'here', timing: 'session-restart-required',
    columns: [{name: 'capability', type: 'text'}, {name: 'enabled', type: 'boolean'}], rows: [{capability: 'web-fetch', enabled: true}, {capability: 'computer-use', enabled: false}]},
  {ref: 'central:skills:central.skills', category: 'skills', owner: 'central', section: 'skills', title: 'Skill standing', kind: 'table', writable: true, from: 'inherited', timing: 'value-change',
    columns: [{name: 'skill', type: 'text'}, {name: 'standing', type: 'text', choices: ['active', 'retired']}], rows: [{skill: 'central-day-close', standing: 'active'}, {skill: 'sanity-check', standing: 'retired'}]},
  {ref: 'ai-kit:permissions:permissions.default-mode', category: 'permissions', owner: 'ai-kit', section: 'permissions', title: 'Default permission mode per harness', kind: 'table', writable: true, from: 'inherited', timing: 'session-restart-required',
    columns: [{name: 'harness', type: 'text'}, {name: 'mode', type: 'text'}], rows: [{harness: 'claude-code', mode: 'acceptEdits'}]},
  {ref: 'ai-kit:codex:home.trust_level', category: 'permissions', owner: 'ai-kit', section: 'codex', title: 'Home wholesale trust', kind: 'toggle', writable: false, from: 'inherited', timing: 'none', effective: false},
  {ref: 'central:policy:placement.enforcement', category: 'permissions', owner: 'central', section: 'policy', title: 'Work placement enforcement', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: 'enforce'},
  {ref: 'software-factory:telemetry:search-limit-default', category: 'telemetry', owner: 'software-factory', section: 'telemetry', title: 'Search result limit default', kind: 'number', writable: true, from: 'inherited', timing: 'value-change', effective: 50, range: '1 – 500'},
  {ref: 'software-factory:telemetry:search-timeout-seconds', category: 'telemetry', owner: 'software-factory', section: 'telemetry', title: 'Delegated search budget (s)', kind: 'number', writable: true, from: 'inherited', timing: 'value-change', effective: 30, range: '1 – 600'},
  {ref: 'software-factory:telemetry:watch-interval-seconds', category: 'telemetry', owner: 'software-factory', section: 'telemetry', title: 'Watch poll interval (s)', kind: 'number', writable: true, from: 'here', timing: 'value-change', effective: 5, range: '1 – 3600'},
  {ref: 'software-factory:binding:central-project', category: 'library', owner: 'software-factory', section: 'binding', title: 'Central project binding', kind: 'table', writable: true, from: 'inherited', timing: 'value-change',
    columns: [{name: 'project', type: 'text'}, {name: 'register', type: 'text'}], rows: [{project: 'O-I', register: 'Work/O-I/ProjectCentral'}]},
  {ref: 'oi:composition:install-mode', category: 'products', owner: 'oi', section: 'composition', title: 'Install mode', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: 'developer'},
  {ref: 'oi:update:state', category: 'products', owner: 'oi', section: 'update', title: 'Update state', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: 'current'},
  {ref: 'oi:identity:suite-executable', category: 'products', owner: 'oi', section: 'identity', title: 'Suite executable', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: '~/.local/bin/oi'},
  {ref: 'central:policy:civil-time.timezone', category: 'inspection', owner: 'central', section: 'policy', title: 'Civil-time timezone', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: 'Europe/London'},
  {ref: 'central:policy:civil-time.day-boundary-minutes', category: 'inspection', owner: 'central', section: 'policy', title: 'Day boundary offset', kind: 'number', writable: false, from: 'inherited', timing: 'none', effective: 240},
  {ref: 'quaternal-logic:kernel:kernel.version', category: 'inspection', owner: 'quaternal-logic', section: 'kernel', title: 'Kernel version', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: '0.9.4'},
  {ref: 'actuation:return:return.modes', category: 'inspection', owner: 'actuation', section: 'return', title: 'Return policy modes', kind: 'list', writable: false, from: 'inherited', timing: 'none', rows: [{item: 'propose'}, {item: 'draft'}, {item: 'write'}]},
]
// Workcell's and Central's System disclosures on this Mac (`workcell system --json`, `ctrl system --json`, 21 Oct).
const SYSTEM = [
  {id: 'workcell', version: '0.1.0', digest: 'a0be0a9d41fbbe1e20543f8ef138b44f', observed: '21 Oct 14:04', contract: 'wave-5/system.1', settings: [
    {section: 'machines', key: 'machines.declared', title: 'Declared remote machines', mutable: false, path: 'workcell machine list', drift: {state: 'none', between: ['declared', 'effective']},
      declared: {machines: [{label: 'omarchy'}, {label: 'omarchy-improvement-lanes'}]}, effective: {machines: [{label: 'omarchy'}, {label: 'omarchy-improvement-lanes'}]},
      active: {state: 'unavailable', reason: 'Machine declarations are recorded; connection health is not probed by Settings.'}, staged: {}},
    {section: 'machines', key: 'machines.connections', title: 'Recorded connections', mutable: false, path: 'workcell connections list', drift: {state: 'none'},
      declared: {connections: [{label: 'omarchy'}]}, effective: {connections: [{label: 'omarchy'}]}, active: {state: 'unavailable', reason: 'Connection receipts show the last reconciliation; endpoints are not contacted.'}, staged: {}},
    {section: 'keys', key: 'keys.references', title: 'Declared credential references', mutable: false, path: 'workcell secret list', drift: {state: 'none'},
      declared: {references: ['keychain://workcell-connection/omarchy', 'keychain://workcell-connection/omarchy-improvement-lanes']}, effective: {credentials: [{}, {}]},
      active: {state: 'unavailable', reason: 'The native origin stores do not expose an inventory or credential health here; no secret values are read.'}, staged: {}},
    {section: 'keys', key: 'keys.projections', title: 'Recorded credential projections', mutable: false, path: 'workcell secret projections', drift: {state: 'none'}, declared: {projections: []}, effective: {projections: []},
      active: {state: 'unavailable', reason: 'Projection state is recorded metadata; delivery is not verified by this reading.'}, staged: {}},
    {section: 'processes-services', key: 'services.declared', title: 'Declared logical services', mutable: true, path: 'workcell --services PATH', drift: {state: 'none'},
      declared: {services: [{}, {}, {}, {}]}, effective: {services: [{}, {}, {}, {}]}, active: {services: [{}, {}]}, staged: {}},
    {section: 'model-serving', key: 'model-serving.reference_services', title: 'Reference service materialisation', mutable: false, drift: {state: 'none'},
      declared: {services: [{}, {}, {}]}, effective: {services: [{}, {}, {}]}, active: {services: []}, staged: {}},
    {section: 'model-serving', key: 'model-serving.engine_shapes', title: 'Engine materialisation shapes', mutable: false, drift: {state: 'none'},
      declared: {engines: [{}, {}, {}]}, effective: {engines: [{}, {}, {}]}, active: {state: 'unavailable', reason: 'No model-serving service is declared on this Workcell.'}, staged: {}},
    {section: 'workcells', key: 'workcells.identity', title: 'Workcell identity', mutable: false, drift: {state: 'none'}, declared: {workcell_ref: 'workcell:mac'}, effective: {workcell_ref: 'workcell:mac'}, active: {workcell_ref: 'workcell:mac'}, staged: {}},
    {section: 'fabric', key: 'fabric.tailscale', title: 'Tailscale / tailnet', mutable: false, drift: {state: 'none'},
      declared: {state: 'unavailable', reason: 'No Tailscale provider is registered and no tailnet is detected.'}, effective: {state: 'unavailable', reason: 'No Tailscale provider is registered.'},
      active: {state: 'unavailable', reason: 'No tailnet is detected.'}, staged: {}},
  ]},
  {id: 'central', version: '0.1.0', digest: '5f18f7948542a53e96a0cbed080b1cc1', observed: '21 Oct 14:04', contract: 'wave-5/system.1', settings: [
    {section: 'ground', key: 'central.ground.register', title: 'Ground register binding', mutable: false, drift: {state: 'none'}, declared: 'control:root', effective: 'control:root', active: 'control:root', staged: null},
    {section: 'ground', key: 'central.ground.projects', title: 'Project registers', mutable: false, drift: {state: 'none'}, declared: {projects: Array(14).fill({})}, effective: {projects: Array(14).fill({})}, active: {projects: Array(14).fill({})}, staged: null},
    {section: 'machine-intent', key: 'central.machine-intent', title: 'Authored roles vs observed machine', mutable: false, drift: {state: 'unknown', between: ['declared', 'active']}, declared: {roles: [{}, {}]}, effective: {roles: [{}, {}]}, active: {state: 'unavailable', reason: 'No observation in this reading.'}, staged: null},
    {section: 'skills', key: 'central.skills', title: 'Authored skill ground and standing', mutable: true, drift: {state: 'none'}, declared: {skills: Array(71).fill({})}, effective: {skills: Array(70).fill({})}, active: {skills: Array(70).fill({})}, staged: null},
    {section: 'proposals', key: 'central.proposals', title: 'Pending source-return proposals', mutable: true, drift: {state: 'none'}, declared: {proposals: []}, effective: {proposals: []}, active: {proposals: []}, staged: {accepted: 0, pending_or_applying: 0, rejected: 0}},
  ]},
]
const DEFAULTS = {
  source: dump({kind: 'native', label: 'Native configuration · this Mac'}),
  scope: dump({kind: 'machine', ref: null, title: 'This machine'}),
  scopes: dump([{kind: 'machine', ref: null, title: 'This machine'}, {kind: 'world', ref: null, title: 'World'}, {kind: 'project', ref: 'O-I', title: 'Project · O-I'}, {kind: 'workcell', ref: 'env-1', title: 'Workcell · env-1'}]),
  settings: dump(SETTINGS), conflicts: dump([]),
  elsewhere: dump([{ref: 'live:delay:time', title: 'Delay time', where: 'the Delay on its chain'}, {ref: 'techne:timeline:zoom', title: 'Timeline zoom', where: 'the Timeline'}]),
  providers: dump([{id: 'anthropic', label: 'Anthropic'}, {id: 'openai', label: 'OpenAI'}, {id: 'pi', label: 'pi (local)'}]),
  effectiveDefault: dump({provider: 'anthropic', rule: 'first-configured'}),
  harnesses: dump([
    {client: 'claude-code', harness: 'Claude Code', installed: true, detection: 'detected', capability: 'agent', effect: 'Restart Claude to read new settings.', folder: '~/.claude'},
    {client: 'codex', harness: 'Codex', installed: true, detection: 'detected', capability: 'agent', effect: 'Next session only.', folder: '~/.codex'},
    {client: 'pi', harness: 'pi', installed: true, detection: 'detected', capability: 'agent', folder: '~/.pi'},
    {client: 'hermes', harness: 'Hermes', installed: true, detection: 'stale', reason: 'The gateway answered once and then went quiet.', capability: 'gateway', gap: {contract: 'No session-settings contract for Hermes yet.', skill: 'aikit:harness-adapter-authoring'}},
    {client: 'opencode', harness: 'OpenCode', installed: false, detection: 'absent', reason: 'Not on PATH.', capability: 'agent'},
  ]),
  routes: dump([
    {model: 'claude-opus-5-5', name: 'Claude Opus 5.5', routes: [{provider: 'anthropic', key: true, standing: 'usable'}, {provider: 'claude-code', key: false, standing: 'usable'}]},
    {model: 'claude-sonnet-5', name: 'Claude Sonnet 5', routes: [{provider: 'anthropic', key: true, standing: 'usable'}]},
    {model: 'gpt-5.5-codex', name: 'GPT-5.5 Codex', routes: [{provider: 'codex', key: false, standing: 'observed'}]},
    {model: 'glm-5.3-flash', name: 'GLM 5.3 Flash', routes: [{provider: 'z.ai coding plan', key: true, standing: 'unproven'}]},
    {model: 'qwen3.5-0.8b', name: 'Qwen3.5 0.8B', routes: [{provider: 'ollama', key: false, standing: 'observed'}]},
  ]),
  credentials: dump([
    {credential: 'ai-kit:credential:anthropic', provider: 'Anthropic', reference: 'keychain://aikit/anthropic', revoked: false, verdict: 'working', verifiedAt: '21 Oct 09:12'},
    {credential: 'ai-kit:credential:openai', provider: 'OpenAI', reference: 'keychain://aikit/openai', revoked: false},
    {credential: 'ai-kit:credential:zai', provider: 'z.ai', reference: 'keychain://aikit/zai-coding', revoked: false, verdict: 'refused', verifiedAt: '20 Oct 22:40'},
  ]),
  found: 2,
  secretRefs: dump([{ref: 'keychain://workcell-connection/omarchy', scheme: 'keychain', usedBy: ['connection:omarchy', 'machine:omarchy']},
    {ref: 'keychain://workcell-connection/omarchy-improvement-lanes', scheme: 'keychain', usedBy: ['machine:omarchy-improvement-lanes']}]),
  projections: dump([]), outside: 0,
  profiles: dump([
    {ref: 'quiet-evening', title: 'Quiet evening', active: false, settings: [{ref: 'ai-kit:resolution:resolution.profiles', title: 'Native profile selection'}, {ref: 'software-factory:telemetry:watch-interval-seconds', title: 'Watch poll interval'}]},
    {ref: 'build-day', title: 'Build day', active: true, settings: [{ref: 'ai-kit:models:models.default', title: 'Default model per harness'}, {ref: 'ai-kit:models:models.credentials', title: 'Provider credential reference', secret: true}, {ref: 'ai-kit:permissions:permissions.default-mode', title: 'Default permission mode'}, {ref: 'ai-kit:skills:skills.capabilities', title: 'Capability toggles'}]},
  ]),
  machines: dump([
    {label: 'omarchy', endpoint: '100.92.62.101:7777', credential: 'keychain://workcell-connection/omarchy', expects: ['status', 'prepare', 'run', 'collect'], note: 'Omarchy, the Linux machine'},
    {label: 'omarchy-improvement-lanes', endpoint: '100.92.62.101:7778', credential: 'keychain://workcell-connection/omarchy-improvement-lanes', expects: ['status', 'run']},
  ]),
  connections: dump([{label: 'omarchy', state: 'connected', protocol: 'workcell.control/v1', remote: 'workcell 0.1.0 (174fa1c3133a)', granted: ['status', 'prepare', 'run'], reconciled: '21 Oct 13:58',
    detail: 'Software revisions differ: local c7261e23bc93, remote 174fa1c3133a. The protocol matches.'}]),
  show: 'routines', routine: 'routine:morning-checks', context: 'home', contexts: dump([{ref: 'home', title: 'This AIKit home'}, {ref: 'O-I', title: 'Project · O-I'}]),
  routines: dump([
    {ref: 'routine:morning-checks', name: 'Morning checks', state: 'enabled', when: 'daily 07:30', next: 'Thu 07:30', method: 'central:oi-checks', revision: 'r14', verified: true, unattended: true},
    {ref: 'routine:week-notes', name: 'Write up the week', state: 'draft', when: 'Fri 17:00', method: 'central:week-notes', revision: 'r3', verified: true, unattended: false},
    {ref: 'routine:map-refresh', name: 'Refresh the QL map', state: 'disabled', when: 'on bimba change', method: 'ql:refresh-from-bimba', revision: 'r7', verified: false, unattended: true},
  ]),
  methods: dump([{method: 'central:oi-checks', revision: 'r14', runs: 6}, {method: 'central:week-notes', revision: 'r3', runs: 2}, {method: 'ql:refresh-from-bimba', revision: 'r8', runs: 0}]),
  timers: dump([{name: 'nightly-backup', provider: 'launchd', when: '02:00'}]),
  history: dump([{at: 'Wed 07:30', routine: 'Morning checks', outcome: 'succeeded', delivery: 'Ledger receipt'}, {at: 'Tue 07:30', routine: 'Morning checks', outcome: 'failed', delivery: 'NOW return'}]),
  options: dump({proofs: [{ref: 'proof:oi-checks-r14', title: 'oi-checks r14 · Wed 07:31'}], triggers: [{ref: 'schedule:daily-0730', title: 'Daily 07:30'}], authorities: [{ref: 'authority:unattended-checks', title: 'Unattended · checks'}],
    profiles: [{ref: 'core-development', title: 'core-development'}]}),
  theme: dump({saved: 'system', observed: 'dark'}),
  themes: dump([{id: 'ableton-dark', name: 'Ableton dark'}, {id: 'paper', name: 'Paper'}]), imported: dump([{id: 'solarized', name: 'Solarized Dark'}]),
  visualLayer: true, welcome: false,
  products: dump([
    {id: 'central', version: '0.1.0', state: 'available', actions: [], observed: '21 Oct 14:04', digest: '5f18f7948542a53e', degraded: [], obligations: ['Acceptance of an authored-source return reports unavailable: no attested human principal yet.']},
    {id: 'ai-kit', version: '0.42.1', state: 'available', actions: [{ref: 'aikit.update', title: 'Update', runnable: true}, {ref: 'aikit.doctor', title: 'Doctor', runnable: true}], observed: '21 Oct 14:04', degraded: [], obligations: []},
    {id: 'workcell', version: '0.1.0', state: 'degraded', reason: 'No Fabric or network provider is registered.', actions: [], observed: '21 Oct 14:04', digest: 'a0be0a9d41fbbe1e',
      degraded: [{subject: 'fabric.provider', state: 'unavailable', reason: 'Host-process execution claims no cross-host reachability.'}, {subject: 'hardware.accelerator', state: 'unavailable', reason: 'No accelerator-observation faculty exists; a GPU is never invented.'}],
      obligations: ['Lifecycle intent and invoke are not disclosed through the O:I kernel seam.']},
    {id: 'software-factory', version: '0.3.0', state: 'available', actions: [{ref: 'factory.reindex', title: 'Reindex', runnable: false, why: 'Choose the project where you use it.'}], degraded: [], obligations: []},
    {id: 'quaternal-logic', version: '0.9.4', state: 'available', actions: [], degraded: [], obligations: []},
  ]),
  product: 'workcell',
  system: dump(SYSTEM), owner: 'workcell', axes: 'disclosure',
} as const

const NOTHING = Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, undefined]))

export const design: DesignedDevice = {
  id: 'settings:window',
  title: 'Settings',
  kind: 'instrument',
  views: ['full'],
  firstPage: 'harnesses',
  defaults: DEFAULTS,
  fixtures: {
    'This Mac': {},
    'Changes to review': {
      'draft:software-factory:telemetry:watch-interval-seconds': 10, 'draft:ai-kit:resolution:resolution.profiles': 'documentation',
      'draft:ai-kit:models:models.default': dump([{harness: 'claude-code', model: 'claude-opus-5-5'}, {harness: 'pi', model: 'claude-sonnet-5'}, {harness: 'codex', model: 'gpt-5.5-codex'}]),
      conflicts: dump(['ai-kit:resolution:resolution.profiles']), focus: 'ai-kit:models:models.default', chatDefault: 'pi',
      plans: dump([
        {ref: 'ai-kit:models:models.default', title: 'Default model per harness', scope: 'This machine', changes: ['codex → gpt-5.5-codex'], effect: 'session-restart-required'},
        {ref: 'ai-kit:resolution:resolution.profiles', title: 'Native profile selection', scope: 'This machine', changes: ['core-development → documentation'], effect: 'session-restart-required'},
        {ref: 'software-factory:telemetry:watch-interval-seconds', title: 'Watch poll interval (s)', scope: 'This machine', changes: ['5 → 10'], effect: 'value-change'},
      ]),
      result: dump({status: 'partial', operations: [{ref: 'ai-kit:models:models.default', status: 'applied'}, {ref: 'software-factory:telemetry:watch-interval-seconds', status: 'verified'},
        {ref: 'ai-kit:resolution:resolution.profiles', status: 'refused', message: 'The profile documentation is not admitted at the machine scope.'}]}),
      adding: 'routine', 'new.name': 'Nightly map refresh', 'new.method': 'central:oi-checks', rotating: 'ai-kit:credential:zai',
    },
    'Development adapter': {source: dump({kind: 'development', label: 'Development scenario · census of 7 October', simulated: true}), connections: dump([]), search: 'model'},
    'No readings': NOTHING,
  },

  // The window stands on no chain and on no rail: it has Full only (views). Asked for another view, it draws its Full.
  folded: p => <Window p={p} />,
  compact: p => <Window p={p} />,
  whole: p => <Window p={p} />,
  full: p => <Window p={p} />,
  widget: p => <Window p={p} />,
}
