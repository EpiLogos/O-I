// The Settings window on its design (manual §10.10; ticket #758). The catalogue design `settings:window` draws the window on the
// binding SettingsWorkspace.tsx composes from the window's own engine and the pages it drew before, ported to hooks
// (settings/windowValues.ts, settings/windowPages.ts; the parked port 7cba70d10). Every function the window had has a place in the
// design, or leaves naming the manual line that drops it (the ticket's return, FUNCTIONS).
// Channels: SCRIPTED (the design and the window rendered to static markup through the device host; the development adapter's
// simulated answers) and CODE-DERIVED (the pure mappers on readings shaped as the owners answer them). No owner state is written.
// Not a screen pass: walking each page on the native app is the lead's.
import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync, readFileSync} from 'node:fs'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
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
const win = await import('../src/settings/windowValues.ts')
const settingsPages = await import('../src/settings/windowPages.ts')
const settingsHost = await import('../src/settings/host.ts')
const {createDevelopmentSettingsAdapter} = await import('../src/settings/development.ts')
const {design, searchResults} = await import('../src/inhabitants/catalogue/panels/settings__window.tsx')
const {initialScope, settingKey, createDraft, settingHelp} = await import('../src/settings/model.ts')

const ID = 'settings:window'
const json = value => JSON.stringify(value)
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const designKeys = d => [...new Set([...Object.keys(d.defaults), ...Object.values(d.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
/** The window's sample text, which never stands in for a reading. */
const SETTINGS_FIXTURE = /claude-opus-5-5|keychain:\/\/aikit\/anthropic|Decision provider election|en_US-norman|Archetypal|service:kev-decision/
/** One page of the window's Full, drawn by the device host on these values. */
function drawn(values, page) {
  host.resetHost(ID)
  if (page) host.setHostPage(ID, page)
  const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: {id: ID, values, standing: {}, local: {}}, view: 'full', nav: {}}))
  host.resetHost(ID)
  return markup
}

/** The engine's readings, as SettingsWorkspace.tsx reads them, through the development adapter (the native descriptor capture, simulated values). */
async function engineOver(adapter) {
  const registry = await adapter.readRegistry()
  const entries = registry.mounts.flatMap(mount => (mount.document?.sections.flatMap(section => section.settings) ?? []).map(spec => ({spec, owner: mount.owner_ref,
    available: mount.availability.state === 'available' || mount.availability.state === 'degraded', reason: mount.availability.reason})))
  const scopes = Object.fromEntries(entries.flatMap(entry => { const scope = initialScope(entry.spec, adapter.scopeChoices ?? []); return scope ? [[entry.spec.setting_ref, scope]] : [] }))
  const resolutions = await adapter.readResolutions(Object.entries(scopes).map(([setting_ref, scope]) => ({setting_ref, scope})))
  const readings = Object.fromEntries(resolutions.map(r => [settingKey(r.setting_ref, r.scope), r]))
  return {mounts: registry.mounts, entries, scopes, readings}
}
const core = (adapter, engine, more = {}) => win.windowCoreValues({adapter, mounts: engine.mounts, entries: engine.entries, readings: engine.readings, scopes: engine.scopes,
  drafts: {}, review: null, answered: null, result: null, loading: false, query: '', ...more})

// ── the classification ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('every key the design reads and every press it makes is classified — a reading, a write through its owner, the window\'s own, or refused or absent naming the op', () => {
  const w = win.SETTINGS_WINDOW_WIRING
  const placed = key => [w.reads, w.writes, w.local, w.refused, w.absent].some(table => key in table) || /^(draft|pick):/.test(key) || key.startsWith('new.')
  for (const key of designKeys(design)) assert.ok(placed(key), `${key}: classified`)
  const text = readFileSync(new URL('../src/inhabitants/catalogue/panels/settings__window.tsx', import.meta.url), 'utf8')
  const presses = [...new Set([...text.matchAll(/p\.set\('([a-zA-Z.]+)'/g)].map(match => match[1]))]
  assert.ok(presses.length > 40, 'the design\'s presses are read')
  for (const key of presses) assert.ok(placed(key), `press ${key}: classified`)
  for (const key of win.SETTINGS_LOCAL_KEYS) assert.ok(key in w.local || key.startsWith('new.'), `${key} is the window's own`)
  assert.match(w.refused.enterKey, /canEnterCredentialMaterial/, 'Enter key… waits for the host to qualify its secure field, and says so')
  // Workcell's secrets are Workcell's own (O-I #758): read and pressed through its CLI, references and presence only, never refused.
  for (const [key, route] of [['secretRefs', 'workcell secret list'], ['projections', 'workcell secret projections'], ['outside', 'workcell secret scan']])
    assert.ok(w.reads[key]?.includes(route) && !(key in w.absent), `${key}: Workcell's ${route}`)
  for (const [key, route] of [['scan', 'workcell secret scan'], ['revokeProjection', 'workcell secret revoke-projection']])
    assert.ok(w.writes[key]?.includes(route) && !(key in w.refused), `${key}: Workcell's ${route}`)
  assert.doesNotMatch(json(w), /no kernel route reaches them/, 'no stale refusal of Workcell\'s secrets')
  // What opened a new routine is the request's (a pad's Make routine, a song's Routine…), and a route's standing names where AIKit keeps it.
  assert.match(w.local['new.from'] ?? '', /SettingsRequest\.newRoutine/, 'new.from: what opened the form')
  assert.match(w.reads.routesWhy ?? '', /aikit compose/, 'a route\'s standing says why it stands unread, in AIKit\'s own terms')
  // Setup (§10.11; #738) is bound: its readings are native oi's adoption (the kernel's `setup` op) and Central's Work, its presses theirs.
  for (const key of ['setup', 'folders', 'setupPlan']) assert.ok(key in w.reads && !(key in w.absent), `${key}: Setup's reading, from its owner`)
  assert.match(w.reads.setup, /kernel op `setup`/)
  assert.match(w.reads.folders, /work\.list/)
  assert.match(w.reads.folders, /projectcentral\.inspect/)
  assert.match(w.reads.setupPlan, /projectcentral\.adopt\.preview/)
  for (const key of ['acceptStep', 'previewStep', 'rereadSetup']) assert.ok(key in w.writes && !(key in w.refused), `${key}: Setup's press goes to its owner`)
  assert.match(w.writes.acceptStep, /apply/)
  assert.match(w.writes.acceptStep, /projectcentral\.init/)
  for (const route of ['aikit init', 'aikit credential discover', 'aikit harness auth']) assert.ok(w.reads.setup.includes(route), `Setup reads ${route}`)
  assert.ok(!w.reads.setup.includes('aikit tree') && !w.writes.acceptStep.includes('aikit tree'), 'who owns each skill root is init\'s answer: Setup reads no tree')
  for (const route of ['aikit adopt', 'aikit credential setup']) assert.ok(w.writes.acceptStep.includes(route), `Accept presses ${route}`)
  assert.doesNotMatch(json(w.reads) + json(w.writes), /SETUP_UNBOUND/, 'no step of Setup stands unbound')
  assert.equal(win.NO_SETUP, undefined, 'no blanket absence of Setup stands')
  assert.ok(!('plan' in w.absent) && 'plan' in w.writes, 'Review changes… is the owners\' plan; Setup\'s preview reads `setupPlan`, never the same key')
  assert.doesNotMatch(text, /\(v, 'plan'|\(p\.v, 'plan'|set\('plan', undefined\)/, 'the design reads no preview under the key Review changes… presses')
  // A press drawn waiting shows its pressed value in place of the reading under the same key: only a toggle writes the key it reads.
  assert.deepEqual(Object.keys(w.writes).filter(key => key in w.reads || key in w.absent).sort(), ['visualLayer', 'welcome'], 'no press shares a key with a reading')
  assert.doesNotMatch(json(w), /binds only the configuration plane/, 'no stale claim that the native connector lacks the pages\' capabilities (native/configuration.ts binds them)')
})

// ── the owners' settings, as the design reads them ───────────────────────────────────────────────────────────────────────────────────

test('SCRIPTED — the owners\' settings read through the window\'s engine become the design\'s rows: the value, where it comes from, when it applies, its help, its details and its dependent choices', async () => {
  const adapter = createDevelopmentSettingsAdapter('ready')
  const engine = await engineOver(adapter)
  const {entries, scopes, readings} = engine
  assert.ok(entries.length >= 10, 'the native descriptor capture (settings/native-inventory.capture.json), through the development adapter')
  const values = core(adapter, engine)
  const rows = JSON.parse(values.settings)
  const limit = rows.find(row => row.ref === 'software-factory:telemetry:search-limit-default')
  assert.deepEqual([limit.kind, limit.category, limit.owner, limit.timing, limit.writable, limit.effective], ['number', 'telemetry', 'software-factory', 'value-change', true, 20])
  const spec = entries.find(e => e.spec.setting_ref === limit.ref).spec
  assert.equal(limit.help, settingHelp(spec), 'the help the aside gave, on the setting\'s name')
  assert.equal(limit.effect, spec.effect.summary, 'what a change does, in the owner\'s words')
  assert.equal(limit.at, 'Development specimen project', 'the scope it is read at')
  assert.match(limit.words, /telemetry/, 'what search matches beyond the title')
  // The Details the row opened: the owner's identity and place, the four axes, the reconciliation, the reading basis and the default.
  const d = limit.details
  assert.equal(d.identity, limit.ref)
  assert.match(d.where, /software-factory/)
  assert.equal(d.effective, '20')
  assert.equal(d.declared, 'Not reported', 'inherited: nothing declared at this scope')
  assert.equal(d.reconciliation, 'satisfied')
  assert.match(d.basis, /^specimen-reading-/)
  assert.equal(d.default, 'No literal default contributed')
  assert.equal(rows.find(row => row.ref === 'ai-kit:models:models.candidates').details.default, 'Computed by owner')
  assert.equal(rows.find(row => row.ref === 'ai-kit:models:models.credentials').kind, 'secret', 'a sensitive setting is a secret: its reference only')
  assert.equal(rows.find(row => row.ref === 'ai-kit:models:models.credentials').details.effective, 'Secret reference · material hidden')
  // Dependent column choices (controls.tsx's adapter.choices): the harness column's, then the mode the chosen harness advertises.
  const modes = rows.find(row => row.ref === 'ai-kit:permissions:permissions.default-mode')
  assert.equal(modes.kind, 'table')
  assert.deepEqual(modes.cells[0].harness.choices, [{value: 'specimen-harness', title: 'Specimen harness'}])
  assert.deepEqual(modes.cells[0].mode.choices, [{value: 'default', title: 'Default (advertised specimen)'}])
  assert.deepEqual(modes.clears, {harness: ['mode']}, 'a harness changed drops the mode it chose')
  const modeEntry = entries.find(e => e.spec.setting_ref === modes.ref), modeKey = settingKey(modes.ref, scopes[modes.ref])
  const moved = {[modeKey]: {...createDraft(modeEntry.spec, [{harness: 'another-harness', mode: ''}], readings[modeKey]), ownerEpoch: adapter.ownerEpoch}}
  const after = JSON.parse(core(adapter, engine, {drafts: moved}).settings).find(row => row.ref === modes.ref)
  assert.equal(after.cells[0].mode.choices, undefined)
  assert.match(after.cells[0].mode.why, /advertised modes/, 'a dependent column with nothing advertised stands closed and says why')
  assert.equal(win.windowCoreValues({adapter, mounts: engine.mounts, entries, readings, scopes, drafts: {}, review: null, answered: null, result: null, loading: true, query: ''}).settings, undefined,
    'reading the registry: absent, never a sample')
})

test('SCRIPTED — a local change, its conflict, the owners\' plans and their answer stand as the design reads them, and the answer stays beside the plans after Apply', async () => {
  const adapter = createDevelopmentSettingsAdapter('ready')
  const engine = await engineOver(adapter)
  const {entries, scopes, readings} = engine
  const entry = entries.find(e => e.spec.setting_ref === 'software-factory:telemetry:search-limit-default'), scope = scopes[entry.spec.setting_ref], key = settingKey(entry.spec.setting_ref, scope)
  const draft = {...createDraft(entry.spec, '42', readings[key]), ownerEpoch: adapter.ownerEpoch}
  const drafts = {[key]: draft}
  assert.equal(core(adapter, engine, {drafts})[`draft:${entry.spec.setting_ref}`], '42')
  assert.equal(JSON.parse(core(adapter, engine, {drafts}).settings).find(r => r.ref === entry.spec.setting_ref).details.proposed, '42', 'your change, in Details')
  assert.deepEqual(win.conflictRefs(entries, {[key]: {...draft, ownerEpoch: 'another-owner'}}, scopes, readings, adapter.ownerEpoch), [entry.spec.setting_ref], 'the owner connection changed: a conflict to keep or drop')
  const bundle = await adapter.plan([{setting_ref: entry.spec.setting_ref, scope, value: 42}], [{setting_ref: entry.spec.setting_ref, scope, reading_digest: draft.basis}])
  const reviewed = core(adapter, engine, {drafts, review: bundle})
  const plan = JSON.parse(reviewed.plans)[0]
  assert.equal(plan.ref, entry.spec.setting_ref)
  assert.equal(plan.summary, entry.spec.effect.summary, 'what the change does, in the owner\'s plan')
  const answer = await adapter.apply(bundle.plans)
  const answered = core(adapter, engine, {drafts: {}, review: null, answered: bundle, result: answer})
  assert.equal(JSON.parse(answered.plans)[0].ref, entry.spec.setting_ref, 'after Apply the plans stay, so each owner\'s answer stands beside its plan')
  assert.equal(JSON.parse(answered.result).operations[0].status, 'applied')
  // A reset answers outside any plan: its row is named by the setting's title.
  const reset = await adapter.reset({setting_ref: entry.spec.setting_ref, scope, reading_digest: null})
  assert.equal(JSON.parse(core(adapter, engine, {result: reset}).result).operations[0].title, entry.spec.title)
  // Planning refusals the owner gave without a plan.
  const refused = await createDevelopmentSettingsAdapter('refused').plan([{setting_ref: entry.spec.setting_ref, scope, value: 42}], [])
  assert.deepEqual(JSON.parse(core(adapter, engine, {review: refused}).planErrors), ['not_authorised: Development specimen: native owner refused this change.'])
  // The design draws them, on every page and its review.
  const binding = {id: ID, values: answered, standing: {}, local: {}}
  for (const page of ['harnesses', 'credentials', 'profiles', 'machines', 'automations', 'appearance', 'products', 'system', 'telemetry', 'review', 'setup']) {
    host.setHostPage(ID, page)
    for (const view of design.views) {
      const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding, view, nav: {}}))
      assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${page} ${view}: no absent key drawn as text`)
      assert.doesNotMatch(markup, /data-device-fault/, `${page} ${view}: its own view drew`)
      assert.doesNotMatch(markup, SETTINGS_FIXTURE, `${page} ${view}: its fixture never stands in`)
    }
  }
  host.setHostPage(ID, 'telemetry')
  assert.match(renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding, view: 'full', nav: {}})), new RegExp(entry.spec.title.replace(/[()]/g, '\\$&')), 'the owner\'s own title, on its page')
  host.resetHost(ID)
})

test('SCRIPTED — an owner that cannot be read stands in the head with its reason; its settings say it in Details', async () => {
  const adapter = createDevelopmentSettingsAdapter('absent-product')
  const engine = await engineOver(adapter)
  const values = core(adapter, engine)
  assert.deepEqual(JSON.parse(values.owners), [{owner: 'software-factory', reason: 'Development specimen: product is not installed.'}])
  const markup = drawn(values, 'harnesses')
  assert.ok(markup.includes(escaped('Factory: Development specimen: product is not installed.')), 'the owner and its reason, at the owners\' connection in the head')
  assert.match(markup, /1 owner unread/)
  const cut = createDevelopmentSettingsAdapter('unavailable-connection')
  const rows = JSON.parse(core(cut, await engineOver(cut)).settings)
  assert.equal(rows.find(row => row.owner === 'ai-kit').details.connection, 'Development specimen: native connection unavailable.')
})

// ── the places (each function the window had, on its design) ─────────────────────────────────────────────────────────────────────────

const ROW = {ref: 'software-factory:telemetry:watch', category: 'telemetry', owner: 'software-factory', section: 'telemetry', title: 'Watch poll interval', kind: 'number',
  writable: true, from: 'here', timing: 'value-change', effective: 5, help: 'Set the interval between telemetry watch updates.', effect: 'The next watch uses it.', at: 'Project · O-I',
  details: {identity: 'software-factory:telemetry:watch', where: 'software-factory · factory:watch', desired: 'No desired preference reported', declared: '5', effective: '5',
    provenance: 'path: /factory/config', active: '5', staged: 'Not reported', proposed: '10', default: 'Computed by owner', reconciliation: 'satisfied · ', basis: 'digest-1'}}
const SCOPE = json({kind: 'project', ref: 'O-I', title: 'Project · O-I'})

test('a setting\'s row: Undo drops its change, its name carries the help the aside gave, and Details opens the owner\'s identity, the four axes, the reconciliation, the basis and the default', () => {
  const values = {settings: json([ROW]), scope: SCOPE, scopes: json([{kind: 'project', ref: 'O-I', title: 'Project · O-I'}]), 'draft:software-factory:telemetry:watch': 10}
  const closed = drawn(values, 'telemetry')
  assert.match(closed, />Undo</, 'Undo stands on a row with a local change')
  assert.ok(closed.includes(escaped('Undo|Drops your change of this setting. Nothing was written.')))
  assert.ok(closed.includes(escaped('Watch poll interval|Set the interval between telemetry watch updates. When it applies: next resolution. The next watch uses it.')), 'the help, on the name')
  assert.doesNotMatch(closed, /Reading basis/, 'Details closed')
  const open = drawn({...values, details: ROW.ref}, 'telemetry')
  for (const word of ['Identity', 'Where', 'Your preference', 'Declared here', 'Effective', 'Active', 'Staged', 'Your change', 'Default', 'Reconciliation', 'Reading basis', 'digest-1', 'Computed by owner', 'path: /factory/config'])
    assert.ok(open.includes(escaped(word)), `Details: ${word}`)
  assert.match(open, /Applies to/, 'the scope stands on every page of owner settings')
  assert.doesNotMatch(drawn({settings: json([{...ROW, writable: false}]), scope: SCOPE}, 'telemetry'), />Undo</, 'no change, no Undo')
})

test('a table setting\'s entries take the owner\'s dependent choices: a harness\'s modes, closed with why where the harness advertises none; a record keeps its one entry', () => {
  const table = {ref: 'ai-kit:permissions:permissions.default-mode', category: 'permissions', owner: 'ai-kit', title: 'Default permission mode per harness', kind: 'table', writable: true, from: 'here',
    timing: 'session-restart-required', columns: [{name: 'harness', type: 'scalar'}, {name: 'mode', type: 'scalar'}], rows: [{harness: 'claude-code', mode: 'acceptEdits'}, {harness: 'hermes', mode: ''}],
    cells: [{harness: {choices: [{value: 'claude-code', title: 'Claude Code'}, {value: 'hermes', title: 'Hermes'}]}, mode: {choices: [{value: 'acceptEdits', title: 'Accept edits'}, {value: 'plan', title: 'Plan'}]}},
      {harness: {choices: [{value: 'claude-code', title: 'Claude Code'}, {value: 'hermes', title: 'Hermes'}]}, mode: {why: 'Read this harness\'s advertised modes first.'}}],
    clears: {harness: ['mode']}}
  const markup = drawn({settings: json([table]), scope: SCOPE, focus: table.ref}, 'permissions')
  assert.match(markup, /<option value="plan"[^>]*>Plan<\/option>/, 'the owner\'s titles for the chosen harness\'s modes')
  assert.ok(markup.includes(escaped('Read this harness\'s advertised modes first.')), 'a dependent column with nothing advertised says why')
  assert.match(markup, /\+ Add entry/)
  const record = drawn({settings: json([{...table, fixed: true, rows: [table.rows[0]], cells: [table.cells[0]]}]), scope: SCOPE, focus: table.ref}, 'permissions')
  assert.doesNotMatch(record, /\+ Add entry|Take out entry/, 'a record keeps its one entry: nothing to add or take out')
})

test('the head carries the way back, named for the work you came from, and Read again; the review keeps each plan\'s words, the reset\'s answer and the refusals without a plan', () => {
  const head = drawn({back: 'Agent setup', source: json({kind: 'native', label: 'Native owner configuration'})}, 'harnesses')
  assert.match(head, />← Agent setup</)
  assert.match(head, />Read again</)
  const review = drawn({plans: json([{ref: 'a', title: 'Watch', scope: 'This machine', changes: ['5 → 10'], effect: 'value-change', summary: 'The next watch uses it.'}]),
    result: json({status: 'partial', operations: [{ref: 'a', title: 'Watch', status: 'applied'}, {ref: 'b', title: 'Search limit', status: 'refused', message: 'Not at this scope.'}]}),
    planErrors: json(['not_authorised: The owner refused.'])}, 'review')
  assert.ok(review.includes(escaped('The next watch uses it.')), 'the plan\'s own words for what the change does')
  assert.match(review, />Search limit</, 'an answer with no plan (a Reset) stands in the same table')
  assert.ok(review.includes(escaped('Not at this scope.')))
  assert.ok(review.includes(escaped('not_authorised: The owner refused.')), 'a refusal the owner gave instead of a plan')
  assert.doesNotMatch(review, /<pre/, 'an owner\'s raw record never stands on a page (§10.10 Rules)')
})

test('Machines: Add machine records the operations you expect from the ones the workcell offers, and each machine shows what it expects and was granted', () => {
  const markup = drawn({machines: json([{label: 'omarchy', endpoint: 'host:7777', expects: ['status', 'run'], note: 'The Linux box'}]),
    connections: json([{label: 'omarchy', state: 'connected', protocol: 'workcell.control/v1', remote: 'workcell 0.1.0', granted: ['status'], expires: '2026-11-01 00:00'}]),
    adding: 'machine', operations: json(['status', 'run', 'collect']), 'new.expects': json(['run']), workcell: 'Workcell · env-1'}, 'machines')
  assert.match(markup, /aria-pressed="true"[^>]*>run</, 'an expected operation, chosen')
  assert.match(markup, /aria-pressed="false"[^>]*>collect</)
  assert.ok(markup.includes(escaped('Expects|status, run')), 'what the machine expects, named')
  assert.ok(markup.includes('workcell.control/v1') && markup.includes('2026-11-01 00:00'), 'the connection\'s protocol and grant expiry')
  assert.ok(markup.includes('The Linux box'))
  assert.ok(markup.includes('Workcell · env-1'), 'the workcell the machines apply to')
})

test('Automations: a new schedule is prepared in the form, a creation that waits is checked rather than sent twice, and the chosen routine is enabled and reproved on the receipts you choose', () => {
  const values = {routines: json([{ref: 'r1', name: 'Morning checks', state: 'stale-proof', when: 'schedule · launchd', method: 'verify', revision: 'r2', verified: false,
      next: '2026-10-29 07:30 UTC', nextRuns: ['2026-10-29 07:30 UTC', '2026-10-30 07:30 UTC'], methodText: 'Run the checks.', proof: 'proof:1', authority: 'granted · unattended'}]),
    routine: 'r1', methods: json([{method: 'verify', text: 'Run the checks.', active: true}]), adding: 'routine', 'new.method': 'verify', 'new.trigger': 'new-schedule', 'new.repeat': 'daily',
    options: json({proofs: [], triggers: [{ref: 'schedule:daily', title: 'Daily 07:30'}], authorities: [], profiles: [], scopes: [{ref: 'scope:docs', title: 'Docs'}], timezone: 'Europe/London'}),
    grants: json([{ref: 'authority:a', title: 'Unattended · checks'}]), reproofs: json([{ref: 'proof:2', title: 'verify r2 · Wed'}]),
    pendingCreation: 'Awaiting acknowledgement · AIKit is writing the routine.'}
  const markup = drawn(values, 'automations')
  assert.match(markup, /<option value="new-schedule"[^>]*>New schedule…<\/option>/)
  assert.match(markup, />Repeat</)
  assert.ok(markup.includes(escaped('Uses Central\'s Europe/London clock')), 'the schedule keeps Central\'s civil time')
  assert.match(markup, />Purpose</)
  assert.match(markup, /aria-pressed="false"[^>]*>Docs</, 'the context scopes a routine composes with')
  assert.match(markup, />Check result</, 'a creation that waits is read back, never sent again')
  assert.ok(markup.includes(escaped('Awaiting acknowledgement · AIKit is writing the routine.')))
  assert.match(markup, /<option value="authority:a"[^>]*>Unattended · checks<\/option>/, 'Enable on the authority you choose')
  assert.match(markup, /<option value="proof:2"[^>]*>verify r2 · Wed<\/option>/, 'Reprove on the verified run you choose')
  assert.ok(markup.includes('2026-10-30 07:30 UTC'), 'the next runs')
  assert.ok(markup.includes('Run the checks.'), 'the Method\'s text')
  assert.ok(markup.includes(escaped('Finish or cancel the routine you are making: it stays in its work context.')), 'a routine being made keeps its work context')
  // An appearance chosen, not saved, is a local change of the presentation owner's Theme row, dropped by its Undo (O-I #744; replaces the
  // page's own themeDraft and Apply: tests/settings-appearance-review.test.mjs).
  assert.match(drawn({theme: json({saved: 'dark'}), settings: json([{ref: 'oi:presentation:theme', category: 'appearance', owner: 'oi', title: 'Theme', kind: 'choice', writable: true,
    effective: 'dark', options: [{value: 'light', title: 'Light'}, {value: 'dark', title: 'Dark'}]}]), 'draft:oi:presentation:theme': 'light'}, 'appearance'), />Undo</, 'an appearance chosen, not saved, can be dropped')
})

test('CODE-DERIVED — Automations opened on a new routine (a pad\'s Make routine, a song\'s Routine…): the form opens on what opened it, with the name, the Method and the new schedule\'s Repeat and When it gives; every other field starts empty', () => {
  const song = {requestId: 'r1', page: 'automations', scope: {scope_kind: 'world', scope_ref: null}, returnLabel: 'Back to Songs · release-check',
    newRoutine: {from: 'Songs · release-check', name: 'release-check', method: 'skill/personal/method-release-check', repeat: 'daily', schedule: '07:30'}}
  const holds = win.automationsRequestHolds(song)
  assert.deepEqual(holds, {context: '', show: 'routines', adding: 'routine', 'new.from': 'Songs · release-check', 'new.name': 'release-check', 'new.description': undefined,
    'new.method': 'skill/personal/method-release-check', 'new.proof': undefined, 'new.trigger': 'new-schedule', 'new.repeat': 'daily', 'new.schedule': '07:30',
    'new.authority': undefined, 'new.profile': undefined, 'new.scopes': undefined})
  const pad = win.automationsRequestHolds({requestId: 'r2', page: 'automations', scope: {scope_kind: 'project', scope_ref: 'O-I'}, newRoutine: {from: 'Prompt pads · Morning checks', name: 'Morning checks'}})
  assert.deepEqual([pad.context, pad.adding, pad['new.from'], pad['new.name'], pad['new.method'], pad['new.trigger']], ['O-I', 'routine', 'Prompt pads · Morning checks', 'Morning checks', undefined, undefined],
    'a pad gives no Method and no time: both are chosen in the form, the one place a run is given a time')
  assert.deepEqual(win.automationsRequestHolds({requestId: 'r3', page: 'automations', scope: {scope_kind: 'project', scope_ref: 'O-I'}, routine: 'r1'}), {context: 'O-I', show: 'routines', routine: 'r1'},
    'a routine opened where it lives is chosen in its work context, as before')
  assert.deepEqual(win.automationsRequestHolds({requestId: 'r4', page: 'automations', scope: {scope_kind: 'project', scope_ref: 'O-I'}}), {}, 'a plain opening holds nothing')
  // Drawn: what opened it, the song's schedule, and the song's Method named with why it is not a verified Method here yet.
  const shown = Object.fromEntries(Object.entries(holds).filter(([, value]) => value !== undefined))
  const markup = drawn({...shown, methods: json([{method: 'verify', name: 'verify', text: 'Run the checks.', active: true}])}, 'automations')
  assert.ok(markup.includes('Songs · release-check'), 'from: what opened the routine')
  assert.ok(markup.includes(escaped('the song whose take it runs')), 'from says a song opens it as a pad does')
  assert.match(markup, /<input[^>]*value="07:30"/, 'When, prefilled')
  assert.match(markup, /<option value="daily" selected="">Daily<\/option>/, 'Repeat, prefilled')
  assert.match(markup, /<option value="skill\/personal\/method-release-check" disabled="" title="[^"]*Capture page[^"]*" selected="">skill\/personal\/method-release-check<\/option>/,
    'the song\'s Method stands chosen, with why it is no verified Method here yet')
  assert.ok(markup.includes('No reading of what this Method may use.') && !markup.includes('Choose a Method first.'), 'a Method chosen whose options are unread says so')
  // The opening's holds are the window's: SettingsWorkspace takes them from the request, and closing the form forgets what opened it.
  const workspace = readFileSync(new URL('../src/settings/SettingsWorkspace.tsx', import.meta.url), 'utf8')
  assert.match(workspace, /automationsRequestHolds\(request\)/)
  assert.match(workspace, /key === 'adding' && value !== 'routine'[^\n]*'new\.from'/, 'Cancel forgets what opened the form')
  const pages = readFileSync(new URL('../src/settings/windowPages.ts', import.meta.url), 'utf8')
  assert.equal((pages.match(/done\(\[\.\.\.ROUTINE_FORM\]\)/g) ?? []).length, 2, 'Create and Check result close the whole form, what opened it included')
  const chain = readFileSync(new URL('../src/agent/devices/FactoryDeviceChain.tsx', import.meta.url), 'utf8')
  assert.match(chain, /newRoutine: \{from: `Prompt pads · \$\{pad\.name \?\? `pad \$\{pad\.index \+ 1\}`\}`/, 'a pad\'s Make routine names the pad that opened it')
})

const WORKCELL_SECRETS = JSON.parse(readFileSync(new URL('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/workcell-secrets-2026-11-04.json', import.meta.url), 'utf8'))

test('CODE-DERIVED — Credentials\' Workcell secrets are Workcell\'s own readings (REAL): the references it records and where each is used, the projections its ledger holds active, and how many credentials its scan finds outside a store', () => {
  const wc = WORKCELL_SECRETS
  const values = win.workcellSecretValues({list: wc.list, projections: wc.projections, scan: wc.scan})
  assert.deepEqual(JSON.parse(values.secretRefs), [{ref: 'keychain://aikit/zai', scheme: 'keychain', usedBy: ['secret-projection:sbx-zai']},
    {ref: 'keychain://workcell-connection/omarchy', scheme: 'keychain', usedBy: ['machine:omarchy']}])
  assert.deepEqual(JSON.parse(values.projections), [{name: 'sbx-zai', to: 'allocation:sbx-1', credential: 'keychain://aikit/zai', purpose: 'provider-dispatch', scope: 'session', by: 'person:frank'}])
  assert.equal(values.outside, 2)
  assert.deepEqual(JSON.parse(win.workcellSecretValues({projections: wc.projections_after}).projections), [], 'a revoked projection is no longer projected')
  assert.deepEqual(win.workcellSecretValues({}), {}, 'an unread ledger stays absent, and the design says there is no reading')
  assert.doesNotMatch(json(values), /sk-scratch|scratch-value/, 'no value enters the window')
  const markup = drawn({...values, credentials: json([])}, 'credentials')
  for (const words of ['keychain://workcell-connection/omarchy', 'machine:omarchy', 'sbx-zai', 'allocation:sbx-1', 'provider-dispatch']) assert.ok(markup.includes(words), words)
  assert.match(markup, />Revoke</)
  assert.ok(drawn(win.workcellSecretValues({list: wc.list, projections: wc.projections_after}), 'credentials').includes('Nothing is projected.'))
})

test('SCRIPTED — Workcell secrets through the window\'s kernel channel: the references and the ledger read, Scan through Workcell\'s own scan, Revoke on the projection pressed and read back; Workcell\'s refusal in its words', async () => {
  const wc = WORKCELL_SECRETS
  const asked = []
  let ledger = wc.projections
  const adapter = {invoke: async op => {
    asked.push(op)
    if (op.op === 'workcell_read') return {outcome: {result: 'owner_route_reading', data: {'secret-list': wc.list, 'secret-projections': ledger, 'secret-scan': wc.scan}[op.request.kind]}}
    if (op.op === 'workcell_write' && op.request.name === 'sbx-zai') { ledger = wc.projections_after; return {outcome: {result: 'owner_route_reading', data: wc.revoke}} }
    return {error: wc.revoke_refusal.error.message}
  }}
  const secrets = settingsPages.workcellSecrets(adapter)
  const read = await secrets.read()
  assert.deepEqual(asked, [{op: 'workcell_read', request: {kind: 'secret-list'}}, {op: 'workcell_read', request: {kind: 'secret-projections'}}], 'the references and the ledger, never a scan unasked')
  assert.equal(JSON.parse(win.workcellSecretValues(read).projections).length, 1)
  asked.length = 0
  const scanned = await secrets.scan()
  assert.deepEqual(asked, [{op: 'workcell_read', request: {kind: 'secret-scan'}}])
  assert.equal(win.workcellSecretValues({scan: scanned}).outside, 2)
  assert.match(win.scanWords(scanned), /^Workcell's scan finds 2 credentials outside a secret store: OPENAI_API_KEY \(environment variable\), export ANTHROPIC_API_KEY \(key\/value auth file\)\. It says where each is, never what it holds\.$/)
  asked.length = 0
  assert.match(await secrets.revoke('sbx-zai'), /^Workcell revoked secret-projection:sbx-zai: its target loses it at its next use\.$/)
  assert.deepEqual(asked, [{op: 'workcell_write', request: {kind: 'revoke-projection', name: 'sbx-zai'}}])
  assert.deepEqual(JSON.parse(win.workcellSecretValues(await secrets.read()).projections), [], 'read back: nothing is projected')
  await assert.rejects(secrets.revoke('nosuch'), /no secret projection `secret-projection:nosuch` exists/)
  await assert.rejects(settingsPages.workcellSecrets({}).read(), /not connected/, 'no kernel channel: said, never an empty ledger')
  const page = readFileSync(new URL('../src/settings/windowPages.ts', import.meta.url), 'utf8')
  assert.match(page, /workcellSecrets\(source\)\.read\(\)/, 'the Credentials page reads Workcell\'s secrets when it opens')
})

test('Search: pages, settings and the settings beside their instruments are found by their words; ↑/↓ move the mark and Enter opens the one marked', () => {
  const values = {settings: json([{...ROW, words: 'refresh polling frequency'}]), elsewhere: json([{ref: 'live:delay:time', title: 'Delay time', where: 'the Delay', words: 'echo feedback'}]), search: 'polling'}
  const found = searchResults(values)
  assert.deepEqual(found.map(r => [r.kind, r.label]), [['setting', 'Watch poll interval']], 'a setting found by its owner\'s synonyms')
  assert.deepEqual(searchResults({...values, search: 'cron'}).map(r => r.label), ['Automations'], 'a page found by its words')
  assert.deepEqual(searchResults({...values, search: 'echo'}).map(r => r.label), ['Delay time'], 'a setting beside its instrument, by its description')
  assert.deepEqual(win.searchStep(3, 0, 'ArrowDown'), {hit: 1})
  assert.deepEqual(win.searchStep(3, 2, 'ArrowDown'), {hit: 2}, 'the mark stops at the last')
  assert.deepEqual(win.searchStep(3, 0, 'ArrowUp'), {hit: 0})
  assert.deepEqual(win.searchStep(3, 1, 'Enter'), {open: 1})
  assert.equal(win.searchStep(0, 0, 'Enter'), null, 'nothing found: Enter opens nothing')
  const all = searchResults({...values, search: 'e'}), at = all.findIndex(r => r.label === 'Delay time')
  assert.ok(at >= 12, 'past the first page of results')
  const marked = drawn({...values, search: 'e', hit: at}, 'harnesses')
  assert.match(marked, /<tr[^>]*data-focus="true"[^>]*>(?:(?!<\/tr>).)*Delay time/, 'the marked result, on the page the mark turned to')
})

test('Products, Profiles, Appearance: an owner\'s about, every operation of the chosen product, a profile\'s settings with their scope and value, and Open Expressions', () => {
  const products = drawn({products: json([{id: 'central', version: '0.1.0', state: 'available', about: 'Central keeps the ground.', actions: [1, 2, 3, 4].map(i => ({ref: `central.a${i}`, title: `Act ${i}`, runnable: true}))}]),
    product: 'central'}, 'products')
  assert.ok(products.includes('Central keeps the ground.'))
  assert.match(products, />Act 4</, 'the fourth operation has a place')
  const profiles = drawn({profiles: json([{ref: 'p', title: 'Build day', active: true, settings: [{ref: 'a:b:c', title: 'a:b:c', scope: 'machine', value: '10'}, {ref: 'a:b:s', title: 'a:b:s', scope: 'world', secret: true}]}])}, 'profiles')
  assert.ok(profiles.includes(escaped('a:b:c · machine · 10')) && profiles.includes(escaped('a:b:s · world · secret reference only')), 'each entry with its scope and value')
  const appearance = drawn({theme: json({saved: 'dark', revision: 'r7', observations: 2})}, 'appearance')
  assert.match(appearance, />Open Expressions</)
  assert.ok(appearance.includes(escaped('revision r7 · 2 renderer observations')))
})

// ── the readings each page's owner gives ─────────────────────────────────────────────────────────────────────────────────────────────

test('CODE-DERIVED — each page\'s owner reading becomes the design\'s keys: harnesses and routes, credentials by reference, profiles, machines, routines and timers, the theme, products and the four axes', () => {
  const reading = {kind: 'live', label: 'live', observed_at_unix_ms: 1, providers: {state: 'ok', rows: [{id: 'pi', label: 'Pi'}, {id: 'claude', label: 'Claude'}]},
    harnesses: {state: 'ok', rows: [{harness: 'Claude Code', client: 'claude-code', detection: 'binary', detected: true, detection_reason: null, config_dir_present: true, config_dir: '/Users/x/.claude (settings)', dispatch: 'acp', capability: 'descriptor', effect: 'restart Claude', items: 3, adapter_gap: null}]},
    catalogue: {state: 'ok', rows: {count: 1, entries: [{model: 'm1', name: 'Model one', source: 'aikit', routes: [{kind: 'api', provider: 'anthropic', credential_required: true}]}]}}}
  // The rows are the census's agents (O-I #1003); AIKit's client row is detail on the agent it names, and no row of its own.
  const census = {state: 'read', agents: [{slug: 'claude-code', harnessRef: 'harness/claude-code', executable: '/x/claude', starts: true, talks: true, version: '2.1.323', aikit: null},
    {slug: 'gemini', harnessRef: 'harness/gemini', executable: '/x/gemini', starts: false, talks: false, why: 'gemini did not start', aikit: null},
    {slug: 'opencode', harnessRef: 'harness/opencode', executable: '/x/opencode', starts: true, talks: false, version: '1.18.29', why: 'AIKit opens no conversation with opencode', aikit: null}]}
  const h = win.harnessValues(reading, null, census)
  const rows = JSON.parse(h.harnesses)
  // AIKit's client row says whether the harness's folder exists (`config_dir_present`), which is all its old `installed` checked.
  assert.deepEqual([rows.length, rows[0].folder, rows[0].folderPresent, rows[0].version, rows[1].why, rows[1].folderPresent, JSON.parse(h.routes)[0].routes[0]],
    [3, '/Users/x/.claude', true, '2.1.323', 'gemini did not start', undefined, {provider: 'anthropic', key: true}])
  // An agent that starts but that AIKit opens no conversation with is listed, starting, as one you cannot talk to, in AIKit's words.
  assert.deepEqual(rows.map(row => [row.agent, row.starts, row.talks]), [['claude-code', true, true], ['gemini', false, false], ['opencode', true, false]])
  assert.equal(rows[2].why, 'AIKit opens no conversation with opencode')
  assert.equal(h.providers, undefined, 'no provider rows and no chat default stand in the values')
  const c = win.credentialValues([{credential: 'ai-kit:credential:anthropic', provider: 'anthropic', reference: 'keychain://aikit/anthropic', revoked: false, verifiedAt: 1792500000}], {'ai-kit:credential:anthropic': 'working'}, 2)
  assert.deepEqual([JSON.parse(c.credentials)[0].verdict, c.found], ['working', 2])
  assert.doesNotMatch(c.credentials, /material|secret_value/, 'no material enters the values')
  assert.throws(() => settingsPages.credentialMetadata({bindings: [{}]}), /no native identity/)
  const p = win.profileValues({active_profile_ref: 'p', profiles: [{profile_ref: 'p', title: 'Build day', desired: [{setting_ref: 'a:b:c', scope: {scope_kind: 'machine', scope_ref: null}, value: 10}, {setting_ref: 'a:b:s', scope: {scope_kind: 'world', scope_ref: null}, secret_reference: {ref: 'keychain://x'}}]}]}, ref => ref === 'a:b:s')
  assert.deepEqual(JSON.parse(p.profiles)[0].settings, [{ref: 'a:b:c', title: 'a:b:c', scope: 'machine', value: '10'}, {ref: 'a:b:s', title: 'a:b:s', scope: 'world', secret: true}])
  const m = win.machineValues([{label: 'omarchy', endpoint: 'h:1', credential_ref: null, operations: ['run'], note: null}],
    [{connection_ref: 'c', label: 'omarchy', endpoint: 'h:1', protocol: 'p/1', remote_workcell_ref: null, remote_software: 'w 1', local_software: 'w 1', granted_operations: ['run'], credential_ref: null,
      state: 'connected', detail: null, connected_at_unix_ms: 1, expires_at_unix_ms: 1792500000000, last_reconciled_at_unix_ms: 1792400000000, provenance: {}}], ['status', 'run'], {scope_kind: 'workcell', scope_ref: 'env-1'})
  assert.deepEqual([JSON.parse(m.operations), JSON.parse(m.connections)[0].expires, m.workcell], [['status', 'run'], '2026-10-20 12:40', 'Workcell · env-1'])
  const list = {routines: [{routine: 'r1', name: 'Morning checks', method: 'verify', method_revision: 'abc', state: 'stale-proof', trigger: {kind: 'schedule'}, scheduler: {provider: 'launchd', observed_state: 'loaded'}}],
    foreign_reconciliation: {providers: [{provider: 'claude-code', jobs: [{job_id: 'j1', name: 'nightly', active: true, reconciled: false, reason: 'Adopt it with a proven Method.'}]}]}}
  const detail = {...list.routines[0], method_body: 'Run the checks.', authority: {authority_ref: 'a1', granted: true, unattended: true}, proof: {proof_ref: 'proof:1', verification_refs: [], evidence_refs: []},
    next_occurrences: {occurrences: [{due_unix_ms: 1792500000000}, {due_unix_ms: 1792586400000}]}}
  const a = win.automationValues({list, methods: [{id: 'm', name: 'verify', payload: 'Run the checks.', active: true}], history: [{invocation_ref: 'i1', routine_ref: 'r1', method_ref: 'verify@abc', trigger_observed_at: 'Wed 07:30',
    provider_deliveries: [{provider: 'ledger', delivery_ref: 'd1'}], outcome: {status: 'completed', detail: ''}}], detail, project: 'O-I', projects: [{ref: 'O-I', title: 'Project · O-I'}], options: null})
  const r = JSON.parse(a.routines)[0]
  assert.deepEqual([r.ref, r.state, r.when, r.verified, r.unattended, r.next, r.nextRuns.length, r.methodText, r.proof, r.scheduler], ['r1', 'stale-proof', 'schedule · launchd', false, true, '2026-10-20 12:40:00 UTC', 2, 'Run the checks.', 'proof:1', 'launchd · loaded'])
  assert.deepEqual(JSON.parse(a.timers), [{name: 'nightly', provider: 'claude-code', adopted: false, reason: 'Adopt it with a proven Method.'}], 'the harness timers are AIKit\'s own reconciliation')
  assert.deepEqual(JSON.parse(a.methods), [{method: 'm', name: 'verify', text: 'Run the checks.', active: true}], 'the Method\'s identity, its name and text')
  assert.deepEqual(JSON.parse(a.history)[0], {at: 'Wed 07:30', routine: 'Morning checks', outcome: 'completed', message: 'Run completed.', delivery: 'ledger', detail: 'i1 · verify@abc · ledger d1'},
    'each invocation, its outcome in the owner\'s words, and its deliveries')
  assert.deepEqual(JSON.parse(a.contexts), [{ref: '', title: 'This AIKit home'}, {ref: 'O-I', title: 'Project · O-I'}])
  const composition = {schema: 'oi.system-composition/v1', contract_revision: 'x', observed_at_unix_ms: 1, census: {schema: 'x', positions: []}, obligations: [], owners: [{product_id: 'central', availability: 'available', reason: null, reading_command: [], error: null,
    provenance: {observed_at_unix_ms: 1792500000000, digest: 'abc123'}, descriptor: {schema: 'oi.product-settings-disclosure/v2', product_id: 'central', about: 'Central keeps the ground.', owner: {owner_id: 'central', owner_version: '0.9'}, sections: [{id: 's', title: 'Ground', settings: [
      {key: 'root', title: 'Root', kind: 'path', axes: {declared: {value: '/Users/admin/Central'}, effective: {value: '/Users/admin/Central'}}, drift: {state: 'none'}},
      {key: 'token', title: 'Token', kind: 'secret', axes: {declared: {value: 'never'}}}]}],
      actions: [{action_ref: 'central.doctor', title: 'Doctor', availability: 'disclosed', native_path: 'ctrl doctor'}], availability: {state: 'available'}, degradations: [], obligations: ['backup']}}]}
  const pr = win.productValues(composition, settingsPages.runnableProductAction, {product: 'central', title: 'Doctor', ok: true, at: '16:53'}), s = win.systemValues(composition)
  assert.deepEqual(JSON.parse(pr.products)[0].actions, [{ref: 'central.doctor', title: 'Doctor', runnable: true}])
  assert.equal(JSON.parse(pr.products)[0].about, 'Central keeps the ground.')
  assert.equal(JSON.parse(pr.ran).at, '16:53')
  const axes = JSON.parse(s.system)[0].settings
  assert.equal(axes[0].declared.value, '/Users/admin/Central')
  assert.equal(axes[1].declared, undefined, 'a secret is presence only: its axes never enter the values')
  const doc = {theme: {appearance: 'dark', id: null}, custom_themes: [{id: 'night', name: 'Night'}], revision: 'r7', observations: {a: {}, b: {}}}
  assert.deepEqual(JSON.parse(win.appearanceValues(doc, [{id: 'oi-house', name: 'House'}]).theme), {saved: 'dark', revision: 'r7', observations: 2})
})

// ── the window itself ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('SCRIPTED — the Settings window (SettingsWorkspace) draws the design\'s Full on first opening, on Harnesses & models, reading, never a sample', async () => {
  const {SettingsWorkspace} = await import('../src/settings/SettingsWorkspace.tsx')
  host.resetHost(ID)
  const markup = renderToStaticMarkup(createElement(SettingsWorkspace, {adapter: createDevelopmentSettingsAdapter('ready'), active: true, onReturn: () => {}, request: null}))
  host.resetHost(ID)
  assert.match(markup, /data-device-view="full"/)
  assert.match(markup, /class="ref-pane-body st-window"/, 'the catalogue design draws the window')
  assert.match(markup, /aria-label="Harnesses &amp; models"/, 'a window opened over a world with its ground opens on Harnesses & models')
  // O-I #758: the registry asked and not answered yet is drawn waiting, never as a reading that is absent, and never a sample.
  assert.match(markup, /<h4>Agent settings<small><span class="dp-no-reading" data-standing="awaiting"/, 'the registry being read: drawn waiting')
  assert.doesNotMatch(markup, /No reading of the owners&#x27; settings/, 'the registry being read is not said to be absent')
  assert.match(markup, />← Back to work</, 'the way back')
  assert.doesNotMatch(markup, SETTINGS_FIXTURE)
  assert.doesNotMatch(markup, /\bNaN\b|undefined/)
})

test('the pages the window drew before are retired with the port: the design draws every page', () => {
  for (const file of ['AutomationPreferences.tsx', 'HarnessPreferences.tsx', 'MachinePreferences.tsx', 'OwnerPreferences.tsx', 'ProductPreferences.tsx', 'ProfilePreferences.tsx', 'ScheduleControl.tsx', 'controls.tsx'])
    assert.equal(existsSync(new URL(`../src/settings/${file}`, import.meta.url)), false, `${file}: ported into windowPages.ts and the design`)
  const workspace = readFileSync(new URL('../src/settings/SettingsWorkspace.tsx', import.meta.url), 'utf8')
  assert.match(workspace, /<HostedDevice designed=\{windowDesign\}/)
})

// ── Setup (manual §10.11; O-I #738) ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Native oi's adoption and Central's Work as they answer (oi setup's oi.setup/v1 documents; ctrl's work.list, projectcentral.inspect,
 * central.files.list and projectcentral.init data, shapes read from the installed owners on scratch worlds, 28 Oct). A world's folder
 * is /w/Bare; its ground, once made, /w/Bare/Central. Every request is kept, in order. */
/** A live standing grant Actuation keeps, as `authority list` lists it: held by the person, rooted at the World's root. */
const standingGrant = (worlds = ['control:root']) => [{source: 'authority-source:world-grant@control:root:1726300000', at: 1726300000, holder: 'human:owner', worlds, revoked: null}]
function scriptedSetup() {
  const calls = []
  const GROUND = '/w/Bare/Central'
  // `elsewhere`: the folders of work under the world's folder outside its ground (work.candidates), by their path relative to it;
  // `machine`: the Workcell Central's current machine is bound to (Control/machines/current.json), null until adopted.
  // `tools`: the agent tools AIKit detects, each with its folder and its skill root (names, AIKit's standing, a revision a change bumps);
  // `keys`: where AIKit's discovery finds a key (name and location, never a value); `bindings`: credential → the reference it is bound to.
  const world = {bound: null, outcome: 'new', journal: null, work: new Map(), elsewhere: new Map(), machine: null,
    workcell: {ok: true, workcell_ref: 'workcell:local', workcell_ref_source: 'default', health: 'healthy', state_root: '/w/Bare/.workcell'},
    tools: new Map(), keys: [], bindings: new Map(),
    // `zone`: this computer's IANA zone as Central reads it; `civil`: the civil-time policy the ground keeps (null: none), `civilRefused`:
    // a Central that does not answer it; `identity`: the person's saved identity profile (null until saved), `disclosure`: AIKit's.
    zone: 'Europe/London', civil: null, civilRefused: null, identity: null, identityRevision: 0, disclosure: null,
    // `placement`: the root placement policy the ground keeps (null: none); `key`: whether Central keeps the person's grant; `keeps`:
    // whether the host can keep a key here (HOME the world's folder); `keyAcceptance`, `placementAcceptance`: what each was recognised by.
    placement: null, key: false, keeps: true,
    // `form`: whether the ground keeps the Day's form (Control/forms); `formByProject`: whether its O-I project carries it instead.
    form: false, formByProject: false,
    // `extended`: the projects the person's grant and the ground's bounds reach (central.ground.project.adopt); `byHand`: a ground
    // whose key and bounds the person keeps by hand (their recognition is not Setup's), which Central never extends.
    extended: new Set(), byHand: false, adoptRefusal: null,
    // `lacks`: the root Actions Setup grants now that the person's grant lacks (a grant an older Setup founded); `agreeRefusal`: a
    // Central that refuses the agreement once.
    lacks: [], agreeRefusal: null,
    // `placed`: the projects Factory keeps (their .factory placement); `factoryRefusal`: a Factory that refuses project setup.
    placed: new Set(), factoryRefusal: null,
    // `grants`: Actuation's authority store as `authority list` lists the World's standing grants (a renewal revokes the holder's earlier
    // grant for the same root); `grantRefusal`: an Actuation that refuses grant-world once.
    grants: [], grantRefusal: null}
  const HOME = '/w/Bare'
  const digestOf = relative => `digest:${relative}:${world.elsewhere.get(relative).revision}`
  // A ground the person chose (discover's `ground`) is read where it is: new until it is the bound one.
  const discovery = (chosen = GROUND) => ({schema: 'oi.setup/v1', basis: 'basis-1', data_root: '/w/Bare/data', composition_path: '/w/Bare/.config/oi-shell-candidate/full-suite/composition.json',
    target: 'macos/aarch64', bound_ground: world.bound, suggested_ground: GROUND, selected_ground: chosen,
    ground: (chosen === GROUND ? world.outcome === 'new' : chosen !== world.bound) ? {outcome: 'new', canonical_path: chosen, note: 'Native Central initialization requires explicit review.'}
      : {outcome: 'recognized', canonical_path: chosen, identity: {device: '1', inode: '2'}, access: {readable: true, searchable: true}},
    choices: [{id: 'custom', title: 'Choose individual products', description: '', products: [], hosted: false}], products: [], warnings: [], desktop: {state: 'not-installed'}, recognition: {}})
  const adoption = {async request(request) {
    calls.push(['setup', request.action, structuredClone(request)])
    if (request.action === 'status') return {schema: 'oi.setup/v1', disposition: world.journal ? 'verified' : 'not_started', journal: world.journal}
    if (request.action === 'discover') return {schema: 'oi.setup/v1', discovery: discovery(request.ground ?? GROUND)}
    if (request.action === 'plan') {
      const now = Date.now()
      return {schema: 'oi.setup/v1', plan: {schema: 'oi.adoption-plan/v1', engagement_contract: 'oi.engagement/2026-09-18', selection: request.selection, discovery: discovery(request.selection.ground ?? GROUND),
        steps: [{title: 'Establish Central', effects: [`Ask Central to initialise ${request.selection.ground} and verify it with its native doctor.`], operation: {kind: 'establish_ground', path: request.selection.ground}},
          {title: 'Record the chosen composition', effects: [], operation: {kind: 'record_composition'}}],
        blocked: [], notices: [], review_token: 'review-1', created_at_unix_ms: now - 1, expires_at_unix_ms: now + 15 * 60 * 1000}}
    }
    if (request.action === 'apply') {
      world.bound = request.plan.selection.ground; world.outcome = 'recognized'
      world.journal = {schema: 'oi.adoption-journal/v1', plan: request.plan, records: request.plan.steps.map(() => ({state: 'verified'}))}
      return {schema: 'oi.setup/v1', disposition: 'verified', journal: world.journal}
    }
    throw new Error(`unexpected ${request.action}`)
  }}
  // Central's civil-time adoption (ctrl civil_time_adoption.rs; shapes as the built ctrl answered on a scratch world, 29 Oct).
  const civilPolicy = zone => ({automatic_day_rollover: true, day_boundary_minutes: 0, schema: 'central.civil-time-policy/v1', scope_ref: 'control:root', timezone: zone})
  const civilDigest = zone => `civil-digest:${zone}`
  const central = async (action, input) => {
    calls.push(['central', action, structuredClone(input)])
    if (action === 'central.time.policy.preview') {
      if (world.civilRefused) throw new Error(world.civilRefused)
      const state = !world.bound ? 'no-ground' : world.civil ? 'recognised' : 'absent'
      return {schema: 'central.civil-time-adoption-preview/v1', state, source_path: 'Control/user/civil-time-policy.json', policy: world.civil ?? civilPolicy(world.zone),
        timezone_source: state === 'recognised' ? null : '/etc/localtime', digest: state === 'recognised' ? null : civilDigest(world.zone), reason: null, day_boundary: 'midnight'}
    }
    if (action === 'central.time.policy.adopt') {
      if (!world.bound) throw new Error('there is no ground here yet: make the ground first, then adopt its civil-time policy')
      if (input.actor_kind !== 'human' || input.acceptance !== 'human-accepted' || !input.acceptance_ref) throw new Error('a human-adopted civil-time policy requires a declared human caller, no agent_session_ref, and acceptance human-accepted')
      if (world.civil) return {adopted: false, state: 'recognised', source_ref: 'central:source:control:root:Control/user/civil-time-policy.json', reading: {policy: world.civil}}
      if (input.expected_digest !== civilDigest(world.zone)) throw new Error('the civil-time policy Central would adopt changed since its preview (or no preview was named): preview it again. Nothing was written.')
      world.civil = civilPolicy(world.zone); world.civilAcceptance = input.acceptance_ref
      return {adopted: true, state: 'recognised', source_ref: 'central:source:control:root:Control/user/civil-time-policy.json', reading: {policy: world.civil}}
    }
    // Central's placement adoption (ctrl ground_founding.rs; shapes as the built ctrl answered on a scratch world, 29 Oct).
    if (action === 'central.ground.placement.preview') {
      const state = !world.bound ? 'no-ground' : world.placement ? 'present' : 'absent'
      return {schema: 'central.ground-placement-preview/v1', state, source_path: 'Control/user/placement.json', role: 'work-placement-policy',
        policy: {schema: 'central.work-placement-policy/v1', scope_ref: 'control:root', writable: [], enforcement: 'native-actions'}, digest: state === 'present' ? null : 'placement-digest',
        reason: state === 'present' ? 'this ground keeps a work-placement-policy source already (Control/user/placement.json): Central adopts none over it, and nothing was written' : null}
    }
    if (action === 'central.ground.placement.adopt') {
      if (!world.bound) throw new Error('there is no ground here yet: make the ground first')
      if (input.actor_kind !== 'human' || input.acceptance !== 'human-accepted' || !input.acceptance_ref) throw new Error('a human-adopted civil-time policy requires a declared human caller, no agent_session_ref, and acceptance human-accepted')
      if (world.placement) throw new Error('this ground keeps a work-placement-policy source already (Control/user/placement.json): Central adopts none over it, and nothing was written')
      if (input.expected_digest !== 'placement-digest') throw new Error('the work-placement-policy Central would adopt changed since its preview (or no preview was named): preview it again. Nothing was written.')
      world.placement = {writable: []}; world.placementAcceptance = input.acceptance_ref
      return {adopted: true, source_ref: 'central:source:control:root:Control/user/placement.json', policy_revision: 'p-1', policy: world.placement}
    }
    // Central's extension to a project (ctrl ground_projects.rs; shapes as the built ctrl answered on a scratch world, 29 Oct).
    if (action === 'central.ground.project.preview') {
      const state = !world.bound ? 'no-ground' : world.byHand ? 'hand-authored' : !world.key || !world.placement ? 'unfounded' : world.extended.has(input.project_id) ? 'present' : 'absent'
      return {schema: 'central.ground-project-preview/v1', state, project: input.project, project_id: input.project_id, project_made: !!world.work.get(input.project)?.made,
        scope_ref: `project:${input.project_id}`, member: `Work/${input.project}`, writable: {path: `Work/${input.project}`, class: 'repository'}, digest: state === 'absent' ? `extend:${input.project_id}` : null,
        reason: state === 'hand-authored' ? 'this ground\'s native-action-authority source (Control/user/native-action-authority.json) is recognised by owner-commissioned, not by Setup\'s acceptance: it is changed only by its owner, and Central extends nothing in it. Nothing was written.'
          : state === 'present' ? `you act as you in ${input.project} already, and its agents may write inside it: nothing is extended twice` : null}
    }
    if (action === 'central.ground.project.adopt') {
      if (input.actor_kind !== 'human' || input.acceptance !== 'human-accepted' || !input.acceptance_ref) throw new Error('a human-adopted civil-time policy requires a declared human caller, no agent_session_ref, and acceptance human-accepted')
      if (world.byHand) throw new Error('this ground\'s native-action-authority source is recognised by owner-commissioned, not by Setup\'s acceptance: it is changed only by its owner, and Central extends nothing in it. Nothing was written.')
      if (!world.work.get(input.project)?.made) throw new Error(`Work/${input.project} is no project yet: Central extends nothing to it until it is made. Nothing was written.`)
      if (input.expected_digest !== `extend:${input.project_id}`) throw new Error('what Central would extend changed since its preview (or no preview was named): preview it again. Nothing was written.')
      if (world.adoptRefusal) { const refusal = world.adoptRefusal; world.adoptRefusal = null; throw new Error(refusal) }
      world.extended.add(input.project_id); world.extendAcceptance = input.acceptance_ref
      return {adopted: true, project: input.project, scope_ref: `project:${input.project_id}`, member: `Work/${input.project}`, writable: [`Work/${input.project}`]}
    }
    // Central's agreement of an older grant with what Setup grants now (ctrl ground_agreement.rs; shapes as the built ctrl answered on a
    // scratch world, 30 Oct).
    if (action === 'central.ground.agreement.preview') {
      const state = !world.bound ? 'no-ground' : world.byHand ? 'hand-authored' : !world.key ? 'unfounded' : world.lacks.length ? 'absent' : 'present'
      return {schema: 'central.ground-agreement-preview/v1', state, source_path: 'Control/user/native-action-authority.json', scope_ref: 'control:root', actions: ['central.day.ensure', 'central.world.place'],
        adds: state === 'absent' ? [...world.lacks] : [], automatic_agent_or_model_invocation: false, ...(world.key ? {principal_ref: 'human:Bare'} : {}),
        digest: state === 'absent' ? `agree:${world.lacks.join(',')}` : null,
        reason: state === 'hand-authored' ? 'this ground\'s native-action-authority source (Control/user/native-action-authority.json) is recognised by owner-commissioned, not by Setup\'s acceptance: it is changed only by its owner, and Central extends nothing in it. Nothing was written.'
          : state === 'present' ? 'your grant holds every Action Setup grants at the root now: nothing is added twice'
          : state === 'unfounded' ? 'this ground keeps no native-action-authority source: Setup\'s Ground Accept keeps one first, and Central extends nothing. Nothing was written.'
          : state === 'no-ground' ? 'there is no ground here yet: make the ground first' : null}
    }
    if (action === 'central.ground.agreement.adopt') {
      if (input.actor_kind !== 'human' || input.acceptance !== 'human-accepted' || !input.acceptance_ref) throw new Error('a human-adopted civil-time policy requires a declared human caller, no agent_session_ref, and acceptance human-accepted')
      if (world.byHand) throw new Error('this ground\'s native-action-authority source is recognised by owner-commissioned, not by Setup\'s acceptance: it is changed only by its owner, and Central extends nothing in it. Nothing was written.')
      if (input.expected_digest !== `agree:${world.lacks.join(',')}`) throw new Error('what Central would bring into agreement changed since its preview (or no preview was named): preview it again. Nothing was written.')
      if (world.agreeRefusal) { const refusal = world.agreeRefusal; world.agreeRefusal = null; throw new Error(refusal) }
      const added = world.lacks; world.lacks = []; world.agreeAcceptance = input.acceptance_ref
      return {adopted: true, added, actions: ['central.day.ensure', 'central.world.place'], authority_revision: 'a-2', source_ref: 'central:source:control:root:Control/user/native-action-authority.json'}
    }
    if (!world.bound) throw new Error(`Central root does not exist as a directory: ${GROUND}`)
    const project = name => { const row = world.work.get(name); if (!row) throw new Error(`Project root does not exist as a directory: ${GROUND}/Work/${name}`); return row }
    if (action === 'work.list') return {items: [...world.work.keys()].map(name => ({name, path: `${GROUND}/Work/${name}`})), root: GROUND}
    if (action === 'projectcentral.inspect') {
      const row = project(input.project)
      return row.made ? {outcome: 'already_conformant', manifest: {schema: 'central.project/v1', project_id: input.project, human_source: 'ProjectCentral/user', wiki: {profile: 'okf-wiki/v1', source: 'ProjectCentral/agents/wiki/wiki.json'}},
        manifest_errors: [], wiki_candidates: [{source: 'ProjectCentral/agents/wiki/wiki.json', space_ref: `central:wiki:project:${input.project}`}], source_signals: [], reason: 'ProjectCentral human-source and Agent-Wiki fractal is present and readable.'}
        : {outcome: row.wikis.length === 1 ? 'bind_existing_wiki_in_place' : row.wikis.length ? 'unresolved_human_decision_required' : 'create_project_central', manifest: null, manifest_errors: [],
          wiki_candidates: row.wikis.map(source => ({source, space_ref: 'central:wiki:x'})), source_signals: [], reason: 'No compatible OKF Wiki source was found; the canonical human-source/Agent-Wiki fractal can be created around the native Project.'}
    }
    if (action === 'central.files.list') {
      const [, name, sub] = /^Work\/([^/]+)(?:\/(.*))?$/.exec(input.path)
      const row = project(name)
      const names = sub === 'ProjectCentral' ? ['agents', 'user', 'project.json'] : [...row.material, ...(row.made ? ['ProjectCentral'] : []), '.git']
      return {schema: 'central.directory-reading/v1', entries: names.map(entry => ({name: entry, kind: entry.includes('.') && entry !== '.git' ? 'file' : 'directory'}))}
    }
    if (action === 'work.candidates') return {home: HOME, ground: GROUND, max_depth: 4, visited: 12, truncated: false,
      items: [...world.elsewhere].sort(([a], [b]) => (a < b ? -1 : 1)).map(([relative, row]) => ({name: relative.split('/').pop(), path: `${HOME}/${relative}`, relative, signals: row.signals}))}
    if (action === 'work.bring.preview' || action === 'work.bring') {
      const relative = input.source_path.slice(HOME.length + 1), row = world.elsewhere.get(relative)
      if (!row) throw new Error(`Nothing stands at ${input.source_path}.`)
      const name = input.name ?? relative.split('/').pop()
      if (world.work.has(name)) throw new Error(`Work/${name} is there already: bring the folder in under another name, or adopt Work/${name} where it stands.`)
      if (action === 'work.bring.preview') return {source_path: input.source_path, name, target: `${GROUND}/Work/${name}`, target_ref: `Work/${name}`, git: row.signals.includes('git'),
        entries: {files: 9, folders: 3, links: 0, bytes: 1200}, digest: digestOf(relative),
        operations: [`Copy ${input.source_path} into your ground's Work as Work/${name}: 9 files, 3 folders and 0 links, 1200 bytes, each file's mode and modification time kept.`,
          ...(row.signals.includes('git') ? ['Its git repository (.git) comes with it: the history, the branches and the working tree as they stand.'] : []),
          `The original stays at ${input.source_path}; nothing in it moves or changes.`]}
      if (input.expected_digest !== digestOf(relative)) throw new Error(`${input.source_path} changed since its preview (or no preview was named): preview it again. Nothing was copied.`)
      world.work.set(name, {material: row.material, wikis: [], made: !!row.made})
      return {source_path: input.source_path, name, target: `${GROUND}/Work/${name}`, target_ref: `Work/${name}`, digest: input.expected_digest, verified: true, original: 'kept'}
    }
    if (action === 'machine.declaration') {
      if (!world.machine) throw new Error('Machine declaration for current is missing at Control/machines/current.json.')
      return {declaration: {schema: 'central.machine/v1', version: 1, role: input.role, capabilities: [], bindings: [{kind: 'workcell', reference: world.machine}]}, source: {path: 'Control/machines/current.json'}}
    }
    if (action === 'machine.adopt-current') {
      if (world.machine && world.machine !== input.workcell_ref) throw new Error(`Machine declaration for current already binds a different Workcell: ${world.machine}.`)
      const outcome = world.machine ? 'unchanged' : 'created'
      world.machine = input.workcell_ref
      return {schema: 'central.machine-adoption/v1', outcome, role: input.role, workcell_ref: input.workcell_ref, declaration: {role: input.role, bindings: [{kind: 'workcell', reference: world.machine}]}}
    }
    if (action === 'projectcentral.adopt.preview') return {operations: [`Keep ${input.source} in place as a participating source`, 'Create ProjectCentral/agents/wiki/wiki.json'], source: input.source, preserves_source: true}
    if (action === 'projectcentral.init' || action === 'projectcentral.adopt') {
      const row = project(input.project); row.made = true
      return {outcome: 'create_project_central', project_id: input.project_id, project_root: `${GROUND}/Work/${input.project}`, wiki_source: 'ProjectCentral/agents/wiki/wiki.json'}
    }
    throw new Error(`unexpected ${action}`)
  }
  const workcell = async () => { calls.push(['workcell']); return world.workcell }
  // AIKit as it answers through the kernel (REAL shapes: the kernel's fixture aikit-setup-harnesses-credentials-2026-10-28.json).
  const rootOf = tool => `${tool.folder}/skills`
  const aikit = async op => {
    calls.push(['aikit', op.op === 'aikit_read' || op.op === 'aikit_write' ? `${op.op} ${op.request.kind}` : op.op, structuredClone(op)])
    const tools = [...world.tools.values()]
    if (op.op === 'harness_status') return {clients: [...tools.map(tool => ({client: tool.client, harness: tool.harness, detection: 'detected', config_dir_present: true, config_dir: tool.folder,
      capability: 'descriptor', dispatch: 'client', credential: 'credential-gated'})), {client: 'codex', harness: 'codex', detection: 'not-installed', config_dir_present: false, config_dir: `${HOME}/.codex`}]}
    if (op.op === 'harness_auth_describe') {
      if (op.harness !== 'claude-code') throw new Error(`harness.unknown: no harness profile named ${op.harness}`)
      return REAL.harness_auth_claude.data
    }
    if (op.op === 'aikit_read' && op.request.kind === 'init') return {roots: tools.map(tool => ({label: `@${tool.client}`, path: rootOf(tool), skills: tool.names.length, dead_symlinks: 0, missing_frontmatter: 0, problems: 0,
      ownership: tool.standing, ...(tool.standing === 'adopted' ? {procedure: tool.procedure} : {})})), root_count: tools.length, total_skills: tools.reduce((n, tool) => n + tool.names.length, 0), total_problems: 0}
    if (op.op === 'aikit_read' && op.request.kind === 'collate') return {clusters: tools.flatMap(tool => tool.names.map(name => ({name, copies: 1, where: [{path: `${rootOf(tool)}/${name}`, root: `@${tool.client}`, version: null}]})))}
    if (op.op === 'aikit_read' && op.request.kind === 'adopt-plan') {
      const tool = tools.find(row => rootOf(row) === op.request.root)
      if (!tool) throw new Error(`adopt.no_skills: \`${op.request.root}\` contains no valid Agent Skills`)
      if (tool.standing !== 'foreign') throw new Error(REAL.adopt_plan_again.error.message)
      return {source: op.request.root, namespace: op.request.namespace, skills: tool.names.length, capsules: tool.names.map(name => `skill/${op.request.namespace}/${name}`),
        review_digest: `review:${tool.client}:${tool.revision}`, digest: `procedure:${tool.client}`, procedure: 'prc_01PLAN', applied: false, projection: null, diff: 'procedure prc_01PLAN'}
    }
    if (op.op === 'aikit_write' && op.request.kind === 'adopt') {
      const tool = tools.find(row => rootOf(row) === op.request.root)
      if (op.request.expect_digest !== `review:${tool.client}:${tool.revision}`) throw new Error('procedure.review_mismatch: the foreign root changed since it was reviewed; preview it again')
      tool.standing = 'adopted'; tool.procedure = 'prc_01ADOPT'
      return {applied: true, ownership: 'adopted', namespace: op.request.namespace, skills: tool.names.length, capsules: tool.names.map(name => `skill/${op.request.namespace}/${name}`), procedure: tool.procedure}
    }
    if (op.op === 'credential_discover') return {count: world.keys.length, findings: world.keys.map(key => ({...key, already_bound: world.bindings.has(key.proposed_credential_ref)}))}
    if (op.op === 'credential_list') return {bindings: [...world.bindings].map(([credential_ref, reference]) => ({...REAL.list_bound.data.bindings[0], credential_ref, declared_secret_ref: reference, binding_provenance: reference})),
      material_entry: {available: false}}
    if (op.op === 'credential_setup') {
      if ('material' in op) throw new Error('a key never crosses Setup')
      if (!/^(keychain|op|varlock|pass):\/\//.test(op.reference)) throw new Error('A stored secret reference names keychain://, op://, varlock:// or pass://')
      world.bindings.set(op.credential, op.reference)
      return {...REAL.setup_ref.data, credential: op.credential}
    }
    throw new Error(`unexpected ${op.op}`)
  }
  // The person's identity through the kernel's nara_identity op (desktop/cradle/kernel/src/nara_identity.rs: QL inspects, Central keeps it
  // under Control/self/nara/identities). QL refuses an empty name ("ql: invalid name", run 29 Oct) and checks the date.
  const IDENTITY_REF = 'central:source:control:root:Control/self/nara/identities/abc.json'
  const identity = async request => {
    calls.push(['identity', request.operation, structuredClone(request)])
    const reading = profile => ({schema: 'ql.nara-identity-reading/v1', person_ref: profile.person_ref, nara_ref: profile.nara_ref, profile, input_revision: 'sha256:x'})
    const source = () => ({source_ref: IDENTITY_REF, revision: `rev-${world.identityRevision}`})
    if (request.operation === 'list') return {schema: 'oi.nara-identity/v1', profiles: world.identity ? [{...source(), name: world.identity.name, person_ref: world.identity.person_ref}] : [], errors: []}
    if (request.operation === 'open') return {schema: 'oi.nara-identity/v1', reading: reading(world.identity), source: source()}
    if (request.operation === 'save') {
      const profile = request.profile
      if (profile.schema !== 'ql.nara-identity-profile/v1' || !profile.name?.trim()) throw new Error('ql: invalid name')
      if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(profile.birth?.date ?? '')) throw new Error('ql: invalid calendar birth date')
      if (world.identity && request.expected_revision !== `rev-${world.identityRevision}`) throw new Error('identity revision conflict; reopen the saved profile before replacing it')
      world.identity = profile; world.identityRevision += 1
      return {schema: 'oi.nara-identity/v1', reading: reading(profile), source: source()}
    }
    throw new Error(`unexpected identity ${request.operation}`)
  }
  // The kernel's ground_authority route (desktop/cradle/kernel/src/ground_authority.rs): Central's preview of the person's grant, and on
  // adopt the key made in the world's folder with only its digest sent to Central. Its answers carry neither key nor digest.
  const groundAuthority = async request => {
    calls.push(['key', request.operation, structuredClone(request)])
    const central = {schema: 'central.ground-authority-preview/v1', state: !world.bound ? 'no-ground' : world.key ? 'present' : 'absent', digest: world.key ? null : 'key-digest'}
    if (!world.keeps) return {schema: 'oi.ground-authority/v1', keeps: false, why: 'This window is not a world\'s own (OI_WORLD_FOLDER is not set): Central keeps your key only in a world\'s folder, never in your own home.', central}
    if (request.operation === 'preview') return {schema: 'oi.ground-authority/v1', keeps: true, principal_ref: 'human:Bare', key_stands: world.key, central}
    if (!world.bound) throw new Error('there is no ground here yet: make the ground first')
    if (world.key) return {schema: 'oi.ground-authority/v1', keeps: true, adopted: false, state: 'present', principal_ref: 'human:Bare'}
    if (request.expected_digest !== 'key-digest') throw new Error('the native-action-authority Central would adopt changed since its preview (or no preview was named): preview it again. Nothing was written.')
    world.key = true; world.keyAcceptance = request.acceptance_ref
    return {schema: 'oi.ground-authority/v1', keeps: true, adopted: true, state: 'recognised', principal_ref: 'human:Bare', source_ref: 'central:source:control:root:Control/user/native-action-authority.json', actions: 23}
  }
  // The kernel's ground_form route (desktop/cradle/kernel/src/ground_form.rs): the application's own Day form, kept through Central.
  const groundForm = async request => {
    calls.push(['form', request.operation, structuredClone(request)])
    if (world.formByProject) return {schema: 'oi.ground-form/v1', name: 'ql-daily-die.html', carried_by: 'Work/O-I/desktop/cradle/documents', kept: false, state: 'project'}
    const central = {schema: 'central.ground-form-preview/v1', state: !world.bound ? 'no-ground' : world.form ? 'present' : 'absent', source_path: 'Control/forms/ql-daily-die.html', digest: world.form ? null : 'form-digest'}
    if (request.operation === 'preview') return {schema: 'oi.ground-form/v1', name: 'ql-daily-die.html', central}
    if (!world.bound) throw new Error('there is no ground here yet: make the ground first')
    if (world.form) return {schema: 'oi.ground-form/v1', name: 'ql-daily-die.html', kept: false, state: 'present'}
    if (request.expected_digest !== 'form-digest') throw new Error('the form Central would keep changed since its preview (or no preview was named): preview it again. Nothing was written.')
    world.form = true; world.formAcceptance = request.acceptance_ref
    return {schema: 'oi.ground-form/v1', name: 'ql-daily-die.html', kept: true, state: 'present', source_path: 'Control/forms/ql-daily-die.html'}
  }
  const harnessDisclosure = async () => { calls.push(['disclosure']); if (!world.disclosure) throw new Error('aikit harness disclose did not answer'); return world.disclosure }
  // The census as the World Model answers it (`model_subscribe` agents; kernel census.rs census_of's row shape, O-I #1003): each tool
  // Actuation detects, started, with AIKit's client row on it and what it carries; `censusRefusal`: a World Model that does not answer.
  const agents = async fresh => {
    calls.push(['agents', !!fresh])
    if (world.censusRefusal) throw new Error(world.censusRefusal)
    const rows = [...world.tools.values()].map(tool => ({slug: tool.harness, harness_ref: `harness/${tool.harness}`, native_kind: 'harness', state: 'detected',
      executable: `/usr/local/bin/${tool.client}`, aikit: {client: tool.client, harness: tool.harness, detection: 'detected', config_dir_present: true, config_dir: tool.folder},
      carries: {model: {model_id: 'claude-opus-5-5'}, skills: {sets: ['foundation'], skills: ['wayfinder']},
        law: {file: 'CLAUDE.md', state: 'rendered', renderer: 'control.floor.render', statements: [{file: 'world/shape-of-the-world.md', topic: 'Shape of the world', standing: 'adopted'}]}},
      starts: true, version: '2.1.323 (Claude Code)', start_seconds: 0.4, talks: true}))
    return {schema: 'oi.world-model-slice/v1', slice: 'agents', owner: 'kernel', scopes: ['machine'], version: 1, state: 'read', error: null, read_at_unix_ms: 1,
      value: {schema: 'oi.agents-census/v1', detection_ref: 'd1', observed_at: 'now', agents: rows, not_agents: [], aikit_detail: {state: 'read'}}}
  }
  // The kernel's factory_owner for a project (desktop/cradle/kernel/src/factory.rs; shapes as the walk-bridge answered on a scratch world,
  // 29 Oct): locate (oi.factory-source-discovery/v1) and project-setup (Factory's factory.project-location/v1). A Work member that is no
  // project is outside Central's disclosed ground.
  const factory = async request => {
    calls.push(['factory', request.kind, structuredClone(request)])
    const row = world.work.get(request.project)
    if (!row?.made) throw new Error('Project is outside Central\'s disclosed ground')
    const root = `${GROUND}/Work/${request.project}`
    if (request.kind === 'locate') return {contract: 'oi.factory-source-discovery/v1', locations: [world.placed.has(request.project)
      ? {project: request.project, root, state: 'located', location: {contract: 'factory.project-location/v1', statePath: `${root}/.factory/development-state.json`, projectRef: 'project:0000000000FIELDNOTES'}}
      : {project: request.project, root, state: 'absent', error: `no .factory under ${root}`}]}
    if (request.kind === 'project-setup') {
      if (world.factoryRefusal) { const refusal = world.factoryRefusal; world.factoryRefusal = null; throw new Error(refusal) }
      const status = world.placed.has(request.project) ? 'already-present' : 'created'
      world.placed.add(request.project)
      return {contract: 'factory.project-location/v1', status, projectRoot: root, projectKey: `central-project:${request.project}`, centralProjectRef: request.project,
        statePath: `${root}/.factory/development-state.json`, runCount: 0, execution: 'not-requested'}
    }
    throw new Error(`unexpected factory ${request.kind}`)
  }
  // Actuation's Actions through the registry's door (actuation-cli authority.rs: grant-world and list, shapes as the built CLI answers).
  const act = async (action, input) => {
    calls.push(['act', action, structuredClone(input)])
    if (action === 'actuation.authority.list') return {authorities: world.grants.map(grant => ({authority_source_ref: grant.source, issued_at_unix_seconds: grant.at,
      record: {holder: grant.holder, allowed_world_refs: grant.worlds, governing_binding: {world_ref: grant.worlds[0]}}, revoked: grant.revoked ? {reason: grant.revoked} : null})), invalid: []}
    if (action === 'actuation.authority.grant-world') {
      if (world.grantRefusal) { const refusal = world.grantRefusal; world.grantRefusal = null; throw new Error(refusal) }
      const at = 1726300000 + world.grants.length + 1, source = `authority-source:world-grant@${input.world[0]}:${at}`
      for (const grant of world.grants) if (!grant.revoked && grant.holder === input.holder && grant.worlds[0] === input.world[0]) grant.revoked = `superseded by ${source}`
      world.grants.push({source, at, holder: input.holder, worlds: [...input.world], revoked: null})
      return {schema: 'actuation.local-authority/v1', issued: true, authority_source_ref: source, root_world_ref: input.world[0], allowed_world_refs: [...input.world]}
    }
    throw new Error(`Unknown action: ${action}`)
  }
  return {source: {adoption, central, act, workcell, aikit, identity, harnessDisclosure, agents, groundAuthority, groundForm, factory, groundChanged: () => calls.push(['groundChanged'])}, calls, world, GROUND, HOME}
}
/** AIKit's answers on a scratch Arriving world (REAL; the kernel's owner-route fixture, the world's folder written /w/Arriving). */
const REAL = JSON.parse(readFileSync(new URL('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/aikit-setup-harnesses-credentials-2026-10-28.json', import.meta.url), 'utf8'))
const held = values => key => values[key]
const stepOf = (values, step) => JSON.parse(values.setup).find(row => row.step === step)

test('CODE-DERIVED — Setup\'s Ground step is native oi\'s discovery: a new ground found, a recognised one adopted where it is, one Central cannot read named with its reason', () => {
  const base = {bound_ground: null, suggested_ground: '/w/Bare/Central', selected_ground: '/w/Bare/Central', ground: {outcome: 'new', canonical_path: '/w/Bare/Central'}}
  const found = win.setupValues({adoption: {discovery: base}, folders: {state: 'unread'}, plan: null}, held({}))
  assert.deepEqual(stepOf(found, 'ground').state, 'found')
  assert.equal(stepOf(found, 'ground').items[0].where, '/w/Bare/Central')
  assert.match(stepOf(found, 'ground').items[0].change, /Central makes/)
  assert.equal(found.folders, undefined, 'no Work is read before there is a ground')
  const bound = win.setupValues({adoption: {discovery: {...base, bound_ground: '/w/Bare/Central', ground: {outcome: 'recognized', canonical_path: '/w/Bare/Central', access: {readable: true, searchable: true}}}},
    folders: {state: 'read', folders: []}, plan: null}, held({}))
  assert.equal(stepOf(bound, 'ground').state, 'accepted')
  assert.deepEqual(JSON.parse(bound.folders), [], 'Work read, and empty')
  const unread = win.setupValues({adoption: {discovery: {...base, ground: {outcome: 'unavailable', reason: 'Central root recognition did not complete. No existing content was changed.'}}}, folders: {state: 'unread'}, plan: null}, held({}))
  assert.match(stepOf(unread, 'ground').items[0].why, /recognition did not complete/)
  const refused = win.setupValues({adoption: {error: 'Error: The installed O:I setup command could not start. No request was sent.'}, folders: {state: 'unread'}, plan: null}, held({}))
  assert.match(stepOf(refused, 'ground').items[0].why, /could not start/)
  assert.equal(win.setupValues({adoption: {}, folders: {state: 'unread'}, plan: null}, held({})).setup, undefined, 'not read yet: absent, never a sample')
})

test('CODE-DERIVED — Setup\'s Projects step is Central\'s Work: each folder\'s inspection, its material and its ProjectCentral; the step is accepted once a project stands with its ground', () => {
  const folders = [
    {name: 'essays', path: '/w/C/Work/essays', inspection: {outcome: 'bind_existing_wiki_in_place', manifest: null, manifest_errors: [], wiki_candidates: [{source: 'wiki/wiki.json'}]}, material: ['drafts', 'wiki'], parts: []},
    {name: 'garden', path: '/w/C/Work/garden', inspection: {outcome: 'unresolved_human_decision_required', manifest: null, manifest_errors: [], wiki_candidates: [{source: 'notes/wiki/wiki.json'}, {source: 'site/wiki/wiki.json'}]}, material: ['notes', 'site'], parts: []},
    {name: 'sketches', path: '/w/C/Work/sketches', inspection: {outcome: 'create_project_central', manifest: null, manifest_errors: [], wiki_candidates: []}, material: ['src'], parts: []},
    {name: 'lab', path: '/w/C/Work/lab', inspection: {outcome: 'unresolved_human_decision_required', manifest: null, manifest_errors: ['project.json: missing field `project_id`'], wiki_candidates: []}, material: ['runs'], parts: ['user']},
    {name: 'O-I', path: '/w/C/Work/O-I', inspection: {outcome: 'already_conformant', manifest: {wiki: {source: 'ProjectCentral/agents/wiki/wiki.json'}}, manifest_errors: [], wiki_candidates: [{source: 'ProjectCentral/agents/wiki/wiki.json'}]}, material: ['docs'], parts: ['user', 'agents', 'now']},
  ]
  const discovery = {bound_ground: '/w/C', selected_ground: '/w/C', ground: {outcome: 'recognized', canonical_path: '/w/C'}}
  const values = win.setupValues({adoption: {discovery}, folders: {state: 'read', folders}, plan: null}, held({}))
  const drawn = JSON.parse(values.folders)
  assert.deepEqual(drawn.map(f => [f.title, f.place, f.finds]), [['essays', 'work', 'one'], ['garden', 'work', 'many'], ['sketches', 'work', 'none'], ['lab', 'work', 'unreadable'], ['O-I', 'work', 'ground']])
  assert.deepEqual(drawn[0].wikis, ['wiki/wiki.json'])
  assert.deepEqual(drawn[1].wikis, ['notes/wiki/wiki.json', 'site/wiki/wiki.json'])
  assert.deepEqual(drawn[4].central, ['user', 'agents', 'wiki', 'now'], 'the ProjectCentral parts already there')
  assert.deepEqual(drawn[4].wikis, [], 'a ground in place keeps no wiki to adopt')
  assert.equal(stepOf(values, 'projects').state, 'accepted', 'a project stands with its ground')
  // The preview stands only for the folder and the choice it was asked for.
  const plan = {folder: '/w/C/Work/sketches', make: 'create', where: 'stands', lines: ['Central makes ProjectCentral round sketches']}
  assert.deepEqual(JSON.parse(win.setupValues({adoption: {discovery}, folders: {state: 'read', folders}, plan}, held({folder: '/w/C/Work/sketches', make: 'create'})).setupPlan), plan.lines)
  assert.equal(win.setupValues({adoption: {discovery}, folders: {state: 'read', folders}, plan}, held({folder: '/w/C/Work/sketches', make: 'keep'})).setupPlan, undefined)
  assert.equal(win.setupValues({adoption: {discovery}, folders: {state: 'read', folders}, plan}, held({folder: '/w/C/Work/essays', make: 'create'})).setupPlan, undefined)
})

test('SCRIPTED — Setup walked on an empty folder: Accept makes the world\'s ground through native oi (custom: Central only, the reviewed plan\'s token), and a folder of its Work becomes the first project through Central', async () => {
  const {source, calls, world, GROUND} = scriptedSetup()
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  let values = win.setupValues(walk.snapshot(), held({}))
  assert.equal(stepOf(values, 'ground').state, 'found')
  assert.equal(values.folders, undefined, 'no Work before the ground')
  await assert.rejects(walk.preview(held({make: 'create'})), /ground/i, 'Preview waits for the ground')

  const said = await walk.accept('ground', held({}))
  assert.match(said, /Central made your ground/)
  const plan = calls.find(([, action]) => action === 'plan')[2]
  assert.deepEqual(plan.selection, {composition: 'custom', ground: GROUND, desktop: 'keep', bundle: null, bundle_sha256: null, products: ['central'], remove_products: []},
    'only Central\'s ground: the desktop is a full install, and Setup adds and removes no product')
  const apply = calls.find(([, action]) => action === 'apply')[2]
  assert.equal(apply.approval, 'review-1', 'Accept applies the reviewed plan by its token')
  assert.ok(calls.some(([kind]) => kind === 'groundChanged'), 'the host reads its world again')
  values = win.setupValues(walk.snapshot(), held({}))
  assert.equal(stepOf(values, 'ground').state, 'accepted', 'read back from native oi: the ground bound and recognised')
  assert.deepEqual(JSON.parse(values.folders), [], 'Central\'s Work read: empty')
  assert.equal(stepOf(values, 'projects').state, 'found')
  await assert.rejects(walk.accept('ground', held({})), /accepted/i, 'nothing is made twice')

  // The person makes a folder in the ground's Work (the system picker's New Folder), and reads again.
  world.work.set('First project', {material: ['notes'], wikis: [], made: false})
  await walk.read()
  values = win.setupValues(walk.snapshot(), held({}))
  const [folder] = JSON.parse(values.folders)
  assert.deepEqual([folder.title, folder.finds, folder.material], ['First project', 'none', ['notes']])
  const choice = {folder: folder.path, make: 'create'}
  await assert.rejects(walk.accept('projects', held(choice)), /Preview first/)
  await walk.preview(held(choice))
  values = win.setupValues(walk.snapshot(), held(choice))
  assert.match(JSON.parse(values.setupPlan).join(' '), /projectcentral\.init/)
  assert.ok(!calls.some(([, action]) => action === 'projectcentral.init'), 'Preview changes nothing')
  const made = await walk.accept('projects', held(choice))
  assert.match(made, /First project/)
  assert.deepEqual(calls.find(([, action]) => action === 'projectcentral.init')[2], {project: 'First project', project_id: 'First project'})
  values = win.setupValues(walk.snapshot(), held(choice))
  assert.equal(JSON.parse(values.folders)[0].finds, 'ground', 'read back from Central: the ground in place')
  assert.equal(stepOf(values, 'projects').state, 'accepted')
  assert.equal(values.setupPlan, undefined, 'the preview retires with the change it previewed')
})

test('SCRIPTED — Setup\'s refusals name their owner: a step Setup does not read yet, a folder\'s wiki to choose, a project already in Work, and an Accept without its preview', async () => {
  const {source, world} = scriptedSetup()
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  await walk.accept('ground', held({}))
  world.work.set('essays', {material: ['drafts', 'wiki'], wikis: ['wiki/wiki.json'], made: false})
  world.work.set('garden', {material: ['notes', 'site'], wikis: ['notes/wiki/wiki.json', 'site/wiki/wiki.json'], made: false})
  await walk.read()
  // Bare keeps no agent tool and no key: Harnesses and skills and Credentials find nothing to bring in, and say so naming AIKit (their
  // binding: the AIKit tests below; the refusal naming an unbound step retired with SETUP_UNBOUND).
  for (const step of ['harnesses', 'credentials']) await assert.rejects(walk.accept(step, held({})), /Nothing found to bring in: AIKit/, `${step}: nothing to bring in`)
  const garden = '/w/Bare/Central/Work/garden', essays = '/w/Bare/Central/Work/essays'
  await assert.rejects(walk.preview(held({folder: garden, make: 'keep'})), /Choose the wiki/)
  await assert.rejects(walk.preview(held({folder: essays, make: 'create'})), /keeps a wiki/)
  await assert.rejects(walk.preview(held({folder: essays, make: 'keep', where: 'work'})), /stands in Work already/)
  await walk.preview(held({folder: essays, make: 'keep'}))
  assert.match(JSON.parse(win.setupValues(walk.snapshot(), held({folder: essays, make: 'keep'})).setupPlan).join(' '), /Keep wiki\/wiki\.json in place/)
  await walk.accept('projects', held({folder: essays, make: 'keep'}))
  assert.equal(JSON.parse(win.setupValues(walk.snapshot(), held({})).folders).find(f => f.title === 'essays').finds, 'ground')
})

test('CODE-DERIVED — the Projects step lists the folders of work that stand elsewhere (Central\'s work.candidates) after Work\'s own; a folder elsewhere goes Into Work unless you choose otherwise', () => {
  const discovery = {bound_ground: '/w/A/Central', selected_ground: '/w/A/Central', ground: {outcome: 'recognized', canonical_path: '/w/A/Central'}}
  const folders = [
    {name: 'sketches', path: '/w/A/Central/Work/sketches', place: 'work', inspection: {outcome: 'create_project_central', manifest: null, manifest_errors: [], wiki_candidates: []}, material: ['src'], parts: []},
    {name: 'field-notes', path: '/w/A/code/field-notes', place: 'elsewhere', relative: 'code/field-notes', signals: ['git', 'agents', 'claude'], inspection: null, material: [], parts: []},
    {name: 'essays', path: '/w/A/essays', place: 'elsewhere', relative: 'essays', signals: ['wiki'], inspection: null, material: [], parts: []},
  ]
  const snapshot = {adoption: {discovery}, folders: {state: 'read', folders}, plan: null}
  const drawn = JSON.parse(win.setupValues(snapshot, held({})).folders)
  assert.deepEqual(drawn.map(f => [f.title, f.place, f.finds]), [['sketches', 'work', 'none'], ['field-notes', 'elsewhere', 'none'], ['essays', 'elsewhere', 'one']])
  assert.deepEqual(drawn[2].wikis, ['wiki.json'], 'the OKF wiki Central found at the folder\'s top')
  assert.equal(win.setupValues(snapshot, held({})).where, undefined, 'a folder of Work: where it stands')
  assert.equal(win.setupValues(snapshot, held({folder: '/w/A/code/field-notes'})).where, 'work', 'a folder elsewhere comes Into Work')
  assert.equal(win.setupValues(snapshot, held({folder: '/w/A/code/field-notes', where: 'stands'})).where, undefined, 'your choice stands over the default')
  const refused = win.setupValues({...snapshot, folders: {state: 'read', folders: folders.slice(0, 1), elsewhere: 'work.candidates reads the folders of work under your home, and no home is known.'}}, held({}))
  assert.match(stepOf(refused, 'projects').items[0].why, /no home is known/, 'a refused reading of the folders elsewhere stands on the step in Central\'s words')
  // A folder brought in is the one shown next, until you choose another.
  const brought = win.setupValues({...snapshot, brought: '/w/A/Central/Work/field-notes', folders: {state: 'read', folders: [...folders, {name: 'field-notes', path: '/w/A/Central/Work/field-notes', place: 'work', inspection: {outcome: 'create_project_central', manifest: null, manifest_errors: [], wiki_candidates: []}, material: ['log.py'], parts: []}]}}, held({}))
  assert.equal(brought.folder, '/w/A/Central/Work/field-notes')
})

test('CODE-DERIVED — Setup\'s Machines step is Workcell\'s identity and Central\'s current machine: found until Central\'s current machine is bound to the Workcell this computer answers as', () => {
  const discovery = {bound_ground: '/w/A/Central', selected_ground: '/w/A/Central', ground: {outcome: 'recognized', canonical_path: '/w/A/Central'}}
  const base = {adoption: {discovery}, folders: {state: 'read', folders: []}, plan: null}
  const workcell = {workcell_ref: 'workcell:local', workcell_ref_source: 'default', health: 'healthy'}
  const found = stepOf(win.setupValues({...base, machine: {state: 'read', workcell, bound: []}}, held({})), 'machines')
  assert.equal(found.state, 'found')
  assert.deepEqual([found.items[0].name, found.items[0].where], ['This computer', 'workcell:local'])
  assert.match(found.items[0].change, /Central adopts this computer as your current machine, bound to Workcell workcell:local/)
  const accepted = stepOf(win.setupValues({...base, machine: {state: 'read', workcell, bound: ['workcell:local']}}, held({})), 'machines')
  assert.equal(accepted.state, 'accepted')
  const other = stepOf(win.setupValues({...base, machine: {state: 'read', workcell, bound: ['workcell:mac']}}, held({})), 'machines')
  assert.equal(other.state, 'found')
  assert.match(other.items[0].why, /bound to workcell:mac/)
  const unread = stepOf(win.setupValues({...base, machine: {state: 'read', workcell: {error: 'workcell: state root is not writable'}, bound: []}}, held({})), 'machines')
  assert.match(unread.items[0].why, /not writable/)
  assert.equal(stepOf(win.setupValues(base, held({})), 'machines'), undefined, 'not read yet: absent')
  assert.equal(win.SETUP_UNBOUND, undefined, 'every step of Setup is bound: none refuses for want of its owner')
})

test('SCRIPTED — Arriving: a folder of work that stands outside the ground is brought into Work as previewed, its original kept, and then becomes a project there', async () => {
  const {source, calls, world, GROUND, HOME} = scriptedSetup()
  world.elsewhere.set('code/field-notes', {signals: ['git', 'agents', 'claude'], material: ['AGENTS.md', 'log.py'], revision: 1})
  world.elsewhere.set('Vault', {signals: ['obsidian'], material: ['Home.md'], revision: 1})
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  assert.ok(!calls.some(([, action]) => action === 'work.candidates'), 'nothing elsewhere is read before there is a ground')
  await walk.accept('ground', held({}))
  let values = win.setupValues(walk.snapshot(), held({}))
  const folders = JSON.parse(values.folders)
  assert.deepEqual(folders.map(f => [f.title, f.place]), [['Vault', 'elsewhere'], ['field-notes', 'elsewhere']])
  const notes = `${HOME}/code/field-notes`
  await assert.rejects(walk.preview(held({folder: notes, where: 'stands'})), /Central keeps a project in your ground's Work/, 'a project stands in Work, never by reference elsewhere')
  await assert.rejects(walk.accept('projects', held({folder: notes})), /Preview first/)
  await walk.preview(held({folder: notes}))
  values = win.setupValues(walk.snapshot(), held({folder: notes}))
  const lines = JSON.parse(values.setupPlan).join(' ')
  assert.match(lines, /Copy .*code\/field-notes into your ground's Work as Work\/field-notes/)
  assert.match(lines, /git repository/)
  assert.match(lines, /original stays/)
  assert.ok(!calls.some(([, action]) => action === 'work.bring'), 'Preview changes nothing')
  // The folder changes after its preview: Accept refuses in Central's words and nothing is copied.
  world.elsewhere.get('code/field-notes').revision = 2
  await assert.rejects(walk.accept('projects', held({folder: notes})), /changed since its preview/)
  await walk.preview(held({folder: notes}))
  const said = await walk.accept('projects', held({folder: notes}))
  assert.match(said, /field-notes/)
  assert.match(said, /original stays/)
  assert.deepEqual(calls.findLast(([, action]) => action === 'work.bring')[2], {source_path: notes, expected_digest: 'digest:code/field-notes:2'})
  values = win.setupValues(walk.snapshot(), held({}))
  const brought = `${GROUND}/Work/field-notes`
  assert.equal(values.folder, brought, 'the folder brought in is shown next')
  assert.deepEqual(JSON.parse(values.folders).map(f => [f.title, f.place]), [['field-notes', 'work'], ['Vault', 'elsewhere'], ['field-notes', 'elsewhere']],
    'read back from Central: the copy stands in Work, and the original still stands where it was')
  // Then it becomes a project where it now stands.
  await walk.preview(held({make: 'create'}))
  await walk.accept('projects', held({make: 'create'}))
  assert.deepEqual(calls.find(([, action]) => action === 'projectcentral.init')[2], {project: 'field-notes', project_id: 'field-notes'})
  assert.equal(stepOf(win.setupValues(walk.snapshot(), held({})), 'projects').state, 'accepted')
  await walk.preview(held({folder: notes})).then(() => assert.fail('a second copy under the same name'), cause => assert.match(String(cause), /Work\/field-notes is there already/))
})

test('SCRIPTED — a project the person makes or brings in is theirs to act in: Preview says so in plain words, and the same Accept extends their grant and its bounds through Central, read back', async () => {
  const {source, calls, world, GROUND, HOME} = scriptedSetup()
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  await walk.accept('ground', held({}))
  assert.ok(world.key && world.placement, 'Setup\'s Ground Accept kept the person\'s key and the ground\'s bounds')
  // Made in Work: Create.
  world.work.set('field-notes', {material: ['README.md'], wikis: [], made: false})
  await walk.read()
  const folder = `${GROUND}/Work/field-notes`, choice = {folder, make: 'create'}
  await walk.preview(held(choice))
  const lines = JSON.parse(win.setupValues(walk.snapshot(), held(choice)).setupPlan)
  assert.deepEqual(lines.slice(-2), ['You act as you in field-notes, and its agents may write inside it.', 'Factory keeps field-notes\' runs and pads.'], 'said in plain words before Accept')
  assert.deepEqual(calls.findLast(([, action]) => action === 'central.ground.project.preview')[2], {project: 'field-notes', project_id: 'field-notes'})
  assert.ok(!calls.some(([, action]) => action === 'central.ground.project.adopt' || action === 'project-setup'), 'Preview changes nothing')
  const said = await walk.accept('projects', held(choice))
  assert.match(said, /Central made field-notes's ProjectCentral/)
  assert.match(said, /You act as you in field-notes, and its agents may write inside it\./)
  assert.match(said, /Factory keeps field-notes' runs and pads\./)
  assert.deepEqual(calls.find(([kind, action]) => kind === 'factory' && action === 'project-setup')[2], {kind: 'project-setup', project: 'field-notes'})
  assert.ok(world.placed.has('field-notes'), 'Factory keeps it: Prompt pads read its state')
  const [, , adopt] = calls.find(([, action]) => action === 'central.ground.project.adopt')
  assert.deepEqual({...adopt, acceptance_ref: undefined}, {actor_kind: 'human', acceptance: 'human-accepted', acceptance_ref: undefined, project: 'field-notes', project_id: 'field-notes', expected_digest: 'extend:field-notes'},
    'on the previewed digest, as the person\'s acceptance')
  assert.match(adopt.acceptance_ref, /^dlw-setup-projects-accept:/)
  const made = calls.findIndex(([, action]) => action === 'projectcentral.init'), extended = calls.findIndex(([, action]) => action === 'central.ground.project.adopt')
  assert.ok(made >= 0 && made < extended, 'the project is made first, then extended to')
  assert.ok(world.extended.has('field-notes'))

  // Brought in keeping its own ProjectCentral: the bring's Accept makes it theirs to act in.
  world.elsewhere.set('code/atlas', {signals: ['git'], material: ['AGENTS.md'], revision: 1, made: true})
  await walk.read()
  const atlas = `${HOME}/code/atlas`
  await walk.preview(held({folder: atlas}))
  assert.deepEqual(JSON.parse(win.setupValues(walk.snapshot(), held({folder: atlas})).setupPlan).slice(-2), ['Once it stands in Work as a project, you act as you in atlas, and its agents may write inside it.',
    'Once it stands in Work as a project, Factory keeps atlas\' runs and pads.'])
  const atlasSaid = await walk.accept('projects', held({folder: atlas}))
  assert.match(atlasSaid, /You act as you in atlas/)
  assert.match(atlasSaid, /Factory keeps atlas' runs and pads/)
  assert.ok(world.extended.has('atlas') && world.placed.has('atlas'))
  // Brought in as a plain folder: nothing is extended until it is made a project there.
  world.elsewhere.set('Vault', {signals: ['obsidian'], material: ['Home.md'], revision: 1})
  await walk.read()
  const vault = `${HOME}/Vault`
  await walk.preview(held({folder: vault}))
  const before = calls.filter(([, action]) => action === 'central.ground.project.adopt').length
  assert.match(await walk.accept('projects', held({folder: vault})), /once it is a project, you act as you in Vault/)
  assert.equal(calls.filter(([, action]) => action === 'central.ground.project.adopt').length, before, 'a folder that is no project is extended nothing')
  assert.ok(!world.placed.has('Vault'), 'and Factory keeps nothing of it')
})

test('SCRIPTED — the World\'s standing authority (O-I #1003): Ground grants it in Actuation, held by the person and rooted at the World\'s root; each project made theirs renews it, superseding the earlier grant; one theirs already but unnamed is left to Finish; a refusal or no Action door says why and leaves the step found', async () => {
  const {source, calls, world, GROUND} = scriptedSetup()
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  const authority = values => stepOf(values, 'ground').items.find(item => item.name === 'Your agents\' authority')
  assert.deepEqual(authority(win.setupValues(walk.snapshot(), held({}))),
    {name: 'Your agents\' authority', where: 'Actuation', adopts: true, change: 'Actuation keeps your standing authority in this world · each agent\'s Agency is minted under it'})
  assert.match(await walk.accept('ground', held({})), /Your agents act on your standing authority in this world: Actuation keeps it, and each agent's Agency is minted under it\./)
  assert.deepEqual(calls.filter(([kind, action]) => kind === 'act' && action === 'actuation.authority.grant-world').map(([, , input]) => input), [{holder: 'human:owner', world: ['control:root']}])
  let values = win.setupValues(walk.snapshot(), held({}))
  assert.equal(authority(values).change, 'Your agents act on your standing authority in this world')
  assert.equal(stepOf(values, 'ground').state, 'accepted')
  await assert.rejects(walk.accept('ground', held({})), /Nothing is made twice/)
  // A project made theirs renews it: one live grant names the root and the project, the earlier superseded, never rewritten.
  world.work.set('field-notes', {material: ['notes.md'], wikis: [], made: false})
  await walk.read()
  const create = {folder: `${GROUND}/Work/field-notes`, make: 'create'}
  await walk.preview(held(create))
  assert.match(await walk.accept('projects', held(create)), /You act as you in field-notes, and its agents may write inside it\. Your agents act on your standing authority in field-notes: Actuation keeps it/)
  assert.deepEqual(world.grants.map(grant => [grant.worlds, !!grant.revoked]), [[['control:root'], true], [['control:root', 'project:field-notes'], false]])
  assert.equal(authority(win.setupValues(walk.snapshot(), held({}))).change, 'Your agents act on your standing authority in this world and in field-notes')
  // A project theirs already (an older Setup extended it) that the grant does not name: Finish renews the grant, carrying every world forward.
  world.work.set('ledger', {material: ['a.md'], wikis: [], made: true}); world.extended.add('ledger'); world.placed.add('ledger')
  await walk.read()
  const folder = JSON.parse(win.setupValues(walk.snapshot(), held({})).folders).find(f => f.title === 'ledger')
  assert.deepEqual(folder.left, ['extension'], 'only the standing authority is left')
  const finish = {folder: `${GROUND}/Work/ledger`, make: 'finish'}
  await walk.preview(held(finish))
  assert.deepEqual(JSON.parse(win.setupValues(walk.snapshot(), held(finish)).setupPlan), ['Your agents act on your standing authority in ledger: Actuation keeps it, and each agent\'s Agency is minted under it.'])
  assert.equal(await walk.accept('projects', held(finish)), 'Your agents act on your standing authority in ledger: Actuation keeps it, and each agent\'s Agency is minted under it.')
  assert.ok(!calls.some(([, action, input]) => action === 'central.ground.project.adopt' && input.project === 'ledger'), 'Central is not asked to extend what is theirs already')
  assert.deepEqual(world.grants.filter(grant => !grant.revoked).map(grant => grant.worlds), [['control:root', 'project:field-notes', 'project:ledger']])
  // An Actuation that refuses: said in its words, and the Ground step stands found with the row to grant until Accept grants it.
  const refusing = scriptedSetup()
  refusing.world.grantRefusal = 'the authority store is not writable'
  const again = new settingsPages.SetupWalk(refusing.source)
  await again.read()
  assert.match(await again.accept('ground', held({})), /Your agents have no standing authority in this world yet: the authority store is not writable Accept again to grant it\./)
  values = win.setupValues(again.snapshot(), held({}))
  assert.equal(stepOf(values, 'ground').state, 'found')
  assert.equal(authority(values).adopts, true)
  assert.match(await again.accept('ground', held({})), /^Central keeps your ground at .* Your agents act on your standing authority in this world/)
  assert.equal(stepOf(win.setupValues(again.snapshot(), held({})), 'ground').state, 'accepted')
  // A host that hands Setup no Action door: the row says so, and the step is not accepted on it.
  const bare = scriptedSetup()
  const without = new settingsPages.SetupWalk({...bare.source, act: undefined})
  await without.read()
  assert.equal(authority(win.setupValues(without.snapshot(), held({}))).why,
    'Actuation does not say whether your agents act on your standing authority: Setup reaches no Actuation here (SetupSource.act, the kernel\'s act).')
})

test('SCRIPTED — a project its making left unfinished (made before, or its grant or placement refused) shows Finish: Accept finishes only what is left, and then nothing is', async () => {
  const {source, calls, world, GROUND} = scriptedSetup()
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  await walk.accept('ground', held({}))
  // A project made before this Accept existed: not extended to, and Factory keeps nothing of it.
  world.work.set('old-notes', {material: ['README.md'], wikis: [], made: true})
  await walk.read()
  let values = win.setupValues(walk.snapshot(), held({}))
  let folder = JSON.parse(values.folders).find(f => f.title === 'old-notes')
  assert.deepEqual([folder.finds, folder.left], ['ground', ['extension', 'placement']])
  assert.equal(stepOf(values, 'projects').state, 'found', 'not accepted while something is left')
  const finish = {folder: `${GROUND}/Work/old-notes`, make: 'finish'}
  await walk.preview(held(finish))
  assert.deepEqual(JSON.parse(win.setupValues(walk.snapshot(), held(finish)).setupPlan), ['You act as you in old-notes, and its agents may write inside it.', 'Factory keeps old-notes\' runs and pads.'])
  const said = await walk.accept('projects', held(finish))
  assert.equal(said, 'You act as you in old-notes, and its agents may write inside it. Your agents act on your standing authority in old-notes: Actuation keeps it, and each agent\'s Agency is minted under it. Factory keeps old-notes\' runs and pads.')
  assert.ok(!calls.some(([, action]) => action === 'projectcentral.init'), 'Finish makes no ProjectCentral')
  values = win.setupValues(walk.snapshot(), held({}))
  folder = JSON.parse(values.folders).find(f => f.title === 'old-notes')
  assert.equal(folder.left, undefined, 'nothing is left')
  assert.equal(stepOf(values, 'projects').state, 'accepted')
  await assert.rejects(walk.preview(held(finish)), /its ground is in place\. Nothing to make/, 'Nothing to make only once nothing is left')

  // A making whose extension Central refused: the project stands, and Finish does only the extension.
  world.work.set('tide', {material: ['log.md'], wikis: [], made: false})
  await walk.read()
  const create = {folder: `${GROUND}/Work/tide`, make: 'create'}
  await walk.preview(held(create))
  world.adoptRefusal = 'what Central would extend changed since its preview (or no preview was named): preview it again. Nothing was written.'
  assert.match(await walk.accept('projects', held(create)), /tide is not yours to act in yet: what Central would extend changed/)
  folder = JSON.parse(win.setupValues(walk.snapshot(), held({})).folders).find(f => f.title === 'tide')
  assert.deepEqual(folder.left, ['extension'], 'Factory keeps it; only the grant is left')
  const finishTide = {folder: `${GROUND}/Work/tide`, make: 'finish'}
  await walk.preview(held(finishTide))
  assert.deepEqual(JSON.parse(win.setupValues(walk.snapshot(), held(finishTide)).setupPlan), ['You act as you in tide, and its agents may write inside it.'])
  const setups = calls.filter(([, action]) => action === 'project-setup').length
  assert.equal(await walk.accept('projects', held(finishTide)), 'You act as you in tide, and its agents may write inside it. Your agents act on your standing authority in tide: Actuation keeps it, and each agent\'s Agency is minted under it.')
  assert.equal(calls.filter(([, action]) => action === 'project-setup').length, setups, 'what was not left is not made again')
  // A Factory that refused the placement leaves just that.
  world.work.set('reef', {material: ['a.md'], wikis: [], made: false})
  await walk.read()
  await walk.preview(held({folder: `${GROUND}/Work/reef`, make: 'create'}))
  world.factoryRefusal = 'factory: Factory placement refuses symlink'
  assert.match(await walk.accept('projects', held({folder: `${GROUND}/Work/reef`, make: 'create'})), /Factory does not keep reef's runs and pads yet: factory: Factory placement refuses symlink/)
  assert.deepEqual(JSON.parse(win.setupValues(walk.snapshot(), held({})).folders).find(f => f.title === 'reef').left, ['placement'])
  // The design offers Finish for it, open, and keeps the makes closed.
  const page = drawn({...win.setupValues(walk.snapshot(), held({folder: `${GROUND}/Work/reef`})), setupStep: 'projects', folder: `${GROUND}/Work/reef`}, 'setup')
  assert.ok(page.includes('Finish') && page.includes(escaped('ground in place, to finish')), 'Finish is offered and the folder says why')
})

test('SCRIPTED — a ground whose key and bounds the person keeps by hand is never extended: Preview says so, and Accept makes the project and changes nothing else', async () => {
  const {source, calls, world, GROUND} = scriptedSetup()
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  await walk.accept('ground', held({}))
  world.byHand = true
  world.work.set('sketches', {material: ['src'], wikis: [], made: false})
  await walk.read()
  const choice = {folder: `${GROUND}/Work/sketches`, make: 'create'}
  await walk.preview(held(choice))
  assert.match(JSON.parse(win.setupValues(walk.snapshot(), held(choice)).setupPlan).at(-1), /You keep your key and your ground's bounds by hand: Central extends neither to sketches/)
  const said = await walk.accept('projects', held(choice))
  assert.match(said, /Central made sketches's ProjectCentral/)
  assert.doesNotMatch(said, /You act as you/)
  assert.ok(!calls.some(([, action]) => action === 'central.ground.project.adopt'), 'Central is never asked to change what the person keeps by hand')
  // A Central that does not answer the preview: said in its words, and nothing is extended.
  const {source: older, calls: olderCalls, world: olderWorld, GROUND: olderGround} = scriptedSetup()
  const central = older.central
  older.central = async (action, input) => { if (action === 'central.ground.project.preview') throw new Error('Unknown action: central.ground.project.preview'); return central(action, input) }
  const old = new settingsPages.SetupWalk(older)
  await old.read()
  await old.accept('ground', held({}))
  olderWorld.work.set('sketches', {material: ['src'], wikis: [], made: false})
  await old.read()
  const pick = {folder: `${olderGround}/Work/sketches`, make: 'create'}
  await old.preview(held(pick))
  assert.match(JSON.parse(win.setupValues(old.snapshot(), held(pick)).setupPlan).at(-1), /Central does not say whether you act as you in sketches: Unknown action/)
  await old.accept('projects', held(pick))
  assert.ok(!olderCalls.some(([, action]) => action === 'central.ground.project.adopt'))
})

test('SCRIPTED — Machines: Accept binds Central\'s current machine to the Workcell this computer answers as, reads it back, and the host reads its world again', async () => {
  const {source, calls, world} = scriptedSetup()
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  await assert.rejects(walk.accept('machines', held({})), /Make your ground first/)
  await walk.accept('ground', held({}))
  const changed = calls.filter(([kind]) => kind === 'groundChanged').length
  let machines = stepOf(win.setupValues(walk.snapshot(), held({})), 'machines')
  assert.equal(machines.state, 'found')
  assert.equal(machines.items[0].where, 'workcell:local')
  const said = await walk.accept('machines', held({}))
  assert.match(said, /workcell:local/)
  assert.deepEqual(calls.find(([, action]) => action === 'machine.adopt-current')[2], {role: 'current', workcell_ref: 'workcell:local'})
  assert.equal(world.machine, 'workcell:local')
  machines = stepOf(win.setupValues(walk.snapshot(), held({})), 'machines')
  assert.equal(machines.state, 'accepted', 'read back from Central\'s machine declaration')
  assert.ok(calls.filter(([kind]) => kind === 'groundChanged').length > changed, 'the host reads its world again: it qualifies with the binding')
  await assert.rejects(walk.accept('machines', held({})), /Nothing is made twice/)
  // A declaration bound to another Workcell is Central's conflict, named; nothing is rebound.
  world.machine = 'workcell:mac'
  await walk.read()
  await assert.rejects(walk.accept('machines', held({})), /already binds a different Workcell: workcell:mac/)
})

test('CODE-DERIVED — Setup\'s Harnesses and skills step lists exactly the census, each agent with what it carries, and AIKit\'s reading of each agent\'s skills: found until AIKit holds every skill root, its settings and instructions left as they are', () => {
  // The agents are the census (the World Model's agents slice, O-I #1003): Actuation detects Claude Code, which started; AIKit's client row
  // on it is detail (REAL: AIKit's client status on a scratch Arriving world, where Codex is not installed and so no agent here).
  const claude = REAL.client_status.data.clients.find(row => row.client === 'claude')
  const census = {state: 'read', agents: [{slug: 'claude-code', harnessRef: 'harness/claude-code', executable: '/x/claude', starts: true, talks: true, version: '2.1.323', aikit: claude,
    carries: {model: {id: 'claude-opus-5-5'}, skills: {sets: ['foundation'], skills: ['wayfinder']}, law: {file: 'CLAUDE.md', state: 'rendered', statements: [{file: 'world/shape-of-the-world.md', topic: 'Shape of the world', standing: 'adopted'}]}}},
    {slug: 'gemini', harnessRef: 'harness/gemini', executable: '/x/gemini', starts: false, talks: false, why: 'gemini did not start', aikit: null}]}
  const base = {adoption: {}, folders: {state: 'unread'}, plan: null, agents: census}
  assert.deepEqual(win.setupAgentTools(census), [{client: 'claude', harness: 'claude-code', folder: '/w/Arriving/.claude'}], 'AIKit is asked about the census\'s agents it has a client for')
  assert.equal(win.setupSkillRoots.length, 2, 'init and collate: who owns each root is init\'s answer, no tree is read')
  const foreign = win.setupSkillRoots(REAL.init_foreign.data, REAL.collate_all.data)
  assert.deepEqual(foreign, [{label: '@claude', path: '/w/Arriving/.claude/skills', skills: 2, problems: 0, names: ['field-recording-log', 'weekly-review'], standing: 'foreign'}])
  const found = stepOf(win.setupValues({...base, harnesses: {state: 'read', roots: foreign}}, held({})), 'harnesses')
  assert.equal(found.state, 'found')
  assert.deepEqual(found.agents.map(row => [row.agent, row.starts]), [['claude-code', true], ['gemini', false]], 'exactly the census: every agent, whether it starts')
  assert.deepEqual([found.agents[0].model, found.agents[0].sets, found.agents[0].skills, found.agents[0].lawFile, found.agents[0].law.map(row => row.topic)],
    ['claude-opus-5-5', ['foundation'], ['wayfinder'], 'CLAUDE.md', ['Shape of the world']], 'what it carries: its model, its skill set and its floor\'s law')
  assert.equal(found.agents[1].model, undefined, 'an agent that does not start carries nothing')
  assert.deepEqual([found.items[0].name, found.items[0].where], ['Claude Code', '/w/Arriving/.claude/skills'])
  assert.match(found.items[0].change, /AIKit adopts its 2 skills \(field-recording-log, weekly-review\) as skill\/claude\//)
  assert.match(found.items[0].change, /Claude Code reads them where they were/)
  assert.match(found.items[0].change, /settings and instructions stay as they are/)
  const adopted = win.setupSkillRoots(REAL.init_adopted.data, REAL.collate_all.data)
  assert.equal(adopted[0].standing, 'adopted')
  assert.equal(adopted[0].procedure, REAL.adopt_applied.data.procedure, 'the Procedure AIKit adopted it by, as init names it')
  // A root projected from a native generation (AIKit's init shape: ownership generated, with its generation) is held too.
  const generated = win.setupSkillRoots({roots: [{...REAL.init_foreign.data.roots[0], ownership: 'generated', generation: 'gen_01'}]}, REAL.collate_all.data)
  assert.deepEqual([generated[0].standing, generated[0].generation, generated[0].procedure], ['generated', 'gen_01', undefined])
  // A root init names no ownership for (an AIKit older than init's ownership) is not taken as foreign: nothing is adopted on a guess.
  assert.equal(win.setupSkillRoots({roots: [{...REAL.init_foreign.data.roots[0], ownership: undefined}]}, REAL.collate_all.data)[0].standing, 'unknown')
  const accepted = stepOf(win.setupValues({...base, harnesses: {state: 'read', roots: adopted}}, held({})), 'harnesses')
  assert.equal(accepted.state, 'accepted', 'read back from AIKit: the root is adopted')
  assert.match(accepted.items[0].change, /AIKit holds its 2 skills .*adopted · procedure prc_/)
  // With nothing to adopt the step is done (#740 D), every agent still listed; AIKit's refusal stands in its words beside the agents; a
  // census not read says why; not read yet is absent.
  const bare = stepOf(win.setupValues({...base, harnesses: {state: 'read', roots: []}}, held({})), 'harnesses')
  assert.equal(bare.state, 'accepted')
  assert.match(bare.said, /^Nothing to bring in: no agent here keeps skills AIKit can adopt/)
  assert.deepEqual([bare.items, bare.agents.map(row => row.agent)], [[], ['claude-code', 'gemini']])
  const refused = stepOf(win.setupValues({...base, harnesses: {state: 'refused', error: 'AIKit\'s init did not finish'}}, held({})), 'harnesses')
  assert.match(refused.items[0].why, /did not finish/)
  assert.equal(refused.agents.length, 2, 'the agents stand by the census, not by AIKit')
  const unread = stepOf(win.setupValues({...base, agents: {state: 'unavailable', why: 'Actuation\'s detection did not answer'}, harnesses: {state: 'read', roots: foreign}}, held({})), 'harnesses')
  assert.deepEqual([unread.agents, unread.agentsWhy, unread.items[0].name], [undefined, 'Actuation\'s detection did not answer', '@claude'], 'no census: no agent is listed from anywhere else')
  assert.equal(win.setupValues(base, held({})).setup, undefined, 'not read yet: absent, never a sample')
})

test('CODE-DERIVED — Setup\'s Credentials step is where AIKit finds each provider\'s key, the place and never the value; Accept binds the key you choose by the reference you give', () => {
  const base = {adoption: {}, folders: {state: 'unread'}, plan: null}
  const providers = win.setupHarnessProviders({client: 'claude', harness: 'claude-code', folder: '/w/Arriving/.claude'}, REAL.harness_auth_claude.data)
  assert.deepEqual(providers.map(row => [row.harness, row.provider, row.envVar]), [['claude-code', 'anthropic', 'ANTHROPIC_API_KEY']])
  assert.match(providers[0].ownLogin, /claude login keeps OAuth material in its own credential store/)
  // Arriving keeps no key: Claude Code reaches Anthropic through its own login, named and left alone; nothing to bind, so done (#740 D).
  const none = stepOf(win.setupValues({...base, credentials: {state: 'read', findings: win.setupKeyFindings(REAL.discover_none.data), providers, bindings: []}}, held({})), 'credentials')
  assert.equal(none.state, 'accepted')
  assert.match(none.said, /^Nothing to bind/)
  assert.deepEqual(none.items.map(row => [row.name, !!row.why, row.credential]), [['anthropic for claude-code', true, undefined]])
  assert.match(none.items[0].why, /own credential store/)
  // A key found in the world's .env (a dummy value AIKit never reads): its place and name, the credential it would bind.
  const findings = win.setupKeyFindings(REAL.discover_found.data)
  assert.deepEqual(findings, [{source: 'project-env', location: '/w/Arriving/.env', name: 'ANTHROPIC_API_KEY', credential: 'credential:anthropic', bound: false}])
  assert.doesNotMatch(JSON.stringify(REAL.discover_found), /scratch-dummy/, 'discovery carries no value')
  const reading = {state: 'read', findings, providers, bindings: []}
  const found = stepOf(win.setupValues({...base, credentials: reading}, held({})), 'credentials')
  assert.equal(found.state, 'found')
  assert.deepEqual([found.items[0].name, found.items[0].where, found.items[0].credential], ['ANTHROPIC_API_KEY', '/w/Arriving/.env', 'credential:anthropic'])
  assert.match(found.items[0].change, /AIKit binds credential:anthropic by the reference you give/)
  assert.equal(found.items.length, 1, 'the provider Claude Code reaches is covered by the key found')
  const given = stepOf(win.setupValues({...base, credentials: reading}, held({credential: 'credential:anthropic', reference: 'op://Scratch/anthropic/credential'})), 'credentials')
  assert.match(given.items[0].change, /AIKit binds credential:anthropic to op:\/\/Scratch\/anthropic\/credential/, 'the reference you give stands in the change Accept makes')
  // Bound (AIKit's list read back): accepted, by its reference.
  const bindings = settingsPages.credentialMetadata(REAL.list_bound.data)
  const accepted = stepOf(win.setupValues({...base, credentials: {state: 'read', findings: win.setupKeyFindings(REAL.discover_bound.data), providers, bindings}}, held({})), 'credentials')
  assert.equal(accepted.state, 'accepted')
  assert.equal(accepted.items[0].bound, true)
  assert.match(accepted.items[0].change, /bound by reference to op:\/\/Scratch\/anthropic\/credential/)
  assert.equal(win.setupValues(base, held({})).setup, undefined, 'not read yet: absent')
})

test('SCRIPTED — Harnesses and skills: Accept adopts each agent tool\'s skill root through AIKit\'s reviewed plan, reads it back adopted, and makes nothing twice', async () => {
  const {source, calls, world, HOME} = scriptedSetup()
  world.tools.set('claude', {client: 'claude', harness: 'claude-code', folder: `${HOME}/.claude`, names: ['field-recording-log', 'weekly-review'], standing: 'foreign', revision: 1})
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  // AIKit's routes run from the world's ground (the kernel's route_ground): before there is one, the step is not read, and says why.
  assert.equal(stepOf(win.setupValues(walk.snapshot(), held({})), 'harnesses'), undefined, 'no ground yet: not read')
  assert.ok(!calls.some(([kind]) => kind === 'aikit'), 'AIKit is not asked before there is a ground')
  await assert.rejects(walk.accept('harnesses', held({})), /Make your ground first/)
  await walk.accept('ground', held({}))
  let step = stepOf(win.setupValues(walk.snapshot(), held({})), 'harnesses')
  assert.equal(step.state, 'found', 'read once the ground is made')
  assert.ok(!calls.some(([, kind]) => kind === 'aikit_read adopt-plan' || kind === 'aikit_write adopt'), 'reading plans and adopts nothing')
  // The root changes after it was read: AIKit's plan adopts what is there now, so Accept refuses and adopts nothing.
  world.tools.get('claude').names.push('field-trip')
  await assert.rejects(walk.accept('harnesses', held({})), /changed since it was read/)
  assert.ok(!calls.some(([, kind]) => kind === 'aikit_write adopt'), 'nothing was adopted')
  world.tools.get('claude').names.pop()
  await walk.read()
  const said = await walk.accept('harnesses', held({}))
  assert.match(said, /AIKit adopted 2 skills from Claude Code/)
  assert.match(said, /reads them where they were/)
  assert.ok(calls.some(([kind]) => kind === 'agents'), 'the agents are read from the census')
  await walk.read({fresh: true})
  assert.deepEqual(calls.filter(([kind]) => kind === 'agents').at(-1), ['agents', true], 'Read again asks the census afresh')
  assert.ok(!calls.some(([kind, op]) => kind === 'aikit' && op === 'harness_status'), 'AIKit\'s own client list names no agent of Setup\'s')
  const plan = calls.find(([, kind]) => kind === 'aikit_read adopt-plan')[2].request
  assert.deepEqual(plan, {kind: 'adopt-plan', root: `${HOME}/.claude/skills`, namespace: 'claude'})
  const adopt = calls.find(([, kind]) => kind === 'aikit_write adopt')[2].request
  assert.deepEqual(adopt, {kind: 'adopt', root: `${HOME}/.claude/skills`, namespace: 'claude', expect_digest: 'review:claude:1'}, 'the plan\'s review digest: AIKit applies only the bytes it surveyed')
  step = stepOf(win.setupValues(walk.snapshot(), held({})), 'harnesses')
  assert.equal(step.state, 'accepted', 'read back from AIKit\'s init: adopted')
  await assert.rejects(walk.accept('harnesses', held({})), /Nothing is made twice/)
  assert.equal(calls.filter(([, kind]) => kind === 'aikit_write adopt').length, 1)
  assert.ok(!calls.some(([, kind]) => kind === 'aikit_read tree'), 'Setup reads init alone for who owns each root')
})

test('SCRIPTED — Credentials: Accept binds the key you choose by the reference you give, never the key itself, reads it back bound, and makes nothing twice', async () => {
  const {source, calls, world, HOME} = scriptedSetup()
  world.tools.set('claude', {client: 'claude', harness: 'claude-code', folder: `${HOME}/.claude`, names: [], standing: 'foreign', revision: 1})
  world.keys.push({source: 'project-env', location: `${HOME}/.env`, name: 'ANTHROPIC_API_KEY', proposed_credential_ref: 'credential:anthropic', proposed_env_var: 'ANTHROPIC_API_KEY'})
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  await assert.rejects(walk.accept('credentials', held({})), /Make your ground first/)
  await walk.accept('ground', held({}))
  let step = stepOf(win.setupValues(walk.snapshot(), held({})), 'credentials')
  assert.equal(step.state, 'found')
  assert.equal(step.items[0].credential, 'credential:anthropic')
  const sent = () => calls.filter(([, kind]) => kind === 'credential_setup')
  await assert.rejects(walk.accept('credentials', held({})), /Give where the key lies in your secure store/)
  for (const reference of ['sk-ant-api03-not-a-reference', 'env://ANTHROPIC_API_KEY', 'file:///w/.env']) {
    await assert.rejects(walk.accept('credentials', held({reference})), /never the key itself/i, `${reference}: refused before anything is sent`)
  }
  assert.equal(sent().length, 0, 'nothing was sent to AIKit')
  const choice = {credential: 'credential:anthropic', reference: 'op://Scratch/anthropic/credential'}
  const said = await walk.accept('credentials', held(choice))
  assert.match(said, /AIKit bound credential:anthropic by reference/)
  assert.match(said, /never shows it and never keeps it/)
  assert.deepEqual(sent()[0][2], {op: 'credential_setup', credential: 'credential:anthropic', reference: 'op://Scratch/anthropic/credential'}, 'a reference, and no material')
  step = stepOf(win.setupValues(walk.snapshot(), held({})), 'credentials')
  assert.equal(step.state, 'accepted', 'read back from AIKit\'s binding list')
  await assert.rejects(walk.accept('credentials', held(choice)), /Nothing is made twice/)
  assert.equal(sent().length, 1)
  // With no AIKit reached, both steps refuse naming the source they lack.
  const bare = new settingsPages.SetupWalk({...source, aikit: undefined})
  await bare.read()
  assert.equal(stepOf(win.setupValues(bare.snapshot(), held({})), 'ground').state, 'accepted')
  assert.match(stepOf(win.setupValues(bare.snapshot(), held({})), 'harnesses').items[0].why, /SetupSource\.aikit/)
  await assert.rejects(bare.accept('credentials', held(choice)), /SetupSource\.aikit/)
})

test('SCRIPTED — the design draws Harnesses and skills and Credentials from AIKit\'s readings: each tool\'s skills with the change Accept makes; each key\'s place, the key you choose and the reference you give, never a key', async () => {
  const {source, world, HOME} = scriptedSetup()
  world.tools.set('claude', {client: 'claude', harness: 'claude-code', folder: `${HOME}/.claude`, names: ['field-recording-log', 'weekly-review'], standing: 'foreign', revision: 1})
  world.keys.push({source: 'project-env', location: `${HOME}/.env`, name: 'ANTHROPIC_API_KEY', proposed_credential_ref: 'credential:anthropic', proposed_env_var: 'ANTHROPIC_API_KEY'})
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  await walk.accept('ground', held({}))
  const harnesses = drawn({...win.setupValues(walk.snapshot(), held({})), setupStep: 'harnesses'}, 'setup')
  assert.ok(harnesses.includes('data-census-agent="claude-code"') && harnesses.includes('Claude Code'), 'the agent, as the census lists it')
  for (const carried of ['claude-opus-5-5', 'foundation', 'Shape of the world', 'CLAUDE.md']) assert.ok(harnesses.includes(carried), `what it carries: ${carried}`)
  assert.ok(harnesses.includes(escaped('AIKit adopts its 2 skills (field-recording-log, weekly-review)')), 'the change Accept makes')
  const choice = {credential: 'credential:anthropic', reference: 'op://Scratch/anthropic/credential'}
  const credentials = drawn({...win.setupValues(walk.snapshot(), held(choice)), setupStep: 'credentials', ...choice}, 'setup')
  assert.ok(credentials.includes('ANTHROPIC_API_KEY') && credentials.includes(`${HOME}/.env`), 'the key\'s name and where it lies')
  assert.match(credentials, /aria-label="Reference"[^>]*value="op:\/\/Scratch\/anthropic\/credential"|value="op:\/\/Scratch\/anthropic\/credential"[^>]*aria-label="Reference"/, 'the reference you give, in its own field')
  assert.ok(credentials.includes(escaped('AIKit binds credential:anthropic to op://Scratch/anthropic/credential')), 'the binding Accept makes, with your reference')
  assert.match(credentials, /data-focus="true"/, 'the key chosen is marked')
  assert.doesNotMatch(credentials, /scratch-dummy/, 'no value is drawn')
  const unchosen = drawn({...win.setupValues(walk.snapshot(), held({})), setupStep: 'credentials'}, 'setup')
  assert.ok(unchosen.includes(escaped('Give where the key lies in your store first.')), 'Accept waits for a reference, and says so')
})

test('SCRIPTED — the first time the DLW opens (no ground yet), Settings opens on Setup; a contextual request opens Setup too', async () => {
  const {SettingsWorkspace} = await import('../src/settings/SettingsWorkspace.tsx')
  const {ShellConfigContext} = await import('../src/shell/useSet.ts')
  host.resetHost(ID)
  const first = renderToStaticMarkup(createElement(ShellConfigContext.Provider, {value: {onboarding: true}},
    createElement(SettingsWorkspace, {adapter: createDevelopmentSettingsAdapter('ready'), active: true, onReturn: () => {}, request: null})))
  host.resetHost(ID)
  assert.match(first, /aria-label="Setup steps"/, 'Setup, on first opening')
  const {setupRequest} = await import('../src/settings/host.ts')
  const request = setupRequest('Back to work')
  assert.equal(request.page, 'setup')
  assert.equal(request.returnLabel, 'Back to work')
  const foundation = readFileSync(new URL('../src/native/Foundation.tsx', import.meta.url), 'utf8')
  // setupUnfinished (native/worldReading.ts) is true for onboarding (no ground yet) and for a ground without its Workcell.
  assert.match(foundation, /settingUp = setupUnfinished\(reading\)[\s\S]*if \(settingUp[^\n]*openSettings\(setupRequest\(/, 'the foundation opens Settings on Setup when the world has no ground yet')
  // Setup's Ground step is the one way a world with no ground gets one. The old cradle's chooser ("Choose an existing Central") stood
  // over the shell beside it, unstyled, and could only pick a Central that already exists (seen on the native candidate, 12 Nov).
  assert.doesNotMatch(foundation, /GroundChooser/, 'no second ground chooser stands over the shell beside Setup')
})

// ── a new world's Day, its folder and name, its first layer of identity (O-I #740) ─────────────────────────────────────────────────

const civilRead = (state, zone = 'Europe/London', more = {}) => ({state: 'read', preview: {schema: 'central.civil-time-adoption-preview/v1', state, policy: {timezone: zone, day_boundary_minutes: 0},
  digest: ['absent', 'no-ground'].includes(state) ? `civil-digest:${zone}` : null, reason: null, ...more}})

test('CODE-DERIVED — the Ground step says how your days are kept before Accept: this computer\'s time zone, turning at midnight; accepted only once Central keeps it', () => {
  const base = {bound_ground: null, suggested_ground: '/w/Bare/Central', selected_ground: '/w/Bare/Central', ground: {outcome: 'new', canonical_path: '/w/Bare/Central'}}
  const bound = {...base, bound_ground: '/w/Bare/Central', ground: {outcome: 'recognized', canonical_path: '/w/Bare/Central', access: {readable: true, searchable: true}}}
  const days = values => stepOf(values, 'ground').items.find(item => item.name === 'Your days')
  const fresh = win.setupValues({adoption: {discovery: base}, civilTime: civilRead('no-ground'), folders: {state: 'unread'}, plan: null}, held({}))
  assert.equal(stepOf(fresh, 'ground').state, 'found')
  assert.equal(days(fresh).change, 'Your days follow this computer\'s time zone, Europe/London, and turn at midnight')
  // An older ground Central keeps already, with no policy: the same line, and the step waits for Accept.
  const older = win.setupValues({adoption: {discovery: bound}, civilTime: civilRead('absent'), folders: {state: 'read', folders: []}, plan: null}, held({}))
  assert.equal(stepOf(older, 'ground').state, 'found', 'a ground without its days is not accepted')
  assert.equal(days(older).change, 'Your days follow this computer\'s time zone, Europe/London, and turn at midnight')
  const kept = win.setupValues({adoption: {discovery: bound}, civilTime: civilRead('recognised', 'Pacific/Auckland', {policy: {timezone: 'Pacific/Auckland', day_boundary_minutes: 240}}), folders: {state: 'read', folders: []}, plan: null}, held({}))
  assert.equal(stepOf(kept, 'ground').state, 'accepted')
  assert.match(days(kept).change, /^Your days follow Pacific\/Auckland and turn at 04:00/)
  const unrecognised = win.setupValues({adoption: {discovery: bound}, civilTime: civilRead('unrecognised', 'x', {reason: 'Control/user/civil-time-policy.json stands in this ground, but no source relation names it.'}), folders: {state: 'read', folders: []}, plan: null}, held({}))
  assert.match(days(unrecognised).why, /no source relation names it/)
  const refused = win.setupValues({adoption: {discovery: base}, civilTime: {state: 'refused', error: 'Unknown Action: central.time.policy.preview'}, folders: {state: 'unread'}, plan: null}, held({}))
  assert.match(days(refused).why, /Central did not say how your days are kept: Unknown Action: central\.time\.policy\.preview/)
})

test('SCRIPTED — a new world: Accept makes the ground and adopts the civil-time policy it previewed, recognised by that acceptance; an older ground gets only the policy', async () => {
  const {source, calls, world} = scriptedSetup()
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  const before = win.setupValues(walk.snapshot(), held({}))
  assert.equal(stepOf(before, 'ground').items.find(item => item.name === 'Your days').change, 'Your days follow this computer\'s time zone, Europe/London, and turn at midnight')
  const said = await walk.accept('ground', held({}))
  assert.match(said, /Central made your ground at \/w\/Bare\/Central/)
  assert.match(said, /Your days follow Europe\/London and turn at midnight/)
  const adopt = calls.find(call => call[1] === 'central.time.policy.adopt')
  assert.ok(adopt, 'the policy is adopted through Central')
  assert.deepEqual(adopt[2], {actor_kind: 'human', acceptance: 'human-accepted', acceptance_ref: 'oi-setup-adoption:review-1', expected_digest: 'civil-digest:Europe/London'})
  assert.ok(calls.findIndex(call => call[1] === 'apply') < calls.indexOf(adopt), 'after the ground is made')
  assert.equal(stepOf(win.setupValues(walk.snapshot(), held({})), 'ground').state, 'accepted')
  await assert.rejects(walk.accept('ground', held({})), /Nothing is made twice/)

  // An older ground: no plan of native oi's, only the policy, on the digest shown.
  const older = scriptedSetup()
  older.world.bound = '/w/Bare/Central'; older.world.outcome = 'recognized'
  const second = new settingsPages.SetupWalk(older.source)
  await second.read()
  assert.equal(stepOf(win.setupValues(second.snapshot(), held({})), 'ground').state, 'found')
  const kept = await second.accept('ground', held({}))
  assert.match(kept, /Central keeps your ground at \/w\/Bare\/Central, where it was/)
  assert.ok(!older.calls.some(call => call[1] === 'plan' || call[1] === 'apply'), 'native oi is not asked to make a ground that stands')
  const adopted = older.calls.find(call => call[1] === 'central.time.policy.adopt')
  assert.match(adopted[2].acceptance_ref, /^dlw-setup-ground-accept:/)
  assert.equal(older.world.civil.timezone, 'Europe/London')
  // Central's zone moved since the preview: refused in Central's words, nothing written.
  const moved = scriptedSetup()
  moved.world.bound = '/w/Bare/Central'; moved.world.outcome = 'recognized'
  const third = new settingsPages.SetupWalk(moved.source)
  await third.read()
  moved.world.zone = 'Asia/Tokyo'
  await assert.rejects(third.accept('ground', held({})), /changed since its preview/)
  assert.equal(moved.world.civil, null)
  assert.ok(world.civil, 'the first world kept its policy')
})

test('SCRIPTED — the Ground step makes a new ground in the folder you choose, under the name you give; the default stays the world\'s Central', async () => {
  const {source, calls, world} = scriptedSetup()
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  const shown = win.setupValues(walk.snapshot(), held({}))
  assert.equal(shown.groundFolder, '/w/Bare')
  assert.equal(shown.groundName, 'Central', 'the default name, until you give one')
  await walk.groundAt('/w/Elsewhere', 'Studio')
  const chosen = win.setupValues(walk.snapshot(), held({groundName: 'Studio'}))
  assert.equal(chosen.groundFolder, '/w/Elsewhere')
  assert.equal(stepOf(chosen, 'ground').items[0].where, '/w/Elsewhere/Studio')
  assert.deepEqual(calls.filter(call => call[1] === 'discover').at(-1)[2], {action: 'discover', ground: '/w/Elsewhere/Studio'})
  await walk.accept('ground', held({groundName: 'Studio'}))
  assert.equal(calls.find(call => call[1] === 'plan')[2].selection.ground, '/w/Elsewhere/Studio', 'native oi plans the ground you chose')
  assert.equal(world.bound, '/w/Elsewhere/Studio')
  // A name typed since the folder was read is read before anything is made: Accept refuses until it is.
  const other = scriptedSetup()
  const next = new settingsPages.SetupWalk(other.source)
  await next.read()
  await assert.rejects(next.accept('ground', held({groundName: 'Elsewhere'})), /Read .*\/w\/Bare\/Elsewhere.* first/)
  for (const name of ['', 'a/b', '..', '.hidden']) await assert.rejects(next.groundAt('/w/Bare', name), /A ground's name/)
})

test('SCRIPTED — once the ground is made, Setup asks for your name and date of birth, kept through the identity owner; left, nothing stands missing', async () => {
  const {source, calls, world} = scriptedSetup()
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  assert.equal(win.setupValues(walk.snapshot(), held({})).birth, undefined, 'not asked before the ground is made')
  await walk.accept('ground', held({}))
  const asked = JSON.parse(win.setupValues(walk.snapshot(), held({})).birth)
  assert.equal(asked.state, 'absent')
  assert.ok(!JSON.stringify(asked).match(/missing/i), 'left out is not shown as missing')
  await assert.rejects(walk.keepBirth(held({birthDate: '1990-04-12'})), /Give your name/)
  const said = await walk.keepBirth(held({birthName: 'Ada', birthDate: '1990-04-12'}))
  assert.match(said, /Kept in your ground: Ada, born 1990-04-12/)
  const save = calls.find(call => call[0] === 'identity' && call[1] === 'save')[2]
  assert.equal(save.profile.schema, 'ql.nara-identity-profile/v1')
  assert.deepEqual(save.profile.birth, {date: '1990-04-12', time: null, precision: 'unknown', uncertainty_minutes: null, fold: null, place: null})
  assert.equal(save.source_ref, null)
  assert.match(save.profile.person_ref, /^person:/)
  const kept = JSON.parse(win.setupValues(walk.snapshot(), held({})).birth)
  assert.deepEqual([kept.state, kept.name, kept.date], ['kept', 'Ada', '1990-04-12'])
  // A correction is a new revision of the same identity, never a new person (§24.6).
  await walk.keepBirth(held({birthName: 'Ada', birthDate: '1990-04-13'}))
  const again = calls.filter(call => call[0] === 'identity' && call[1] === 'save').at(-1)[2]
  assert.equal(again.profile.person_ref, save.profile.person_ref)
  assert.equal(again.source_ref, 'central:source:control:root:Control/self/nara/identities/abc.json')
  assert.equal(world.identity.birth.date, '1990-04-13')
  // A host that reaches no identity owner says so, and Setup goes on.
  const bare = scriptedSetup()
  const without = new settingsPages.SetupWalk({...bare.source, identity: undefined})
  await without.read(); await without.accept('ground', held({}))
  assert.match(JSON.parse(win.setupValues(without.snapshot(), held({})).birth).why, /SetupSource\.identity/)
})

test('CODE-DERIVED — Harnesses and skills and Credentials with nothing to adopt or bind are done, and say so in words', () => {
  const tools = {state: 'read', agents: [{slug: 'claude-code', harnessRef: 'harness/claude-code', executable: '/x/claude', starts: true, talks: true, aikit: {client: 'claude', harness: 'claude-code', config_dir: '/w/Bare/.claude'}},
    {slug: 'gemini', harnessRef: 'harness/gemini', executable: '/x/gemini', starts: true, talks: true, aikit: {client: 'gemini', harness: 'gemini', config_dir: '/w/Bare/.gemini'}}]}
  const none = win.setupHarnessStep({state: 'read', roots: []}, tools)
  assert.equal(none.state, 'accepted')
  assert.match(none.said, /Nothing to bring in/)
  const empty = win.setupCredentialStep({state: 'read', findings: [], providers: [], bindings: []}, held({}))
  assert.equal(empty.state, 'accepted')
  assert.match(empty.said, /Nothing to bind/)
  const waiting = win.setupCredentialStep({state: 'read', findings: [{source: 'project-env', location: '/w/.env', name: 'ANTHROPIC_API_KEY', credential: 'credential:anthropic', bound: false}], providers: [], bindings: []}, held({}))
  assert.equal(waiting.state, 'found', 'a key that waits to be bound keeps the step found')
  const foreign = win.setupHarnessStep({state: 'read', roots: [{label: '@claude', path: '/w/Bare/.claude/skills', skills: 2, problems: 0, names: ['a', 'b'], standing: 'foreign'}]}, tools)
  assert.equal(foreign.state, 'found')
  const drawnNone = drawn({setup: json([{step: 'harnesses', state: 'accepted', said: none.said, items: none.items}]), setupStep: 'harnesses'}, 'setup')
  assert.ok(drawnNone.includes(escaped(none.said)), 'the step says it in words')
})

test('CODE-DERIVED — a census not read is said as not read, with its why, never as no agent on this computer: Harnesses and skills with nothing to bring in says so, and Credentials says why no agent\'s providers were asked', () => {
  // A fresh home whose Actuation detection cannot be read: the World Model refuses the agents slice, in its words (census.rs).
  const why = 'Actuation\'s harness detection: actuation detect did not answer within 10s'
  const unread = win.setupHarnessStep({state: 'read', roots: []}, {state: 'unavailable', why})
  assert.equal(unread.state, 'accepted', 'nothing to bring in is done by the skill roots, as before')
  assert.equal(unread.said, `Nothing to bring in: no skill root here keeps skills AIKit can adopt. The agents on this computer are not read: ${why}.`)
  assert.doesNotMatch(unread.said, /there is no agent/, 'a census never read is not an empty one')
  assert.deepEqual([unread.agents, unread.agentsWhy], [undefined, why])
  assert.equal(win.setupHarnessStep({state: 'read', roots: []}, {state: 'reading'}).said,
    'Nothing to bring in: no skill root here keeps skills AIKit can adopt. The agents on this computer are not read: The agents on this machine are not read yet.', 'asked and not answered yet: said as that')
  // Only a census read that lists no agent says there is none.
  assert.equal(win.setupHarnessStep({state: 'read', roots: []}, {state: 'read', agents: []}).said, 'Nothing to bring in: there is no agent on this computer. Each agent stays as it is.')
  // Credentials: no agent was asked which providers it reaches, and the step says why, in the census's words.
  const credentials = win.setupCredentialStep({state: 'read', findings: [], providers: [], bindings: [], agentsWhy: why}, held({}))
  assert.deepEqual(credentials.items, [{name: 'Your agents\' providers', why: `The agents on this computer are not read, so no agent's providers were asked: ${why}.`}])
  assert.deepEqual(win.setupCredentialStep({state: 'read', findings: [], providers: [], bindings: []}, held({})).items, [], 'a census read: no such row')
  // Drawn: the step's own words, and the why on the Credentials row.
  const harnesses = drawn({setup: json([{step: 'harnesses', state: unread.state, said: unread.said, agentsWhy: unread.agentsWhy, items: unread.items}]), setupStep: 'harnesses'}, 'setup')
  assert.ok(harnesses.includes(escaped(unread.said)), 'the census not read, in words')
  assert.ok(!harnesses.includes('there is no agent'), 'never that there is no agent')
  const keys = drawn({setup: json([{step: 'credentials', state: credentials.state, said: credentials.said, items: credentials.items}]), setupStep: 'credentials'}, 'setup')
  assert.ok(keys.includes(escaped(`The agents on this computer are not read, so no agent's providers were asked: ${why}.`)), 'Credentials says why no agent was asked')
})

test('SCRIPTED — Setup where the World Model does not answer the census: Harnesses and skills says the agents are not read, with why; Credentials asks AIKit of no agent, and says why', async () => {
  const {source, calls, world, HOME} = scriptedSetup()
  world.tools.set('claude', {client: 'claude', harness: 'claude-code', folder: `${HOME}/.claude`, names: [], standing: 'foreign', revision: 1})
  world.censusRefusal = 'Actuation\'s harness detection: actuation detect did not answer within 10s'
  const walk = new settingsPages.SetupWalk(source)
  await walk.read(); await walk.accept('ground', held({}))
  const harnesses = stepOf(win.setupValues(walk.snapshot(), held({})), 'harnesses')
  assert.deepEqual([harnesses.state, harnesses.agents, harnesses.agentsWhy], ['accepted', undefined, world.censusRefusal])
  assert.equal(harnesses.said, `Nothing to bring in: no skill root here keeps skills AIKit can adopt. The agents on this computer are not read: ${world.censusRefusal}.`)
  const credentials = stepOf(win.setupValues(walk.snapshot(), held({})), 'credentials')
  assert.deepEqual(credentials.items, [{name: 'Your agents\' providers', why: `The agents on this computer are not read, so no agent's providers were asked: ${world.censusRefusal}.`}])
  assert.ok(!calls.some(([kind, op]) => kind === 'aikit' && op === 'harness_auth_describe'), 'AIKit is asked of no agent')
  // The census answers again: the agents stand, and the row is gone.
  world.censusRefusal = null
  await walk.read({fresh: true})
  assert.deepEqual(stepOf(win.setupValues(walk.snapshot(), held({})), 'credentials').items.map(row => row.name), ['anthropic for claude-code'])
})

test('SCRIPTED — the window\'s Read again on Setup asks the census afresh, as Setup\'s own Read again does: an agent installed or a model default changed outside the window shows then', async () => {
  const {source, calls, world, GROUND, HOME} = scriptedSetup()
  world.bound = GROUND; world.outcome = 'recognized'
  world.tools.set('claude', {client: 'claude', harness: 'claude-code', folder: `${HOME}/.claude`, names: [], standing: 'foreign', revision: 1})
  let part
  const Probe = () => { part = settingsPages.useSetupPage({setup: source}, true, held({}), () => {}, []); return null }
  renderToStaticMarkup(createElement(Probe))
  const census = () => calls.filter(([kind]) => kind === 'agents')
  // The window's Read again presses each part's reread, with nothing (SettingsWorkspace).
  await part.reread()
  assert.deepEqual(census(), [['agents', true]], 'the window\'s Read again asks past what the kernel holds')
  await part.acts.rereadSetup()
  assert.deepEqual(census(), [['agents', true], ['agents', true]], 'Setup\'s own Read again, the same')
})

/** AIKit's own disclosure of a tool (REAL shape: `aikit harness disclose claude-code --json`, data, 29 Oct; trimmed to its layers). */
const DISCLOSURE = {schema: 'aikit.harness-disclosure/v1', standing: 'Native profile declarations and source observations; not installed-harness detection or session activation proof',
  profiles: [{activation: {state: 'unobserved'}, disclosure: {edition: 'cli', slug: 'claude-code', layers: [
    {layer: 'skills', native: [{name: '~/.claude/skills'}], posture: 'managed'},
    {layer: 'guidance', native: [{name: '~/.claude/CLAUDE.md'}], posture: 'observed'},
    {layer: 'models', posture: 'observed', auth: {env_var: [{env_var: 'ANTHROPIC_API_KEY', provider_ref: 'provider:anthropic'}], own_login: [{kind: 'note-only', note: 'claude login keeps OAuth material in its own credential store', provider_ref: 'provider:anthropic'}]}},
    {layer: 'settings', native: [{name: '~/.claude/settings.json'}], posture: 'observed'}]}, native_tools: {state: 'observed'}}]}

test('SCRIPTED — Harnesses and skills shows what AIKit reads of each tool: its instructions, its settings and its models; a value AIKit does not read is named', async () => {
  const {source, world, HOME} = scriptedSetup()
  world.tools.set('claude', {client: 'claude', harness: 'claude-code', folder: `${HOME}/.claude`, names: ['weekly-review'], standing: 'foreign', revision: 1})
  world.disclosure = DISCLOSURE
  const walk = new settingsPages.SetupWalk(source)
  await walk.read(); await walk.accept('ground', held({}))
  const step = stepOf(win.setupValues(walk.snapshot(), held({})), 'harnesses')
  const tool = step.tools.find(row => row.harness === 'claude-code')
  assert.deepEqual(tool.instructions, ['~/.claude/CLAUDE.md'])
  assert.deepEqual(tool.settings, ['~/.claude/settings.json'])
  assert.deepEqual(tool.models, ['anthropic'])
  assert.match(tool.unread, /model/, 'the model a tool uses is a value AIKit does not read: named, left alone')
  const page = drawn({...win.setupValues(walk.snapshot(), held({})), setupStep: 'harnesses'}, 'setup')
  for (const text of ['~/.claude/CLAUDE.md', '~/.claude/settings.json']) assert.ok(page.includes(text), `${text} is drawn`)
  // AIKit's disclosure refused: the step still reads its tools, and says why their settings are not shown.
  world.disclosure = null
  await walk.read()
  assert.match(stepOf(win.setupValues(walk.snapshot(), held({})), 'harnesses').disclosure, /did not answer/)
})

test('SCRIPTED — Projects: a folder elsewhere is previewed and accepted Into Work without a Make; Make applies only once it stands in Work', () => {
  const folders = [{path: '/w/Arriving/field-notes', title: 'field-notes', place: 'elsewhere', finds: 'none', wikis: [], material: ['README.md'], central: []}]
  const elsewhere = drawn({setup: json([{step: 'projects', state: 'found', items: []}]), setupStep: 'projects', folders: json(folders), folder: '/w/Arriving/field-notes', where: 'work'}, 'setup')
  assert.ok(!elsewhere.includes(escaped('Choose what to make first.')), 'Preview and Accept do not wait on a Make for a bring')
  assert.ok(elsewhere.includes(escaped('It comes into Work first; choose what to make of it there.')), 'Make is closed and says why')
  const work = [{path: '/w/Arriving/Central/Work/field-notes', title: 'field-notes', place: 'work', finds: 'none', wikis: [], material: ['README.md'], central: []}]
  const inWork = drawn({setup: json([{step: 'projects', state: 'found', items: []}]), setupStep: 'projects', folders: json(work), folder: '/w/Arriving/Central/Work/field-notes'}, 'setup')
  assert.ok(inWork.includes(escaped('Choose what to make first.')), 'a folder of Work still waits on its Make')
})

test('SCRIPTED — Add folder… opens the Projects step for the folder chosen: Setup reads it beside the folders it found, and previews bringing it into Work', async () => {
  const {setupRequest} = await import('../src/settings/host.ts')
  const request = setupRequest('Back to work', '/w/Bare/Music/tide-sketches')
  assert.equal(request.page, 'setup')
  assert.equal(request.folder, '/w/Bare/Music/tide-sketches')
  const {source, calls, world, HOME} = scriptedSetup()
  world.elsewhere.set('Music/tide-sketches', {signals: [], material: ['tide.als'], revision: 1})
  const walk = new settingsPages.SetupWalk(source)
  await walk.read(); await walk.accept('ground', held({}))
  walk.addFolder(`${HOME}/Music/tide-sketches`)
  walk.addFolder(`${HOME}/Music/tide-sketches`)
  const values = win.setupValues(walk.snapshot(), held({folder: `${HOME}/Music/tide-sketches`}))
  const rows = JSON.parse(values.folders).filter(row => row.path === `${HOME}/Music/tide-sketches`)
  assert.equal(rows.length, 1, 'read once, beside what Central found')
  assert.equal(rows[0].place, 'elsewhere')
  await walk.preview(held({folder: `${HOME}/Music/tide-sketches`}))
  assert.equal(calls.find(call => call[1] === 'work.bring.preview')[2].source_path, `${HOME}/Music/tide-sketches`)
  await walk.read()
  assert.ok(JSON.parse(win.setupValues(walk.snapshot(), held({})).folders).some(row => row.path === `${HOME}/Music/tide-sketches`), 'kept when Setup reads again')
  assert.throws(() => walk.addFolder('Music/tide-sketches'), /full path/)
})

test('SCRIPTED — a Central that cannot preview the days before the ground stands: the ground is made, nothing unpreviewed is adopted, and a second Accept keeps them as then shown', async () => {
  const {source, calls, world} = scriptedSetup()
  world.civilRefused = 'Central root does not exist as a directory: /w/Bare/Central'
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  assert.match(stepOf(win.setupValues(walk.snapshot(), held({})), 'ground').items.find(item => item.name === 'Your days').why, /Central did not say how your days are kept/)
  world.civilRefused = null
  const said = await walk.accept('ground', held({}))
  assert.match(said, /Central made your ground/)
  assert.match(said, /Accept again to keep them/)
  assert.ok(!calls.some(call => call[1] === 'central.time.policy.adopt'), 'nothing is adopted that the step did not show')
  const step = stepOf(win.setupValues(walk.snapshot(), held({})), 'ground')
  assert.equal(step.state, 'found')
  assert.match(step.items.find(item => item.name === 'Your days').change, /Europe\/London, and turn at midnight/)
  assert.match(await walk.accept('ground', held({})), /Your days follow Europe\/London/)
  assert.equal(stepOf(win.setupValues(walk.snapshot(), held({})), 'ground').state, 'accepted')
})

// ── the person's key and the ground's bounds (O-I #740, round two) ──────────────────────────────────────────────────────────────

test('CODE-DERIVED — the Ground step says, before Accept, that Central keeps your ground\'s bounds and a key so only you act as you; accepted once all are kept', () => {
  const bound = {bound_ground: '/w/Bare/Central', suggested_ground: '/w/Bare/Central', selected_ground: '/w/Bare/Central', ground: {outcome: 'recognized', canonical_path: '/w/Bare/Central', access: {readable: true, searchable: true}}}
  const fresh = {...bound, bound_ground: null, ground: {outcome: 'new', canonical_path: '/w/Bare/Central'}}
  const placement = state => ({state: 'read', preview: {state, digest: state === 'present' ? null : 'placement-digest', reason: null}})
  const key = (state, keeps = true) => ({state: 'read', reading: {keeps, ...(keeps ? {} : {why: 'This window is not a world\'s own (OI_WORLD_FOLDER is not set)'}), central: {state, digest: state === 'present' ? null : 'key-digest'}}})
  const row = (values, name) => stepOf(values, 'ground').items.find(item => item.name === name)
  const before = win.setupValues({adoption: {discovery: fresh}, civilTime: civilRead('no-ground'), placement: placement('no-ground'), key: key('no-ground'), folders: {state: 'unread'}, plan: null}, held({}))
  assert.equal(row(before, 'Your key').change, 'Central keeps a key in this world so that only you act as you here')
  assert.equal(row(before, 'Your key').adopts, true)
  assert.match(row(before, 'Your ground\'s bounds').change, /^What is written in your ground stays inside it/)
  const all = state => win.setupValues({adoption: {discovery: bound}, civilTime: civilRead('recognised'), placement: placement(state), key: key(state), folders: {state: 'read', folders: []}, plan: null}, held({}))
  assert.equal(stepOf(all('present'), 'ground').state, 'accepted')
  assert.equal(stepOf(all('absent'), 'ground').state, 'found', 'a ground without its key and bounds is not accepted')
  assert.match(row(all('present'), 'Your key').change, /^Central keeps your key in this world/)
  // Where the host cannot keep a key (not a world's own folder) and none is kept, said; a key kept already stands as kept.
  const outside = win.setupValues({adoption: {discovery: bound}, civilTime: civilRead('recognised'), placement: placement('present'), key: key('absent', false), folders: {state: 'read', folders: []}, plan: null}, held({}))
  assert.match(row(outside, 'Your key').why, /OI_WORLD_FOLDER/)
  const yours = win.setupValues({adoption: {discovery: bound}, civilTime: civilRead('recognised'), placement: placement('present'), key: key('present', false), folders: {state: 'read', folders: []}, plan: null}, held({}))
  assert.equal(stepOf(yours, 'ground').state, 'accepted', 'a ground that keeps an authority changes nothing')
  const refused = win.setupValues({adoption: {discovery: bound}, civilTime: civilRead('recognised'), placement: {state: 'refused', error: 'Unknown Action: central.ground.placement.preview'}, key: {state: 'refused', error: 'no host route'}, folders: {state: 'read', folders: []}, plan: null}, held({}))
  assert.match(row(refused, 'Your ground\'s bounds').why, /Unknown Action/)
  assert.match(row(refused, 'Your key').why, /no host route/)
})

test('SCRIPTED — one held Accept makes the ground, its days, its bounds and the person\'s key, each on its preview, recognised by that acceptance; the window never holds the key', async () => {
  const {source, calls, world} = scriptedSetup()
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  const said = await walk.accept('ground', held({}))
  assert.match(said, /Central keeps a key in this world so that only you act as you here/)
  const order = calls.filter(call => ['apply', 'central.time.policy.adopt', 'central.ground.placement.adopt'].includes(call[1]) || (call[0] === 'key' && call[1] === 'adopt') || (call[0] === 'form' && call[1] === 'keep')).map(call => call[1])
  assert.deepEqual(order, ['apply', 'central.time.policy.adopt', 'central.ground.placement.adopt', 'keep', 'adopt'], 'the ground, then its days, its bounds, its Day\'s form and the key')
  assert.equal(world.formAcceptance, 'oi-setup-adoption:review-1')
  assert.equal(world.placementAcceptance, 'oi-setup-adoption:review-1')
  assert.equal(world.keyAcceptance, 'oi-setup-adoption:review-1')
  assert.deepEqual(calls.find(call => call[0] === 'key' && call[1] === 'adopt')[2], {operation: 'adopt', acceptance_ref: 'oi-setup-adoption:review-1', expected_digest: 'key-digest'})
  assert.equal(stepOf(win.setupValues(walk.snapshot(), held({})), 'ground').state, 'accepted')
  assert.doesNotMatch(JSON.stringify(walk.snapshot()), /native-token|token_sha256/i, 'no key, its digest, nor where it lies, enters the window')
  await assert.rejects(walk.accept('ground', held({})), /Nothing is made twice/)
  // An older ground that keeps an authority and a placement policy: only its days are made; the key route is not asked to adopt.
  const older = scriptedSetup()
  Object.assign(older.world, {bound: '/w/Bare/Central', outcome: 'recognized', key: true, placement: {writable: [{path: 'Work/x'}]}})
  const second = new settingsPages.SetupWalk(older.source)
  await second.read()
  await second.accept('ground', held({}))
  assert.ok(!older.calls.some(call => call[0] === 'key' && call[1] === 'adopt'), 'a ground that keeps an authority changes nothing')
  assert.ok(!older.calls.some(call => call[1] === 'central.ground.placement.adopt'))
  assert.deepEqual(older.world.placement, {writable: [{path: 'Work/x'}]})
  // A host that cannot keep a key here: the ground, days and bounds are made; the key row says why, and the step waits.
  const outside = scriptedSetup()
  outside.world.keeps = false
  const third = new settingsPages.SetupWalk(outside.source)
  await third.read()
  const answer = await third.accept('ground', held({}))
  assert.match(answer, /OI_WORLD_FOLDER/)
  assert.equal(outside.world.key, false)
  assert.equal(stepOf(win.setupValues(third.snapshot(), held({})), 'ground').state, 'found')
})

// ── an older setup brought into agreement (O-I #740; manual §10.11: "Run it over an older setup and it brings the setup into agreement")

test('CODE-DERIVED — the Ground step shows your grant as Setup\'s own row: the root acts Setup grants today that it lacks, which Accept adds; one kept by hand is named and left as it is', () => {
  const bound = {bound_ground: '/w/Bare/Central', suggested_ground: '/w/Bare/Central', selected_ground: '/w/Bare/Central', ground: {outcome: 'recognized', canonical_path: '/w/Bare/Central', access: {readable: true, searchable: true}}}
  const kept = {state: 'read', preview: {state: 'present', digest: null, reason: null}}
  const key = {state: 'read', reading: {keeps: true, central: {state: 'present', digest: null}}}
  const agreement = (state, more = {}) => ({state: 'read', preview: {state, adds: [], digest: null, reason: null, ...more}})
  const of = a => win.setupValues({adoption: {discovery: bound}, civilTime: civilRead('recognised'), placement: kept, key, agreement: a, folders: {state: 'read', folders: []}, plan: null}, held({}))
  const row = values => stepOf(values, 'ground').items.find(item => item.name === 'Your grant')
  const absent = of(agreement('absent', {adds: ['central.world.place', 'control.apply-proposal'], digest: 'agree'}))
  assert.equal(stepOf(absent, 'ground').state, 'found', 'an older grant is not in agreement until Accept brings it')
  assert.equal(row(absent).adopts, true)
  assert.equal(row(absent).where, 'Control/user/native-action-authority.json')
  assert.match(row(absent).change, /Setup grants 2 acts today that your grant lacks: central\.world\.place, control\.apply-proposal · Accept adds them; nothing you hold is taken away/)
  const present = of(agreement('present'))
  assert.equal(stepOf(present, 'ground').state, 'accepted')
  assert.match(row(present).change, /^Your grant holds every act Setup grants today/)
  // Hand-authored (the owner's own): named in Central's words, left as it is, and it never holds the step back.
  const byHand = of(agreement('hand-authored', {reason: 'this ground\'s native-action-authority source (Control/user/native-action-authority.json) is recognised by owner-commissioned, not by Setup\'s acceptance: it is changed only by its owner'}))
  assert.equal(stepOf(byHand, 'ground').state, 'accepted')
  assert.match(row(byHand).why, /^You keep your grant by hand, so Setup leaves it as it is: .*owner-commissioned.*changed only by its owner/)
  assert.equal(row(byHand).adopts, undefined)
  // A Central that does not answer is named, and the step waits; before a ground, or with no key yet, the key's row speaks alone.
  const refused = of({state: 'refused', error: 'Unknown Action: central.ground.agreement.preview'})
  assert.match(row(refused).why, /Central did not say whether your grant agrees with what Setup grants today: Unknown Action/)
  assert.equal(stepOf(refused, 'ground').state, 'found')
  for (const state of ['unfounded', 'no-ground']) assert.equal(row(of(agreement(state))), undefined, state)
  assert.equal(row(of(undefined)), undefined, 'not asked yet: no row')
  // Drawn as a row of the Ground step, and the held Accept stands open for it.
  const page = drawn({...absent, setupStep: 'ground'}, 'setup')
  assert.ok(page.includes('Your grant') && page.includes('control.apply-proposal'), 'the row is drawn with what Accept adds')
  assert.ok(!drawn({...present, setupStep: 'ground'}, 'setup').includes(escaped('Accept adds them')))
})

test('SCRIPTED — run over an older setup, Setup\'s held Ground Accept brings the grant into agreement on its preview\'s digest, recognised by that acceptance; a grant kept by hand is never touched', async () => {
  const {source, calls, world} = scriptedSetup()
  Object.assign(world, {bound: '/w/Bare/Central', outcome: 'recognized', civil: {timezone: 'Europe/London', day_boundary_minutes: 0}, placement: {writable: []}, key: true, form: true,
    lacks: ['central.world.place', 'control.apply-proposal']})
  const walk = new settingsPages.SetupWalk(source)
  await walk.read()
  const before = stepOf(win.setupValues(walk.snapshot(), held({})), 'ground')
  assert.equal(before.state, 'found')
  assert.equal(before.items.find(item => item.name === 'Your grant').adopts, true)
  const said = await walk.accept('ground', held({}))
  assert.match(said, /Your grant now holds every act Setup grants today: central\.world\.place and control\.apply-proposal were added; nothing you held was taken away\./)
  const [, , input] = calls.find(([, action]) => action === 'central.ground.agreement.adopt')
  assert.deepEqual({...input, acceptance_ref: input.acceptance_ref.replace(/\d+$/, 'N')},
    {actor_kind: 'human', acceptance: 'human-accepted', acceptance_ref: 'dlw-setup-ground-accept:N', expected_digest: 'agree:central.world.place,control.apply-proposal'})
  assert.deepEqual(world.lacks, [])
  assert.ok(!calls.some(call => (call[0] === 'key' && call[1] === 'adopt') || call[1] === 'central.ground.placement.adopt' || call[1] === 'central.time.policy.adopt'), 'only what the older setup lacks')
  assert.equal(stepOf(win.setupValues(walk.snapshot(), held({})), 'ground').state, 'accepted')
  await assert.rejects(walk.accept('ground', held({})), /Nothing is made twice/)
  // A Central that refuses the agreement: said, and the row stays for Accept to bring again.
  const refusing = scriptedSetup()
  Object.assign(refusing.world, {bound: '/w/Bare/Central', outcome: 'recognized', civil: {timezone: 'Europe/London', day_boundary_minutes: 0}, placement: {writable: []}, key: true, form: true,
    lacks: ['central.world.place'], agreeRefusal: 'the founded source\'s relation moved'})
  const again = new settingsPages.SetupWalk(refusing.source)
  await again.read()
  assert.match(await again.accept('ground', held({})), /Your grant is not in agreement yet: the founded source's relation moved Accept again to bring it\./)
  assert.equal(stepOf(win.setupValues(again.snapshot(), held({})), 'ground').state, 'found')
  // A grant kept by hand (the owner's own): read hand-authored, never pressed, and the step stands accepted.
  const owner = scriptedSetup()
  Object.assign(owner.world, {bound: '/w/Bare/Central', outcome: 'recognized', civil: {timezone: 'Europe/London', day_boundary_minutes: 0}, placement: {writable: []}, key: true, form: true,
    byHand: true, lacks: ['central.world.place'], grants: standingGrant()})
  const theirs = new settingsPages.SetupWalk(owner.source)
  await theirs.read()
  const ground = stepOf(win.setupValues(theirs.snapshot(), held({})), 'ground')
  assert.match(ground.items.find(item => item.name === 'Your grant').why, /changed only by its owner/)
  assert.equal(ground.state, 'accepted')
  await assert.rejects(theirs.accept('ground', held({})), /Nothing is made twice/)
  assert.ok(!owner.calls.some(([, action]) => action === 'central.ground.agreement.adopt'), 'Central is never asked to change what the person keeps by hand')
  assert.deepEqual(owner.world.lacks, ['central.world.place'])
  // A new ground: the grant Setup founds today is in agreement, so the agreement is never pressed.
  const fresh = scriptedSetup()
  const first = new settingsPages.SetupWalk(fresh.source)
  await first.read()
  await first.accept('ground', held({}))
  assert.ok(!fresh.calls.some(([, action]) => action === 'central.ground.agreement.adopt'))
  assert.equal(stepOf(win.setupValues(first.snapshot(), held({})), 'ground').items.find(item => item.name === 'Your grant')?.change ?? null, 'Your grant holds every act Setup grants today')
})

test('CODE-DERIVED — the Ground step keeps the Day\'s form in a ground no O-I project carries it for; a ground whose project carries it changes nothing', () => {
  const bound = {bound_ground: '/w/Bare/Central', suggested_ground: '/w/Bare/Central', selected_ground: '/w/Bare/Central', ground: {outcome: 'recognized', canonical_path: '/w/Bare/Central', access: {readable: true, searchable: true}}}
  const form = reading => ({state: 'read', reading})
  const row = values => stepOf(values, 'ground').items.find(item => item.name === 'Your Day\'s form')
  const of = f => win.setupValues({adoption: {discovery: bound}, civilTime: civilRead('recognised'), form: f, folders: {state: 'read', folders: []}, plan: null}, held({}))
  const absent = of(form({central: {state: 'absent', digest: 'form-digest'}}))
  assert.equal(row(absent).change, 'Central keeps the Day\'s form in your ground, so today\'s Day can be made')
  assert.equal(row(absent).adopts, true)
  assert.equal(stepOf(absent, 'ground').state, 'found')
  assert.equal(stepOf(of(form({central: {state: 'present'}})), 'ground').state, 'accepted')
  const project = of(form({state: 'project', carried_by: 'Work/O-I/desktop/cradle/documents'}))
  assert.match(row(project).change, /Work\/O-I\/desktop\/cradle\/documents/)
  assert.equal(stepOf(project, 'ground').state, 'accepted', 'the owner\'s ground changes nothing')
  assert.match(row(of({state: 'refused', error: 'no route'})).why, /no route/)
})

// ── the world's Music folder (DLW build ruling 2026-11-08 LV01: "Setup's part is only where"; 2026-11-09, round 47 item 1) ──────────────

/** The kernel's ground_music route (desktop/cradle/kernel/src/ground_music.rs, its answers' shape): the world's Music folder as a folder
 * scope of Central's file map, with the digest of what its preview shows; a keep of a digest the preview no longer gives is refused in the
 * kernel's words before Central is asked (round 54b item 9). */
const musicRoute = (calls, music) => async request => {
  calls.push(['music', request.operation, structuredClone(request)])
  const revision = music.kept ? 'central.content-fnv1a64/v1:2' : 'central.content-fnv1a64/v1:1'
  // A stand-in for the kernel's sha256 of what the preview shows: one per state and revision.
  const digest = `sha256:${music.folder === false ? 'no-folder' : music.kept ? 'present' : 'absent'}-${revision}`
  const shape = {schema: 'oi.ground-music/v1', path: '/w/Bare/Music'}
  // A Central whose file map keeps no folder scope, in its own disclosure (47c item 1): the kernel's words, nothing to keep, and its keep
  // registers nothing.
  const unsupported = 'This Central does not keep folder scopes yet, so Samples lists only the set\'s own folder.'
  if (music.older && request.operation === 'preview') return {...shape, state: 'unsupported', words: unsupported, media: ['wav', 'aif', 'aiff', 'flac', 'mp3', 'm4a'], exclude: ['Backup', 'Factory Packs', 'Ableton Project Info']}
  if (music.older) throw new Error(`${unsupported} Nothing was registered.`)
  if (request.operation === 'preview') return {...shape, revision, digest, media: ['wav', 'aif', 'aiff', 'flac', 'mp3', 'm4a'], exclude: ['Backup', 'Factory Packs', 'Ableton Project Info'],
    state: music.folder === false ? 'no-folder' : music.kept ? 'present' : 'absent', ...(music.kept ? {world_ref: 'folder:Music'} : {})}
  // Accept is the kernel's to check (47c item 10): a keep without the person's acceptance is refused before Central is asked.
  if (typeof request.acceptance_ref !== 'string' || !request.acceptance_ref.trim()) throw new Error('Setup keeps your Music folder only on your acceptance, and this request names none. Nothing was registered.')
  // Kept already (the kernel's ground_music, round 48 item 0C-8): registered nothing, and says so.
  if (music.kept) return {...shape, kept: false, state: 'present', world_ref: 'folder:Music', words: 'Music is kept already: Central\'s file map kept it before this Accept, so nothing was registered.'}
  if (request.expected_digest !== digest) throw new Error('Your Music folder no longer reads as the step showed it when you accepted, so nothing was registered. Read the step again and accept what it shows.')
  music.kept = true
  return {...shape, kept: true, state: 'present', world_ref: 'folder:Music', acceptance_ref: request.acceptance_ref}
}

test('CODE-DERIVED — the Ground step says, under where, that Central\'s file map keeps your Music folder so Samples lists its audio; accepted once kept, or where there is none', () => {
  const bound = {bound_ground: '/w/Bare/Central', suggested_ground: '/w/Bare/Central', selected_ground: '/w/Bare/Central', ground: {outcome: 'recognized', canonical_path: '/w/Bare/Central', access: {readable: true, searchable: true}}}
  const of = music => win.setupValues({adoption: {discovery: bound}, civilTime: civilRead('recognised'), music, folders: {state: 'read', folders: []}, plan: null}, held({}))
  const row = values => stepOf(values, 'ground').items.find(item => item.name === 'Your Music folder')
  const read = (state, more = {}) => ({state: 'read', reading: {path: '/w/Bare/Music', state, revision: 'r1', exclude: ['Backup', 'Factory Packs', 'Ableton Project Info'], ...more}})
  const absent = of(read('absent'))
  assert.deepEqual(row(absent), {name: 'Your Music folder', where: '/w/Bare/Music', adopts: true,
    change: 'Central\'s file map keeps it, so Samples lists its audio: each file\'s name, size and time, never what is in it · Central never writes inside it · Backup, Factory Packs, Ableton Project Info left out'})
  assert.equal(stepOf(absent, 'ground').state, 'found', 'a Music folder Central can keep is not kept yet')
  const present = of(read('present', {world_ref: 'folder:Music'}))
  assert.equal(row(present).change, 'Central\'s file map keeps it, so Samples lists its audio · Central never writes inside it')
  assert.equal(stepOf(present, 'ground').state, 'accepted')
  const none = of(read('no-folder'))
  assert.match(row(none).why, /^There is no Music folder here, so Samples lists only the set's own folder/)
  assert.equal(stepOf(none, 'ground').state, 'accepted', 'a world with no Music folder has nothing to keep')
  // A refused Music reading never holds Setup (DLW build ruling 2026-11-09, round 48 item 0C-9; item 1's own rule): Music is the one row
  // Setup finishes without, and the row says why, and that Setup finished without it.
  const refused = of({state: 'refused', error: 'Central owner Action refused: Unknown Action: central.file-map.inspect'})
  assert.match(row(refused).why, /^Central did not say whether its file map keeps your Music folder: Central owner Action refused: Unknown Action: central\.file-map\.inspect\. Setup finishes without it; read the step again to keep it\.$/)
  assert.equal(row(refused).adopts, undefined, 'nothing to Accept on a reading not taken')
  assert.equal(stepOf(refused, 'ground').state, 'accepted', 'Setup finishes without Music')
  assert.equal(row(of(undefined)), undefined, 'no row where the host has no Music route')
})

test('SCRIPTED — once the ground stands, a held Accept keeps your Music folder as a scope of Central\'s file map on the digest of what the step showed, once', async () => {
  const {source, calls} = scriptedSetup()
  const music = {kept: false}
  const walk = new settingsPages.SetupWalk({...source, groundMusic: musicRoute(calls, music)})
  const row = () => stepOf(win.setupValues(walk.snapshot(), held({})), 'ground').items.find(item => item.name === 'Your Music folder')
  await walk.read()
  assert.equal(row(), undefined, 'no row before there is a ground, which keeps the scope')
  assert.ok(!calls.some(call => call[0] === 'music'), 'not asked before the ground stands')
  const made = await walk.accept('ground', held({}))
  assert.match(made, /Your Music folder is not kept yet: Central's file map can keep it now that your ground stands\. Accept again to keep it as the step shows\.$/)
  assert.ok(!calls.some(call => call[0] === 'music' && call[1] === 'keep'), 'what the step had not shown is not kept')
  assert.equal(row().adopts, true)
  assert.equal(stepOf(win.setupValues(walk.snapshot(), held({})), 'ground').state, 'found')
  const kept = await walk.accept('ground', held({}))
  assert.match(kept, /Central's file map keeps your Music folder, so Samples lists its audio; Central never writes inside it\./)
  const keeps = calls.filter(call => call[0] === 'music' && call[1] === 'keep').map(call => call[2])
  assert.equal(keeps.length, 1)
  assert.equal(keeps[0].expected_digest, 'sha256:absent-central.content-fnv1a64/v1:1', 'kept on the digest of what the step showed (round 54b item 9)')
  assert.equal(keeps[0].expected_revision, undefined, 'never on a revision alone')
  assert.match(String(keeps[0].acceptance_ref), /^dlw-setup-ground-accept:\d+$/, 'on the person\'s held Ground Accept, as the Day\'s form is (47c item 10)')
  assert.match(row().change, /^Central's file map keeps it/)
  assert.equal(stepOf(win.setupValues(walk.snapshot(), held({})), 'ground').state, 'accepted')
  await assert.rejects(walk.accept('ground', held({})), /Nothing is made twice/)
  // What the step showed moved after it was read: the kernel refuses it in its words, and the row stands to be accepted again.
  const moved = {kept: false}, again = scriptedSetup()
  const stale = new settingsPages.SetupWalk({...again.source, groundMusic: async request => request.operation === 'keep'
    ? musicRoute(again.calls, moved)({...request, expected_digest: 'sha256:absent-central.content-fnv1a64/v1:0'}) : musicRoute(again.calls, moved)(request)})
  await stale.read(); await stale.accept('ground', held({}))
  assert.match(await stale.accept('ground', held({})), /Your Music folder is not kept yet: Your Music folder no longer reads as the step showed it when you accepted, so nothing was registered\. Read the step again and accept what it shows\. Accept again to keep it\./)
  assert.equal(moved.kept, false)
})

test('SCRIPTED — an Accept that finds your Music folder kept already says so, never that the host did not answer on your acceptance (round 48 item 0C-8)', async () => {
  const {source, calls} = scriptedSetup()
  const music = {kept: false}
  const walk = new settingsPages.SetupWalk({...source, groundMusic: musicRoute(calls, music)})
  await walk.read()
  await walk.accept('ground', held({}))
  // Registered elsewhere between the step's reading and this Accept.
  music.kept = true
  const said = await walk.accept('ground', held({}))
  assert.match(said, /Music is kept already: Central's file map kept it before this Accept, so nothing was registered\./)
  assert.doesNotMatch(said, /not on your acceptance|not kept yet/)
  assert.equal(stepOf(win.setupValues(walk.snapshot(), held({})), 'ground').state, 'accepted')
})

test('SCRIPTED — Setup finishes on a Central whose file map keeps no folder scope: the Music row says so, offers nothing to Accept, and nothing is registered (47c item 1)', async () => {
  const {source, calls} = scriptedSetup()
  const music = {kept: false, older: true}
  const walk = new settingsPages.SetupWalk({...source, groundMusic: musicRoute(calls, music)})
  const row = () => stepOf(win.setupValues(walk.snapshot(), held({})), 'ground').items.find(item => item.name === 'Your Music folder')
  await walk.read()
  const made = await walk.accept('ground', held({}))
  assert.doesNotMatch(made, /Music/, 'the Accept that makes the ground says nothing of Music: there is nothing to keep')
  assert.deepEqual(row(), {name: 'Your Music folder', where: '/w/Bare/Music', why: 'This Central does not keep folder scopes yet, so Samples lists only the set\'s own folder.'})
  assert.equal(row().adopts, undefined, 'never an adopts this Central would refuse')
  assert.equal(stepOf(win.setupValues(walk.snapshot(), held({})), 'ground').state, 'accepted', 'Setup finishes without it')
  assert.ok(!calls.some(call => call[0] === 'music' && call[1] === 'keep'), 'nothing is registered')
})

// ── Sign in (manual §10.10 Rules; #758, round 862) ──────────────────────────────────────────────────────────────────────────

/** AIKit's client status (`aikit client status --json`, the kernel's harness_status) and each client's declared logins (`aikit harness
 * auth <client> --json`, harness_auth_describe), shaped as AIKit answers them (aikit-cli client.rs, harness_auth.rs AuthFace). */
const LOGIN_STATUS = {clients: [
  {client: 'codex', harness: 'codex', detection: 'detected', installed: true, credential: 'credential-gated',
    credential_reason: 'credential:openai is unbound and the harness\'s own login store at ~/.codex is absent — the ChatGPT OAuth flow'},
  {client: 'claude-code', harness: 'claude-code', detection: 'detected', installed: true, credential: 'ok', credential_reason: null},
  {client: 'gemini', harness: 'gemini', detection: 'detected', installed: true, credential: 'ok', credential_reason: null},
  {client: 'hermes', harness: 'hermes', detection: 'detected', installed: true, credential: 'unsupported', credential_reason: 'the hermes profile declares no key-delivery facts'},
  {client: 'opencode', harness: 'opencode', detection: 'unavailable', installed: false, credential: 'credential-gated', credential_reason: 'not on PATH'},
  {client: 'pi', harness: 'pi', detection: 'detected', installed: true, credential: 'unsupported', credential_reason: 'no harness profile carries pi'},
]}
const LOGIN_FACES = {
  codex: {slug: 'codex', env_var: [{provider_ref: 'provider:openai', env_var: 'OPENAI_API_KEY'}], own_login: [{provider_ref: 'provider:openai', runnable: true, argv: ['codex', 'login'], note: 'the ChatGPT OAuth flow'}]},
  // DLW build ruling 2026-11-04: Claude Code signs in by its one-shot `claude auth login`, read back through `claude auth status --json`.
  'claude-code': {slug: 'claude-code', env_var: [{provider_ref: 'provider:anthropic', env_var: 'ANTHROPIC_API_KEY'}], own_login: [{provider_ref: 'provider:anthropic', runnable: true,
    argv: ['claude', 'auth', 'login'], note: 'claude login keeps OAuth material in its own credential store (~/.claude/.credentials.json); the API key delivers only when credential:anthropic is bound',
    status: ['claude', 'auth', 'status', '--json']}]},
  // A harness whose login has no one-shot form: its note only (aikit-adapters profiles.rs gemini).
  gemini: {slug: 'gemini', env_var: [{provider_ref: 'provider:gemini', env_var: 'GEMINI_API_KEY'}], own_login: [{provider_ref: 'provider:gemini', runnable: false,
    note: 'Login with Google (OAuth) is Gemini CLI\'s default auth; the API key delivers only when credential:gemini is bound'}]},
  opencode: {slug: 'opencode', own_login: [{provider_ref: 'provider:openai', runnable: true, argv: ['opencode', 'auth', 'login']}]},
}
/** The census as the kernel answers it (`model_subscribe` agents: census.rs census_of in the World Model's slice, O-I ticket 1003): each
 * harness Actuation detects with an executable to start is an agent, AIKit's client row on it as detail; the others are no agents
 * (`not_agents`), each with why. `refused`: a census the World Model could not read, in its words. */
const censusAnswer = (agents, notAgents = [], refused = null) => ({schema: 'oi.world-model-slice/v1', slice: 'agents', owner: 'kernel', scopes: ['machine'], version: 1,
  state: refused ? 'refused' : 'read', error: refused, read_at_unix_ms: refused ? null : 1,
  value: refused ? null : {schema: 'oi.agents-census/v1', detection_ref: 'd1', observed_at: 'now', agents, not_agents: notAgents, aikit_detail: {state: 'read'}}})
const censusAgent = row => ({slug: row.harness, harness_ref: `harness/${row.harness}`, native_kind: 'harness', state: 'detected', executable: `/usr/local/bin/${row.client}`, aikit: row,
  starts: true, version: '1.0.0', start_seconds: 0.2, talks: true})
const notAnAgent = (row, why) => ({slug: row.harness, harness_ref: `harness/${row.harness}`, native_kind: 'harness', state: row.detection === 'detected' ? 'detected' : 'absent', executable: null,
  aikit: row, starts: false, talks: false, why})
/** LOGIN_STATUS's clients as the census lists them: the five on this computer are agents; opencode, not installed, is none. */
const LOGIN_CENSUS = censusAnswer(LOGIN_STATUS.clients.filter(row => row.detection === 'detected').map(censusAgent),
  LOGIN_STATUS.clients.filter(row => row.detection !== 'detected').map(row => notAnAgent(row, `Actuation does not detect ${row.harness} on this machine (absent)`)))
/** A kernel channel answering Sign in's reads: the census, AIKit's client status (`{error}`: one that does not answer) and each declared login. */
const loginAdapter = (status = LOGIN_STATUS, asked = [], census = LOGIN_CENSUS) => ({invoke: async op => {
  asked.push(op)
  if (op.op === 'model_subscribe' && op.slice === 'agents') return {outcome: {result: 'model_slice', data: census}}
  if (op.op === 'harness_status') return status.error ? {error: status.error} : {outcome: {result: 'harness_status_reading', data: status}}
  if (op.op === 'harness_auth_describe' && LOGIN_FACES[op.harness]) return {outcome: {result: 'harness_auth_reading', data: LOGIN_FACES[op.harness]}}
  if (op.op === 'harness_auth_describe' && op.harness === 'pi') return {error: '[harness_auth.unknown_harness] `pi` is not a harness AIKit carries a profile for'}
  return {error: `aikit harness auth ${op.harness} did not answer within 10s`}
}})
const HARNESS_READING = {kind: 'live', label: 'live', observed_at_unix_ms: 1, providers: {state: 'ok', rows: []},
  harnesses: {state: 'ok', rows: ['codex', 'claude-code', 'gemini', 'hermes', 'opencode', 'pi'].map(client => ({harness: client, client, detection: client === 'opencode' ? 'unavailable' : 'detected',
    detected: client !== 'opencode', detection_reason: null, installed: client !== 'opencode', config_dir: null, dispatch: 'acp', capability: 'descriptor', effect: null, items: null, adapter_gap: null}))},
  catalogue: {state: 'ok', rows: {count: 0, entries: []}}}
/** The census of those six (the World Model's agents, O-I #1003): the rows the page draws, AIKit's client facts joined on each. */
const HARNESS_CENSUS = {state: 'read', agents: ['codex', 'claude-code', 'gemini', 'hermes', 'opencode', 'pi'].map(slug => ({slug, harnessRef: `harness/${slug}`,
  executable: slug === 'opencode' ? null : `/x/${slug}`, starts: slug !== 'opencode' && slug !== 'hermes', aikit: null}))}

test('CODE-DERIVED — Harnesses & models shows what each agent that starts carries, as the census reads it from its owners: its model and skill set from AIKit, the law statements of its floor from Central, or why not', async () => {
  const {censusOf} = await import('../../../../desktop/cradle/src/agency/census.ts')
  // The agents slice as the kernel answers it (census.rs carries_of): Claude Code carries a model default, the foundation set and a rendered
  // floor's two statements; Codex has no model default and Central did not read its floor; gemini did not start and carries nothing.
  const answer = {schema: 'oi.world-model-slice/v1', slice: 'agents', owner: 'kernel', scopes: ['machine'], version: 3, state: 'read', error: null, read_at_unix_ms: 1, value: {agents: [
    {slug: 'claude-code', harness_ref: 'harness/claude-code', executable: '/x/claude', starts: true, talks: true, version: '2.1.323', aikit: {client: 'claude', harness: 'claude-code'},
      carries: {model: {model_id: 'claude-opus-5-5', model_name: 'Claude Opus 5.5'}, skills: {sets: ['foundation'], skills: ['engineering-methodology', 'wayfinder']},
        law: {file: 'CLAUDE.md', state: 'rendered', renderer: 'control.floor.render', statements: [{file: 'authorship-and-return/propose-not-write.md', topic: 'Authorship', standing: 'adopted'},
          {file: 'world/shape-of-the-world.md', topic: 'Shape of the world', standing: 'adopted'}]}}},
    {slug: 'codex', harness_ref: 'harness/codex', executable: '/x/codex', starts: true, talks: true, version: 'codex-cli 0.155.1', aikit: {client: 'codex', harness: 'codex'},
      carries: {model: {own: true, why: 'AIKit holds no model default for codex: a new chat opens with its own model'}, skills: {sets: [], skills: []},
        law: {file: 'AGENTS.md', why: 'Central did not read the floor: no control.floor.read here'}}},
    {slug: 'gemini', harness_ref: 'harness/gemini', executable: '/x/gemini', starts: false, talks: false, why: 'gemini did not start', aikit: null}]}}
  const census = censusOf({state: 'held', answer})
  assert.deepEqual(census.agents[0].carries, {model: {id: 'claude-opus-5-5', name: 'Claude Opus 5.5'}, skills: {sets: ['foundation'], skills: ['engineering-methodology', 'wayfinder']},
    law: {file: 'CLAUDE.md', state: 'rendered', renderer: 'control.floor.render', statements: [{file: 'authorship-and-return/propose-not-write.md', topic: 'Authorship', standing: 'adopted'},
      {file: 'world/shape-of-the-world.md', topic: 'Shape of the world', standing: 'adopted'}]}})
  assert.equal(census.agents[2].carries, undefined, 'an agent that did not start carries nothing')
  const rows = Object.fromEntries(JSON.parse(win.harnessValues(null, null, census).harnesses).map(row => [row.agent, row]))
  assert.deepEqual([rows['claude-code'].model, rows['claude-code'].sets, rows['claude-code'].law.map(row => row.topic), rows['claude-code'].lawFile],
    ['Claude Opus 5.5', ['foundation'], ['Authorship', 'Shape of the world'], 'CLAUDE.md'])
  assert.deepEqual([rows.codex.model, rows.codex.modelWhy, rows.codex.sets, rows.codex.law, rows.codex.lawWhy],
    [undefined, 'AIKit holds no model default for codex: a new chat opens with its own model', [], undefined, 'Central did not read the floor: no control.floor.read here'])
  const page = drawn({harnesses: win.harnessValues(null, null, census).harnesses}, 'harnesses')
  for (const shown of ['Claude Opus 5.5', 'foundation', 'Authorship · Shape of the world', 'CLAUDE.md', escaped('AIKit holds no model default for codex')]) assert.ok(page.includes(shown), `drawn: ${shown}`)
  assert.ok(!page.includes('data-carries="gemini"'), 'nothing carried is drawn for an agent that does not start')
})

test('CODE-DERIVED — Sign in is each harness\'s own login as AIKit declares it: a runnable one runs its command (Claude Code\'s claude auth login as Codex\'s codex login), one that signs in inside itself says so in its own words and offers no button, a login that cannot be read affects that harness alone', async () => {
  const asked = []
  const logins = await settingsPages.harnessLogins(loginAdapter(LOGIN_STATUS, asked)).read()
  assert.deepEqual(asked.map(op => op.op === 'harness_auth_describe' ? op.harness : op.op), ['model_subscribe', 'harness_status', 'codex', 'claude-code', 'gemini', 'hermes', 'pi'],
    'the census and AIKit\'s client status, then the declared logins of each agent of the census AIKit has a client for')
  assert.ok(!asked.some(op => op.op === 'model_subscribe' && op.fresh), 'a plain read takes the census the kernel holds')
  const rows = Object.fromEntries(JSON.parse(win.harnessValues(HARNESS_READING, logins, HARNESS_CENSUS).harnesses).map(row => [row.client, row]))
  assert.deepEqual(rows.codex.signIn, [{key: 'codex|provider:openai', provider: 'openai', command: 'codex login'}], 'a runnable login: its command, as AIKit declares it')
  assert.match(rows.codex.loginNow, /^AIKit does not find what codex needs to sign in yet: credential:openai is unbound/, 'what AIKit finds now, in its words')
  assert.deepEqual(rows['claude-code'].signIn, [{key: 'claude-code|provider:anthropic', provider: 'anthropic', command: 'claude auth login'}], 'Claude Code: its one-shot login, as Codex\'s')
  assert.equal(rows['claude-code'].loginNow, 'AIKit finds what claude-code needs to sign in.')
  assert.equal(rows['claude-code'].signInNote, undefined, 'no stale note that it signs in only inside itself')
  assert.equal(rows.gemini.signIn, undefined, 'a harness that signs in inside itself offers no button')
  assert.equal(rows.gemini.signInNote, 'Login with Google (OAuth) is Gemini CLI\'s default auth; the API key delivers only when credential:gemini is bound', '… and says so in its own words')
  assert.match(rows.hermes.signInUnread, /^AIKit did not say how hermes signs in: aikit harness auth hermes did not answer within 10s$/, 'a login it cannot read is that harness\'s alone')
  for (const client of ['codex', 'claude-code', 'gemini', 'pi']) assert.equal(rows[client].signInUnread, undefined, `${client}: unaffected by hermes`)
  assert.deepEqual([rows.pi.signIn, rows.pi.signInNote], [undefined, undefined], 'a harness AIKit carries no profile for has no login to offer, and no fault')
  assert.deepEqual([rows.opencode.signIn, rows.opencode.signInNote], [undefined, undefined], 'a harness not on this computer is installed first: no login stands on it')
  // Credentials: beside a provider's key, the runnable logins of the harnesses here that serve that provider.
  const creds = JSON.parse(win.credentialValues([{credential: 'ai-kit:credential:openai', provider: 'provider:openai', reference: 'keychain://aikit/openai', revoked: false, verifiedAt: null},
    {credential: 'ai-kit:credential:anthropic', provider: 'provider:anthropic', reference: 'keychain://aikit/anthropic', revoked: false, verifiedAt: null}], {}, null, logins).credentials)
  assert.deepEqual(creds[0].signIn, [{key: 'codex|provider:openai', harness: 'codex', command: 'codex login'}], 'OpenAI\'s key: codex\'s own login, never opencode\'s (not on this computer)')
  assert.deepEqual(creds[1].signIn, [{key: 'claude-code|provider:anthropic', harness: 'claude-code', command: 'claude auth login'}], 'Anthropic\'s key: Claude Code\'s own login beside it')
  assert.equal(JSON.parse(win.credentialValues([], {}, null, null).credentials).length, 0, 'no login reading: nothing invented')
  // The login to run, and the result read back after it ends.
  const codex = settingsPages.loginOf(logins, 'codex|provider:openai')
  assert.deepEqual([codex.command, codex.title], [['codex', 'login'], 'Sign in · codex'])
  const claude = settingsPages.loginOf(logins, 'claude-code|provider:anthropic')
  assert.deepEqual([claude.command, claude.title, claude.check], [['claude', 'auth', 'login'], 'Sign in · claude-code', ['claude', 'auth', 'status', '--json']], 'Claude Code\'s login runs, with its check')
  assert.throws(() => settingsPages.loginOf(logins, 'gemini|provider:gemini'), /^Error: Login with Google \(OAuth\) is Gemini CLI's default auth/)
  assert.throws(() => settingsPages.loginOf(logins, 'hermes|provider:x'), /AIKit did not say how hermes signs in/)
  assert.throws(() => settingsPages.loginOf(null, 'codex|provider:openai'), /the agents' logins are not read yet/)
  assert.throws(() => settingsPages.loginOf(logins, 'nosuch|provider:x'), /nosuch is no agent on this computer that AIKit has a client for/)
  const after = await settingsPages.harnessLogins(loginAdapter({clients: LOGIN_STATUS.clients.map(row => row.client === 'codex' ? {...row, credential: 'ok', credential_reason: null} : row)})).read()
  assert.equal(win.loginReadBack(codex, after), 'codex login has ended, and AIKit now finds what codex needs to sign in.')
  assert.match(win.loginReadBack(codex, logins), /^codex login has ended, but AIKit does not find what codex needs yet: credential:openai is unbound/)
  assert.match(win.loginReadBack(codex, null, 'the kernel did not answer'), /^codex login has ended, but the agents' logins could not be read again: the kernel did not answer$/)
  await assert.rejects(settingsPages.harnessLogins({}).read(), /not connected/, 'no kernel channel: said, never an empty list')
})

test('CODE-DERIVED — Sign in reads the result back through the harness\'s own logged-in check where AIKit declares one (aikit harness auth <client> --check), and through AIKit\'s credential leg where it declares none', async () => {
  const CHECK = ['codex', 'login', 'status']
  const faces = {...LOGIN_FACES, codex: {...LOGIN_FACES.codex, own_login: [{...LOGIN_FACES.codex.own_login[0], status: CHECK}]}}
  const checkAdapter = (answer, asked = []) => ({invoke: async op => {
    asked.push(op)
    if (op.op === 'model_subscribe' && op.slice === 'agents') return {outcome: {result: 'model_slice', data: LOGIN_CENSUS}}
    if (op.op === 'harness_status') return {outcome: {result: 'harness_status_reading', data: LOGIN_STATUS}}
    if (op.op === 'harness_auth_describe' && op.check) return answer(op)
    if (op.op === 'harness_auth_describe' && faces[op.harness]) return {outcome: {result: 'harness_auth_reading', data: faces[op.harness]}}
    return {error: `[harness_auth.unknown_harness] ${op.harness}`}
  }})
  const checks = (rows) => () => ({outcome: {result: 'harness_auth_reading', data: {slug: 'codex', checks: rows}}})
  const asked = []
  const logins = await settingsPages.harnessLogins(checkAdapter(checks([]), asked)).read()
  assert.ok(asked.every(op => !op.check), 'reading the logins runs no check: describe names it only')
  assert.deepEqual(win.harnessLoginsOf(faces.codex), [{provider: 'provider:openai', command: ['codex', 'login'], note: 'the ChatGPT OAuth flow', check: CHECK}], 'the declared check, by its argv')
  const codex = settingsPages.loginOf(logins, 'codex|provider:openai')
  assert.deepEqual(codex.check, CHECK, 'the login to run carries the check that reads it back')
  const signedIn = [{provider_ref: 'provider:openai', argv: CHECK, signed_in: true}]
  const ran = []
  const yes = await settingsPages.loginResult(checkAdapter(checks(signedIn), ran), codex)
  assert.deepEqual(ran.filter(op => op.check).map(op => [op.op, op.harness]), [['harness_auth_describe', 'codex']], 'the check is asked of AIKit once, for that client')
  assert.equal(yes.said, 'codex login has ended, and codex login status says codex is signed in.')
  assert.ok(yes.after?.clients.length, 'the logins are read again too')
  assert.equal((await settingsPages.loginResult(checkAdapter(checks([{provider_ref: 'provider:openai', argv: CHECK, signed_in: false}])), codex)).said,
    'codex login has ended, but codex login status says codex is not signed in.')
  // No answer from the check: said, and the credential leg read back instead.
  assert.equal((await settingsPages.loginResult(checkAdapter(checks([{provider_ref: 'provider:openai', argv: CHECK, unread: 'mux.command_timeout: codex took too long'}])), codex)).said,
    'codex login status did not answer: mux.command_timeout: codex took too long. codex login has ended, but AIKit does not find what codex needs yet: credential:openai is unbound and the harness\'s own login store at ~/.codex is absent — the ChatGPT OAuth flow.')
  assert.match((await settingsPages.loginResult(checkAdapter(() => ({error: 'aikit harness auth codex --check did not answer within 10s'})), codex)).said,
    /^codex login status did not answer: aikit harness auth codex --check did not answer within 10s\. codex login has ended, but AIKit does not find/)
  assert.match((await settingsPages.loginResult(checkAdapter(checks([])), codex)).said, /^codex login status did not answer: AIKit ran no check for provider:openai\. codex login has ended/)
  // Claude Code reads back as Codex does: its declared check, claude auth status --json (DLW build ruling 2026-11-04).
  const claude = settingsPages.loginOf(logins, 'claude-code|provider:anthropic')
  const claudeChecks = () => ({outcome: {result: 'harness_auth_reading', data: {slug: 'claude-code', checks: [{provider_ref: 'provider:anthropic', argv: ['claude', 'auth', 'status', '--json'], signed_in: true}]}}})
  const claudeRan = []
  assert.equal((await settingsPages.loginResult(checkAdapter(claudeChecks, claudeRan), claude)).said, 'claude auth login has ended, and claude auth status --json says claude-code is signed in.')
  assert.deepEqual(claudeRan.filter(op => op.check).map(op => op.harness), ['claude-code'], 'its check is asked of AIKit, for that client')
  // A login with no declared check: the credential leg, and no check is asked.
  const plainCodex = {client: 'codex', harness: 'codex', provider: 'provider:openai', command: ['codex', 'login'], title: 'Sign in · codex'}
  const plain = []
  const leg = await settingsPages.loginResult(checkAdapter(checks(signedIn), plain), plainCodex)
  assert.ok(plain.every(op => !op.check), 'no declared check: none is asked')
  assert.equal(leg.said, 'codex login has ended, but AIKit does not find what codex needs yet: credential:openai is unbound and the harness\'s own login store at ~/.codex is absent — the ChatGPT OAuth flow.')
  assert.ok(!plain.some(op => op.op === 'model_subscribe' && op.fresh), 'the read back takes the census the kernel holds: a login moves no agent')
  // A login of a harness the census does not list (opencode is not installed): never a credential leg of a client that is no agent here.
  const opencode = {client: 'opencode', harness: 'opencode', provider: 'provider:openai', command: ['opencode', 'auth', 'login'], title: 'Sign in · opencode'}
  assert.equal((await settingsPages.loginResult(checkAdapter(checks(signedIn)), opencode)).said, 'opencode auth login has ended, but opencode is no longer among the agents on this computer.')
  const pages = readFileSync(new URL('../src/settings/windowPages.ts', import.meta.url), 'utf8')
  assert.match(pages, /const result = await loginResult\(source, login\)/, 'Sign in reads back through loginResult')
  assert.match(win.SETTINGS_WINDOW_WIRING.reads.loginSaid ?? '', /--check/, 'the wiring names the check')
})

test('CODE-DERIVED — Sign in stands on the census (O-I ticket 1003: AIKit adds detail, never a row): a client AIKit\'s status calls detected that the census lists as no agent is never asked nor offered, on Credentials or Harnesses & models; a census not read is said with its why', async () => {
  const {censusOf} = await import('../../../../desktop/cradle/src/agency/census.ts')
  // ~/.codex and ~/.claude stand but neither codex nor claude is on PATH: Actuation detects both by their folders and AIKit's client status
  // passes that on as detected; the census lists both among the harnesses that are no agents (census.rs: no executable to start).
  const gone = ['codex', 'claude-code']
  const census = censusAnswer(LOGIN_STATUS.clients.filter(row => row.detection === 'detected' && !gone.includes(row.client)).map(censusAgent),
    LOGIN_STATUS.clients.filter(row => row.detection !== 'detected' || gone.includes(row.client)).map(row => notAnAgent(row, row.detection === 'detected'
      ? `Actuation detects ${row.harness} but found no executable to start` : `Actuation does not detect ${row.harness} on this machine (absent)`)))
  const asked = []
  const logins = await settingsPages.harnessLogins(loginAdapter(LOGIN_STATUS, asked, census)).read()
  assert.deepEqual(logins.clients.map(client => client.client), ['gemini', 'hermes', 'pi'], 'exactly the census\'s agents AIKit has a client for')
  assert.deepEqual(asked.filter(op => op.op === 'harness_auth_describe').map(op => op.harness), ['gemini', 'hermes', 'pi'], 'AIKit is asked how each of them signs in, and of no other client')
  const keys = [{credential: 'ai-kit:credential:openai', provider: 'provider:openai', reference: 'keychain://aikit/openai', revoked: false, verifiedAt: null},
    {credential: 'ai-kit:credential:anthropic', provider: 'provider:anthropic', reference: 'keychain://aikit/anthropic', revoked: false, verifiedAt: null}]
  assert.deepEqual(JSON.parse(win.credentialValues(keys, {}, null, logins).credentials).map(row => row.signIn), [undefined, undefined],
    'no codex login beside OpenAI\'s key and no claude auth login beside Anthropic\'s: neither runs on this computer')
  assert.throws(() => settingsPages.loginOf(logins, 'codex|provider:openai'), /^Error: codex is no agent on this computer that AIKit has a client for, so there is nothing to sign in to\.$/)
  assert.deepEqual(JSON.parse(win.harnessValues(HARNESS_READING, logins, censusOf({state: 'held', answer: census})).harnesses).map(row => row.agent), ['gemini', 'hermes', 'pi'],
    'Harnesses & models lists the same agents Sign in reads')
  // A census the World Model could not read: no client is asked, and Sign in says why, never an empty list of agents.
  const refused = []
  await assert.rejects(settingsPages.harnessLogins(loginAdapter(LOGIN_STATUS, refused, censusAnswer([], [], 'Actuation\'s harness detection: actuation detect did not answer within 10s'))).read(),
    /^Error: The agents on this computer are not read: Actuation's harness detection: actuation detect did not answer within 10s$/)
  assert.ok(!refused.some(op => op.op === 'harness_auth_describe'), 'no client is asked how it signs in')
  // AIKit's client status not answering: the census's agents stand with their logins, each saying its credential leg is not known.
  const unknown = 'aikit client status did not answer within 10s'
  const statusless = await settingsPages.harnessLogins(loginAdapter({error: unknown})).read()
  assert.deepEqual(statusless.clients.map(client => [client.client, client.credentialUnread]), ['codex', 'claude-code', 'gemini', 'hermes', 'pi'].map(client => [client, unknown]))
  const codex = JSON.parse(win.harnessValues(HARNESS_READING, statusless, HARNESS_CENSUS).harnesses).find(row => row.client === 'codex')
  assert.deepEqual(codex.signIn, [{key: 'codex|provider:openai', provider: 'openai', command: 'codex login'}], 'its login is offered still')
  assert.equal(codex.loginNow, `AIKit's client status could not be read, so whether AIKit finds what codex needs to sign in is not known: ${unknown}`)
  assert.equal(win.loginReadBack(settingsPages.loginOf(statusless, 'codex|provider:openai'), statusless), `codex login has ended, but AIKit's client status could not be read again: ${unknown}`)
  // Read again on Sign in asks the census afresh, as Harnesses & models does: both pages stand on one reading of the agents.
  const pressed = []
  let part
  const Probe = () => { part = settingsPages.useSignIn(loginAdapter(LOGIN_STATUS, pressed), true); return null }
  renderToStaticMarkup(createElement(Probe))
  await part.reread()
  assert.deepEqual(pressed.filter(op => op.op === 'model_subscribe').map(op => op.fresh), [true])
  // The wiring names the census as Sign in's list.
  assert.match(win.SETTINGS_WINDOW_WIRING.writes.signIn ?? '', /model_subscribe agents/)
})

test('CODE-DERIVED — a census read while AIKit\'s client status did not answer: Sign in says AIKit\'s why, never an empty list of logins, and Setup\'s Credentials says why no agent\'s providers were asked (O-I ticket 1003)', async () => {
  const {censusOf} = await import('../../../../desktop/cradle/src/agency/census.ts')
  // census.rs read(): Actuation's agents stand, each with no AIKit row, and `aikit_detail` says why AIKit was not read.
  const why = 'AIKit client status is unavailable: aikit client status did not answer within 10s'
  const bare = LOGIN_STATUS.clients.filter(row => row.detection === 'detected').map(row => ({...censusAgent(row), aikit: null, talks: false}))
  const census = {...censusAnswer(bare), value: {...censusAnswer(bare).value, aikit_detail: {state: 'unavailable', why}}}
  const read = censusOf({state: 'held', answer: census})
  assert.equal(read.state, 'read')
  assert.equal(read.aikitWhy, why, 'the census carries AIKit\'s why beside its agents')
  const asked = []
  await assert.rejects(settingsPages.harnessLogins(loginAdapter(LOGIN_STATUS, asked, census)).read(),
    new RegExp(`^Error: AIKit's client status was not read with the agents on this computer, so no agent's login is known: ${why}$`))
  assert.ok(!asked.some(op => op.op === 'harness_auth_describe'), 'no client is asked how it signs in')
  const credentials = win.setupCredentialStep({state: 'read', findings: [], providers: [], bindings: [], aikitWhy: why}, () => undefined)
  assert.deepEqual(credentials.items, [{name: 'Your agents\' providers', why: `AIKit's client status was not read with the agents on this computer, so no agent's providers were asked: ${why}.`}])
  // A census read with AIKit's detail carries no such why.
  assert.equal(censusOf({state: 'held', answer: LOGIN_CENSUS}).aikitWhy, undefined)
})

test('CODE-DERIVED — Launch beside each agent that starts: Factory\'s Set says where a session can start, the press runs factory.session.start through the registry\'s door with the agent, and Factory\'s answer is read back (O-I ticket 1003)', async () => {
  const setOf = (acts, waiting = {}) => ({state: 'held', answer: {schema: 'oi.mode-set/v1', mode: 'factory', version: 3, set: {acts, waiting}}})
  const seatIn = project => ({action: 'factory.session.start', input: {world: '/w/Central', project}, takes: 'agent',
    words: `Factory's factory.session.start: the agent seated on a new track in ${project}`, done: `The agent is seated on a new track in ${project}: its session is open.`})
  // kernel mode_set.rs: one project holding a workcell seat is the Set's `seat`; several are each `seat:<project>`, the empty track's drop waiting.
  const one = setOf({seat: seatIn('atelier'), arm: {action: 'shell.setWriteArm', words: 'Arm', takes: 'on'}})
  assert.deepEqual(win.launchValues(win.launchSeats(one)), {launchProjects: '["atelier"]'})
  const several = setOf({'seat:kiln': seatIn('kiln'), 'seat:atelier': seatIn('atelier')},
    {'track.seat': 'an agent seated on a new track: factory.session.start opens its session in one project, and several hold a workcell seat (atelier, kiln), which a drop does not choose between'})
  assert.deepEqual(win.launchValues(win.launchSeats(several)), {launchProjects: '["atelier","kiln"]'}, 'a press names its project, so each project\'s seat stands')
  const none = setOf({}, {'track.seat': 'an agent seated on a new track: factory.session.start opens its session in a project\'s workcell seat, and no project of this World holds one (Workcell\'s seat join)'})
  assert.deepEqual(win.launchValues(win.launchSeats(none)), {launchWhy: 'Factory starts no session here yet: an agent seated on a new track: factory.session.start opens its session in a project\'s workcell seat, and no project of this World holds one (Workcell\'s seat join).'})
  assert.deepEqual(win.launchValues(win.launchSeats({state: 'unavailable', reason: 'the kernel is not running'})),
    {launchWhy: 'Factory\'s Set is not read, so no session can be started here: the kernel is not running.'})
  // The press: the seat act for the project named, the agent in the place it takes, through the registry's door; Factory's answer read back.
  const called = []
  const opened = (project, kept = true) => ({contract: 'factory.session/v1', state: 'open', session: `agent-session/${project}-chat-1`, space: `session-space/${project}-chat-1`,
    agent: 'codex', world: '/w/Central', project, checkout: `/w/Central/worktrees/env-1/${project}`,
    record: kept ? {event: 'SessionStart', client: 'codex', kept: true, answer: '', words: '', by: 'aikit hook dispatch'}
      : {event: 'SessionStart', client: 'codex', kept: false, words: 'AIKit\'s hook dispatch could not start: No such file', by: 'aikit hook dispatch'}})
  const act = async (action, input) => { called.push([action, input]); return opened(input.project) }
  assert.equal(await settingsPages.launchAgent(several, act, 'codex|kiln'),
    'codex is seated on a new track in kiln, in the World /w/Central: its session is open in /w/Central/worktrees/env-1/kiln, and AIKit\'s SessionStart hook kept its record.')
  assert.equal(await settingsPages.launchAgent(one, act, 'claude-code|'), 'claude-code is seated on a new track in atelier, in the World /w/Central: its session is open in /w/Central/worktrees/env-1/atelier, and AIKit\'s SessionStart hook kept its record.',
    'where the Set offers one project, the press needs none named')
  assert.deepEqual(called, [['factory.session.start', {world: '/w/Central', project: 'kiln', agent: 'codex'}], ['factory.session.start', {world: '/w/Central', project: 'atelier', agent: 'claude-code'}]])
  // Several projects and none named, a project with no seat, a Set with none, and no door: each refuses in words, and no owner is asked.
  await assert.rejects(settingsPages.launchAgent(several, act, 'codex|'), /^Error: Choose the project codex starts in: atelier, kiln\.$/)
  await assert.rejects(settingsPages.launchAgent(several, act, 'codex|loose'), /^Error: Factory's Set offers no seat in loose: it offers one in atelier, kiln\.$/)
  await assert.rejects(settingsPages.launchAgent(none, act, 'codex|atelier'), /^Error: Factory starts no session here yet: an agent seated on a new track/)
  await assert.rejects(settingsPages.launchAgent(null, act, 'codex|atelier'), /^Error: Factory's Set is being read\.$/)
  await assert.rejects(settingsPages.launchAgent(one, undefined, 'codex|atelier'), /^Error: Launch reaches no Action door here/)
  assert.equal(called.length, 2, 'no refused press reached an owner')
  // An answer that is no open session is said, never read as a start; a SessionStart hook that kept no record says so, in AIKit's words.
  await assert.rejects(settingsPages.launchAgent(one, async () => ({contract: 'factory.session/v1', state: 'ended'}), 'codex|atelier'), /^Error: Factory answered factory\.session\.start for codex without an open session: /)
  assert.match(win.launchSaid('codex', opened('atelier', false)), /, and AIKit's SessionStart hook did not keep its record \(AIKit's hook dispatch could not start: No such file\)\.$/)
  // Drawn on Harnesses & models: Launch beside the agent that starts, none beside the one that does not; several projects are chosen
  // between once, above the agents; a Set with no seat says why on the press.
  const harnesses = json([{agent: 'codex', harness: 'Codex', starts: true, talks: true}, {agent: 'gemini', harness: 'Gemini', starts: false, talks: false, why: 'it exited 1'}])
  const launches = markup => [...markup.matchAll(/data-i="(Launch\|[^"]*)"( data-disabled="true")?/g)].map(match => [match[1], !!match[2]])
  const single = drawn({harnesses, launchProjects: '["atelier"]'}, 'harnesses')
  assert.deepEqual(launches(single).map(([words, off]) => [words.split('|')[1], off]),
    [['Starts a session of Codex in atelier: Factory seats it on a new track there, with this World, the project and today&#x27;s Day.', false]], 'one Launch, beside Codex, which starts')
  assert.doesNotMatch(single, /Sessions start in/, 'one project: nothing to choose')
  const choose = drawn({harnesses, launchProjects: '["atelier","kiln"]'}, 'harnesses')
  assert.match(choose, /aria-label="Sessions start in"/)
  assert.deepEqual(launches(choose).map(([words, off]) => [words.includes('Choose the project it starts in first.'), off]), [[true, true]], 'several projects: Launch waits for the choice')
  assert.deepEqual(launches(drawn({harnesses, launchProjects: '["atelier","kiln"]', launchIn: 'kiln'}, 'harnesses')).map(([words, off]) => [words.split('|')[1].split(':')[0], off]),
    [['Starts a session of Codex in kiln', false]])
  const waits = drawn({harnesses, launchWhy: 'Factory starts no session here yet: no project of this World holds one (Workcell&#x27;s seat join).'}, 'harnesses')
  assert.deepEqual(launches(waits).map(([words, off]) => [words.includes('no project of this World holds one'), off]), [[true, true]], 'the Set\'s why, on the press')
  // The wiring names the seat act and the registry's door.
  assert.match(win.SETTINGS_WINDOW_WIRING.writes.launch, /factory\.session\.start through Factory's Set's seat act/)
  assert.ok(win.SETTINGS_LOCAL_KEYS.includes('launchIn'))
})

test('SCRIPTED — Sign in runs the login in a terminal in the Workbench, where you answer it: the request names its id and command, a refusal comes back in words, and the end of that terminal is what the page reads back on', async () => {
  const was = globalThis.window, target = new EventTarget(), heard = []
  globalThis.window = target
  try {
    target.addEventListener(settingsHost.LOGIN_TERMINAL_PRESENT, event => { heard.push(event.detail); event.detail.complete() })
    const id = await settingsPages.openLoginTerminal({command: ['codex', 'login'], title: 'Sign in · codex'})
    assert.equal(heard.length, 1)
    assert.deepEqual([heard[0].id, heard[0].command, heard[0].title], [id, ['codex', 'login'], 'Sign in · codex'])
    const refusing = new EventTarget()
    globalThis.window = refusing
    refusing.addEventListener(settingsHost.LOGIN_TERMINAL_PRESENT, event => event.detail.complete('The real native terminal requires the desktop host.'))
    await assert.rejects(settingsPages.openLoginTerminal({command: ['codex', 'login'], title: 'x'}), /^Error: The real native terminal requires the desktop host\.$/)
    globalThis.window = new EventTarget()
    await assert.rejects(settingsPages.openLoginTerminal({command: ['codex', 'login'], title: 'x'}, 5), /^Error: No Workbench took the login terminal, so nothing ran\.$/)
  } finally { globalThis.window = was }
  // The end: the terminal's process exits, or its tab closes after it stood.
  const terminals = await import('../../../../desktop/cradle/src/terminal/terminalReadings.ts')
  const reading = (id, exited) => ({id, title: 'Sign in · codex', cwd: '/w', cwdStanding: null, command: 'codex login', exited, archived: false, fontSize: 12, scrollback: 1000, lines: 1, watch: false, attachedAt: 1})
  const hand = {fontSize() {}, scrollback() {}, watch() {}}
  let ended = false
  const exits = settingsPages.loginEnded('t-exit').then(() => { ended = true })
  terminals.publishTerminal(reading('t-exit', false), hand)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(ended, false, 'still running: nothing is read back')
  terminals.publishTerminal(reading('t-exit', true), hand)
  await exits
  terminals.retireTerminal('t-exit')
  const closes = settingsPages.loginEnded('t-close')
  terminals.publishTerminal(reading('t-close', false), hand)
  terminals.retireTerminal('t-close')
  await closes
})

test('SCRIPTED — the design draws Sign in where the manual puts it: on each harness client with a login of its own (Claude Code\'s as Codex\'s), beside a provider\'s key on Credentials; the note of one that signs in inside itself, no button; and the result read back', () => {
  const tr = (markup, name) => markup.split('<tr').find(row => row.includes(`<b>${name}</b>`)) ?? ''
  const harnesses = drawn({...design.defaults}, 'harnesses')
  assert.match(tr(harnesses, 'Codex'), /Sign in…/, 'Codex: its own login')
  assert.match(tr(harnesses, 'Codex'), /codex login/, '… naming the command it runs')
  assert.match(tr(harnesses, 'Claude Code'), /Sign in…/, 'Claude Code: its own login, as Codex\'s')
  assert.match(tr(harnesses, 'Claude Code'), /claude auth login/, '… naming the command it runs')
  assert.doesNotMatch(tr(harnesses, 'Claude Code'), /Signs in inside itself|\/login/, 'no stale note that it signs in only inside itself')
  assert.doesNotMatch(tr(harnesses, 'Gemini CLI'), /Sign in…/, 'Gemini CLI signs in inside itself: no button')
  assert.match(tr(harnesses, 'Gemini CLI'), />Signs in inside itself</, '… says so')
  assert.match(tr(harnesses, 'Gemini CLI'), /data-i="Sign in\|Login with Google \(OAuth\) is Gemini CLI&#x27;s default auth/, '… in its own words when you point at it')
  assert.doesNotMatch(tr(harnesses, 'OpenCode'), /Sign in…/, 'not installed: no login stands')
  const read = drawn({...design.defaults, loginSaid: 'codex login has ended, and AIKit now finds what codex needs to sign in.'}, 'harnesses')
  assert.match(read, /codex login has ended, and AIKit now finds what codex needs to sign in\./, 'the result read back stands on the page')
  const credentials = drawn({...design.defaults}, 'credentials')
  assert.match(tr(credentials, 'OpenAI'), /Sign in…/, 'beside OpenAI\'s key: the harness that serves it signs in')
  assert.match(tr(credentials, 'Anthropic'), /Sign in…/, 'beside Anthropic\'s key: Claude Code signs in')
  assert.match(tr(credentials, 'Anthropic'), /claude auth login/)
  const text = readFileSync(new URL('../src/inhabitants/catalogue/panels/settings__window.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(text, /Opens this harness's connection beside the conversation/, 'no stale claim of a connection beside the conversation')
})

test('CODE-DERIVED — the login terminal\'s door: App steps back from Settings and presents the Workbench, which opens the terminal under the request\'s id with its command; the wiring names AIKit\'s routes, never a navigation', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const bench = readFileSync(new URL('../src/native/Workbench.tsx', import.meta.url), 'utf8')
  const pages = readFileSync(new URL('../src/settings/windowPages.ts', import.meta.url), 'utf8')
  assert.match(app, /addEventListener\(LOGIN_TERMINAL_PRESENT/, 'App hears Sign in')
  assert.match(app, /presentSettings\(false\); openSettings\(null\); setCenterPanel\('native\.workbench'\); setLoginIntent\(/, 'Settings steps back and the Workbench is presented')
  assert.match(app, /new CustomEvent\(LOGIN_TERMINAL_OPEN, \{detail: loginIntent\}\)/, 'then the Workbench is handed the request')
  assert.match(bench, /\[LOGIN_TERMINAL_OPEN, loginOpen\]/, 'the Workbench receives it')
  assert.match(bench, /openKind\('terminal', request\.id, undefined, \{command: request\.command, title: request\.title\}\)/, 'one terminal, under the request\'s id, running its command')
  assert.match(bench, /terminal: \{cwd, \.\.\.\(carried \? \{command: \[\.\.\.carried\.command\]\} : \{\}\)\}/)
  assert.doesNotMatch(pages, /NO_NAVIGATE\('Sign in/, 'Sign in reaches no navigation: it runs the login')
  const w = win.SETTINGS_WINDOW_WIRING
  for (const route of ['harness_auth_describe', 'harness_status', 'LOGIN_TERMINAL_PRESENT']) assert.ok(w.writes.signIn.includes(route), `signIn: ${route}`)
  assert.match(w.reads.loginSaid ?? '', /harness_status/, 'the result read back is AIKit\'s client status')
})

// ── O-I #758: each page draws its owner's values, or names what is absent with the owner's reason ──────────────────────────────────
// The native walk (12 Nov, candidate 56ca72a8 on the owner's world) saw most pages draw "No reading of…" or "—" with no reason. Causes,
// as read from the code and from the owners' own answers in a disposable world (`oi config list`, `oi config resolve` under a scratch
// HOME): readings asked and not answered yet were drawn as absent (the binding's `waiting` never reached the design); a refused read's
// words stood only on a button's Info line; a setting that applies only to a project was never asked (no project offered under Applies
// to); and an owner that answers without a value (AIKit's "no project context is bound") was drawn "inherited" and "—".

/** Two owner descriptors as `oi config list --json` gives them (a scratch world, 12 Nov). */
const GUARDRAIL = {allowed_scopes: [{scope_kind: 'machine', scope_ref: null}], default_semantics: 'none', description: 'The PreToolUse enforcement entry.', effect: {kind: 'none', summary: 'The harness owns this entry natively.'},
  native_ref: '~/.claude/settings.json hooks.PreToolUse[].hooks[].command', operations: {apply: false, plan: false, reset: false, validate: true}, owner_ref: 'ai-kit', profileable: true,
  section_ref: 'claude-code', sensitive: false, setting_ref: 'ai-kit:claude-code:hooks.fs-guardrail', title: 'PreToolUse filesystem guardrail', value_schema: {type: 'scalar'}, writable: false}
const SEARCH_LIMIT = {allowed_scopes: [{scope_kind: 'project', scope_ref: null}], default_semantics: 'constant', description: 'Default --limit for `factory telemetry search`.', effect: {kind: 'value-change', summary: 'Takes effect on the next telemetry command'},
  native_ref: 'software-factory:telemetry-config', operations: {apply: true, plan: true, reset: true, validate: true}, owner_ref: 'software-factory', profileable: false,
  section_ref: 'telemetry', sensitive: false, setting_ref: 'software-factory:telemetry:search-limit-default', title: 'Search result limit default', value_schema: {type: 'number', minimum: 1, maximum: 100}, writable: true}
const NO_PROJECT = 'the owner is unavailable on this subject: no project context is bound: AIKit\'s settings disclosure needs a project root (run from within a project, or pass --cwd)'
/** AIKit's resolution where it answers without a value (`oi config resolve`, a world root that is no AIKit project). */
const blockedResolution = {schema: 'oi.config-resolution/v1', setting_ref: GUARDRAIL.setting_ref, scope: {scope_kind: 'machine', scope_ref: null}, desired: null, native: {},
  native_reading: {reading_digest: 'd1', observed_at_unix_ms: 1}, reconciliation: {status: 'blocked', reason: NO_PROJECT}}

test('CODE-DERIVED — #758: a setting its owner answers without a value names the owner\'s reason; one that applies only to a project and has none offered says it is not asked', () => {
  const guard = {spec: GUARDRAIL, owner: 'ai-kit', available: true, reason: null}, limit = {spec: SEARCH_LIMIT, owner: 'software-factory', available: true, reason: null}
  const machine = {scope_kind: 'machine', scope_ref: null}
  const rows = win.settingRows({entries: [guard, limit], readings: {[settingKey(GUARDRAIL.setting_ref, machine)]: blockedResolution}, scopes: {[GUARDRAIL.setting_ref]: machine}})
  assert.equal(rows[0].from, 'refused', 'answered without a value: not "inherited"')
  assert.equal(rows[0].why, `AIKit gives no value here: ${NO_PROJECT}.`, 'the owner\'s own words')
  assert.equal(rows[1].from, 'unasked')
  assert.match(rows[1].why, /^It applies to a project, and no project is offered under Applies to here, so Factory is not asked for it\.$/)
  const said = win.settingRows({entries: [limit], readings: {}, scopes: {}, unasked: 'Central did not disclose the world\'s projects: world_browse refused'})
  assert.match(said[0].why, /not asked for it\. Central did not disclose the world's projects: world_browse refused$/, 'why the projects are not offered, in Central\'s words')
  // A reading not answered yet, and a value the owner gives, need no reason.
  assert.equal(win.settingRows({entries: [guard], readings: {}, scopes: {[GUARDRAIL.setting_ref]: machine}})[0].why, undefined)
  const given = {...blockedResolution, native: {effective: {value: 'aikit hook fs-guardrail'}}, reconciliation: {status: 'satisfied', reason: null}}
  assert.equal(win.settingRows({entries: [guard], readings: {[settingKey(GUARDRAIL.setting_ref, machine)]: given}, scopes: {[GUARDRAIL.setting_ref]: machine}})[0].why, undefined)
})

test('CODE-DERIVED — #758: a setting that applies only to a project is read at one of the world\'s projects, asked of Central only when one is contributed', async () => {
  let asked = 0
  const adapter = {projectChoices: async () => { asked++; return [{address: {scope_kind: 'project', scope_ref: 'O-I'}, title: 'O-I'}] }}
  assert.deepEqual(await win.projectScopes([GUARDRAIL], adapter), {choices: [], why: null})
  assert.equal(asked, 0, 'no project-only setting: Central is not asked')
  const found = await win.projectScopes([GUARDRAIL, SEARCH_LIMIT], adapter)
  assert.equal(asked, 1)
  assert.deepEqual(initialScope(SEARCH_LIMIT, found.choices), {scope_kind: 'project', scope_ref: 'O-I'}, 'read at the project Central discloses')
  assert.equal(initialScope(SEARCH_LIMIT, []), null, 'before: no scope, never asked')
  const refused = await win.projectScopes([SEARCH_LIMIT], {projectChoices: async () => { throw new Error('Central returned no root disclosure') }})
  assert.deepEqual(refused, {choices: [], why: 'Central did not disclose the world\'s projects: Central returned no root disclosure'})
  assert.match((await win.projectScopes([SEARCH_LIMIT], {})).why, /reads no projects of the world/)
})

/** One page of the window's Full on these values and this standing. */
function drawnStanding(values, page, standing) {
  host.resetHost(ID)
  if (page) host.setHostPage(ID, page)
  const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: {id: ID, values, standing, local: {}}, view: 'full', nav: {}}))
  host.resetHost(ID)
  return markup
}

test('SCRIPTED — #758: the design draws the owner\'s reason where a setting\'s value would stand, and "not read" or "not asked" where it comes from', () => {
  const guard = {spec: GUARDRAIL, owner: 'ai-kit', available: true, reason: null}, limit = {spec: SEARCH_LIMIT, owner: 'software-factory', available: true, reason: null}
  const machine = {scope_kind: 'machine', scope_ref: null}
  const settings = json(win.settingRows({entries: [guard, limit], readings: {[settingKey(GUARDRAIL.setting_ref, machine)]: blockedResolution}, scopes: {[GUARDRAIL.setting_ref]: machine}}))
  const permissions = drawn({settings}, 'permissions')
  assert.match(permissions, /class="st-plain st-why-said"[^>]*>AIKit gives no value here: the owner is unavailable on this subject: no project context is bound/)
  assert.match(permissions, />not read</)
  const telemetry = drawn({settings}, 'telemetry')
  assert.match(telemetry, />It applies to a project, and no project is offered under Applies to here, so Factory is not asked for it\.</)
  assert.match(telemetry, />not asked</)
})

test('SCRIPTED — #758: a page\'s reading is drawn waiting while its owner is asked, and in the owner\'s words where it refused, never a bare "No reading of…"', () => {
  const said = 'the profile store is locked'
  const waiting = drawnStanding({}, 'profiles', {profiles: {waiting: true}})
  assert.match(waiting, /<td colSpan="3" class="st-none"><span class="dp-no-reading" data-standing="awaiting"/, 'asked, not answered: waiting')
  assert.doesNotMatch(waiting, /No reading of the profiles/)
  // The owner's words in plain words (shared/Refusal.tsx refusalWords), the raw cause left out of the line.
  assert.match(drawnStanding({}, 'profiles', {profiles: {refused: said}}), />No reading of the profiles\. The profile store is locked\.</)
  assert.match(drawnStanding({}, 'machines', {machines: {refused: 'Workcell did not read its machines: the Workcell state root is not writable'}}),
    /No reading of the machines\. Workcell did not read its machines: the Workcell state root is not writable\./)
  const credentials = drawnStanding({}, 'credentials', {credentials: {refused: 'AIKit gave no answer'}, secretRefs: {waiting: true}, projections: {refused: 'Workcell keeps no projection ledger here'}})
  assert.match(credentials, /AIKit · No reading of the bindings\. AIKit gave no answer\./)
  assert.match(credentials, /No reading of the projections\. Workcell keeps no projection ledger here\./)
  assert.match(drawnStanding({}, 'automations', {routines: {refused: 'AIKit did not return this routine operation.'}}), /No reading of the routines\. AIKit did not return this routine operation\./)
  assert.match(drawnStanding({}, 'skills', {settings: {waiting: true}}), /data-standing="awaiting"/, 'the registry asked: waiting')
  assert.match(drawnStanding({}, 'setup', {setupReading: {waiting: true}}), /data-standing="awaiting"/, 'Setup reading its owners: waiting')
})

test('CODE-DERIVED — #758: a page\'s reading standing: waiting while asked, the refusal in its owner\'s words under the reading\'s keys, nothing once it stands', () => {
  assert.deepEqual(settingsPages.readStanding(['profiles'], {value: null, error: null, asking: true}), {waiting: ['profiles'], refused: {}})
  assert.deepEqual(settingsPages.readStanding(['secretRefs', 'projections'], {value: null, error: 'exit 2', asking: false}), {waiting: [], refused: {secretRefs: 'exit 2', projections: 'exit 2'}})
  assert.deepEqual(settingsPages.readStanding(['profiles'], {value: null, error: null, asking: false}, 'Profiles: no owner'), {waiting: [], refused: {profiles: 'Profiles: no owner'}})
  assert.deepEqual(settingsPages.readStanding(['profiles'], {value: {profiles: []}, error: 'old', asking: true}), {waiting: [], refused: {}})
})

test('CODE-DERIVED — #758: a key the binding names as waiting stands waiting though the host was given no keys and holds no value for it', () => {
  const standing = host.hostedStanding({sent: {}, drafts: {}, refused: {}}, {id: 'x', values: {held: 1}, waiting: ['settings', 'held']}, [])
  assert.equal(standing.settings?.waiting, true, 'the registry being read reaches the design')
  assert.equal(standing.held?.waiting, undefined, 'a value already read is not waiting')
})

test('SCRIPTED — #758: Machines says Workcell\'s refusal in its words; a read that answers stands', async () => {
  const refused = {readMachines: async () => { throw new Error('workcell machine list: exit 7: the Workcell state root is not writable') }, readConnections: async () => []}
  await assert.rejects(settingsPages.readMachineSetup(refused), /^Error: Workcell did not read its machines: workcell machine list: exit 7: the Workcell state root is not writable$/)
  assert.deepEqual(await settingsPages.readMachineSetup({readMachines: async () => [], readConnections: async () => []}), {machines: [], connections: []})
})
