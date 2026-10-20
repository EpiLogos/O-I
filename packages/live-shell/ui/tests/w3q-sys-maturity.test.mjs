// T-PROCEDURAL-BODY §6 item 2 (Lane B, the system) — how finished a world's body looks, read from how lived in the world is. Manual §17.2
// "Your system": "A world you have barely begun is a small grey moon: dry, airless, with no cloud. As you work in it, it gains seas, air,
// colour and weather, until a project you have lived in for a year is a planet with weather. Three things count: how long the world has
// existed, how much it holds (its pages and flows), and how many times you have shaped its body. More of any makes it more finished; none
// of them ever makes it less. The look is read from those, never stored." Ticket §2: "The shell holds no body. Maturity, look and weather
// are readings computed from owner readings, held nowhere, written nowhere."
//
// system/maturity.ts (ticket §4):  maturityOf(facts: WorldFacts): number  0 new … 1 lived in; pure
//                                  lookOf(maturity): BodyLook             barren = 1 − smoothstep(LOOK_FROM, LOOK_TO, maturity)
// and the named thresholds this file holds it to: AGE_FULL_MS, HELD_FULL, SHAPED_FULL, WEIGHTS, LOOK_FROM, LOOK_TO.
//
// WorldFacts — the contract, and the owner reading each field comes from (found in the running system, 20 Oct; SystemReadings.tsx
// gathers them, systemModel.ts folds them into each SystemBody's `look`):
//   ageMs   how long the world's register has existed: nowMs minus the earliest `observed_at_unix_seconds` of the register's change horizon
//           (Central's `central` inspect → `sources.data.changes`: desktop/cradle/kernel/src/central.rs:200, desktop/cradle/src/central/client.ts:74
//           readGround(transport, project)). The horizon is Central's durable record of every change it has observed in the register: its
//           first row is the nearest owner reading of when the register began. (No owner states a register's creation; this is the oldest
//           dated thing the owner keeps. A horizon that began late under-reads the age: the world looks younger, never older.)
//   held    how many pages and flows the world holds: the page owner's listing of the world's folder, every form (Being, Thing, page, Flow)
//           (central/centralWorlds.ts:70 readWorldPages → PageListing.pages, read per world at SystemReadings.tsx:132-141)
//   shaped  how many times its body has been shaped: the revision of the register's root space the body lives on
//           (WorldBodyReading.space.revision, desktop/cradle/src/kernel/types.ts:239; kernel construction.rs:472 read_body). Every facts write
//           to the space bumps it, a BodySet and a PlaceSet alike, so it counts the work done on the world's facts, of which the body is the
//           part the manual names; the record carries no count of its own (it does not change). Shaping a body by hand moves it, as the manual says.
//
// Channels: scripted. The functions are pure and the tests call them directly; nothing is written by them and the tests prove it.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/') || s === 'react-dom' || s.startsWith('react-dom/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
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
const model = await import('../src/projections/atlas/system/systemModel.ts')
const mod = await import('../src/projections/atlas/system/maturity.ts').catch(error => ({absent: error instanceof Error ? error.message : String(error)}))
const maturitySource = (() => { try { return readFileSync(new URL('../src/projections/atlas/system/maturity.ts', import.meta.url), 'utf8') } catch { return null } })()

const ENFORCE = process.env.W3Q_GATE === 'enforce'
const pending = ENFORCE ? {} : {todo: 'T-PROCEDURAL-BODY: red until the system lane lands'}

/** The module, or a failed assertion that says it is not written (never an import error that hides the other tests). */
const lib = () => {
  assert.ok(!('absent' in mod) && typeof mod.maturityOf === 'function' && typeof mod.lookOf === 'function',
    `system/maturity.ts exports maturityOf() and lookOf() — not written yet (${'absent' in mod ? mod.absent : 'an export is missing'})`)
  for (const name of ['AGE_FULL_MS', 'HELD_FULL', 'SHAPED_FULL', 'LOOK_FROM', 'LOOK_TO']) assert.equal(typeof mod[name], 'number', `maturity.ts exports ${name}, a named threshold with its reasoning beside it`)
  assert.ok(mod.WEIGHTS && typeof mod.WEIGHTS.age === 'number' && typeof mod.WEIGHTS.held === 'number' && typeof mod.WEIGHTS.shaped === 'number', 'maturity.ts exports WEIGHTS {age, held, shaped}')
  return mod
}

const MIN = 60_000, DAY = 24 * 60 * MIN, YEAR = 365 * DAY
const facts = (ageMs = 0, held = 0, shaped = 0) => ({ageMs, held, shaped})
const near = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-9, `${why}: ${a} vs ${b}`)

// ── what a new world and a lived-in one are ────────────────────────────────────────────────────────────────────────────────

test('a new empty world is no finish at all, a moon; a world lived in for a year with many pages and shaping is complete, a planet with weather', pending, () => {
  const {maturityOf, lookOf, AGE_FULL_MS, HELD_FULL, SHAPED_FULL} = lib()
  assert.equal(maturityOf(facts(0, 0, 0)), 0, 'a world with no age, nothing held and no shaping: maturity 0')
  assert.equal(lookOf(0).barren, 1, 'maturity 0: a barely shaped grey moon (barren 1: dry, airless, no cloud)')
  assert.ok(AGE_FULL_MS <= YEAR, 'a year is enough age: "a project you have lived in for a year" is complete (manual §17.2)')
  const lived = maturityOf(facts(YEAR, HELD_FULL * 3, SHAPED_FULL * 3))
  near(lived, 1, 'a year old, holding many pages and flows, shaped many times: maturity 1')
  assert.equal(lookOf(lived).barren, 0, 'maturity 1: a planet with its seas, air, colour and weather (barren 0, the lived-in default)')
  assert.ok(maturityOf(facts(DAY, 1, 1)) < .25, 'a day-old world with a page and a shaping is still near the moon')
})

test('each of the three readings counts: its own weight, none alone a whole planet, the three together exactly one', pending, () => {
  const {maturityOf, WEIGHTS, AGE_FULL_MS, HELD_FULL, SHAPED_FULL} = lib()
  near(WEIGHTS.age + WEIGHTS.held + WEIGHTS.shaped, 1, 'the weights sum to one, so all three at their full make exactly one')
  for (const key of ['age', 'held', 'shaped']) assert.ok(WEIGHTS[key] > 0 && WEIGHTS[key] < 1, `${key} counts, and does not count for everything`)
  near(maturityOf(facts(AGE_FULL_MS, 0, 0)), WEIGHTS.age, 'age alone, at its full, is its weight')
  near(maturityOf(facts(0, HELD_FULL, 0)), WEIGHTS.held, 'what it holds alone, at its full, is its weight')
  near(maturityOf(facts(0, 0, SHAPED_FULL)), WEIGHTS.shaped, 'shaping alone, at its full, is its weight')
  near(maturityOf(facts(AGE_FULL_MS, HELD_FULL, SHAPED_FULL)), 1, 'all three at their full')
})

// ── monotone, bounded, deterministic ─────────────────────────────────────────────────────────────────────────────────────────

test('more of any reading makes a world more finished, never less, and each reading has a named full beyond which more changes nothing', pending, () => {
  const {maturityOf, AGE_FULL_MS, HELD_FULL, SHAPED_FULL} = lib()
  const base = facts(AGE_FULL_MS / 3, HELD_FULL / 3, SHAPED_FULL / 3)
  const ladders = [['ageMs', AGE_FULL_MS], ['held', HELD_FULL], ['shaped', SHAPED_FULL]]
  for (const [key, full] of ladders) {
    const at = value => maturityOf({...base, [key]: value})
    const steps = Array.from({length: 41}, (_, i) => full * i / 20)
    const values = steps.map(at)
    assert.deepEqual([...values].sort((a, b) => a - b), values, `${key}: a ladder of more and more is never less`)
    assert.ok(at(full / 2) > at(0), `${key}: it counts from the first of it`)
    assert.ok(at(full) > at(full / 2), `${key}: and keeps counting up to its full`)
    assert.equal(at(full * 10), at(full), `${key}: beyond its full it changes nothing: a full reading is a full reading`)
    assert.equal(at(full + 1), at(full), `${key}: at the edge, and one past it`)
    assert.ok(at(full - 1e-6 * full) < at(full), `${key}: just short of its full is less than its full`)
  }
})

test('no change of one reading ever lowers maturity, over many readings together (deterministic pseudo-random pairs, never Math.random)', pending, () => {
  const {maturityOf, AGE_FULL_MS, HELD_FULL, SHAPED_FULL} = lib()
  let x = 20261020
  const next = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296 }
  for (let i = 0; i < 400; i++) {
    const lo = facts(next() * AGE_FULL_MS * 1.3, Math.floor(next() * HELD_FULL * 1.3), Math.floor(next() * SHAPED_FULL * 1.3))
    const hi = facts(lo.ageMs + next() * AGE_FULL_MS, lo.held + Math.floor(next() * HELD_FULL), lo.shaped + Math.floor(next() * SHAPED_FULL))
    assert.ok(maturityOf(hi) >= maturityOf(lo), `${JSON.stringify(lo)} → ${JSON.stringify(hi)} lowered maturity`)
    for (const key of ['ageMs', 'held', 'shaped']) assert.ok(maturityOf({...lo, [key]: hi[key]}) >= maturityOf(lo), `${key} alone lowered maturity`)
  }
})

test('maturity is bounded 0 to 1 and finite for every reading, however odd: a skewed clock, a missing count, an unbounded one', pending, () => {
  const {maturityOf, lookOf, AGE_FULL_MS, HELD_FULL, SHAPED_FULL} = lib()
  const odd = [-DAY, -1, -0, 0, NaN, undefined, null, '7', Infinity, -Infinity, 1e300, Number.MAX_SAFE_INTEGER]
  for (const age of odd) for (const held of odd) for (const shaped of odd) {
    const value = maturityOf({ageMs: age, held, shaped})
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `maturityOf(${[age, held, shaped].map(String)}) = ${value}`)
    const look = lookOf(value)
    assert.ok(Number.isFinite(look.barren) && look.barren >= 0 && look.barren <= 1, `the look of ${value}: ${JSON.stringify(look)}`)
  }
  assert.equal(maturityOf(facts(-5 * YEAR, 0, 0)), 0, 'a register that seems to be from the future (a skewed clock) counts as new, not as a negative')
  assert.equal(maturityOf(facts(NaN, 0, 0)), 0, 'a reading that is not a number counts as nothing: no reading, no claim of age')
  near(maturityOf(facts(Infinity, Infinity, Infinity)), 1, 'unbounded readings are a full planet, not NaN')
  assert.equal(maturityOf({}), 0, 'readings that are not given count as nothing')
  near(maturityOf(facts(AGE_FULL_MS, HELD_FULL, SHAPED_FULL)), 1, 'all three at their full')
})

test('the same readings give the same maturity and the same look, and nothing the caller holds is changed', pending, () => {
  const {maturityOf, lookOf} = lib()
  const given = Object.freeze(facts(200 * DAY, 17, 5))
  assert.equal(maturityOf(given), maturityOf({...given}))
  assert.equal(maturityOf(given), maturityOf(given))
  const look = lookOf(maturityOf(given))
  assert.deepEqual(look, lookOf(maturityOf(given)))
  assert.deepEqual(Object.keys(look), ['barren'], 'the look is the generator\'s BodyLook: barren, and nothing the record could be mistaken to hold')
  assert.deepEqual(given, facts(200 * DAY, 17, 5))
})

test('it only reads: no clock, no dice, no store, no owner, no write — the look is held nowhere (ticket §2)', pending, () => {
  lib()
  assert.ok(maturitySource, 'system/maturity.ts is a file')
  const code = maturitySource.split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n')
  assert.doesNotMatch(code, /Math\.random|\bDate\b|performance\.now|setTimeout|setInterval/, 'the age is an input (nowMs minus a dated reading), never read from a clock here')
  assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|fetch\(|kernelOp|invoke\(|writeWorldBody|publish[A-Z]\w*\(|\bnotify\(/, 'it reaches no store and no owner')
  assert.doesNotMatch(code, /^(let|var) /m, 'it keeps no state of its own between calls (no module-level variable that changes)')
  assert.doesNotMatch(code, /from ['"][^'"]*(worldBody|systemStore|SystemReadings|bridge)['"]/, 'it imports no store, binding or transport')
})

// ── the look ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// LOOK_FROM and LOOK_TO: the maturities at which a body stops being a moon and at which it is wholly a planet. barren = 1 − smoothstep(FROM,
// TO, m): a moon below FROM (a world with a page or two and a few days is still the grey moon), a finished planet above TO, and a smooth
// turning between, with no step a person could see as a jump (smoothstep is flat at both ends). The numbers themselves are the lane's to
// name with their reasoning; these tests hold their order, their edges and the shape between them.
test('the look is a smooth turn from the moon to the planet between two named maturities, barren 1 − smoothstep, flat at both ends', pending, () => {
  const {lookOf, LOOK_FROM, LOOK_TO} = lib()
  assert.ok(LOOK_FROM > 0 && LOOK_FROM < LOOK_TO && LOOK_TO <= 1, `0 < LOOK_FROM (${LOOK_FROM}) < LOOK_TO (${LOOK_TO}) ≤ 1: a nearly empty world is still a moon, and a world that is complete is a planet`)
  assert.equal(lookOf(0).barren, 1)
  assert.equal(lookOf(LOOK_FROM).barren, 1, 'at LOOK_FROM the moon begins to give way')
  assert.equal(lookOf(LOOK_FROM / 2).barren, 1, 'below it, a moon')
  assert.equal(lookOf(LOOK_TO).barren, 0, 'at LOOK_TO the planet is whole')
  assert.equal(lookOf(1).barren, 0)
  const smooth = t => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k) }
  for (const m of [LOOK_FROM, LOOK_FROM + (LOOK_TO - LOOK_FROM) * .1, LOOK_FROM + (LOOK_TO - LOOK_FROM) * .25, (LOOK_FROM + LOOK_TO) / 2, LOOK_FROM + (LOOK_TO - LOOK_FROM) * .8, LOOK_TO]) {
    near(lookOf(m).barren, 1 - smooth((m - LOOK_FROM) / (LOOK_TO - LOOK_FROM)), `barren at maturity ${m}`)
  }
  near(lookOf((LOOK_FROM + LOOK_TO) / 2).barren, .5, 'halfway between, half a moon')
  assert.ok(lookOf(LOOK_FROM + (LOOK_TO - LOOK_FROM) * .01).barren > .999, 'flat just past the start: no jump')
  assert.ok(lookOf(LOOK_TO - (LOOK_TO - LOOK_FROM) * .01).barren < .001, 'flat just before the end')
  let last = 2
  for (let i = 0; i <= 200; i++) { const b = lookOf(i / 200).barren; assert.ok(b <= last, `barren never rises with maturity (at ${i / 200})`); last = b }
  assert.equal(lookOf(-3).barren, 1, 'a maturity below 0 is a moon')
  assert.equal(lookOf(7).barren, 0, 'above 1, a planet')
  assert.equal(lookOf(NaN).barren, 1, 'no reading, no finish: a moon')
})

test('a world\'s own readings give its look end to end: a new world is a moon, a year-old world with a hundred pages a planet, in between in between', pending, () => {
  const {maturityOf, lookOf, AGE_FULL_MS, HELD_FULL, SHAPED_FULL} = lib()
  const barren = f => lookOf(maturityOf(f)).barren
  assert.equal(barren(facts(0, 0, 0)), 1)
  assert.equal(barren(facts(YEAR, 100, 40)), 0)
  const mid = barren(facts(AGE_FULL_MS / 2, HELD_FULL / 2, SHAPED_FULL / 2))
  assert.ok(mid > 0 && mid < 1, `half-lived is part moon (${mid})`)
  assert.ok(barren(facts(AGE_FULL_MS / 2, HELD_FULL / 2, SHAPED_FULL / 2)) >= barren(facts(AGE_FULL_MS, HELD_FULL / 2, SHAPED_FULL / 2)), 'living in it longer never makes it barer')
})

// ── folded into each body of your system ──────────────────────────────────────────────────────────────────────────────────

const YOURS = {ref: 'central:wiki:root', name: 'Your world', kind: 'yours', folder: 'Control/user/flows', project: null}
const OI = {ref: 'central:wiki:project:O-I', name: 'O-I', kind: 'project', folder: 'Work/O-I/ProjectCentral/user', project: 'O-I'}
const BOOK = {ref: 'central:wiki:project:Book', name: 'Book', kind: 'project', folder: 'Work/Book/ProjectCentral/user', project: 'Book'}
const RECORD = Object.freeze({
  body_ref: 'body:central:wiki:root', seed: 20261018, generator: {id: 'fbm-sphere', version: 1},
  landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3},
  sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18},
})
const read = (ref, record, revision = 4) => ({state: 'read', record, reading: {schema: 'oi.world-body-reading/v1', register: null, space: {ref, revision, title: null}, disclosed_revision: revision,
  body: record, wiki_source: {path: 'w.json', ref: 'central:source:wiki', revision: 'r'}, owner_operation: 'aikit wiki-construct facts-inspect'}})
const systemOf = extra => model.systemOf({worlds: [YOURS, OI, BOOK], bodies: new Map([[YOURS.ref, read(YOURS.ref, RECORD, 67)], [OI.ref, read(OI.ref, null, 9)]]),
  playing: [], sessions: [], hand: {file: null, works: []}, artifacts: [], nowMs: Date.UTC(2026, 9, 20, 12), ...extra})

test('each body of your system carries the look its own world\'s readings give it — your own world is not exempt — and a world not yet read claims none', pending, () => {
  const {maturityOf, lookOf} = lib()
  const readings = new Map([[YOURS.ref, facts(400 * DAY, 120, 30)], [OI.ref, facts(2 * DAY, 1, 0)]])
  const [own, oi, book] = systemOf({facts: readings})
  assert.deepEqual(own.look, lookOf(maturityOf(readings.get(YOURS.ref))), 'your own world: a year of work, a planet')
  assert.equal(own.look.barren, 0)
  assert.deepEqual(oi.look, lookOf(maturityOf(readings.get(OI.ref))), 'a project two days old: a moon')
  assert.equal(oi.look.barren, 1)
  assert.deepEqual(book.look, {}, 'a world whose readings are not in is drawn as the generator draws by default, no moon and no planet claimed for it')
  assert.deepEqual(systemOf({}).map(body => body.look), [{}, {}, {}], 'no readings at all: no claim for any world')
  const once = systemOf({facts: readings}), twice = systemOf({facts: new Map([...readings].reverse())})
  assert.deepEqual(once.map(body => body.look), twice.map(body => body.look), 'the order the readings arrive in changes nothing')
  assert.deepEqual(own.record, RECORD, 'the owner\'s record is untouched: the look rides beside it and is written nowhere')
})
