// W5, faces from real state: the environs of the process devices (manual §25.6 "Process types, read in time"; owner, 18 Oct: "roster =
// agent-type faces, environs = process faces"): the Gateway's river, the NOWs' seasons, the Seat's succession and Ground hygiene's erosion,
// each read from the value keys its design already reads (faces/environReadings.ts) and drawn by the faces kit (faces/EnvironFaces.tsx).
// Channels: REAL (tests/fixtures/environ-readings-2026-10-21.json: `central.now.list` and `seat status --json` read on workcell:mac, 21 Oct,
// read-only, trimmed to the fields the readers take; the ground capture tests/fixtures/ground-hygiene-pages-2026-10-21.json); FIXTURE (the
// Gateway's flow keys, which its binding does not carry yet); SCRIPTED (the faces rendered to static markup). Nothing moves: each face is the
// state now, or the reason there is none. The design placements are the design lane's (the return's PROPOSE); not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
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

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement: h} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const F = await import('../src/inhabitants/catalogue/faces/index.ts')
const M = await import('../src/inhabitants/centralHygieneModel.ts')
const REAL = JSON.parse(readFileSync(new URL('./fixtures/environ-readings-2026-10-21.json', import.meta.url), 'utf8'))
const GROUND = JSON.parse(readFileSync(new URL('./fixtures/ground-hygiene-pages-2026-10-21.json', import.meta.url), 'utf8'))
const draw = node => renderToStaticMarkup(node)
const count = (markup, re) => (markup.match(re) ?? []).length

test('the river: flowing while the way in is open and checks in, still past Stall after, a dry bed while nothing can come in, and no reading said', () => {
  assert.deepEqual(F.riverOf({}), {absent: 'The gateway has not reported its state yet.'})
  assert.equal(F.riverOf({light: 'lit', refused: 'harness_agent_read: no binding'}).flow, 'dry')
  assert.equal(F.riverOf({light: 'lit', refused: 'harness_agent_read: no binding'}).why, 'harness_agent_read: no binding', 'the owner\'s words')
  assert.equal(F.riverOf({light: 'lit', connect: false}).flow, 'dry')
  assert.equal(F.riverOf({light: 'dark'}).flow, 'dry')
  const today = F.riverOf({light: 'lit', connect: true, readiness: 'ready', stallAfter: 90})
  assert.deepEqual([today.flow, today.sessions, today.inflight, today.why], ['flowing', null, null, 'The harness says ready.'], 'as the Gateway is bound today: no sessions reported, none drawn as if')
  const still = F.riverOf({light: 'lit', connect: true, running: 2, beatAge: 400, stallAfter: 90})
  assert.deepEqual([still.flow, still.sessions], ['still', 2])
  assert.match(still.why, /No check-in for 400 s: past Stall after \(90 s\)/)
  const framed = F.riverOf({light: 'lit', frames: JSON.stringify([{session: 'a', dir: 'in'}, {session: 'b', dir: 'out'}, {session: 'a', dir: 'in'}]), inflight: 3})
  assert.deepEqual([framed.flow, framed.sessions, framed.inflight], ['flowing', 2, 3], 'the distinct sessions of the frames, where no turns are counted')
  const flowing = draw(h(F.RiverEnviron, {reading: F.riverOf({light: 'lit', running: 3, inflight: 4, beatAge: 5, stallAfter: 90}), width: 266, height: 104}))
  assert.equal(count(flowing, /<ellipse /g), 4, 'one leaf on the current for each frame in flight')
  assert.match(flowing, /data-flow="flowing"/)
  assert.match(flowing, /flowing · 3 sessions · 4 in flight/)
  const dry = draw(h(F.RiverEnviron, {reading: F.riverOf({light: 'lit', connect: false}), width: 266, height: 104}))
  assert.match(dry, /data-flow="dry"/)
  assert.doesNotMatch(dry, /<ellipse /, 'nothing floats on a dry bed')
  assert.match(draw(h(F.RiverEnviron, {reading: F.riverOf({}), width: 266, height: 104})), /The gateway has not reported its state yet\.[\s\S]*no reading/)
})

test('the seasons: the real NOW field read as a year, its clearings in growth, dormant, harvested and in the record', () => {
  const rows = REAL.nows.records
  const nows = JSON.stringify(rows.filter(r => r.lifecycle !== 'archived'))
  const tally = {active: 0, quiescent: 0, closed: 0, archived: 0}
  for (const r of rows) tally[r.lifecycle] += 1
  const reading = F.seasonsOf({nows, seasons: JSON.stringify(tally)})
  assert.deepEqual(reading.counts, {growth: tally.active, dormant: tally.quiescent, harvested: tally.closed, record: tally.archived})
  assert.equal(reading.standing.length, tally.active + tally.quiescent, 'the standing field: active and quiescent, oldest first')
  assert.ok(reading.standing.every((c, i, all) => i === 0 || rows.find(r => r.now_ref === all[i - 1].ref).created_at_unix_seconds <= rows.find(r => r.now_ref === c.ref).created_at_unix_seconds))
  const markup = draw(h(F.SeasonsEnviron, {reading, width: 640, height: 200}))
  assert.equal(count(markup, /<title>/g), reading.standing.length, 'one stalk for each clearing standing, by its own words')
  assert.match(markup, new RegExp(`${tally.active} in growth · ${tally.quiescent} dormant · ${tally.closed} harvested · ${tally.archived} in the record`))
  assert.equal(count(markup, /stroke-width="1.6"/g), Math.min(5, tally.closed), 'a sheaf (its tie) for each harvested clearing, five at most')
  const noRecord = F.seasonsOf({nows})
  assert.equal(noRecord.counts.record, null, 'without the year\'s counts the record is unread, not zero')
  assert.match(draw(h(F.SeasonsEnviron, {reading: noRecord})), /the record unread/)
  assert.deepEqual(F.seasonsOf({reason: 'central.now.list: refused'}), {absent: 'central.now.list: refused'})
})

test('the NOWs binding carries the field\'s year over the whole listing, archived clearings too, beside the rows that leave them out', async () => {
  const rail = await import('../src/widgets/railBindings.ts')
  const listing = {schema: 'central.now-listing/v1', automatic_agent_or_model_invocation: false, records: REAL.nows.records}
  const values = rail.nowsValues({time: {state: 'failed', action: 'central.time.policy'}, day: {state: 'failed', action: 'central.day.read'}, now: {state: 'ready', action: 'central.now.list', data: listing}, sources: {state: 'unavailable', action: 'x'}})
  const seasons = JSON.parse(values.seasons)
  assert.equal(seasons.active + seasons.quiescent + seasons.closed + seasons.archived, REAL.nows.records.length)
  assert.ok(seasons.archived > 0, 'the archived ones are counted (the real field holds 58)')
  assert.ok(JSON.parse(values.nows).every(r => r.lifecycle !== 'archived'), 'the rows still leave them out')
})

test('the succession: each seat of a product is ground; a lane grows on it by its commits, main\'s newer layers lie on top, loose ground mounds', () => {
  const seats = JSON.stringify(M.parseSeatStatusJson(JSON.stringify(REAL.seat)).map(s => ({...s, zones: []})))
  const reading = F.successionOf({seats, product: 'central'})
  assert.equal(reading.product, 'central')
  assert.deepEqual(reading.plots.map(p => p.seat), ['env-1', 'env-2', 'env-3'])
  for (const plot of reading.plots) assert.ok(['free', 'held', 'foreign', 'unknown'].includes(plot.state))
  const fixture = F.successionOf({seats: JSON.stringify([
    {workcell: 'env-1', product: 'o-i', state: 'claimed', branch: 'dlw/build', claimedBy: 'a', dirty: 3, untracked: 2, ahead: 12, behind: 4, drift: 'none', zones: [{actor: 'a'}, {actor: 'b'}]},
    {workcell: 'env-2', product: 'o-i', state: 'free', branch: null, dirty: 0, untracked: 0, ahead: 0, behind: 0},
    {workcell: 'env-3', product: 'o-i', state: 'occupied-foreign-lane', branch: 'fold/x', dirty: null, untracked: null, ahead: null, behind: null, drift: 'head differs'},
    {workcell: 'env-1', product: 'central', state: 'free'}])})
  assert.deepEqual(fixture.plots.map(p => [p.seat, p.state, p.lane, p.ahead, p.loose, p.workers, p.drift]), [
    ['env-1', 'held', 'dlw/build', 12, 5, 2, false], ['env-2', 'free', null, 0, 0, 0, false], ['env-3', 'foreign', 'fold/x', null, null, 1, true]],
    'the first row\'s product, unless one is chosen; loose ground is what is not committed; the workers the zones name')
  const markup = draw(h(F.SuccessionEnviron, {reading: fixture, width: 266, height: 104}))
  assert.deepEqual([...markup.matchAll(/data-plot="([a-z]+)"/g)].map(m => m[1]), ['held', 'free', 'foreign'])
  assert.match(markup, /env-1 dlw\/build \+12 · env-2 cleared · env-3 a foreign lane/)
  assert.deepEqual(F.successionOf({seats: '[]'}), {absent: 'The seat instrument lists no product.'})
  assert.match(F.successionOf({}).absent, /seat status/)
})

test('the erosion: each page\'s bank, one channel for each kind of finding, deep as it is grave and wide as it is frequent; a refused read unsurveyed', () => {
  const ground = M.groundFindings({root: M.rootOfDoctor(GROUND.doctor.data), scaffold: M.scaffoldOfPlan(GROUND.reprojectOI.data), authored: M.authoredOfInspection(GROUND.groundOI.data),
    ops: {root: 'central.doctor', scaffold: 'central.world.reproject.plan', authored: 'projectcentral.ground.inspect'}})
  const seats = M.parseSeatStatusJson(JSON.stringify(REAL.seat))
  const census = M.assembleCensus({sources: [{boundaryOp: 'seat status', channel: 'machine-instrument', at: 'x'}], seats})
  const findings = [...M.hygieneFindings(census, M.registeredSeatPaths(census)), ...ground]
  const reading = F.erosionOf({findings: JSON.stringify(findings), sources: JSON.stringify([{boundaryOp: 'op material_read', channel: 'kernel-op', at: 'x', refusal: 'no route'}])})
  const pages = Object.fromEntries(reading.pages.map(p => [p.page, p]))
  assert.equal(pages.ground.wear.length, ground.length, 'the ground page wears what the ground readings found')
  assert.ok(pages.ground.wear.every(w => w.depth === 1 && w.tendable), 'an unrecognised source is a print, and Recognise tends it')
  assert.deepEqual(pages.material.unsurveyed, ['op material_read: no route'], 'a refused read leaves its page unsurveyed, in the owner\'s words')
  const markup = draw(h(F.ErosionEnviron, {reading, width: 640, height: 200}))
  const kinds = new Set(findings.filter(f => !['root-part-missing', 'root-mixed', 'scaffold-missing', 'source-unrecognised'].includes(f.kind)).map(f => f.kind))
  assert.ok(markup.includes(`>${ground.length}</text>`), 'the print stretch carries its count')
  assert.match(markup, /material unsurveyed/)
  assert.ok(kinds.size >= 1)
  assert.deepEqual(F.erosionOf({}), {absent: 'Ground hygiene has not read the ground yet.'})
  const sound = draw(h(F.ErosionEnviron, {reading: F.erosionOf({findings: '[]', sources: '[]'})}))
  assert.match(sound, /checkouts sound · ground sound · material sound/)
})

test('a face is the state now: nothing in it animates, and the kit exports the four with their readers', async () => {
  const {readFile} = await import('node:fs/promises')
  const source = await readFile(new URL('../src/inhabitants/catalogue/faces/EnvironFaces.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /<animate|requestAnimationFrame|setInterval|setTimeout|@keyframes/, 'no motion without an event')
  const css = await readFile(new URL('../src/inhabitants/catalogue/faces/faces.css', import.meta.url), 'utf8')
  assert.doesNotMatch(css.slice(css.indexOf('.fx-environ {')), /animation|@keyframes/)
  for (const name of ['RiverEnviron', 'SeasonsEnviron', 'SuccessionEnviron', 'ErosionEnviron', 'EnvironBand', 'riverOf', 'seasonsOf', 'successionOf', 'erosionOf']) assert.equal(typeof F[name], name.endsWith('Of') ? 'function' : name === 'EnvironBand' ? 'function' : 'object', name)
})
