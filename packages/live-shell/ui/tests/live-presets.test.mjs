import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// T-LIVE-TORUS-INSTRUMENT leg 3: the owner's determinant and presentation controls, reached through the hosted channel. The shell
// never writes the owner itself: each control sends one validated `instrument` stage command, and a refusal is named.
// Loader as live-torus-instrument.test.mjs.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

// T-LIVE-TORUS-INSTRUMENT leg 6: the Presets section's owner route. Save and recall go to the owner through the host; a recall applies its edits
// through the instrument command; every refusal is named. The shell keeps no preset store.
const here = new URL('../src/', import.meta.url)
const React = await import('react')
const presets = await import('../src/live/LivePresets.tsx')
const torus = await import('../src/live/torusInstrument.ts')
const panels = await import('../src/shell/panels.ts')
import {readFile} from 'node:fs/promises'

const DIGEST = 'sha256:' + 'a'.repeat(64)
const withChannel = async (channel, run) => {
  presets.setLivePerformanceChannel(channel)
  try { return await run() } finally { presets.setLivePerformanceChannel(null) }
}

// ── 1 — the section: listing, a one-field save-as, no modal ─────────────────

test('the Presets section starts listing and offers no Save that cannot succeed — it names what saving waits on', () => {
  const markup = renderToStaticMarkup(React.createElement(presets.LivePresetsSection))
  assert.match(markup, /data-live-presets="listing"/)
  assert.doesNotMatch(markup, />Save as</, 'no Save control while no producer serves the native performance readings')
  assert.match(markup, /data-live-presets-save="waiting"/)
  assert.match(markup, /native performance readings/)
  assert.doesNotMatch(markup, /role="dialog"|aria-modal/, 'no modal')
})

test('the Presets section is the browser section of its category', () => {
  assert.ok(panels.getPanels('browser-section').some(p => p.id === 'Presets'))
})

// ── 2 — the owner route: every answer or failure is named ───────────────────

test('with no mounted host a preset action is refused by name, never thrown', async () => {
  const reply = await presets.commitLivePerformance({action: 'list'})
  assert.deepEqual(reply, {state: 'refused', reason: 'No Expressions application is mounted for the presets', missing: []})
})

test('the owner answers list, save and recall in their own shapes, and a channel failure or unknown shape is refused by name', async () => {
  const listed = await withChannel(async action => ({state: 'listed', bases: [{basis_ref: DIGEST, event_ref: 'e', m1_coordinate: '#1-5-1'}]}), () => presets.commitLivePerformance({action: 'list'}));
  assert.equal(listed.state, 'listed')
  const refused = await withChannel(async action => ({state: 'refused', reason: 'Save as "x" needs native reading m2_plan.', missing: ['native reading m2_plan']}), () => presets.commitLivePerformance({action: 'save', name: 'x'}));
  assert.equal(refused.reason, 'Save as "x" needs native reading m2_plan.')
  const failed = await withChannel(async () => { throw new Error('The requested application is concealed') }, () => presets.commitLivePerformance({action: 'list'}));
  assert.deepEqual(failed, {state: 'refused', reason: 'The requested application is concealed', missing: []})
  const odd = await withChannel(async () => ({whatever: true}), () => presets.commitLivePerformance({action: 'list'}));
  assert.equal(odd.state, 'refused')
  assert.match(odd.reason, /unknown shape/)
})

// ── 3 — recall applies the basis's edits through the instrument command, and names what it cannot ──

test('a recall applies each stated edit through the instrument command, in the owner\'s order, and names what was not applied', async () => {
  const sent = []
  torus.setLiveInstrumentCommander(async command => { sent.push(command); return {ok: true} })
  try {
    const outcome = await presets.applyPresetRecall({state: 'recalled', basis_ref: DIGEST,
      edits: [{kind: 'lens', lens12: 3}, {kind: 'context-frame', context_frame: 2}],
      not_applied: [{field: 'harmonic basis', reason: 'the basis states none'}]})
    assert.deepEqual(sent, [{command: 'instrument', edit: {kind: 'lens', lens12: 3}}, {command: 'instrument', edit: {kind: 'context-frame', context_frame: 2}}])
    assert.equal(outcome.applied, 2)
    assert.deepEqual(outcome.notApplied, [{field: 'harmonic basis', reason: 'the basis states none'}])
  } finally { torus.setLiveInstrumentCommander(null) }
})

test("an edit the owner refuses is named in the outcome; the rest still apply", async () => {
  torus.setLiveInstrumentCommander(async command => command.edit.kind === 'lens' ? {ok: false, error: 'lens is already acting'} : {ok: true})
  try {
    const outcome = await presets.applyPresetRecall({state: 'recalled', basis_ref: DIGEST,
      edits: [{kind: 'lens', lens12: 3}, {kind: 'context-frame', context_frame: 2}], not_applied: []})
    assert.equal(outcome.applied, 1)
    assert.deepEqual(outcome.refused, [{edit: {kind: 'lens', lens12: 3}, error: 'lens is already acting'}])
  } finally { torus.setLiveInstrumentCommander(null) }
})

test('without a mounted frame a recalled edit is refused by name, never applied', async () => {
  torus.setLiveInstrumentCommander(null)
  const outcome = await presets.applyPresetRecall({state: 'recalled', basis_ref: DIGEST, edits: [{kind: 'lens', lens12: 3}], not_applied: []})
  assert.equal(outcome.applied, 0)
  assert.equal(outcome.refused.length, 1)
  assert.match(outcome.refused[0].error, /No Expressions application/)
})

// ── 4 — the shell keeps no preset store; the host supplies the owner route ──

test('the presets module reads and writes no browser or shell storage, and the hosted panel wires the owner route', async () => {
  const presetsSource = await readFile(new URL('live/LivePresets.tsx', here), 'utf8')
  assert.doesNotMatch(presetsSource, /localStorage|sessionStorage|indexedDB|IndexedDB|document\.cookie/)
  const panel = await readFile(new URL('panels/expressions.tsx', here), 'utf8')
  assert.match(panel, /setLivePerformanceChannel\(action => host\.current \? host\.current\.performance\(action\)/)
})
