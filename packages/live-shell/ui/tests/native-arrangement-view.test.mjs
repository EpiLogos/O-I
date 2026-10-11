import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Production sources in memory. The fixture is a hand-built owner reading with
// the same identity relations the production reader establishes; no native
// owner, kernel, or GPU is involved and nothing is dispatched.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  const {readFile}=await import('node:fs/promises');
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

const [{ArrangementView}, {arrangementEditEffect}, React, {renderToStaticMarkup}] = await Promise.all([
  import('../src/components/ArrangementView.tsx'),
  import('../src/components/nativeArrangementTimeline.tsx'),
  import('react'),
  import('react-dom/server'),
])

const basis = {expression_ref: 'expr:fixture', revision: 3, scene_ref: 'scene:fixture', authored_revision: 2}
const scope = (entity) => ({owner: 'expressions', expression_ref: basis.expression_ref, scene_ref: basis.scene_ref, view_entity_id: entity, entity_ref: `ref:${entity}`})
const steps = [
  {id: 's1', name: 'Ink', shape: 'text', text: 'A'},
  {id: 's2', name: '', shape: 'disc', text: 'B'},
  {id: 's3', name: 'Dust', shape: 'ring', text: ''},
]
const timing = {
  clock: 'seconds', authored_duration_seconds: 4.5, axis_duration: 4.5, playback_axis: 'simulation-seconds',
  states: [
    {step_id: 's1', start_seconds: 0, hold_seconds: 1, transition_seconds: .5, end_seconds: 1.5, axis_start: 0, axis_hold: 1, axis_transition: .5, axis_end: 1.5},
    {step_id: 's2', start_seconds: 1.5, hold_seconds: 2, transition_seconds: .5, end_seconds: 4, axis_start: 1.5, axis_hold: 2, axis_transition: .5, axis_end: 4},
    {step_id: 's3', start_seconds: 4, hold_seconds: .5, transition_seconds: 0, end_seconds: 4.5, axis_start: 4, axis_hold: .5, axis_transition: 0, axis_end: 4.5},
  ],
}
const clip = {owner: 'expressions', kind: 'glyph-sequence', id: 'clip:1', track_id: 'track:1', name: 'Glyph A', scope: scope('ent-1'),
  sequence: {enabled: true, clock: 'seconds', steps}, timing, selected_step_id: 's2', capabilities: {select: true, edit: true, open: true}}
const content = {
  owner: 'expressions', basis, scene: {id: 'scene-f', scene_ref: basis.scene_ref, name: 'Fixture Scene'},
  tracks: [
    {owner: 'expressions', kind: 'formation', id: 'track:1', name: 'Glyph A', scope: scope('ent-1'), entity: {}, clip_source_id: 'clip:1', selected: true, capabilities: {select: true, glyphEdit: true}},
    {owner: 'expressions', kind: 'field', id: 'track:field', name: 'Field', scope: {owner: 'expressions', expression_ref: basis.expression_ref, scene_ref: basis.scene_ref}, selected: false},
  ],
  clip_sources: [clip],
  scene_members: [{owner: 'expressions', kind: 'scene-member', id: 'member:1', scene_ref: basis.scene_ref, track_id: 'track:1', clip_source_id: 'clip:1', capabilities: {select: true}}],
  scenes: null, playback: null, history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending: false, notice: null},
}

const calls = []
const actions = {
  editClip: async (id, changes) => { calls.push(['editClip', id, changes]); return {ok: true} },
  openClip: async (id, stepId, editor) => { calls.push(['openClip', id, stepId, editor]); return {ok: true} },
  selectClip: async (id, stepId) => { calls.push(['selectClip', id, stepId]); return {ok: true} },
}
const source = (over = {}) => ({owner: 'expressions', content, actions, isPresented: () => true, revealDetail() {}, revealNativeEditor() {}, ...over})
const props = native => ({set: null, document: null, selection: {track: 0, scene: null}, select() {}, colors: [], native})
const render = native => renderToStaticMarkup(React.createElement(ArrangementView, props(native)))
const count = (html, pattern) => (html.match(pattern) ?? []).length

test('native Arrangement renders exact authored states, a seconds ruler, and the honest absences', () => {
  const html = render(source())
  assert.equal(count(html, /class="arrange-clip native-state-span"/g), 3)
  assert.equal(count(html, /role="option"/g), 3);
  assert.equal(count(html, /aria-current="true"/g), 1, 'the native selected state is marked, not inferred from position')
  assert.equal(count(html, /aria-selected="false"/g), 3)
  assert.equal(count(html, /data-handle="hold"/g), 3, 'seconds handles render for editable states')
  assert.equal(count(html, /data-handle="transition"/g), 3)
  assert.match(html, /Authored source time in seconds, visible window/)
  assert.match(html, />4\.5</, 'ruler carries the authored extent')
  assert.match(html, /Glyph source timing/)
  assert.match(html, /class="nar-chip nar-loop"[^>]*aria-pressed="false"[^>]*disabled=""[^>]*>Loop</, 'the loop chip is bound to the owner reading and disabled with its reason')
  assert.match(html, /<details class="nar-absences">/, 'disclosure starts collapsed')
  assert.match(html, /Not yet in Arrangement for Expressions · 6/)
  assert.match(html, /Placed occurrences with start and end/)
  assert.match(html, />Layers</)
  assert.equal(count(html, /data-native-member="member:1"/g), 1)
  assert.doesNotMatch(html, /arrange-loop-brace|MIDI From|Audio From|Launch scene|track-stop|Arm requires/)
  assert.doesNotMatch(html, /nar-playhead/, 'no playhead without a playback reading')
})

test('without native actions the states are disabled and no handles are offered', () => {
  const html = render(source({actions: null}))
  assert.equal(count(html, /data-handle=/g), 0)
  assert.equal(count(html, /disabled=""[^>]*role="option"|role="option"[^>]*disabled=""/g), 3)
})

test('every timeline edit maps to exactly one existing owner request on the captured basis', async () => {
  calls.length = 0
  const native = source()
  const map = edit => arrangementEditEffect(native, clip, edit)

  await map({kind: 'timing', stepId: 's2', timing: {hold: 2.25}}).effect()
  assert.deepEqual(calls.at(-1), ['editClip', 'clip:1', [{kind: 'step-timing', entity_id: 'ent-1', step_id: 's2', hold: 2.25}]])
  await map({kind: 'timing', stepId: 's1', timing: {transition: .75}}).effect()
  assert.deepEqual(calls.at(-1), ['editClip', 'clip:1', [{kind: 'step-timing', entity_id: 'ent-1', step_id: 's1', transition: .75}]])

  await map({kind: 'order', ids: ['s2', 's1', 's3']}).effect()
  assert.deepEqual(calls.at(-1), ['editClip', 'clip:1', [{kind: 'step-order', entity_id: 'ent-1', step_ids: ['s2', 's1', 's3']}]])
  await map({kind: 'remove', ids: ['s3']}).effect()
  assert.deepEqual(calls.at(-1), ['editClip', 'clip:1', [{kind: 'step-remove', entity_id: 'ent-1', step_ids: ['s3']}]])
  await map({kind: 'duplicate', stepId: 's1'}).effect()
  assert.deepEqual(calls.at(-1), ['editClip', 'clip:1', [{kind: 'step-duplicate', entity_id: 'ent-1', step_id: 's1'}]])

  await map({kind: 'select', stepId: 's1', reveal: true}).effect()
  assert.deepEqual(calls.at(-1), ['selectClip', 'clip:1', 's1'])
  assert.equal(map({kind: 'select', stepId: 's1', reveal: true}).reveal, true)
  const open = map({kind: 'open', stepId: 's3', editor: 'layers'})
  await open.effect()
  assert.deepEqual(calls.at(-1), ['openClip', 'clip:1', 's3', 'layers'])
  assert.equal(open.reveal, 'layers')
  assert.equal(map({kind: 'timing', stepId: 's1', timing: {hold: 1}}).reveal, false)
})

test('timing edits outside the owner bounds never reach the request boundary', async () => {
  calls.length = 0
  const refused = await arrangementEditEffect(source(), clip, {kind: 'timing', stepId: 's1', timing: {hold: 3600.5}}).effect()
  assert.equal(refused.ok, false)
  assert.match(refused.error, /bounded authored hold or transition/)
  const retired = await arrangementEditEffect(source({isPresented: () => false}), clip, {kind: 'timing', stepId: 's1', timing: {hold: 2}}).effect()
  assert.equal(retired.ok, false)
  const unknown = await arrangementEditEffect(source(), clip, {kind: 'timing', stepId: 'absent', timing: {hold: 2}}).effect()
  assert.equal(unknown.ok, false)
  assert.deepEqual(calls, [])
})

test('an unavailable owner refuses every edit without a request', async () => {
  calls.length = 0
  const none = source({actions: null})
  for (const edit of [{kind: 'order', ids: ['s1', 's2', 's3']}, {kind: 'remove', ids: ['s1']}, {kind: 'duplicate', stepId: 's1'}]) {
    const reply = await arrangementEditEffect(none, clip, edit).effect()
    assert.equal(reply.ok, false)
    assert.match(reply.error, /owner is unavailable/)
  }
  assert.deepEqual(calls, [])
})
