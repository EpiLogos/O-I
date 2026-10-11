import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The Entity Sound device: its pure facts and draft arithmetic, the change shapes it can send through a stub apply, and the server render.
// The reading is a minimal fixture (not a native owner or a saved receipt). The app validator and the boundary validator are imported, not copied.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [registry, views, catalogue, sound, boundary, appSound] = await Promise.all([
  import('../src/components/nativeEntityFaceModel.ts'),
  import('../src/components/nativeEntityFaceViews.tsx'),
  import('../src/components/nativeDeviceCatalogue.ts'),
  import('../src/components/nativeEntityFace.sound.ts'),
  import('../../../expressions-boundary/src/nativeEntitySound.ts'),
  import(new URL('desktop/cradle/expressions-app/field-studies-journeys/src/native-field/entitySound.ts', root)),
])
const {validateEntitySound, SOUND_FIELDS, SOUND_WAVEFORMS, DEFAULT_ENTITY_SOUND} = appSound
const {validateNativeEntitySoundChange} = boundary
const {
  SOUND_GROUPS, SOUND_NUMBERS, numberProblem, parseNumberText, snapValue, steppedValue, resolvedSound, soundWithField, addedSound, soundChange,
  replyRefusal, soundSummaryText, LOCKED_NOTE, timeToX, xToTime, envelopeValueAt, envelopeGeometry, waveformPath, panX, ENVELOPE, soundFaceModel,
} = sound

const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
const cell = (over = {}) => ({id: 'entity-a', name: 'Cell A', kind: 'formation', enabled: true, position: {x: 0, y: 0, z: 0}, size: {x: 1, y: 1},
  rotation: 0, shape: 'circle', text: '', share: 1, tint: '#000', tintWeight: 1, locked: false, station: null,
  force: {kind: 'none', strength: 0, radius: 1, spin: 0}, sequence: {enabled: false, clock: 'seconds', steps: []}, ...over})
const SOUND = {enabled: true, frequencyHz: 220, followCymatic: false, gain: 0.2, waveform: 'sine', attack: 0.08, release: 0.8, pan: 0}
function reading({selection = [], entities = [cell()]} = {}) {
  const scene = {name: 'Fixture', entities, automation: [], engine: {...ENGINE}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {'entity-a': 'occ:a'}, chosenControls: {available: false, entries: [], controls: []}, devices: [],
    selection: {entity_ids: selection, step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
const noop = async () => ({ok: true})
const withSound = sound => cell({sound})
const SPEC = Object.fromEntries(SOUND_NUMBERS.map(spec => [spec.field, spec]))

test('the registry carries the sound family: the entity selector lists it, the catalogue device opens the Objects panel, and the view is registered', () => {
  assert.ok(registry.entityFamilies().includes('sound'))
  assert.ok(registry.ENTITY_FACE_MODELS.sound === soundFaceModel)
  assert.equal(typeof views.ENTITY_FACE_VIEWS.sound.render, 'function')
  const device = catalogue.deviceCatalogue().find(row => row.family === 'sound')
  assert.equal(device.scope, 'entity')
  assert.equal(device.name, 'Sound')
  assert.equal(device.studio, 'formations', 'the shell has no sound section; the Objects panel holds the object controls')
  assert.equal(device.toggle, null)
  assert.deepEqual([...device.paths], [], 'sound fields are not registry parameters')
  assert.ok(device.compact.length <= 4)
})

test('the model declares no registry paths and no compact set (none can resolve in the rack yet), and its groups cover the sound fields exactly', () => {
  assert.deepEqual([...soundFaceModel.paths], [])
  assert.equal(soundFaceModel.groups, undefined, 'groups would render empty sections: the body resolves only registry suffixes')
  assert.equal(soundFaceModel.compact, undefined, 'compact must be a subset of paths; sound fields are not paths')
  // The panel groups cover every sound field exactly once, in the app's own fields.
  const grouped = SOUND_GROUPS.flatMap(group => [...group.fields])
  assert.deepEqual([...grouped].sort(), [...SOUND_FIELDS].sort())
  assert.equal(new Set(grouped).size, grouped.length)
})

test('the activator is the object sound\'s own enabled flag, undefined while no sound exists', () => {
  const r = reading({selection: ['entity-a']})
  assert.equal(soundFaceModel.enabled(r, withSound(SOUND)), true)
  assert.equal(soundFaceModel.enabled(r, withSound({...SOUND, enabled: false})), false)
  assert.equal(soundFaceModel.enabled(r, cell()), undefined)
})

test('the strip summary is read from the reading: pitch or cymatic, waveform and gain, with off when disabled', () => {
  assert.equal(soundSummaryText(SOUND), '220 Hz · sine · gain 0.2')
  assert.equal(soundSummaryText({...SOUND, enabled: false, frequencyHz: 330, waveform: 'triangle', gain: 0.5}), 'off · 330 Hz · triangle · gain 0.5')
  assert.equal(soundSummaryText({enabled: true, followCymatic: true, gain: 0.2, waveform: 'sine'}), 'cymatic pitch · sine · gain 0.2')
  assert.equal(soundSummaryText(undefined), 'No sound')
  const r = reading({selection: ['entity-a']})
  assert.equal(soundFaceModel.strip.summary(r, withSound(SOUND)), '220 Hz · sine · gain 0.2')
  // Through the catalogue (the rack and pool path): one selected object.
  const device = catalogue.deviceCatalogue().find(row => row.family === 'sound')
  assert.equal(device.summary(reading({selection: ['entity-a'], entities: [withSound(SOUND)]})), '220 Hz · sine · gain 0.2')
  assert.equal(device.summary(reading()), 'Select one object to act on its Sound')
})

test('the bounds are the app validator\'s: every edge is admitted and one step outside is refused, for the message and for the validator alike', () => {
  for (const spec of SOUND_NUMBERS) {
    const step = spec.field === 'frequencyHz' ? 1 : 0.001
    for (const value of [spec.min, spec.max]) {
      assert.equal(numberProblem(spec, value), null, `${spec.field}=${value} is admitted`)
      assert.doesNotThrow(() => validateEntitySound({enabled: true, [spec.field]: value}))
    }
    for (const value of [spec.min - step, spec.max + step, Number.NaN, Number.POSITIVE_INFINITY]) {
      const message = numberProblem(spec, value)
      assert.ok(message, `${spec.field}=${value} is refused`)
      assert.match(message, new RegExp(`${spec.min}|${spec.max}|number`))
      assert.throws(() => validateEntitySound({enabled: true, [spec.field]: value}), /Invalid entity sound/)
    }
  }
  assert.equal(numberProblem(SPEC.pan, -1), null)
  assert.equal(numberProblem(SPEC.gain, 1.5), 'Gain must be from 0 to 1.')
  assert.equal(numberProblem(SPEC.frequencyHz, 0), 'Frequency must be from 1 to 20000 Hz.')
  assert.equal(numberProblem(SPEC.attack, 11), 'Attack must be from 0 to 10 s.')
  assert.equal(numberProblem(SPEC.pan, 2), 'Pan must be from -1 to 1.')
})

test('exact-value text is parsed strictly: blank and non-numeric text never become a number', () => {
  assert.ok(Number.isNaN(parseNumberText('')))
  assert.ok(Number.isNaN(parseNumberText('  ')))
  assert.ok(Number.isNaN(parseNumberText('loud')))
  assert.equal(parseNumberText(' 220 '), 220)
  assert.equal(parseNumberText('0.5'), 0.5)
})

test('arrow steps use the control\'s step, Shift multiplies by ten, a bound that cannot move returns null, and floats never carry noise', () => {
  assert.equal(steppedValue(SPEC.frequencyHz, 220, 1, false), 221)
  assert.equal(steppedValue(SPEC.frequencyHz, 220, -1, true), 210)
  assert.equal(steppedValue(SPEC.frequencyHz, 20000, 1, false), null)
  assert.equal(steppedValue(SPEC.gain, 0.2, -1, false), 0.19)
  assert.equal(steppedValue(SPEC.gain, 0.2, -1, true), 0.1)
  assert.equal(steppedValue(SPEC.gain, 0.1, 1, false), 0.11, 'no 0.11000000000000001')
  assert.equal(steppedValue(SPEC.gain, 0, -1, false), null)
  assert.equal(steppedValue(SPEC.pan, 1, 1, true), null)
  assert.equal(steppedValue(SPEC.pan, 0.95, 1, true), 1, 'a Shift step clamps to the bound')
  assert.equal(snapValue(SPEC.frequencyHz, 0), 1)
  assert.equal(snapValue(SPEC.frequencyHz, 20001), 20000)
  assert.equal(snapValue(SPEC.attack, 0.123), 0.12)
})

test('coupling: a fixed pitch clears Follow cymatic, Follow restores a pitch when none is set, and no input is mutated', () => {
  const base = {enabled: true, followCymatic: true, gain: 0.2, waveform: 'sine', attack: 0.08, release: 0.8, pan: 0}
  const snapshot = structuredClone(base)
  const fixed = soundWithField(base, 'frequencyHz', 330)
  assert.deepEqual(fixed, {...base, frequencyHz: 330, followCymatic: false})
  assert.deepEqual(base, snapshot)
  assert.deepEqual(soundWithField(base, 'followCymatic', false), {...base, followCymatic: false, frequencyHz: DEFAULT_ENTITY_SOUND.frequencyHz})
  assert.deepEqual(soundWithField({...fixed, followCymatic: false}, 'followCymatic', true), {...fixed, followCymatic: true})
  assert.equal(soundWithField(fixed, 'gain', 0.5).frequencyHz, 330, 'a gain edit keeps the pitch')
  assert.throws(() => soundWithField(base, 'frequencyHz', 0), /Invalid entity sound/)
  assert.throws(() => soundWithField(base, 'followCymatic', 'yes'), /followCymatic must be a boolean/)
  assert.deepEqual(addedSound(), {...DEFAULT_ENTITY_SOUND, enabled: true}, 'Add sound sends the app defaults, sounding')
})

test('change shapes: add and remove, and one whole sound for each field, all admitted by the boundary validator through a stub apply', async () => {
  const sent = []
  const apply = async changes => { sent.push(...changes); return {ok: true} }
  const id = 'entity-a'
  const gestures = [
    soundChange(id, addedSound()),
    soundChange(id, null),
    soundChange(id, soundWithField(SOUND, 'enabled', false)),
    soundChange(id, soundWithField(SOUND, 'waveform', 'sawtooth')),
    soundChange(id, soundWithField(SOUND, 'frequencyHz', 440)),
    soundChange(id, soundWithField(SOUND, 'followCymatic', true)),
    soundChange(id, soundWithField(SOUND, 'gain', 0.75)),
    soundChange(id, soundWithField(SOUND, 'attack', 2.5)),
    soundChange(id, soundWithField(SOUND, 'release', 12)),
    soundChange(id, soundWithField(SOUND, 'pan', -0.5)),
  ]
  assert.equal(await apply(gestures).then(() => sent.length), gestures.length)
  for (const change of sent) {
    assert.deepEqual(Object.keys(change).sort(), ['entity_id', 'kind', 'sound'])
    assert.equal(change.kind, 'entity-sound')
    assert.deepEqual(validateNativeEntitySoundChange(change), change)
  }
  assert.deepEqual(sent[0], {kind: 'entity-sound', entity_id: id, sound: {...DEFAULT_ENTITY_SOUND, enabled: true}})
  assert.deepEqual(sent[1], {kind: 'entity-sound', entity_id: id, sound: null})
  assert.equal(sent[4].sound.followCymatic, false, 'a fixed pitch is sent with Follow off')
  assert.equal(sent[5].sound.followCymatic, true)
  assert.throws(() => soundChange(id, {...SOUND, gain: 1.2}), /Invalid entity sound: gain/)
  assert.throws(() => soundChange('', SOUND), /Choose the object/)
})

test('refusal: the owner\'s text is what the panel shows, and a non-refusal reply is not a refusal', () => {
  assert.equal(replyRefusal({ok: false, error: 'Unlock this entity before editing its device.'}), 'Unlock this entity before editing its device.')
  assert.equal(replyRefusal({ok: false, error: ''}), 'The owner refused this sound change.')
  assert.equal(replyRefusal({ok: true}), null)
  assert.equal(replyRefusal(undefined), null)
  assert.match(LOCKED_NOTE, /Unlock this entity/)
})

test('the envelope shares one 0 to 40 second axis, and each handle maps a point to its field with clamps', () => {
  assert.equal(timeToX(0), ENVELOPE.x0)
  assert.equal(timeToX(40), ENVELOPE.x0 + ENVELOPE.span)
  assert.ok(Math.abs(xToTime(timeToX(3.25)) - 3.25) < 1e-9)
  assert.equal(envelopeValueAt('attack', timeToX(0.5), ENVELOPE.baseY), 0.5)
  assert.equal(envelopeValueAt('attack', timeToX(25), ENVELOPE.baseY), 10, 'attack clamps to its bound')
  assert.equal(envelopeValueAt('release', timeToX(10 + 3), ENVELOPE.baseY), 3, 'release is measured from the sustain break')
  assert.equal(envelopeValueAt('release', timeToX(4), ENVELOPE.baseY), 0, 'a release handle left of the break clamps to zero')
  const y = ENVELOPE.baseY - 0.5 * (ENVELOPE.baseY - ENVELOPE.topY)
  assert.equal(envelopeValueAt('gain', 100, y), 0.5)
  assert.equal(envelopeValueAt('gain', 100, -500), 1, 'gain clamps to its bound')
})

test('the envelope drawing is computed from the sound: a change to attack or gain moves the drawn path and the handles', () => {
  const a = envelopeGeometry(resolvedSound(SOUND))
  const b = envelopeGeometry(resolvedSound({...SOUND, attack: 2}))
  const c = envelopeGeometry(resolvedSound({...SOUND, gain: 0.8}))
  assert.match(a.path, /^M30 110 L/)
  assert.notEqual(a.path, b.path)
  assert.notEqual(a.path, c.path)
  assert.equal(a.handles.attack.x, timeToX(0.08))
  assert.equal(b.handles.attack.x, timeToX(2))
  assert.ok(Math.abs(a.handles.gain.y - (c.handles.gain.y + (0.8 - 0.2) * (ENVELOPE.baseY - ENVELOPE.topY))) < 1e-9)
})

test('the waveform sketch is deterministic, shows two periods scaled to gain, and is flat at zero gain', () => {
  const box = {x0: 30, width: 300, centreY: 178, halfHeight: 20}
  const ys = path => [...path.matchAll(/[ML]([\d.]+) ([\d.-]+)/g)].map(match => Number(match[2]))
  for (const waveform of SOUND_WAVEFORMS) {
    const path = waveformPath(waveform, 0.5, box)
    assert.equal(waveformPath(waveform, 0.5, box), path, `${waveform} is deterministic`)
    const values = ys(path)
    assert.equal(values.length, 65, '64 samples across two periods')
    assert.ok(Math.max(...values) <= 178 + 10 + 0.01 && Math.min(...values) >= 178 - 10 - 0.01, `${waveform} stays within gain 0.5`)
  }
  assert.deepEqual([...new Set(ys(waveformPath('square', 0, box)))], [178])
  const square = ys(waveformPath('square', 1, box))
  assert.ok(square.includes(158) && square.includes(198), 'a full square reaches the full amplitude both ways')
})

test('the pan indicator maps -1 to the left edge, 0 to the centre and 1 to the right edge', () => {
  assert.equal(panX(-1, 30, 300), 30)
  assert.equal(panX(0, 30, 300), 180)
  assert.equal(panX(1, 30, 300), 330)
})

test('the app\'s sound groups, waveforms and bounds are the same table the view and the boundary use', () => {
  assert.deepEqual([...SOUND_WAVEFORMS], ['sine', 'triangle', 'square', 'sawtooth'])
  for (const spec of SOUND_NUMBERS) assert.ok(SOUND_FIELDS.includes(spec.field))
  assert.deepEqual(SOUND_NUMBERS.map(spec => [spec.field, spec.min, spec.max]), [['frequencyHz', 1, 20000], ['gain', 0, 1], ['attack', 0, 10], ['release', 0, 30], ['pan', -1, 1]])
})

// Server render through the real registries and the shared body.
const SSR = (entity, extra = {}) => renderToStaticMarkup(createElement(views.EntityFaceBody, {family: 'sound', models: registry.ENTITY_FACE_MODELS,
  views: views.ENTITY_FACE_VIEWS, reading: reading({selection: ['entity-a']}), entity, disabled: false, apply: noop, renderControl: () => null, ...extra}))
const input = (html, field) => html.match(new RegExp(`<input[^>]*id="native-entity-sound-${field}"[^>]*>`))?.[0] ?? ''

test('with no sound: the panel says so, offers one Add sound action and no remove or diagram', () => {
  const html = SSR(cell())
  assert.match(html, /class="native-device native-entity-device" aria-label="Sound"/)
  assert.match(html, /No sound on this object/)
  assert.match(html, /<button[^>]*>Add sound<\/button>/)
  assert.doesNotMatch(html, /Remove sound/)
  assert.doesNotMatch(html, /role="slider"/)
  assert.doesNotMatch(html, /Configuration diagram/)
  assert.match(html, /WebAudio/, 'the audio caveat is always disclosed')
})

test('with a sound: the diagram has three named handles, the exact-value fields are labelled with units, and the switches are present', () => {
  const html = SSR(withSound(SOUND))
  for (const name of ['Attack handle', 'Release handle', 'Gain handle']) assert.match(html, new RegExp(`role="slider"[^>]*aria-label="${name}"|aria-label="${name}"[^>]*role="slider"`))
  assert.equal([...html.matchAll(/role="slider"/g)].length, 3)
  for (const label of ['Frequency', 'Gain', 'Attack', 'Release', 'Pan', 'Waveform']) assert.match(html, new RegExp(`<span>${label}`))
  assert.match(html, /This object sounds while present/)
  assert.match(html, /Follow its cymatic frequency/)
  assert.match(html, /<button[^>]*>Remove sound<\/button>/)
  assert.doesNotMatch(html, /Add sound/)
  assert.match(html, /Presentation mute is local to the page/)
  assert.match(html, /220 Hz · sine · gain 0.2/)
})

test('the diagram follows the reading: a different attack or gain draws a different envelope path', () => {
  const pathOf = html => html.match(/<path d="([^"]+)" class="native-entity-sound-env"/)?.[1]
  const a = pathOf(SSR(withSound(SOUND)))
  assert.ok(a)
  assert.notEqual(a, pathOf(SSR(withSound({...SOUND, attack: 2}))))
  assert.notEqual(a, pathOf(SSR(withSound({...SOUND, gain: 0.9}))))
})

test('Follow cymatic disables the Frequency control; a fixed pitch enables it', () => {
  assert.match(input(SSR(withSound({...SOUND, followCymatic: true})), 'frequencyHz'), /disabled/)
  assert.doesNotMatch(input(SSR(withSound(SOUND)), 'frequencyHz'), /disabled/)
})

test('a locked object is shown as locked with its reason, and every edit control is disabled', () => {
  const html = SSR({...withSound(SOUND), locked: true})
  assert.match(html, /Unlock this entity to change its sound/)
  assert.match(html, /aria-disabled="true"/)
  assert.match(input(html, 'gain'), /disabled/)
  assert.match(html, /<button[^>]*disabled[^>]*>Remove sound<\/button>/)
})

test('a pending native acknowledgement disables the controls and says what they wait for', () => {
  const pending = reading({selection: ['entity-a']})
  pending.standing = {dirty: false, pending: true, notice: null}
  const html = renderToStaticMarkup(createElement(views.EntityFaceBody, {family: 'sound', models: registry.ENTITY_FACE_MODELS, views: views.ENTITY_FACE_VIEWS,
    reading: pending, entity: withSound(SOUND), disabled: true, apply: noop, renderControl: () => null}))
  assert.match(html, /A native acknowledgement is pending/)
  assert.match(input(html, 'attack'), /disabled/)
})
