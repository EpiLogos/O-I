// Settings (manual §10.10, settings:window): the window ⌘, opens, after Live's Settings: its pages down the left, the page beside them.
// The first time the DLW opens, the window opens on Setup (§10.11): five steps that bring in what you have, each found, previewed and
// accepted in turn. It holds what the owners of your world let you set: the harnesses and models new conversations start with, the credentials they
// reach providers through, the profiles you keep, the machines a workcell carries work to, the routines that run verified Methods,
// the look of the window, the installed products, and each owner's System reading (what it declares, what is in effect, what is
// active, what waits staged). The window stands on no chain, so it has Full only. One design with pages, not a design for each page:
// the pages share one search, one scope, one set of local changes and one review, as the shell's window does (settings/
// SettingsWorkspace.tsx, whose behaviour this design carries).
//
// Owners, keyed on their paths. Every reading arrives through the shell's SettingsAdapter (settings/adapter.ts) over kernel ops, mapped by
// settings/windowValues.ts (SETTINGS_WINDOW_WIRING classifies each key):
//   source      {kind: native | development | unavailable, label, simulated?}  the adapter itself (SettingsAdapter kind, label,
//               simulated). A development adapter answers with simulated responses and writes nothing native.
//   owners      [{owner, reason}]  the owners whose contribution cannot be read, each with its reason: the head names them.
//   back        the name of the work Settings returns to (SettingsRequest.returnLabel): the head's way back. Esc does the same.
//   settings    [{ref, category, owner, section, title, kind, options?, columns?, rows?, effective?, from, timing, writable, range?, hint?,
//               help, effect?, at?, words, details, cells?, clears?, fixed?}]
//               every owner's contributed setting at its scope: config_registry_read (each owner's oi.configuration-contribution/v1:
//               setting_ref, section_ref, title, value_schema, operations, effect) with config_resolutions_read (the native effective
//               value; declared at this scope → from 'here', else 'inherited'; 'unread' before a reading). category is the page the shell
//               files it under (settings/model.ts categoryOf). kind: choice | toggle | number | text | path | list | table | secret; a
//               choice's options are [{value, title}]. A secret's effective value is its reference. help and effect are what the setting
//               does and when a change applies, in the owner's words (said on the Info line from the setting's name); at is the scope it
//               is read at; words what search matches beyond the title; details {identity, where, desired, declared, effective,
//               provenance, active, staged, proposed, default, reconciliation, basis, connection?} the setting's Details, in words; a
//               table's cells [{<column>: {choices?: [{value, title}], why?}}] are the owner's dependent choices for each entry
//               (SettingsAdapter.choices), clears {harness: [column]} the columns a changed harness drops, fixed a record of one entry.
//   scopes      [{kind, ref, title}]  the subjects a setting can apply to (SettingsAdapter.scopeChoices, and the scopes the owners'
//               settings allow); `scope` the one most settings stand at, pageScopes {<category>: scope} each page's.
//   conflicts   [ref]  drafts whose owner reading or owner connection changed since you made them (model.ts basisChanged,
//               draftOwnerChanged).
//   elsewhere   [{ref, title, where, words?, scope?}]  settings whose editor stands beside its instrument (SettingsAdapter.pointOfUseEntries);
//               search finds them and opens them there.
//   plans       [{ref, title, scope, changes: [text], effect, summary?}]  the owners' plans for your local changes (config_plan_reviewed),
//               kept after Apply beside the answer; planErrors [text] what the owners refused instead of planning.
//   result      {status, operations: [{ref, title, status, message?}]}  the owners' answer to Apply or Reset (config_apply_reviewed,
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
// Profiles:     profiles [{ref, title, active, settings: [{ref, title, scope, value?, secret?}]}]  O:I's named profiles (profile_list,
//               profile_read).
// Machines:     machines [{label, endpoint, credential?, expects: [op], note?}]  Workcell's declarations (`workcell machine list`);
//               connections [{label, state, protocol?, remote?, granted: [op], reconciled?, expires?, detail?}]  its receipts (`workcell
//               connections list`: connected | disconnected | refused | incompatible); operations [op] the control operations a
//               declaration may expect (`workcell machine list` control_operations); workcell the workcell they belong to.
// Setup (manual §10.11; the kernel's `setup` op over native oi's adoption: discover, plan, apply with the plan's review token):
//               setup [{step: ground | harnesses | credentials | machines | projects, state: found | accepted, items: [{name, where?,
//               change?, why?, credential?, bound?}]}]  what each step found, the change Accept would make, or why setup leaves it alone
//               (a Credentials row names the credential it binds, and whether it is bound); setupStep the step shown; setupPlan [text]
//               the steps the owner would take, in order, once you press Preview. credential (the key the Credentials step binds) and
//               reference (where it lies in your secure store: a reference, never the key) are your choices there.
//               folders [{path, title, place: work | elsewhere, finds: none | one | many | unreadable | ground, wikis: [path],
//               material: [name], central: [part]}]  the folders the Projects step read: what it found, the wikis a folder keeps, its
//               own material and the ProjectCentral parts already there; folder, make (create | keep | copy), wiki and where
//               (stands | work) are your choices for the folder shown.
// Automations (AIKit, kernel op `routine`): routines [{ref, name, state, when?, next?, nextRuns?, nextError?, method, revision?, verified?,
//               unattended?, scheduler?, methodText?, proof?, authority?}] (the chosen routine's show adds its next runs, its Method's text,
//               its proof and its authority); methods [{method, name, text, active}]; timers [{name, provider, adopted, reason?, when?}];
//               history [{at, routine, outcome?, message?, delivery?, detail}]; options {proofs, triggers, authorities, profiles, scopes: [{ref,
//               title}], timezone?, permits?} for a new routine (RoutineAuthoringSource.options; permits: the chosen authority allows the
//               chosen trigger); grants and reproofs [{ref, title}] the authorities and verified runs the chosen routine may be enabled
//               and reproved on; pendingCreation a creation AIKit has not acknowledged yet; contexts [{ref, title}] the work contexts
//               routines are read in: this AIKit home, or a project (the routine op's `project`); `context` is the chosen one. new.from
//               names what opened the form (a pad's Make routine, §19.22): this page is the one place a run is given a time.
// Appearance:   theme {saved, revision?, observations?} (presentation_read: light | dark | system, or a library theme's id; its revision and
//               the renderers' advisory observations); themes [{id, name}] the library; imported [{id, name}]; visualLayer, welcome (the
//               renderer's retained store). The theme you choose is the row `oi:presentation:theme` among `settings`, a local change
//               draft:oi:presentation:theme, planned and applied through the presentation owner by Review changes… (O-I #744).
// Products:     products [{id, version?, state, reason?, about?, actions: [{ref, title, runnable, why?}], observed?, digest?,
//               degraded: [{subject, state, reason}], obligations: [text]}] (system_composition_read); ran {product, title, ok, at?, rows?}.
// System:       system [{id, version?, digest?, observed?, contract?, settings: [{section, key, title, mutable, path?, drift: {state,
//               between?}, declared?, effective?, active?, staged?}]}]  each owner's System settings disclosure
//               (oi.product-settings-disclosure/v2 through system_composition_read; `ctrl system --json` for Central).
//
// Settings the shell holds: search, hit (the result ↑/↓ marked), scope, focus (the setting a contextual entry or a press opened), details
//   (the setting whose Details are open), show (Automations: routines | methods | timers | history), context (Automations' work context),
//   routine, product, owner (System's owner), axes ('disclosure' | 'configuration'), adding (the open form: machine | credential |
//   routine | profile), rotating (the credential whose reference you replace), new.* (the open form's fields; new.expects and new.scopes
//   are JSON lists), chatDefault (a provider chosen, not yet applied), Setup's choices, and a local change for each setting
//   as draft:<ref> (a JSON string for a list or a table); setting draft:<ref> to nothing is its Undo.
// Acts, each on its own key, with their owners:
//   plan (config_plan_reviewed) · apply (config_apply_reviewed) · reset <ref> (config_reset) · keep <ref> (re-bases a draft on the
//   current reading) · discard (drops every local change) · returnToWork (the work Settings was opened from) · reread (every owner read
//   again) · applyDefault, restoreDefault (HarnessSource) · install <client> (client_install) · reveal <client> (settings_reveal) ·
//   signIn <client> (the conversation's connection control, harness_auth_describe) · discover (credential_discover) · verify
//   <credential> (credential_verify) · rotate <credential> with new.reference (credential_rotate) · revoke <credential>
//   (credential_revoke) · bind with new.credential, new.reference (credential_setup) · useProfile <ref> (profile_use_plan: stages its
//   settings as local changes) · saveProfile with new.name (profile_create, profile_edit) · importProfile (the shell's file picker,
//   then the same) · runNow <ref>, disableRoutine <ref> (kernel `routine`) · revertTheme (theme_revert) ·
//   removeTheme <id> (theme_remove) · importTheme (file picker, then theme_import) · openExpressions (the Expressions editor, where
//   scene, glyph, material and musical controls stay) · run <product>:<action> (product_action_run): all exist.
//   enterKey <credential>: a write-only key goes to the native host's own secure field, never through these values; it stands
//   disabled until the host qualifies its credential capability (SettingsAdapter.canEnterCredentialMaterial).
//   scan (`workcell secret scan`) · revokeProjection <name> (`workcell secret revoke-projection`): no kernel route.
//   addMachine with new.label, new.endpoint, new.credential, new.expects, new.note (`workcell machine add`) · connect <label>
//   (`workcell connect --connection`) · disconnect <label> (`workcell connections disconnect`) · removeMachine <label> (`workcell
//   machine remove`): RemoteMachinesSource over workcell_read and workcell_write.
//   enableRoutine <ref> with new.grant, reprove <ref> with new.reproof, createRoutine (new.name, new.description, new.method,
//   new.proof, new.trigger — a new schedule with new.repeat and new.schedule — new.authority, new.profile, new.scopes), checkCreation (a
//   waiting creation read back, never sent again): RoutineAuthoringSource.
//   acceptStep <step> (held): Ground is native oi's reviewed plan for Central's ground (setup plan, then apply with its review token),
//   read back by setup discover. For Projects, previewStep 'projects' (Preview: Central's projectcentral.adopt.preview or
//   migrate.preview, read into `setupPlan`; Create's plan is Central's inspection) and acceptStep 'projects' with folder, make and
//   wiki: Central's projectcentral.init, adopt or migrate, read back by projectcentral.inspect; in a world Setup founded the same Accept
//   extends the person's grant to it (central.ground.project.adopt) and makes Factory's placement (factory_owner project-setup), and a
//   made project either is left without offers Finish (make 'finish'), whose Accept does only that. A folder that stands elsewhere under
//   the world's folder (Central's work.candidates, place elsewhere) comes Into Work first: Preview is Central's work.bring.preview,
//   Accept its work.bring on that preview's digest, read back by work.list, the original kept; Central keeps a project in its Work, so
//   Where it stands refuses for it. Machines: acceptStep 'machines' is Central's machine.adopt-current binding its current machine
//   to the Workcell this computer answers as (Workcell's status), read back by machine.declaration. Harnesses and skills:
//   acceptStep 'harnesses' adopts each skill root AIKit reads as foreign through AIKit's own plan (`aikit adopt ROOT --namespace
//   LABEL`, then `--yes --expect-digest` on its review digest), read back by `aikit init` as adopted; the tool reads its skills where
//   they were. Credentials: acceptStep 'credentials' with credential and reference binds that key by reference (`aikit credential
//   setup --ref`), read back by `aikit credential list`; a reference that names no store is refused before anything is sent.
//   rereadSetup (setup discover, then AIKit, Workcell, Central's machine, Work and the folders elsewhere) exists. The binding:
//   settings/windowPages.ts SetupWalk.
//   The host stands each act without an owner disabled, with that reason. A press that turns the page is a click inside the window,
//   which reads the page it turned to.
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

/** The pages, in the window's order, each with the category the shell files settings under (settings/model.ts categories) and the words
 * search finds it by beyond its name (the window's page results). A page marked `contributed` shows only when an owner contributes a
 * setting to it, as in the shell. */
const PAGES = [
  {id: 'setup', label: 'Setup', category: 'setup', group: '', words: 'bring in adopt ground harnesses credentials machines projects first'},
  {id: 'harnesses', label: 'Harnesses & models', category: 'agents', group: 'Preferences', words: 'chat conversation provider default model harness client install sign in'},
  {id: 'skills', label: 'Skills & methods', category: 'skills', group: 'Preferences', contributed: true, words: 'skill sets capabilities methods'},
  {id: 'profiles', label: 'Profiles', category: 'profiles', group: 'Preferences', words: 'profile named settings use import'},
  {id: 'permissions', label: 'Permissions', category: 'permissions', group: 'Preferences', contributed: true, words: 'permission mode access policy'},
  {id: 'credentials', label: 'Credentials', category: 'connections', group: 'Preferences', words: 'api key credential provider secret reference verify rotate revoke'},
  {id: 'machines', label: 'Machines & services', category: 'execution', group: 'Preferences', words: 'remote machine environment workcell endpoint connection execution start work services'},
  {id: 'automations', label: 'Automations', category: 'automations', group: 'Preferences', words: 'automation routine cron schedule timer event subscribe subscription remote agent background history'},
  {id: 'telemetry', label: 'Search & telemetry', category: 'telemetry', group: 'Preferences', contributed: true, words: 'search limit watch interval telemetry'},
  {id: 'library', label: 'Sources & libraries', category: 'library', group: 'Preferences', contributed: true, words: 'source library register binding project'},
  {id: 'appearance', label: 'Appearance', category: 'appearance', group: 'Preferences', words: 'theme light dark system visual welcome'},
  {id: 'products', label: 'Products & updates', category: 'products', group: 'System', words: 'install installed products extensions update updates version maintenance service'},
  {id: 'system', label: 'System', category: 'inspection', group: 'System', words: 'axes declared effective active staged drift configuration'},
] as const
type PageId = typeof PAGES[number]['id'] | 'review'
const pageOf = (p: ViewProps): PageId => (p.page === 'review' || PAGES.some(x => x.id === p.page) ? p.page as PageId : 'setup')
const pageOfCategory = (c: string): PageId => PAGES.find(x => x.category === c)?.id ?? 'system'

const OWNER: Readonly<Record<string, string>> = {'ai-kit': 'AIKit', 'software-factory': 'Factory', central: 'Central', oi: 'O:I', 'quaternal-logic': 'Quaternal Logic',
  workcell: 'Workcell', actuation: 'Actuation'}
const ownerWord = (o: string | undefined) => (o ? OWNER[o] ?? o : NONE)
const TIMING: Readonly<Record<string, string>> = {'value-change': 'next resolution', 'restart-required': 'restart', 'session-restart-required': 'new sessions',
  'provider-reconnect-required': 'reconnect', 'material-effect': 'material change', none: 'read only', pending: 'pending', unknown: NONE}

// ---------------------------------------------------------------- the owners' settings, as rows

interface Choice {readonly value: string; readonly title: string}
interface Column {readonly name: string; readonly type: string}
interface Cell {readonly choices?: readonly Choice[]; readonly why?: string}
interface Setting {
  readonly ref: string; readonly category: string; readonly owner?: string; readonly section?: string; readonly title: string; readonly kind: string
  readonly options?: readonly Choice[]; readonly columns?: readonly Column[]; readonly rows?: readonly Rec[]; readonly effective?: Value
  readonly from?: string; readonly timing?: string; readonly writable: boolean; readonly range?: string; readonly hint?: string
  readonly help?: string; readonly effect?: string; readonly at?: string; readonly words?: string; readonly details?: Readonly<Record<string, string>>
  readonly cells?: readonly Readonly<Record<string, Cell>>[]; readonly clears?: Readonly<Record<string, readonly string[]>>; readonly fixed: boolean
}
const choicesOf = (x: unknown): Choice[] => (Array.isArray(x) ? x.flatMap(o => (typeof o === 'string' ? [{value: o, title: o}] : rec(o) && typeof o.value === 'string' ? [{value: o.value, title: txt(o.title) ?? o.value}] : [])) : [])
function settingsOf(v: V): Setting[] | undefined {
  const raw = list(v, 'settings')
  return raw?.flatMap(s => (txt(s.ref) && txt(s.title) ? [{
    ref: s.ref as string, category: txt(s.category) ?? 'inspection', owner: txt(s.owner), section: txt(s.section), title: s.title as string, kind: txt(s.kind) ?? 'text',
    options: choicesOf(s.options), columns: Array.isArray(s.columns) ? s.columns.filter(rec).flatMap(c => (txt(c.name) ? [{name: c.name as string, type: txt(c.type) ?? 'text'}] : [])) : undefined,
    rows: Array.isArray(s.rows) ? s.rows.filter(rec) : undefined,
    effective: typeof s.effective === 'string' || typeof s.effective === 'number' || typeof s.effective === 'boolean' ? s.effective : undefined,
    from: txt(s.from), timing: txt(s.timing), writable: s.writable === true, range: txt(s.range), hint: txt(s.hint), help: txt(s.help), effect: txt(s.effect), at: txt(s.at),
    words: txt(s.words), details: rec(s.details) ? Object.fromEntries(Object.entries(s.details).flatMap(([k, x]) => (typeof x === 'string' ? [[k, x]] : []))) : undefined,
    cells: Array.isArray(s.cells) ? s.cells.map(c => (rec(c) ? Object.fromEntries(Object.entries(c).flatMap(([k, x]) => (rec(x) ? [[k, {choices: Array.isArray(x.choices) ? choicesOf(x.choices) : undefined, why: txt(x.why)}]] : []))) : {})) : undefined,
    clears: rec(s.clears) ? Object.fromEntries(Object.entries(s.clears).map(([k, x]) => [k, strs(x)])) : undefined, fixed: s.fixed === true}] : []))
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
/** What a setting does and when a change applies, in its owner's words: said on the Info line from its name (the help aside's place). */
const helpOf = (s: Setting) => `${s.title}|${s.help ?? 'Its owner gives no description.'} When it applies: ${TIMING[s.timing ?? 'unknown'] ?? s.timing}.${s.effect ? ` ${s.effect}` : ''}`

/** The widths of a table's columns (px; undefined takes what is left): a table keeps to the page's width. */
const Cols = ({w}: {w: readonly (number | undefined)[]}) => <colgroup>{w.map((x, i) => <col key={i} style={x === undefined ? undefined : {width: x}} />)}</colgroup>

/** A page of a long list, with ‹ › to turn it: nothing in the window scrolls. `follow`: the item a key marked, whose page is shown. */
function usePaged<T>(items: readonly T[], size: number, follow?: number): [readonly T[], ReactNode, number] {
  const [at, setAt] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / size)), page = Math.min(follow !== undefined ? Math.floor(follow / size) : at, pages - 1)
  const pager = pages > 1 ? <span className="st-pager" data-i={`Pages|${items.length} in all. ‹ and › turn the page.`}>
    <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setAt(page - 1)}>‹</button>{page + 1} / {pages}
    <button type="button" aria-label="Next page" disabled={page === pages - 1} onClick={() => setAt(page + 1)}>›</button></span> : null
  return [items.slice(page * size, page * size + size), pager, page * size]
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
  if (!s.writable) return <span className="st-plain">{now === undefined ? NONE : s.kind === 'choice' ? s.options?.find(o => o.value === String(now))?.title ?? String(now) : String(now)}</span>
  if (s.kind === 'toggle') return <Toggle {...st(p, key)} label={now === true ? 'On' : 'Off'} does={s.title} on={now === true} unknown={now === undefined} onChange={edit} />
  if (s.kind === 'choice') return <Chooser {...st(p, key)} does={s.title} value={now === undefined ? '' : String(now)} options={(s.options ?? []).map(o => ({value: o.value, label: o.title}))} onChange={edit}
    {...(s.options?.length ? {} : {disabled: 'The owner has not supplied the allowed values.'})} />
  return <span className="st-field">
    <TextField {...st(p, key)} does={`${s.title}${s.range ? `: ${s.range}` : ''}.`} value={now === undefined ? '' : String(now)} placeholder={now === undefined ? s.hint ?? NONE : s.hint}
      onChange={x => edit?.(s.kind === 'number' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : x)} />
    {s.kind === 'path' && <Action {...st(p, `pick:${s.ref}`)} label="Choose…" does="Choose a file or folder with the system's own picker." onPress={() => p.set(`pick:${s.ref}`, true)} />}
  </span>
}

/** A table or list setting's entries, under its row: each column a control — the owner's choices for this entry where it gives them, a
 * dependent column closed with why where it gives none — × to take an entry out, + to add one; a record keeps its one entry. A changed
 * harness drops the columns it chose for (controls.tsx: a dependent selection is never carried to another harness). */
function Entries({p, s}: {p: ViewProps; s: Setting}) {
  const rows = rowsOf(p.v, s), cols = s.columns?.length ? s.columns : [{name: 'item', type: 'text'}]
  const write = (next: Rec[]) => p.set(draftKey(s.ref), JSON.stringify(s.columns?.length ? next : next.map(r => r.item)))
  const cell = (r: Rec, i: number, c: Column) => {
    const at = r[c.name], owned = s.cells?.[i]?.[c.name]
    const set = (x: unknown) => write(rows.map((row, j) => (j === i ? {...row, [c.name]: x, ...Object.fromEntries((s.clears?.[c.name] ?? []).filter(d => d in row).map(d => [d, '']))} : row)))
    if (!s.writable) return <span className="st-plain">{at === undefined ? NONE : typeof at === 'object' ? JSON.stringify(at) : String(at)}</span>
    if (c.type === 'boolean') return <Toggle label={at === true ? 'On' : 'Off'} on={at === true} onChange={set} />
    if (owned?.choices?.length) return <Chooser does={c.name} value={String(at ?? '')} options={owned.choices.map(o => ({value: o.value, label: o.title}))} onChange={set} />
    if (owned?.why) return <Chooser does={c.name} value={String(at ?? '')} options={[]} disabled={owned.why} />
    if (c.type === 'list' || c.type === 'table') return <TextField does={`${c.name}: a ${c.type} as JSON.`} value={typeof at === 'string' ? at : JSON.stringify(at ?? (c.type === 'list' ? [] : {}))}
      onChange={x => { try { set(JSON.parse(x)) } catch { set(x) } }} />
    return <TextField does={c.name} value={at === undefined ? '' : String(at)} onChange={set} />
  }
  const grid = {gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr)) 18px`}
  return <tr className="st-sub"><td /><td colSpan={4}>
    <div className="st-entries" style={grid}>
      {cols.map(c => <span key={c.name} className="st-entries-head">{c.name}</span>)}<span />
      {rows.map((r, i) => [...cols.map(c => <span key={`${i}:${c.name}`}>{cell(r, i, c)}</span>),
        <span key={`${i}:x`}>{s.writable && !s.fixed && <button type="button" className="st-x" aria-label={`Take out entry ${i + 1}`} data-i="Take out|Takes this entry out of your local change."
          onClick={() => write(rows.filter((_, j) => j !== i))}>×</button>}</span>])}
    </div>
    {!rows.length && <span className="st-none">No entries at this scope.</span>}
    {s.writable && !s.fixed && <button type="button" className="st-link" onClick={() => write([...rows, Object.fromEntries(cols.map(c => [c.name, c.type === 'boolean' ? true : '']))])}>+ Add entry</button>}
  </td></tr>
}

/** A setting's Details, under its row (the old row's Details panel): the owner's identity and where it keeps the value, your preference,
 * the owner's axes, your change, the default, the reconciliation and the reading basis it was read on, and an owner's connection that is
 * out, each in words. */
const DETAILS: readonly (readonly [string, string])[] = [['identity', 'Identity'], ['where', 'Where'], ['desired', 'Your preference'], ['declared', 'Declared here'],
  ['effective', 'Effective'], ['active', 'Active'], ['staged', 'Staged'], ['proposed', 'Your change'], ['default', 'Default'], ['reconciliation', 'Reconciliation'],
  ['basis', 'Reading basis'], ['connection', 'Connection']]
function Details({s}: {s: Setting}) {
  const d = s.details ?? {}
  return <tr className="st-sub"><td colSpan={5}>
    <dl className="st-details" aria-label={`${s.title}: details`}>{DETAILS.filter(([k]) => d[k] !== undefined).map(([k, label]) => <div key={k}>
      <dt>{label}</dt><dd className={k === 'identity' || k === 'basis' ? 'st-ref' : undefined} data-i={`${label}|${d[k]}${k === 'effective' && d.provenance ? ` · ${d.provenance}` : ''}`}>
        {d[k]}{k === 'effective' && d.provenance ? <small>{d.provenance}</small> : null}</dd></div>)}
      {!s.details && <span className="st-none">No reading of its details.</span>}
    </dl>
  </td></tr>
}

/** The owners' settings filed under a category: the setting and its owner, its value, where the value comes from, when a change
 * applies; Undo where you changed it, Keep where the owner's reading moved under your change, Reset where this scope overrides it.
 * The setting's name opens its Details. Writable first; the read-only beneath them. Applies to stands at the head. */
function OwnerRows({p, category, size, title, children}: {p: ViewProps; category: string; size: number; title?: string; children?: ReactNode}) {
  const all = settingsOf(p.v), mine = (all ?? []).filter(s => s.category === category).sort((a, b) => Number(b.writable) - Number(a.writable))
  const conflicts = conflictsOf(p.v), focus = strOf(p.v, 'focus'), open = strOf(p.v, 'details'), here = pageScope(p.v, category)
  const [shown, pager] = usePaged(mine, size)
  if (all !== undefined && !mine.length && !children) return null
  return <section className="st-sec">
    <h4>{title ?? 'Owner settings'}<small>{all === undefined ? 'no reading of the owners\' settings' : `${mine.length} at ${scopeTitle(here)}`}</small>{pager}
      {all !== undefined && mine.length > 0 && <span className="st-head-acts st-head-scope"><ScopeBar p={p} category={category} /></span>}</h4>
    {children}
    {all === undefined || !mine.length ? null : <table className="st-tbl">
      <Cols w={[undefined, 176, 64, 88, 132]} />
      <thead><tr><th>Setting</th><th>Value</th><th>From</th><th>Applies</th><th /></tr></thead>
      <tbody>{shown.map(s => {
        const draft = has(p.v, draftKey(s.ref)), conflict = conflicts.includes(s.ref)
        return [<tr key={s.ref} data-draft={draft ? 'true' : undefined} data-focus={focus === s.ref ? 'true' : undefined} data-read={s.writable ? undefined : 'true'}>
          <td><button type="button" className="st-link st-name" aria-expanded={open === s.ref} data-i={helpOf(s)} onClick={() => p.set('details', open === s.ref ? undefined : s.ref)}>
            <b>{s.title}</b></button><small>{ownerWord(s.owner)}{s.section ? ` · ${s.section}` : ''}{s.at && s.at !== scopeTitle(here) ? ` · ${s.at}` : ''}</small></td>
          <td><ValueCell p={p} s={s} /></td>
          <td data-i={`From|${s.from === 'here' ? 'This scope overrides the value.' : s.from === 'inherited' ? 'The owner resolves it from a wider scope or its default.' : 'Not read yet.'}`}>
            {s.from === 'here' ? 'this scope' : s.from === 'inherited' ? 'inherited' : NONE}</td>
          <td data-i={s.effect ? `Applies|${s.effect}` : undefined}>{TIMING[s.timing ?? 'unknown'] ?? s.timing}</td>
          <td className="st-acts">
            {conflict && <Action {...st(p, 'keep')} label="Keep" does="The owner's reading changed since your change. Keep your change on the current reading." onPress={() => p.set('keep', s.ref)} />}
            {draft && <Action label="Undo" does="Drops your change of this setting. Nothing was written." onPress={() => p.set(draftKey(s.ref), undefined)} />}
            {s.from === 'here' && s.writable && <Action {...st(p, 'reset')} hold label="Reset" does="The owner removes this scope's override and resolves the value again." onPress={() => p.set('reset', s.ref)} />}
          </td>
        </tr>, open === s.ref ? <Details key={`${s.ref}:details`} s={s} /> : null,
        focus === s.ref && (s.kind === 'table' || s.kind === 'list') ? <Entries key={`${s.ref}:rows`} p={p} s={s} /> : null]
      })}</tbody>
    </table>}
  </section>
}

const scopeTitle = (s: Rec | null) => (s ? txt(s.title) ?? (txt(s.ref) ? `${s.kind} · ${s.ref}` : txt(s.kind) ?? NONE) : NONE)
/** The scope a page's settings stand at (pageScopes), else the one most settings stand at. */
const pageScope = (v: V, category: string): Rec | null => { const pages = json<Rec>(v, 'pageScopes', {}); return rec(pages[category]) ? pages[category] as Rec : json<Rec | null>(v, 'scope', null) }
function ScopeBar({p, category}: {p: ViewProps; category: string}) {
  const scopes = list(p.v, 'scopes') ?? [], now = pageScope(p.v, category)
  const opt = (s: Rec) => `${txt(s.kind) ?? ''}|${txt(s.ref) ?? ''}`
  return <Chooser {...st(p, 'scope')} label="Applies to" does="The scope this page's settings are read and changed at: this machine, a world, a project or a workcell. A setting that does not allow it stays where it is."
    value={now ? opt(now) : ''} options={scopes.map(s => ({value: opt(s), label: txt(s.title) ?? opt(s)}))}
    onChange={x => { const s = scopes.find(c => opt(c) === x); if (s) p.set('scope', JSON.stringify({...s, category})) }} />
}

// ---------------------------------------------------------------- Setup (manual §10.11)

/** Setup's five steps, in order, each with the owner whose Accept makes its change and the page you come back to it on. */
const STEPS = [
  {id: 'ground', label: 'Ground', owner: 'Central', back: 'Setup'},
  {id: 'harnesses', label: 'Harnesses and skills', owner: 'AIKit', back: 'Harnesses & models, Skills & methods'},
  {id: 'credentials', label: 'Credentials', owner: 'AIKit', back: 'Credentials'},
  {id: 'machines', label: 'Machines', owner: 'Workcell', back: 'Machines & services'},
  {id: 'projects', label: 'Projects', owner: 'Central', back: 'the browser\'s Work place'},
] as const
type StepId = typeof STEPS[number]['id']
const STEP_LIGHT: Readonly<Record<string, LightState>> = {accepted: 'lit', found: 'dark'}

/** What the Projects step found in a folder, and what each choice of Make does there (manual §10.11, The Projects step). */
const FINDS: Readonly<Record<string, string>> = {none: 'no wiki', one: 'one wiki', many: 'wikis', unreadable: 'cannot be read', ground: 'ground in place'}
function makeOptions(f: Rec | undefined, wiki: string | undefined): Option<string>[] {
  const finds = txt(f?.finds), many = finds === 'many' && !wiki
  const closed = finds === 'unreadable' ? 'Its ProjectCentral cannot be read. Mend its manifest by hand.' : finds === 'ground' ? 'Its ground is in place: nothing to make.' : undefined
  // A made project its making left unfinished (your key and bounds not reaching it, or Factory not keeping its runs and pads): Finish.
  const finish = finds === 'ground' && strs(f?.left).length
    ? [{value: 'finish', label: 'Finish', does: 'Accept finishes what making it left: you act as you in it and its agents may write inside it, and Factory keeps its runs and pads.'}] : []
  return [...finish,
    {value: 'create', label: 'Create', does: 'ProjectCentral is made round the folder. Nothing in the folder moves.',
      why: closed ?? (finds === 'none' ? undefined : 'The folder keeps a wiki: keep it in place or copy it in.')},
    {value: 'keep', label: 'Keep in place', does: 'The wiki stays where it is and joins the world\'s wiki as one of its sources.',
      why: closed ?? (finds === 'none' ? 'The folder keeps no wiki.' : many ? 'Choose the wiki first.' : undefined)},
    {value: 'copy', label: 'Copy in', does: 'The wiki is copied into ProjectCentral. The original stays where it was.',
      why: closed ?? (finds === 'none' ? 'The folder keeps no wiki.' : many ? 'Choose the wiki first.' : undefined)},
  ]
}

/** The folder as setup reads it: its own material at the left, ProjectCentral at the right, each part dashed where Accept would make
 * it. A wiki the folder keeps is marked; Keep in place joins it to the world's wiki as a source, Copy in copies it across. */
const PC_PARTS = ['user', 'agents', 'wiki', 'now'] as const
function ProjectDrawing({f, make, wiki, where}: {f: Rec; make: string | undefined; wiki: string | undefined; where: string}) {
  const W = 372, H = 150, material = strs(f.material).slice(0, 6), wikis = strs(f.wikis), present = strs(f.central), finds = txt(f.finds)
  const chosenWiki = wikis.length === 1 ? wikis[0] : wiki
  const moved = where === 'work' && txt(f.place) !== 'work'
  const makes = finds !== 'unreadable' && finds !== 'ground'
  const rowY = (i: number) => 44 + i * 16, partY = (i: number) => 38 + i * 26
  const wikiRow = chosenWiki ? material.findIndex(m => chosenWiki === m || chosenWiki.startsWith(`${m}/`)) : -1
  return <svg className="st-draw" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
    aria-label={`${txt(f.title) ?? 'The folder'} and its ProjectCentral: ${makes ? 'the dashed parts would be made' : FINDS[finds ?? ''] ?? 'not read'}`}>
    <rect x={6} y={18} width={168} height={H - 24} rx={3} className="st-box" data-make={moved ? 'true' : undefined} />
    <text x={14} y={32} className="st-draw-title">{moved ? `Work/${txt(f.title) ?? ''}` : txt(f.title) ?? NONE}</text>
    <text x={6} y={12} className="st-draw-faint">{moved ? `copied from ${txt(f.path) ?? NONE}` : txt(f.path) ?? NONE}</text>
    {material.map((m, i) => <g key={m}>
      <rect x={14} y={rowY(i) - 9} width={7} height={9} className="st-file" data-wiki={wikis.some(w => w === m || w.startsWith(`${m}/`)) ? 'true' : undefined} />
      <text x={26} y={rowY(i)} className={i === wikiRow ? 'st-draw-wiki' : undefined}>{m}</text>
    </g>)}
    <rect x={198} y={18} width={168} height={H - 24} rx={3} className="st-box" data-make={makes && !present.length ? 'true' : undefined} data-bad={finds === 'unreadable' ? 'true' : undefined} />
    <text x={206} y={32} className="st-draw-title">ProjectCentral</text>
    {finds === 'unreadable' && <text x={360} y={32} textAnchor="end" className="st-draw-bad">manifest unreadable</text>}
    {PC_PARTS.map((part, i) => {
      const here = present.includes(part), made = !here && makes
      return <g key={part}>
        <rect x={210} y={partY(i)} width={144} height={18} rx={2} className="st-part" data-make={made ? 'true' : undefined} data-absent={!here && !made ? 'true' : undefined} />
        <text x={218} y={partY(i) + 12.5}>{part}{part === 'wiki' && make === 'keep' && chosenWiki ? ' · source in place' : part === 'wiki' && make === 'copy' && chosenWiki ? ' · copied in' : ''}</text>
      </g>
    })}
    {makes && wikiRow >= 0 && (make === 'keep' || make === 'copy') && <path d={`M${26 + Math.min(110, material[wikiRow]!.length * 5.6) + 6} ${rowY(wikiRow) - 3}C 190 ${rowY(wikiRow) - 3} 190 ${partY(2) + 9} 210 ${partY(2) + 9}`}
      className={make === 'copy' ? 'st-draw-copy' : 'st-draw-link'} />}
  </svg>
}

/** Why Make is closed for a folder that stands elsewhere: it comes into Work first (work.bring), and what to make of it is chosen there. */
const BRING_FIRST = 'It comes into Work first; choose what to make of it there.'
function ProjectsStep({p}: {p: ViewProps}) {
  const v = p.v, folders = list(v, 'folders'), folder = folders?.find(f => f.path === strOf(v, 'folder')) ?? folders?.[0]
  const wikis = strs(folder?.wikis), wiki = strOf(v, 'wiki'), where = strOf(v, 'where') ?? (txt(folder?.place) === 'elsewhere' ? 'work' : 'stands')
  // A folder elsewhere is brought Into Work as it is: the preview and Accept are the bring's, and Make waits until it stands in Work.
  const bring = txt(folder?.place) === 'elsewhere' && where === 'work'
  const options = bring ? makeOptions(folder, undefined).map(o => ({...o, why: BRING_FIRST})) : makeOptions(folder, wikis.length > 1 ? wiki : wikis[0]), make = bring ? undefined : strOf(v, 'make')
  const open = bring ? {value: 'bring'} : options.find(o => o.value === make && !o.why)
  const plan = has(v, 'setupPlan') ? strs(json<unknown>(v, 'setupPlan', [])) : undefined
  const [shown, pager] = usePaged(folders ?? [], 5)
  return <div className="st-cols st-cols--setup">
    <div>
      <table className="st-tbl">
        <Cols w={[undefined, 62, 108]} />
        <thead><tr><th>Folder {pager}</th><th>Where</th><th>Central finds</th></tr></thead>
        <tbody>{folders === undefined ? <tr><td colSpan={3} className="st-none">No reading of your folders.</td></tr>
          : folders.length === 0 ? <tr><td colSpan={3} className="st-none">No folder of work was found.</td></tr>
          : shown.map(f => {
            const path = txt(f.path) ?? '', finds = txt(f.finds)
            return <tr key={path} className="st-pick" data-focus={folder?.path === path ? 'true' : undefined} data-read={finds === 'ground' ? 'true' : undefined}
              onClick={() => { p.set('folder', path); p.set('make', undefined); p.set('wiki', undefined); p.set('setupPlan', undefined) }}>
              <td data-i={`${txt(f.title) ?? path}|${path}`}><b>{txt(f.title) ?? path}</b></td>
              <td>{txt(f.place) === 'work' ? 'Work' : txt(f.place) ? 'elsewhere' : NONE}</td>
              <td><span data-st={finds === 'unreadable' ? 'stall' : finds === 'ground' ? (strs(f.left).length ? undefined : 'green') : undefined}>{finds === 'many' ? `${strs(f.wikis).length} wikis`
                : finds === 'ground' && strs(f.left).length ? 'ground in place, to finish' : FINDS[finds ?? ''] ?? NONE}</span></td>
            </tr>
          })}</tbody>
      </table>
      {plan && <ol className="st-plan" aria-label="Preview">{plan.length ? plan.map((s, i) => <li key={i}>{s}</li>) : <li className="st-none">Nothing to do.</li>}</ol>}
    </div>
    <div>
      {folder ? <ProjectDrawing f={folder} make={open ? make : undefined} wiki={wiki} where={where} /> : <span className="st-none">Choose a folder.</span>}
      <div className="st-form st-form--setup">
        <Radio {...st(p, 'where')} label="Where" does="Adopt the project where it stands, or move it into your ground's Work under its own name. A moved project's original stays until you remove it." value={where}
          options={[{value: 'stands', label: 'Where it stands'}, {value: 'work', label: 'Into Work', why: txt(folder?.place) === 'work' ? 'It stands in Work already.' : undefined}]}
          onChange={x => { p.set('where', x); p.set('setupPlan', undefined) }} />
        <Radio {...st(p, 'make')} label="Make" does="What Central makes of the folder's ground. A choice the folder does not allow stays closed and says why." value={make ?? ''}
          options={options} onChange={x => { p.set('make', x); p.set('setupPlan', undefined) }} />
        <Chooser {...st(p, 'wiki')} label="Wiki" does="The folder's wiki to keep or copy. Where the folder holds two, Central does not choose for you."
          value={wikis.length === 1 ? wikis[0]! : wiki ?? ''} options={wikis.map(w => ({value: w, label: w}))}
          onChange={wikis.length > 1 ? x => { p.set('wiki', x); p.set('setupPlan', undefined) } : undefined} disabled={wikis.length ? undefined : 'The folder keeps no wiki.'} />
        <Action {...st(p, 'previewStep')} label="Preview" does="Lists every step Central would take, in order. Nothing changes." onPress={() => p.set('previewStep', 'projects')}
          disabled={open ? undefined : 'Choose what to make first.'} />
        <Action {...st(p, 'acceptStep')} hold label="Accept" does="Makes the world's ground as previewed." onPress={() => p.set('acceptStep', 'projects')}
          disabled={!open ? 'Choose what to make first.' : plan === undefined ? 'Preview first.' : undefined} />
      </div>
    </div>
  </div>
}

/** The Credentials step (manual §10.11): where each provider's key lies — the place, never the value — and the binding Accept makes: AIKit
 * binds the key you choose by the reference you give, where it lies in your secure store. The key itself never enters the window. */
function CredentialsStep({p, reading}: {p: ViewProps; reading: Rec | undefined}) {
  const v = p.v, items = Array.isArray(reading?.items) ? reading!.items.filter(rec) : undefined
  const open = items?.filter(r => txt(r.credential) && r.bound !== true && !txt(r.why)) ?? []
  const chosen = open.find(r => r.credential === strOf(v, 'credential'))?.credential ?? open[0]?.credential, reference = strOf(v, 'reference') ?? ''
  const [shown, pager] = usePaged(items ?? [], 7)
  return <>
    <table className="st-tbl">
      <Cols w={[150, 210, undefined]} />
      <thead><tr><th>Found {pager}</th><th>Where it lies</th><th>The binding Accept makes</th></tr></thead>
      <tbody>{items === undefined ? <tr><td colSpan={3} className="st-none">Not read yet.</td></tr>
        : items.length === 0 ? <tr><td colSpan={3} className="st-none">Nothing found.</td></tr>
        : shown.map((r, i) => {
          const id = txt(r.credential), pick = !!id && open.includes(r)
          return <tr key={i} className={pick ? 'st-pick' : undefined} data-focus={pick && id === chosen ? 'true' : undefined} data-read={txt(r.why) || r.bound === true ? 'true' : undefined}
            onClick={pick ? () => p.set('credential', id) : undefined}>
            <td><b>{txt(r.name) ?? NONE}</b>{txt(r.why) && <i className="st-why" data-i={`Left alone|${r.why}`}>!</i>}</td>
            <td className="st-ref">{txt(r.where) ?? NONE}</td>
            <td className="st-dim">{txt(r.why) ? 'left as it is' : txt(r.change) ?? NONE}</td>
          </tr>
        })}</tbody>
    </table>
    {txt(reading?.said) && <p className="st-note" data-i={`Credentials|${txt(reading?.said)}`}>{txt(reading?.said)}</p>}
    <div className="st-form">
      <Readout label="state" does="Found: Accept would bind the key chosen. Accepted: every key found is bound, or none waits." value={txt(reading?.state)} />
      <TextField label="Reference" does="Where the key lies in your secure store: op://, keychain://, pass:// or varlock://. Never the key itself." value={reference} placeholder="op://…"
        onChange={open.length ? x => p.set('reference', x) : undefined} />
      <Action {...st(p, 'acceptStep')} hold label="Accept" does="AIKit binds the key chosen by the reference you give. The value stays in your store: the window never shows it and never keeps it." onPress={() => p.set('acceptStep', 'credentials')}
        disabled={!open.length ? (txt(reading?.state) === 'accepted' ? 'Accepted.' : 'Nothing found to bring in.') : !reference ? 'Give where the key lies in your store first.' : undefined} />
    </div>
  </>
}

/** The Ground step's own controls (manual §10.11): for a ground still to make, the folder it goes in (typed, or the system's chooser) and the
 * name you give it, read by native oi before Accept; then Accept, held, which makes or adopts the ground and keeps its days as the row
 * says. A ground that stands with its days kept has nothing to accept. */
function GroundForm({p, reading, items}: {p: ViewProps; reading: Rec | undefined; items: Rec[]}) {
  const v = p.v, making = has(v, 'groundFolder') || has(v, 'groundName') || strOf(v, 'groundFolder') !== undefined
  const ground = items[0], kept = items.slice(1)
  const standing = txt(ground?.change)?.startsWith('Central keeps it here') === true
  // A ground that stands has something to accept while a row would be kept (its days, bounds or key); else the first reason why not.
  const disabled = txt(reading?.state) === 'accepted' ? 'Accepted.' : txt(ground?.why)
    ?? (standing ? (kept.some(r => r.adopts === true) ? undefined : kept.map(r => txt(r.why)).find(Boolean) ?? 'Accepted.') : undefined)
  return <div className="st-form st-form--setup">
    <Readout label="state" does="Found: Accept would make the changes above. Accepted: your ground stands and keeps your days." value={txt(reading?.state)} />
    {making && <>
      <TextField {...st(p, 'groundFolder')} label="Folder" does="The folder your ground goes in. Type its full path, or Choose… with the system's chooser." value={strOf(v, 'groundFolder') ?? ''} wide
        onChange={x => p.set('groundFolder', x)} />
      <Action {...st(p, 'chooseGroundFolder')} label="Choose…" does="Opens the system's folder chooser. Setup then reads the folder: nothing is made until you accept." onPress={() => p.set('chooseGroundFolder', true)} />
      <TextField {...st(p, 'groundName')} label="Name" does="The name you give your ground: the folder Central makes in the one chosen." value={strOf(v, 'groundName') ?? ''} onChange={x => p.set('groundName', x)} />
    </>}
    <Action {...st(p, 'acceptStep')} hold label="Accept" does="Central makes your ground here, or adopts the one it finds, and keeps your days, its bounds and your key as shown. Until you accept, nothing you have moves or changes." onPress={() => p.set('acceptStep', 'ground')}
      disabled={disabled} />
  </div>
}

/** Once the ground is made, your name and date of birth (manual §10.11, §24.6): the first layer of Nara's identity, kept in your ground by
 * the identity owner. Left, it stays absent until you give it; nothing is shown as missing. */
function BirthForm({p}: {p: ViewProps}) {
  const v = p.v, birth = json<Rec | null>(v, 'birth', null)
  if (!birth) return null
  const kept = txt(birth.state) === 'kept', name = strOf(v, 'birthName') ?? '', date = strOf(v, 'birthDate') ?? ''
  return <div className="st-form st-form--setup" role="group" aria-label="Your date of birth">
    {kept && <Readout label="kept" does="Your identity as your ground keeps it. Your Being page holds it by reference." value={`${txt(birth.name) ?? NONE} · ${txt(birth.date) ?? NONE}`} />}
    <TextField {...st(p, 'birthName')} label="Your name" does="Your name, kept with your date of birth: Nara's identity is kept under it." value={name} onChange={x => p.set('birthName', x)} />
    <TextField {...st(p, 'birthDate')} label="Date of birth" does="Year, month and day. The first layer of Nara's identity, so that you are represented in your world beside your projects." value={date}
      placeholder="YYYY-MM-DD" onChange={x => p.set('birthDate', x)} />
    <Action {...st(p, 'keepBirth')} hold label="Keep" does="Keeps your name and date of birth in your ground, as the Studio's Nara chain keeps your identity. A correction is a new revision of the same identity."
      onPress={() => p.set('keepBirth', true)} disabled={txt(birth.why) ?? (!name || !date ? 'Give your name and date of birth first, or leave them: nothing fills them in your place.' : undefined)} />
  </div>
}

/** What AIKit reads of each tool besides its skills (its disclosure): where its instructions and settings lie and the providers its
 * models reach; what it does not read is named and left alone. */
function HarnessTools({reading}: {reading: Rec | undefined}) {
  const tools = Array.isArray(reading?.tools) ? reading!.tools.filter(rec) : []
  if (!tools.length && !txt(reading?.disclosure)) return null
  return <table className="st-tbl" aria-label="Each tool's settings and instructions">
    <Cols w={[150, undefined, 160]} />
    <thead><tr><th>Tool</th><th>Instructions · settings</th><th>Models reach</th></tr></thead>
    <tbody>{tools.length === 0 ? <tr><td colSpan={3} className="st-none">{txt(reading?.disclosure) ?? NONE}</td></tr>
      : tools.map((t, i) => <tr key={i} data-read="true">
        <td><b>{txt(t.harness) ?? NONE}</b>{txt(t.unread) && <i className="st-why" data-i={`Left alone|${t.unread}`}>!</i>}</td>
        <td className="st-ref">{[...strs(t.instructions), ...strs(t.settings)].join(' · ') || NONE}</td>
        <td className="st-dim">{strs(t.models).join(', ') || NONE}</td>
      </tr>)}</tbody>
  </table>
}

function SetupPage({p}: {p: ViewProps}) {
  const v = p.v, steps = list(v, 'setup'), accepted = steps?.filter(s => s.state === 'accepted').length
  const at = (STEPS.find(s => s.id === strOf(v, 'setupStep'))?.id ?? STEPS.find(s => steps?.find(r => r.step === s.id)?.state !== 'accepted')?.id ?? 'ground') as StepId
  const step = STEPS.find(s => s.id === at)!, reading = steps?.find(s => s.step === at), items = Array.isArray(reading?.items) ? reading!.items.filter(rec) : undefined
  const [shown, pager] = usePaged(items ?? [], 9)
  return <section className="st-sec st-setup">
    <h4>Setup<small>{steps ? `${accepted} of ${STEPS.length} accepted` : 'your computer is not read yet'}</small>
      <span className="st-head-acts"><Action {...st(p, 'rereadSetup')} label="Read again" does="Reads your computer again. Nothing is made twice; what you accepted stays." onPress={() => p.set('rereadSetup', true)} /></span></h4>
    <nav className="st-steps" aria-label="Setup steps">{STEPS.map((s, i) => {
      const r = steps?.find(x => x.step === s.id)
      return <button key={s.id} type="button" aria-current={s.id === at ? 'step' : undefined}
        data-i={`${s.label}|${s.owner} makes this step's change. You come back to it in ${s.back}.`}
        onClick={() => { p.set('setupStep', s.id); p.set('setupPlan', undefined) }}>
        <Lamp state={steps ? STEP_LIGHT[txt(r?.state) ?? ''] ?? 'unknown' : 'unknown'} tone="green" /><i>{i + 1}</i>{s.label}</button>
    })}</nav>
    {at === 'projects' ? <ProjectsStep p={p} /> : at === 'credentials' ? <CredentialsStep p={p} reading={reading} /> : <>
      <table className="st-tbl">
        <Cols w={[150, 210, undefined]} />
        <thead><tr><th>Found {pager}</th><th>Where</th><th>The change Accept makes</th></tr></thead>
        <tbody>{items === undefined ? <tr><td colSpan={3} className="st-none">Not read yet.</td></tr>
          : items.length === 0 ? <tr><td colSpan={3} className="st-none">Nothing found.</td></tr>
          : shown.map((r, i) => <tr key={i} data-read={txt(r.why) ? 'true' : undefined}>
            <td><b>{txt(r.name) ?? NONE}</b>{txt(r.why) && <i className="st-why" data-i={`Left alone|${r.why}`}>!</i>}</td>
            <td className="st-ref">{txt(r.where) ?? NONE}</td>
            <td className="st-dim">{txt(r.why) ? 'left as it is' : txt(r.change) ?? NONE}</td>
          </tr>)}</tbody>
      </table>
      {txt(reading?.said) && <p className="st-note" data-i={`${step.label}|${txt(reading?.said)}`}>{txt(reading?.said)}</p>}
      {at === 'harnesses' && <HarnessTools reading={reading} />}
      {at === 'ground' ? <GroundForm p={p} reading={reading} items={items ?? []} /> : <div className="st-form">
        <Readout label="state" does="Found: Accept would make the changes above. Accepted: they are made, or there was nothing to bring in." value={txt(reading?.state)} />
        <Action {...st(p, 'acceptStep')} hold label="Accept" does={`${step.owner} makes the changes above. Until you accept, nothing you have moves or changes.`} onPress={() => p.set('acceptStep', at)}
          disabled={txt(reading?.state) === 'accepted' ? 'Accepted.' : items?.some(r => !txt(r.why)) ? undefined : 'Nothing found to bring in.'} />
      </div>}
      {at === 'ground' && <BirthForm p={p} />}
    </>}
  </section>
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
          <Action {...st(p, 'bind')} label="Bind" does="Sends the binding to the credential owner. Providers may need to reconnect." onPress={() => p.set('bind', strOf(v, 'new.credential') ?? true)} />
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
                <td className="st-dim" data-i={set.length ? `Settings in this profile|${set.map(s => `${txt(s.title) ?? txt(s.ref) ?? NONE}${txt(s.scope) ? ` · ${s.scope}` : ''} · ${s.secret === true ? 'secret reference only' : txt(s.value) ?? NONE}`).join('; ')}.` : undefined}>
                  {set.length ? `${set.length}: ${set.slice(0, 3).map(s => `${txt(s.title) ?? txt(s.ref)}${s.secret === true ? ' (reference)' : ''}`).join(', ')}${set.length > 3 ? '…' : ''}` : NONE}</td>
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
  const offered = has(v, 'operations') ? strs(json<unknown>(v, 'operations', [])) : undefined, expects = strs(json<unknown>(v, 'new.expects', []))
  const connOf = (label: string) => conns?.find(c => c.label === label)
  const loose = (conns ?? []).filter(c => !machines?.some(m => m.label === c.label))
  return <>
    <section className="st-sec">
      <h4>Remote machines<small>{strOf(v, 'workcell') ?? 'Workcell'} · Connect uses the saved reference and grants nothing on the remote machine</small>
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
                <td data-i={txt(m.note) ? `${label}|${m.note}` : undefined}><b>{label}</b><small>{txt(m.endpoint) ?? NONE}</small></td>
                <td className="st-ref">{txt(m.credential) ?? NONE}</td>
                <td data-i={`Expects|${strs(m.expects).join(', ') || 'nothing recorded'}`}>{strs(m.expects).length || NONE}</td>
                <td data-i={`${state ?? 'Connection'}|${[txt(c?.detail), c ? `Granted: ${strs(c.granted).join(', ') || 'nothing'}.` : undefined, txt(c?.expires) ? `The grant expires ${c!.expires}.` : undefined,
                  txt(c?.protocol) ? `Protocol ${c!.protocol}${txt(c?.remote) ? `, remote ${c!.remote}` : ''}.` : undefined, txt(c?.reconciled) ? `Reconciled ${c!.reconciled}.` : undefined].filter(Boolean).join(' ') || 'No connection receipt.'}`}>
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
          </div>
          <div className="st-form st-form--wrap" aria-label="Expected operations">
            <span className="st-form-label" data-i="Expects|What you expect this machine to offer, from the operations this workcell offers. Its remote grant decides what it may actually do.">Expects</span>
            {offered === undefined ? <span className="st-none">No reading of the operations this workcell offers.</span> : offered.length === 0 ? <span className="st-none">This workcell offers no operation.</span>
              : offered.map(op => <Toggle key={op} label={op} does={`Expect ${op} from this machine.`} on={expects.includes(op)}
                onChange={on => p.set('new.expects', JSON.stringify(on ? [...expects, op] : expects.filter(x => x !== op)))} />)}
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
/** A new schedule's repeat and what its field takes (ScheduleControl.tsx): AIKit prepares it when you create, on Central's civil time. */
const REPEAT: readonly Option<string>[] = [{value: 'daily', label: 'Daily'}, {value: 'every', label: 'Every interval'}, {value: 'once', label: 'Once'}, {value: 'cron', label: 'Advanced: cron'}]
const REPEAT_FIELD: Readonly<Record<string, readonly [string, string]>> = {daily: ['Time (24-hour)', 'hh:mm'], every: ['Interval (seconds)', 'Seconds'],
  once: ['Timestamp (RFC 3339)', 'YYYY-MM-DDThh:mm:ssZ'], cron: ['Cron expression', 'minute hour day month weekday']}
function AutomationsPage({p}: {p: ViewProps}) {
  const v = p.v, show = strOf(v, 'show') ?? 'routines', creating = strOf(v, 'adding') === 'routine'
  const routines = list(v, 'routines'), methods = list(v, 'methods'), timers = list(v, 'timers'), history = list(v, 'history')
  const chosen = routines?.find(r => r.ref === strOf(v, 'routine')), options = json<Rec | null>(v, 'options', null)
  const opts = (key: string, id: string) => (Array.isArray(options?.[key]) ? (options![key] as unknown[]).filter(rec).flatMap(o => (txt(o[id]) ? [{value: o[id] as string, label: txt(o.title) ?? o[id] as string}] : [])) : [])
  const refs = (key: string) => (list(v, key) ?? []).flatMap(o => (txt(o.ref) ? [{value: o.ref as string, label: txt(o.title) ?? o.ref as string}] : []))
  const pending = strOf(v, 'pendingCreation'), newSchedule = strOf(v, 'new.trigger') === 'new-schedule', repeat = strOf(v, 'new.repeat') ?? 'daily'
  const zone = txt(options?.timezone), scopes = strs(json<unknown>(v, 'new.scopes', [])), permits = options?.permits
  const [shown, pager] = usePaged(show === 'methods' ? methods ?? [] : show === 'timers' ? timers ?? [] : show === 'history' ? history ?? [] : routines ?? [], creating ? 3 : 6)
  const none = (what: string) => <tr><td colSpan={7} className="st-none">{what}</td></tr>
  return <>
    <section className="st-sec">
      <h4>Automations<small>AIKit · the one place a run is given a time · schedules keep Central's civil time</small>{pager}
        <span className="st-head-acts">
          <Action label="Create routine…" does="Makes a routine from a Method that has been run and verified. It starts as a Draft." onPress={() => p.set('adding', creating ? undefined : 'routine')} />
        </span></h4>
      <div className="st-line">
        <Chooser {...st(p, 'context')} label="Work context" does="The work context the routines are read and made in: this AIKit home, or a project. A routine you are making stays in its context."
          value={strOf(v, 'context') ?? ''} options={(list(v, 'contexts') ?? []).flatMap(c => (typeof c.ref === 'string' ? [{value: c.ref, label: txt(c.title) ?? c.ref}] : []))} onChange={x => p.set('context', x)}
          {...(creating ? {disabled: 'Finish or cancel the routine you are making: it stays in its work context.'} : {})} />
        <Radio {...st(p, 'show')} label="Show" does="What the page lists." value={show} options={SHOW_AUTO} onChange={x => p.set('show', x)} />
      </div>
      {creating && <div className="st-form st-form--grid">
        {has(v, 'new.from') && <Readout label="from" does="What opened this routine: the pad whose prompt it runs. Its time is given here, and nowhere else." value={strOf(v, 'new.from')} />}
        <TextField label="Name" does="The routine's name." value={strOf(v, 'new.name') ?? ''} onChange={x => p.set('new.name', x)} />
        <TextField label="Purpose" does="Optional: what the routine is for." value={strOf(v, 'new.description') ?? ''} onChange={x => p.set('new.description', x)} />
        <Chooser label="Method" does="An active Method with a verified run in this work context." value={strOf(v, 'new.method') ?? ''}
          options={(methods ?? []).flatMap(m => (txt(m.method) && m.active !== false ? [{value: m.method as string, label: txt(m.name) ?? m.method as string}] : []))}
          onChange={x => { p.set('new.method', x); for (const k of ['new.proof', 'new.trigger', 'new.authority', 'new.profile', 'new.scopes']) p.set(k, undefined) }} />
        <Chooser label="Verified run" does="The proof: a successful, verified run of that exact Method revision. If none is listed, run and verify the Method in its working context." value={strOf(v, 'new.proof') ?? ''} options={opts('proofs', 'ref')} onChange={x => p.set('new.proof', x)} />
        <Chooser label="When" does="A schedule Central's time policy admits, a new schedule, or an event its connector admits." value={strOf(v, 'new.trigger') ?? ''}
          options={[{value: 'new-schedule', label: 'New schedule…'}, ...opts('triggers', 'ref')]} onChange={x => p.set('new.trigger', x)} />
        {newSchedule && <>
          <Chooser label="Repeat" does="How the new schedule repeats." value={repeat} options={REPEAT} onChange={x => { p.set('new.repeat', x); p.set('new.schedule', undefined) }} />
          <TextField label={REPEAT_FIELD[repeat]?.[0] ?? 'Schedule'} placeholder={REPEAT_FIELD[repeat]?.[1]} value={strOf(v, 'new.schedule') ?? ''} onChange={x => p.set('new.schedule', x)}
            does={repeat === 'daily' || repeat === 'cron' ? `Uses Central's ${zone ?? 'current policy'} clock. The native owner resolves daylight-saving changes.` : repeat === 'every' ? 'Seconds, to the millisecond. The native interval is expressed in milliseconds.' : 'Include an explicit UTC offset. The browser\'s local clock is not used.'} />
        </>}
        <Chooser label="Authority" does="The authority receipt it runs under. Unattended work needs an unattended grant." value={strOf(v, 'new.authority') ?? ''} options={opts('authorities', 'ref')} onChange={x => p.set('new.authority', x)} />
        <Readout label="permits" does="Whether the chosen authority allows the chosen trigger. A routine is made as a Draft either way; enabling it needs a receipt that permits it."
          value={permits === true ? 'yes' : permits === false ? 'not yet' : undefined} tone={permits === false ? 'stall' : undefined} />
        <Chooser label="Agent profile" does="The AIKit profile it composes with, or none." value={strOf(v, 'new.profile') ?? ''} options={[{value: '', label: 'No override'}, ...opts('profiles', 'ref')]} onChange={x => p.set('new.profile', x)} />
        <span className="st-form-wide" aria-label="Context scopes"><span className="st-form-label" data-i="Context scopes|The context scopes the routine composes with.">Scopes</span>
          {opts('scopes', 'ref').length ? opts('scopes', 'ref').map(o => <Toggle key={o.value} label={o.label} does={`Compose with ${o.label}.`} on={scopes.includes(o.value)}
            onChange={on => p.set('new.scopes', JSON.stringify(on ? [...scopes, o.value] : scopes.filter(x => x !== o.value)))} />) : <span className="st-none">{options ? 'No context scope is offered.' : 'Choose a Method first.'}</span>}</span>
        <Action {...st(p, 'createRoutine')} label="Create" does="AIKit checks the Method revision and its verification, and keeps the routine as a Draft. Enabling it is a separate act." onPress={() => p.set('createRoutine', strOf(v, 'new.name') ?? true)} />
        {pending && <Action {...st(p, 'checkCreation')} label="Check result" does="Reads back the creation AIKit has not acknowledged yet. Nothing is sent again." onPress={() => p.set('checkCreation', true)} />}
        <Action label="Cancel" does="Creates nothing. A creation already sent goes on." onPress={() => p.set('adding', undefined)} />
        {pending && <p className="st-note st-form-wide" data-st="stall" data-i={`Waiting|${pending} Closing the form does not cancel the native operation.`}>{pending}</p>}
      </div>}
      <table className="st-tbl">
        {show === 'methods' ? <>
          <Cols w={[180, undefined, 60]} /><thead><tr><th>Method</th><th>What it does</th><th /></tr></thead>
          <tbody>{methods === undefined ? none('No reading of the Methods.') : methods.length === 0 ? none('No Method has a verified run here.') : shown.map(m => <tr key={txt(m.method) ?? ''} data-read={m.active === false ? 'true' : undefined}>
            <td data-i={`${txt(m.name) ?? NONE}|${txt(m.method) ?? NONE}`}><b>{txt(m.name) ?? txt(m.method) ?? NONE}</b></td><td className="st-dim" data-i={txt(m.text) ? `What it does|${m.text}` : undefined}>{txt(m.text) ?? NONE}</td>
            <td className="st-acts"><Action label="Use…" does="Starts a routine from this Method." disabled={m.active === false ? 'This Method is not active.' : undefined}
              onPress={() => { p.set('adding', 'routine'); p.set('new.method', txt(m.method)); p.set('show', 'routines') }} /></td></tr>)}</tbody>
        </> : show === 'timers' ? <>
          <Cols w={[undefined, 110, 80, 130]} /><thead><tr><th>Timer</th><th>Provider</th><th>When</th><th>Adopted</th></tr></thead>
          <tbody>{timers === undefined ? none('No reading of the harness timers.') : timers.length === 0 ? none('No harness timer was found.') : shown.map((t, i) => <tr key={i}>
            <td><b>{txt(t.name) ?? 'Unnamed timer'}</b></td><td>{txt(t.provider) ?? NONE}</td><td>{txt(t.when) ?? NONE}</td>
            <td data-i={txt(t.reason) ? `Adoption requirement|${t.reason}` : undefined}>{t.adopted === true ? 'as a routine' : t.adopted === false ? 'awaiting adoption' : NONE}</td></tr>)}</tbody>
        </> : show === 'history' ? <>
          <Cols w={[90, undefined, 90, 130]} /><thead><tr><th>At</th><th>Routine</th><th>Outcome</th><th>Delivery</th></tr></thead>
          <tbody>{history === undefined ? none('No reading of the run history.') : history.length === 0 ? none('No invocation has been admitted.') : shown.map((h, i) => <tr key={i}>
            <td>{txt(h.at) ?? NONE}</td><td data-i={txt(h.detail) ? `Invocation and deliveries|${h.detail}` : undefined}><b>{txt(h.routine) ?? NONE}</b></td>
            <td data-i={txt(h.message) ? `Outcome|${h.message}` : undefined}>{txt(h.outcome) ?? NONE}</td><td className="st-dim">{txt(h.delivery) ?? NONE}</td></tr>)}</tbody>
        </> : <>
          <Cols w={[undefined, 62, 100, 70, 150, 70]} /><thead><tr><th>Routine</th><th>State</th><th>When</th><th>Next</th><th>Method</th><th>Unattended</th></tr></thead>
          <tbody>{routines === undefined ? none('No reading of the routines.') : routines.length === 0 ? none('No routine in this AIKit home.') : shown.map(r => {
            const ref = txt(r.ref) ?? '', state = txt(r.state)
            return <tr key={ref} data-focus={chosen?.ref === ref ? 'true' : undefined} className="st-pick" onClick={() => p.set('routine', ref)}>
              <td><b>{txt(r.name) ?? ref}</b></td><td data-i={txt(r.scheduler) ? `Scheduler|${r.scheduler}` : undefined}><span data-st={state ? ROUTINE_TONE[state] : undefined}>{state ?? NONE}</span></td>
              <td>{txt(r.when) ?? NONE}</td>
              <td data-i={strs(r.nextRuns).length ? `Next runs|${strs(r.nextRuns).join(' · ')}` : txt(r.nextError) ? `Next runs|${r.nextError}` : undefined}>{txt(r.next) ?? NONE}</td>
              <td data-i={`Method|${[txt(r.methodText), txt(r.proof) ? `Proof ${r.proof}.` : undefined, txt(r.authority) ? `Authority ${r.authority}.` : undefined].filter(Boolean).join(' ') || 'Choose the routine to read its Method.'}`}>
                {txt(r.method) ?? NONE}{txt(r.revision) ? <small>@{r.revision as string}{r.verified === false ? ' · reprove' : ''}</small> : null}</td>
              <td>{r.unattended === true ? 'yes' : r.unattended === false ? 'no' : NONE}</td>
            </tr>
          })}</tbody>
        </>}
      </table>
      {show === 'routines' && chosen && <div className="st-form">
        <b className="st-chosen">{txt(chosen.name) ?? NONE}</b>
        {txt(chosen.state) !== 'enabled' && <Chooser label="Under" does="The current authority receipt it is enabled under." value={strOf(v, 'new.grant') ?? ''} options={refs('grants')} onChange={x => p.set('new.grant', x)}
          {...(txt(chosen.state) === 'stale-proof' ? {disabled: 'Reprove its Method first.'} : {})} />}
        <Action {...st(p, 'enableRoutine')} label="Enable" does="Enables the routine under the authority receipt you chose." onPress={() => p.set('enableRoutine', txt(chosen.ref) ?? true)}
          disabled={txt(chosen.state) === 'enabled' ? 'It is enabled.' : txt(chosen.state) === 'stale-proof' ? 'Reprove its Method first.' : !strOf(v, 'new.grant') ? 'Choose the authority it runs under.' : undefined} />
        <Action {...st(p, 'runNow')} hold label="Run now" does="Runs the verified Method with its authority. It may take the actions its receipt names." onPress={() => p.set('runNow', txt(chosen.ref) ?? true)} disabled={txt(chosen.state) !== 'enabled' ? 'Only an enabled routine runs.' : undefined} />
        <Action {...st(p, 'disableRoutine')} hold label="Disable" does="Stops future runs. A run already dispatched goes on." onPress={() => p.set('disableRoutine', txt(chosen.ref) ?? true)} disabled={txt(chosen.state) === 'disabled' ? 'It is disabled.' : undefined} />
        {chosen.verified === false && <Chooser label="On" does="A verified run of the Method's current revision." value={strOf(v, 'new.reproof') ?? ''} options={refs('reproofs')} onChange={x => p.set('new.reproof', x)} />}
        <Action {...st(p, 'reprove')} label="Reprove" does="The Method changed: prove its current revision with a verified run, then enable the routine again." onPress={() => p.set('reprove', txt(chosen.ref) ?? true)}
          disabled={chosen.verified !== false ? 'Its Method revision is verified.' : !strOf(v, 'new.reproof') ? 'Choose the verified run first.' : undefined} />
      </div>}
    </section>
  </>
}

// ---------------------------------------------------------------- Appearance

const THEMES: readonly Option<string>[] = [{value: 'light', label: 'Light'}, {value: 'dark', label: 'Dark'}, {value: 'system', label: 'Follow system'}]
/** Appearance (§10.10): the presentation owner's Theme as one row, like every owner's setting — choose a value and it is a local change,
 * amber, counted, with Details and Undo, applied by Review changes… (O-I #744; settings/presentationSetting.ts); the saved reading with
 * its revision, and Revert, the owner's own act, as Reset is on a row; the themes you imported; the renderer's opening preferences. */
function AppearancePage({p}: {p: ViewProps}) {
  const v = p.v, theme = json<Rec | null>(v, 'theme', null), library = list(v, 'themes'), imported = list(v, 'imported')
  const saved = txt(theme?.saved)
  const name = (id: string | undefined) => (id ? THEMES.find(t => t.value === id)?.label ?? txt(library?.find(t => t.id === id)?.name) ?? txt(imported?.find(t => t.id === id)?.name) ?? id : undefined)
  const toggle = (key: string, label: string, does: string) => { const on = boolOf(v, key); return <Toggle {...st(p, key)} label={label} does={does} on={on === true} unknown={on === undefined} onChange={x => p.set(key, x)} /> }
  return <>
    <OwnerRows p={p} category="appearance" size={4} title="Theme">
      <div className="st-line">
        <Readout {...st(p, 'theme')} label="saved" does={`The appearance the presentation owner keeps${theme && theme.revision !== undefined ? `: revision ${String(theme.revision)} · ${typeof theme.observations === 'number' ? theme.observations : 0} renderer observations` : ''}. A renderer's observation is advisory, a separate reading. Change it on its row, then Review changes….`} value={name(saved)} />
        <Action {...st(p, 'revertTheme')} label="Revert" does="Returns to the appearance saved before the last one." onPress={() => p.set('revertTheme', true)} />
        <Action {...st(p, 'openExpressions')} label="Open Expressions" does="Opens the Expressions editor, where the scene, glyph, material, physics and musical controls stand." onPress={() => p.set('openExpressions', true)} />
      </div>
    </OwnerRows>
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
  </>
}

// ---------------------------------------------------------------- Products & updates

const STATE_TONE: Readonly<Record<string, Tone>> = {available: 'green', degraded: 'accent', unavailable: 'stall'}
function ProductsPage({p}: {p: ViewProps}) {
  const v = p.v, products = list(v, 'products'), chosen = products?.find(r => r.id === strOf(v, 'product')) ?? products?.[0], ran = json<Rec | null>(v, 'ran', null)
  return <>
    <section className="st-sec">
      <h4>Installed products<small>{products ? `${products.length} owners · the desktop is a full install: none is added or removed here` : 'no reading of the products'}</small></h4>
      {products && <table className="st-tbl">
        <Cols w={[110, 64, 90, undefined]} />
        <thead><tr><th>Product</th><th>Version</th><th>State</th><th>Operations</th></tr></thead>
        <tbody>{products.map(r => {
          const id = txt(r.id) ?? '', state = txt(r.state), acts = Array.isArray(r.actions) ? r.actions.filter(rec) : []
          return <tr key={id} className="st-pick" data-focus={chosen?.id === id ? 'true' : undefined} onClick={() => p.set('product', id)}>
            <td data-i={txt(r.about) ? `${ownerWord(id)}|${r.about}` : undefined}><b>{ownerWord(id)}</b></td><td>{txt(r.version) ?? NONE}</td>
            <td data-i={txt(r.reason) ? `${state ?? NONE}|${r.reason}` : undefined}><span data-st={state ? STATE_TONE[state] : undefined}>{state ?? NONE}</span></td>
            <td className="st-acts st-acts--left">{acts.length ? acts.slice(0, 3).map(a => <Action key={txt(a.ref) ?? ''} {...st(p, 'run')} label={txt(a.title) ?? NONE}
              does={a.runnable === true ? `Runs ${txt(a.title)} through ${ownerWord(id)}.` : txt(a.why) ?? 'Choose its subject where you use it.'}
              onPress={() => p.set('run', `${id}:${txt(a.ref) ?? ''}`)} disabled={a.runnable === true ? undefined : txt(a.why) ?? 'Choose its subject where you use it.'} />) : <span className="st-dim">none here</span>}
              {acts.length > 3 && <span className="st-dim" data-i={`${ownerWord(id)}|${acts.length} operations: choose the product to see them all.`}> +{acts.length - 3}</span>}</td>
          </tr>
        })}</tbody>
      </table>}
    </section>
    {chosen && <section className="st-sec">
      <h4>{ownerWord(txt(chosen.id))}<small>{txt(chosen.about) ? `${chosen.about} · ` : ''}observed {txt(chosen.observed) ?? NONE} · digest {txt(chosen.digest)?.slice(0, 12) ?? NONE}</small></h4>
      {Array.isArray(chosen.actions) && chosen.actions.length > 3 && <div className="st-chips" aria-label="Operations">{chosen.actions.filter(rec).map(a => <Action key={txt(a.ref) ?? ''} {...st(p, 'run')} label={txt(a.title) ?? NONE}
        does={a.runnable === true ? `Runs ${txt(a.title)} through ${ownerWord(txt(chosen.id))}.` : txt(a.why) ?? 'Choose its subject where you use it.'}
        onPress={() => p.set('run', `${txt(chosen.id) ?? ''}:${txt(a.ref) ?? ''}`)} disabled={a.runnable === true ? undefined : txt(a.why) ?? 'Choose its subject where you use it.'} />)}</div>}
      <div className="st-cols">
        <ul className="st-list" aria-label="Degradations">{Array.isArray(chosen.degraded) && chosen.degraded.length
          ? chosen.degraded.filter(rec).map((d, i) => <li key={i}><b>{txt(d.subject) ?? NONE}</b><span data-st={STATE_TONE[txt(d.state) ?? '']}>{txt(d.state) ?? NONE}</span><em>{txt(d.reason) ?? ''}</em></li>)
          : <li className="st-none">{Array.isArray(chosen.degraded) ? 'Nothing degraded.' : 'No reading of its health.'}</li>}</ul>
        <ul className="st-list" aria-label="Known gaps">{strs(chosen.obligations).length ? strs(chosen.obligations).map((o, i) => <li key={i}><em>{o}</em></li>)
          : <li className="st-none">No known gap.</li>}</ul>
      </div>
      {ran && <p className="st-note" data-st={ran.ok === true ? 'green' : 'stall'}>{txt(ran.at) ? `${ran.at} · ` : ''}{txt(ran.title) ?? NONE}: {ran.ok === true ? 'the owner reports success' : 'the owner reports a problem'}
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
  return <OwnerRows p={p} category={category} size={11} />
}

/** What search finds, in order: pages by their name and words, the owners' settings by their title, owner, section and the words their
 * owner gives, then the settings that stand beside their instrument by their title and description. Each result names the page it opens,
 * or the setting it opens beside its instrument. Pure: the window's ↑/↓ and Enter walk this same list (settings/SettingsWorkspace.tsx). */
export interface SearchResult {readonly kind: 'page' | 'setting' | 'elsewhere'; readonly label: string; readonly where: string; readonly page?: PageId; readonly ref?: string; readonly owner?: string}
export function searchResults(v: V): SearchResult[] {
  const q = (strOf(v, 'search') ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!q.length) return []
  const hit = (s: string) => q.every(w => s.toLowerCase().includes(w))
  return [
    ...PAGES.filter(x => hit(`${x.label} ${x.words}`)).map(x => ({kind: 'page' as const, label: x.label, where: 'page', page: x.id})),
    ...(settingsOf(v) ?? []).filter(s => hit(`${s.title} ${s.ref} ${ownerWord(s.owner)} ${s.section ?? ''} ${s.words ?? ''}`))
      .map(s => ({kind: 'setting' as const, label: s.title, where: PAGES.find(x => x.category === s.category)?.label ?? NONE, page: pageOfCategory(s.category), ref: s.ref, owner: ownerWord(s.owner)})),
    ...(list(v, 'elsewhere') ?? []).filter(e => hit(`${txt(e.title) ?? ''} ${txt(e.ref) ?? ''} ${txt(e.words) ?? ''}`))
      .map(e => ({kind: 'elsewhere' as const, label: txt(e.title) ?? NONE, where: `beside ${txt(e.where) ?? 'its instrument'}${txt(e.scope) ? ` · ${e.scope}` : ''}`, ref: txt(e.ref)})),
  ]
}

/** Search's results: press one to go to it; ↑/↓ move the mark (`hit`) and Enter opens the one marked. */
function Results({p}: {p: ViewProps}) {
  const found = searchResults(p.v), hit = Math.min(Math.max(numOf(p.v, 'hit') ?? 0, 0), Math.max(found.length - 1, 0))
  const [shown, pager, first] = usePaged(found, 12, has(p.v, 'hit') ? hit : undefined)
  const go = (r: SearchResult) => {
    if (r.kind === 'elsewhere') { p.set('openElsewhere', r.ref ?? true); return }
    p.setPage(r.page!); p.set('focus', r.ref); p.set('search', '')
  }
  return <section className="st-sec">
    <h4>Search<small>{found.length ? `${found.length} found · ↑ ↓ to move, Enter to open` : 'nothing found'}</small>{pager}</h4>
    <table className="st-tbl"><Cols w={[undefined, 220]} /><tbody>{shown.map((r, i) => <tr key={`${r.kind}:${r.ref ?? r.label}`} className="st-pick" data-focus={first + i === hit ? 'true' : undefined} onClick={() => go(r)}>
      <td><b>{r.label}</b>{r.owner ? <small>{r.owner}</small> : null}</td><td className="st-dim">{r.where}{r.kind === 'elsewhere' ? ' ▸' : ''}</td></tr>)}</tbody></table>
  </section>
}

const PLAN_TONE: Readonly<Record<string, Tone>> = {applied: 'green', verified: 'green', refused: 'stall', failed: 'stall'}
/** Review: each owner's plan with its scope, the change and when it applies, then each owner's answer in the same table — an answer with
 * no plan (a Reset) in its own row — and what an owner refused instead of planning. */
function ReviewPage({p}: {p: ViewProps}) {
  const plans = list(p.v, 'plans'), result = json<Rec | null>(p.v, 'result', null), ops = result && Array.isArray(result.operations) ? result.operations.filter(rec) : []
  const errors = has(p.v, 'planErrors') ? strs(json<unknown>(p.v, 'planErrors', [])) : []
  const answers = ops.filter(o => !plans?.some(r => r.ref === o.ref))
  const answer = (op: Rec | undefined) => { const s = txt(op?.status); return <td data-i={txt(op?.message) ? `${s ?? NONE}|${op!.message}` : undefined}><span data-st={s ? PLAN_TONE[s] : undefined}>{s ?? 'not acknowledged'}</span></td> }
  return <section className="st-sec">
    <h4>Review changes<small>{plans ? `${plans.length} planned by their owners${result ? ` · ${txt(result.status) ?? NONE}` : ''}` : result ? `the owners answered · ${txt(result.status) ?? NONE}` : 'the owners have not planned your changes'}</small>
      <span className="st-head-acts">
        <Action {...st(p, 'apply')} label="Apply" does="Each owner applies the plan it reviewed, then reads the settings again." onPress={() => p.set('apply', true)} disabled={plans?.length ? undefined : 'Nothing is planned.'} />
        <Action label="Back" does="Back to your changes. They stay as they are." onPress={() => p.setPage('harnesses')} />
      </span></h4>
    {(plans || answers.length > 0) && <table className="st-tbl">
      <Cols w={result ? [170, 90, undefined, 84, 104] : [170, 90, undefined, 84]} />
      <thead><tr><th>Setting</th><th>At</th><th>Change</th><th>Applies</th>{result && <th>Answer</th>}</tr></thead>
      <tbody>{(plans ?? []).map(r => <tr key={txt(r.ref) ?? ''}><td><b>{txt(r.title) ?? txt(r.ref) ?? NONE}</b></td><td>{txt(r.scope) ?? NONE}</td><td className="st-dim">{strs(r.changes).join(' · ') || NONE}</td>
          <td data-i={txt(r.summary) ? `Applies|${r.summary}` : undefined}>{TIMING[txt(r.effect) ?? 'unknown'] ?? txt(r.effect)}</td>
          {result && answer(ops.find(o => o.ref === r.ref))}</tr>)}
        {answers.map(o => <tr key={`answer:${txt(o.ref) ?? ''}`}><td><b>{txt(o.title) ?? txt(o.ref) ?? NONE}</b></td><td>{NONE}</td><td className="st-dim">reset to inheritance or default</td><td>{NONE}</td>{answer(o)}</tr>)}</tbody>
    </table>}
    {errors.length > 0 && <ul className="st-list" aria-label="Refused before a plan">{errors.map((e, i) => <li key={i}><span data-st="stall">refused</span><em>{e}</em></li>)}</ul>}
  </section>
}

// ---------------------------------------------------------------- the window

function Window({p}: {p: ViewProps}) {
  const v = p.v, page = pageOf(p), src = json<Rec | null>(v, 'source', null), settings = settingsOf(v), drafts = draftsOf(v).length
  const searching = (strOf(v, 'search') ?? '').trim() !== ''
  const shown = PAGES.filter(x => !('contributed' in x) || settings?.some(s => s.category === x.category))
  const lamp: LightState = src ? (txt(src.kind) === 'native' ? 'lit' : 'dark') : 'unknown'
  const unread = list(v, 'owners') ?? [], back = strOf(v, 'back')
  const nav = (group: string) => <>
    {group && <span className="st-nav-group">{group}</span>}
    {shown.filter(x => x.group === group).map(x => {
      const n = settings ? draftsOf(v).filter(k => settings.find(s => draftKey(s.ref) === k)?.category === x.category).length : 0
      return <button key={x.id} type="button" aria-current={page === x.id && !searching ? 'page' : undefined} onClick={() => { p.setPage(x.id); p.set('search', '') }}>
        {x.label}{n > 0 && <i data-i={`${x.label}|${n} local ${n === 1 ? 'change' : 'changes'} on this page.`}>{n}</i>}</button>
    })}
  </>
  const body = searching ? <Results p={p} /> : page === 'review' ? <ReviewPage p={p} /> : page === 'setup' ? <SetupPage p={p} /> : page === 'harnesses' ? <HarnessesPage p={p} /> : page === 'credentials' ? <CredentialsPage p={p} />
    : page === 'profiles' ? <ProfilesPage p={p} /> : page === 'machines' ? <MachinesPage p={p} /> : page === 'automations' ? <AutomationsPage p={p} />
      : page === 'appearance' ? <AppearancePage p={p} /> : page === 'products' ? <ProductsPage p={p} /> : page === 'system' ? <SystemPage p={p} />
        : <OwnerPage p={p} category={PAGES.find(x => x.id === page)!.category} />
  return <div className="ref-pane-body st-window">
    <header className="st-top">
      <b>Settings</b>
      <span className="st-search"><TextField does="Searches every page, every owner's setting, and the settings that stand beside their instrument. Enter sends it; ↑ ↓ then move through the results and Enter opens one. ⌘F." value={strOf(v, 'search') ?? ''}
        placeholder="⌕ Search settings" onChange={x => p.set('search', x)} /></span>
      <span className="st-source" data-i={`Owners|${src ? (txt(src.kind) === 'native' ? 'Read and written through the native owners.' : txt(src.kind) === 'development' ? 'A development adapter: simulated answers, nothing native written.' : 'No native connection: nothing is read or written.') : 'No reading of the connection.'}`}>
        <Lamp state={lamp} tone="green" />{src ? txt(src.label) ?? NONE : NONE}{src?.simulated === true && <em>simulated</em>}</span>
      {unread.length > 0 && <span className="st-unread" data-st="stall" data-i={`Owners unread|${unread.map(o => `${ownerWord(txt(o.owner))}: ${txt(o.reason) ?? 'Contribution unavailable.'}`).join(' ')}`}>
        {unread.length} {unread.length === 1 ? 'owner' : 'owners'} unread</span>}
      <Action {...st(p, 'reread')} label="Read again" does="Reads every owner again: the settings and each page you opened. What you changed stays yours." onPress={() => p.set('reread', true)} />
      {back !== undefined && <Action {...st(p, 'returnToWork')} label={`← ${back}`} does="Back to the work you came from. Your local changes stay. Esc does the same." onPress={() => p.set('returnToWork', true)} />}
    </header>
    <div className="st-main">
      <nav className="st-nav" aria-label="Settings pages">{nav('')}{nav('Preferences')}{nav('System')}</nav>
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
  {ref: 'ai-kit:resolution:resolution.profiles', category: 'profiles', owner: 'ai-kit', section: 'resolution', title: 'Native profile selection', kind: 'choice', options: ['core', 'core-development', 'documentation'], writable: true, from: 'inherited', timing: 'session-restart-required', effective: 'core-development',
    help: 'Choose the AIKit profile used when composing new work. Running sessions keep their existing composition.', effect: 'New sessions compose with the new profile; harness sessions already running keep their composition until they are relaunched.', at: 'This machine',
    details: {identity: 'ai-kit:resolution:resolution.profiles', where: 'ai-kit · aikit:scope:profiles', desired: 'No desired preference reported', declared: 'Not reported', effective: 'core-development',
      provenance: 'owner_ref: ai-kit · path: ~/.aikit/scope.toml', active: 'core-development', staged: 'Not reported', proposed: 'No local change', default: 'Computed by owner', reconciliation: 'satisfied', basis: 'sha256:9f2c41d07ab3'}},
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
    columns: [{name: 'harness', type: 'text'}, {name: 'mode', type: 'text'}], rows: [{harness: 'claude-code', mode: 'acceptEdits'}], clears: {harness: ['mode']},
    cells: [{harness: {choices: [{value: 'claude-code', title: 'Claude Code'}, {value: 'codex', title: 'Codex'}]}, mode: {choices: [{value: 'default', title: 'Default'}, {value: 'acceptEdits', title: 'Accept edits'}, {value: 'plan', title: 'Plan'}]}}]},
  {ref: 'ai-kit:codex:home.trust_level', category: 'permissions', owner: 'ai-kit', section: 'codex', title: 'Home wholesale trust', kind: 'toggle', writable: false, from: 'inherited', timing: 'none', effective: false},
  {ref: 'central:policy:placement.enforcement', category: 'permissions', owner: 'central', section: 'policy', title: 'Work placement enforcement', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: 'enforce'},
  {ref: 'software-factory:telemetry:search-limit-default', category: 'telemetry', owner: 'software-factory', section: 'telemetry', title: 'Search result limit default', kind: 'number', writable: true, from: 'inherited', timing: 'value-change', effective: 50, range: '1 – 500'},
  {ref: 'software-factory:telemetry:search-timeout-seconds', category: 'telemetry', owner: 'software-factory', section: 'telemetry', title: 'Delegated search budget (s)', kind: 'number', writable: true, from: 'inherited', timing: 'value-change', effective: 30, range: '1 – 600'},
  {ref: 'software-factory:telemetry:watch-interval-seconds', category: 'telemetry', owner: 'software-factory', section: 'telemetry', title: 'Watch poll interval (s)', kind: 'number', writable: true, from: 'here', timing: 'value-change', effective: 5, range: '0.5 – 60',
    help: 'Set the interval between telemetry watch updates, in seconds.', at: 'This machine'},
  {ref: 'software-factory:binding:central-project', category: 'library', owner: 'software-factory', section: 'binding', title: 'Central project binding', kind: 'table', writable: true, from: 'inherited', timing: 'value-change',
    columns: [{name: 'project', type: 'text'}, {name: 'register', type: 'text'}], rows: [{project: 'O-I', register: 'Work/O-I/ProjectCentral'}]},
  {ref: 'oi:composition:install-mode', category: 'products', owner: 'oi', section: 'composition', title: 'Install mode', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: 'developer'},
  {ref: 'oi:update:state', category: 'products', owner: 'oi', section: 'update', title: 'Update state', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: 'current'},
  {ref: 'oi:identity:suite-executable', category: 'products', owner: 'oi', section: 'identity', title: 'Suite executable', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: '~/.local/bin/oi'},
  {ref: 'central:policy:civil-time.timezone', category: 'inspection', owner: 'central', section: 'policy', title: 'Civil-time timezone', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: 'Europe/London'},
  {ref: 'central:policy:civil-time.day-boundary-minutes', category: 'inspection', owner: 'central', section: 'policy', title: 'Day boundary offset', kind: 'number', writable: false, from: 'inherited', timing: 'none', effective: 240},
  {ref: 'quaternal-logic:kernel:kernel.version', category: 'inspection', owner: 'quaternal-logic', section: 'kernel', title: 'Kernel version', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: '0.9.4'},
  {ref: 'actuation:return:return.modes', category: 'inspection', owner: 'actuation', section: 'return', title: 'Return policy modes', kind: 'list', writable: false, from: 'inherited', timing: 'none', rows: [{item: 'propose'}, {item: 'draft'}, {item: 'write'}]},
  // The presentation owner's theme (settings/presentationSetting.ts): one row, changed as every owner's setting is, through Review changes….
  {ref: 'oi:presentation:theme', category: 'appearance', owner: 'oi', section: 'presentation', title: 'Theme', kind: 'choice', writable: true, from: 'here', timing: 'value-change', effective: 'system', at: 'This machine',
    effect: 'The presentation owner saves the appearance, and the window redraws in it.',
    options: [{value: 'light', title: 'Light'}, {value: 'dark', title: 'Dark'}, {value: 'system', title: 'Follow system'}, {value: 'ableton-dark', title: 'Ableton dark'}, {value: 'paper', title: 'Paper'}, {value: 'solarized', title: 'Solarized Dark'}]},
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
// Setup on this Mac: four steps accepted, and the Projects step reading the folders of work it found (§10.11).
const SETUP_DONE = [
  {step: 'ground', state: 'accepted', items: [{name: 'Your ground', where: '~/Central', change: 'adopted where it is'}]},
  {step: 'harnesses', state: 'accepted', items: [
    {name: 'Claude Code', where: '~/.claude', change: 'connected through its adapter · its skills keep working'},
    {name: 'Codex', where: '~/.codex', change: 'connected through its adapter'},
    {name: 'pi', where: '~/.pi', change: 'connected through its adapter'},
    {name: 'Hermes', where: '~/.hermes', why: 'Its session settings cannot be read here.'}]},
  {step: 'credentials', state: 'accepted', items: [
    {name: 'ANTHROPIC_API_KEY', where: 'process environment', credential: 'credential:anthropic', bound: true, change: 'credential:anthropic is bound by reference to keychain://aikit/anthropic'},
    {name: 'OPENAI_API_KEY', where: '~/code/tide/.env', credential: 'credential:openai', bound: true, change: 'credential:openai is bound by reference to keychain://aikit/openai'}]},
  {step: 'machines', state: 'accepted', items: [
    {name: 'This Mac', where: 'workcell:mac', change: 'a workcell'},
    {name: 'omarchy', where: '100.92.62.101', change: 'prepared as a place to work · its settings kept'}]},
  {step: 'projects', state: 'found', items: []},
]
const FOLDERS = [
  {path: '~/Central/Work/O-I', title: 'O-I', place: 'work', finds: 'ground', material: ['desktop', 'docs', 'packages', 'suite'], central: ['user', 'agents', 'wiki', 'now']},
  {path: '~/Writing/essays', title: 'essays', place: 'elsewhere', finds: 'one', wikis: ['wiki'], material: ['drafts', 'published', 'wiki', 'README.md'], central: []},
  {path: '~/Code/sketches', title: 'sketches', place: 'elsewhere', finds: 'none', material: ['src', 'assets', 'package.json'], central: []},
  {path: '~/Central/Work/garden', title: 'garden', place: 'work', finds: 'many', wikis: ['notes/wiki', 'site/wiki'], material: ['notes', 'site', 'plants.csv'], central: []},
  {path: '~/Old/lab', title: 'lab', place: 'elsewhere', finds: 'unreadable', material: ['ProjectCentral', 'runs'], central: ['user', 'agents']},
]

const DEFAULTS = {
  setup: dump(SETUP_DONE), setupStep: 'projects', folders: dump(FOLDERS), folder: '~/Writing/essays', make: 'copy', where: 'stands',
  source: dump({kind: 'native', label: 'Native configuration · this Mac'}), owners: dump([]), back: 'Back to work',
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
    {ref: 'quiet-evening', title: 'Quiet evening', active: false, settings: [{ref: 'ai-kit:resolution:resolution.profiles', title: 'Native profile selection', scope: 'machine', value: 'documentation'}, {ref: 'software-factory:telemetry:watch-interval-seconds', title: 'Watch poll interval', scope: 'project · O-I', value: '30'}]},
    {ref: 'build-day', title: 'Build day', active: true, settings: [{ref: 'ai-kit:models:models.default', title: 'Default model per harness', scope: 'machine', value: 'claude-code: claude-opus-5-5'}, {ref: 'ai-kit:models:models.credentials', title: 'Provider credential reference', scope: 'world', secret: true}, {ref: 'ai-kit:permissions:permissions.default-mode', title: 'Default permission mode', scope: 'machine', value: 'claude-code: acceptEdits'}, {ref: 'ai-kit:skills:skills.capabilities', title: 'Capability toggles', scope: 'machine', value: 'web-fetch: On'}]},
  ]),
  machines: dump([
    {label: 'omarchy', endpoint: '100.92.62.101:7777', credential: 'keychain://workcell-connection/omarchy', expects: ['status', 'prepare', 'run', 'collect'], note: 'Omarchy, the Linux machine'},
    {label: 'omarchy-improvement-lanes', endpoint: '100.92.62.101:7778', credential: 'keychain://workcell-connection/omarchy-improvement-lanes', expects: ['status', 'run']},
  ]),
  connections: dump([{label: 'omarchy', state: 'connected', protocol: 'workcell.control/v1', remote: 'workcell 0.1.0 (174fa1c3133a)', granted: ['status', 'prepare', 'run'], reconciled: '21 Oct 13:58',
    expires: '28 Oct 13:58', detail: 'Software revisions differ: local c7261e23bc93, remote 174fa1c3133a. The protocol matches.'}]),
  operations: dump(['status', 'prepare', 'run', 'collect', 'cancel']), workcell: 'Workcell · workcell:mac',
  show: 'routines', routine: 'routine:morning-checks', context: 'home', contexts: dump([{ref: 'home', title: 'This AIKit home'}, {ref: 'O-I', title: 'Project · O-I'}]),
  routines: dump([
    {ref: 'routine:morning-checks', name: 'Morning checks', state: 'enabled', when: 'daily 07:30', next: 'Thu 07:30', method: 'central:oi-checks', revision: 'r14', verified: true, unattended: true,
      scheduler: 'launchd · loaded', nextRuns: ['Thu 07:30', 'Fri 07:30', 'Sat 07:30', 'Sun 07:30'], methodText: 'Run the O:I checks and return the verdict to the Day.', proof: 'proof:oi-checks-r14', authority: 'granted · unattended'},
    {ref: 'routine:week-notes', name: 'Write up the week', state: 'draft', when: 'Fri 17:00', method: 'central:week-notes', revision: 'r3', verified: true, unattended: false},
    {ref: 'routine:map-refresh', name: 'Refresh the QL map', state: 'disabled', when: 'on bimba change', method: 'ql:refresh-from-bimba', revision: 'r7', verified: false, unattended: true},
  ]),
  methods: dump([{method: 'central:oi-checks', name: 'O:I checks', text: 'Run the O:I checks and return the verdict to the Day.', active: true},
    {method: 'central:week-notes', name: 'Week notes', text: 'Write up the week from the closed Days.', active: true}, {method: 'ql:refresh-from-bimba', name: 'Refresh from the Bimba map', text: 'Requalify the QL map from the Bimba map.', active: false}]),
  timers: dump([{name: 'nightly-backup', provider: 'launchd', when: '02:00', adopted: false, reason: 'Adopt it with a Method that has a verified run; it stays with launchd until then.'}]),
  history: dump([{at: 'Wed 07:30', routine: 'Morning checks', outcome: 'completed', delivery: 'ledger', detail: 'invocation:7f2 · central:oi-checks@r14 · ledger receipt:41'},
    {at: 'Tue 07:30', routine: 'Morning checks', outcome: 'failed', delivery: 'now', detail: 'invocation:7e9 · central:oi-checks@r14 · now return:12'}]),
  options: dump({proofs: [{ref: 'proof:oi-checks-r14', title: 'oi-checks r14 · Wed 07:31'}], triggers: [{ref: 'schedule:daily-0730', title: 'Daily 07:30'}], authorities: [{ref: 'authority:unattended-checks', title: 'Unattended · checks'}],
    profiles: [{ref: 'core-development', title: 'core-development'}], scopes: [{ref: 'scope:o-i', title: 'O-I'}, {ref: 'scope:docs', title: 'Docs'}], timezone: 'Europe/London', permits: true}),
  grants: dump([{ref: 'authority:unattended-checks', title: 'Unattended · checks'}]), reproofs: dump([{ref: 'proof:ql-refresh-r8', title: 'refresh-from-bimba r8 · Tue 18:02'}]),
  theme: dump({saved: 'system', revision: 12, observations: 1}),
  themes: dump([{id: 'ableton-dark', name: 'Ableton dark'}, {id: 'paper', name: 'Paper'}]), imported: dump([{id: 'solarized', name: 'Solarized Dark'}]),
  visualLayer: true, welcome: false,
  products: dump([
    {id: 'central', version: '0.1.0', state: 'available', about: 'Central keeps your ground: the Days, the registers and the wiki.', actions: [], observed: '21 Oct 14:04', digest: '5f18f7948542a53e', degraded: [], obligations: ['Acceptance of an authored-source return reports unavailable: no attested human principal yet.']},
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
  // The first time the DLW opens, Settings opens on Setup (§10.11).
  firstPage: 'setup',
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
      adding: 'routine', 'new.name': 'Morning checks', 'new.method': 'central:oi-checks', 'new.from': 'Prompt pads · pad 3', rotating: 'ai-kit:credential:zai',
      details: 'ai-kit:resolution:resolution.profiles', planErrors: dump([]),
      setupPlan: dump(['Make ~/Writing/essays/ProjectCentral: user, agents, now', 'Copy wiki into ProjectCentral/agents/wiki', 'Add essays to the browser\'s Work place as a world',
        'Leave ~/Writing/essays/wiki where it was']),
    },
    'First opening': {
      setup: dump([
        {step: 'ground', state: 'found', items: [{name: 'Your ground', where: '~/Central', change: 'adopt it where it is · nothing in it moves'}]},
        {step: 'harnesses', state: 'found', items: [{name: 'Claude Code', where: '~/.claude', change: 'connect through its adapter'}, {name: 'Codex', where: '~/.codex', change: 'connect through its adapter'}]},
        {step: 'credentials', state: 'found', items: [{name: 'ANTHROPIC_API_KEY', where: 'process environment', credential: 'credential:anthropic', change: 'AIKit binds credential:anthropic by the reference you give · the key stays where it lies'},
          {name: 'openai for codex', where: '~/.codex', why: 'codex login keeps its own credential store; the API key delivers only when credential:openai is bound'}]},
        {step: 'machines', state: 'found', items: [{name: 'This Mac', where: 'this computer', change: 'make it a workcell'}]},
        {step: 'projects', state: 'found', items: []},
      ]),
      setupStep: 'ground', make: undefined,
    },
    'Development adapter': {source: dump({kind: 'development', label: 'Development scenario · census of 7 October', simulated: true}), connections: dump([]), search: 'model', hit: 1,
      owners: dump([{owner: 'workcell', reason: 'Development specimen: product is not installed.'}])},
    'A routine in the making': {adding: 'routine', 'new.name': 'Morning checks', 'new.description': 'The day starts checked', 'new.method': 'central:oi-checks',
      'new.proof': 'proof:oi-checks-r14', 'new.trigger': 'new-schedule', 'new.repeat': 'daily', 'new.schedule': '07:30', 'new.authority': 'authority:unattended-checks', 'new.scopes': dump(['scope:o-i']),
      pendingCreation: 'Awaiting acknowledgement · AIKit is writing the routine.', routine: 'routine:map-refresh', 'new.reproof': 'proof:ql-refresh-r8', 'new.grant': 'authority:unattended-checks'},
    'A machine in the making': {adding: 'machine', 'new.expects': dump(['status', 'run']), 'new.label': 'studio', 'new.endpoint': 'studio.local:7777',
      'new.credential': 'keychain://workcell-connection/studio', 'new.note': 'The studio Mac'},
    'No readings': NOTHING,
  },

  // The window stands on no chain and on no rail: it has Full only (views). Asked for another view, it draws its Full.
  folded: p => <Window p={p} />,
  compact: p => <Window p={p} />,
  whole: p => <Window p={p} />,
  full: p => <Window p={p} />,
  widget: p => <Window p={p} />,
}
