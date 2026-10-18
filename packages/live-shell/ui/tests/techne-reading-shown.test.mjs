// Technē's readings on the ruler (manual §17.1 the mixer row: "Activator shows or hides the reading", "Solo shows only the soloed"):
// the shell holds which readings stand (timeline/readingShown.ts); the Technē set reads it — a hidden reading keeps its track and
// leaves the ruler, a soloed one stands alone. Channels: SCRIPTED World cut sets in memory through r2-clip-bindings' loader.
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

const shown = await import('../src/timeline/readingShown.ts')
const {projectTechneTracks, READING_SHOWN_OP} = await import('../src/timeline/techneTrackAdapter.ts')

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const {projectAionReading} = await import('../src/projections/atlas/aionTimeline.ts')
const {fixtureCorpus} = await import('../src/projections/atlas/provider/fixtureCorpus.ts')
// The real Aion adapter over the atlas's fixture corpus, as techne-tracks.test.mjs reads it.
const aionSet = projectAionReading({history: fixtureCorpus().history, providerId: 'fixture'})
const world = {state: 'live', sets: [aionSet], eventByClipId: new Map(), todayYear: 2026}
const project = state => projectTechneTracks({world, shown: {state, show: shown.setReadingShown, solo: shown.setReadingSolo}})

test('the store says which readings stand: hidden ones do not, and with one soloed only it does', () => {
  shown.resetReadingShown()
  assert.equal(shown.readingStands(shown.readReadingShown(), 'reading:a'), true)
  shown.setReadingShown('reading:a', false)
  assert.equal(shown.readingStands(shown.readReadingShown(), 'reading:a'), false)
  shown.setReadingSolo('reading:b', true)
  assert.equal(shown.readingStands(shown.readReadingShown(), 'reading:b'), true)
  assert.equal(shown.readingStands(shown.readReadingShown(), 'reading:a'), false)
  shown.setReadingSolo('reading:b', false)
  assert.equal(shown.readReadingShown().soloed, null)
  shown.resetReadingShown()
})

test('a hidden reading keeps its track and its Activator, and its events leave the ruler; Solo stands one alone', async () => {
  shown.resetReadingShown()
  const all = project(shown.readReadingShown())
  const reading = aionSet.tracks[0].id, others = aionSet.tracks.slice(1).map(t => t.id)
  const on = (set, id) => set.clips.filter(c => c.trackId === id).length
  assert.ok(on(all, reading) > 0, 'the reading\'s events stand')
  assert.equal(all.mixer.activator.disabled, undefined); assert.match(all.mixer.activator.meaning, /on the ruler; the atlas and the Journey keep their own layers/)
  assert.equal(all.actions.mixer.activator.op, READING_SHOWN_OP)
  await all.actions.mixer.activator.run(reading, false)
  const hidden = project(shown.readReadingShown())
  assert.equal(on(hidden, reading), 0, 'its events leave the ruler')
  assert.deepEqual(hidden.tracks.find(t => t.id === reading).mix, {activator: false, solo: false}, 'the track stays, its Activator off')
  assert.ok(others.every(id => on(hidden, id) === on(all, id)), 'the other readings stand as they were')
  await hidden.actions.mixer.solo.run(reading, true)
  const soloed = project(shown.readReadingShown())
  assert.equal(on(soloed, reading), on(all, reading), 'a soloed reading stands even while its Activator is off')
  assert.ok(others.every(id => on(soloed, id) === 0), 'and only it')
  shown.resetReadingShown()
  assert.match(projectTechneTracks({world}).mixer.activator.disabled, /missing op/, 'no hold handed in: the row says what it lacks')
})
