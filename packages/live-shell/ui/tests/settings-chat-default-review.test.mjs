// Harnesses' chat default goes through Review changes, as Appearance does (O-I #744 round two; manual §10.10: "A change is local until you
// review it"). The provider a new chat starts with is one of the owners' settings (settings/chatDefaultSetting.ts), on the window's one
// path for owners outside the configuration plane (settings/ownedSettings.ts): a change of it is a draft, its row amber with Details and
// Undo, counted on Harnesses & models and the foot; Review changes… asks O:I's chat-default owner to plan it on the basis it was made on;
// Apply holds it (chat_default_hold) and the answer stands in the same table; Reset on its row is the owner's withdrawal (chat_default_
// discard). The Theme row's Reset stands dimmed with its owner's reason, through the window's one standing map, keyed by row.
// Channels: SCRIPTED (the design drawn to static markup through the device host; a chat-default owner answering as the kernel does) and
// CODE-DERIVED (the window's own source). No owner state is written. Not a screen pass.
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
const chat = await import('../src/settings/chatDefaultSetting.ts')
const ROWS = [{id: 'pi', label: 'Pi'}, {id: 'claude', label: 'Claude'}]
const reading = (held = 'pi') => ({kind: 'live', label: 'live', observed_at_unix_ms: 1, harnesses: {state: 'ok', rows: []}, providers: {state: 'ok', rows: ROWS},
  catalogue: {state: 'ok', rows: {count: 0, entries: []}}, heldDefault: held ? {value: held, set_at_unix_ms: 1} : null, defaultState: {state: 'ok'}})
/** O:I's chat-default owner as the HarnessSource answers it; every call, in order. */
function owner(start = reading()) {
  const sent = []
  let now = start
  return {sent, move: next => { now = next }, source: {kind: 'live', label: 'live',
    read: async () => { sent.push('read'); return now },
    holdDefault: async provider => { sent.push(`hold ${provider}`); now = {...now, heldDefault: {value: provider, set_at_unix_ms: 2}} },
    discardDefault: async () => { sent.push('discard'); now = {...now, heldDefault: null} }}}
}
const KEY = settingKey(chat.CHAT_DEFAULT_REF, chat.CHAT_DEFAULT_SCOPE)
function values(r, drafts = {}, more = {}) {
  const entry = chat.chatDefaultEntry(r.providers.rows)
  return {entry, v: win.windowCoreValues({adapter: {kind: 'native', label: 'native', ownerEpoch: 'e'}, mounts: [], entries: [entry], readings: {[KEY]: chat.chatDefaultResolution(r)},
    scopes: {[chat.CHAT_DEFAULT_REF]: chat.CHAT_DEFAULT_SCOPE}, drafts, review: null, answered: null, result: null, loading: false, query: '', ...more})}
}
const draftOf = (r, value) => { const {entry} = values(r); return {[KEY]: {...createDraft(entry.spec, value, chat.chatDefaultResolution(r)), ownerEpoch: 'e'}} }
function drawn(v, page, standing = {}) {
  host.resetHost(ID); host.setHostPage(ID, page)
  const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: {id: ID, values: v, standing, local: {}}, view: 'full', nav: {}}))
  host.resetHost(ID)
  return markup
}

test('SCRIPTED — the chat default is a row on Harnesses & models: O:I\'s, this machine, the configured providers its choices', () => {
  const row = JSON.parse(values(reading()).v.settings)[0]
  assert.deepEqual([row.ref, row.category, row.owner, row.kind, row.effective, row.from, row.at, row.timing], [chat.CHAT_DEFAULT_REF, 'agents', 'oi', 'choice', 'pi', 'here', 'This machine', 'session-restart-required'])
  assert.deepEqual(row.options.map(o => o.title), ['Pi', 'Claude'])
  const inherited = JSON.parse(values(reading(null)).v.settings)[0]
  assert.deepEqual([inherited.effective, inherited.from], ['pi', 'inherited'], 'none saved: the provider in effect, by the configured order')
})

test('SCRIPTED — a change of the chat default is a local change: amber, counted on its page and the foot, Undo and Reset on the row; no Apply of its own', () => {
  const page = drawn(values(reading(), draftOf(reading(), 'claude')).v, 'harnesses')
  assert.match(page, /<tr[^>]*data-draft="true"[^>]*>(?:(?!<\/tr>).)*Default provider/s)
  assert.match(page, /aria-current="page"[^>]*>Harnesses &amp; models<i[^>]*>1<\/i>/)
  assert.match(page, /1 local change</)
  assert.match(page, /<tr[^>]*data-draft="true"(?:(?!<\/tr>).)*>Undo</s)
  assert.match(page, /<tr[^>]*data-draft="true"(?:(?!<\/tr>).)*>Reset</s, 'Reset: the owner withdraws the saved choice')
  assert.doesNotMatch(page, />Apply</, 'Review changes… applies it')
  assert.doesNotMatch(page, />Configured order</, 'the row\'s Reset replaces the page\'s own button')
})

test('SCRIPTED — Review plans the chat default through its owner, read again on its basis; Apply holds it; Reset withdraws it; a moved basis is refused', async () => {
  const o = owner()
  const drafts = draftOf(reading(), 'claude')
  const taken = []
  const [setting] = chat.chatDefaultOwned(o.source, reading(), r => taken.push(r.heldDefault?.value ?? null))
  const plan = await setting.plan(drafts[KEY])
  assert.deepEqual(o.sent, ['read'], 'planning reads; it holds nothing')
  assert.deepEqual(plan.changes.map(c => c.summary), ['Pi → Claude'])
  const operation = await setting.apply(plan)
  assert.deepEqual(o.sent, ['read', 'read', 'hold claude', 'read'])
  assert.equal(operation.status, 'applied')
  assert.deepEqual(taken.at(-1), 'claude', 'the owner\'s new reading reaches the page')
  assert.match(await setting.reset(), /withdrawn|configured order/i)
  assert.deepEqual(o.sent.slice(-2), ['discard', 'read'])
  const stale = draftOf(reading('pi'), 'claude')
  o.move(reading('claude'))
  await assert.rejects(setting.plan(stale[KEY]), /saved provider default changed/)
})

test('SCRIPTED — the Theme row\'s Reset stands dimmed with its owner\'s reason; the chat default\'s Reset does not', async () => {
  const theme = await import('../src/settings/presentationSetting.ts')
  const doc = {schema: 'oi.presentation/v1', revision: 3, theme: {appearance: 'dark', id: null}, custom_themes: [], observations: {}}
  const entry = theme.themeEntry([]), key = settingKey(theme.THEME_SETTING_REF, theme.THEME_SCOPE)
  const v = win.windowCoreValues({adapter: {kind: 'native', label: 'native', ownerEpoch: 'e'}, mounts: [], entries: [entry], readings: {[key]: theme.themeResolution(doc)},
    scopes: {[theme.THEME_SETTING_REF]: theme.THEME_SCOPE}, drafts: {}, review: null, answered: null, result: null, loading: false, query: ''})
  const page = drawn(v, 'appearance', {[`reset:${theme.THEME_SETTING_REF}`]: {disabled: theme.THEME_NO_RESET}})
  assert.match(page, /<tr(?:(?!<\/tr>).)*Theme(?:(?!<\/tr>).)*data-disabled="true"><button type="button" class="dp-action" disabled=""[^>]*><i[^>]*><\/i>Reset</s, 'dimmed in place')
  assert.ok(page.includes(theme.THEME_NO_RESET.replace(/'/g, '&#x27;')), 'the status bar says why: the owner\'s reason on its line')
  assert.ok(theme.THEME_NO_RESET.includes('Revert'), 'its reason names what returns the appearance')
})

test('CODE-DERIVED — one path for owners outside the configuration plane: plan, apply, reset and standing go through the owned settings; no window key holds a provider', () => {
  const workspace = read('../src/settings/SettingsWorkspace.tsx'), pages = read('../src/settings/windowPages.ts'), page = read('../src/inhabitants/catalogue/panels/settings__window.tsx')
  assert.match(workspace, /chatDefaultOwned\(/)
  assert.match(workspace, /await o\.plan\(/, 'Review: each owned setting\'s owner plans its draft')
  assert.match(workspace, /await o\.apply\(/, 'Apply: each owned setting\'s owner applies its plan')
  assert.match(workspace, /standing\[`reset:\$\{/, 'a Reset its owner has none of stands dimmed on its own row')
  assert.match(page, /st\(p, `reset:\$\{s\.ref\}`\)/, 'the row reads its own Reset standing')
  assert.doesNotMatch(page + pages, /\bchatDefault\b|applyDefault|restoreDefault/)
  assert.ok(!('chatDefault' in win.SETTINGS_WINDOW_WIRING.local) && !win.SETTINGS_LOCAL_KEYS.includes('chatDefault'))
  assert.ok(!('applyDefault' in win.SETTINGS_WINDOW_WIRING.writes) && !('restoreDefault' in win.SETTINGS_WINDOW_WIRING.writes))
})
