// #772: the Factory clip's owner words (manual §19.1 The Launch panel: Launch mode Trigger · Gate · Toggle · Repeat; Then Next task · Again ·
// Stop). AIKit's session settings keep Launch as once · hold · loop and Then as next · handoff · stop (ai-kit
// crates/aikit-cli/src/encounter_task_settings.rs:28-29 LAUNCHES, THENS; encounter_task_executor.rs:701-720: `loop` resubmits the task after each
// finish, `handoff` hands the session's next turn to another session). The binding reads the owner's word as the manual's where the two
// mean one thing, names the rest absent or refused with the owner word it lacks, and writes the manual's word back as the owner's.
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

const taskOf = (launch, then, extra = {}) => ({task_ref: 'task:t', name: 'correlate occurrences', launch, then, quantize: 'global', envelope_mode: 'automation', envelope_linked: true,
  effort: [], autonomy: [], register: 'plain', form: 'technical', active: true, colour: null, handoff_to: null, set: [], ...extra})
const readingOf = task => ({schema: 'aikit.encounter-session-settings/v1', agent_session: 'ses-214', revision: 'r1', track: {telemetry: true, solo: false, set: []}, task,
  previous_task: null, standing: 's'})

test('the owner\'s Launch and Then read as the manual\'s words where they mean one thing', () => {
  const once = settings.clipValuesOfSettings(readingOf(taskOf('once', 'next')))
  assert.deepEqual([once.launch, once.then, once.loop], ['trigger', 'next', false], 'once is Trigger, and the task does not loop')
  const hold = settings.clipValuesOfSettings(readingOf(taskOf('hold', 'stop')))
  assert.deepEqual([hold.launch, hold.then, hold.loop], ['gate', 'stop', false], 'hold is Gate; stop is Stop')
  // The owner's loop runs the task again after each finish: the Clip panel's Loop, which names no launch mode.
  const loop = settings.clipValuesOfSettings(readingOf(taskOf('loop', 'next')))
  assert.equal(loop.loop, true)
  assert.equal('launch' in loop, false, 'no launch mode is read from loop')
  // Hand off to is no follow action (§19.1: drag the task onto that session's track): Then is absent, the session it names stays readable.
  const handoff = settings.clipValuesOfSettings(readingOf(taskOf('once', 'handoff', {handoff_to: 'ses-300'})))
  assert.equal('then' in handoff, false)
  assert.equal(handoff.handoff, 'ses-300')
  // Each absence is named: the wiring says why.
  const wiring = factory.factoryWiring(null)
  assert.match(wiring.reads.launch, /once is Trigger, hold is Gate/)
  assert.equal(wiring.absent.loop, undefined, 'Loop is read now, from the owner\'s loop')
  assert.match(wiring.reads.loop, /loop/)
  assert.match(settings.OWNER_LOOP_WORDS, /Clip panel's Loop/)
  assert.match(settings.OWNER_HANDOFF_WORDS, /drag the task onto that session's track/)
})

test('a launch mode or a follow action writes the owner\'s word; one the owner has no word for is refused naming it', () => {
  const reading = readingOf(taskOf('once', 'next'))
  assert.deepEqual(settings.taskSettingChange('launch', 'gate', reading), {change: {task: {task_ref: 'task:t', set: {launch: 'hold'}}}})
  assert.deepEqual(settings.taskSettingChange('launch', 'trigger', reading), {change: {task: {task_ref: 'task:t', set: {launch: 'once'}}}})
  assert.deepEqual(settings.taskSettingChange('then', 'stop', reading), {change: {task: {task_ref: 'task:t', set: {then: 'stop'}}}})
  for (const [setting, word] of [['launch', 'toggle'], ['launch', 'repeat'], ['then', 'again']]) {
    const made = settings.taskSettingChange(setting, word, reading)
    assert.match(made.refused, /missing op/, `${word}: refused`)
    assert.match(made.refused, setting === 'launch' ? /once · hold · loop/ : /next · handoff · stop/, `${word}: names the words the owner keeps`)
  }
  // The owner's own words are not the design's: a press never sends them through the clip.
  assert.ok('refused' in settings.taskSettingChange('launch', 'loop', reading))
})
