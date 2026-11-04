// #787: the Factory clip's words are AIKit's, and AIKit's are the manual's (§19.1 The Clip panel: Loop Off or On, with its stop condition
// and its cap; The Launch panel: Launch mode Trigger · Gate · Toggle · Repeat, Then Next task · Again · Stop, and what a Repeat varies —
// Variable, Levels, Repeats, Stop when). ai-kit crates/aikit-cli/src/encounter_task_settings.rs LAUNCHES, THENS, LOOP_UNTILS, VARIABLES,
// REPEAT_STOPS accept and return them, and read settings stored in its earlier words (once · hold · loop; next · handoff · stop) in these.
// The binding reads and writes each word through AIKit with no translation table; Hand off to is retired (§19.1: "To hand the work to
// another session, drag the task onto that session's track").
// REPLACED (#787): #772's mapping (once is Trigger, hold is Gate, next is Next task, stop is Stop; loop read as the Clip panel's Loop;
// Toggle, Repeat and Again refused naming AIKit's words; Then absent while AIKit kept handoff) — AIKit now speaks the manual's words.
// Quantize is AIKit's words too (encounter_task_settings.rs QUANTIZES: global · now · next-tool · next-turn), read and written as AIKit
// states them; the Launch panel's chooser carries them as its values and the manual's words as its labels (Global · Now · Next tool · Next
// turn). REPLACED (O-I 787 round 15): sessionSettings.ts's QUANTIZE_TO_OWNER / QUANTIZE_TO_DESIGN table ('next tool' is next-tool) — the
// last translation table between the clip and AIKit.
// Channels: SCRIPTED — the reading is AIKit's encounter-session-settings record shape (aikit.encounter-session-settings/v1), the writes go to
// a recording request, never to the owner; the Launch panel is rendered to markup. Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
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

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage ??= {getItem: () => null, setItem: noop}

const factory = await import('../src/agent/clipBinding.ts')
const settings = await import('../src/agent/sessionSettings.ts')
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {loadClip} = await import('../src/inhabitants/catalogue/clips/index.ts')

const taskOf = (extra = {}) => ({task_ref: 'task:t', name: 'correlate occurrences', launch: 'trigger', then: 'next', loop: false, loop_until: 'done',
  loop_cap: null, quantize: 'global', repeat_variable: 'condition', repeat_levels: [], repeat_repeats: 3, repeat_stop: 'done', envelope_mode: 'automation',
  envelope_linked: true, effort: [], tool_calls: [], register: 'plain', form: 'technical', active: true, colour: null, set: [], ...extra})
const readingOf = task => ({schema: 'aikit.encounter-session-settings/v1', agent_session: 'ses-214', revision: 'r1', track: {telemetry: true, solo: false, set: []}, task,
  previous_task: null, standing: 's'})
/** AIKit's Quantize words (ai-kit encounter_task_settings.rs QUANTIZES). */
const QUANTIZES = ['global', 'now', 'next-tool', 'next-turn']
const LAUNCH_KEYS = ['launch', 'then', 'loop', 'loop.until', 'loop.cap', 'repeat.variable', 'repeat.levels', 'repeat.repeats', 'repeat.stop']

test('every launch mode, follow action, Loop and Repeat field reads as AIKit states it', () => {
  for (const launch of ['trigger', 'gate', 'toggle', 'repeat']) assert.equal(settings.clipValuesOfSettings(readingOf(taskOf({launch}))).launch, launch)
  for (const then of ['next', 'again', 'stop']) assert.equal(settings.clipValuesOfSettings(readingOf(taskOf({then}))).then, then)
  for (const quantize of QUANTIZES) assert.equal(settings.clipValuesOfSettings(readingOf(taskOf({quantize}))).quantize, quantize, `Quantize ${quantize} as AIKit states it`)
  const off = settings.clipValuesOfSettings(readingOf(taskOf()))
  assert.deepEqual([off.loop, off['loop.until'], 'loop.cap' in off], [false, 'done', false], 'Loop Off, its stop condition Task done, no cap')
  assert.deepEqual([off['repeat.variable'], 'repeat.levels' in off, off['repeat.repeats'], off['repeat.stop']], ['condition', false, 3, 'done'], 'no levels chosen yet')
  const on = settings.clipValuesOfSettings(readingOf(taskOf({loop: true, loop_until: 'pass', loop_cap: 5, launch: 'repeat', repeat_variable: 'model',
    repeat_levels: ['opus', 'sonnet', 'haiku'], repeat_repeats: 4, repeat_stop: 'turns'})))
  assert.deepEqual([on.loop, on['loop.until'], on['loop.cap']], [true, 'pass', 5])
  assert.deepEqual([on['repeat.variable'], on['repeat.levels'], on['repeat.repeats'], on['repeat.stop']], ['model', 'opus, sonnet, haiku', 4, 'turns'],
    'the levels as the design writes them: comma-separated')
  assert.equal('handoff' in on, false, 'Hand off to is retired')
  // The wiring reads each from AIKit; only the takes stay absent before a set stands, naming their owner.
  // REPLACED (O-I 795 round 14): "only Compare and the takes stay absent" and LAUNCH_REFUSED.compare ("no owner operation carries it yet —
  // missing op: a comparison of takes"): Compare is the takes' own setting, kept with the task's settings on AIKit (`compare`).
  const wiring = factory.factoryWiring(null)
  for (const key of [...LAUNCH_KEYS, 'compare']) {
    assert.equal(wiring.absent[key], undefined, `${key} is read`)
    assert.match(wiring.reads[key], /the session's settings/, key)
  }
  assert.deepEqual(Object.keys(factory.LAUNCH_ABSENT).sort(), ['takes'])
  assert.equal(factory.LAUNCH_REFUSED, undefined, 'Compare is written through its seam')
  assert.equal(wiring.reads.handoff, undefined, 'Hand off to is retired')
})

// O-I 795 round 14: Compare (§19.1 The Launch panel; Arrangement view's take settings: "None, a second take, or every take of a Repeat",
// default None) is the takes' own setting, kept by AIKit with the task's settings beside its Success conditions (ai-kit
// encounter_task_settings.rs COMPARES: none · second · every). It is read and written as AIKit says it, and moves while the takes run:
// it draws them, it does not make them.
test('Compare is the takes\' own setting on AIKit: read as it states it, written through its seam, and free while the takes run', () => {
  assert.equal(settings.clipValuesOfSettings(readingOf(taskOf({compare: 'none'}))).compare, 'none', 'None by default, as AIKit states it')
  assert.equal(settings.clipValuesOfSettings(readingOf(taskOf({compare: 'every'}))).compare, 'every')
  assert.equal('compare' in settings.clipValuesOfSettings(readingOf(taskOf())), false, 'an AIKit that keeps no Compare reads none')
  const reading = readingOf(taskOf({compare: 'none'}))
  assert.deepEqual(settings.taskSettingChange('compare', 'second', reading).change.task.set, {compare: 'second'})
  assert.deepEqual(settings.taskSettingChange('compare', 'sideways', reading).change.task.set, {compare: 'sideways'}, 'AIKit refuses a word it does not take, in its words')
  const context = over => ({transport: {kind: 'unavailable', reason: 'test'}, project: 'O-I', settings: readingOf(taskOf(over))})
  const running = factory.factoryWiring({sessionRef: 'ses-214', n: 1}, context({compare: 'every', launch: 'repeat', takes: {trace_ref: 'takes:t9', running: true,
    started_at_unix_ms: 1, variable: 'model', levels: ['opus', 'sonnet'], repeats: 2, stop: 'done', ended: null}}))
  assert.equal(typeof running.acts.compare, 'function', 'Compare moves while the takes run')
  assert.equal(running.refused.compare, undefined)
  assert.match(running.refused['repeat.levels'], /takes:t9 are running/, 'what a Repeat varies holds while they run')
  // An AIKit that keeps no Compare: absent and refused, saying which AIKit it needs.
  const unkept = factory.factoryWiring({sessionRef: 'ses-214', n: 1}, context())
  assert.match(unkept.absent.compare, /keeps no Compare/)
  assert.match(unkept.refused.compare, /keeps no Compare/)
})

test('each word goes to AIKit as the clip says it, and AIKit judges it', () => {
  const reading = readingOf(taskOf())
  const set = (setting, value) => settings.taskSettingChange(setting, value, reading).change.task.set
  for (const launch of ['trigger', 'gate', 'toggle', 'repeat']) assert.deepEqual(set('launch', launch), {launch})
  for (const then of ['next', 'again', 'stop']) assert.deepEqual(set('then', then), {then})
  assert.deepEqual(set('launch', 'sideways'), {launch: 'sideways'}, 'no table here: AIKit refuses a word it does not take, in its words')
  for (const quantize of QUANTIZES) assert.deepEqual(set('quantize', quantize), {quantize}, `Quantize ${quantize} goes as the clip says it`)
  assert.deepEqual(set('quantize', 'next tool'), {quantize: 'next tool'}, 'no table: a word AIKit does not take is sent as written, and AIKit refuses it')
  assert.deepEqual(set('loop', true), {loop: true})
  assert.match(settings.taskSettingChange('loop', 'on', reading).refused, /Loop is on or off/)
  assert.deepEqual(set('loopUntil', 'pass'), {loop_until: 'pass'})
  assert.deepEqual(set('loopCap', 5), {loop_cap: 5})
  assert.deepEqual(set('loopCap', undefined), {loop_cap: null}, 'a cleared cap is none')
  assert.deepEqual(set('repeatVariable', 'model'), {repeat_variable: 'model'})
  assert.deepEqual(set('repeatLevels', ' opus, sonnet ,haiku '), {repeat_levels: ['opus', 'sonnet', 'haiku']})
  assert.deepEqual(set('repeatLevels', 'a, b, c, d'), {repeat_levels: ['a', 'b', 'c', 'd']}, 'sent as written: AIKit refuses more than three')
  assert.deepEqual(set('repeatLevels', ' '), {repeat_levels: null}, 'no levels: back to none chosen')
  assert.deepEqual(set('repeatRepeats', 4), {repeat_repeats: 4})
  assert.deepEqual(set('repeatStop', 'turns'), {repeat_stop: 'turns'})
  // Hand off to is retired: the Tasks device's To says what replaces it.
  assert.match(settings.tasksDeviceChange('to', 'ses-400', reading).refused, /drag the task onto that session's track/)
})

test('the Launch panel\'s Quantize carries AIKit\'s words as its values and the manual\'s as its labels', async () => {
  const design = await loadClip('factory')
  const launch = design.panel.find(tab => tab.id === 'launch')
  const labels = {global: 'Global', now: 'Now', 'next-tool': 'Next tool', 'next-turn': 'Next turn'}
  for (const quantize of QUANTIZES) {
    const values = settings.clipValuesOfSettings(readingOf(taskOf({quantize})))
    const markup = renderToStaticMarkup(createElement(launch.draw, {v: values, set: noop, standing: {}, size: 'detail', room: {w: 900, h: 360}}))
    const chooser = markup.match(/<select[^>]*aria-label="Quantize"[^>]*>(.*?)<\/select>/)?.[1] ?? ''
    assert.deepEqual([...chooser.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]), QUANTIZES, 'the chooser\'s values are AIKit\'s words')
    assert.match(chooser, new RegExp(`<option value="${quantize}" selected="">${labels[quantize]}</option>`), `${quantize} reads as ${labels[quantize]}`)
  }
})
