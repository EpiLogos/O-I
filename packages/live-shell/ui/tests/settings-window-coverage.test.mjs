// Nothing the Settings window did is lost on its design (manual §10.10; ticket #758: "Every function of today's window has a place or a
// recorded reason for leaving"; #739 gap 19). FUNCTIONS lists every control of the window as it stood before it drew from `settings:window`
// — the pages under settings/*.tsx at 9dae5668d^ (SettingsWorkspace, OwnerPreferences, HarnessPreferences, AutomationPreferences,
// ScheduleControl, MachinePreferences, ProductPreferences, ProfilePreferences and controls.tsx; kept in git, file:line named) — each with
// its place in the window today, found drawn by the design on the page that holds it, or with the manual line that drops it and why.
// Adding and removing products' deeper parts (#707) is not listed: the window before its design never drew it.
// Channels: SCRIPTED (the design rendered to static markup through the device host, on its own sample readings) and CODE-DERIVED (the
// window's sources, where a function is a key the host handles rather than a drawing). Not a screen pass: the native window is #821's.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) { if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}; return r }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const host = await import('../src/frame/devices/deviceHost.tsx')
const settingsWindow = await import('../src/inhabitants/catalogue/panels/settings__window.tsx')
const {design} = settingsWindow

const ID = 'settings:window'
const json = value => JSON.stringify(value)
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8')
/** The manual, its lines joined as they read (a sentence wraps across lines). */
const MANUAL = source('../../../../ProjectCentral/docs/1-vision/dlw/DLW.md').replace(/\s+/g, ' ')

/** One page of the window, drawn by the device host on the design's sample readings, a fixture of it, and what the place needs. */
function drawn(page, extra = {}) {
  host.resetHost(ID)
  host.setHostPage(ID, page)
  const values = {...design.defaults, ...extra}
  for (const [key, value] of Object.entries(values)) if (value === undefined) delete values[key]
  const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: {id: ID, values, standing: {}, local: {}}, view: 'full', nav: {}}))
  host.resetHost(ID)
  return markup
}
const fixture = name => design.fixtures[name]
/** A press drawn: its words on a control (the kit's Action), an Info line naming it, or a held press (press and hold, manual §10.10 Rules). */
const press = label => new RegExp(`<button[^>]*>(?:<i class="dp-hold-fill"[^>]*></i>)?${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</button>`)
const held = label => new RegExp(`data-hold="true"[^>]*><i class="dp-hold-fill"[^>]*></i>${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</button>`)

const ROW = {ref: 'software-factory:telemetry:watch', category: 'telemetry', owner: 'software-factory', section: 'telemetry', title: 'Watch poll interval', kind: 'number',
  writable: true, from: 'here', timing: 'value-change', effective: 5, help: 'Set the interval between telemetry watch updates.', effect: 'The next watch uses it.',
  details: {identity: 'software-factory:telemetry:watch', where: 'software-factory · factory:watch', effective: '5', default: 'Computed by owner', reconciliation: 'satisfied', basis: 'digest-1'}}
const TABLE = {ref: 'ai-kit:permissions:permissions.default-mode', category: 'permissions', owner: 'ai-kit', title: 'Default permission mode per harness', kind: 'table', writable: true, from: 'here',
  timing: 'session-restart-required', columns: [{name: 'harness', type: 'scalar'}, {name: 'mode', type: 'scalar'}, {name: 'on', type: 'boolean'}, {name: 'extra', type: 'list'}],
  rows: [{harness: 'claude-code', mode: 'acceptEdits', on: true, extra: []}],
  cells: [{harness: {choices: [{value: 'claude-code', title: 'Claude Code'}]}, mode: {choices: [{value: 'acceptEdits', title: 'Accept edits'}, {value: 'plan', title: 'Plan'}]}}], clears: {harness: ['mode']}}
const PATH = {ref: 'ai-kit:local-services:decision.provider', category: 'execution', owner: 'ai-kit', title: 'Decision provider election', kind: 'path', writable: true, from: 'inherited', timing: 'value-change'}
const KINDS = [ROW, TABLE, PATH, {ref: 'a:b:toggle', category: 'telemetry', owner: 'ai-kit', title: 'A switch', kind: 'toggle', writable: true, from: 'inherited', timing: 'value-change', effective: true},
  {ref: 'a:b:choice', category: 'telemetry', owner: 'ai-kit', title: 'A choice', kind: 'choice', writable: true, from: 'inherited', timing: 'value-change', effective: 'x', options: [{value: 'x', title: 'Ex'}, {value: 'y', title: 'Why'}]},
  {ref: 'a:b:unset', category: 'telemetry', owner: 'ai-kit', title: 'Set nowhere yet', kind: 'text', writable: true, from: 'inherited', timing: 'value-change'},
  {ref: 'a:b:read', category: 'telemetry', owner: 'central', title: 'Read only', kind: 'text', writable: false, from: 'inherited', timing: 'none', effective: 'enforce'},
  {ref: 'a:b:list', category: 'telemetry', owner: 'ai-kit', title: 'A list', kind: 'list', writable: true, from: 'here', timing: 'value-change', rows: [{item: 'one'}]},
  {ref: 'ai-kit:models:models.credentials', category: 'connections', owner: 'ai-kit', title: 'Provider credential reference', kind: 'secret', writable: false, from: 'inherited', timing: 'provider-reconnect-required', effective: 'keychain://aikit/anthropic'}]
const ROWS = {settings: json(KINDS), conflicts: json([ROW.ref]), [`draft:${ROW.ref}`]: 10}
const THEME = 'oi:presentation:theme'

/** Each control of the window before its design: where it was (9dae5668d^, packages/live-shell/ui/src/settings/), what it did, and its
 * place today — [page, what the page draws, the readings it needs] — or the manual line that drops it and why. */
const FUNCTIONS = [
  // ── SettingsWorkspace.tsx: the window's own head, rows, review and foot ──
  {was: 'SettingsWorkspace.tsx:277 Search settings (searches as you type)', place: ['harnesses', /<input[^>]*aria-label="Search settings"/]},
  {was: 'SettingsWorkspace.tsx:277 ← {returnLabel} (the way back, named for the work you came from)', place: ['harnesses', '>← Back to Live<', {back: 'Back to Live'}]},
  {was: 'SettingsWorkspace.tsx:279 the categories down the left', place: ['harnesses', 'aria-label="Settings pages"']},
  {was: 'SettingsWorkspace.tsx:281 × Dismiss error', dropped: '| Point at it | The status bar says its name and what it does. |',
    why: 'A refusal is no banner to dismiss: it stands on the control it refused (Read again for a reading), in the owner\'s words on the status bar, and ends with the next move.'},
  {was: 'SettingsWorkspace.tsx:282 a setting found (title · page · scope · help)', place: ['harnesses', /<tr[^>]*st-pick[^>]*><td><b>Watch poll interval \(s\)<\/b><small>Factory<\/small><\/td><td class="st-dim">Search &amp; telemetry</, {search: 'watch'}]},
  {was: 'SettingsWorkspace.tsx:282 Open working editor · (a setting beside its instrument)', place: ['harnesses', 'beside the Delay on its chain ▸', {search: 'delay'}]},
  {was: 'SettingsWorkspace.tsx:282 Open working controls (a page found)', place: ['harnesses', /<td><b>Automations<\/b><\/td><td class="st-dim">page</, {search: 'cron'}]},
  {was: 'SettingsWorkspace.tsx:266 Set an override… (a value read but not set here)', place: ['telemetry', /Set nowhere yet[\s\S]*?<input class="dp-text" type="text"[^>]*value=""\/>/, ROWS]},
  {was: 'SettingsWorkspace.tsx:266 Manage credentials… (a secret\'s editor)', place: ['credentials', escaped('Press to open Credentials.'), ROWS]},
  {was: 'SettingsWorkspace.tsx:266 Undo (one local change)', place: ['telemetry', press('Undo'), ROWS]},
  {was: 'SettingsWorkspace.tsx:268 Rebase draft (keep a change on a moved reading)', place: ['telemetry', press('Keep'), ROWS]},
  {was: 'SettingsWorkspace.tsx:269 Restore inheritance / default…', place: ['telemetry', held('Reset'), ROWS]},
  {was: 'SettingsWorkspace.tsx:297 Restore through owner · Cancel (the reset\'s confirmation)', place: ['telemetry', held('Reset'), ROWS]},
  {was: 'SettingsWorkspace.tsx:269 Details (identity, place, the four axes, default, reconciliation, reading basis)', place: ['telemetry', '<dt>Reading basis</dt>', {...ROWS, details: ROW.ref}]},
  {was: 'SettingsWorkspace.tsx:294 the read-only settings, beneath', place: ['telemetry', /<tr data-read="true"><td><button[^>]*><b>Read only</, ROWS]},
  {was: 'SettingsWorkspace.tsx:298 Apply reviewed plans', place: ['review', press('Apply'), fixture('Changes to review')]},
  {was: 'SettingsWorkspace.tsx:298 Back to editing', place: ['review', press('Back'), fixture('Changes to review')]},
  {was: 'SettingsWorkspace.tsx:298 Owner plan (each plan\'s JSON)', dropped: 'An owner\'s raw record never stands on a page; its configuration as written stands read only on the System page.',
    why: 'Each plan stands in the Review table in words: the setting, its scope, the change, when it applies and what it does.'},
  {was: 'SettingsWorkspace.tsx:299 Acknowledgement (the answer\'s JSON)', dropped: 'An owner\'s raw record never stands on a page; its configuration as written stands read only on the System page.',
    why: 'Each owner\'s answer stands in the same table as its plan, its reason on the Info line; an act its owner takes is acknowledged on the status bar in its words.'},
  {was: 'SettingsWorkspace.tsx:299 Close result', place: ['review', /<th>Answer<\/th>/, fixture('Changes to review')], note: 'the answer stays beside its plan; a page down the left, Back or a new change leaves it'},
  {was: 'SettingsWorkspace.tsx:301 the help aside (what a setting does, when it applies)', place: ['telemetry', escaped('Watch poll interval|Set the interval between telemetry watch updates. When it applies: next resolution. The next watch uses it.'), ROWS]},
  {was: 'SettingsWorkspace.tsx:303 ⓘ Info (shows and hides the help aside)', dropped: '| Point at it | The status bar says its name and what it does. |',
    why: 'The help is said on the status bar from the setting\'s name, as every control\'s words are: there is no aside to show or hide.'},
  {was: 'SettingsWorkspace.tsx:303 Review changes… and the count of local changes', place: ['telemetry', /<span>1 local change · 1 to keep or drop<\/span>[\s\S]*Review changes…/, ROWS]},
  {was: 'SettingsWorkspace.tsx:330 a setting\'s scope (Applies to, per row)', place: ['telemetry', 'aria-label="Applies to"', ROWS], note: 'folded into the page\'s Applies to (T-COVERAGE D9)'},
  {was: 'SettingsWorkspace.tsx:337 a typed scope subject · Read scope', dropped: '| Applies to | This machine · World · a project · a workcell | This machine | The scope the owners\' settings are read and changed at. |',
    why: 'Applies to offers the subjects the owners allow (SettingsAdapter.scopeChoices) as a choice; a subject typed by hand is no longer taken.'},
  {was: 'SettingsWorkspace.tsx the unread owners and their reasons', place: ['harnesses', escaped('Owners unread|Factory: Not installed.'), {owners: json([{owner: 'software-factory', reason: 'Not installed.'}])}]},
  {was: 'SettingsWorkspace.tsx the connection the window reads through (the foot\'s label)', place: ['harnesses', 'Native configuration · this Mac']},
  // ── controls.tsx: a setting's value, by its kind ──
  {was: 'controls.tsx:15 a switch', place: ['telemetry', /A switch[\s\S]*?dp-cell--toggle/, ROWS]},
  {was: 'controls.tsx:16 a choice', place: ['telemetry', /A choice[\s\S]*?<select class="dp-chooser"/, ROWS]},
  {was: 'controls.tsx:17 a text or number', place: ['telemetry', /Watch poll interval[\s\S]*?<input class="dp-text"/, ROWS]},
  {was: 'controls.tsx:18 Open credential editor (a secret)', place: ['credentials', escaped('Press to open Credentials.'), ROWS]},
  {was: 'controls.tsx:21 a list\'s items, × to remove one, + Add item', place: ['telemetry', /aria-label="Take out entry 1"[\s\S]*\+ Add entry/, {...ROWS, focus: 'a:b:list'}]},
  {was: 'controls.tsx:31 a table\'s switch column', place: ['permissions', /st-entries[\s\S]*dp-cell--toggle/, {...ROWS, focus: TABLE.ref}]},
  {was: 'controls.tsx:38 a table\'s dependent choices (the chosen harness\'s modes)', place: ['permissions', /<option value="plan"[^>]*>Plan<\/option>/, {...ROWS, focus: TABLE.ref}]},
  {was: 'controls.tsx:39 a table\'s list or table column', place: ['permissions', escaped('extra: a list as JSON.'), {...ROWS, focus: TABLE.ref}]},
  {was: 'controls.tsx:41 a table\'s rows, × to remove one, + to add one', place: ['permissions', /aria-label="Take out entry 1"[\s\S]*\+ Add entry/, {...ROWS, focus: TABLE.ref}]},
  {was: 'controls.tsx:45 a path, Browse…', place: ['machines', press('Choose…'), ROWS]},
  // ── HarnessPreferences.tsx ──
  {was: 'HarnessPreferences.tsx:17 Default provider for new chats', place: ['harnesses', /Default provider[\s\S]*?<select class="dp-chooser"/]},
  {was: 'HarnessPreferences.tsx:17 Apply provider default', place: ['harnesses', /<tr data-draft="true"><td><button[^>]*><b>Default provider/, {'draft:oi:harness:chat.default': 'pi'}], note: 'a local change, reviewed and applied by Review changes… (#744)'},
  {was: 'HarnessPreferences.tsx:17 Undo draft', place: ['harnesses', press('Undo'), {'draft:oi:harness:chat.default': 'pi'}]},
  {was: 'HarnessPreferences.tsx:17 Restore configured provider order', place: ['harnesses', held('Reset')]},
  {was: 'HarnessPreferences.tsx:17 Read again', place: ['harnesses', press('Read again')]},
  {was: 'HarnessPreferences.tsx:24 Install', place: ['harnesses', press('Install')]},
  {was: 'HarnessPreferences.tsx:24 install note (read detection again)', place: ['harnesses', escaped('Read detection again before you start work.')]},
  {was: 'HarnessPreferences.tsx:24 Open folder (and where it is)', place: ['harnesses', escaped('Shows its configuration folder in Finder: ~/.claude.')]},
  {was: 'HarnessPreferences.tsx:24 Authentication…', place: ['harnesses', press('Sign in…')]},
  {was: 'HarnessPreferences.tsx:17 Available model routes', place: ['harnesses', '<th>Standing</th>', {focus: 'routes'}]},
  {was: 'HarnessPreferences.tsx:24 Adapter gap', place: ['harnesses', escaped('Adapter gap|No session-settings contract for Hermes yet.')]},
  // ── OwnerPreferences.tsx: Appearance ──
  {was: 'OwnerPreferences.tsx:68 Appearance (Light, Dark, Follow system)', place: ['appearance', /<b>Theme<\/b>[\s\S]*?<option value="system"[^>]*>Follow system<\/option>/]},
  {was: 'OwnerPreferences.tsx:69 Aa (a library theme)', place: ['appearance', /<option value="ableton-dark"[^>]*>Ableton dark<\/option>/]},
  {was: 'OwnerPreferences.tsx:70 Follow system', place: ['appearance', /<option value="system"[^>]*>Follow system<\/option>/]},
  {was: 'OwnerPreferences.tsx:70 Apply appearance', place: ['appearance', /<tr data-draft="true"><td><button[^>]*><b>Theme<\/b>/, {[`draft:${THEME}`]: 'dark'}], note: 'a local change, reviewed and applied by Review changes… (#744; gap 19)'},
  {was: 'OwnerPreferences.tsx:70 Undo draft', place: ['appearance', press('Undo'), {[`draft:${THEME}`]: 'dark'}]},
  {was: 'OwnerPreferences.tsx:71 Rebase (the saved theme moved)', place: ['appearance', press('Keep'), {[`draft:${THEME}`]: 'dark', conflicts: json([THEME])}]},
  {was: 'OwnerPreferences.tsx:70 Import a theme file…', place: ['appearance', press('Import…')]},
  {was: 'OwnerPreferences.tsx:72 Manage imported themes', place: ['appearance', '<h4>Imported themes']},
  {was: 'OwnerPreferences.tsx:85 Remove… · Remove theme · Cancel', place: ['appearance', held('Remove')]},
  {was: 'OwnerPreferences.tsx:75 Read again', place: ['appearance', press('Read again')]},
  {was: 'OwnerPreferences.tsx:76 Saved appearance and renderer observations', place: ['appearance', 'revision 12 · 1 renderer observations']},
  {was: 'OwnerPreferences.tsx:79 Open Expressions', place: ['appearance', press('Open Expressions')]},
  {was: 'OwnerPreferences.tsx:96 Visual layer · Welcome scene', place: ['appearance', /Visual layer[\s\S]*Welcome scene/]},
  // ── OwnerPreferences.tsx: Credentials ──
  {was: 'OwnerPreferences.tsx:119 Retry', place: ['credentials', press('Read again')]},
  {was: 'OwnerPreferences.tsx:120 Discover credential references', place: ['credentials', press('Discover')]},
  {was: 'OwnerPreferences.tsx:123 Add a native credential binding (identity, reference)', place: ['credentials', /<span class="dp-label">Binding<\/span>[\s\S]*<span class="dp-label">Reference<\/span>[\s\S]*>Bind</, {adding: 'credential'}]},
  {was: 'OwnerPreferences.tsx:137 Verify', place: ['credentials', press('Verify')]},
  {was: 'OwnerPreferences.tsx:137 Rotate… (a new reference)', place: ['credentials', /New reference[\s\S]*>Send</, {rotating: 'ai-kit:credential:zai'}]},
  {was: 'OwnerPreferences.tsx:137 Revoke… · confirm · Cancel', place: ['credentials', held('Revoke')]},
  {was: 'OwnerPreferences.tsx:138 entry method · write-only key · Send to credential owner', place: ['credentials', press('Enter key…'), {rotating: 'ai-kit:credential:zai'}],
    note: 'the key goes to the native host\'s own secure field', dropped: 'A key you enter goes to the computer\'s own secure field and on to the credential owner, never through the window.',
    why: 'The in-window key field leaves: Enter key… opens the host\'s secure field instead.'},
  {was: 'OwnerPreferences.tsx:138 Cancel (rotate)', place: ['credentials', press('Cancel'), {rotating: 'ai-kit:credential:zai'}]},
  {was: 'OwnerPreferences.tsx:140 Connection details (reference, state, last verdict)', place: ['credentials', /keychain:\/\/aikit\/zai-coding[\s\S]*?refused[\s\S]*?20 Oct 22:40/]},
  // ── AutomationPreferences.tsx and ScheduleControl.tsx ──
  {was: 'AutomationPreferences.tsx:117 Read again', place: ['automations', press('Read again')]},
  {was: 'AutomationPreferences.tsx:117 Automation work context', place: ['automations', 'aria-label="Work context"']},
  {was: 'AutomationPreferences.tsx:118 My routines · Methods · Run history · Harness timers', place: ['automations', /Routines[\s\S]*Methods[\s\S]*Timers[\s\S]*History/]},
  {was: 'AutomationPreferences.tsx:122 Create routine…', place: ['automations', press('Create routine…')]},
  {was: 'AutomationPreferences.tsx:124 Review draft in this context', place: ['automations', escaped('Finish or cancel the routine you are making: it stays in its work context.'), fixture('A routine in the making')]},
  {was: 'AutomationPreferences.tsx:125 a routine\'s name and description', place: ['automations', /<span class="dp-label">Name<\/span>[\s\S]*<span class="dp-label">Purpose<\/span>/, fixture('A routine in the making')]},
  {was: 'AutomationPreferences.tsx:126 its Method', place: ['automations', 'aria-label="Method"', fixture('A routine in the making')]},
  {was: 'AutomationPreferences.tsx:129 its verified run', place: ['automations', 'aria-label="Verified run"', fixture('A routine in the making')]},
  {was: 'AutomationPreferences.tsx:130 its trigger', place: ['automations', /<option value="new-schedule"[^>]*>New schedule…<\/option>/, fixture('A routine in the making')]},
  {was: 'ScheduleControl.tsx:7 a new schedule: its repeat and its time, on Central\'s clock', place: ['automations', /aria-label="Repeat"[\s\S]*Uses Central&#x27;s Europe\/London clock/, fixture('A routine in the making')]},
  {was: 'AutomationPreferences.tsx:132 its authority', place: ['automations', 'aria-label="Authority"', fixture('A routine in the making')]},
  {was: 'AutomationPreferences.tsx:133 Agent and context (profile, context scopes)', place: ['automations', /aria-label="Agent profile"[\s\S]*aria-label="Context scopes"/, fixture('A routine in the making')]},
  {was: 'AutomationPreferences.tsx:136 Review creation', place: ['automations', press('Create'), fixture('A routine in the making')], note: 'AIKit checks as it creates; the form says whether the authority permits the trigger'},
  {was: 'AutomationPreferences.tsx:138 Verification and allowed actions (the creation\'s review)', place: ['automations', /<span class="dp-label">permits<\/span>/, fixture('A routine in the making')]},
  {was: 'AutomationPreferences.tsx:138 Create', place: ['automations', press('Create'), fixture('A routine in the making')]},
  {was: 'AutomationPreferences.tsx:138 Back to editing', place: ['automations', press('Cancel'), fixture('A routine in the making')], note: 'the form stays open until Create or Cancel: there is no separate review to come back from'},
  {was: 'AutomationPreferences.tsx:136 Cancel draft', place: ['automations', press('Cancel'), fixture('A routine in the making')]},
  {was: 'AutomationPreferences.tsx:137 Check creation result', place: ['automations', press('Check result'), fixture('A routine in the making')]},
  {was: 'AutomationPreferences.tsx:142 a routine, chosen', place: ['automations', /<tr data-focus="true" class="st-pick"><td><b>Morning checks/]},
  {was: 'AutomationPreferences.tsx:142 Reprove Method (on a verified run you choose)', place: ['automations', /aria-label="On"[\s\S]*>Reprove</, fixture('A routine in the making')]},
  {was: 'AutomationPreferences.tsx:142 Run now… · confirm · Cancel', place: ['automations', held('Run now')]},
  {was: 'AutomationPreferences.tsx:142 Disable… · confirm · Cancel', place: ['automations', held('Disable')]},
  {was: 'AutomationPreferences.tsx:143 Enable routine (under the authority you choose)', place: ['automations', /aria-label="Under"[\s\S]*>Enable</, fixture('A routine in the making')]},
  {was: 'AutomationPreferences.tsx:146 Method, verification and allowed actions', place: ['automations', escaped('Proof proof:oi-checks-r14.')]},
  {was: 'AutomationPreferences.tsx:149 Use this Method…', place: ['automations', press('Use…'), {show: 'methods'}]},
  {was: 'AutomationPreferences.tsx:150 Invocation and deliveries', place: ['automations', escaped('Invocation and deliveries|invocation:7f2'), {show: 'history'}]},
  {was: 'AutomationPreferences.tsx:151 Adoption requirement', place: ['automations', escaped('Adoption requirement|Adopt it with a Method'), {show: 'timers'}]},
  // ── MachinePreferences.tsx ──
  {was: 'MachinePreferences.tsx:61 Add machine…', place: ['machines', press('Add machine…')]},
  {was: 'MachinePreferences.tsx:61 Read again', place: ['machines', press('Read again')]},
  {was: 'MachinePreferences.tsx:54 a machine\'s label, endpoint, credential reference and note', place: ['machines', /Label[\s\S]*Endpoint[\s\S]*Credential[\s\S]*Note/, fixture('A machine in the making')]},
  {was: 'MachinePreferences.tsx:65 the operations you expect it to offer', place: ['machines', /aria-label="Expected operations"[\s\S]*aria-pressed="true"[^>]*>run</, fixture('A machine in the making')]},
  {was: 'MachinePreferences.tsx:67 Save', place: ['machines', press('Save'), fixture('A machine in the making')]},
  {was: 'MachinePreferences.tsx:63 Use draft with this Workcell', place: ['machines', press('Save'), fixture('A machine in the making')], code: ['../src/settings/windowPages.ts', 'press Save again to use it with this Workcell']},
  {was: 'MachinePreferences.tsx:67 Cancel draft', place: ['machines', press('Cancel'), fixture('A machine in the making')]},
  {was: 'MachinePreferences.tsx:71 Connect', place: ['machines', press('Reconnect')]},
  {was: 'MachinePreferences.tsx:71 Disconnect… · confirm · Cancel', place: ['machines', held('Disconnect')]},
  {was: 'MachinePreferences.tsx:71 Remove setup… · confirm · Cancel', place: ['machines', held('Remove')]},
  {was: 'MachinePreferences.tsx:73 Setup and connection details', place: ['machines', escaped('Protocol workcell.control/v1, remote workcell 0.1.0 (174fa1c3133a).')]},
  {was: 'MachinePreferences.tsx:76 Connections without a machine declaration', place: ['machines', 'Also connected, undeclared: studio (connected)',
    {connections: json([{label: 'omarchy', state: 'connected', granted: []}, {label: 'studio', state: 'connected', granted: []}])}]},
  // ── ProductPreferences.tsx ──
  {was: 'ProductPreferences.tsx:30 a product\'s operation', place: ['products', press('Doctor'), {product: 'ai-kit'}]},
  {was: 'ProductPreferences.tsx:30 Read products again', place: ['products', press('Read again')]},
  {was: 'ProductPreferences.tsx:30 Health, provenance and known gaps', place: ['products', /Host-process execution claims no cross-host reachability\.[\s\S]*Lifecycle intent and invoke are not disclosed/]},
  {was: 'ProductPreferences.tsx:30 Owner operation result', place: ['products', /Doctor/, {product: 'ai-kit', ran: json({product: 'ai-kit', title: 'Doctor', ok: true, at: '16:53'})}]},
  // ── ProfilePreferences.tsx ──
  {was: 'ProfilePreferences.tsx:19 Use profile…', place: ['profiles', press('Use…')]},
  {was: 'ProfilePreferences.tsx:19 New profile from valid drafts…', place: ['profiles', press('New from changes…')]},
  {was: 'ProfilePreferences.tsx:19 Profile name · Save profile · Cancel', place: ['profiles', /<span class="dp-label">Name<\/span>[\s\S]*>Save profile<[\s\S]*>Cancel</, {...ROWS, adding: 'profile'}]},
  {was: 'ProfilePreferences.tsx:19 Import profile…', place: ['profiles', press('Import…')]},
  {was: 'ProfilePreferences.tsx:19 Read profiles again', place: ['profiles', press('Read again')]},
  {was: 'ProfilePreferences.tsx:19 Settings in this profile', place: ['profiles', escaped('Settings in this profile|Native profile selection · machine · documentation')]},
]

test('every control of the window before its design has a place in the window today, or the manual line that drops it and why', () => {
  assert.ok(FUNCTIONS.length >= 100, 'the old window\'s controls are listed one by one')
  const lost = []
  for (const f of FUNCTIONS) {
    if (f.dropped) {
      assert.ok(MANUAL.includes(f.dropped.replace(/\s+/g, ' ')), `${f.was}: the manual line that drops it stands in the manual — "${f.dropped}"`)
      assert.ok(f.why, `${f.was}: why it leaves`)
    }
    if (!f.place) continue
    const [page, find, extra] = f.place
    const markup = drawn(page, extra)
    const found = typeof find === 'string' ? markup.includes(find) : find.test(markup)
    if (!found) lost.push(`${f.was} — not drawn on ${page}: ${find}`)
    if (f.code) assert.ok(source(f.code[0]).includes(f.code[1]), `${f.was}: ${f.code[1]}`)
  }
  assert.deepEqual(lost, [], 'a function with no place in the window today')
})

// ── #739 gap 19: the window's one change model, search's Enter, the way back named ─────────────────────────────────────────────────

test('gap 19 — Appearance has no Apply of its own: the theme is a row of the window\'s one change model, amber, counted, with Details and Undo', () => {
  const values = {[`draft:${THEME}`]: 'dark', details: THEME}
  const markup = drawn('appearance', values)
  assert.match(markup, /<tr data-draft="true"><td><button[^>]*><b>Theme<\/b>/, 'the amber mark on its row')
  assert.ok(markup.includes(escaped('Appearance|1 local change on this page.')), 'its page counts it')
  assert.match(markup, /<span>1 local change<\/span>/, 'the foot counts it')
  assert.match(markup, press('Undo'))
  assert.match(markup, /aria-label="Theme: details"/, 'its Details')
  const page = markup.slice(markup.indexOf('<main'), markup.indexOf('</main>'))
  assert.doesNotMatch(page, press('Apply'), 'no Apply on the page: Review changes… plans it, and Apply sends it with every other owner\'s change')
  assert.match(markup, press('Review changes…'))
})

test('gap 19 — Search follows what you type: its field sends each keystroke, so one Enter opens the result ↑/↓ marked (the window before its design did)', () => {
  const sent = []
  const p = {v: {...design.defaults, search: 'the'}, set: (key, value) => sent.push([key, value]), standing: () => ({}), setPage() {}}
  const field = settingsWindow.SearchField?.({p})
  assert.ok(field, 'the design draws Search as a field of its own (SearchField), not a field that sends only on Enter')
  const input = [field, ...[field.props.children].flat()].flatMap(node => [node, ...[node?.props?.children].flat()]).find(node => node?.type === 'input')
  assert.ok(input, 'an input')
  assert.equal(input.props.value, 'the', 'it shows the search as it stands')
  input.props.onChange({target: {value: 'them'}, currentTarget: {value: 'them'}})
  assert.deepEqual(sent, [['search', 'them']], 'each keystroke goes to the search at once: the results follow what you type')
  assert.equal(input.props.onKeyDown, undefined, 'the field keeps no Enter of its own: Enter goes to the window, which opens the marked result')
  // The window's keys (SettingsWorkspace.tsx searchKey): Enter opens the marked result; it never first waits for the field to send.
  const workspace = source('../src/settings/SettingsWorkspace.tsx')
  const keys = workspace.slice(workspace.indexOf('function searchKey'), workspace.indexOf('return <section'))
  assert.match(keys, /searchStep\(/)
  assert.doesNotMatch(keys, /field\.value !== query|refocusSearch/, 'no Enter spent sending the search')
  const markup = drawn('harnesses', {search: 'watch'})
  assert.ok(markup.includes(escaped('Search|')), 'Search says what it does on the status bar')
  assert.match(markup, /found · ↑ ↓ to move, Enter to open/)
})

test('gap 19 — the way back names the work you came from: the mode the frame stands in, unless a contextual entry names its own', async () => {
  const {returnToMode} = await import('../src/settings/host.ts')
  assert.equal(typeof returnToMode, 'function', 'the frame names its work for Settings (settings/host.ts returnToMode)')
  assert.deepEqual(['audio', 'base', 'factory', 'expressions', 'techne', 'live'].map(returnToMode),
    ['Back to Live', 'Back to Central', 'Back to Factory', 'Back to Expressions', 'Back to Technē', 'Back to Live'])
  const {SettingsWorkspace} = await import('../src/settings/SettingsWorkspace.tsx')
  const {createDevelopmentSettingsAdapter} = await import('../src/settings/development.ts')
  const open = (request, returnLabel) => {
    host.resetHost(ID)
    const markup = renderToStaticMarkup(createElement(SettingsWorkspace, {adapter: createDevelopmentSettingsAdapter('ready'), active: true, onReturn: () => {}, request, returnLabel}))
    host.resetHost(ID)
    return markup
  }
  assert.match(open(null, 'Back to Expressions'), />← Back to Expressions</, '⌘, from Expressions: the way back says Expressions')
  assert.doesNotMatch(open(null, 'Back to Expressions'), />← Back to work</)
  const {setupRequest} = await import('../src/settings/host.ts')
  assert.equal(setupRequest().returnLabel, undefined, 'Setup opened by the frame (the first opening, Add folder…) names no work of its own')
  assert.match(open(setupRequest(), 'Back to Central'), />← Back to Central</, 'the frame\'s work names it')
  assert.match(open({requestId: 'r', page: 'machines', scope: {scope_kind: 'machine', scope_ref: null}, returnLabel: 'Start work'}, 'Back to Factory'), />← Start work</,
    'a contextual entry names its own return')
  const app = source('../src/App.tsx')
  assert.match(app, /setSettingsReturnLabel\(returnToMode\(/, 'the frame publishes the work it stands in (App.tsx)')
  const foundation = source('../src/native/Foundation.tsx'), browser = source('../src/shell/ModeBrowser.tsx')
  assert.doesNotMatch(foundation + browser, /setupRequest\('Back to work'/, 'no opening says "Back to work" in the work\'s place')
})
