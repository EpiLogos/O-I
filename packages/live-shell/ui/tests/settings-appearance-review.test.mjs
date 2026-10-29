// Appearance goes through Review changes (manual §10.10; O-I #744, the walk of 29 Oct, D4: "Appearance applies by its own Apply, at once,
// through the presentation owner: no amber mark, no page or foot count, no Details, no Undo on the row, no Review changes plan"). The
// presentation owner's theme stands as one of the owners' settings (settings/presentationSetting.ts): a change of it is a local change on
// the window's one draft path, its row amber with Details and Undo, counted on the page and the foot; Review changes asks the presentation
// owner to plan it beside the configuration plane's plans; Apply sends theme_apply then, and the owner's answer stands in the same table.
// Channels: SCRIPTED (the design drawn to static markup through the device host; the engine's values over the development adapter; a
// presentation owner answering presentation_read and theme_apply as the kernel does) and CODE-DERIVED (the window's own source). No owner
// state is written. Not a screen pass.
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
const win = await import('../src/settings/windowValues.ts')
const {createDevelopmentSettingsAdapter} = await import('../src/settings/development.ts')
const {design} = await import('../src/inhabitants/catalogue/panels/settings__window.tsx')
const {initialScope, settingKey, createDraft, acknowledgeDrafts} = await import('../src/settings/model.ts')
const theme = await import('../src/settings/presentationSetting.ts')

const ID = 'settings:window'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const LIBRARY = [{id: 'catppuccin-mocha', name: 'Catppuccin Mocha', appearance: 'dark'}, {id: 'paper', name: 'Paper', appearance: 'light'}]
const reading = (saved = {appearance: 'system', id: null}, revision = 7) => ({schema: 'oi.presentation/v1', revision, theme: saved,
  custom_themes: [{id: 'night', name: 'Night', appearance: 'dark', preview: {ground: '#000', ink: '#fff', accent: '#f00', strip: []}, variables: {}}], observations: {}})

/** A presentation owner as the kernel answers it: presentation_read, theme_apply (a new revision); every op it was sent, in order. */
function presentationOwner(start = reading()) {
  const sent = []
  let now = start
  return {sent, move: next => { now = next }, adapter: {invoke: async op => {
    sent.push(op.op)
    if (op.op === 'presentation_read') return {outcome: {result: 'presentation_reading', document: now}}
    if (op.op === 'theme_apply') { now = {...now, revision: now.revision + 1, theme: {appearance: op.appearance, id: op.id ?? null}}; return {outcome: {result: 'presentation_reading', document: now}} }
    return {error: `${op.op}: not this owner's`}
  }}}
}

/** The engine's values with the presentation owner's theme among the owners' settings, as SettingsWorkspace.tsx composes them. */
async function engineWithTheme(drafts = {}, more = {}) {
  const adapter = createDevelopmentSettingsAdapter('ready')
  const registry = await adapter.readRegistry()
  const config = registry.mounts.flatMap(mount => (mount.document?.sections.flatMap(section => section.settings) ?? []).map(spec => ({spec, owner: mount.owner_ref,
    available: mount.availability.state === 'available' || mount.availability.state === 'degraded', reason: mount.availability.reason})))
  const scopes = Object.fromEntries(config.flatMap(entry => { const scope = initialScope(entry.spec, adapter.scopeChoices ?? []); return scope ? [[entry.spec.setting_ref, scope]] : [] }))
  const resolutions = await adapter.readResolutions(Object.entries(scopes).map(([setting_ref, scope]) => ({setting_ref, scope})))
  const readings = Object.fromEntries(resolutions.map(r => [settingKey(r.setting_ref, r.scope), r]))
  const library = theme.themeLibrary(LIBRARY, reading())
  const entries = [...config, theme.themeEntry(library)]
  const allScopes = {...scopes, [theme.THEME_SETTING_REF]: theme.THEME_SCOPE}
  const allReadings = {...readings, [settingKey(theme.THEME_SETTING_REF, theme.THEME_SCOPE)]: theme.themeResolution(reading())}
  const values = win.windowCoreValues({adapter, mounts: registry.mounts, entries, readings: allReadings, scopes: allScopes, drafts, review: null, answered: null, result: null, loading: false, query: '', ...more})
  return {adapter, entries, values, readings: allReadings, library}
}
function drawn(values, page) {
  host.resetHost(ID)
  if (page) host.setHostPage(ID, page)
  const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: {id: ID, values, standing: {}, local: {}}, view: 'full', nav: {}}))
  host.resetHost(ID)
  return markup
}
const THEME_KEY = settingKey('oi:presentation:theme', {scope_kind: 'machine', scope_ref: null})
const themeDraft = (entries, readings, value, ownerEpoch) =>
  ({[THEME_KEY]: {...createDraft(entries.find(e => e.spec.setting_ref === 'oi:presentation:theme').spec, value, readings[THEME_KEY]), ownerEpoch}})

test('SCRIPTED — the presentation owner\'s theme is a setting row on Appearance: its owner, its value, this machine, every appearance and library theme its choices', async () => {
  const {values} = await engineWithTheme()
  const row = JSON.parse(values.settings).find(r => r.ref === 'oi:presentation:theme')
  assert.ok(row, 'the theme stands among the owners\' settings')
  assert.deepEqual([row.category, row.owner, row.kind, row.writable, row.effective, row.from, row.at], ['appearance', 'oi', 'choice', true, 'system', 'here', 'This machine'])
  assert.deepEqual(row.options.map(o => o.title), ['Light', 'Dark', 'Follow system', 'Catppuccin Mocha', 'Paper', 'Night'], 'the appearances, the library, the imported')
  assert.equal(row.details.basis, theme.themeDigest(reading()), 'its reading basis is the owner\'s revision and saved theme')
  assert.match(drawn(values, 'appearance'), />Theme</, 'the row stands on the Appearance page')
})

test('SCRIPTED — a change of the theme is a local change: its row amber with Details and Undo, counted on Appearance and in the foot; no Apply of its own', async () => {
  const first = await engineWithTheme()
  const drafts = themeDraft(first.entries, first.readings, 'dark', first.adapter.ownerEpoch)
  const {values} = await engineWithTheme(drafts)
  assert.equal(values['draft:oi:presentation:theme'], 'dark', 'the window holds the change as every setting\'s: draft:<ref>')
  const page = drawn(values, 'appearance')
  assert.match(page, /<tr[^>]*data-draft="true"[^>]*>(?:(?!<\/tr>).)*Theme/s, 'the row carries the amber mark')
  assert.match(page, /aria-current="page"[^>]*>Appearance<i[^>]*>1<\/i>/, 'the page\'s name counts its change')
  assert.match(page, /1 local change</, 'the foot counts it')
  assert.match(page, /<tr[^>]*data-draft="true"(?:(?!<\/tr>).)*>Undo</s, 'Undo on the row')
  assert.match(page, /aria-expanded="false"[^>]*><b>Theme<\/b>/, 'the name opens its Details')
  assert.doesNotMatch(page, />Apply</, 'Appearance has no Apply of its own: Review changes… applies it')
  assert.match(page, />Review changes…</)
  assert.match(page, />Revert</, 'Revert stays, the owner\'s own act, as Reset does on a row')
})

test('SCRIPTED — Review changes asks the presentation owner to plan the change, read again on the basis it was made on; Apply alone sends theme_apply, answered in the same table', async () => {
  const owner = presentationOwner()
  const {entries, readings, adapter, library} = await engineWithTheme()
  const drafts = themeDraft(entries, readings, 'catppuccin-mocha', adapter.ownerEpoch)
  const {plan} = await theme.planTheme(owner.adapter, drafts[THEME_KEY], library)
  assert.deepEqual(owner.sent, ['presentation_read'], 'planning reads; it applies nothing')
  assert.deepEqual(plan.changes.map(c => c.summary), ['Follow system → Catppuccin Mocha'])
  const reviewed = (await engineWithTheme(drafts, {review: theme.withThemePlan({plans: [], errors: []}, plan)})).values
  const plans = JSON.parse(reviewed.plans)
  assert.deepEqual(plans.map(p => [p.title, p.scope, p.changes[0], p.effect]), [['Theme', 'This machine', 'Follow system → Catppuccin Mocha', 'value-change']], 'the Review page lists the owner\'s plan')
  assert.match(drawn(reviewed, 'review'), /Follow system → Catppuccin Mocha/)
  const {operation, reading: after} = await theme.applyTheme(owner.adapter, plan, library)
  assert.deepEqual(owner.sent, ['presentation_read', 'presentation_read', 'theme_apply'], 'Apply reads again, then sends theme_apply')
  assert.equal(operation.status, 'applied')
  assert.deepEqual(after.theme, {appearance: 'dark', id: 'catppuccin-mocha'}, 'the owner\'s new reading')
  const answered = (await engineWithTheme({}, {answered: theme.withThemePlan(null, plan), result: theme.withThemeAnswer(null, operation)})).values
  assert.deepEqual(JSON.parse(answered.result).operations.map(o => [o.title, o.status]), [['Theme', 'applied']], 'the owner\'s answer, in the same table')
  assert.deepEqual(acknowledgeDrafts(drafts, drafts, [settingKey(operation.setting_ref, operation.scope)]), {}, 'the acknowledged change leaves the local changes')
})

test('SCRIPTED — the saved theme moved under the change: Review refuses to plan it, and an Apply after a move sends nothing and answers refused', async () => {
  const owner = presentationOwner()
  const {entries, readings, adapter, library} = await engineWithTheme()
  const drafts = themeDraft(entries, readings, 'light', adapter.ownerEpoch)
  const {plan} = await theme.planTheme(owner.adapter, drafts[THEME_KEY], library)
  owner.move(reading({appearance: 'dark', id: null}, 8))
  await assert.rejects(theme.planTheme(owner.adapter, drafts[THEME_KEY], library), /saved appearance changed/)
  const {operation} = await theme.applyTheme(owner.adapter, plan, library)
  assert.equal(operation.status, 'failed')
  assert.match(operation.error.message, /changed after review/)
  assert.ok(!owner.sent.includes('theme_apply'), 'nothing was applied')
  assert.deepEqual(win.conflictRefs(entries, drafts, {[theme.THEME_SETTING_REF]: theme.THEME_SCOPE}, {[THEME_KEY]: theme.themeResolution(reading({appearance: 'dark', id: null}, 8))}, adapter.ownerEpoch),
    ['oi:presentation:theme'], 'the row offers Keep, as every setting whose owner reading moved')
})

test('CODE-DERIVED — one draft path: the engine plans and applies the theme through the presentation owner beside the configuration plane; the page and its hook hold no choice of their own', () => {
  const workspace = read('../src/settings/SettingsWorkspace.tsx'), pages = read('../src/settings/windowPages.ts'), page = read('../src/inhabitants/catalogue/panels/settings__window.tsx')
  const owned = read('../src/settings/presentationSetting.ts')
  assert.match(workspace, /themeOwned\(/, 'the theme stands on the window\'s one path for owned settings (settings/ownedSettings.ts)')
  assert.match(owned, /plan: async draft => \{ const now = await readTheme\(adapter\); take\(now\); return themePlanOn\(/, 'Review changes… plans the theme through its owner')
  assert.match(owned, /apply: async plan => \{ const answer = await applyTheme\(/, 'Apply sends the owner\'s plan')
  assert.doesNotMatch(page, /themeDraft|p\.set\('applyTheme'/, 'the page keeps no second choice and presses no Apply of its own')
  assert.doesNotMatch(pages, /themeDraft|applyTheme:/, 'the Appearance hook holds no choice and sends no theme_apply')
  assert.ok(!('themeDraft' in win.SETTINGS_WINDOW_WIRING.local) && !win.SETTINGS_LOCAL_KEYS.includes('themeDraft'), 'no window key holds an appearance outside the drafts')
  assert.ok(!('applyTheme' in win.SETTINGS_WINDOW_WIRING.writes))
})
