import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Technē's event clip (manual §3: "Open an event in Technē and you see its span, what it gathered, and how sure anyone is of it"; lock
// §2.5 Clip detail; world-shell-mockup.html:1653-1659) through the one Clip view: the props — kind, standing, world, revision,
// occasion, place, provenance — with the disclosure ladder; Relations · typed, in standing; Constellation · bounded whole; Source. Fed
// only from the World cut's reading (the spine's retained occasion and the event row it came from): what that reading does not carry is
// "—", standing is the owner's verbatim word or none, and no relation is drawn the event does not name. Loader as techne-devices.test.mjs.
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
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

globalThis.__CRADLE_WALK__ = false
const {TechneClipDetail} = await import('../src/shell/ModeDetail.tsx')
const {createTimeSpine} = await import('../src/timeline/timeSpine.ts')
const html = element => renderToStaticMarkup(element)

const EVENT = {stream: 'vault', kind: 'source.read', subject_ref: 'vault:cw13/iv.md#stone', instant_unix_ms: Date.UTC(2026, 9, 8, 14, 2),
  summary: 'Read: the stone at Bollingen', day_ref: 'day:2026-10-08', stream_position: '4812', evidence_refs: ['vault:cw13/iv.md', 'wiki:bollingen-tower']}
function worldWith(event, {qualified = true, admitted = true} = {}) {
  const spine = createTimeSpine()
  if (event) {
    spine.selectOccasion(event, Date.UTC(2026, 9, 8, 14, 37))
    if (qualified) spine.qualifyOccasions(admitted ? [event] : [], Date.UTC(2026, 9, 8, 14, 38), 'present in the temporal reading of 14:38')
  }
  return {source: {status: 'live', error: null, now: null, events: event ? [event] : [], absences: [], sets: [], eventByClipId: new Map(),
    admittedRuns: null, admittedRunsError: null, readAtUnixMs: null, readCadence: null}, spine, selectOccasion: () => {}}
}
const row = (out, key) => {
  const match = out.match(new RegExp(`data-row="${key}"><span>${key}</span><span([^>]*)>([^<]*)</span>`))
  assert.ok(match, `the ${key} row stands`)
  return {value: match[2], undisclosed: match[1].includes('data-undisclosed')}
}

test('the event\'s props are the reading\'s own fields; what the reading does not carry is "—", never filled in', () => {
  const out = html(createElement(TechneClipDetail, {world: worldWith(EVENT)}))
  assert.match(out, /data-clip-view="techne-event"/)
  assert.match(out, /<div class="cph"[^>]*>Read: the stone at Bollingen<\/div>/, 'the head names the event as the reading summarises it')
  assert.equal(row(out, 'kind').value, 'source.read')
  assert.equal(row(out, 'occasion').value, '2026-10-08 14:02 UTC · day:2026-10-08')
  assert.equal(row(out, 'provenance').value, 'vault @ 4812')
  assert.equal(row(out, 'admission').value, 'admitted')
  for (const key of ['standing', 'world', 'revision', 'place']) {
    assert.deepEqual(row(out, key), {value: '—', undisclosed: true}, `${key}: the World cut's reading does not carry it`)
  }
})

test('the disclosure ladder stands dark: the reading discloses no rung, so none is lit and the rung reads "—"', () => {
  const out = html(createElement(TechneClipDetail, {world: worldWith(EVENT)}))
  assert.match(out, /class="techne-ladder-head"><span>Disclosure<\/span><span>—<\/span>/)
  assert.equal((out.match(/<i title="/g) ?? []).length, 7, 'the seven rungs of the mockup\'s ladder')
  assert.doesNotMatch(out, /data-lit|class="lit"/)
})

test('relations are the event\'s named evidence, each in the owner\'s standing; the constellation is the event and what it names', () => {
  const out = html(createElement(TechneClipDetail, {world: worldWith(EVENT)}))
  assert.match(out, /data-column="Relations · typed, in standing"/)
  for (const ref of EVENT.evidence_refs) assert.match(out, new RegExp(`<span class="hl2-chip">evidence</span><span class="hl2-text">${ref}</span><span class="r">—</span>`))
  assert.match(out, /data-column="Constellation · bounded whole"/)
  assert.equal((out.match(/<circle /g) ?? []).length, EVENT.evidence_refs.length + 1, 'one node for each thing it names, and the event at the centre')
  assert.match(out, /data-column="Source"[^]*vault · 4812[^]*Read: the stone at Bollingen/)
})

test('an event that names nothing has no relation and no neighbour drawn; one that left the reading says so', () => {
  const bare = html(createElement(TechneClipDetail, {world: worldWith({...EVENT, evidence_refs: []})}))
  assert.match(bare, /The reading names no relation of this event\./)
  assert.match(bare, /The reading discloses no neighbours of this event\./)
  assert.doesNotMatch(bare, /<svg class="techne-constellation"/)
  const gone = html(createElement(TechneClipDetail, {world: worldWith(EVENT, {admitted: false})}))
  assert.equal(row(gone, 'admission').value, 'no longer in the reading')
  const unqualified = html(createElement(TechneClipDetail, {world: worldWith(EVENT, {qualified: false})}))
  assert.deepEqual(row(unqualified, 'admission'), {value: '—', undisclosed: true})
})

test('with no event selected the anatomy stands, every field "—", every column saying what it waits for', () => {
  for (const world of [null, worldWith(null)]) {
    const out = html(createElement(TechneClipDetail, {world}))
    assert.match(out, /<div class="cph"[^>]*>No event selected<\/div>/)
    assert.doesNotMatch(out, /data-row="[a-z]+"><span>[a-z]+<\/span><span>[^—<]/, 'no row holds a value')
    assert.match(out, /Select an event: its relations stand here\./)
    assert.match(out, /Select an event: its source stands here\./)
  }
})
