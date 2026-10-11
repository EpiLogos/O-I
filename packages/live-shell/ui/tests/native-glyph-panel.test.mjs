import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Glyph sequence panel: image/ASCII state-source options, Refit state sizes and Refit all states. The pure builders are checked
// against the owner's applyNativeGlyphChanges on a real Journey fixture (fieldStudies), against the Studio's own ranges and modes,
// and the editor is rendered with SSR. Same loader as native-device-formation.test.mjs (.tsx transpiled, .css stubbed).
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const [source, refit, editorModule, model, hostEditor, stateSizing] = await Promise.all([
  import('../src/components/nativeGlyphSource.ts'),
  import('../src/components/nativeGlyphRefit.ts'),
  import('../src/components/GlyphSequenceEditor.tsx'),
  import(new URL('model.ts', author)),
  import(new URL('hostEditor.ts', author)),
  import(new URL('stateSizing.ts', author)),
])
const {GlyphSequenceEditor} = editorModule
const {fieldStudies} = model
const {applyNativeGlyphChanges} = hostEditor
const {refitFormationToGlyphs} = stateSizing
const {planGlyphRefit, HELD_REFIT_DISCLOSURE} = refit
const {ASCII_TEXT_MAX, DEFAULT_IMAGE_THRESHOLD, GLYPH_OPEN_STUDIO_EVENT, IMAGE_MODES, SOURCE_RANGES, asciiOptionBuild, checkAsciiFont, checkAsciiText, checkSourceNumber, imageOptionBuild, sourceDefault, sourceKindBuild, sourceKindOf} = source
const sources = {
  imageSuite: await readFile(new URL('imageSuite.ts', author), 'utf8'),
  openStudio: await readFile(new URL('packages/live-shell/ui/src/native/openStudio.ts', root), 'utf8'),
  sampling: await readFile(new URL('desktop/cradle/expressions-app/src/engine/sourceSampling.ts', root), 'utf8'),
  editor: await readFile(new URL('packages/live-shell/ui/src/components/GlyphSequenceEditor.tsx', root), 'utf8'),
}
const PNG = 'data:image/png;base64,iVBORw0KGgo='
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** One fixture: the first formation with two text states, its states made editable and sequenced; state 0 holds a loaded image, state 1 an ASCII drawing. */
function fixture({sequenced = true} = {}) {
  const journey = fieldStudies(), scene = journey.scenes[0]
  const e = scene.entities.find(entity => entity.kind === 'formation')
  assert.ok(e, 'fixture formation')
  const base = {hold: 1, transition: 1, position: null}
  e.locked = false
  e.sequence.enabled = sequenced
  e.sequence.manual = false
  e.sequence.steps = [{...base, id: 'state-image', text: 'O', shape: 'text'}, {...base, id: 'state-ascii', text: 'X', shape: 'text'}, {...base, id: 'state-glyph', text: 'I', shape: 'text'}]
  e.sequence.steps[0].shape = 'text'
  e.sequence.steps[0].source = {kind: 'image', image: {dataUrl: PNG, name: 'mark.png', mode: 'luminance', threshold: 0.3, invert: false, scale: 1}}
  e.sequence.steps[1].shape = 'text'
  e.sequence.steps[1].source = {kind: 'ascii', ascii: {text: 'X  O', fontFamily: 'monospace', fontSize: 32}}
  return {journey, scene, e, step: e.sequence.steps[0], ascii: e.sequence.steps[1]}
}
const font = {fontFamily: 'Georgia', fontWeight: 900}
const readingFor = (scene, e, step, {locked = false} = {}) => ({
  basis: {expression_ref: 'expr:glyph-panel', revision: 1, scene_ref: scene.id, authored_revision: 1},
  scene: {...scene, entities: scene.entities.map(row => row.id === e.id ? {...row, locked} : row)},
  entityOccurrences: {[e.id]: 'occ:glyph-panel'}, chosenControls: {available: false, entries: [], controls: []}, devices: [],
  selection: {entity_ids: [e.id], step_id: step.id}, history: {canUndo: false, canRedo: false},
  standing: {dirty: false, pending: false, notice: null},
})
const markupFor = (reading, compact = false) => renderToStaticMarkup(createElement(GlyphSequenceEditor, {reading, compact, request: async () => ({ok: false, error: 'closed'})}))
/** The opening tag that carries an accessible name; its own attributes decide whether it is disabled. */
const tagFor = (markup, label) => {const match = markup.match(new RegExp(`<[^>]*aria-label="${escape(label)}"[^>]*>`)); assert.ok(match, `markup carries ${label}`); return match[0]}

test('source kind builds replace the state source with the app defaults, one step-source each', () => {
  const {e, step} = fixture()
  const image = sourceKindBuild(e, step, 'image'), ascii = sourceKindBuild(e, step, 'ascii'), none = sourceKindBuild(e, step, 'none')
  assert.deepEqual(image, {ok: true, change: {kind: 'step-source', entity_id: e.id, step_id: step.id, shape: 'text', source: {kind: 'image', image: {mode: 'luminance', threshold: DEFAULT_IMAGE_THRESHOLD, invert: false, scale: 1}}}})
  assert.deepEqual(ascii.change.source, {kind: 'ascii', ascii: {text: 'O  :  I', fontFamily: 'monospace', fontSize: 32}})
  assert.ok('source' in none.change && none.change.source === undefined, 'geometry build clears the source explicitly')
  assert.equal(sourceKindOf(step.source), 'image'); assert.equal(sourceKindOf(undefined), 'none'); assert.equal(sourceDefault('none'), undefined)
})

test('image options: each is one step-source carrying the whole loaded image, refused without a file or outside its range', () => {
  const {e, step} = fixture()
  const cases = [[{threshold: 0.6}, img => img.threshold === 0.6], [{scale: 2.5}, img => img.scale === 2.5], [{mode: 'edgeSobel'}, img => img.mode === 'edgeSobel'],
    [{mode: 'silhouette'}, img => img.mode === 'silhouette'], [{invert: true}, img => img.invert === true]]
  for (const [patch, expect] of cases) {
    const built = imageOptionBuild(e, step, patch)
    assert.equal(built.ok, true, JSON.stringify(patch))
    assert.equal(built.change.kind, 'step-source'); assert.equal(built.change.entity_id, e.id); assert.equal(built.change.step_id, step.id)
    const image = built.change.source.image
    assert.ok(expect(image)); assert.equal(image.dataUrl, PNG); assert.equal(image.name, 'mark.png')
  }
  assert.equal(imageOptionBuild(e, step, {threshold: 1}).ok, true, 'upper threshold bound is inclusive')
  assert.equal(imageOptionBuild(e, step, {scale: 0.1}).ok, true, 'lower scale bound is inclusive')
  assert.deepEqual(imageOptionBuild(e, step, {threshold: 1.5}), {ok: false, message: 'Ink threshold must be 0 to 1'})
  assert.equal(imageOptionBuild(e, step, {scale: 3.5}).ok, false)
  assert.equal(imageOptionBuild(e, step, {mode: 'bogus'}).ok, false)
  assert.equal(imageOptionBuild(e, step, {invert: 'yes'}).ok, false)
  const unloaded = {...step, source: {kind: 'image', image: {mode: 'luminance', threshold: .24, invert: false, scale: 1}}}
  assert.deepEqual(imageOptionBuild(e, unloaded, {threshold: .5}), {ok: false, message: 'Choose an image file in the Studio before editing its options'})
  assert.equal(imageOptionBuild(e, {...step, source: undefined}, {threshold: .5}).ok, false, 'a geometry state has no image options')
})

test('ASCII options: font, size and negative space are one step-source each, with the drawing kept intact', () => {
  const {e, ascii} = fixture()
  const font = asciiOptionBuild(e, ascii, {fontFamily: '  serif  '})
  assert.deepEqual(font.change.source, {kind: 'ascii', ascii: {text: 'X  O', fontFamily: 'serif', fontSize: 32}}, 'font is trimmed and the drawing text survives')
  assert.deepEqual(asciiOptionBuild(e, ascii, {fontSize: 8}).change.source.ascii.fontSize, 8)
  assert.deepEqual(asciiOptionBuild(e, ascii, {fontSize: 256}).change.source.ascii.fontSize, 256)
  assert.equal(asciiOptionBuild(e, ascii, {fontSize: 7}).ok, false); assert.equal(asciiOptionBuild(e, ascii, {fontSize: 257}).ok, false)
  assert.equal(asciiOptionBuild(e, ascii, {invert: true}).change.source.ascii.invert, true)
  assert.equal(asciiOptionBuild(e, ascii, {text: ''}).change.source.ascii.text, '', 'an emptied drawing is a valid owner state')
  assert.deepEqual(asciiOptionBuild(e, ascii, {fontFamily: '   '}), {ok: false, message: 'Monospace font needs 1 to 200 characters'})
  assert.equal(asciiOptionBuild(e, ascii, {fontFamily: 'f'.repeat(201)}).ok, false)
  assert.equal(asciiOptionBuild(e, ascii, {text: 'x'.repeat(ASCII_TEXT_MAX + 1)}).ok, false)
  assert.equal(asciiOptionBuild(e, {...ascii, source: undefined}, {invert: true}).ok, false)
  assert.equal(checkAsciiFont('serif').ok, true); assert.equal(checkAsciiText('a'.repeat(ASCII_TEXT_MAX)).ok, true)
})

test('exact values: strict decimal text inside the inclusive range, bounds named in the refusal', () => {
  assert.deepEqual(checkSourceNumber('threshold', '1.5'), {ok: false, message: 'Ink threshold must be 0 to 1'})
  assert.deepEqual(checkSourceNumber('threshold', ' 0.25 '), {ok: true, value: 0.25})
  assert.deepEqual(checkSourceNumber('scale', '1e-1'), {ok: true, value: 0.1})
  assert.equal(checkSourceNumber('threshold', '0x10').ok, false, 'hex text is not an exact value')
  assert.equal(checkSourceNumber('threshold', '').ok, false)
  assert.equal(checkSourceNumber('threshold', 'NaN').ok, false)
  assert.deepEqual(checkSourceNumber('fontSize', '12.5'), {ok: true, value: 12.5})
  assert.deepEqual(checkSourceNumber('fontSize', '300'), {ok: false, message: 'Font size ceiling must be 8 to 256'})
})

test('drift: ranges, read modes, default threshold and Studio event are the Studio sources', () => {
  const rows = [...sources.imageSuite.matchAll(/range\('([^']+)','step\.source\.(?:image|ascii)\.(\w+)',[^,]+,([\d.]+),([\d.]+),([\d.]+)\)/g)]
    .map(match => ({label: match[1], min: Number(match[3]), max: Number(match[4]), step: Number(match[5])}))
  for (const key of Object.keys(SOURCE_RANGES)) {
    const range = SOURCE_RANGES[key], row = rows.find(item => item.label === range.label)
    assert.ok(row, `imageSuite draws ${range.label}`)
    assert.deepEqual({min: row.min, max: row.max, step: row.step}, {min: range.min, max: range.max, step: range.step}, range.label)
  }
  const segment = sources.imageSuite.slice(sources.imageSuite.indexOf("select('Read as'"), sources.imageSuite.indexOf("range('Ink threshold'"))
  assert.deepEqual([...segment.matchAll(/\['(\w+)','([^']+)'\]/g)].map(match => [match[1], match[2]]), IMAGE_MODES.map(([id, label]) => [id, label]))
  assert.match(sources.sampling, new RegExp(`DEFAULT_SOURCE_THRESHOLD = ${DEFAULT_IMAGE_THRESHOLD}\\b`))
  assert.match(sources.openStudio, new RegExp(`NATIVE_OPEN_STUDIO = '${escape(GLYPH_OPEN_STUDIO_EVENT)}'`))
})

test('the owner stores each built option exactly, at its range edges, and keeps every other field of the loaded source', () => {
  const {journey, scene, e, step, ascii} = fixture()
  const stored = (changed, entityId, stepId) => changed.scenes[0].entities.find(row => row.id === entityId).sequence.steps.find(row => row.id === stepId)
  const applied = [
    sourceKindBuild(e, step, 'image'), sourceKindBuild(e, step, 'ascii'), sourceKindBuild(e, step, 'none'),
    imageOptionBuild(e, step, {threshold: 0}), imageOptionBuild(e, step, {threshold: 1}), imageOptionBuild(e, step, {scale: 3}),
    imageOptionBuild(e, step, {mode: 'silhouette', invert: true}),
    asciiOptionBuild(e, ascii, {fontFamily: 'serif', fontSize: 8, invert: true}), asciiOptionBuild(e, ascii, {fontSize: 256}),
  ]
  for (const built of applied) {
    assert.equal(built.ok, true)
    const next = applyNativeGlyphChanges(journey, scene.id, [built.change])
    const row = stored(next, e.id, built.change.step_id)
    assert.deepEqual(row.source ?? undefined, built.change.source, JSON.stringify(built.change.source))
    assert.equal(row.shape, 'text')
  }
  const loaded = imageOptionBuild(e, step, {threshold: 0.9})
  assert.equal(stored(applyNativeGlyphChanges(journey, scene.id, [loaded.change]), e.id, step.id).source.image.dataUrl, PNG)
  assert.equal(stored(applyNativeGlyphChanges(journey, scene.id, [asciiOptionBuild(e, ascii, {invert: true}).change]), e.id, ascii.id).source.ascii.text, 'X  O')
})

test('Refit all: the planned states equal the app refit law, and the owner stores that exact result in one apply', () => {
  const {journey, scene, e} = fixture()
  const plan = planGlyphRefit(e, font)
  assert.equal(plan.blocked, null)
  assert.ok(plan.changes.length >= 1 && plan.changes.every(change => change.kind === 'step-overrides' && change.operation === 'capture' && change.entity_id === e.id))
  const expected = structuredClone(e); refitFormationToGlyphs(expected, font)
  const next = applyNativeGlyphChanges(journey, scene.id, plan.changes).scenes[0].entities.find(row => row.id === e.id)
  assert.deepEqual(next.sequence.steps.map(step => step.objectState), expected.sequence.steps.map(step => step.objectState))
  // The app law's second pass on refit states adds no change: the refit is idempotent for the same font.
  assert.deepEqual(planGlyphRefit(next, font).changes, [])
})

test('Refit all refuses a held formation with the disclosure, because its base box has no boundary write path', () => {
  const {e} = fixture({sequenced: false})
  const held = {...e, shape: 'text', size: {x: 1, y: 3}}; delete held.source
  const plan = planGlyphRefit(held, font)
  assert.equal(plan.blocked, HELD_REFIT_DISCLOSURE)
  assert.match(plan.blocked, /not available through the boundary yet/)
  assert.deepEqual(plan.changes, [])
})

test('SSR: an image state shows its options, the Studio disclosure, the refit controls and their accessible names', () => {
  const {scene, e, step} = fixture()
  const markup = markupFor(readingFor(scene, e, step))
  for (const name of ['Refit state sizes', 'Refit all states to glyphs', 'Build this state from', 'Read as', 'Ink threshold', 'Ink threshold slider', 'Source scale', 'Source scale slider', 'Force dark ink on light paper']) assert.match(markup, new RegExp(`aria-label="${escape(name)}"`), name)
  assert.match(markup, />Open in Studio<\/button>/)
  assert.match(markup, /Choose an image file in the Studio/)
  assert.match(markup, /Auto-fit · refits state sizes when the font or shapes change/)
  assert.match(markup, /role="alert"/)
  assert.doesNotMatch(tagFor(markup, 'Read as'), /disabled=""/, 'a loaded image keeps its options editable')
  assert.doesNotMatch(tagFor(markup, 'Ink threshold'), /disabled=""/)
  assert.doesNotMatch(tagFor(markup, 'Refit state sizes'), /disabled=""/)
  assert.doesNotMatch(tagFor(markup, 'Refit all states to glyphs'), /disabled=""/, 'a sequenced formation with text states can refit')
})

test('SSR: an image state without a loaded file holds its options disabled and says so', () => {
  const {scene, e, step} = fixture()
  const unloaded = {...e, sequence: {...e.sequence, steps: e.sequence.steps.map((row, i) => i === 0 ? {...row, source: {kind: 'image', image: {mode: 'luminance', threshold: .24, invert: false, scale: 1}}} : row)}}
  const markup = markupFor(readingFor({...scene, entities: scene.entities.map(row => row.id === e.id ? unloaded : row)}, unloaded, step))
  assert.match(markup, /No image is loaded yet/)
  for (const name of ['Read as', 'Ink threshold', 'Source scale', 'Force dark ink on light paper']) assert.match(tagFor(markup, name), /disabled=""/, name)
})

test('SSR: an ASCII state exposes its font, size and negative space, and a locked formation disables every option', () => {
  const {scene, e, ascii} = fixture()
  const markup = markupFor(readingFor(scene, e, ascii))
  for (const name of ['Monospace font', 'Font size ceiling', 'Font size ceiling slider', 'Sample negative space', 'ASCII drawing']) assert.match(markup, new RegExp(`aria-label="${escape(name)}"`), name)
  assert.doesNotMatch(tagFor(markup, 'Monospace font'), /disabled=""/)
  const locked = markupFor(readingFor(scene, e, ascii, {locked: true}))
  for (const name of ['Monospace font', 'Font size ceiling', 'Sample negative space', 'Build this state from', 'Refit all states to glyphs']) assert.match(tagFor(locked, name), /disabled=""/, name)
})

test('SSR: a held formation discloses that Refit all is unavailable; the compact device keeps the refit row and hides the detail grid', () => {
  const {scene, e, step} = fixture({sequenced: false})
  const held = {...e, shape: 'text', size: {x: 1, y: 3}}; delete held.source
  const markup = markupFor(readingFor({...scene, entities: scene.entities.map(row => row.id === e.id ? held : row)}, held, step))
  assert.match(markup, /not available through the boundary yet/)
  assert.match(tagFor(markup, 'Refit all states to glyphs'), /disabled=""/)
  const compact = markupFor(readingFor(scene, e, step), true)
  assert.match(compact, /aria-label="Refit state sizes"/)
  assert.doesNotMatch(compact, /aria-label="Build this state from"/)
})

test('the editor writes exactly one step-source per option commit and the switch is the panel-setting the boundary admits', () => {
  assert.match(sources.editor, /const ok=await apply\(\[built\.change\]\)/)
  assert.match(sources.editor, /kind:'panel-setting',key:'autoFitSizes',value:event\.target\.checked/)
  assert.match(sources.editor, /new CustomEvent\(GLYPH_OPEN_STUDIO_EVENT,\{detail:\{section:'formations'\}\}\)/)
})
