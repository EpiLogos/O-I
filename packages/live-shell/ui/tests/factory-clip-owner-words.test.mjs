// #787: the Factory clip's words are AIKit's, and AIKit's are the manual's (§19.1 The Clip panel: Loop Off or On, with its stop condition
// and its cap; The Launch panel: Launch mode Trigger · Gate · Toggle · Repeat, Then Next task · Again · Stop, and what a Repeat varies —
// Variable, Levels, Repeats, Stop when). ai-kit crates/aikit-cli/src/encounter_task_settings.rs LAUNCHES, THENS, LOOP_UNTILS, VARIABLES,
// REPEAT_STOPS accept and return them, and read settings stored in its earlier words (once · hold · loop; next · handoff · stop) in these.
// The binding reads and writes each word through AIKit with no translation table; Hand off to is retired (§19.1: "To hand the work to
// another session, drag the task onto that session's track").
// REPLACED (#787): #772's mapping (once is Trigger, hold is Gate, next is Next task, stop is Stop; loop read as the Clip panel's Loop;
// Toggle, Repeat and Again refused naming AIKit's words; Then absent while AIKit kept handoff) — AIKit now speaks the manual's words.
// Channels: SCRIPTED — the reading is AIKit's encounter-session-settings record shape (aikit.encounter-session-settings/v1), the writes go to
// a recording request, never to the owner. Not a screen pass.
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

const factory = await import('../src/agent/clipBinding.ts')
const settings = await import('../src/agent/sessionSettings.ts')

const taskOf = (extra = {}) => ({task_ref: 'task:t', name: 'correlate occurrences', launch: 'trigger', then: 'next', loop: false, loop_until: 'done',
  loop_cap: null, quantize: 'global', repeat_variable: 'condition', repeat_levels: [], repeat_repeats: 3, repeat_stop: 'done', envelope_mode: 'automation',
  envelope_linked: true, effort: [], autonomy: [], register: 'plain', form: 'technical', active: true, colour: null, set: [], ...extra})
const readingOf = task => ({schema: 'aikit.encounter-session-settings/v1', agent_session: 'ses-214', revision: 'r1', track: {telemetry: true, solo: false, set: []}, task,
  previous_task: null, standing: 's'})
const LAUNCH_KEYS = ['launch', 'then', 'loop', 'loop.until', 'loop.cap', 'repeat.variable', 'repeat.levels', 'repeat.repeats', 'repeat.stop']

test('every launch mode, follow action, Loop and Repeat field reads as AIKit states it', () => {
  for (const launch of ['trigger', 'gate', 'toggle', 'repeat']) assert.equal(settings.clipValuesOfSettings(readingOf(taskOf({launch}))).launch, launch)
  for (const then of ['next', 'again', 'stop']) assert.equal(settings.clipValuesOfSettings(readingOf(taskOf({then}))).then, then)
  const off = settings.clipValuesOfSettings(readingOf(taskOf()))
  assert.deepEqual([off.loop, off['loop.until'], 'loop.cap' in off], [false, 'done', false], 'Loop Off, its stop condition Task done, no cap')
  assert.deepEqual([off['repeat.variable'], 'repeat.levels' in off, off['repeat.repeats'], off['repeat.stop']], ['condition', false, 3, 'done'], 'no levels chosen yet')
  const on = settings.clipValuesOfSettings(readingOf(taskOf({loop: true, loop_until: 'pass', loop_cap: 5, launch: 'repeat', repeat_variable: 'model',
    repeat_levels: ['opus', 'sonnet', 'haiku'], repeat_repeats: 4, repeat_stop: 'turns'})))
  assert.deepEqual([on.loop, on['loop.until'], on['loop.cap']], [true, 'pass', 5])
  assert.deepEqual([on['repeat.variable'], on['repeat.levels'], on['repeat.repeats'], on['repeat.stop']], ['model', 'opus, sonnet, haiku', 4, 'turns'],
    'the levels as the design writes them: comma-separated')
  assert.equal('handoff' in on, false, 'Hand off to is retired')
  // The wiring reads each from AIKit; only Compare and the takes stay absent, each naming its owner.
  const wiring = factory.factoryWiring(null)
  for (const key of LAUNCH_KEYS) {
    assert.equal(wiring.absent[key], undefined, `${key} is read`)
    assert.match(wiring.reads[key], /the session's settings/, key)
  }
  assert.deepEqual(Object.keys(factory.LAUNCH_ABSENT).sort(), ['compare', 'takes'])
  assert.deepEqual(Object.keys(factory.LAUNCH_REFUSED), ['compare'])
  assert.equal(wiring.reads.handoff, undefined, 'Hand off to is retired')
})

test('each word goes to AIKit as the clip says it, and AIKit judges it', () => {
  const reading = readingOf(taskOf())
  const set = (setting, value) => settings.taskSettingChange(setting, value, reading).change.task.set
  for (const launch of ['trigger', 'gate', 'toggle', 'repeat']) assert.deepEqual(set('launch', launch), {launch})
  for (const then of ['next', 'again', 'stop']) assert.deepEqual(set('then', then), {then})
  assert.deepEqual(set('launch', 'sideways'), {launch: 'sideways'}, 'no table here: AIKit refuses a word it does not take, in its words')
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
