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

// ── 3 — a sound saved and opened (O-I #852, manual §21.2 "Save the instrument as you tuned it", "Drag it onto a part to play it") ──
// Save: the owner keeps a checkpoint and the kernel seals the sound from it (the stage's `torus-sound` save), then the Scene keeps it (the
// performance's keep-sound). Open: the Scene's record by its ref, opened against the Torus as it stands now (the stage's `torus-sound` open).

const SOUND_REF = 'sha256:' + '1'.repeat(64)
const SEALED = {schema: 'oi.torus-sound/v1', sound_ref: SOUND_REF, name: 'Low bell', sample_rate: 48000, checkpoint: {schema: 'ql.torus-checkpoint/v1'},
  checkpoint_sha256: 'sha256:' + '9'.repeat(64), body: {kind: 'torus'}, sources: [], law: 'kept', seal: 'hmac-sha256:00'}
const KEPT = {sounds: [{sound_ref: SOUND_REF, name: 'Low bell', body: 'torus', body_ref: null, sample_rate: 48000}], instruments: [], racks: []}

test('the owner\'s answers to a kept sound and to a keep are read in their own shapes', async () => {
  const record = await withChannel(async () => ({state: 'sound', sound: SEALED}), () => presets.commitLivePerformance({action: 'sound', sound_ref: SOUND_REF}))
  assert.deepEqual(record, {state: 'sound', sound: SEALED})
  const kept = await withChannel(async () => ({state: 'kept', sound_ref: SOUND_REF, name: 'Low bell', unsaved: false, kept: KEPT}),
    () => presets.commitLivePerformance({action: 'keep-sound', sound: SEALED}))
  assert.equal(kept.state, 'kept')
  const instrument = await withChannel(async () => ({state: 'instrument-kept', instrument_ref: 'instrument:ql:form-body:fold', name: 'Folded sheet', sounds: 2,
    unsaved: false, kept: KEPT}), () => presets.commitLivePerformance({action: 'keep-instrument', name: 'Folded sheet', sound_ref: SOUND_REF}))
  assert.equal(instrument.state, 'instrument-kept')
  const rack = await withChannel(async () => ({state: 'rack-kept', rack_ref: 'rack:torus/Breath', name: 'Breath', macros: 4, variations: 1, unsaved: false, kept: KEPT}),
    () => presets.commitLivePerformance({action: 'keep-rack', name: 'Breath', rack: {chain: [], macros: [], variations: []}}))
  assert.equal(rack.state, 'rack-kept')
  for (const odd of [{state: 'sound'}, {state: 'kept', name: 'Low bell'}, {state: 'instrument-kept', name: 'Folded sheet', sounds: '2'}, {state: 'rack-kept', name: 'Breath', macros: 4}])
    assert.match((await withChannel(async () => odd, () => presets.commitLivePerformance({action: 'sound', sound_ref: SOUND_REF}))).reason, /unknown shape/)
})

test('Save sound: the owner keeps the Torus, the kernel seals the sound, the Scene keeps it, and the browser hears what it keeps', async () => {
  const asked = [], heard = []
  const stage = async command => { asked.push(command); return {ok: true, sound: SEALED} }
  const perform = async action => { asked.push(action); return {state: 'kept', sound_ref: SOUND_REF, name: 'Low bell', unsaved: true, kept: KEPT} }
  const stop = presets.subscribeTorusKept(kept => heard.push(kept))
  try {
    const saved = await presets.saveTorusSound(' Low bell ', {stage, perform})
    assert.deepEqual(asked, [{command: 'torus-sound', action: 'save', name: 'Low bell'}, {action: 'keep-sound', sound: SEALED}], 'named as typed, trimmed')
    // O-I #852: the save names the sound it kept and whether it rings on a form's body, which an instrument is kept from.
    assert.deepEqual(saved, {ok: true, words: 'Saved "Low bell" under the Torus. The Scene keeps it until the Expression is saved, then the file does.',
      sound_ref: SOUND_REF, form: false})
    assert.deepEqual(heard, [KEPT], 'the browser lists what the Scene keeps now')
    const stood = await presets.saveTorusSound('Low bell', {stage, perform: async () => ({state: 'kept', sound_ref: SOUND_REF, name: 'Low bell', unsaved: false, kept: KEPT})})
    assert.equal(stood.words, 'Saved "Low bell" under the Torus.')
    assert.equal(heard.length, 2)
    // Each refusal in its owner's words, and nothing kept past a refusal.
    asked.length = 0
    assert.deepEqual(await presets.saveTorusSound('  ', {stage, perform}), {ok: false, error: 'Name the sound first: the browser lists it by its name.'})
    assert.deepEqual(asked, [], 'refused before any owner')
    assert.deepEqual(await presets.saveTorusSound('Low bell', {stage: async () => ({ok: false, error: 'Open the live instrument first'}), perform}),
      {ok: false, error: 'Open the live instrument first'})
    assert.deepEqual(asked, [], 'a sound the kernel did not seal is not kept')
    assert.deepEqual(await presets.saveTorusSound('Low bell', {stage, perform: async () => ({state: 'refused', reason: 'Sound Low bell is already kept', missing: []})}),
      {ok: false, error: 'Sound Low bell is already kept'})
    assert.equal(heard.length, 2, 'a refused save or keep is not announced')
  } finally { stop() }
})

test('a kept sound opens as saved through the owner, and says what has moved since it was saved', async () => {
  const asked = []
  const perform = async action => { asked.push(action); return {state: 'sound', sound: SEALED} }
  const moved = [{source: 'event', saved: 'sha256:a', now: 'sha256:b', words: 'The event the tuning was read from has moved: its sky, its M2 condition or its M3 state'}]
  const stage = async command => { asked.push(command); return {ok: true, landed_at_samples_elapsed: '52992', moved} }
  const opened = await presets.openKeptSound(SOUND_REF, {stage, perform})
  assert.deepEqual(asked, [{action: 'sound', sound_ref: SOUND_REF}, {command: 'torus-sound', action: 'open', sound: SEALED}])
  assert.deepEqual(opened, {ok: true, name: 'Low bell', moved,
    words: '"Low bell" opens as saved. Moved since it was saved: the event the tuning was read from has moved: its sky, its M2 condition or its M3 state.'})
  const still = await presets.openKeptSound(SOUND_REF, {perform, stage: async () => ({ok: true, landed_at_samples_elapsed: '52992', moved: []})})
  assert.equal(still.words, '"Low bell" opens as saved; nothing it was tuned from has moved.')
  assert.deepEqual(await presets.openKeptSound(SOUND_REF, {stage, perform: async () => ({state: 'refused', reason: 'The Scene keeps no sound ' + SOUND_REF + '.', missing: []})}),
    {ok: false, error: 'The Scene keeps no sound ' + SOUND_REF + '.'})
  assert.deepEqual(await presets.openKeptSound(SOUND_REF, {perform, stage: async () => ({ok: false, error: 'native owner busy; the Torus was not kept'})}),
    {ok: false, error: 'native owner busy; the Torus was not kept'})
  // A frame that does not run the sound's acts answers ok with nothing in it: that opened nothing, and is said so.
  assert.deepEqual(await presets.openKeptSound(SOUND_REF, {perform, stage: async () => ({ok: true})}),
    {ok: false, error: 'The frame answered the opening with no sample it rang again from: the sound was not opened'})
  assert.deepEqual(await presets.saveTorusSound('Low bell', {perform, stage: async () => ({ok: true})}), {ok: false, error: 'The owner answered the save with no sound'})
})

test('a kept sound played on a part: it opens on the Torus, then the part keeps the Torus as it stands', async () => {
  const asked = []
  const owners = {perform: async action => { asked.push(action); return {state: 'sound', sound: SEALED} },
    stage: async command => { asked.push(command.action); return {ok: true, landed_at_samples_elapsed: '52992', moved: []} },
    keepOn: async (path, track) => { asked.push({keepOn: [path, track]}); return null }}
  const played = await presets.playKeptSoundOn('/sets/Tide Sketch.als', 3, SOUND_REF, owners)
  assert.deepEqual(asked, [{action: 'sound', sound_ref: SOUND_REF}, 'open', {keepOn: ['/sets/Tide Sketch.als', 3]}])
  assert.deepEqual(played, {ok: true, note: '"Low bell" opens as saved; nothing it was tuned from has moved. The part keeps it.'})
  const unkept = await presets.playKeptSoundOn('/sets/Tide Sketch.als', 3, SOUND_REF, {...owners, keepOn: async () => 'The set is not open, so the part keeps no Torus.'})
  assert.deepEqual(unkept, {ok: true, note: '"Low bell" opens as saved; nothing it was tuned from has moved. The set is not open, so the part keeps no Torus.'})
  asked.length = 0
  assert.deepEqual(await presets.playKeptSoundOn('/sets/Tide Sketch.als', 3, SOUND_REF, {...owners, stage: async () => ({ok: false, error: 'Open the live instrument first'})}),
    {ok: false, error: 'Open the live instrument first'})
  assert.equal(asked.some(row => row.keepOn), false, 'a sound that did not open is kept on no part')
})

// O-I #852 (manual §21.2 Sounds and instruments; Tips: "make a form the body, make sounds on it, and keep it"): Keep instrument keeps the
// body a saved sound rings on, with the sounds made on it, under the Torus; the browser hears what the Scene keeps then.
test('Keep instrument: the Scene keeps the body the sound rings on, with its sounds, and the browser hears what it keeps', async () => {
  const asked = [], heard = []
  const FOLD = 'instrument:ql:form-body:fold'
  const made = n => ({sound_ref: 'sha256:' + String(n).repeat(64), name: `Paper ${n}`, body: 'form', body_ref: 'ql:form-body:fold', sample_rate: 48000})
  const KEPT_ON = {sounds: [], instruments: [{instrument_ref: FOLD, name: 'Folded sheet', body_ref: 'ql:form-body:fold', sounds: [made(2), made(3)]}], racks: []}
  const perform = async action => { asked.push(action); return {state: 'instrument-kept', instrument_ref: FOLD, name: 'Folded sheet', sounds: 2, unsaved: true, kept: KEPT_ON} }
  const stage = async command => { asked.push(command); return {ok: false, error: 'no stage here'} }
  const stop = presets.subscribeTorusKept(kept => heard.push(kept))
  try {
    const kept = await presets.keepTorusInstrument(' Folded sheet ', SOUND_REF, {stage, perform})
    assert.deepEqual(asked, [{action: 'keep-instrument', name: 'Folded sheet', sound_ref: SOUND_REF}], 'named as typed, trimmed; the stage is not asked')
    assert.deepEqual(kept, {ok: true, words: 'Kept "Folded sheet" under the Torus: its body, with the 2 sounds made on it. The Scene keeps it until the Expression is saved, then the file does.'})
    assert.deepEqual(heard, [KEPT_ON], 'the browser lists the instrument with its sounds under it')
    const one = await presets.keepTorusInstrument('Folded sheet', SOUND_REF, {stage, perform: async () => ({state: 'instrument-kept', instrument_ref: FOLD, name: 'Folded sheet', sounds: 1, unsaved: false, kept: KEPT_ON})})
    assert.equal(one.words, 'Kept "Folded sheet" under the Torus: its body, with the sound made on it.')
    asked.length = 0
    assert.deepEqual(await presets.keepTorusInstrument('  ', SOUND_REF, {stage, perform}), {ok: false, error: 'Name the instrument first: the browser lists it by its name.'})
    assert.deepEqual(asked, [], 'refused before any owner')
    const refused = {state: 'refused', reason: '"Low bell" rings on the torus itself, and an instrument is a form\'s body with the sounds made on it.', missing: []}
    assert.deepEqual(await presets.keepTorusInstrument('Folded sheet', SOUND_REF, {stage, perform: async () => refused}), {ok: false, error: refused.reason})
    assert.deepEqual(await presets.keepTorusInstrument('Folded sheet', SOUND_REF, {stage, perform: async () => ({state: 'kept', sound_ref: SOUND_REF, name: 'x', unsaved: false, kept: null})}),
      {ok: false, error: 'The Scene answered the keep in another shape'})
    assert.equal(heard.length, 2, 'a refused keep is not announced')
  } finally { stop() }
})

test('a saved sound says whether it rings on a form, from the sound the kernel sealed', async () => {
  const onForm = {...SEALED, body: {kind: 'form', prepared: {schema: 'ql.physical-body-preparation/v1', contract: 'ql.physical-body/v1', request: {preparation_ref: 'ql:form-body:fold'}}}}
  const saved = await presets.saveTorusSound('Low bell', {stage: async () => ({ok: true, sound: onForm}),
    perform: async () => ({state: 'kept', sound_ref: SOUND_REF, name: 'Low bell', unsaved: false, kept: KEPT})})
  assert.deepEqual(saved, {ok: true, words: 'Saved "Low bell" under the Torus.', sound_ref: SOUND_REF, form: true})
})

// DLW build ruling, 4 November ("Keep rack: build it"; manual §21.2 Sounds and instruments: "A rack | The Torus with its note devices and effects,
// its macros and their variations"): Keep rack saves the Torus as it rings as the sound the rack opens with, then the Scene keeps the rack
// the face holds, under its name; the browser hears what the Scene keeps then.
test('Keep rack: the Torus saved as the sound it opens with, then the rack the face holds kept under its name, and the browser hears it', async () => {
  const asked = [], heard = []
  const face = {chain: [{device_ref: 'delay', role: 'effect', state: {on: true, time: 375}}],
    macros: [{name: 'Rate', value: 0.25, targets: [{device_ref: 'torus', parameter: 'rate', min: 0.5, max: 20}]}], variations: [{name: 'Variation 1', values: [0.25]}]}
  const RACKED = {...KEPT, racks: [{rack_ref: 'rack:torus/Breath rack', name: 'Breath rack', sound: SOUND_REF, ...face}]}
  const stage = async command => { asked.push(command); return {ok: true, sound: SEALED} }
  const perform = async action => {
    asked.push(action)
    return action.action === 'keep-sound' ? {state: 'kept', sound_ref: SOUND_REF, name: 'Breath rack', unsaved: true, kept: KEPT}
      : {state: 'rack-kept', rack_ref: 'rack:torus/Breath rack', name: 'Breath rack', macros: 1, variations: 1, unsaved: true, kept: RACKED}
  }
  const stop = presets.subscribeTorusKept(kept => heard.push(kept))
  try {
    const kept = await presets.keepTorusRack(' Breath rack ', face, {stage, perform})
    assert.deepEqual(asked, [{command: 'torus-sound', action: 'save', name: 'Breath rack'}, {action: 'keep-sound', sound: SEALED},
      {action: 'keep-rack', name: 'Breath rack', rack: {sound: SOUND_REF, ...face}}], 'the Torus as it rings, sealed and kept, then the rack opening it')
    assert.deepEqual(kept, {ok: true, words: 'Kept "Breath rack" in the browser as a rack: the Torus as it rings, 1 effect on its chain, 1 macro and 1 variation. The Scene keeps it until the Expression is saved, then the file does.'})
    assert.deepEqual(heard.at(-1), RACKED, 'the browser lists the rack')
    asked.length = 0
    assert.deepEqual(await presets.keepTorusRack('', face, {stage, perform}), {ok: false, error: 'Name the rack first: the browser lists it by its name.'})
    assert.deepEqual(asked, [], 'refused before any owner')
    assert.deepEqual(await presets.keepTorusRack('Breath rack', face, {stage: async () => ({ok: false, error: 'Open the live instrument first'}), perform}),
      {ok: false, error: 'Open the live instrument first'})
    assert.equal(asked.some(row => row.action === 'keep-rack'), false, 'a Torus that was not saved keeps no rack')
    const refused = {state: 'refused', reason: 'Macro Space turns feedback of echo, which is not on the rack\'s chain', missing: []}
    assert.deepEqual(await presets.keepTorusRack('Breath rack', face, {stage, perform: async action => action.action === 'keep-sound' ? perform(action) : refused}),
      {ok: false, error: refused.reason})
  } finally { stop() }
})
